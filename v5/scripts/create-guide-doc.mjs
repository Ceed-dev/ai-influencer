#!/usr/bin/env node
/**
 * 作業ガイドドキュメントを制作ノウハウ (Playbooks) フォルダに作成する
 */
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({
  keyFile: SA_KEY_PATH,
  scopes: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
  ],
});
const docs = google.docs({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });

const PARENT_FOLDER_ID = '1eagVIQrf-ZGI46tNWA3uhWtn-3vsmQK9'; // 制作ノウハウ (Playbooks)

// ── ドキュメント作成（Drive API経由でフォルダ直接指定）────────────────────
const createRes = await drive.files.create({
  supportsAllDrives: true,
  requestBody: {
    name: '作業ガイド — Playbookの作り方',
    mimeType: 'application/vnd.google-apps.document',
    parents: [PARENT_FOLDER_ID],
  },
  fields: 'id',
});
const DOC_ID = createRes.data.id;
console.log('Created doc:', DOC_ID);

// ── コンテンツ定義 ──────────────────────────────────────────────────────
// テキストブロックをまとめて定義（後でインデックス計算）
const content = [
  { type: 'TITLE',    text: '作業ガイド — Playbookの作り方\n' },
  { type: 'HEADING_2', text: 'このドキュメントの目的\n' },
  { type: 'NORMAL',   text: 'チームメイトが制作ノウハウをPlaybookとしてまとめ、「playbookファイル」フォルダへ保存するまでの一連の流れを説明する。\n' },
  { type: 'HEADING_2', text: '前提を読む — まずREADMEを確認\n' },
  { type: 'NORMAL',   text: '同じフォルダにある「README」ドキュメントに、このフォルダの目的・Playbookとは何か・書き方の基準が書かれている。作業を始める前に必ず読むこと。\n' },
  { type: 'NORMAL',   text: 'ポイント: Playbookは「このファイルを読めば誰でも（人間でもAIでも）同じ品質で再現できる」レベルで書く。曖昧な表現は不可。\n' },
  { type: 'HEADING_2', text: '作業の流れ（3ステップ）\n' },
  { type: 'HEADING_3', text: 'Step 1 — Claudeと一緒に試行錯誤する\n' },
  { type: 'NORMAL',   text: '担当するコンテンツ型（例: short_video_ai_beauty）を決め、実際にツールを動かしながらClaudeと会話する。\n' },
  { type: 'NORMAL',   text: '試すべきこと:\n' },
  { type: 'NORMAL',   text: '    ・どのツールをどの順番で使うか（video_gen → tts → lipsync → concat）\n' },
  { type: 'NORMAL',   text: '    ・プロンプトやパラメータを変えたときの出力の変化\n' },
  { type: 'NORMAL',   text: '    ・OKとNGの判断基準（AI感が出る条件、口パクがズレる条件など）\n' },
  { type: 'NORMAL',   text: '    ・1本あたりにかかる時間・コスト\n' },
  { type: 'HEADING_3', text: 'Step 2 — ClaudeにMDファイルとしてまとめてもらう\n' },
  { type: 'NORMAL',   text: '試行錯誤が終わったら、Claudeに以下のように伝える:\n' },
  { type: 'NORMAL',   text: '    「今までの試行錯誤の内容を、TEMPLATEドキュメントの情報の種類と粒度でMDファイルとしてまとめて。」\n' },
  { type: 'NORMAL',   text: 'TEMPLATEには9つのセクションがある（メタデータ・コンテンツ概要・参考リンク・セクション構成・制作フロー・ツールの特性・フックの型・クオリティ基準・コスト目安・学んだこと）。全セクションを埋めた状態でMDファイルを出力してもらうこと。\n' },
  { type: 'NORMAL',   text: '制作フローのステップには、実際に使ったプロンプト文章・パラメータ数値まで含める。Claudeが生成した内容をコピーして再現できるレベルが基準。\n' },
  { type: 'HEADING_3', text: 'Step 3 — 「playbookファイル」フォルダに保存する\n' },
  { type: 'NORMAL',   text: 'Claudeが出力したMDファイルを、このフォルダ内の「playbookファイル」フォルダに保存する。\n' },
  { type: 'NORMAL',   text: 'ファイル名の形式: {content_format}_{niche}.md\n' },
  { type: 'NORMAL',   text: '    例: short_video_ai_beauty.md\n' },
  { type: 'NORMAL',   text: '    例: short_video_lifehack.md\n' },
  { type: 'NORMAL',   text: '    例: text_post_tech.md\n' },
  { type: 'HEADING_2', text: '作成目標（参考値）\n' },
  { type: 'NORMAL',   text: '以下はv5初回稼働前に用意しておきたい参考目標。品質を優先し、薄い内容で数を増やさない。\n' },
  { type: 'NORMAL',   text: '    目標ファイル数:  10ファイル以上\n' },
  { type: 'NORMAL',   text: '    期限:           2026-03-31（v5初回稼働前）\n' },
  { type: 'NORMAL',   text: '    優先すべき型（目安）:\n' },
  { type: 'NORMAL',   text: '        1. short_video_ai_beauty   — 最重要・最初に完成させる\n' },
  { type: 'NORMAL',   text: '        2. short_video_lifehack    — 汎用性が高い\n' },
  { type: 'NORMAL',   text: '        3. short_video_fitness     — ビューティーと近い制作フロー\n' },
  { type: 'NORMAL',   text: '        4. text_post_tech          — 動画系と異なる制作フロー\n' },
  { type: 'NORMAL',   text: '        5. image_post_lifestyle    — 静止画系\n' },
  { type: 'NORMAL',   text: '        6〜10. ニッチ・プラットフォームを変えて追加\n' },
  { type: 'HEADING_2', text: 'クオリティ基準（提出前チェック）\n' },
  { type: 'NORMAL',   text: '以下を全て満たしていれば提出OK:\n' },
  { type: 'NORMAL',   text: '    ☐  TEMPLATEの全セクション（1〜9）が埋まっている\n' },
  { type: 'NORMAL',   text: '    ☐  制作フローの各ステップに実際のプロンプト文と数値パラメータが書かれている\n' },
  { type: 'NORMAL',   text: '    ☐  クオリティ基準に合格・不合格の具体的な判断基準が書かれている\n' },
  { type: 'NORMAL',   text: '    ☐  ファイル名が {content_format}_{niche}.md の形式になっている\n' },
  { type: 'NORMAL',   text: '    ☐  「playbookファイル」フォルダに保存されている\n' },
  { type: 'HEADING_2', text: 'フォルダ構成（参考）\n' },
  { type: 'NORMAL',   text: '    制作ノウハウ (Playbooks)/\n' },
  { type: 'NORMAL',   text: '    ├── README                  ← このフォルダの目的・書き方の基準\n' },
  { type: 'NORMAL',   text: '    ├── 作業ガイド              ← このドキュメント\n' },
  { type: 'NORMAL',   text: '    ├── TEMPLATE               ← Playbookのテンプレート（Claudeへ渡す）\n' },
  { type: 'NORMAL',   text: '    └── playbookファイル/       ← 完成したMDファイルを保存\n' },
  { type: 'NORMAL',   text: '            ├── short_video_ai_beauty.md\n' },
  { type: 'NORMAL',   text: '            ├── short_video_lifehack.md\n' },
  { type: 'NORMAL',   text: '            └── ...\n' },
];

