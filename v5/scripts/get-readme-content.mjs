#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const README_ID = '1RUuhoFKB0vunTMa9lUFTAG6Rz3_VBmJtX2wbbV9vfoE';

const res = await docs.documents.get({ documentId: README_ID });
const elements = res.data.body?.content || [];

elements.forEach(el => {
  if (el.paragraph) {
    const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
    if (text.trim()) process.stdout.write(text);
  }
});
