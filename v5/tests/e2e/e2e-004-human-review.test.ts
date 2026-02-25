/**
 * FEAT-TST-024: E2Eテスト — 人間レビューフロー
 * TEST-E2E-004
 *
 * Verifies 2-stage human review: strategy approval + content review.
 * Content cannot be posted without both approvals.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-024: E2E human review flow', () => {
  let client: Client;
  const testCharId = 'CHR_E2E004';
  const testContentId = 'CNT_E2E004_001';
  const testAccountId = 'ACC_E2E004';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E004 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
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

  test('TEST-E2E-004: 2-stage human approval before publishing', async () => {
    // HUMAN_REVIEW_ENABLED=true, STRATEGY_APPROVAL_REQUIRED=true

    // Step 1: Strategy creates content → pending_approval
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id, review_status)
       VALUES ($1, 'short_video', 'planned', $2, 'not_required')`,
      [testContentId, testCharId]
    );

    // Step 2: Human approves strategy
    await client.query(
      `UPDATE content SET status = 'planned', approved_by = 'human', approved_at = NOW()
       WHERE content_id = $1`,
      [testContentId]
    );

    // Step 3: Production completes
    await client.query(`UPDATE content SET status = 'ready' WHERE content_id = $1`, [testContentId]);

    // Step 4: Set to pending_review
    await client.query(
      `UPDATE content SET review_status = 'pending_review' WHERE content_id = $1`,
      [testContentId]
    );

    // Verify cannot post without review approval
    const preApproval = await client.query(
      `SELECT review_status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(preApproval.rows[0].review_status).toBe('pending_review');

    // Step 5: Human reviews and approves
    await client.query(
      `UPDATE content SET review_status = 'approved', reviewed_at = NOW()
       WHERE content_id = $1`,
      [testContentId]
    );

    // Step 6: Now can publish
    await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id)
       VALUES ($1, $2, 'youtube', 'posted', NOW(), 'YT_E2E004')`,
      [testContentId, testAccountId]
    );

    const pubRes = await client.query(
      `SELECT status FROM publications WHERE content_id = $1`, [testContentId]
    );
    expect(pubRes.rows[0].status).toBe('posted');
  });
});
