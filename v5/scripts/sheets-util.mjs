#!/usr/bin/env node
/**
 * Google Sheets ユーティリティ
 * googleapis (Google公式) + サービスアカウント認証
 *
 * 使い方:
 *   node scripts/sheets-util.mjs read   <spreadsheetId> [sheetName]
 *   node scripts/sheets-util.mjs write  <spreadsheetId> <sheetName> <row> <col> <value>
 *   node scripts/sheets-util.mjs append <spreadsheetId> <sheetName> <json_values>
 *   node scripts/sheets-util.mjs protect <spreadsheetId>
 *   node scripts/sheets-util.mjs create <title>
 *   node scripts/sheets-util.mjs info   <spreadsheetId>
 *
 * 注意: 書き込み操作にはスプシをSAと共有する必要あり
 *   SA email: ai-influencer-sa@ai-influencer-ceed.iam.gserviceaccount.com
 */

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SA_KEY_PATH = join(__dirname, '../credentials/service-account.json');

const auth = new GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

const [,, command, ...args] = process.argv;

// ───── コマンド処理 ─────

switch (command) {

  // スプシ情報（タブ一覧・シートID）
  case 'info': {
    const [spreadsheetId] = args;
    if (!spreadsheetId) { console.error('Usage: info <spreadsheetId>'); process.exit(1); }
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const sp = res.data;
    console.log('Title:', sp.properties?.title);
    console.log('Sheets:');
    sp.sheets?.forEach(s => {
      console.log(`  - "${s.properties?.title}" (gid=${s.properties?.sheetId})`);
    });
    break;
  }

  // 読み取り
  case 'read': {
    const [spreadsheetId, sheetName] = args;
    if (!spreadsheetId) { console.error('Usage: read <spreadsheetId> [sheetName]'); process.exit(1); }
    const range = sheetName ? `'${sheetName}'` : 'Sheet1';
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = res.data.values || [];
    console.log(JSON.stringify(rows, null, 2));
    break;
  }

  // セル書き込み
  case 'write': {
    const [spreadsheetId, sheetName, row, col, value] = args;
    if (!spreadsheetId || !sheetName || !row || !col || value === undefined) {
      console.error('Usage: write <spreadsheetId> <sheetName> <row(1-based)> <col(1-based)> <value>');
      process.exit(1);
    }
    const colLetter = colToLetter(parseInt(col));
    const range = `'${sheetName}'!${colLetter}${row}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    });
    console.log(`Written "${value}" to ${range}`);
    break;
  }

  // 行追加
  case 'append': {
    const [spreadsheetId, sheetName, jsonValues] = args;
    if (!spreadsheetId || !sheetName || !jsonValues) {
      console.error('Usage: append <spreadsheetId> <sheetName> <json_values>');
      console.error('  Example: append SHEET_ID "投稿収集" \'[["https://...", "TikTok", "pet", "理由", 50000]]\'');
      process.exit(1);
    }
    const values = JSON.parse(jsonValues);
    const range = `'${sheetName}'`;
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    console.log(`Appended ${values.length} row(s) to "${sheetName}"`);
    break;
  }

  // 保護設定（READMEタブ全体 + 各データタブの1行目をオーナー+SAのみ編集可）
  case 'protect': {
    const [spreadsheetId, ownerEmail = 'pochi@0xqube.xyz'] = args;
    if (!spreadsheetId) { console.error('Usage: protect <spreadsheetId> [ownerEmail]'); process.exit(1); }

    const SA_EMAIL = 'ai-influencer-sa@ai-influencer-ceed.iam.gserviceaccount.com';
    // 編集可能にするユーザー: スプシオーナー + SA（プログラム側で書き込むため）
    const allowedEditors = [ownerEmail, SA_EMAIL];

    const spRes = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetsList = spRes.data.sheets || [];

    const requests = [];
    for (const sheet of sheetsList) {
      const sheetId = sheet.properties?.sheetId;
      const title = sheet.properties?.title;
      if (sheetId === undefined) continue;

      if (title === 'README') {
        // READMEタブ全体を保護
        requests.push({
          addProtectedRange: {
            protectedRange: {
              range: { sheetId },
              description: 'README - オーナーのみ編集可',
              warningOnly: false,
              editors: { users: allowedEditors },
            },
          },
        });
        console.log(`Protecting full sheet: "${title}"`);
      } else {
        // 1行目（ヘッダー）を保護
        requests.push({
          addProtectedRange: {
            protectedRange: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              description: `${title} - ヘッダー行（オーナーのみ編集可）`,
              warningOnly: false,
              editors: { users: allowedEditors },
            },
          },
        });
        console.log(`Protecting row 1 (header) of: "${title}"`);
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      console.log('Protection set successfully.');
    }
    break;
  }

  // 新規スプシ作成
  case 'create': {
    const [title] = args;
    if (!title) { console.error('Usage: create <title>'); process.exit(1); }
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [{ properties: { title: 'Sheet1' } }],
      },
    });
    console.log('Created spreadsheet:');
    console.log('  ID:', res.data.spreadsheetId);
    console.log('  URL:', res.data.spreadsheetUrl);
    break;
  }

  default:
    console.log(`
Google Sheets ユーティリティ (googleapis公式 + サービスアカウント認証)

コマンド:
  info    <spreadsheetId>                            タブ一覧・シートID表示
  read    <spreadsheetId> [sheetName]                データ読み取り (JSON出力)
  write   <spreadsheetId> <sheetName> <row> <col> <value>  セル書き込み
  append  <spreadsheetId> <sheetName> <json_values>  行追加
  protect <spreadsheetId>                            保護設定 (README全体 + 各タブ1行目)
  create  <title>                                    新規スプシ作成

SA email (書き込みにはスプシと共有が必要):
  ai-influencer-sa@ai-influencer-ceed.iam.gserviceaccount.com
    `);
}

// 列番号(1-based) → アルファベット
function colToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}
