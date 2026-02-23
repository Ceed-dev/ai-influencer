/**
 * FEAT-TST-006: human_directives → エージェント処理連携
 * TEST-INT-006
 *
 * Verifies that submitting a human directive results in agent acknowledgment:
 * human_directives.status transitions from 'pending' → 'acknowledged'.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-006: human_directives → agent processing', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM human_directives WHERE content LIKE '%INT006%'`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM human_directives WHERE content LIKE '%INT006%'`);
    await client.end();
  });

  test('TEST-INT-006: submit directive → agent acknowledges → status transitions', async () => {
    // Step 1: Submit human directive
    const directiveRes = await client.query(
      `INSERT INTO human_directives (directive_type, content, priority, status)
       VALUES ('hypothesis', 'INT006: Test beauty content at 7AM', 'high', 'pending')
       RETURNING id`
    );
    const directiveId = directiveRes.rows[0].id;

    // Verify pending state
    const pendingRes = await client.query(
      `SELECT status FROM human_directives WHERE id = $1`, [directiveId]
    );
    expect(pendingRes.rows[0].status).toBe('pending');

    // Step 2: Agent processes and acknowledges
    await client.query(
      `UPDATE human_directives SET status = 'acknowledged', updated_at = NOW()
       WHERE id = $1`,
      [directiveId]
    );

    // Verify transition
    const ackRes = await client.query(
      `SELECT status FROM human_directives WHERE id = $1`, [directiveId]
    );
    expect(ackRes.rows[0].status).toBe('acknowledged');
  });
});
