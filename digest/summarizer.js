'use strict';

const OpenAI = require('openai');
const config = require('./config');

const SYSTEM_PROMPT = `あなたはAI KOL（AI インフルエンサー）事業のビジネスアナリストです。
Slackチャンネルの会話を分析し、以下の構造で日本語の要約を作成してください。

1. 本日のトピック — 主要な議題のリスト
2. 決定事項 — 合意・決定された内容（該当メッセージのタイムスタンプを[HH:MM]形式で付記）
3. アクションアイテム — 担当者付きのタスク一覧
4. 重要な議論 — 最も重要な2-3の議論の要約（タイムスタンプ付記）
5. 共有リンク・資料 — 共有されたURL、ファイル、スプレッドシート等
6. メモ — その他の注目点

各セクションで該当なしの場合は「特になし」と記載。
具体的な数値・ID・技術的詳細・人名は省略せず保持すること。
タイムスタンプは全てJST (日本時間) で表記すること。

出力はMarkdownフォーマットで、各セクションを ### 見出しで始めてください。`;

const CHUNK_CHAR_LIMIT = 150000;

/** Retry delays in ms for OpenAI calls */
const RETRY_DELAYS = [2000, 5000, 10000];

/**
 * Call OpenAI with retries (exponential backoff).
 */
async function callWithRetry(openai, params) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`[digest] OpenAI error (attempt ${attempt + 1}), retrying in ${delay}ms: ${err.message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Split text into chunks under the character limit.
 */
function splitIntoChunks(text, limit) {
  if (text.length <= limit) return [text];
  const chunks = [];
  const lines = text.split('\n');
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + 1 > limit && current.length > 0) {
      chunks.push(current);
      current = '';
    }
    current += (current ? '\n' : '') + line;
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Summarize a day's conversation using OpenAI GPT-4o.
 * @param {string} formattedText - The formatted conversation text
 * @param {string} dateStr - YYYY-MM-DD for context
 * @returns {Promise<string>} Markdown summary
 */
async function summarize(formattedText, dateStr) {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env or environment variables.');
  }

  const openai = new OpenAI({ apiKey: config.openai.apiKey });
  const chunks = splitIntoChunks(formattedText, CHUNK_CHAR_LIMIT);

  if (chunks.length === 1) {
    // Single-pass summarization
    const res = await callWithRetry(openai, {
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `以下は${dateStr}のSlackチャンネルの会話ログです。要約してください。\n\n${formattedText}` },
      ],
    });
    return res.choices[0].message.content;
  }

  // Multi-pass: summarize each chunk, then combine
  console.log(`[digest] Large conversation (${formattedText.length} chars) — splitting into ${chunks.length} chunks`);
  const partialSummaries = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[digest] Summarizing chunk ${i + 1}/${chunks.length}...`);
    const res = await callWithRetry(openai, {
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `以下は${dateStr}のSlackチャンネルの会話ログ（パート${i + 1}/${chunks.length}）です。要約してください。\n\n${chunks[i]}`,
        },
      ],
    });
    partialSummaries.push(res.choices[0].message.content);
  }

  // Combine partial summaries
  console.log('[digest] Combining partial summaries...');
  const combined = partialSummaries.join('\n\n---\n\n');
  const res = await callWithRetry(openai, {
    model: config.openai.model,
    max_tokens: config.openai.maxTokens,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `以下は${dateStr}のSlackチャンネル会話の部分要約です。これらを統合して、一つの完全な日次要約を作成してください。\n\n${combined}`,
      },
    ],
  });
  return res.choices[0].message.content;
}

module.exports = {
  summarize,
  // Exposed for testing
  SYSTEM_PROMPT,
  CHUNK_CHAR_LIMIT,
  splitIntoChunks,
};
