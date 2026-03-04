#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '12qH5CDgL0f2NtW36ac-nY9HY0WwOEeSgKqG4lfGcu5w';
const TPL_TAB = 't.0';

// Fix paragraph style for the two reference lines that got wrong heading styles
// [1028-1052] HEADING_2 → NORMAL_TEXT  (セクションラベル reference)
// [1263-1304] HEADING_3 → NORMAL_TEXT  (制作フロー reference)
const requests = [
  {
    updateParagraphStyle: {
      range: { startIndex: 1028, endIndex: 1052, tabId: TPL_TAB },
      paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
      fields: 'namedStyleType',
    },
  },
  {
    updateParagraphStyle: {
      range: { startIndex: 1263, endIndex: 1304, tabId: TPL_TAB },
      paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
      fields: 'namedStyleType',
    },
  },
];

await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests } });
console.log('Fixed paragraph styles.');
