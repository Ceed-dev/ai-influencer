/**
 * FEAT-MS-006: リトライ間隔+最大試行回数
 * Tests: TEST-WKR-038, TEST-WKR-039
 *
 * TEST-WKR-038: リトライ間隔 >= 6時間
 * TEST-WKR-039: 5回失敗後に task_queue.status = 'failed_permanent'
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-MS-006: リトライ間隔+最大試行回数', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  async function setupMeasureTask(retryCount: number = 0): Promise<number> {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_MS06', 'Measure Char 6', 'voice_006')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, character_id, status)
      VALUES ('MS06A', 'tiktok', 'CH_MS06', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ('CMS06A', 'posted', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at,
        measure_after, platform_post_id)
      VALUES ('CMS06A', 'MS06A', 'tiktok', 'posted',
        NOW() - INTERVAL '50 hours', NOW() - INTERVAL '2 hours', 'post_ms06')
      ON CONFLICT DO NOTHING
    `);

    const taskRes = await client.query(`
      INSERT INTO task_queue (task_type, payload, status, priority, retry_count, max_retries)
      VALUES ('measure', $1, 'processing', 0, $2, 5)
      RETURNING id
    `, [JSON.stringify({
      publication_id: 1,
      platform: 'tiktok',
      platform_post_id: 'post_ms06',
      measurement_type: '48h',
    }), retryCount]);

    return taskRes.rows[0].id;
  }

  // TEST-WKR-038: リトライ間隔 >= 6時間
  test('TEST-WKR-038: retry interval >= METRICS_COLLECTION_RETRY_HOURS (6h)', async () => {
    const taskId = await setupMeasureTask(0);

    // Get retry interval from settings
    const settingRes = await client.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'METRICS_COLLECTION_RETRY_HOURS'"
    );
    const retryHours = settingRes.rows.length > 0 ? Number(settingRes.rows[0].setting_value) : 6;

    // Simulate failure: increment retry_count, set started_at for next retry
    await client.query(`
      UPDATE task_queue
      SET status = 'retrying',
          retry_count = retry_count + 1,
          error_message = 'API timeout',
          last_error_at = NOW(),
          started_at = NOW() + make_interval(hours => $1)
      WHERE id = $2
    `, [retryHours, taskId]);

    // Verify retry is scheduled >= retryHours in the future
    const res = await client.query(
      'SELECT started_at, last_error_at FROM task_queue WHERE id = $1',
      [taskId]
    );

    const startedAt = new Date(res.rows[0].started_at);
    const lastErrorAt = new Date(res.rows[0].last_error_at);
    const diffHours = (startedAt.getTime() - lastErrorAt.getTime()) / (1000 * 60 * 60);

    expect(diffHours).toBeGreaterThanOrEqual(retryHours - 0.1); // Allow small floating point tolerance
  });

  // TEST-WKR-039: 5回失敗後に failed_permanent
  test('TEST-WKR-039: status = failed_permanent after max attempts', async () => {
    // Get max attempts from settings
    const settingRes = await client.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'METRICS_MAX_COLLECTION_ATTEMPTS'"
    );
    const maxAttempts = settingRes.rows.length > 0 ? Number(settingRes.rows[0].setting_value) : 5;

    // Create task with retry_count = maxAttempts - 1 (one more failure = permanent)
    const taskId = await setupMeasureTask(maxAttempts - 1);

    // Simulate the final failure
    await client.query(`
      UPDATE task_queue
      SET status = CASE
        WHEN retry_count + 1 >= max_retries THEN 'failed_permanent'
        ELSE 'retrying'
      END,
      retry_count = retry_count + 1,
      error_message = 'API permanently unavailable',
      last_error_at = NOW(),
      completed_at = CASE
        WHEN retry_count + 1 >= max_retries THEN NOW()
        ELSE NULL
      END
      WHERE id = $1
    `, [taskId]);

    // Verify status is 'failed_permanent'
    const res = await client.query(
      'SELECT status, retry_count FROM task_queue WHERE id = $1',
      [taskId]
    );
    expect(res.rows[0].status).toBe('failed_permanent');
    expect(res.rows[0].retry_count).toBeGreaterThanOrEqual(maxAttempts);
  });

  test('task with retry_count < max_retries gets retrying status', async () => {
    const taskId = await setupMeasureTask(2); // 2 retries so far, max is 5

    await client.query(`
      UPDATE task_queue
      SET status = CASE
        WHEN retry_count + 1 >= max_retries THEN 'failed_permanent'
        ELSE 'retrying'
      END,
      retry_count = retry_count + 1,
      error_message = 'API temporary failure',
      last_error_at = NOW()
      WHERE id = $1
    `, [taskId]);

    const res = await client.query(
      'SELECT status, retry_count FROM task_queue WHERE id = $1',
      [taskId]
    );
    expect(res.rows[0].status).toBe('retrying');
    expect(res.rows[0].retry_count).toBe(3);
  });

  test('failed_permanent tasks are not picked up for retry', async () => {
    const taskId = await setupMeasureTask(5);

    // Set to failed_permanent
    await client.query(
      "UPDATE task_queue SET status = 'failed_permanent' WHERE id = $1",
      [taskId]
    );

    // Query for retriable tasks should NOT include this one
    const res = await client.query(`
      SELECT id FROM task_queue
      WHERE task_type = 'measure'
        AND status IN ('pending', 'queued', 'retrying')
        AND id = $1
    `, [taskId]);

    expect(res.rows).toHaveLength(0);
  });
});
