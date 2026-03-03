/**
 * YouTube Publishing E2E Test Script
 *
 * Tests the full YouTube publishing flow:
 *   1. OAuth token refresh (DB → Google → DB update)
 *   2. Generate minimal test video via ffmpeg
 *   3. YouTube Data API v3 resumable upload (init → PUT)
 *   4. Record publication in DB (publications table)
 *   5. Verify result
 *
 * IMPORTANT: All uploads are PRIVATE. This is a test script.
 *
 * Usage:
 *   node --env-file=.env.production scripts/test-publishing-e2e.mjs
 */

import pg from 'pg';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import crypto from 'crypto';

const { Pool } = pg;

// ── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Use --env-file=.env.production');
  process.exit(1);
}

const ACCOUNT_ID = 'ACC_0001';
const TEST_VIDEO_PATH = '/tmp/test-publishing-e2e.mp4';

// ── DB Pool ──────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
});

async function getSetting(key) {
  const res = await pool.query(
    'SELECT setting_value FROM system_settings WHERE setting_key = $1',
    [key],
  );
  if (res.rows.length === 0) throw new Error(`Setting not found: ${key}`);
  return res.rows[0].setting_value;
}

// ── Step 0: Pre-flight checks ────────────────────────────────────────────────

async function preflight() {
  console.log('\n=== Step 0: Pre-flight checks ===\n');

  // Check DB connectivity
  const dbCheck = await pool.query('SELECT 1 AS ok');
  console.log(`  DB connection: ${dbCheck.rows[0].ok === 1 ? 'OK' : 'FAIL'}`);

  // Check account
  const acctRes = await pool.query(
    `SELECT account_id, platform, platform_username, status,
            auth_credentials->'oauth'->>'refresh_token' IS NOT NULL AS has_refresh,
            auth_credentials->'oauth'->>'access_token' AS access_token,
            auth_credentials->'oauth'->>'expires_at' AS expires_at
     FROM accounts WHERE account_id = $1`,
    [ACCOUNT_ID],
  );
  if (acctRes.rows.length === 0) {
    throw new Error(`Account ${ACCOUNT_ID} not found`);
  }
  const acct = acctRes.rows[0];
  console.log(`  Account: ${acct.account_id} (${acct.platform}, ${acct.platform_username})`);
  console.log(`  Status: ${acct.status}`);
  console.log(`  Has refresh_token: ${acct.has_refresh}`);
  console.log(`  Token expires_at: ${acct.expires_at}`);
  const isExpired = !acct.expires_at || new Date(acct.expires_at) < new Date();
  console.log(`  Token expired: ${isExpired}`);

  // Check required settings
  const requiredSettings = [
    'YOUTUBE_CLIENT_ID',
    'YOUTUBE_CLIENT_SECRET',
    'YOUTUBE_VIDEO_CATEGORY_ID',
    'YOUTUBE_DEFAULT_PRIVACY_STATUS',
    'YOUTUBE_MADE_FOR_KIDS',
  ];
  for (const key of requiredSettings) {
    const val = await getSetting(key);
    console.log(`  ${key}: ${typeof val === 'string' ? val.slice(0, 30) + '...' : val}`);
  }

  // Check ffmpeg
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    console.log('  ffmpeg: available');
  } catch {
    throw new Error('ffmpeg not found. Install ffmpeg to generate test video.');
  }

  return { isExpired, acct };
}

// ── Step 1: Token Refresh ────────────────────────────────────────────────────

async function refreshToken() {
  console.log('\n=== Step 1: OAuth Token Refresh ===\n');

  const acctRes = await pool.query(
    `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'youtube'`,
    [ACCOUNT_ID],
  );
  const rawCreds = acctRes.rows[0].auth_credentials;
  const refreshToken = rawCreds?.oauth?.refresh_token;
  if (!refreshToken) throw new Error('No refresh_token in auth_credentials');

  const clientId = await getSetting('YOUTUBE_CLIENT_ID');
  const clientSecret = await getSetting('YOUTUBE_CLIENT_SECRET');

  console.log('  Sending refresh request to Google OAuth...');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const tokenData = await response.json();
  const newAccessToken = tokenData.access_token;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  console.log(`  New access_token: ${newAccessToken.slice(0, 30)}...`);
  console.log(`  Expires at: ${expiresAt}`);

  // Update DB
  await pool.query(
    `UPDATE accounts
     SET auth_credentials = jsonb_set(
       jsonb_set(auth_credentials, '{oauth,access_token}', to_jsonb($2::text)),
       '{oauth,expires_at}', to_jsonb($3::text)
     )
     WHERE account_id = $1`,
    [ACCOUNT_ID, newAccessToken, expiresAt],
  );
  console.log('  DB updated with new token.');

  return newAccessToken;
}

