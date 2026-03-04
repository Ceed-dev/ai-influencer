#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/documents'] });
const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '18ybq4u4wzbX4ZHQwPaivB4Y0WQpcKZhrki9RnKU749Q';

const res = await docs.documents.get({ documentId: DOC_ID });
const elements = res.data.body?.content || [];

const targets = [
  'TEMPLATEには9つのセクションがある（メタデータ・コンテンツ概要・参考リンク・セクション構成・制作フロー・ツールの特性・フックの型・クオリティ基準・コスト目安・学んだこと）。全セクションを埋めた状態でMDを出力してもらうこと。\n',
  '制作フローの各ステップには、実際に使ったプロンプト文章・パラメータ数値まで含める。Claudeが生成した内容をそのままコピーして再現できるレベルが基準。\n',
];

const orange = { red: 0.9, green: 0.45, blue: 0.0 }; // オレンジ色

const styleRequests = [];
for (const el of elements) {
  if (!el.paragraph) continue;
  const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
  if (targets.includes(text)) {
    styleRequests.push({
      updateTextStyle: {
        range: { startIndex: el.startIndex, endIndex: el.endIndex - 1 },
        textStyle: {
          bold: true,
          foregroundColor: { color: { rgbColor: orange } },
        },
        fields: 'bold,foregroundColor',
      },
    });
    console.log(`Targeting [${el.startIndex}-${el.endIndex}]: "${text.substring(0, 40)}..."`);
  }
}

if (styleRequests.length > 0) {
  await docs.documents.batchUpdate({ documentId: DOC_ID, requestBody: { requests: styleRequests } });
  console.log('Styles applied.');
} else {
  console.log('Target lines not found.');
}
