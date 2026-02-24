/**
 * Tests for get_niche_learnings
 */
import { getNicheLearnings } from '@/src/mcp-server/tools/planner/get-niche-learnings';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const MARKER = 'TNLRN_test_niche';

describe('get_niche_learnings', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM learnings WHERE insight LIKE '${MARKER}%'`);
      await client.query(`
        INSERT INTO learnings (category, insight, confidence, evidence_count, applicable_niches)
        VALUES
          ('content', '${MARKER}_insight_1', 0.90, 5, ARRAY['beauty', 'fashion']),
          ('timing', '${MARKER}_insight_2', 0.60, 3, ARRAY['beauty']),
          ('audience', '${MARKER}_insight_3', 0.30, 1, ARRAY['beauty']),
          ('content', '${MARKER}_insight_4', 0.80, 4, ARRAY['tech'])
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM learnings WHERE insight LIKE '${MARKER}%'`);
    });
  });

  test('returns learnings for niche with default confidence', async () => {
    const result = await getNicheLearnings({ niche: 'beauty', min_confidence: 0.5, limit: 10 });
    const testResults = result.learnings.filter(l => l.insight.startsWith(MARKER));
    // Should include insight_1 (0.90) and insight_2 (0.60), not insight_3 (0.30)
    expect(testResults.length).toBe(2);
    testResults.forEach(l => {
      expect(l.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  test('respects min_confidence filter', async () => {
    const result = await getNicheLearnings({ niche: 'beauty', min_confidence: 0.8, limit: 10 });
    const testResults = result.learnings.filter(l => l.insight.startsWith(MARKER));
    expect(testResults.length).toBe(1);
    expect(testResults[0]!.insight).toContain('insight_1');
  });

  test('respects limit parameter', async () => {
    const result = await getNicheLearnings({ niche: 'beauty', min_confidence: 0.1, limit: 1 });
    const testResults = result.learnings.filter(l => l.insight.startsWith(MARKER));
    expect(testResults.length).toBeLessThanOrEqual(1);
  });

  test('returns correct structure', async () => {
    const result = await getNicheLearnings({ niche: 'beauty', min_confidence: 0.5, limit: 10 });
    if (result.learnings.length > 0) {
      const l = result.learnings[0]!;
      expect(l).toHaveProperty('insight');
      expect(l).toHaveProperty('confidence');
      expect(l).toHaveProperty('category');
    }
  });

  test('rejects empty niche', async () => {
    await expect(
      getNicheLearnings({ niche: '', min_confidence: 0.5, limit: 10 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid min_confidence', async () => {
    await expect(
      getNicheLearnings({ niche: 'beauty', min_confidence: 2.0, limit: 10 }),
    ).rejects.toThrow(McpValidationError);
  });
});
