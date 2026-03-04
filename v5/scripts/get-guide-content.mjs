#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '18ybq4u4wzbX4ZHQwPaivB4Y0WQpcKZhrki9RnKU749Q';
const res = await docs.documents.get({ documentId: DOC_ID });
const elements = res.data.body?.content || [];

elements.forEach(el => {
  if (el.paragraph) {
    const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
    if (text.trim()) process.stdout.write(`[${el.startIndex}-${el.endIndex}] "${text.replace(/\n/g,'\\n')}"\n`);
  }
});
