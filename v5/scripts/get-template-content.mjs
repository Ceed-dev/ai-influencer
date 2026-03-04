#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';

const auth = new GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/documents'],
});

const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '12qH5CDgL0f2NtW36ac-nY9HY0WwOEeSgKqG4lfGcu5w';
const TPL_TAB = 't.0';

const res = await docs.documents.get({
  documentId: DOC_ID,
  includeTabsContent: true,
});

const tabs = res.data.tabs || [];
const tplTab = tabs.find(t => t.tabProperties?.tabId === TPL_TAB);

if (!tplTab) {
  console.log('TEMPLATE tab not found. Tabs:');
  tabs.forEach(t => console.log(' -', t.tabProperties?.title, t.tabProperties?.tabId));
  process.exit(1);
}

const elements = tplTab.documentTab?.body?.content || [];
elements.forEach((el) => {
  if (el.paragraph) {
    const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
    const style = el.paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
    const si = el.startIndex;
    const ei = el.endIndex;
    if (text.trim()) {
      process.stdout.write(`[${si}-${ei}] (${style}) "${text.replace(/\n/g, '\\n').substring(0, 100)}"\n`);
    }
  }
});
