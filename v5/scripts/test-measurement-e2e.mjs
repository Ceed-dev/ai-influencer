/**
 * E2E Test: measurement-job graph flow
 *
 * Simulates the full measurement-job LangGraph cycle by executing each node
 * function in sequence against the real production DB and YouTube Analytics API.
 *
 * Flow: detectTargets → collect → saveMetrics → triggerAnalysis → verify
 *
 * Usage (on VM):
 *   node --env-file=.env.production scripts/test-measurement-e2e.mjs
 */
import pg from 'pg';

// ── DB setup ─────────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env['DATABASE_URL'],
  max: 5,
  connectionTimeoutMillis: 10000,
});

// ── State (mirrors MeasurementJobAnnotation) ─────────────────────────────────

const state = {
  targets: [],
  current_target: null,
  collected_metrics: null,
  processed_count: 0,
  error_count: 0,
  analysis_triggers: [],
};

// ── Helper: get system setting ───────────────────────────────────────────────

async function getSetting(key) {
  const res = await pool.query(
    'SELECT setting_value FROM system_settings WHERE setting_key = $1',
    [key]
  );
  if (res.rows.length === 0) throw new Error(`Setting not found: ${key}`);
  return res.rows[0].setting_value;
}

// ── Node 1: detectTargets ────────────────────────────────────────────────────

async function detectTargets() {
  console.log('\n' + '='.repeat(60));
  console.log('[Node 1] detect_targets');
  console.log('='.repeat(60));

  let batchSize = 20;
  try {
    batchSize = Number(await getSetting('MEASUREMENT_BATCH_SIZE'));
  } catch {
    console.log('  MEASUREMENT_BATCH_SIZE not found, using default:', batchSize);
  }

  const res = await pool.query(
    `SELECT
       p.id AS publication_id,
       p.content_id,
       p.account_id,
       a.platform,
       p.platform_post_id,
       p.posted_at,
       ps.id AS prediction_snapshot_id,
       CASE
         WHEN ps.actual_impressions_48h IS NULL
              AND p.posted_at + INTERVAL '48 hours' <= NOW()
           THEN '48h'
         WHEN ps.actual_impressions_7d IS NULL
              AND p.posted_at + INTERVAL '7 days' <= NOW()
           THEN '7d'
         WHEN ps.actual_impressions_30d IS NULL
              AND p.posted_at + INTERVAL '30 days' <= NOW()
           THEN '30d'
       END AS measurement_point
     FROM publications p
     JOIN accounts a ON a.account_id = p.account_id
     INNER JOIN prediction_snapshots ps ON ps.publication_id = p.id
     WHERE p.status = 'posted'
       AND p.platform_post_id IS NOT NULL
       AND (
         (ps.actual_impressions_48h IS NULL AND p.posted_at + INTERVAL '48 hours' <= NOW())
         OR (ps.actual_impressions_7d IS NULL AND p.posted_at + INTERVAL '7 days' <= NOW())
         OR (ps.actual_impressions_30d IS NULL AND p.posted_at + INTERVAL '30 days' <= NOW())
       )
     ORDER BY p.posted_at ASC
     LIMIT $1`,
    [batchSize]
  );

  const targets = res.rows
    .filter(row => row.measurement_point != null)
    .map(row => ({
      task_id: 0,
      publication_id: row.publication_id,
      content_id: row.content_id,
      account_id: row.account_id,
      platform: row.platform,
      platform_post_id: row.platform_post_id,
      posted_at: new Date(row.posted_at).toISOString(),
      measurement_type: row.measurement_point,
    }));

  state.targets = targets;
  state.current_target = targets[0] ?? null;
  state.collected_metrics = null;
  state.analysis_triggers = [];

  console.log(`  Found ${targets.length} target(s):`);
  for (const t of targets) {
    const hoursAgo = ((Date.now() - new Date(t.posted_at).getTime()) / 3600000).toFixed(1);
    console.log(`    - pub=${t.publication_id} ${t.platform}/${t.platform_post_id} ` +
      `type=${t.measurement_type} posted ${hoursAgo}h ago`);
  }

  if (targets.length === 0) {
    console.log('  No targets found. detectTargetsEdge → sleep');
    return false;
  }

  console.log('  detectTargetsEdge → collect');
  return true;
}

