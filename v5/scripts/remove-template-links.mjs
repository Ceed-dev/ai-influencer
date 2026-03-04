#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '12qH5CDgL0f2NtW36ac-nY9HY0WwOEeSgKqG4lfGcu5w';
const TPL_TAB = 't.0';

// 削除対象（bottom → top 順で）
// [1263-1304] ↗ 記入例...
// [1028-1052] ↗ 詳細・例... (3番目)
// [490-514]   ↗ 詳細・例... (2番目)
// [351-375]   ↗ 詳細・例... (1番目)

const requests = [
  { deleteContentRange: { range: { startIndex: 1263, endIndex: 1304, tabId: TPL_TAB } } },
  { deleteContentRange: { range: { startIndex: 1028, endIndex: 1052, tabId: TPL_TAB } } },
  { deleteContentRange: { range: { startIndex: 490, endIndex: 514, tabId: TPL_TAB } } },
  { deleteContentRange: { range: { startIndex: 351, endIndex: 375, tabId: TPL_TAB } } },
];

await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests } });
console.log('Done. All reference link lines removed.');
