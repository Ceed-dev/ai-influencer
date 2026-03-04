#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '18ybq4u4wzbX4ZHQwPaivB4Y0WQpcKZhrki9RnKU749Q';

const requests = [
  { deleteContentRange: { range: { startIndex: 1295, endIndex: 1333 } } },
  { insertText: { location: { index: 1295 }, text: '    期限:           2026-03-07（今週土曜日中）\n' } },
];

await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests } });

// ボールド再適用
const newEnd = 1295 + '    期限:           2026-03-07（今週土曜日中）\n'.length;
await docs.documents.batchUpdate({
  documentId: DOC_ID,
  requestBody: {
    requests: [{
      updateTextStyle: {
        range: { startIndex: 1295, endIndex: newEnd - 1 },
        textStyle: { bold: true },
        fields: 'bold',
      },
    }],
  },
});

console.log('Done.');
