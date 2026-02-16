'use strict';

const { TwitterApi } = require('twitter-api-v2');
const {
  getAppCredentials,
  getAccountCredentials,
} = require('../x-credential-manager');

/**
 * Create an authenticated TwitterApi client for a specific account.
 */
function getClientForAccount(accountId) {
  const app = getAppCredentials();
  if (!app.apiKey || !app.apiKeySecret) {
    throw new Error('X API app credentials not configured (X_API_KEY / X_API_KEY_SECRET)');
  }

  const account = getAccountCredentials(accountId);
  if (!account || !account.accessToken || !account.accessTokenSecret) {
    throw new Error(`No OAuth credentials for account ${accountId}. Run: npm run x:setup ${accountId}`);
  }

  return new TwitterApi({
    appKey: app.apiKey,
    appSecret: app.apiKeySecret,
    accessToken: account.accessToken,
    accessSecret: account.accessTokenSecret,
  });
}

/**
 * Post a text tweet from a specific account.
 * @param {string} accountId - Account ID (e.g. ACC_0037)
 * @param {string} text - Tweet text (max 280 chars)
 * @returns {{ tweetId: string, url: string }}
 */
async function postTweet(accountId, text) {
  if (!text || text.length === 0) throw new Error('Tweet text cannot be empty');
  if (text.length > 280) throw new Error(`Tweet text exceeds 280 chars (${text.length})`);

  const client = getClientForAccount(accountId);
  const result = await client.v2.tweet(text);

  const tweetId = result.data.id;
  const account = getAccountCredentials(accountId);
  const handle = account && account.handle ? account.handle.replace('@', '') : 'unknown';

  return {
    tweetId,
    url: `https://x.com/${handle}/status/${tweetId}`,
  };
}

/**
 * poster.js compatibility — video upload not yet implemented for X.
 */
async function upload(/* { videoPath, title, description, tags } */) {
  throw new Error('X video posting not yet implemented. Use postTweet() for text posts.');
}

module.exports = { postTweet, getClientForAccount, upload };
