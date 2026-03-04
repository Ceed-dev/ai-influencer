#!/usr/bin/env node
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SA_KEY_PATH = '/home/pochi/workspaces/work/ai-influencer/v5/credentials/service-account.json';
const auth = new GoogleAuth({ keyFile: SA_KEY_PATH, scopes: ['https://www.googleapis.com/auth/drive'] });
const drive = google.drive({ version: 'v3', auth });

// 制作ノウハウ (Playbooks) フォルダ
const PARENT_FOLDER_ID = '1eagVIQrf-ZGI46tNWA3uhWtn-3vsmQK9';

const res = await drive.files.create({
  supportsAllDrives: true,
  requestBody: {
    name: 'playbookファイル',
    mimeType: 'application/vnd.google-apps.folder',
    parents: [PARENT_FOLDER_ID],
  },
  fields: 'id, name, webViewLink',
});

console.log('Created folder:');
console.log('  Name:', res.data.name);
console.log('  ID:  ', res.data.id);
console.log('  URL: ', res.data.webViewLink);
