/**
 * TEST-MCP-049: get_publish_task -- normal case
 * FEAT-MCC-025: get_publish_task
 */
import { Pool } from 'pg';
import { getPublishTask } from '@/src/mcp-server/tools/publishing/get-publish-task';

const TEST_DB_URL = 'postgres://dev:dev@localhost:5433/dev_ai_influencer';
const PREFIX = 'PUB_TEST_025_';

describe('FEAT-MCC-025: get_publish_task', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL });

    // Seed test data: character -> account -> content -> publication -> task_queue
    await pool.query(`
      INSERT INTO characters (character_id, name, voice_id, appearance, status)
      VALUES ('${PREFIX}CHR_001', 'Test Char', 'abc123def456abc123def456abc12345', '{"style":"anime"}', 'active')
      ON CONFLICT (character_id) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO accounts (account_id, platform, status, follower_count, monetization_status, character_id, niche, cluster)
      VALUES ('${PREFIX}ACC_001', 'youtube', 'active', 1000, 'none', '${PREFIX}CHR_001', 'beauty', 'cluster_a')
      ON CONFLICT (account_id) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO content (content_id, character_id, content_format, status)
      VALUES ('${PREFIX}CNT_001', '${PREFIX}CHR_001', 'short_video', 'ready')
      ON CONFLICT (content_id) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO publications (content_id, account_id, platform, status)
      VALUES ('${PREFIX}CNT_001', '${PREFIX}ACC_001', 'youtube', 'scheduled')
      ON CONFLICT DO NOTHING
    `);

    await pool.query(`
      INSERT INTO task_queue (task_type, payload, status, priority)
      VALUES ('publish', '{"content_id": "${PREFIX}CNT_001"}'::jsonb, 'pending', 10)
    `);
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await pool.query(`DELETE FROM task_queue WHERE payload->>'content_id' LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM publications WHERE content_id LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM characters WHERE character_id LIKE '${PREFIX}%'`);
    await pool.end();
  });

  // TEST-MCP-049: normal case - returns task with correct structure
  test('TEST-MCP-049: returns publish task with required fields', async () => {
    const result = await getPublishTask({});

    // Should return a task (not null) since we seeded one
    expect(result).not.toBeNull();
    if (result === null) return; // type guard

    expect(typeof result.task_id).toBe('number');
    expect(result.task_id).toBeGreaterThan(0);
    expect(typeof result.content_id).toBe('string');
    expect(result.content_id).toBe(`${PREFIX}CNT_001`);
    expect(['youtube', 'tiktok', 'instagram', 'x']).toContain(result.platform);
    expect(result.platform).toBe('youtube');
    expect(typeof result.payload).toBe('object');
    expect(result.payload['content_id']).toBe(`${PREFIX}CNT_001`);
  });

  test('TEST-MCP-049: marks task as processing after retrieval', async () => {
    // The task was already retrieved in previous test, check it's processing
    const res = await pool.query(
      `SELECT status, started_at FROM task_queue WHERE payload->>'content_id' = $1 AND status = 'processing'`,
      [`${PREFIX}CNT_001`],
    );

    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const row = res.rows[0];
    expect(row?.status).toBe('processing');
    expect(row?.started_at).not.toBeNull();
  });

  test('TEST-MCP-049: returns null when queue is empty', async () => {
    // Clean up all pending tasks
    await pool.query(`UPDATE task_queue SET status = 'completed' WHERE payload->>'content_id' LIKE '${PREFIX}%'`);

    const result = await getPublishTask({});
    expect(result).toBeNull();
  });
});
