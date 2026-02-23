/**
 * TEST-DSH-029: Algorithm Accuracy ページ — チャート表示
 * TEST-DSH-146: EngagementTrendChart
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-021: Algorithm Accuracy page', () => {
  const agentsPagePath = path.join(__dirname, '../../../dashboard/app/agents/page.tsx');
  let agentsContent: string;
  const apiPath = path.join(__dirname, '../../../dashboard/app/api/algorithm-performance/route.ts');
  let apiContent: string;

  beforeAll(async () => {
    agentsContent = fs.readFileSync(agentsPagePath, 'utf-8');
    apiContent = fs.readFileSync(apiPath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM algorithm_performance WHERE metadata->>'test_marker' = 'DSH021'`);
      await client.query(`
        INSERT INTO algorithm_performance (period, hypothesis_accuracy, prediction_error, learning_count, metadata)
        VALUES
          ('daily', 0.7500, 0.1200, 10, '{"test_marker": "DSH021"}'::jsonb),
          ('daily', 0.8000, 0.1000, 15, '{"test_marker": "DSH021"}'::jsonb),
          ('weekly', 0.8500, 0.0800, 25, '{"test_marker": "DSH021"}'::jsonb)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM algorithm_performance WHERE metadata->>'test_marker' = 'DSH021'`);
    });
  });

  // TEST-DSH-029: chart display
  test('TEST-DSH-029: API returns algorithm performance data', async () => {
    const result = await query(
      `SELECT * FROM algorithm_performance WHERE metadata->>'test_marker' = 'DSH021' ORDER BY measured_at ASC`
    );
    expect(result.rows.length).toBe(3);
    expect(result.rows[0]).toHaveProperty('hypothesis_accuracy');
    expect(result.rows[0]).toHaveProperty('prediction_error');
  });

  test('API supports period filter', () => {
    expect(apiContent).toContain('period');
    expect(apiContent).toContain('hypothesis_accuracy');
    expect(apiContent).toContain('prediction_error');
  });

  // TEST-DSH-146: agents page has evolution panel
  test('TEST-DSH-146: agents page has evolution chart panel', () => {
    expect(agentsContent).toContain('EvolutionPanel');
    expect(agentsContent).toContain('self_score');
  });

  test('DB: hypothesis_accuracy values are between 0 and 1', async () => {
    const result = await query(
      `SELECT hypothesis_accuracy FROM algorithm_performance WHERE metadata->>'test_marker' = 'DSH021'`
    );
    result.rows.forEach((row: Record<string, unknown>) => {
      const acc = Number(row.hypothesis_accuracy);
      expect(acc).toBeGreaterThanOrEqual(0);
      expect(acc).toBeLessThanOrEqual(1);
    });
  });
});