// ── Node 3: collect ──────────────────────────────────────────────────────────

async function collect() {
  console.log('\n' + '='.repeat(60));
  console.log('[Node 3] collect');
  console.log('='.repeat(60));

  const target = state.current_target;
  if (!target) {
    console.error('  ERROR: no current_target');
    return false;
  }

  console.log(`  Target: ${target.platform}/${target.platform_post_id} (${target.measurement_type})`);

  if (target.platform !== 'youtube') {
    console.log(`  Platform ${target.platform} not supported in this test — skipping`);
    return false;
  }

  // Look up OAuth credentials
  const credResult = await pool.query(
    `SELECT p.account_id, a.auth_credentials
     FROM publications p
     JOIN accounts a ON p.account_id = a.account_id
     WHERE p.platform_post_id = $1 AND a.platform = 'youtube'
     LIMIT 1`,
    [target.platform_post_id]
  );

  if (credResult.rows.length === 0) {
    console.error('  ERROR: No credentials found for', target.platform_post_id);
    return false;
  }

  const authCredentials = credResult.rows[0].auth_credentials;
  const oauth = authCredentials?.oauth;
  if (!oauth?.refresh_token) {
    console.error('  ERROR: No refresh_token in auth_credentials');
    return false;
  }

  console.log('  OAuth credentials found for account:', credResult.rows[0].account_id);
  console.log('  refresh_token present:', !!oauth.refresh_token);

  // Get app-level credentials
  let clientId, clientSecret;
  try {
    clientId = String(await getSetting('YOUTUBE_CLIENT_ID'));
    clientSecret = String(await getSetting('YOUTUBE_CLIENT_SECRET'));
  } catch (err) {
    console.error('  ERROR: Missing YOUTUBE_CLIENT_ID/SECRET:', err.message);
    return false;
  }

  // Refresh access token
  let accessToken = oauth.access_token || '';
  console.log('  Refreshing access token...');
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: oauth.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`  Token refresh failed (${resp.status}):`, body);
      return false;
    }

    const tokenData = await resp.json();
    accessToken = tokenData.access_token;
    console.log('  Token refreshed successfully (expires_in:', tokenData.expires_in, 's)');

    // Save new access token to DB
    await pool.query(
      `UPDATE accounts
       SET auth_credentials = jsonb_set(
         COALESCE(auth_credentials, '{}'::jsonb),
         '{oauth,access_token}',
         to_jsonb($1::text)
       ),
       updated_at = NOW()
       WHERE account_id = $2 AND platform = 'youtube'`,
      [accessToken, target.account_id]
    );
    console.log('  New access_token saved to DB');
  } catch (err) {
    console.error('  Token refresh error:', err.message);
    return false;
  }

  // Call YouTube Analytics API v2
  console.log('  Calling YouTube Analytics API...');
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = '2020-01-01';

  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,likes,comments,shares',
    filters: `video==${target.platform_post_id}`,
  });

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(`  YouTube Analytics API error (${resp.status}):`, body);
    return false;
  }

  const analyticsData = await resp.json();
  console.log('  Raw API response:', JSON.stringify(analyticsData, null, 2));

  const rows = analyticsData.rows;
  let views = 0, likes = 0, comments = 0, shares = 0, watchTimeSeconds = 0, completionRate = 0;

  if (rows && rows.length > 0) {
    const row = rows[0];
    views = row[0] ?? 0;
    const estimatedMinutesWatched = row[1] ?? 0;
    likes = row[2] ?? 0;
    comments = row[3] ?? 0;
    shares = row[4] ?? 0;
    watchTimeSeconds = Math.round(estimatedMinutesWatched * 60);
    completionRate = views > 0 ? Math.min(1, watchTimeSeconds / (views * 60)) : 0;
  } else {
    console.log('  No data rows (video may be new or have 0 views — this is real API data)');
  }

  // Collect account metrics (follower delta)
  let followerDelta = 0;
  try {
    const accountRes = await pool.query(
      `SELECT follower_count FROM accounts WHERE account_id = $1`,
      [target.account_id]
    );
    const deltaRes = await pool.query(
      `SELECT COALESCE(SUM(follower_delta), 0) AS total_delta
       FROM metrics m
       JOIN publications p ON m.publication_id = p.id
       WHERE p.account_id = $1
         AND m.measured_at >= NOW() - INTERVAL '7 days'`,
      [target.account_id]
    );
    followerDelta = Number(deltaRes.rows[0]?.total_delta ?? 0);
    console.log(`  Account follower_count: ${accountRes.rows[0]?.follower_count ?? 'N/A'}, delta_7d: ${followerDelta}`);
  } catch (err) {
    console.log('  Account metrics fetch failed (non-fatal):', err.message);
  }

  // Calculate engagement rate
  const totalEngagement = likes + comments + shares;
  const engagementRate = views > 0
    ? Number(Math.min(1, totalEngagement / views).toFixed(4))
    : 0;

  state.collected_metrics = {
    views,
    likes,
    comments,
    shares,
    saves: undefined,
    watch_time_seconds: watchTimeSeconds,
    completion_rate: Number(completionRate.toFixed(4)),
    engagement_rate: engagementRate,
    follower_delta: followerDelta,
    impressions: undefined,
    reach: undefined,
    raw_data: analyticsData,
  };

  console.log('\n  Collected metrics:');
  console.log(`    views: ${views}`);
  console.log(`    likes: ${likes}`);
  console.log(`    comments: ${comments}`);
  console.log(`    shares: ${shares}`);
  console.log(`    watch_time_seconds: ${watchTimeSeconds}`);
  console.log(`    completion_rate: ${completionRate.toFixed(4)}`);
  console.log(`    engagement_rate: ${engagementRate}`);
  console.log(`    follower_delta: ${followerDelta}`);

  return true;
}

