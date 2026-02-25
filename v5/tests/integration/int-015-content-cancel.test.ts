/**
 * FEAT-TST-015: コンテンツキャンセル (全ステージからの遷移)
 * TEST-INT-015
 *
 * Verifies that content can be cancelled from any active status:
 * producing, ready, pending_review → cancelled.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-015: content cancellation from all stages', () => {
  let client: Client;
  const testCharId = 'CHR_INT015';
  const contentIds = ['CNT_INT015_01', 'CNT_INT015_02', 'CNT_INT015_03'];

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    for (const id of contentIds) {
      await client.query(`DELETE FROM content WHERE content_id = $1`, [id]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT015', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );

    // Create content at different stages
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id) VALUES ($1, 'short_video', 'producing', $2)`,
      [contentIds[0], testCharId]
    );
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id) VALUES ($1, 'short_video', 'ready', $2)`,
      [contentIds[1], testCharId]
    );
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id, review_status) VALUES ($1, 'short_video', 'ready', $2, 'pending_review')`,
      [contentIds[2], testCharId]
    );
  });

  afterAll(async () => {
    for (const id of contentIds) {
      await client.query(`DELETE FROM content WHERE content_id = $1`, [id]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-015: cancel from producing', async () => {
    await client.query(`UPDATE content SET status = 'cancelled' WHERE content_id = $1`, [contentIds[0]]);
    const res = await client.query(`SELECT status FROM content WHERE content_id = $1`, [contentIds[0]]);
    expect(res.rows[0].status).toBe('cancelled');
  });

  test('TEST-INT-015: cancel from ready', async () => {
    await client.query(`UPDATE content SET status = 'cancelled' WHERE content_id = $1`, [contentIds[1]]);
    const res = await client.query(`SELECT status FROM content WHERE content_id = $1`, [contentIds[1]]);
    expect(res.rows[0].status).toBe('cancelled');
  });

  test('TEST-INT-015: cancel from pending_review', async () => {
    await client.query(`UPDATE content SET status = 'cancelled' WHERE content_id = $1`, [contentIds[2]]);
    const res = await client.query(`SELECT status FROM content WHERE content_id = $1`, [contentIds[2]]);
    expect(res.rows[0].status).toBe('cancelled');
  });
});
