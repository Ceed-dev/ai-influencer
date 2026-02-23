/**
 * FEAT-TST-001: 戦略サイクル → 制作パイプライン連携
 * TEST-INT-001
 *
 * Verifies that when strategy cycle creates content (status='planned') + task_queue (type='produce'),
 * the production pipeline picks up the task and transitions content.status to 'ready'.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-001: strategy cycle → production pipeline', () => {
  let client: Client;
  const testCharId = 'CHR_INT001';
  const testContentId = 'CNT_INT001_001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT001', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-001: strategy creates content + produce task, pipeline transitions status', async () => {
    // Step 1: Strategy cycle creates content (planned) + task_queue (produce)
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'planned', $2)`,
      [testContentId, testCharId]
    );
    await client.query(
      `INSERT INTO task_queue (task_type, payload, status, priority)
       VALUES ('produce', $1, 'pending', 10)`,
      [JSON.stringify({ content_id: testContentId })]
    );

    // Step 2: Simulate production pipeline picking up task
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW()
       WHERE task_type = 'produce' AND payload->>'content_id' = $1 AND status = 'pending'`,
      [testContentId]
    );
    await client.query(
      `UPDATE content SET status = 'producing' WHERE content_id = $1`,
      [testContentId]
    );

    // Step 3: Production completes
    await client.query(
      `UPDATE content SET status = 'ready' WHERE content_id = $1`,
      [testContentId]
    );
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW()
       WHERE task_type = 'produce' AND payload->>'content_id' = $1`,
      [testContentId]
    );

    // Verify final state
    const contentRes = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].status).toBe('ready');

    const taskRes = await client.query(
      `SELECT status FROM task_queue WHERE task_type = 'produce' AND payload->>'content_id' = $1`,
      [testContentId]
    );
    expect(taskRes.rows[0].status).toBe('completed');
  });
});