// ── Node 4: saveMetrics ──────────────────────────────────────────────────────

async function saveMetrics() {
  console.log('\n' + '='.repeat(60));
  console.log('[Node 4] save_metrics');
  console.log('='.repeat(60));

  const target = state.current_target;
  const metrics = state.collected_metrics;

  if (!target || !metrics) {
    console.error('  ERROR: missing target or metrics');
    return false;
  }

  const measurementType = target.measurement_type;
  console.log(`  Saving ${measurementType} metrics for pub=${target.publication_id}...`);

  // 1. INSERT/UPSERT into metrics table
  await pool.query(
    `INSERT INTO metrics (publication_id, views, likes, comments, shares, saves,
                          engagement_rate, follower_delta, impressions, reach,
                          watch_time_seconds, completion_rate, raw_data, measurement_point)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (publication_id, measurement_point)
     DO UPDATE SET
       views = EXCLUDED.views,
       likes = EXCLUDED.likes,
       comments = EXCLUDED.comments,
       shares = EXCLUDED.shares,
       saves = EXCLUDED.saves,
       engagement_rate = EXCLUDED.engagement_rate,
       follower_delta = EXCLUDED.follower_delta,
       impressions = EXCLUDED.impressions,
       reach = EXCLUDED.reach,
       watch_time_seconds = EXCLUDED.watch_time_seconds,
       completion_rate = EXCLUDED.completion_rate,
       raw_data = EXCLUDED.raw_data,
       measured_at = NOW()`,
    [
      target.publication_id,
      metrics.views,
      metrics.likes,
      metrics.comments,
      metrics.shares,
      metrics.saves ?? null,
      metrics.engagement_rate,
      metrics.follower_delta,
      metrics.impressions ?? null,
      metrics.reach ?? null,
      metrics.watch_time_seconds ?? null,
      metrics.completion_rate ?? null,
      metrics.raw_data ? JSON.stringify(metrics.raw_data) : null,
      measurementType,
    ]
  );
  console.log('  metrics row upserted');

  // 2. UPDATE prediction_snapshots
  const actualImpressions = metrics.views;

  switch (measurementType) {
    case '48h':
      await pool.query(
        `UPDATE prediction_snapshots
         SET actual_impressions_48h = $1, updated_at = NOW()
         WHERE publication_id = $2`,
        [actualImpressions, target.publication_id]
      );
      console.log(`  prediction_snapshots.actual_impressions_48h = ${actualImpressions}`);
      break;

    case '7d':
      await pool.query(
        `UPDATE prediction_snapshots
         SET actual_impressions_7d = $1,
             prediction_error_7d = CASE
               WHEN $1 > 0 THEN ABS(predicted_impressions - $1)::NUMERIC / $1
               ELSE NULL
             END,
             updated_at = NOW()
         WHERE publication_id = $2`,
        [actualImpressions, target.publication_id]
      );
      console.log(`  prediction_snapshots.actual_impressions_7d = ${actualImpressions}`);
      break;

    case '30d':
      await pool.query(
        `UPDATE prediction_snapshots
         SET actual_impressions_30d = $1,
             prediction_error_30d = CASE
               WHEN $1 > 0 THEN ABS(predicted_impressions - $1)::NUMERIC / $1
               ELSE NULL
             END,
             updated_at = NOW()
         WHERE publication_id = $2`,
        [actualImpressions, target.publication_id]
      );
      console.log(`  prediction_snapshots.actual_impressions_30d = ${actualImpressions}`);
      break;
  }

  // 3. Mark publication as 'measured' only after 30d round
  if (measurementType === '30d') {
    await pool.query(
      `UPDATE publications SET status = 'measured', updated_at = NOW()
       WHERE id = $1 AND status = 'posted'`,
      [target.publication_id]
    );
    console.log('  publication status → measured');
  } else {
    console.log(`  publication status stays 'posted' (not 30d round)`);
  }

  state.processed_count += 1;
  console.log(`  processed_count: ${state.processed_count}`);
  return true;
}

