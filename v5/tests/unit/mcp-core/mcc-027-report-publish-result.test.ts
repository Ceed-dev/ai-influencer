/**
 * TEST-MCP-054: report_publish_result -- normal case
 * FEAT-MCC-027: report_publish_result
 */
import { Pool } from 'pg';
import { reportPublishResult } from '@/src/mcp-server/tools/publishing/report-publish-result';
import { McpValidationError } from '@/src/mcp-server/errors';

const TEST_DB_URL = 'postgres://dev:dev@localhost:5433/dev_ai_influencer';
const PREFIX = 'PUB_TEST_027_';

describe('FEAT-MCC-027: report_publish_result', () => {
  let pool: Pool;
  let taskId: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL });

    // Seed: character -> account -> content -> publication -> task_queue
    await pool.query(`
      INSERT INTO characters (character_id, name, voice_id, appearance, status)
      VALUES ('${PREFIX}CHR_001', 'Test Char', 'abc123def456abc123def456abc12345', '{"style":"anime"}', 'active')
      ON CONFLICT (character_id) DO NOTHING
    `);

    await pool.query(`
      INSERT INTO accounts (account_id, platform, status, follower_count, monetization_status, character_id, niche, cluster)
      VALUES ('${PREFIX}ACC_001', 'youtube', 'active', 1000, 'none', '${PREFIX}CHR_001', 'beauty', 'cluster_pub027')
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

    const taskRes = await pool.query<{ id: number }>(
      `INSERT INTO task_queue (task_type, payload, status, priority)
       VALUES ('publish', '{"content_id": "${PREFIX}CNT_001"}'::jsonb, 'processing', 10)
       RETURNING id`,
    );
    const row = taskRes.rows[0];
    if (!row) throw new Error('Failed to seed task_queue');
    taskId = row.id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM task_queue WHERE payload->>'content_id' LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM prediction_snapshots WHERE publication_id IN (SELECT id FROM publications WHERE content_id LIKE '${PREFIX}%')`);
    await pool.query(`DELETE FROM publications WHERE content_id LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM account_baselines WHERE account_id LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
    await pool.query(`DELETE FROM characters WHERE character_id LIKE '${PREFIX}%'`);
    await pool.end();
  });

  // TEST-MCP-054: normal case
  test('TEST-MCP-054: updates task_queue and publications correctly', async () => {
    const result = await reportPublishResult({
      task_id: taskId,
      content_id: `${PREFIX}CNT_001`,
      platform_post_id: 'yt_abc123',
      post_url: 'https://youtube.com/shorts/yt_abc123',
      posted_at: '2026-03-15T10:00:00Z',
    });

    expect(result).toEqual({ success: true });

    // Verify task_queue is completed
    const taskRes = await pool.query(
      `SELECT status, completed_at FROM task_queue WHERE id = $1`,
      [taskId],
    );
    expect(taskRes.rows[0]?.status).toBe('completed');
    expect(taskRes.rows[0]?.completed_at).not.toBeNull();

    // Verify publications updated
    const pubRes = await pool.query(
      `SELECT status, platform_post_id, post_url, posted_at FROM publications WHERE content_id = $1`,
      [`${PREFIX}CNT_001`],
    );
    expect(pubRes.rows[0]?.status).toBe('posted');
    expect(pubRes.rows[0]?.platform_post_id).toBe('yt_abc123');
    expect(pubRes.rows[0]?.post_url).toBe('https://youtube.com/shorts/yt_abc123');
    expect(pubRes.rows[0]?.posted_at).not.toBeNull();
  });

  // Validation tests
  test('TEST-MCP-054: rejects invalid task_id', async () => {
    await expect(
      reportPublishResult({
        task_id: 0,
        content_id: `${PREFIX}CNT_001`,
        platform_post_id: 'abc',
        post_url: 'https://example.com',
        posted_at: '2026-03-15T10:00:00Z',
      }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      reportPublishResult({
        task_id: -1,
        content_id: `${PREFIX}CNT_001`,
        platform_post_id: 'abc',
        post_url: 'https://example.com',
        posted_at: '2026-03-15T10:00:00Z',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-054: rejects empty content_id', async () => {
    await expect(
      reportPublishResult({
        task_id: 1,
        content_id: '',
        platform_post_id: 'abc',
        post_url: 'https://example.com',
        posted_at: '2026-03-15T10:00:00Z',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-054: rejects empty platform_post_id', async () => {
    await expect(
      reportPublishResult({
        task_id: 1,
        content_id: 'CNT_001',
        platform_post_id: '',
        post_url: 'https://example.com',
        posted_at: '2026-03-15T10:00:00Z',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-054: rejects empty posted_at', async () => {
    await expect(
      reportPublishResult({
        task_id: 1,
        content_id: 'CNT_001',
        platform_post_id: 'abc',
        post_url: 'https://example.com',
        posted_at: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
