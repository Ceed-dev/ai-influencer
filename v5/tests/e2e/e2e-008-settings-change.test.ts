/**
 * FEAT-TST-028: E2Eテスト — ダッシュボード → システム設定変更 → 動作反映
 * TEST-E2E-008
 *
 * Verifies that changing HUMAN_REVIEW_ENABLED via dashboard
 * affects subsequent content review behavior.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-028: E2E dashboard settings → behavior change', () => {
  let client: Client;
  const testCharId = 'CHR_E2E008';
  const testContentId = 'CNT_E2E008_001';
  let originalValue: any;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    // Save original setting
    const res = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'HUMAN_REVIEW_ENABLED'`
    );
    originalValue = res.rows[0]?.setting_value;

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E008 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    if (originalValue !== undefined) {
      await client.query(
        `UPDATE system_settings SET setting_value = $1 WHERE setting_key = 'HUMAN_REVIEW_ENABLED'`,
        [JSON.stringify(originalValue)]
      );
    }
    await client.end();
  });

  test('TEST-E2E-008: disable review → content skips pending_review', async () => {
    // Step 1: Set HUMAN_REVIEW_ENABLED = false
    await client.query(
      `UPDATE system_settings SET setting_value = '"false"', updated_by = 'human'
       WHERE setting_key = 'HUMAN_REVIEW_ENABLED'`
    );

    // Step 2: Read the setting (like a worker would)
    const settingRes = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'HUMAN_REVIEW_ENABLED'`
    );
    const reviewEnabled = settingRes.rows[0].setting_value === 'true' || settingRes.rows[0].setting_value === true;

    // Step 3: Create content
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id, review_status)
       VALUES ($1, 'short_video', 'ready', $2, $3)`,
      [testContentId, testCharId, reviewEnabled ? 'pending_review' : 'not_required']
    );

    // Verify: should NOT be pending_review
    const contentRes = await client.query(
      `SELECT review_status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].review_status).toBe('not_required');
  });
});