// ── Node 5: triggerAnalysis ──────────────────────────────────────────────────

async function triggerAnalysis() {
  console.log('\n' + '='.repeat(60));
  console.log('[Node 5] trigger_analysis');
  console.log('='.repeat(60));

  const target = state.current_target;
  if (!target) {
    console.error('  ERROR: no current_target');
    return false;
  }

  const measurementType = target.measurement_type;

  if (measurementType === '48h' || measurementType === '7d') {
    const analysisType = measurementType === '48h' ? 'micro' : 'cumulative';
    const payload = {
      analysis_type: analysisType,
      content_id: target.content_id,
      publication_id: target.publication_id,
      account_id: target.account_id,
      platform: target.platform,
      measurement_point: measurementType,
      triggered_by: 'measurement_job',
    };

    await pool.query(
      `INSERT INTO task_queue (task_type, payload, status, priority)
       VALUES ('curate', $1::jsonb, 'pending', 0)`,
      [JSON.stringify(payload)]
    );

    state.analysis_triggers.push({
      content_id: target.content_id,
      analysis_type: analysisType,
      measurement_point: measurementType,
    });

    console.log(`  Queued ${analysisType} analysis for content=${target.content_id} (${measurementType})`);
  } else {
    console.log(`  30d measurement — no analysis trigger (data preservation only)`);
  }

  // Advance to next target
  const remaining = state.targets.filter(
    t => t.publication_id !== target.publication_id || t.measurement_type !== target.measurement_type
  );
  state.targets = remaining;
  state.current_target = remaining[0] ?? null;
  state.collected_metrics = null;

  console.log(`  Remaining targets: ${remaining.length}`);

  return true;
}

// ── Verification ─────────────────────────────────────────────────────────────

