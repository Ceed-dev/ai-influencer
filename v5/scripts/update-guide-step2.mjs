#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '18ybq4u4wzbX4ZHQwPaivB4Y0WQpcKZhrki9RnKU749Q';

// [556-836]: Step 2の説明文3行を削除してより詳しい内容に差し替える
// 削除: [556-836]  → 「試行錯誤が終わったら〜再現できるレベルが基準。\n」

const newText =
  '試行錯誤が終わったら、以下の手順でClaudeに依頼する:\n' +
  '手順:\n' +
  '    1. このフォルダにある「TEMPLATE」ドキュメントの内容を全てコピーし、Claudeとの会話にそのままペーストする\n' +
  '    2. ペーストの直後に、以下のプロンプトを続けて送る:\n' +
  '    「今までの試行錯誤の内容を、上記のTEMPLATEの形式・情報の種類・粒度に合わせてMDファイルとしてまとめて。」\n' +
  'TEMPLATEには9つのセクションがある（メタデータ・コンテンツ概要・参考リンク・セクション構成・制作フロー・ツールの特性・フックの型・クオリティ基準・コスト目安・学んだこと）。全セクションを埋めた状態でMDを出力してもらうこと。\n' +
  '制作フローの各ステップには、実際に使ったプロンプト文章・パラメータ数値まで含める。Claudeが生成した内容をそのままコピーして再現できるレベルが基準。\n';

// Step 1: 旧テキスト削除 → 新テキスト挿入（bottom-to-topは不要、1箇所のみ）
const requests = [
  // まず削除（[556-836]）
  { deleteContentRange: { range: { startIndex: 556, endIndex: 836 } } },
  // 次に新テキスト挿入（削除後のindex 556に）
  { insertText: { location: { index: 556 }, text: newText } },
];

await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests } });
console.log('Text replaced.');

// Step 2: 新しい位置を再取得してスタイルを適用
const res = await docs.documents.get({ documentId: DOC_ID });
const elements = res.data.body?.content || [];

const quoteText = '    「今までの試行錯誤の内容を、上記のTEMPLATEの形式・情報の種類・粒度に合わせてMDファイルとしてまとめて。」\n';

let quoteStart = null, quoteEnd = null;
for (const el of elements) {
  if (!el.paragraph) continue;
  const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
  if (text === quoteText) {
    quoteStart = el.startIndex;
    quoteEnd = el.endIndex;
  }
}

if (quoteStart != null) {
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [{
        updateTextStyle: {
          range: { startIndex: quoteStart, endIndex: quoteEnd - 1 },
          textStyle: { bold: true },
          fields: 'bold',
        },
      }],
    },
  });
  console.log(`Bold applied to quote [${quoteStart}-${quoteEnd}].`);
} else {
  console.log('Quote line not found for styling.');
}

console.log('Done.');
