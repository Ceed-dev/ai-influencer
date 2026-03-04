#!/usr/bin/env node
/**
 * 用語・補足タブにスタイルを適用する
 * (insertBookmark不使用)
 */
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';

const auth = new GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/documents'],
});

const docs = google.docs({ version: 'v1', auth });

const DOC_ID = '12qH5CDgL0f2NtW36ac-nY9HY0WwOEeSgKqG4lfGcu5w';
const REF_TAB = 't.k5zj1t5fuak1';

// スタイル適用対象（実際の位置）
const headings = [
  // TITLE
  { start: 1, end: 7, style: 'TITLE' },
  // HEADING_2
  { start: 7, end: 33, style: 'HEADING_2' },       // narrative_structure
  { start: 656, end: 672, style: 'HEADING_2' },    // hook_type
  { start: 1214, end: 1223, style: 'HEADING_2' },  // セクションラベル
  { start: 1568, end: 1601, style: 'HEADING_2' },  // 制作フロー 記載例
  // HEADING_3 - narrative_structure subtypes
  { start: 74, end: 87, style: 'HEADING_3' },      // linear
  { start: 199, end: 213, style: 'HEADING_3' },    // parallel
  { start: 311, end: 330, style: 'HEADING_3' },    // climactic
  { start: 429, end: 443, style: 'HEADING_3' },    // circular
  { start: 548, end: 563, style: 'HEADING_3' },    // listicle
  // HEADING_3 - hook_type subtypes
  { start: 714, end: 728, style: 'HEADING_3' },    // question
  { start: 793, end: 811, style: 'HEADING_3' },    // reaction
  { start: 865, end: 880, style: 'HEADING_3' },    // statement
  { start: 933, end: 947, style: 'HEADING_3' },    // story
  { start: 1001, end: 1020, style: 'HEADING_3' },  // demonstration
  { start: 1089, end: 1100, style: 'HEADING_3' },  // shock
  { start: 1148, end: 1160, style: 'HEADING_3' },  // mystery
  // HEADING_3 - 制作フロー steps
  { start: 1699, end: 1723, style: 'HEADING_3' },  // ステップ1: Kling
  { start: 2188, end: 2211, style: 'HEADING_3' },  // ステップ2: Fish Audio
  { start: 2413, end: 2442, style: 'HEADING_3' },  // ステップ3: Sync Lipsync
  { start: 2591, end: 2613, style: 'HEADING_3' },  // ステップ4: ffmpeg
];

const requests = headings.map(({ start, end, style }) => ({
  updateParagraphStyle: {
    range: {
      startIndex: start,
      endIndex: end,
      tabId: REF_TAB,
    },
    paragraphStyle: {
      namedStyleType: style,
    },
    fields: 'namedStyleType',
  },
}));

// 説明行をイタリックにする
const italicRanges = [
  { start: 33, end: 73 },    // narrative_structure 説明
  { start: 672, end: 713 },  // hook_type 説明
  { start: 1223, end: 1289 }, // セクションラベル 説明
  { start: 1601, end: 1643 }, // 制作フロー 説明
];

italicRanges.forEach(({ start, end }) => {
  requests.push({
    updateTextStyle: {
      range: {
        startIndex: start,
        endIndex: end,
        tabId: REF_TAB,
      },
      textStyle: {
        italic: true,
      },
      fields: 'italic',
    },
  });
});

console.log(`Applying ${requests.length} style requests...`);

const res = await docs.documents.batchUpdate({
  documentId: DOC_ID,
  requestBody: { requests },
});

console.log('Done! Replies:', res.data.replies?.length);
