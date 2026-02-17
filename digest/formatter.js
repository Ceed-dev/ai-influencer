'use strict';

const { buildPermalink } = require('./slack-client');

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * Known API key / secret patterns to redact from conversation logs.
 * Each entry: [regex, label]
 */
const SECRET_PATTERNS = [
  [/xai-[A-Za-z0-9_-]{20,}/g, '[REDACTED:xAI_KEY]'],
  [/sk-proj-[A-Za-z0-9_-]{20,}/g, '[REDACTED:OPENAI_KEY]'],
  [/sk-[A-Za-z0-9_-]{40,}/g, '[REDACTED:OPENAI_KEY]'],
  [/xoxb-[A-Za-z0-9-]{30,}/g, '[REDACTED:SLACK_BOT_TOKEN]'],
  [/xoxp-[A-Za-z0-9-]{30,}/g, '[REDACTED:SLACK_USER_TOKEN]'],
  [/xoxe\.xoxp-[A-Za-z0-9-]{30,}/g, '[REDACTED:SLACK_TOKEN]'],
  [/ghp_[A-Za-z0-9]{36,}/g, '[REDACTED:GITHUB_PAT]'],
  [/gho_[A-Za-z0-9]{36,}/g, '[REDACTED:GITHUB_OAUTH]'],
  [/ghs_[A-Za-z0-9]{36,}/g, '[REDACTED:GITHUB_APP_TOKEN]'],
  [/github_pat_[A-Za-z0-9_]{20,}/g, '[REDACTED:GITHUB_PAT]'],
  [/AIza[A-Za-z0-9_-]{30,}/g, '[REDACTED:GOOGLE_API_KEY]'],
  [/ya29\.[A-Za-z0-9_-]{50,}/g, '[REDACTED:GOOGLE_OAUTH_TOKEN]'],
  [/AKIA[A-Z0-9]{16}/g, '[REDACTED:AWS_ACCESS_KEY]'],
  [/fal-[A-Za-z0-9_-]{20,}/g, '[REDACTED:FAL_KEY]'],
];

/**
 * Redact known API keys and secrets from text.
 */