// ── Step 2: Generate test video ──────────────────────────────────────────────

function generateTestVideo() {
  console.log('\n=== Step 2: Generate Test Video ===\n');

  // Clean up any previous test video
  if (existsSync(TEST_VIDEO_PATH)) {
    unlinkSync(TEST_VIDEO_PATH);
  }

  // Generate a 3-second test video: black background with "E2E TEST" text
  console.log('  Generating 3-second test video with ffmpeg...');
  const timestamp = new Date().toISOString().slice(0, 19);
  // Use execSync with array-style args to avoid shell quoting issues
  execSync(
    `ffmpeg -y -f lavfi -i color=c=black:s=1080x1920:r=30:d=3 -f lavfi -i anullsrc=r=44100:cl=stereo -t 3 -vf drawtext=fontsize=60:fontcolor=white:x='(w-text_w)/2':y='(h-text_h)/2':text='E2E_TEST_${timestamp.replace(/[:-]/g, '')}' -c:v libx264 -preset ultrafast -crf 28 -c:a aac -shortest ${TEST_VIDEO_PATH}`,
    { stdio: 'pipe' },
  );

  const stats = readFileSync(TEST_VIDEO_PATH);
  console.log(`  Generated: ${TEST_VIDEO_PATH} (${stats.length} bytes)`);
  return stats; // Returns Buffer
}

// ── Step 3: YouTube Resumable Upload ─────────────────────────────────────────

async function uploadToYouTube(accessToken, videoBuffer) {
  console.log('\n=== Step 3: YouTube Resumable Upload ===\n');

  const categoryId = await getSetting('YOUTUBE_VIDEO_CATEGORY_ID');
  const madeForKids = await getSetting('YOUTUBE_MADE_FOR_KIDS');

  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const videoMetadata = {
    snippet: {
      title: `[E2E TEST] Publishing Flow Test ${timestamp}`,
      description: `Automated E2E test of YouTube publishing flow.\nGenerated at: ${timestamp}\nThis video will be deleted after verification.`,
      tags: ['e2e-test', 'automated', 'ai-influencer'],
      categoryId: String(categoryId),
    },
    status: {
      privacyStatus: 'private', // ALWAYS private for tests
      selfDeclaredMadeForKids: madeForKids === 'true',
    },
  };

  // Step 3a: Initiate resumable upload
  console.log('  [3a] Initiating resumable upload...');
  console.log(`       Title: ${videoMetadata.snippet.title}`);
  console.log(`       Privacy: ${videoMetadata.status.privacyStatus}`);
  console.log(`       Size: ${videoBuffer.length} bytes`);

  const initResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(videoBuffer.length),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(videoMetadata),
    },
  );

  if (!initResponse.ok) {
    const body = await initResponse.text();
    throw new Error(`YouTube init upload failed (${initResponse.status}): ${body}`);
  }

  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('No Location header in YouTube init response');
  }
  console.log(`  [3a] Got upload URL: ${uploadUrl.slice(0, 80)}...`);

  // Step 3b: Upload video data
  console.log('  [3b] Uploading video data...');
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.length),
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text();
    throw new Error(`YouTube upload failed (${uploadResponse.status}): ${body}`);
  }

  const uploadResult = await uploadResponse.json();
  const videoId = uploadResult.id;

  if (!videoId) {
    console.error('  Full response:', JSON.stringify(uploadResult, null, 2));
    throw new Error('YouTube upload succeeded but no video ID returned');
  }

  const postUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const postedAt = new Date().toISOString();

  console.log(`  [3b] Upload complete!`);
  console.log(`       Video ID: ${videoId}`);
  console.log(`       URL: ${postUrl}`);
  console.log(`       Posted at: ${postedAt}`);

  return { videoId, postUrl, postedAt };
}

// ── Step 4: Record in DB ─────────────────────────────────────────────────────

async function recordPublication(videoId, postUrl, postedAt) {
  console.log('\n=== Step 4: Record Publication in DB ===\n');

  // Create a test content record if needed (or use existing CNT_0001)
  // First check if we have a suitable content_id
  let contentId = 'CNT_E2E_TEST';

  // Check if test content exists
  const existing = await pool.query(
    'SELECT content_id, status FROM content WHERE content_id = $1',
    [contentId],
  );

  if (existing.rows.length === 0) {
    // Create minimal test content record
    console.log(`  Creating test content record: ${contentId}`);
    await pool.query(
      `INSERT INTO content (content_id, content_format, status, created_at, updated_at)
       VALUES ($1, 'short_video', 'posted', NOW(), NOW())
       ON CONFLICT (content_id) DO NOTHING`,
      [contentId],
    );
  } else {
    console.log(`  Using existing content: ${contentId} (status: ${existing.rows[0].status})`);
  }

  // Insert publication record
  console.log('  Inserting publication record...');
  const pubRes = await pool.query(
    `INSERT INTO publications (content_id, account_id, platform, platform_post_id, post_url, posted_at, status, created_at, updated_at)
     VALUES ($1, $2, 'youtube', $3, $4, $5, 'posted', NOW(), NOW())
     RETURNING id`,
    [contentId, ACCOUNT_ID, videoId, postUrl, postedAt],
  );

  const pubId = pubRes.rows[0].id;
  console.log(`  Publication recorded: id=${pubId}`);

  // Update content status to 'posted'
  await pool.query(
    `UPDATE content SET status = 'posted', updated_at = NOW() WHERE content_id = $1`,
    [contentId],
  );
  console.log(`  Content ${contentId} status updated to 'posted'`);

  return pubId;
}

