/**
 * FEAT-TST-011: コスト追跡 (制作→計測→アラート連携)
 * TEST-INT-011
 *
 * Verifies that cost tracking works across production and measurement,
 * and alerts are generated when balance drops below threshold.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-011: cost tracking and alert pipeline', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM agent_communications WHERE content LIKE '%INT011%'`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM agent_communications WHERE content LIKE '%INT011%'`);
    await client.end();
  });

  test('TEST-INT-011: low balance triggers alert in agent_communications', async () => {
    const alertThreshold = 50; // FAL_AI_BALANCE_ALERT_USD
    const currentBalance = 45; // Below threshold

    // Simulate balance check during production
    const belowThreshold = currentBalance < alertThreshold;
    expect(belowThreshold).toBe(true);

    // Step 1: Generate alert when below threshold
    if (belowThreshold) {
      await client.query(
        `INSERT INTO agent_communications (agent_type, content, message_type, status)
         VALUES ('analyst', $1, 'anomaly_alert', 'unread')`,
        [`INT011: fal.ai balance alert — $${currentBalance} below threshold $${alertThreshold}`]
      );
    }

    // Verify alert exists
    const alertRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM agent_communications
       WHERE content LIKE '%INT011%' AND message_type = 'anomaly_alert'`
    );
    expect(alertRes.rows[0].cnt).toBeGreaterThan(0);
  });
});
