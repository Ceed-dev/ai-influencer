/**
 * TEST-DSH-031: Human-Agent Dialogue — メッセージ一覧
 * TEST-DSH-032: Human-Agent Dialogue — 返信機能
 * TEST-DSH-076: Agent selection
 * TEST-DSH-096-098: Dialogue features
 * TEST-DSH-130: Directive history
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-023: Human-Agent Dialogue page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/agents/page.tsx');
  let content: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');

    // Seed test communications
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_communications WHERE content LIKE 'TEST_COMM_%'`);

      // Create a cycle first for FK
      await client.query(`INSERT INTO cycles (id, cycle_number, status) VALUES (9901, 9901, 'completed') ON CONFLICT (id) DO NOTHING`);

      await client.query(`
        INSERT INTO agent_communications (agent_type, message_type, priority, content, status, cycle_id)
        VALUES
          ('analyst', 'question', 'high', 'TEST_COMM_1 需要分析', 'unread', 9901),
          ('strategist', 'proposal', 'normal', 'TEST_COMM_2 戦略提案', 'unread', 9901),
          ('researcher', 'status_report', 'low', 'TEST_COMM_3 調査完了', 'responded', 9901)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_communications WHERE content LIKE 'TEST_COMM_%'`);
      await client.query(`DELETE FROM cycles WHERE id = 9901`);
    });
  });

  // TEST-DSH-031: message list
  test('TEST-DSH-031: page displays agent communications', () => {
    expect(content).toContain('agents.tabs.dialogue');
    expect(content).toContain('/api/communications');
  });

  // TEST-DSH-032: reply functionality
  test('TEST-DSH-032: reply UI exists with input and send button', () => {
    expect(content).toContain('agents.enterInstruction');
    expect(content).toContain('common.send');
    expect(content).toContain('human_response');
  });

  // TEST-DSH-076: agent selection panel shows 6 agents (via getAgentLabel/i18n)
  test('TEST-DSH-076: agent selection panel shows 6 agents', () => {
    expect(content).toContain('agents.agentLabels');
    expect(content).toContain('strategist');
    expect(content).toContain('researcher');
    expect(content).toContain('analyst');
    expect(content).toContain('planner');
    expect(content).toContain('tool_specialist');
    expect(content).toContain('data_curator');
  });

  // TEST-DSH-096: agent type filter
  test('TEST-DSH-096: can filter by agent_type', () => {
    expect(content).toContain('agent_type');
    expect(content).toContain('selectedAgent');
  });

  // TEST-DSH-097: message sending
  test('TEST-DSH-097: sends POST to /api/communications', () => {
    expect(content).toContain('POST');
    expect(content).toContain('/api/communications');
    expect(content).toContain('message_type');
  });

  // TEST-DSH-098: status badges
  test('TEST-DSH-098: shows status badges', () => {
    expect(content).toContain('agents.applied');
    expect(content).toContain('agents.pendingStatus');
    expect(content).toContain('data-status');
  });

  // TEST-DSH-130: DB stores communications
  test('TEST-DSH-130: agent_communications stores messages', async () => {
    const result = await query(
      `SELECT * FROM agent_communications WHERE content LIKE 'TEST_COMM_%' ORDER BY created_at ASC`
    );
    expect(result.rows.length).toBe(3);
  });

  test('communications have correct statuses', async () => {
    const unread = await query(
      `SELECT * FROM agent_communications WHERE content LIKE 'TEST_COMM_%' AND status = 'unread'`
    );
    expect(unread.rows.length).toBe(2);

    const responded = await query(
      `SELECT * FROM agent_communications WHERE content LIKE 'TEST_COMM_%' AND status = 'responded'`
    );
    expect(responded.rows.length).toBe(1);
  });

  test('respond to a communication updates status', async () => {
    const msg = await query(
      `SELECT id FROM agent_communications WHERE content = 'TEST_COMM_1 需要分析'`
    );
    const msgId = (msg.rows[0] as Record<string, unknown>).id;

    await query(
      `UPDATE agent_communications SET human_response = 'テスト返信', status = 'responded', human_responded_at = NOW() WHERE id = $1`,
      [msgId]
    );

    const updated = await query(
      `SELECT * FROM agent_communications WHERE id = $1`,
      [msgId]
    );
    expect((updated.rows[0] as Record<string, unknown>).status).toBe('responded');
    expect((updated.rows[0] as Record<string, unknown>).human_response).toBe('テスト返信');
  });
});
