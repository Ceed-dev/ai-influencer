/**
 * FEAT-TST-020: agent_communications → human_directives 双方向通信
 * TEST-INT-020
 *
 * Verifies bidirectional communication:
 * Agent sends question → Human replies → Agent retrieves response.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-020: bidirectional agent ↔ human communication', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM agent_communications WHERE message LIKE '%INT020%'`);
    await client.query(`DELETE FROM human_directives WHERE content LIKE '%INT020%'`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM agent_communications WHERE message LIKE '%INT020%'`);
    await client.query(`DELETE FROM human_directives WHERE content LIKE '%INT020%'`);
    await client.end();
  });

  test('TEST-INT-020: agent question → human reply → agent retrieves', async () => {
    // Step 1: Agent sends question
    const msgRes = await client.query(
      `INSERT INTO agent_communications (sender, receiver, message, message_type, status)
       VALUES ('analyst', 'human', 'INT020: Should we prioritize beauty or tech niche?', 'question', 'pending')
       RETURNING id`
    );
    const msgId = msgRes.rows[0].id;

    // Step 2: Human replies via directive
    const dirRes = await client.query(
      `INSERT INTO human_directives (directive_type, content, priority, status)
       VALUES ('response', 'INT020: Focus on beauty niche for Q1', 'medium', 'pending')
       RETURNING id`
    );
    const dirId = dirRes.rows[0].id;

    // Step 3: Mark agent message as responded
    await client.query(
      `UPDATE agent_communications SET status = 'responded' WHERE id = $1`,
      [msgId]
    );

    // Step 4: Agent retrieves response
    const responseRes = await client.query(
      `SELECT content, status FROM human_directives WHERE id = $1`, [dirId]
    );
    expect(responseRes.rows[0].content).toContain('beauty niche');

    // Verify bidirectional flow completed
    const agentMsgRes = await client.query(
      `SELECT status FROM agent_communications WHERE id = $1`, [msgId]
    );
    expect(agentMsgRes.rows[0].status).toBe('responded');
  });
});
