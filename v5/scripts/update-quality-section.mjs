#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '18ybq4u4wzbX4ZHQwPaivB4Y0WQpcKZhrki9RnKU749Q';

// [1637-1858]: セクション本文を丸ごと差し替える
// "以下を全て満たしていれば提出OK:\n" ～ "「playbookファイル」フォルダに保存されている\n"

const warning =
  '⚠️ ClaudeはAIであり、出力内容が常に正しいとは限らない。生成されたMDファイルをDriveにアップロードする前に、必ず人間が全内容を細かく読んで確認・修正すること。Claudeの出力を鵜呑みにしてはいけない。情報の正確性・再現性・実用性の責任は最終的に人間が負う。\n';

const checklist =
  'アップロード前に以下を全て人間が確認すること:\n' +
  '    ☐  【最重要】MDファイルの内容を人間が全文通読し、誤り・曖昧な記述・再現不可能な記述がないことを確認した\n' +
  '    ☐  TEMPLATEの全セクション（1〜9）が埋まっている\n' +
  '    ☐  制作フローの各ステップに実際のプロンプト文と数値パラメータが書かれている\n' +
  '    ☐  クオリティ基準に合格・不合格の具体的な判断基準が書かれている\n' +
  '    ☐  ファイル名が {content_format}_{niche}.md の形式になっている\n' +
  '    ☐  「playbookファイル」フォルダに保存されている\n';

const newBody = warning + checklist;

// 旧テキスト [1637-1858] を削除して新テキストを挿入
const requests = [
  { deleteContentRange: { range: { startIndex: 1637, endIndex: 1858 } } },
  { insertText: { location: { index: 1637 }, text: newBody } },
];

await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests } });
console.log('Text replaced.');

// 新しい位置を取得
const res = await docs.documents.get({ documentId: DOC_ID });
const elements = res.data.body?.content || [];

let warningStart = null, warningEnd = null;
let checklistHeadStart = null, checklistHeadEnd = null;
let topItemStart = null, topItemEnd = null;

for (const el of elements) {
  if (!el.paragraph) continue;
  const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
  if (text.startsWith('⚠️')) {
    warningStart = el.startIndex;
    warningEnd = el.endIndex;
  }
  if (text.startsWith('アップロード前に')) {
    checklistHeadStart = el.startIndex;
    checklistHeadEnd = el.endIndex;
  }
  if (text.includes('【最重要】')) {
    topItemStart = el.startIndex;
    topItemEnd = el.endIndex;
  }
}

console.log(`Warning: [${warningStart}-${warningEnd}]`);
console.log(`Checklist head: [${checklistHeadStart}-${checklistHeadEnd}]`);
console.log(`Top item: [${topItemStart}-${topItemEnd}]`);

const red = { red: 0.85, green: 0.1, blue: 0.1 };
const darkRed = { red: 0.7, green: 0.0, blue: 0.0 };

const styleRequests = [];

// ⚠️ 警告行: 赤・太字・大きめ
if (warningStart != null) {
  styleRequests.push({
    updateTextStyle: {
      range: { startIndex: warningStart, endIndex: warningEnd - 1 },
      textStyle: {
        bold: true,
        foregroundColor: { color: { rgbColor: red } },
        fontSize: { magnitude: 11, unit: 'PT' },
      },
      fields: 'bold,foregroundColor,fontSize',
    },
  });
}

// 「アップロード前に〜」行: 太字
if (checklistHeadStart != null) {
  styleRequests.push({
    updateTextStyle: {
      range: { startIndex: checklistHeadStart, endIndex: checklistHeadEnd - 1 },
      textStyle: { bold: true },
      fields: 'bold',
    },
  });
}

// 【最重要】行: 赤・太字
if (topItemStart != null) {
  styleRequests.push({
    updateTextStyle: {
      range: { startIndex: topItemStart, endIndex: topItemEnd - 1 },
      textStyle: {
        bold: true,
        foregroundColor: { color: { rgbColor: darkRed } },
      },
      fields: 'bold,foregroundColor',
    },
  });
}

if (styleRequests.length > 0) {
  await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests: styleRequests } });
  console.log('Styles applied.');
}

console.log('Done.');
