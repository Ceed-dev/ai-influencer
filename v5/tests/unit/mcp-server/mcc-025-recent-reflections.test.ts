/**
 * Tests for get_recent_reflections
 */
import { getRecentReflections } from '@/src/mcp-server/tools/learning/get-recent-reflections';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const MARKER = 'TREF_test_marker';

describe('get_recent_reflections', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_reflections WHERE task_description LIKE '${MARKER}%'`);
      await client.query(`
        INSERT INTO agent_reflections (agent_type, task_description, self_score, score_reasoning, next_actions, created_at)
        VALUES
          ('strategist', '${MARKER}_task_1', 8, 'Good performance', ARRAY['improve_x'], NOW() - INTERVAL '2 hours'),
          ('strategist', '${MARKER}_task_2', 6, 'Average result', ARRAY['try_y', 'fix_z'], NOW() - INTERVAL '1 hour'),
          ('analyst', '${MARKER}_task_3', 9, 'Excellent', ARRAY['continue'], NOW())
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_reflections WHERE task_description LIKE '${MARKER}%'`);
    });
  });

  test('returns reflections for specific agent type', async () => {
    const result = await getRecentReflections({ agent_type: 'strategist', limit: 5 });
    const testResults = result.reflections.filter(r => r.score_reasoning.includes('performance') || r.score_reasoning.includes('Average'));
    expect(testResults.length).toBe(2);
  });

  test('returns reflections ordered by created_at DESC', async () => {
    const result = await getRecentReflections({ agent_type: 'strategist', limit: 5 });
    const testResults = result.reflections.filter(r =>
      r.score_reasoning === 'Good performance' || r.score_reasoning === 'Average result'
    );
    if (testResults.length >= 2) {
      const dates = testResults.map(r => new Date(r.created_at).getTime());
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]!);
    }
  });

  test('returns correct structure', async () => {
    const result = await getRecentReflections({ agent_type: 'strategist', limit: 5 });
    if (result.reflections.length > 0) {
      const r = result.reflections[0]!;
      expect(r).toHaveProperty('self_score');
      expect(r).toHaveProperty('score_reasoning');
      expect(r).toHaveProperty('next_actions');
      expect(r).toHaveProperty('created_at');
      expect(typeof r.self_score).toBe('number');
      expect(Array.isArray(r.next_actions)).toBe(true);
    }
  });

  test('respects limit parameter', async () => {
    const result = await getRecentReflections({ agent_type: 'strategist', limit: 1 });
    expect(result.reflections.length).toBeLessThanOrEqual(1);
  });

  test('rejects invalid agent_type', async () => {
    await expect(
      getRecentReflections({ agent_type: 'invalid' as any, limit: 5 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid limit', async () => {
    await expect(
      getRecentReflections({ agent_type: 'strategist', limit: 0 }),
    ).rejects.toThrow(McpValidationError);
  });
});
