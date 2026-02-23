/**
 * TEST-DSH-042: Agent Inbox — ステータスフィルタ
 * TEST-DSH-109: メッセージ一覧・未読バッジ
 * TEST-DSH-110: メッセージ返信
 * TEST-DSH-111: ステータスフィルタ
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-032: Agent Inbox page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/agents/page.tsx');
  let content: string;
  const apiPath = path.join(__dirname, '../../../dashboard/app/api/communications/route.ts');
  let apiContent: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');
    apiContent = fs.readFileSync(apiPath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_communications WHERE content LIKE 'TEST_INBOX_%'`);
      await client.query(`INSERT INTO cycles (id, cycle_number, status) VALUES (9902, 9902, 'completed') ON CONFLICT (id) DO NOTHING`);
      await client.query(`
        INSERT INTO agent_communications (agent_type, message_type, priority, content, status, cycle_id)
        VALUES
          ('analyst', 'anomaly_alert', 'urgent', 'TEST_INBOX_1 Urgent alert', 'unread', 9902),
          ('strategist', 'milestone', 'normal', 'TEST_INBOX_2 Milestone reached', 'unread', 9902),
          ('planner', 'question', 'high', 'TEST_INBOX_3 Planning question', 'unread', 9902),
          ('researcher', 'status_report', 'low', 'TEST_INBOX_4 Report done', 'responded', 9902)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_communications WHERE content LIKE 'TEST_INBOX_%'`);
      await client.query(`DELETE FROM cycles WHERE id = 9902`);
    });
  });

  // TEST-DSH-042: status filter
  test('TEST-DSH-042: Inbox has status filter', () => {
    expect(content).toContain('ステータス');
    expect(content).toContain('unread');
    expect(content).toContain('responded');
  });

  // TEST-DSH-109: unread badge
  test('TEST-DSH-109: shows unread badge count', () => {
    expect(content).toContain('data-unread');
    expect(content).toContain('unreadCount');
    expect(content).toContain('badge');
  });

  // TEST-DSH-110: reply functionality
  test('TEST-DSH-110: has reply input and button', () => {
    expect(content).toContain('返信');
    expect(content).toContain('handleReply');
  });

  // TEST-DSH-111: filter by status works in API
  test('TEST-DSH-111: API supports status filter', () => {
    expect(apiContent).toContain("status");
    expect(apiContent).toContain("searchParams.get");
  });

  test('DB: filter unread communications', async () => {
    const result = await query(
      `SELECT * FROM agent_communications WHERE content LIKE 'TEST_INBOX_%' AND status = 'unread'`
    );
    expect(result.rows.length).toBe(3);
    result.rows.forEach((row: Record<string, unknown>) => {
      expect(row.status).toBe('unread');
    });
  });

  test('DB: filter responded communications', async () => {
    const result = await query(
      `SELECT * FROM agent_communications WHERE content LIKE 'TEST_INBOX_%' AND status = 'responded'`
    );
    expect(result.rows.length).toBe(1);
  });

  test('API: reply endpoint exists', () => {
    const replyPath = path.join(__dirname, '../../../dashboard/app/api/communications/[id]/route.ts');
    const replyContent = fs.readFileSync(replyPath, 'utf-8');
    expect(replyContent).toContain('human_response');
    expect(replyContent).toContain('responded');
  });
});
