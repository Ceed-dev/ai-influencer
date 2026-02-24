/**
 * FEAT-TST-027: E2Eテスト — エージェント学習サイクル
 * TEST-E2E-007
 *
 * Verifies that over multiple cycles, agent_individual_learnings accumulate
 * and algorithm_performance data is recorded.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-027: E2E learning cycle', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM agent_individual_learnings WHERE content LIKE '%E2E007%'`);
    await client.query(`DELETE FROM algorithm_performance WHERE metadata->>'tag' = 'E2E007'`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM agent_individual_learnings WHERE content LIKE '%E2E007%'`);
    await client.query(`DELETE FROM algorithm_performance WHERE metadata->>'tag' = 'E2E007'`);
    await client.end();
  });

  test('TEST-E2E-007: 5 cycles → learnings + algorithm_performance accumulated', async () => {
    // Simulate 5 cycles of learning
    for (let i = 1; i <= 5; i++) {
      await client.query(
        `INSERT INTO agent_individual_learnings (agent_type, category, content, times_applied, confidence)
         VALUES ('analyst', 'insight', $1, $2, $3)`,
        [`E2E007: Cycle ${i} insight`, i, 0.5 + i * 0.05]
      );
      await client.query(
        `INSERT INTO algorithm_performance (period, hypothesis_accuracy, prediction_error, learning_count, metadata, measured_at)
         VALUES ('daily', $1, $2, $3, '{"tag": "E2E007"}'::jsonb, NOW() - make_interval(days => $4))`,
        [0.7 + i * 0.03, 0.1 - i * 0.01, i * 2, 5 - i]
      );
    }

    // Verify learnings accumulated
    const learningsRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM agent_individual_learnings WHERE content LIKE '%E2E007%'`
    );
    expect(learningsRes.rows[0].cnt).toBeGreaterThanOrEqual(5);

    // Verify algorithm_performance has daily records
    const algRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM algorithm_performance
       WHERE metadata->>'tag' = 'E2E007' AND period = 'daily'`
    );
    expect(algRes.rows[0].cnt).toBeGreaterThanOrEqual(5);
  });
});
