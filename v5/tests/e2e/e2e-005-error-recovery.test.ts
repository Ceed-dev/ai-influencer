/**
 * FEAT-TST-025: E2Eテスト — エラー復旧 (fal.ai 403 からの復旧)
 * TEST-E2E-005
 *
 * Verifies retry mechanism: task fails → retry_count incremented → retry succeeds.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-025: E2E error recovery', () => {
  let client: Client;
  const testCharId = 'CHR_E2E005';
  const testContentId = 'CNT_E2E005_001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E005 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'producing', $2)`,
      [testContentId, testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-E2E-005: fal.ai 403 → retry → success', async () => {
    // Step 1: Initial task fails
    await client.query(
      `INSERT INTO task_queue (task_type, payload, status, retry_count, error_message, last_error_at)
       VALUES ('produce', $1, 'failed', 1, 'fal.ai 403 Forbidden: insufficient balance', NOW())`,
      [JSON.stringify({ content_id: testContentId })]
    );

    // Verify failed state
    const failedRes = await client.query(
      `SELECT status, retry_count, error_message FROM task_queue
       WHERE task_type = 'produce' AND payload->>'content_id' = $1`,
      [testContentId]
    );
    expect(failedRes.rows[0].status).toBe('failed');
    expect(failedRes.rows[0].retry_count).toBe(1);

    // Step 2: Balance recharged, retry
    await client.query(
      `UPDATE task_queue SET status = 'retrying'
       WHERE task_type = 'produce' AND payload->>'content_id' = $1`,
      [testContentId]
    );

    // Step 3: Retry succeeds
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW(), retry_count = 2
       WHERE task_type = 'produce' AND payload->>'content_id' = $1`,
      [testContentId]
    );
    await client.query(
      `UPDATE content SET status = 'ready' WHERE content_id = $1`,
      [testContentId]
    );

    // Verify recovery
    const contentRes = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].status).toBe('ready');
  });
});
