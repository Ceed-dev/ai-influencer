'use strict';

const config = require('../config');
const { readSheet, writeSheet } = require('./client');

const SPREADSHEET_ID = config.x.postingSpreadsheetId;
const TAB = config.x.postingTab;

// Column mapping (A=0 ... I=8)
const COL = {
  posted: 0,       // A: 投稿済み (checkbox TRUE/FALSE)
  date: 1,         // B: 投稿予定日 (2026-02-14)
  timeWindow: 2,   // C: 推奨投稿時間 (7:00-8:00)
  characterName: 3, // D: キャラ名
  account: 4,      // E: アカウント
  body: 5,         // F: 投稿本文
  hashtags: 6,     // G: ハッシュタグ
  cta: 7,          // H: CTA
  postId: 8,       // I: 投稿ID
};

// Character name → character_id → account_id mapping
const CHARACTER_NAME_MAP = {
  '清楚AI先生': { characterId: 'CHR_0001', accountId: 'ACC_0037' },
  '爆速ギャルAI': { characterId: 'CHR_0002', accountId: 'ACC_0038' },
  'AI_Toolテックミューズ': { characterId: 'CHR_0003', accountId: 'ACC_0039' },
  '美女ホスト': { characterId: 'CHR_0004', accountId: 'ACC_0040' },
  '自信MAXセレブ': { characterId: 'CHR_0005', accountId: 'ACC_0041' },
  'スマートK解説': { characterId: 'CHR_0006', accountId: 'ACC_0042' },
  'MBTI実写化': { characterId: 'CHR_0007', accountId: 'ACC_0043' },
  '姉ギャル自己肯定感コーチ': { characterId: 'CHR_0008', accountId: 'ACC_0044' },
  '淡々マッチョ指揮官': { characterId: 'CHR_0009', accountId: 'ACC_0045' },
  '神秘系ヒーラー': { characterId: 'CHR_0010', accountId: 'ACC_0046' },
  '姉貴アンサー': { characterId: 'CHR_0011', accountId: 'ACC_0047' },
  '彼氏感カウンセラー': { characterId: 'CHR_0012', accountId: 'ACC_0048' },
};

/**
 * Parse time window string like "7:00-8:00" → { startHour, startMin, endHour, endMin }
 */
function parseTimeWindow(windowStr) {
  if (!windowStr) return null;
  const match = windowStr.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return {
    startHour: parseInt(match[1], 10),
    startMin: parseInt(match[2], 10),
    endHour: parseInt(match[3], 10),
    endMin: parseInt(match[4], 10),
  };
}

/**
 * Check if `now` is within the time window, respecting timezone.
 * Uses Intl.DateTimeFormat for timezone-aware hour/minute extraction.
 */
function isWithinWindow(windowStr, now, timezone) {
  const window = parseTimeWindow(windowStr);
  if (!window) return true; // no window constraint → always ready

  const tz = timezone || 'Asia/Tokyo';
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hourPart = parts.find((p) => p.type === 'hour');
  const minutePart = parts.find((p) => p.type === 'minute');
  const currentHour = parseInt(hourPart.value, 10);
  const currentMin = parseInt(minutePart.value, 10);

  const currentTotal = currentHour * 60 + currentMin;
  const startTotal = window.startHour * 60 + window.startMin;
  const endTotal = window.endHour * 60 + window.endMin;

  return currentTotal >= startTotal && currentTotal < endTotal;
}

/**
 * Build tweet text from body + hashtags, respecting 280 char limit.
 */
function buildTweetText(body, hashtags) {
  if (!body) return '';
  const text = hashtags ? `${body}\n\n${hashtags}` : body;
  if (text.length > 280) {
    // Truncate body to fit, keeping hashtags
    if (hashtags) {
      const maxBody = 280 - hashtags.length - 3; // \n\n + safety
      if (maxBody > 0) return `${body.slice(0, maxBody)}\n\n${hashtags}`;
    }
    return text.slice(0, 280);
  }
  return text;
}

/**
 * Resolve character name to account ID.
 */
function resolveAccountForCharacter(characterName) {
  const mapping = CHARACTER_NAME_MAP[characterName];
  if (!mapping) return null;
  return mapping.accountId;
}

/**
 * Get all rows that are ready to post:
 * - 投稿済み is FALSE (not yet posted)
 * - 投稿予定日 is today or earlier (backfill support)
 * - 推奨投稿時間 window matches current time
 */
async function getReadyPosts(now) {
  const rows = await readSheet(SPREADSHEET_ID, `${TAB}!A:I`);
  if (rows.length < 2) return [];

  const today = formatDate(now, 'Asia/Tokyo');
  const ready = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const posted = (row[COL.posted] || '').toString().toUpperCase();
    if (posted === 'TRUE') continue;

    const date = row[COL.date] || '';
    if (!date) continue;

    // Post if date is today or in the past (backfill)
    if (date > today) continue;

    const timeWindow = row[COL.timeWindow] || '';
    // Only check time window for today's posts; past posts are always ready
    if (date === today && !isWithinWindow(timeWindow, now, 'Asia/Tokyo')) continue;

    const characterName = row[COL.characterName] || '';
    const accountId = resolveAccountForCharacter(characterName);
    if (!accountId) continue;

    ready.push({
      rowIndex: i + 1, // 1-indexed for Sheets API
      date,
      timeWindow,
      characterName,
      accountId,
      body: row[COL.body] || '',
      hashtags: row[COL.hashtags] || '',
      cta: row[COL.cta] || '',
      postId: row[COL.postId] || '',
    });
  }

  return ready;
}

/**
 * Format Date to YYYY-MM-DD in a specific timezone.
 */
function formatDate(date, timezone) {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(date);
}

/**
 * Mark a row as posted: set checkbox TRUE and write tweet ID/URL.
 */
async function markPosted(rowIndex, tweetId, tweetUrl) {
  await writeSheet(SPREADSHEET_ID, `${TAB}!A${rowIndex}`, [['TRUE']]);
  await writeSheet(SPREADSHEET_ID, `${TAB}!I${rowIndex}`, [[`${tweetId} | ${tweetUrl}`]]);
}

/**
 * Mark a row with an error message in the 投稿ID column.
 */
async function markError(rowIndex, errorMsg) {
  await writeSheet(SPREADSHEET_ID, `${TAB}!I${rowIndex}`, [[`error: ${errorMsg}`]]);
}

module.exports = {
  CHARACTER_NAME_MAP,
  parseTimeWindow,
  isWithinWindow,
  buildTweetText,
  resolveAccountForCharacter,
  getReadyPosts,
  markPosted,
  markError,
};
