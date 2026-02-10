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
    apiKey: process.env.FAL_KEY || '',
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
    },
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },

};

module.exports = config;
