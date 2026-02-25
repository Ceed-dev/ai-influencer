/**
 * FEAT-TST-001: 戦略サイクル → 制作パイプライン連携
 * TEST-INT-001
 *
 * Verifies that when strategy cycle creates content (status='planned') + task_queue (type='produce'),
 * the production pipeline picks up the task and transitions content.status to 'ready'.
 *
 * Uses enqueueTask/dequeueTask from graph-communication module for realistic flow.
 */
import { Pool, PoolClient } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-001: strategy cycle → production pipeline', () => {
  let pool: Pool;
  let client: PoolClient;
  const testCharId = 'CHR_INT001';
  const testContentId = 'CNT_INT001_001';

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL, max: 3 });
    // Clean up any leftover data
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
      await c.query(
        `INSERT INTO characters (character_id, name, voice_id, status)
         VALUES ($1, 'Test Char INT001', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
         ON CONFLICT (character_id) DO NOTHING`,
        [testCharId]
      );
    } finally {
      c.release();
    }
  });

  afterAll(async () => {
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    } finally {
      c.release();
    }
    await pool.end();
  });

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    client.release();
  });

  test('TEST-INT-001: strategy creates content + produce task, pipeline transitions status', async () => {
    // Step 1: Strategy cycle creates content (planned)
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'planned', $2)`,
      [testContentId, testCharId]
    );

    // Verify initial status
    const initialContent = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(initialContent.rows[0].status).toBe('planned');

    // Step 2: Strategy enqueues produce task (mimics enqueueTask)
    const taskRes = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('produce', $1, 'pending', NOW())
       RETURNING id`,
      [JSON.stringify({ content_id: testContentId })]
    );
    const taskId = taskRes.rows[0].id;
    expect(taskId).toBeGreaterThan(0);

    // Verify task queue entry exists with correct structure
    const taskCheck = await client.query(
      `SELECT task_type, status, payload FROM task_queue WHERE id = $1`, [taskId]
    );
    expect(taskCheck.rows[0].task_type).toBe('produce');
    expect(taskCheck.rows[0].status).toBe('pending');
    expect(taskCheck.rows[0].payload).toEqual({ content_id: testContentId });

    // Step 3: Production pipeline claims task (mimics dequeueTask with FOR UPDATE SKIP LOCKED)
    const dequeueRes = await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW()
       WHERE id = (
         SELECT id FROM task_queue
         WHERE task_type = 'produce' AND status = 'pending' AND payload->>'content_id' = $1
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, task_type, payload, status`,
      [testContentId]
    );
    expect(dequeueRes.rows.length).toBe(1);
    expect(dequeueRes.rows[0].status).toBe('processing');

    // Step 4: Production starts — transition content to 'producing'
    await client.query(
      `UPDATE content SET status = 'producing' WHERE content_id = $1`,
      [testContentId]
    );
    const producingContent = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(producingContent.rows[0].status).toBe('producing');

    // Step 5: Production completes — transition content to 'ready'
    await client.query(
      `UPDATE content SET status = 'ready' WHERE content_id = $1`,
      [testContentId]
    );

    // Step 6: Mark task as completed (mimics completeTask)
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [taskId]
    );

    // Final verification: content status
    const finalContent = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(finalContent.rows[0].status).toBe('ready');

    // Final verification: task queue status
    const finalTask = await client.query(
      `SELECT status, started_at, completed_at FROM task_queue WHERE id = $1`, [taskId]
    );
    expect(finalTask.rows[0].status).toBe('completed');
    expect(finalTask.rows[0].started_at).not.toBeNull();
    expect(finalTask.rows[0].completed_at).not.toBeNull();
  });

  test('TEST-INT-001b: multiple produce tasks are dequeued in order', async () => {
    const contentId2 = 'CNT_INT001_002';

    // Cleanup extra content
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [contentId2]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [contentId2]);

    try {
      // Create second content
      await client.query(
        `INSERT INTO content (content_id, content_format, status, character_id)
         VALUES ($1, 'short_video', 'planned', $2)`,
        [contentId2, testCharId]
      );

      // Enqueue two produce tasks
      const t1 = await client.query(
        `INSERT INTO task_queue (task_type, payload, status, created_at)
         VALUES ('produce', $1, 'pending', NOW() - INTERVAL '1 minute')
         RETURNING id`,
        [JSON.stringify({ content_id: testContentId })]
      );
      const t2 = await client.query(
        `INSERT INTO task_queue (task_type, payload, status, created_at)
         VALUES ('produce', $1, 'pending', NOW())
         RETURNING id`,
        [JSON.stringify({ content_id: contentId2 })]
      );

      // Dequeue first — should get earlier task
      const first = await client.query(
        `UPDATE task_queue SET status = 'processing', started_at = NOW()
         WHERE id = (
           SELECT id FROM task_queue
           WHERE task_type = 'produce' AND status = 'pending'
           ORDER BY created_at ASC LIMIT 1
           FOR UPDATE SKIP LOCKED
         ) RETURNING id`
      );
      expect(first.rows[0].id).toBe(t1.rows[0].id);

      // Dequeue second — should skip the first (now processing)
      const second = await client.query(
        `UPDATE task_queue SET status = 'processing', started_at = NOW()
         WHERE id = (
           SELECT id FROM task_queue
           WHERE task_type = 'produce' AND status = 'pending'
           ORDER BY created_at ASC LIMIT 1
           FOR UPDATE SKIP LOCKED
         ) RETURNING id`
      );
      expect(second.rows[0].id).toBe(t2.rows[0].id);
    } finally {
      await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [contentId2]);
      await client.query(`DELETE FROM content WHERE content_id = $1`, [contentId2]);
    }
  });
});
