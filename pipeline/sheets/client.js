'use strict';

const fs = require('fs');
const { google } = require('googleapis');
const config = require('../config');

let _authClient = null;

/**
 * Build an OAuth2 client from the same token files used by scripts/gsheet.py.
 * Auto-refreshes expired tokens and persists the new token to disk.
 */
function getAuthClient() {
  if (_authClient) return _authClient;

  const tokenData = JSON.parse(fs.readFileSync(config.google.tokenPath, 'utf8'));
  const credData = JSON.parse(fs.readFileSync(config.google.credentialsPath, 'utf8')).installed;

  const oauth2 = new google.auth.OAuth2(
    credData.client_id,
    credData.client_secret,
    credData.redirect_uris && credData.redirect_uris[0]
  );

  oauth2.setCredentials({
    access_token: tokenData.token,
    refresh_token: tokenData.refresh_token,
    token_type: 'Bearer',
    scope: (tokenData.scopes || []).join(' '),
  });

  // Persist refreshed tokens
  oauth2.on('tokens', (tokens) => {
    const updated = { ...tokenData };
    if (tokens.access_token) updated.token = tokens.access_token;
    if (tokens.refresh_token) updated.refresh_token = tokens.refresh_token;
    if (tokens.expiry_date) updated.expiry = new Date(tokens.expiry_date).toISOString();
    fs.writeFileSync(config.google.tokenPath, JSON.stringify(updated), 'utf8');
  });

  _authClient = oauth2;
  return oauth2;
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuthClient() });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuthClient() });
}

async function readSheet(spreadsheetId, range) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

async function writeSheet(spreadsheetId, range, values) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  return res.data;
}

async function appendSheet(spreadsheetId, range, values) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
  return res.data;
}

async function listDriveFiles(folderId) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink)',
    pageSize: 100,
    orderBy: 'name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files || [];
}

async function uploadToDrive(folderId, fileName, mimeType, buffer) {
  const drive = getDrive();
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });
  return res.data;
}

module.exports = {
  getAuthClient,
  getSheets,
  getDrive,
  readSheet,
  writeSheet,
  appendSheet,
  listDriveFiles,
  uploadToDrive,
};
