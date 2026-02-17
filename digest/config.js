'use strict';

const path = require('path');

// Load .env from project root if present
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (_) {
  // dotenv not installed or .env missing — use process.env directly
}

const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    channelName: process.env.DIGEST_CHANNEL_NAME || 'ceed-aiインフルエンサー',
    workspaceDomain: process.env.SLACK_WORKSPACE_DOMAIN || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.DIGEST_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.DIGEST_MAX_TOKENS, 10) || 4096,
  },
  output: {
    baseDir: path.resolve(__dirname, '..', 'digests'),
  },
};

module.exports = config;
