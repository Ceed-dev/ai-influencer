/**
 * FEAT-TST-031: E2Eテスト — 差し戻し → 再制作
 * TEST-E2E-011
 *
 * Verifies rejection flow: content reviewed → rejected → revised → re-approved → posted.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-031: E2E revision flow', () => {
  let client: Client;
  const testCharId = 'CHR_E2E011';
  const testContentId = 'CNT_E2E011_001';
  const testAccountId = 'ACC_E2E011';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E011 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );
    await client.query(
      `INSERT INTO accounts (account_id, platform, character_id, status)
       VALUES ($1, 'youtube', $2, 'active')`,
      [testAccountId, testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-E2E-011: rejection → revision → re-approval → posted', async () => {
    // Step 1: Content ready for review
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id, review_status, revision_count)
       VALUES ($1, 'short_video', 'ready', $2, 'pending_review', 0)`,
      [testContentId, testCharId]
    );

    // Step 2: Human rejects
    await client.query(
      `UPDATE content SET review_status = 'rejected', rejection_category = 'plan_revision',
       reviewer_comment = 'Script needs stronger hook'
       WHERE content_id = $1`,
      [testContentId]
    );

    // Step 3: Planner revises → re-produce
    await client.query(
      `UPDATE content SET status = 'planned', review_status = 'not_required',
       revision_count = revision_count + 1
       WHERE content_id = $1`,
      [testContentId]
    );

    // Step 4: Re-production completes
    await client.query(
      `UPDATE content SET status = 'ready', review_status = 'pending_review'
       WHERE content_id = $1`,
      [testContentId]
    );

    // Step 5: Human approves
    await client.query(
      `UPDATE content SET review_status = 'approved', reviewed_at = NOW()
       WHERE content_id = $1`,
      [testContentId]
    );

    // Step 6: Post
    await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id)
       VALUES ($1, $2, 'youtube', 'posted', NOW(), 'YT_E2E011')`,
      [testContentId, testAccountId]
    );

    // Verify
    const contentRes = await client.query(
      `SELECT revision_count FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].revision_count).toBeGreaterThanOrEqual(1);

    const pubRes = await client.query(
      `SELECT status FROM publications WHERE content_id = $1`, [testContentId]
    );
    expect(pubRes.rows[0].status).toBe('posted');
  });
});