function redactSecrets(text) {
  let result = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Convert Unix timestamp (seconds) to JST Date.
 */
function tsToJST(ts) {
  const ms = parseFloat(ts) * 1000;
  return new Date(ms + JST_OFFSET_MS);
}

/**
 * Format a JST Date as HH:MM string.
 */
function formatTimeJST(ts) {
  const d = tsToJST(ts);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Format messages for the summarizer (plain text with timestamps).
 * @param {Array} messages
 * @param {Map} threadReplies
 * @param {Map} users - Map<userId, displayName>
 * @param {Map} [continuedThreads] - Map<ts, {parent, replies}> old threads with new replies
 * @returns {string}
 */
function formatForSummarizer(messages, threadReplies, users, continuedThreads) {
  const lines = [];

  for (const msg of messages) {
    const time = formatTimeJST(msg.ts);
    const name = users.get(msg.user) || msg.user || 'unknown';
    const text = msg.text || '';
    lines.push(`[${time}] ${name}: ${text}`);

    // Append attachments/files info
    if (msg.files && msg.files.length > 0) {
      for (const f of msg.files) {
        lines.push(`  [ファイル: ${f.name || f.title || 'unnamed'}]`);
      }
    }

    // Append thread replies inline
    const replies = threadReplies.get(msg.ts);
    if (replies && replies.length > 0) {
      lines.push(`  --- スレッド (${replies.length}件) ---`);
      for (const r of replies) {
        const rTime = formatTimeJST(r.ts);
        const rName = users.get(r.user) || r.user || 'unknown';
        lines.push(`  [${rTime}] ${rName}: ${r.text || ''}`);
      }
      lines.push(`  --- スレッド終了 ---`);
    }
  }

  // Continued threads: old threads with new replies today
  if (continuedThreads && continuedThreads.size > 0) {
    lines.push('');
    lines.push('=== 前日以前のスレッドの続き ===');
    for (const [, { parent, replies }] of continuedThreads) {
      const pTime = formatTimeJST(parent.ts);
      const pName = users.get(parent.user) || parent.user || 'unknown';
      lines.push(`\n[元のメッセージ ${pTime}] ${pName}: ${parent.text || ''}`);
      lines.push(`  --- 本日の返信 (${replies.length}件) ---`);
      for (const r of replies) {
        const rTime = formatTimeJST(r.ts);
        const rName = users.get(r.user) || r.user || 'unknown';
        lines.push(`  [${rTime}] ${rName}: ${r.text || ''}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Compose the final Markdown document.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} summary - AI-generated summary
 * @param {string} rawFormatted - Formatted conversation log
 * @param {{messageCount, threadCount, participantCount}} stats
 * @param {string} channelName
 * @returns {string}
 */
function composeMarkdown(dateStr, summary, rawFormatted, stats, channelName) {
  const generatedAt = new Date().toISOString();
  const [year, month, day] = dateStr.split('-');
  const dateDisplay = `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`;

  const frontmatter = [
    '---',
    `date: ${dateStr}`,
    `channel: ${channelName}`,
    `messages: ${stats.messageCount}`,
    `threads: ${stats.threadCount}`,
    `participants: ${stats.participantCount}`,
    `generated_at: ${generatedAt}`,
    '---',
  ].join('\n');

  const header = `# Slack日報: ${dateDisplay} (${channelName})`;

  const statLines = [`- メッセージ数: ${stats.messageCount} / スレッド数: ${stats.threadCount} / 参加者: ${stats.participantCount}名`];
  if (stats.continuedThreadCount > 0) {
    statLines.push(`- 前日以前のスレッド続行: ${stats.continuedThreadCount}件 (本日の返信: ${stats.continuedReplyCount}件)`);
  }
  const statsSection = ['## 統計', ...statLines].join('\n');

  const logSection = [
    '## 会話ログ',
    `<details>`,
    `<summary>全会話ログを展開 (${stats.messageCount} messages)</summary>`,
    '',
    rawFormatted,
    '',
    '</details>',
  ].join('\n');

  const raw = [frontmatter, '', header, '', '## サマリー', '', summary, '', '---', '', statsSection, '', logSection, ''].join('\n');
  return redactSecrets(raw);
}

/**
 * Compose a minimal "no activity" markdown file.
 */
function composeNoActivity(dateStr, channelName) {
  const generatedAt = new Date().toISOString();
  const [year, month, day] = dateStr.split('-');
  const dateDisplay = `${year}年${parseInt(month, 10)}月${parseInt(day, 10)}日`;

  const frontmatter = [
    '---',
    `date: ${dateStr}`,
    `channel: ${channelName}`,
    `messages: 0`,
    `threads: 0`,
    `participants: 0`,
    `generated_at: ${generatedAt}`,
    '---',
  ].join('\n');

  return [frontmatter, '', `# Slack日報: ${dateDisplay} (${channelName})`, '', '活動なし', ''].join('\n');
}

/**
 * Format conversation log for the raw log section of the markdown.
 * Uses the same data but formats with markdown structure.
 */
function formatConversationLog(messages, threadReplies, users, channelId, continuedThreads) {
  const lines = [];

  for (const msg of messages) {
    const time = formatTimeJST(msg.ts);
    const name = users.get(msg.user) || msg.user || 'unknown';
    const text = msg.text || '';
    const permalink = buildPermalink(channelId, msg.ts);
    const linkSuffix = permalink ? ` ([link](${permalink}))` : '';

    lines.push(`### ${time} JST - ${name}${linkSuffix}`);
    lines.push(text);

    if (msg.files && msg.files.length > 0) {
      for (const f of msg.files) {
        lines.push(`\n*[ファイル: ${f.name || f.title || 'unnamed'}]*`);
      }
    }

    const replies = threadReplies.get(msg.ts);
    if (replies && replies.length > 0) {
      lines.push('');
      lines.push(`> **スレッド (${replies.length}件):**`);
      for (const r of replies) {
        const rTime = formatTimeJST(r.ts);
        const rName = users.get(r.user) || r.user || 'unknown';
        lines.push(`> ${rTime} - ${rName}: ${r.text || ''}`);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Continued threads from previous days
  if (continuedThreads && continuedThreads.size > 0) {
    lines.push('## 前日以前のスレッドの続き');
    lines.push('');
    for (const [, { parent, replies }] of continuedThreads) {
      const pTime = formatTimeJST(parent.ts);
      const pName = users.get(parent.user) || parent.user || 'unknown';
      const permalink = buildPermalink(channelId, parent.ts);
      const linkSuffix = permalink ? ` ([link](${permalink}))` : '';

      lines.push(`### 元のメッセージ: ${pTime} JST - ${pName}${linkSuffix}`);
      lines.push(parent.text || '');
      lines.push('');
      lines.push(`> **本日の返信 (${replies.length}件):**`);
      for (const r of replies) {
        const rTime = formatTimeJST(r.ts);
        const rName = users.get(r.user) || r.user || 'unknown';
        lines.push(`> ${rTime} - ${rName}: ${r.text || ''}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

module.exports = {
  tsToJST,
  formatTimeJST,
  formatForSummarizer,
  composeMarkdown,
  composeNoActivity,
  formatConversationLog,
  redactSecrets,
  JST_OFFSET_MS,
};
