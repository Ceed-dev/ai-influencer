#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '18ybq4u4wzbX4ZHQwPaivB4Y0WQpcKZhrki9RnKU749Q';

const oldText = '    「今までの試行錯誤の内容を、上記のTEMPLATEの形式・情報の種類・粒度に合わせてMDファイルとしてまとめて。」\n';
const newText = '    「試行錯誤を通じて見つけたベストなやり方（パラメータ・プロンプト・判断基準）を、上記のTEMPLATEの形式・情報の種類・粒度に合わせてMDファイルとしてまとめて。試行錯誤のプロセスではなく、最終的なベストプラクティスのみを記載すること。」\n';

// [687-749] を削除して新テキストを挿入
const requests = [
  { deleteContentRange: { range: { startIndex: 687, endIndex: 749 } } },
  { insertText: { location: { index: 687 }, text: newText } },
];

await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests } });
console.log('Text replaced.');

// 新テキストにボールドを適用
const newEnd = 687 + newText.length;
await docs.documents.batchUpdate({
  documentId: DOC_ID,
  requestBody: {
    requests: [{
      updateTextStyle: {
        range: { startIndex: 687, endIndex: newEnd - 1 },
        textStyle: { bold: true },
        fields: 'bold',
      },
    }],
  },
});
console.log('Bold applied.');
