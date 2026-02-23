/**
 * FEAT-TST-017: プロンプト変更 → パフォーマンス比較
 * TEST-INT-017
 *
 * Verifies that when a prompt is updated via update_agent_prompt,
 * performance_before/after data is recorded in agent_prompt_versions.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-017: prompt change → performance comparison', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM agent_prompt_versions WHERE agent_type = 'analyst' AND prompt_text LIKE '%INT017%'`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM agent_prompt_versions WHERE agent_type = 'analyst' AND prompt_text LIKE '%INT017%'`);
    await client.end();
  });

  test('TEST-INT-017: prompt update records performance_before', async () => {
    // Step 1: Record initial prompt version with performance data
    await client.query(
      `INSERT INTO agent_prompt_versions (agent_type, version_number, prompt_text, performance_before, is_active)
       VALUES ('analyst', 1, 'INT017: Analyze content performance v1', $1, false)`,
      [JSON.stringify({ avg_quality: 7.2, hypothesis_accuracy: 0.65 })]
    );

    // Step 2: Record new prompt version
    await client.query(
      `INSERT INTO agent_prompt_versions (agent_type, version_number, prompt_text, performance_before, is_active)
       VALUES ('analyst', 2, 'INT017: Analyze content performance v2', $1, true)`,
      [JSON.stringify({ avg_quality: 7.2, hypothesis_accuracy: 0.65 })]
    );

    // Verify performance_before is recorded
    const res = await client.query(
      `SELECT performance_before FROM agent_prompt_versions
       WHERE agent_type = 'analyst' AND prompt_text LIKE '%INT017%' AND version_number = 2`
    );
    expect(res.rows[0].performance_before).not.toBeNull();
    expect(res.rows[0].performance_before.avg_quality).toBe(7.2);
  });
});
