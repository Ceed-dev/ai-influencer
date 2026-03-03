/**
 * YouTube投稿テスト（Drive不要版）
 * 1. ffmpegでテスト動画生成（5秒のカラーバー動画）
 * 2. ローカル動画ファイルをバッファに読み込む
 * 3. DBからACC_0001のOAuthトークンを取得・更新
 * 4. YouTube Data API v3 resumable uploadで直接投稿（private）
 * 5. publicationsテーブル更新確認
 *
 * YOUTUBE_DEFAULT_PRIVACY_STATUS = 'private' のため非公開投稿
 * Service Accountのストレージ問題を回避するため、Drive経由なし
 */
process.env.NODE_ENV = 'production';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

const { getPool, closePool } = await import('./dist/src/db/pool.js');
const { getSettingString } = await import('./dist/src/lib/settings.js');

const CONTENT_ID = 'CNT_0001';
const ACCOUNT_ID = 'ACC_0001';

const pool = getPool();

console.log('=== YouTube投稿テスト開始（Drive不要版）===');

let tempDir = null;

try {
  // Step 1: ffmpegでテスト動画生成
  console.log('\n[1/4] ffmpegでテスト動画生成中...');
  tempDir = await mkdtemp(join(tmpdir(), 'yt-test-'));
  const videoPath = join(tempDir, 'test-video.mp4');

  await execFileAsync('ffmpeg', [
    '-f', 'lavfi',
    '-i', 'testsrc=duration=5:size=1280x720:rate=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=5',
    '-c:v', 'libx264', '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    '-y',
    videoPath,
  ]);
  console.log('テスト動画生成完了:', videoPath);

  // Step 2: 動画ファイルをバッファに読み込む
  const videoBuffer = await readFile(videoPath);
  console.log(`動画サイズ: ${(videoBuffer.length / 1024).toFixed(1)} KB`);

  // Step 3: DBからOAuthトークン取得・更新
  console.log('\n[2/4] OAuthトークン取得...');
  const accountResult = await pool.query(
    `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'youtube'`,
    [ACCOUNT_ID]
  );

  if (accountResult.rows.length === 0) {
    throw new Error(`YouTube account not found: ${ACCOUNT_ID}`);
  }

  const rawCreds = accountResult.rows[0].auth_credentials;
  const oauth = rawCreds.oauth;
  console.log('refresh_token 先頭20文字:', oauth.refresh_token?.slice(0, 20) + '...');

  // トークンが期限切れかチェックして更新
  const clientId = await getSettingString('YOUTUBE_CLIENT_ID');
  const clientSecret = await getSettingString('YOUTUBE_CLIENT_SECRET');

  const isExpired = !oauth.expires_at || Date.now() > new Date(oauth.expires_at).getTime() - 5 * 60 * 1000;
  console.log('トークン期限切れ:', isExpired ? 'はい' : 'いいえ', '(expires_at:', oauth.expires_at, ')');

  let accessToken = oauth.access_token;

  if (isExpired) {
    console.log('アクセストークンを更新中...');
    const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: oauth.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResp.ok) {
      const errorBody = await refreshResp.text();
      throw new Error(`トークン更新失敗 (${refreshResp.status}): ${errorBody}`);
    }

    const refreshData = await refreshResp.json();
    accessToken = refreshData.access_token;
    const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

    // DBを更新
    await pool.query(
      `UPDATE accounts
       SET auth_credentials = jsonb_set(
         jsonb_set(auth_credentials, '{oauth,access_token}', to_jsonb($2::text)),
         '{oauth,expires_at}', to_jsonb($3::text)
       )
       WHERE account_id = $1`,
      [ACCOUNT_ID, accessToken, expiresAt]
    );
    console.log('アクセストークン更新完了、有効期限:', expiresAt);
  }

  // Step 4: YouTube Data API v3 resumable uploadで直接投稿
  console.log('\n[3/4] YouTube APIにアップロード中...');

  const categoryId = await getSettingString('YOUTUBE_VIDEO_CATEGORY_ID').catch(() => '22');
  const privacyStatus = await getSettingString('YOUTUBE_DEFAULT_PRIVACY_STATUS').catch(() => 'private');

  const videoMetadata = {
    snippet: {
      title: 'AI Influencer v5 テスト投稿 (非公開)',
      description: 'これはAI Influencer v5システムの投稿APIテストです。自動的に非公開設定で投稿されます。',
      tags: ['test', 'ai', 'influencer', 'private'],
      categoryId,
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  // Initiate resumable upload
  const initResp = await fetch(
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
    }
  );

  if (!initResp.ok) {
    const body = await initResp.text();
    throw new Error(`YouTube resumable upload initiation failed (${initResp.status}): ${body}`);
  }

  const uploadUrl = initResp.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('YouTube resumable upload: no Location header');
  }
  console.log('Resumable upload URL取得完了');

  // Upload video bytes
  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.length),
    },
    body: videoBuffer,
  });

  if (!uploadResp.ok) {
    const body = await uploadResp.text();
    throw new Error(`YouTube upload failed (${uploadResp.status}): ${body}`);
  }

  const uploadResult = await uploadResp.json();
  const videoId = uploadResult.id;
  if (!videoId) {
    throw new Error('YouTube upload succeeded but no video ID returned');
  }

  const postUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const postedAt = new Date().toISOString();

  console.log('\n投稿結果:');
  console.log('  platform_post_id:', videoId);
  console.log('  post_url:', postUrl);
  console.log('  posted_at:', postedAt);
  console.log('  privacy:', privacyStatus);

  // Step 5: DB更新
  console.log('\n[4/4] DBを更新...');

  // publications: 既存のscheduledレコードがあれば更新、なければ挿入
  const existingPub = await pool.query(
    `SELECT id FROM publications WHERE content_id = $1 AND account_id = $2`,
    [CONTENT_ID, ACCOUNT_ID]
  );

  let pubId;
  if (existingPub.rows.length > 0) {
    const updateResult = await pool.query(
      `UPDATE publications
       SET platform_post_id = $3, post_url = $4, posted_at = $5, status = 'posted'
       WHERE content_id = $1 AND account_id = $2
       RETURNING id`,
      [CONTENT_ID, ACCOUNT_ID, videoId, postUrl, postedAt]
    );
    pubId = updateResult.rows[0]?.id;
    console.log('publications 更新 id:', pubId);
  } else {
    const insertResult = await pool.query(
      `INSERT INTO publications (content_id, account_id, platform, platform_post_id, post_url, posted_at, status)
       VALUES ($1, $2, 'youtube', $3, $4, $5, 'posted')
       RETURNING id`,
      [CONTENT_ID, ACCOUNT_ID, videoId, postUrl, postedAt]
    );
    pubId = insertResult.rows[0]?.id;
    console.log('publications 挿入 id:', pubId);
  }

  // content status を 'posted' に更新
  await pool.query(
    `UPDATE content SET status = 'posted', updated_at = NOW() WHERE content_id = $1`,
    [CONTENT_ID]
  );

  // 最終確認
  const check = await pool.query(
    `SELECT p.id, p.platform_post_id, p.post_url, p.status, p.posted_at
     FROM publications p WHERE p.content_id = $1 ORDER BY p.id DESC LIMIT 3`,
    [CONTENT_ID]
  );
  console.log('\nDB確認 (publications):');
  check.rows.forEach(r => console.log(' ', JSON.stringify(r)));

  console.log('\n=== 投稿テスト完了 ===');
  console.log('✅ YouTube投稿成功 (private)');
  console.log('   URL:', postUrl);

} catch (err) {
  console.error('\n=== エラー ===');
  if (err instanceof Error) {
    console.error('メッセージ:', err.message);
    console.error('スタック:', err.stack?.split('\n').slice(1, 4).join('\n'));
  } else {
    console.error(err);
  }
} finally {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
  await closePool();
}