async function verify() {
  console.log('\n' + '='.repeat(60));
  console.log('[Verification] DB state after measurement cycle');
  console.log('='.repeat(60));

  // Check metrics
  const metricsRes = await pool.query(
    `SELECT id, publication_id, views, likes, comments, shares,
            watch_time_seconds, completion_rate, engagement_rate,
            follower_delta, measurement_point, measured_at
     FROM metrics WHERE publication_id = 1
     ORDER BY measurement_point`
  );
  console.log('\n  --- metrics ---');
  for (const row of metricsRes.rows) {
    console.log(`    [${row.measurement_point}] views=${row.views} likes=${row.likes} ` +
      `comments=${row.comments} shares=${row.shares} ` +
      `engagement_rate=${row.engagement_rate} measured_at=${row.measured_at}`);
  }

  // Check prediction_snapshots
  const predRes = await pool.query(
    `SELECT publication_id, predicted_impressions,
            actual_impressions_48h, actual_impressions_7d, actual_impressions_30d,
            prediction_error_7d, prediction_error_30d
     FROM prediction_snapshots WHERE publication_id = 1`
  );
  console.log('\n  --- prediction_snapshots ---');
  for (const row of predRes.rows) {
    console.log(`    predicted: ${row.predicted_impressions}`);
    console.log(`    actual_48h: ${row.actual_impressions_48h}`);
    console.log(`    actual_7d: ${row.actual_impressions_7d}`);
    console.log(`    actual_30d: ${row.actual_impressions_30d}`);
    console.log(`    error_7d: ${row.prediction_error_7d}`);
    console.log(`    error_30d: ${row.prediction_error_30d}`);
  }

  // Check publications status
  const pubRes = await pool.query(
    `SELECT id, platform_post_id, status, posted_at FROM publications WHERE id = 1`
  );
  console.log('\n  --- publications ---');
  for (const row of pubRes.rows) {
    console.log(`    pub=${row.id} ${row.platform_post_id} status=${row.status} posted=${row.posted_at}`);
  }

  // Check task_queue
  const taskRes = await pool.query(
    `SELECT id, task_type, status, priority, payload
     FROM task_queue
     WHERE payload->>'triggered_by' = 'measurement_job'
     ORDER BY id DESC
     LIMIT 5`
  );
  console.log('\n  --- task_queue (measurement triggers) ---');
  for (const row of taskRes.rows) {
    const p = row.payload;
    console.log(`    task=${row.id} type=${row.task_type} status=${row.status} ` +
      `analysis=${p?.analysis_type} content=${p?.content_id} point=${p?.measurement_point}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   measurement-job E2E Test                               ║');
  console.log('║   Flow: detectTargets → collect → saveMetrics            ║');
  console.log('║         → triggerAnalysis → verify                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // DB connectivity check
    const dbCheck = await pool.query('SELECT 1 AS ok');
    console.log('\nDB connection: OK');

    // Node 1: detectTargets
    const hasTargets = await detectTargets();
    if (!hasTargets) {
      console.log('\nNo targets found — test cannot proceed.');
      console.log('Ensure posted_at is > 48h ago and actual_impressions_48h is NULL.');
      process.exit(1);
    }

    // Node 3: collect (Node 2 is sleep — skipped in test)
    const collectOk = await collect();
    if (!collectOk) {
      console.error('\nCollect failed — see errors above.');
      process.exit(1);
    }

    // Node 4: saveMetrics
    const saveOk = await saveMetrics();
    if (!saveOk) {
      console.error('\nSaveMetrics failed — see errors above.');
      process.exit(1);
    }

    // Node 5: triggerAnalysis
    const triggerOk = await triggerAnalysis();
    if (!triggerOk) {
      console.error('\nTriggerAnalysis failed — see errors above.');
      process.exit(1);
    }

    // Verification
    await verify();

    console.log('\n' + '='.repeat(60));
    console.log('E2E TEST RESULT: SUCCESS');
    console.log('='.repeat(60));
    console.log(`  Targets processed: ${state.processed_count}`);
    console.log(`  Errors: ${state.error_count}`);
    console.log(`  Analysis triggers: ${state.analysis_triggers.length}`);
    for (const t of state.analysis_triggers) {
      console.log(`    - ${t.analysis_type} for ${t.content_id} (${t.measurement_point})`);
    }

  } catch (err) {
    console.error('\nE2E TEST FAILED:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
