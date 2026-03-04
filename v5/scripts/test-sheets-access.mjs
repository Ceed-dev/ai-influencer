#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const SPREADSHEET_ID = '1zpNpZ7F1QlhcJBvAGZifqvyYp-lTC6v129Vxp-22k1k';

const auth = new GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
});
const sheets = google.sheets({ version: 'v4', auth });

// 1. Read: シート一覧を取得
console.log('=== READ TEST ===');
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
console.log('Title:', meta.data.properties?.title);
console.log('Sheets:');
for (const s of meta.data.sheets ?? []) {
  console.log(`  - [${s.properties?.index}] "${s.properties?.title}" (sheetId: ${s.properties?.sheetId})`);
}

// 2. Read: 最初のシートのA1:E5を取得
const firstSheet = meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1';
const range = `'${firstSheet}'!A1:E5`;
console.log(`\n=== READ RANGE: ${range} ===`);
const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
const rows = res.data.values ?? [];
for (const row of rows) console.log(row);

console.log('\n=== WRITE TEST ===');
// 3. Write: テストセルに書き込み（空きセルを使う）
const testRange = `'${firstSheet}'!Z1`;
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: testRange,
  valueInputOption: 'RAW',
  requestBody: { values: [['API_WRITE_OK']] },
});
console.log(`Written "API_WRITE_OK" to ${testRange}`);

// 4. Read back & clear
const readBack = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: testRange });
console.log('Read back:', readBack.data.values);

await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: testRange });
console.log('Cleared test cell.');

console.log('\n✅ Read/Write both OK');
