import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = '/home/pochi/workspaces/work/ai-influencer/v5/scripts';
const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';

const auth = new GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/documents'],
});

const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '12qH5CDgL0f2NtW36ac-nY9HY0WwOEeSgKqG4lfGcu5w';
const REF_TAB = 't.k5zj1t5fuak1';

const res = await docs.documents.get({
  documentId: DOC_ID,
  includeTabsContent: true,
});

const tabs = res.data.tabs || [];
const refTab = tabs.find(t => t.tabProperties?.tabId === REF_TAB);

if (!refTab) {
  console.log('Tab not found. Available tabs:');
  tabs.forEach(t => console.log(' -', t.tabProperties?.title, t.tabProperties?.tabId));
  process.exit(1);
}

console.log('Tab found:', refTab.tabProperties?.title);
const elements = refTab.documentTab?.body?.content || [];

elements.forEach((el) => {
  if (el.paragraph) {
    const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
    const style = el.paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
    const startIdx = el.startIndex;
    const endIdx = el.endIndex;
    if (text.trim() || text === '\n') {
      process.stdout.write(`[${startIdx}-${endIdx}] (${style}) "${text.replace(/\n/g, '\\n').substring(0, 100)}"\n`);
    }
  }
});
