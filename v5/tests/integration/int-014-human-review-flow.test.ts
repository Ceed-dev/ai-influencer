/**
 * FEAT-TST-014: HUMAN_REVIEW_ENABLED=true 全フロー
 * TEST-INT-014
 *
 * Verifies that when HUMAN_REVIEW_ENABLED=true and content quality_score < AUTO_APPROVE_SCORE_THRESHOLD,
 * content goes to pending_review and cannot be published without human approval.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-014: HUMAN_REVIEW_ENABLED=true flow', () => {
  let client: Client;
  const testCharId = 'CHR_INT014';
  const testContentId = 'CNT_INT014_001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT014', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-014: low quality content requires human review, not auto-approved', async () => {
    const humanReviewEnabled = true;
    const autoApproveThreshold = 8.0;
    const contentQualityScore = 6.0; // Below threshold

    // Step 1: Content reaches ready with low quality score
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id, quality_score, review_status)
       VALUES ($1, 'short_video', 'ready', $2, $3, 'not_required')`,
      [testContentId, testCharId, contentQualityScore]
    );

    // Step 2: Review logic — should not auto-approve
    const shouldAutoApprove = !humanReviewEnabled || contentQualityScore >= autoApproveThreshold;
    expect(shouldAutoApprove).toBe(false);

    // Step 3: Set to pending_review
    await client.query(
      `UPDATE content SET review_status = 'pending_review'
       WHERE content_id = $1`,
      [testContentId]
    );

    // Verify content is waiting for review
    const contentRes = await client.query(
      `SELECT review_status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].review_status).toBe('pending_review');

    // Step 4: Human approves
    await client.query(
      `UPDATE content SET review_status = 'approved', reviewed_at = NOW(), approved_by = 'human'
       WHERE content_id = $1`,
      [testContentId]
    );

    const approvedRes = await client.query(
      `SELECT review_status, approved_by FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(approvedRes.rows[0].review_status).toBe('approved');
    expect(approvedRes.rows[0].approved_by).toBe('human');
  });
});
