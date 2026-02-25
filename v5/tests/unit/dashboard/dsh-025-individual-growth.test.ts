/**
 * TEST-DSH-034: Individual Growth Tracking
 * TEST-DSH-107: パフォーマンスカード
 * TEST-DSH-108: エージェント比較ビュー
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-025: Individual Growth Tracking page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/agents/page.tsx');
  let content: string;
  const apiPath = path.join(__dirname, '../../../dashboard/app/api/individual-learnings/route.ts');
  let apiContent: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');
    apiContent = fs.readFileSync(apiPath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_individual_learnings WHERE content LIKE 'TEST_GROWTH_%'`);
      await client.query(`
        INSERT INTO agent_individual_learnings (agent_type, category, content, confidence, times_applied, times_successful)
        VALUES
          ('analyst', 'pattern', 'TEST_GROWTH_1 Pattern recognition', 0.85, 10, 8),
          ('analyst', 'insight', 'TEST_GROWTH_2 Insight discovery', 0.70, 5, 3),
          ('strategist', 'technique', 'TEST_GROWTH_3 Strategy technique', 0.90, 8, 7)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_individual_learnings WHERE content LIKE 'TEST_GROWTH_%'`);
    });
  });

  // TEST-DSH-034: 3 metrics shown
  test('TEST-DSH-034: growth panel shows 3 metrics per agent', () => {
    expect(content).toContain('学習');
    expect(content).toContain('スコア');
    expect(content).toContain('振り返り');
  });

  // TEST-DSH-107: performance cards
  test('TEST-DSH-107: has agent performance cards', () => {
    expect(content).toContain('data-agent-card');
    expect(content).toContain('GrowthPanel');
  });

  test('API returns individual learnings with confidence', () => {
    expect(apiContent).toContain('confidence');
    expect(apiContent).toContain('success_rate');
    expect(apiContent).toContain('agent_type');
  });

  test('DB: individual learnings with success_rate', async () => {
    const result = await query(
      `SELECT content, confidence, times_applied, times_successful, success_rate
       FROM agent_individual_learnings WHERE content LIKE 'TEST_GROWTH_%'
       ORDER BY confidence DESC`
    );
    expect(result.rows.length).toBe(3);

    const first = result.rows[0] as Record<string, unknown>;
    expect(Number(first.confidence)).toBe(0.9);
    // success_rate is generated: times_successful / times_applied
    expect(Number(first.success_rate)).toBeCloseTo(7 / 8, 2);
  });

  test('DB: learnings per agent type', async () => {
    const analyst = await query(
      `SELECT * FROM agent_individual_learnings WHERE content LIKE 'TEST_GROWTH_%' AND agent_type = 'analyst'`
    );
    expect(analyst.rows.length).toBe(2);

    const strategist = await query(
      `SELECT * FROM agent_individual_learnings WHERE content LIKE 'TEST_GROWTH_%' AND agent_type = 'strategist'`
    );
    expect(strategist.rows.length).toBe(1);
  });
});
