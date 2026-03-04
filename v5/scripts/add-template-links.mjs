#!/usr/bin/env node
/**
 * TEMPLATEタブに「用語・補足」タブへのリンクを追加し、
 * 制作フローにプロンプトフィールドも追加する
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
const TPL_TAB = 't.0';
const REF_TAB = 't.k5zj1t5fuak1';
const REF_TAB_URL = `https://docs.google.com/document/d/${DOC_ID}/edit?tab=${REF_TAB}`;

// ── Step 1: insertText (bottom → top to preserve indices) ──────────────────
// 現在の位置（get-template-content.mjs で確認済み）:
// [254-351] hook_type line
// [351-466] narrative_structure line
// [914-980] セクションラベル line (使用可能なラベル)
// [1167-1190] concat ffmpeg line
// [1191-1205] ステップ1 HEADING
// [1213-1257] パラメータ line
// [1257-1265] 期待する出力 line

const REF_LINK_TEXT = '    ↗ 詳細・例は「用語・補足」タブを参照\n';
const FLOW_REF_TEXT = '    ↗ 記入例（実際のプロンプト・パラメータ含む）は「用語・補足」タブを参照\n';
const PROMPT_TEXT = 'プロンプト:\nネガティブプロンプト:\n';

const insertRequests = [
  // 5. プロンプトフィールドをパラメータの後に追加 (at 1257, before 期待する出力)
  {
    insertText: {
      location: { index: 1257, tabId: TPL_TAB },
      text: PROMPT_TEXT,
    },
  },
  // 4. 制作フロー記載例への参照リンク (at 1191, before ステップ1)
  {
    insertText: {
      location: { index: 1191, tabId: TPL_TAB },
      text: FLOW_REF_TEXT,
    },
  },
  // 3. セクションラベル参照リンク (at 980, after 使用可能なラベル行)
  {
    insertText: {
      location: { index: 980, tabId: TPL_TAB },
      text: REF_LINK_TEXT,
    },
  },
  // 2. narrative_structure 参照リンク (at 466, after narrative_structure行)
  {
    insertText: {
      location: { index: 466, tabId: TPL_TAB },
      text: REF_LINK_TEXT,
    },
  },
  // 1. hook_type 参照リンク (at 351, after hook_type行)
  {
    insertText: {
      location: { index: 351, tabId: TPL_TAB },
      text: REF_LINK_TEXT,
    },
  },
];

console.log('Step 1: Inserting text...');
await docs.documents.batchUpdate({
  documentId: DOC_ID,
  requestBody: { requests: insertRequests },
});
console.log('  Done.');

// ── Step 2: 挿入後の正確な位置を取得 ────────────────────────────────────────
console.log('Step 2: Reading document to find new positions...');
const res = await docs.documents.get({
  documentId: DOC_ID,
  includeTabsContent: true,
});

const tabs = res.data.tabs || [];
const tplTab = tabs.find(t => t.tabProperties?.tabId === TPL_TAB);
const elements = tplTab?.documentTab?.body?.content || [];

// 挿入したテキストの位置を検索
function findTextRange(searchText) {
  const clean = searchText.replace(/\n$/, '');
  for (const el of elements) {
    if (!el.paragraph) continue;
    const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
    if (text.includes(clean)) {
      const si = el.startIndex ?? 0;
      // 実際のテキスト開始位置（前の空白を考慮）
      return { start: si, end: el.endIndex ?? si };
    }
  }
  return null;
}

const hookRef = findTextRange(REF_LINK_TEXT);
const narrativeRef = findTextRange(REF_LINK_TEXT); // 同じテキストが複数ある
const flowRef = findTextRange(FLOW_REF_TEXT);
const promptRange = findTextRange('プロンプト:');
const negPromptRange = findTextRange('ネガティブプロンプト:');

// 全て見つける（同じテキストが複数の場合）
const refRanges = [];
for (const el of elements) {
  if (!el.paragraph) continue;
  const text = el.paragraph.elements?.map(e => e.textRun?.content || '').join('') || '';
  if (text.includes('↗ 詳細・例は')) {
    refRanges.push({ start: el.startIndex ?? 0, end: el.endIndex ?? 0 });
  }
}

console.log(`  Found ${refRanges.length} reference link lines`);
refRanges.forEach((r, i) => console.log(`    [${i}] ${r.start}-${r.end}`));

if (flowRef) console.log(`  Flow ref: ${flowRef.start}-${flowRef.end}`);
if (promptRange) console.log(`  Prompt: ${promptRange.start}-${promptRange.end}`);
if (negPromptRange) console.log(`  NegPrompt: ${negPromptRange.start}-${negPromptRange.end}`);

// ── Step 3: スタイル適用 ──────────────────────────────────────────────────
const styleRequests = [];

// 参照リンク行（↗ で始まる行）をイタリック・青・リンクに
const blueColor = { red: 0.07, green: 0.43, blue: 0.67 };

for (const { start, end } of refRanges) {
  styleRequests.push({
    updateTextStyle: {
      range: { startIndex: start, endIndex: end - 1, tabId: TPL_TAB }, // -1 to exclude \n
      textStyle: {
        italic: true,
        foregroundColor: { color: { rgbColor: blueColor } },
        link: { url: REF_TAB_URL },
      },
      fields: 'italic,foregroundColor,link',
    },
  });
}

if (flowRef) {
  styleRequests.push({
    updateTextStyle: {
      range: { startIndex: flowRef.start, endIndex: flowRef.end - 1, tabId: TPL_TAB },
      textStyle: {
        italic: true,
        foregroundColor: { color: { rgbColor: blueColor } },
        link: { url: REF_TAB_URL },
      },
      fields: 'italic,foregroundColor,link',
    },
  });
}

if (styleRequests.length > 0) {
  console.log(`Step 3: Applying ${styleRequests.length} style requests...`);
  await docs.documents.batchUpdate({
    documentId: DOC_ID,
    requestBody: { requests: styleRequests },
  });
  console.log('  Done.');
} else {
  console.log('Step 3: No style requests needed.');
}

console.log('\nAll done!');
console.log(`Document: https://docs.google.com/document/d/${DOC_ID}/edit`);