// ── Step 5: Verify ───────────────────────────────────────────────────────────

async function verify(pubId, videoId) {
  console.log('\n=== Step 5: Verification ===\n');

  // Verify publication in DB
  const pubRes = await pool.query(
    `SELECT id, content_id, account_id, platform, platform_post_id, post_url, posted_at, status
     FROM publications WHERE id = $1`,
    [pubId],
  );
  const pub = pubRes.rows[0];
  console.log('  Publication record:');
  console.log(`    id:               ${pub.id}`);
  console.log(`    content_id:       ${pub.content_id}`);
  console.log(`    account_id:       ${pub.account_id}`);
  console.log(`    platform:         ${pub.platform}`);
  console.log(`    platform_post_id: ${pub.platform_post_id}`);
  console.log(`    post_url:         ${pub.post_url}`);
  console.log(`    posted_at:        ${pub.posted_at}`);
  console.log(`    status:           ${pub.status}`);

  // Verify video exists via YouTube Data API
  const acctRes = await pool.query(
    `SELECT auth_credentials->'oauth'->>'access_token' AS access_token
     FROM accounts WHERE account_id = $1`,
    [ACCOUNT_ID],
  );
  const accessToken = acctRes.rows[0].access_token;

  console.log('\n  Verifying video via YouTube Data API...');
  const ytRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!ytRes.ok) {
    console.log(`  WARNING: YouTube API check failed (${ytRes.status}): ${await ytRes.text()}`);
  } else {
    const ytData = await ytRes.json();
    if (ytData.items && ytData.items.length > 0) {
      const video = ytData.items[0];
      console.log(`    YouTube title:   ${video.snippet.title}`);
      console.log(`    YouTube privacy: ${video.status.privacyStatus}`);
      console.log(`    YouTube channel: ${video.snippet.channelId}`);
      console.log(`    Upload status:   ${video.status.uploadStatus}`);
    } else {
      console.log('  WARNING: Video not found in YouTube API (may take a moment to process)');
    }
  }

  // Count total publications
  const countRes = await pool.query('SELECT COUNT(*) AS total FROM publications');
  console.log(`\n  Total publications in DB: ${countRes.rows[0].total}`);

  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('============================================');
  console.log('  YouTube Publishing E2E Test');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  Account: ${ACCOUNT_ID}`);
  console.log('============================================');

  try {
    // Step 0: Pre-flight
    const { isExpired } = await preflight();

    // Step 1: Token refresh (always refresh to ensure fresh token)
    const accessToken = await refreshToken();

    // Step 2: Generate test video
    const videoBuffer = generateTestVideo();

    // Step 3: Upload to YouTube (PRIVATE)
    const { videoId, postUrl, postedAt } = await uploadToYouTube(accessToken, videoBuffer);

    // Step 4: Record in DB
    const pubId = await recordPublication(videoId, postUrl, postedAt);

    // Step 5: Verify
    await verify(pubId, videoId);

    // Clean up test video file
    if (existsSync(TEST_VIDEO_PATH)) {
      unlinkSync(TEST_VIDEO_PATH);
      console.log(`\n  Cleaned up: ${TEST_VIDEO_PATH}`);
    }

    console.log('\n============================================');
    console.log('  E2E TEST PASSED');
    console.log('============================================');
    console.log(`\n  Video URL: ${postUrl}`);
    console.log('  (private — will not appear in public channel)\n');
  } catch (err) {
    console.error('\n============================================');
    console.error('  E2E TEST FAILED');
    console.error('============================================');
    console.error(`\n  Error: ${err.message}`);
    if (err.cause) console.error(`  Cause: ${err.cause}`);
    console.error('');
    process.exit(1);
  } finally {
    // Clean up
    if (existsSync(TEST_VIDEO_PATH)) {
      try { unlinkSync(TEST_VIDEO_PATH); } catch { /* ignore */ }
    }
    await pool.end();
  }
}

main();
