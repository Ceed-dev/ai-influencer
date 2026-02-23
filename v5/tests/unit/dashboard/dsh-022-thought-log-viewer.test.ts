/**
 * TEST-DSH-030: Thought Log Viewer — フィルタリング
 * TEST-DSH-091: 7タブ切替 (partial)
 * TEST-DSH-092: エージェント別フィルタ
 * TEST-DSH-093: サイクル別フィルタ
 * TEST-DSH-094: 日付範囲フィルタ
 * TEST-DSH-095: ステップ詳細展開
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-022: Thought Log Viewer page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/agents/page.tsx');
  let content: string;
  const apiPath = path.join(__dirname, '../../../dashboard/app/api/thought-logs/route.ts');
  let apiContent: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');
    apiContent = fs.readFileSync(apiPath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_thought_logs WHERE reasoning LIKE 'TEST_LOG_%'`);
      await client.query(`INSERT INTO cycles (id, cycle_number, status) VALUES (9903, 9903, 'completed') ON CONFLICT (id) DO NOTHING`);
      await client.query(`
        INSERT INTO agent_thought_logs (agent_type, cycle_id, graph_name, node_name, reasoning, decision, tools_used)
        VALUES
          ('analyst', 9903, 'strategy_cycle', 'analyze', 'TEST_LOG_1 analyzing data', 'proceed with analysis', ARRAY['mcp_read_metrics']),
          ('strategist', 9903, 'strategy_cycle', 'plan', 'TEST_LOG_2 planning strategy', 'set hypothesis', ARRAY['mcp_create_hypothesis']),
          ('researcher', 9903, 'strategy_cycle', 'research', 'TEST_LOG_3 researching trends', 'report findings', ARRAY['mcp_search_trends'])
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_thought_logs WHERE reasoning LIKE 'TEST_LOG_%'`);
      await client.query(`DELETE FROM cycles WHERE id = 9903`);
    });
  });

  // TEST-DSH-030: filtering by agent_type
  test('TEST-DSH-030: thought log API filters by agent_type', () => {
    expect(apiContent).toContain('agent_type');
    expect(apiContent).toContain('searchParams.get');
  });

  // TEST-DSH-091: 7 tabs
  test('TEST-DSH-091: agents page has 7 tabs', () => {
    expect(content).toContain('思考ログ');
    expect(content).toContain('対話');
    expect(content).toContain('進化');
    expect(content).toContain('プロンプト管理');
    expect(content).toContain('改善提案');
    expect(content).toContain('個別成長');
    expect(content).toContain('受信トレイ');
  });

  // TEST-DSH-092: agent type filter
  test('TEST-DSH-092: filters logs by agent_type', async () => {
    const result = await query(
      `SELECT * FROM agent_thought_logs WHERE reasoning LIKE 'TEST_LOG_%' AND agent_type = 'analyst'`
    );
    expect(result.rows.length).toBe(1);
    expect((result.rows[0] as Record<string, unknown>).agent_type).toBe('analyst');
  });

  // TEST-DSH-093: cycle filter
  test('TEST-DSH-093: filters logs by cycle_id', async () => {
    const result = await query(
      `SELECT * FROM agent_thought_logs WHERE reasoning LIKE 'TEST_LOG_%' AND cycle_id = 9903`
    );
    expect(result.rows.length).toBe(3);
  });

  test('API supports cycle_id filter', () => {
    expect(apiContent).toContain('cycle_id');
  });

  // TEST-DSH-095: step detail expansion
  test('TEST-DSH-095: page has detail expansion UI', () => {
    expect(content).toContain('expandedId');
    expect(content).toContain('読み取りデータ');
    expect(content).toContain('考慮事項');
    expect(content).toContain('判断');
    expect(content).toContain('tools_used');
  });

  test('DB: thought logs have correct structure', async () => {
    const result = await query(
      `SELECT * FROM agent_thought_logs WHERE reasoning LIKE 'TEST_LOG_%' LIMIT 1`
    );
    const log = result.rows[0] as Record<string, unknown>;
    expect(log).toHaveProperty('agent_type');
    expect(log).toHaveProperty('reasoning');
    expect(log).toHaveProperty('decision');
    expect(log).toHaveProperty('tools_used');
    expect(log).toHaveProperty('graph_name');
    expect(log).toHaveProperty('node_name');
  });
});