// ── テキスト一括挿入 ─────────────────────────────────────────────────────
// まずテキストをまとめて挿入（末尾から先頭方向へ逆順で）
let insertRequests = [];
let pos = 1;
const ranges = []; // {start, end, type} を記録

for (const block of content) {
  ranges.push({ start: pos, end: pos + block.text.length, type: block.type });
  pos += block.text.length;
}

// insertText は先頭から順に1つのリクエストで全文挿入
const fullText = content.map(b => b.text).join('');
insertRequests.push({
  insertText: {
    location: { index: 1 },
    text: fullText,
  },
});

await docs.documents.batchUpdate({
  documentId: DOC_ID,
  requestBody: { requests: insertRequests },
});
console.log('Text inserted.');

// ── スタイル適用 ─────────────────────────────────────────────────────────
const styleRequests = [];
const blue = { red: 0.07, green: 0.43, blue: 0.67 };

// 「今までの試行錯誤〜」引用行をハイライト
const quoteText = '    「今までの試行錯誤の内容を、TEMPLATEドキュメントの情報の種類と粒度でMDファイルとしてまとめて。」\n';

for (const { start, end, type } of ranges) {
  if (type === 'TITLE') {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType: 'TITLE' },
        fields: 'namedStyleType',
      },
    });
  } else if (type === 'HEADING_2') {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType: 'HEADING_2' },
        fields: 'namedStyleType',
      },
    });
  } else if (type === 'HEADING_3') {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: start, endIndex: end },
        paragraphStyle: { namedStyleType: 'HEADING_3' },
        fields: 'namedStyleType',
      },
    });
  }
}

// 引用行（Claudeへの指示文）をボールド
const quoteStart = fullText.indexOf(quoteText) + 1; // +1 for doc offset
if (quoteStart > 0) {
  styleRequests.push({
    updateTextStyle: {
      range: { startIndex: quoteStart, endIndex: quoteStart + quoteText.length - 1 },
      textStyle: { bold: true },
      fields: 'bold',
    },
  });
}

// 目標数・期限行をボールド
const highlightTexts = [
  '    目標ファイル数:  10ファイル以上\n',
  '    期限:           2026-03-31（v5初回稼働前）\n',
];
for (const ht of highlightTexts) {
  const idx = fullText.indexOf(ht) + 1;
  if (idx > 0) {
    styleRequests.push({
      updateTextStyle: {
        range: { startIndex: idx, endIndex: idx + ht.length - 1 },
        textStyle: { bold: true },
        fields: 'bold',
      },
    });
  }
}

await docs.documents.batchUpdate({
  documentId: DOC_ID,
  requestBody: { requests: styleRequests },
});
console.log('Styles applied.');
console.log('\nDone!');
console.log(`URL: https://docs.google.com/document/d/${DOC_ID}/edit`);
