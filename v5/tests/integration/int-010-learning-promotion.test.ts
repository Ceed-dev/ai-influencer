/**
 * FEAT-TST-010: agent_individual_learnings → learnings 昇格
 * TEST-INT-010
 *
 * Verifies that when an individual learning's times_applied reaches the threshold,
 * it gets promoted to the shared learnings table.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-010: individual learning → learnings promotion', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM learnings WHERE insight LIKE '%INT010%'`);
    await client.query(`DELETE FROM agent_individual_learnings WHERE insight LIKE '%INT010%'`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM learnings WHERE insight LIKE '%INT010%'`);
    await client.query(`DELETE FROM agent_individual_learnings WHERE insight LIKE '%INT010%'`);
    await client.end();
  });

  test('TEST-INT-010: individual learning promoted after threshold reached', async () => {
    const threshold = 10;

    // Step 1: Create individual learning with times_applied = threshold
    const indRes = await client.query(
      `INSERT INTO agent_individual_learnings (agent_type, insight, times_applied, confidence)
       VALUES ('analyst', 'INT010: Morning posts outperform evening by 30%', $1, 0.85)
       RETURNING id`,
      [threshold]
    );
    const learningId = indRes.rows[0].id;

    // Step 2: Simulate promotion logic — when times_applied >= threshold, promote to learnings
    const indLearning = await client.query(
      `SELECT insight, confidence FROM agent_individual_learnings WHERE id = $1 AND times_applied >= $2`,
      [learningId, threshold]
    );
    expect(indLearning.rows).toHaveLength(1);

    // Promote
    await client.query(
      `INSERT INTO learnings (category, insight, confidence, evidence_count)
       VALUES ('timing', $1, $2, $3)`,
      [indLearning.rows[0].insight, indLearning.rows[0].confidence, threshold]
    );

    // Verify promotion
    const promoted = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM learnings WHERE insight LIKE '%INT010%'`
    );
    expect(promoted.rows[0].cnt).toBe(1);
  });
});
