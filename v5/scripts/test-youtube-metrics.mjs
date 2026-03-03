/**
 * Test script: YouTube Analytics API 疎通確認
 *
 * 実際の publications レコードを使って collectYoutubeMetrics を呼び出し、
 * YouTube Analytics API から実データが取得できるかを確認する。
 *
 * 使い方（VM 上で実行）:
 *   node --env-file=.env.production scripts/test-youtube-metrics.mjs
 */
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── DB 接続 ──────────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 3,
  connectionTimeoutMillis: 10000,
});

// ── Step 1: DB から YouTube 計測対象を取得 ────────────────────────────────────

async function fetchTarget() {
  const result = await pool.query(`
    SELECT
      pub.id AS pub_id,
      pub.platform_post_id,
      pub.account_id,
      pub.posted_at,
      acc.auth_credentials->'oauth'->>'access_token' AS access_token,
      acc.auth_credentials->'oauth'->>'refresh_token' AS refresh_token,
      acc.auth_credentials->'oauth'->>'expires_at' AS expires_at
    FROM publications pub
    JOIN accounts acc ON pub.account_id = acc.account_id
    WHERE acc.platform = 'youtube'
      AND pub.status = 'posted'
    ORDER BY pub.posted_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    throw new Error('No YouTube publication found in DB');
  }

  return result.rows[0];
}

// ── Step 2: access_token リフレッシュ ─────────────────────────────────────────

async function getClientCredentials() {
  const result = await pool.query(
    `SELECT setting_value FROM system_settings WHERE setting_key = $1`,
    ['YOUTUBE_CLIENT_ID']
  );
  const clientId = result.rows[0]?.setting_value;

  const result2 = await pool.query(
    `SELECT setting_value FROM system_settings WHERE setting_key = $1`,
    ['YOUTUBE_CLIENT_SECRET']
  );
  const clientSecret = result2.rows[0]?.setting_value;

  return { clientId, clientSecret };
}

async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  console.log('[test] Refreshing YouTube access token...');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  console.log('[test] Token refresh succeeded.');
  console.log('  expires_in:', data.expires_in, 'seconds');
  return data.access_token;
}

// ── Step 3: YouTube Analytics API v2 呼び出し ────────────────────────────────

async function fetchYouTubeAnalytics(accessToken, platformPostId) {
  console.log(`[test] Calling YouTube Analytics API for video: ${platformPostId}`);

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = '2020-01-01';

  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,likes,comments,shares',
    filters: `video==${platformPostId}`,
  });

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  console.log('[test] URL:', url);

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const responseText = await resp.text();
  console.log('[test] Response status:', resp.status);

  if (resp.status === 401) {
    throw new Error('401 Unauthorized — token may be invalid');
  }
  if (resp.status === 403) {
    console.error('[test] 403 Forbidden — API not enabled or insufficient scope');
    console.error('[test] Response body:', responseText);
    throw new Error('403 Forbidden: YouTube Analytics API access denied');
  }
  if (!resp.ok) {
    throw new Error(`YouTube Analytics API error (${resp.status}): ${responseText}`);
  }

  const data = JSON.parse(responseText);
  return data;
}

// ── Step 4: DB に結果を保存 (ON CONFLICT UPDATE) ─────────────────────────────

async function saveMetrics(pubId, metrics) {
  const { views, likes, comments, shares, watch_time_seconds, completion_rate } = metrics;
  const engagementRate = views > 0
    ? ((likes + comments + shares) / views)
    : 0;

  await pool.query(`
    INSERT INTO metrics (
      publication_id, views, likes, comments, shares,
      watch_time_seconds, completion_rate, engagement_rate,
      measurement_point, measured_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '48h', NOW())
    ON CONFLICT (publication_id, measurement_point)
    DO UPDATE SET
      views = EXCLUDED.views,
      likes = EXCLUDED.likes,
      comments = EXCLUDED.comments,
      shares = EXCLUDED.shares,
      watch_time_seconds = EXCLUDED.watch_time_seconds,
      completion_rate = EXCLUDED.completion_rate,
      engagement_rate = EXCLUDED.engagement_rate,
      measured_at = NOW()
  `, [pubId, views, likes, comments, shares, watch_time_seconds, completion_rate, engagementRate]);

  console.log('[test] Metrics saved to DB successfully.');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== YouTube Analytics API Test ===\n');

  try {
    // Step 1: DB から対象取得
    console.log('[Step 1] Fetching YouTube publication from DB...');
    const target = await fetchTarget();
    console.log('  pub_id:', target.pub_id);
    console.log('  platform_post_id:', target.platform_post_id);
    console.log('  posted_at:', target.posted_at);
    console.log('  access_token present:', !!target.access_token);
    console.log('  refresh_token present:', !!target.refresh_token);
    console.log('  token expires_at:', target.expires_at);
    console.log();

    // Step 2: access_token 確認・リフレッシュ
    console.log('[Step 2] Checking token validity...');
    const now = Date.now();
    const expiresAt = target.expires_at ? new Date(target.expires_at).getTime() : 0;
    const isExpired = now > expiresAt - 5 * 60 * 1000; // 5min buffer
    console.log('  Token expired:', isExpired);

    let accessToken = target.access_token;

    if (isExpired || !accessToken) {
      if (!target.refresh_token) {
        throw new Error('No refresh_token available — cannot obtain access token');
      }
      console.log('[Step 2] Token expired, refreshing...');
      const { clientId, clientSecret } = await getClientCredentials();
      accessToken = await refreshAccessToken(target.refresh_token, clientId, clientSecret);

      // DB に新しい access_token を保存
      const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      await pool.query(`
        UPDATE accounts
        SET auth_credentials = jsonb_set(
          jsonb_set(auth_credentials, '{oauth,access_token}', to_jsonb($2::text)),
          '{oauth,expires_at}', to_jsonb($3::text)
        )
        WHERE account_id = $1
      `, [target.account_id, accessToken, newExpiresAt]);
      console.log('  New access_token saved to DB, expires:', newExpiresAt);
    } else {
      console.log('  Token is still valid.');
    }
    console.log();

    // Step 3: YouTube Analytics API 呼び出し
    console.log('[Step 3] Calling YouTube Analytics API...');
    const analyticsData = await fetchYouTubeAnalytics(accessToken, target.platform_post_id);

    console.log('\n--- Raw API Response ---');
    console.log(JSON.stringify(analyticsData, null, 2));
    console.log('------------------------\n');

    // レスポンス解析
    const rows = analyticsData.rows;
    let metrics;

    if (!rows || rows.length === 0) {
      console.log('[test] No data rows returned (video may be too new or have 0 views).');
      console.log('[test] This is REAL API data — just no analytics available yet.');
      metrics = { views: 0, likes: 0, comments: 0, shares: 0, watch_time_seconds: 0, completion_rate: 0 };
    } else {
      const row = rows[0];
      const views = row[0] ?? 0;
      const estimatedMinutesWatched = row[1] ?? 0;
      const likes = row[2] ?? 0;
      const comments = row[3] ?? 0;
      const shares = row[4] ?? 0;
      const watchTimeSeconds = Math.round(estimatedMinutesWatched * 60);
      const completionRate = views > 0
        ? Math.min(1, watchTimeSeconds / (views * 60))
        : 0;

      metrics = { views, likes, comments, shares, watch_time_seconds: watchTimeSeconds, completion_rate: completionRate };
    }

    console.log('[Step 3] Parsed metrics:');
    console.log('  views:', metrics.views);
    console.log('  likes:', metrics.likes);
    console.log('  comments:', metrics.comments);
    console.log('  shares:', metrics.shares);
    console.log('  watch_time_seconds:', metrics.watch_time_seconds);
    console.log('  completion_rate:', metrics.completion_rate);
    console.log();

    // Step 4: DB 保存
    console.log('[Step 4] Saving metrics to DB...');
    await saveMetrics(target.pub_id, metrics);

    // 保存結果確認
    const saved = await pool.query(
      `SELECT views, likes, comments, shares, watch_time_seconds, completion_rate, engagement_rate, measured_at
       FROM metrics WHERE publication_id = $1 AND measurement_point = '48h'`,
      [target.pub_id]
    );
    console.log('\n--- Saved metrics in DB ---');
    console.log(saved.rows[0]);
    console.log('---------------------------');

    console.log('\n✅ Test completed successfully!');
    console.log('   → Real YouTube Analytics API data confirmed');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.message.includes('refresh_token')) {
      console.error('   → refresh_token が失効しているか、YouTube consent が取り消された可能性があります');
      console.error('   → scripts/get-youtube-token.mjs を再実行してトークンを更新してください');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
