'use strict';

const config = require('../config');
const { readSheet, writeSheet, appendSheet } = require('./client');

const SHEET_ID = config.google.masterSpreadsheetId;
const TAB = config.google.productionTab || 'production';

const HEADERS = [
  'video_id', 'account_id', 'title', 'edit_status', 'character_id',
  'hook_scenario_id', 'body_scenario_id', 'cta_scenario_id',
  'hook_motion_id', 'body_motion_id', 'cta_motion_id', 'voice_id',
  'pipeline_status', 'current_phase',
  'hook_video_url', 'body_video_url', 'cta_video_url', 'final_video_url',
  'drive_folder_id', 'error_message', 'processing_time_sec',
  'created_at', 'updated_at',
  'platform_post_ids',
  'yt_views', 'yt_engagement', 'tt_views', 'tt_engagement',
  'ig_views', 'ig_engagement', 'overall_score', 'analysis_date',
];

const COL_COUNT = HEADERS.length; // 32

function colLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

const LAST_COL = colLetter(COL_COUNT - 1); // "AF"

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] || ''; });
  return obj;
}

function generateVideoId() {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `VID_${ym}_${rand}`;
}

async function getAllRows() {
  const rows = await readSheet(SHEET_ID, `${TAB}!A:${LAST_COL}`);
  if (rows.length < 2) return { headers: HEADERS, rows: [] };
  return {
    headers: rows[0],
    rows: rows.slice(1).map((r) => rowToObj(rows[0], r)),
  };
}

/**
 * Get rows that are ready for pipeline processing.
 * Criteria: edit_status = 'ready' AND (pipeline_status is empty OR 'queued')
 */
async function getReadyRows(limit = 10) {
  const { rows } = await getAllRows();
  return rows
    .filter((r) =>
      r.edit_status === 'ready' &&
      (!r.pipeline_status || r.pipeline_status === 'queued')
    )
    .slice(0, limit);
}

/**
 * Get a single production row by video_id.
 */
async function getProductionRow(videoId) {
  const { rows } = await getAllRows();
  return rows.find((r) => r.video_id === videoId) || null;
}

/**
 * Update specific fields for a production row identified by video_id.
 */
async function updateProductionRow(videoId, fields = {}) {
  const raw = await readSheet(SHEET_ID, `${TAB}!A:${LAST_COL}`);
  if (raw.length < 2) throw new Error(`Video ${videoId} not found`);

  const headers = raw[0];
  const idx = raw.findIndex((r, i) => i > 0 && r[0] === videoId);
  if (idx === -1) throw new Error(`Video ${videoId} not found`);

  const row = raw[idx];

  // Always update updated_at
  const updatedAtCol = headers.indexOf('updated_at');
  if (updatedAtCol !== -1) row[updatedAtCol] = new Date().toISOString();

  for (const [key, val] of Object.entries(fields)) {
    const col = headers.indexOf(key);
    if (col !== -1) row[col] = val;
  }

  // Pad row to full width if needed
  while (row.length < COL_COUNT) row.push('');

  const rowNum = idx + 1;
  await writeSheet(SHEET_ID, `${TAB}!A${rowNum}:${LAST_COL}${rowNum}`, [row]);
}

/**
 * Create a new production row. Returns the generated video_id.
 */
async function createProductionRow(data) {
  const videoId = data.video_id || generateVideoId();
  const now = new Date().toISOString();

  const row = HEADERS.map((h) => {
    if (h === 'video_id') return videoId;
    if (h === 'created_at') return now;
    if (h === 'updated_at') return now;
    return data[h] || '';
  });

  await appendSheet(SHEET_ID, `${TAB}!A:${LAST_COL}`, [row]);
  return videoId;
}

module.exports = {
  HEADERS,
  getReadyRows,
  getProductionRow,
  updateProductionRow,
  createProductionRow,
};
