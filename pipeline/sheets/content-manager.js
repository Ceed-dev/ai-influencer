'use strict';

const config = require('../config');
const { readSheet, appendSheet, writeSheet } = require('./client');

const SHEET_ID = config.google.masterSpreadsheetId;
const TAB = 'content_pipeline';

const HEADERS = [
  'content_id', 'account_id', 'status', 'character_folder_id', 'section_count',
  'hook_video_url', 'body_video_url', 'cta_video_url', 'final_video_url',
  'drive_folder_id', 'platform_post_id', 'views_48h', 'error_message',
  'created_at', 'updated_at',
];

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] || ''; });
  return obj;
}

function generateContentId() {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `CNT_${ym}_${rand}`;
}

async function getAllContent() {
  const rows = await readSheet(SHEET_ID, `${TAB}!A:O`);
  if (rows.length < 2) return { headers: HEADERS, rows: [] };
  return { headers: rows[0], rows: rows.slice(1).map((r) => rowToObj(rows[0], r)) };
}

async function createContent(data) {
  const contentId = generateContentId();
  const now = new Date().toISOString();

  const row = HEADERS.map((h) => {
    if (h === 'content_id') return contentId;
    if (h === 'status') return data.status || 'queued';
    if (h === 'created_at') return now;
    if (h === 'updated_at') return now;
    return data[h] || '';
  });

  await appendSheet(SHEET_ID, `${TAB}!A:O`, [row]);
  return contentId;
}

async function getContent(contentId) {
  const { rows } = await getAllContent();
  return rows.find((r) => r.content_id === contentId) || null;
}

async function updateContentStatus(contentId, status, extraFields = {}) {
  const raw = await readSheet(SHEET_ID, `${TAB}!A:O`);
  if (raw.length < 2) throw new Error(`Content ${contentId} not found`);

  const headers = raw[0];
  const idx = raw.findIndex((r, i) => i > 0 && r[0] === contentId);
  if (idx === -1) throw new Error(`Content ${contentId} not found`);

  const row = raw[idx];
  const statusCol = headers.indexOf('status');
  if (statusCol !== -1) row[statusCol] = status;

  const updatedCol = headers.indexOf('updated_at');
  if (updatedCol !== -1) row[updatedCol] = new Date().toISOString();

  for (const [key, val] of Object.entries(extraFields)) {
    const col = headers.indexOf(key);
    if (col !== -1) row[col] = val;
  }

  const rowNum = idx + 1;
  await writeSheet(SHEET_ID, `${TAB}!A${rowNum}:O${rowNum}`, [row]);
}

async function getContentByStatus(status) {
  const { rows } = await getAllContent();
  return rows.filter((r) => r.status === status);
}

async function getContentForAccount(accountId) {
  const { rows } = await getAllContent();
  return rows.filter((r) => r.account_id === accountId);
}

module.exports = {
  createContent,
  getContent,
  updateContentStatus,
  getContentByStatus,
  getContentForAccount,
};
