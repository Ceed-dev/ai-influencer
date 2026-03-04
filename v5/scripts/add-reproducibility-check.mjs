#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '18ybq4u4wzbX4ZHQwPaivB4Y0WQpcKZhrki9RnKU749Q';

// [2027]: 「保存されている」行の前に挿入
const newItem =
  '    ☐  【再現性確認】新しいClaudeセッション（コンテキストなし）を開き、このMDファイルの内容を読み込ませて、期待するクオリティのコンテンツが再現できることを確認した\n';

const requests = [
  { insertText: { location: { index: 2027 }, text: newItem } },
];

await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests } });
console.log('Item inserted.');

// 挿入後の位置を取得してスタイル適用
const res = await docs.documents.get({ documentId: DOC_ID });
const elements = res.data.body?.content || [];

let itemStart = null, itemEnd = null;
for (const el of elements) {
  if (!el.paragraph) continue;
  const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
  if (text.includes('再現性確認')) {
    itemStart = el.startIndex;
    itemEnd = el.endIndex;
  }
}

console.log(`Item at [${itemStart}-${itemEnd}]`);

if (itemStart != null) {
  const orange = { red: 0.9, green: 0.45, blue: 0.0 };
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: {
      requests: [{
        updateTextStyle: {
          range: { startIndex: itemStart, endIndex: itemEnd - 1 },
          textStyle: {
            bold: true,
            foregroundColor: { color: { rgbColor: orange } },
          },
          fields: 'bold,foregroundColor',
        },
      }],
    },
  });
  console.log('Style applied.');
}

console.log('Done.');
