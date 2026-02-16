'use strict';

const config = require('../config');
const { readSheet, writeSheet } = require('./client');
const { parseTimeWindow, isWithinWindow } = require('./posting-task-manager');

const SPREADSHEET_ID = config.tiktok.postingSpreadsheetId;
const TAB = config.tiktok.postingTab;

// Column mapping (A=0 ... L=11)
const COL = {
  posted: 0,          // A: 投稿済み (checkbox TRUE/FALSE)
  date: 1,            // B: 投稿予定日 (2026-02-17)
  timeWindow: 2,      // C: 推奨投稿時間 (18:00-19:00)
  characterName: 3,   // D: キャラ名
  account: 4,         // E: アカウント (ACC_0001)
  videoId: 5,         // F: video_id (VID_202602_0001)
  driveFileId: 6,     // G: drive_file_id
  title: 7,           // H: タイトル
  description: 8,     // I: 説明文
  hashtags: 9,        // J: ハッシュタグ
  privacyLevel: 10,   // K: 公開設定 (SELF_ONLY / PUBLIC_TO_EVERYONE)
  result: 11,         // L: 投稿結果
};

// Character name → TikTok account mapping
const TIKTOK_CHARACTER_NAME_MAP = {
  '清楚AI先生': { characterId: 'CHR_0001', accountId: 'ACC_0001' },
  '爆速ギャルAI': { characterId: 'CHR_0002', accountId: 'ACC_0005' },
  'AI_Toolテックミューズ': { characterId: 'CHR_0003', accountId: 'ACC_0008' },
  '美女ホスト': { characterId: 'CHR_0004', accountId: 'ACC_0011' },
  '自信MAXセレブ': { characterId: 'CHR_0005', accountId: 'ACC_0014' },
  'スマートK解説': { characterId: 'CHR_0006', accountId: 'ACC_0017' },
  'MBTI実写化': { characterId: 'CHR_0007', accountId: 'ACC_0020' },
  '姉ギャル自己肯定感コーチ': { characterId: 'CHR_0008', accountId: 'ACC_0023' },
  '淡々マッチョ指揮官': { characterId: 'CHR_0009', accountId: 'ACC_0026' },
  '神秘系ヒーラー': { characterId: 'CHR_0010', accountId: 'ACC_0029' },
  '姉貴アンサー': { characterId: 'CHR_0011', accountId: 'ACC_0032' },
  '彼氏感カウンセラー': { characterId: 'CHR_0012', accountId: 'ACC_0035' },
};

/**
 * Resolve character name to TikTok account ID.
 */
function resolveAccountForCharacter(characterName) {
  const mapping = TIKTOK_CHARACTER_NAME_MAP[characterName];
  if (!mapping) return null;
  return mapping.accountId;
}

/**
 * Format Date to YYYY-MM-DD in a specific timezone.
 */
function formatDate(date, timezone) {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(date);
}

/**
 * Get all rows that are ready to post:
 * - 投稿済み is FALSE (not yet posted)
 * - 投稿予定日 is today or earlier (backfill support)
 * - 推奨投稿時間 window matches current time
 * - drive_file_id is present
 */
async function getReadyPosts(now) {
  const rows = await readSheet(SPREADSHEET_ID, `${TAB}!A:L`);
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

    const driveFileId = row[COL.driveFileId] || '';
    if (!driveFileId) continue;

    // Resolve account: use explicit account column, or fallback to character name map
    const explicitAccount = row[COL.account] || '';
    const characterName = row[COL.characterName] || '';
    const accountId = explicitAccount || resolveAccountForCharacter(characterName);
    if (!accountId) continue;

    ready.push({
      rowIndex: i + 1, // 1-indexed for Sheets API
      date,
      timeWindow,
      characterName,
      accountId,
      videoId: row[COL.videoId] || '',
      driveFileId,
      title: row[COL.title] || '',
      description: row[COL.description] || '',
      hashtags: row[COL.hashtags] || '',
      privacyLevel: row[COL.privacyLevel] || 'SELF_ONLY',
    });
  }

  return ready;
}

/**
 * Mark a row as posted: set checkbox TRUE and write publish_id + status.
 */
async function markPosted(rowIndex, publishId, status) {
  await writeSheet(SPREADSHEET_ID, `${TAB}!A${rowIndex}`, [['TRUE']]);
  await writeSheet(SPREADSHEET_ID, `${TAB}!L${rowIndex}`, [[`${publishId} | ${status}`]]);
}

/**
 * Mark a row with an error message in the 投稿結果 column.
 */
async function markError(rowIndex, errorMsg) {
  await writeSheet(SPREADSHEET_ID, `${TAB}!L${rowIndex}`, [[`error: ${errorMsg}`]]);
}

module.exports = {
  TIKTOK_CHARACTER_NAME_MAP,
  resolveAccountForCharacter,
  getReadyPosts,
  markPosted,
  markError,
};
