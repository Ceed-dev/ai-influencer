'use strict';

const path = require('path');

// Load .env from project root if present
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (_) {
  // dotenv not installed or .env missing — use process.env directly
}

const ROOT_DIR = path.resolve(__dirname, '..');

const config = {
  fal: {
    apiKey: process.env.FAL_KEY || process.env.FAL_AI_KEY || '',
    defaultTimeout: parseInt(process.env.FAL_TIMEOUT_MS, 10) || 600000, // 10 min
  },

  google: {
    tokenPath: process.env.GOOGLE_TOKEN_PATH || path.join(ROOT_DIR, '.gsheets_token.json'),
    credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || path.join(ROOT_DIR, 'video_analytics_hub_claude_code_oauth.json'),
    masterSpreadsheetId: process.env.MASTER_SPREADSHEET_ID || '1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg',
    rootDriveFolderId: process.env.ROOT_DRIVE_FOLDER_ID || '1KRQuZ4W7u5CXRamjvN4xmavfu-7TPb0X',
    inventoryIds: {
      scenarios: '13Meu7cniKUr1JiEyKla0qhfiV9Az1IFuzIedzDxjpiY',
      motions: '1ycnmfpL8OgAI7WvlPTr3Z9p1H8UTmCNMV7ahunMlsEw',
      characters: '1-m4f5LgNmArtpECZqqxFL-6P4eabBmPkOYX2VkFHCHA',
      audio: '1Dw_atybwdGpi1Q0jh6CsuUSwzqVw1ZXB6jQT_-VDVak',
      accounts: process.env.ACCOUNTS_INVENTORY_ID || '1CmT6C3qCW3md6lJ9Rvc2WNQkWa5zcvlq6Zp_enJHoUE',
    },
    productionTab: 'production',
  },

  fishAudio: {
    apiKey: process.env.FISH_AUDIO_API_KEY || '',
    baseUrl: 'https://api.fish.audio/v1',
    model: 's1',
    defaultFormat: 'mp3',
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',  // 後方互換
    credentialsPath: process.env.YT_CREDENTIALS_PATH || path.join(ROOT_DIR, '.yt-credentials.json'),
    postingSpreadsheetId: process.env.YT_POSTING_SPREADSHEET_ID || '1n332Q6LjAl9I4c6y3OwqFiontuum3LbVu9mM1gjxN-0',
    postingTab: 'YT投稿タスク',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },

  x: {
    credentialsPath: process.env.X_CREDENTIALS_PATH || path.join(ROOT_DIR, '.x-credentials.json'),
    postingSpreadsheetId: process.env.X_POSTING_SPREADSHEET_ID || '1pWqXHckZWoTuTQ1r1hqnmr57ioo5aQ8ZTSRntzMHJ08',
    postingTab: '投稿タスク',
  },

  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
    credentialsPath: process.env.TIKTOK_CREDENTIALS_PATH || path.join(ROOT_DIR, '.tiktok-credentials.json'),
    postingSpreadsheetId: process.env.TIKTOK_POSTING_SPREADSHEET_ID || '1ZSrjY0Ty5yDMoyNYNAO2HHWl121R8Po3qI4o9DVnByQ',
    postingTab: 'TikTok投稿タスク',
    baseUrl: 'https://open.tiktokapis.com',
  },

  instagram: {
    appId: process.env.IG_APP_ID || '',
    appSecret: process.env.IG_APP_SECRET || '',
    credentialsPath: process.env.IG_CREDENTIALS_PATH || path.join(ROOT_DIR, '.ig-credentials.json'),
    postingSpreadsheetId: process.env.IG_POSTING_SPREADSHEET_ID || '1cgf2viMY_cjxu4qrL2lwMmR_kBRQUGy8yQxsQYG3xFs',
    postingTab: 'IG投稿タスク',
    graphApiVersion: 'v22.0',
  },

};

module.exports = config;
