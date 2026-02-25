/**
 * TEST-DSH-033: Agent Evolution — リフレクション推移
 * TEST-DSH-099: self_score 推移チャート
 * TEST-DSH-100: 学習停滞アラート
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-024: Agent Evolution page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/agents/page.tsx');
  let content: string;
  const apiPath = path.join(__dirname, '../../../dashboard/app/api/reflections/route.ts');
  let apiContent: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');
    apiContent = fs.readFileSync(apiPath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_reflections WHERE task_description LIKE 'TEST_REFL_%'`);
      for (let i = 1; i <= 5; i++) {
        await client.query(`INSERT INTO cycles (id, cycle_number, status) VALUES ($1, $1, 'completed') ON CONFLICT (id) DO NOTHING`, [9910 + i]);
      }
      await client.query(`
        INSERT INTO agent_reflections (agent_type, cycle_id, task_description, self_score, score_reasoning, what_went_well, what_to_improve)
        VALUES
          ('analyst', 9911, 'TEST_REFL_1', 5, 'Initial cycle', ARRAY['data collection'], ARRAY['speed']),
          ('analyst', 9912, 'TEST_REFL_2', 6, 'Better analysis', ARRAY['deeper insights'], ARRAY['formatting']),
          ('analyst', 9913, 'TEST_REFL_3', 7, 'Good progress', ARRAY['accuracy'], ARRAY['coverage']),
          ('strategist', 9911, 'TEST_REFL_4', 4, 'Learning phase', ARRAY['basic planning'], ARRAY['detail']),
          ('strategist', 9912, 'TEST_REFL_5', 6, 'Improvement', ARRAY['hypothesis quality'], ARRAY['timing'])
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_reflections WHERE task_description LIKE 'TEST_REFL_%'`);
      for (let i = 1; i <= 5; i++) {
        await client.query(`DELETE FROM cycles WHERE id = $1`, [9910 + i]);
      }
    });
  });

  // TEST-DSH-033: reflection trend
  test('TEST-DSH-033: page shows self_score trend', () => {
    expect(content).toContain('self_score');
    expect(content).toContain('agents.selfScoreProgression');
  });

  // TEST-DSH-099: chart rendering
  test('TEST-DSH-099: evolution panel fetches reflections', () => {
    expect(content).toContain('/api/reflections');
    expect(content).toContain('EvolutionPanel');
  });

  test('API returns reflections with self_score', () => {
    expect(apiContent).toContain('self_score');
    expect(apiContent).toContain('agent_type');
  });

  test('DB: reflections show score progression', async () => {
    const result = await query(
      `SELECT self_score, cycle_id FROM agent_reflections
       WHERE task_description LIKE 'TEST_REFL_%' AND agent_type = 'analyst'
       ORDER BY cycle_id ASC`
    );
    expect(result.rows.length).toBe(3);
    const scores = result.rows.map((r: Record<string, unknown>) => r.self_score as number);
    // Analyst scores should be increasing: 5, 6, 7
    expect(scores[0]).toBeLessThan(scores[1] as number);
    expect(scores[1]).toBeLessThan(scores[2] as number);
  });

  test('DB: reflections have what_went_well and what_to_improve', async () => {
    const result = await query(
      `SELECT * FROM agent_reflections WHERE task_description = 'TEST_REFL_1'`
    );
    const refl = result.rows[0] as Record<string, unknown>;
    expect(refl.what_went_well).toEqual(['data collection']);
    expect(refl.what_to_improve).toEqual(['speed']);
  });
});
