/**
 * MCI-040: compare_hypothesis_predictions
 * Tests: predicted vs actual comparison across hypotheses
 */
import { compareHypothesisPredictions } from '../../../src/mcp-server/tools/intelligence/compare-hypothesis-predictions';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

describe('MCI-040: compare_hypothesis_predictions', () => {
  test('rejects empty hypothesis_ids', async () => {
    await expect(
      compareHypothesisPredictions({ hypothesis_ids: [] }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects non-array hypothesis_ids', async () => {
    await expect(
      compareHypothesisPredictions({ hypothesis_ids: 'invalid' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects too many hypothesis_ids', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    await expect(
      compareHypothesisPredictions({ hypothesis_ids: ids }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns comparisons with correct structure', async () => {
    let ids: number[];
    try {
      ids = await withClient(async (client) => {
        const res1 = await client.query(
          `INSERT INTO hypotheses (category, statement, predicted_kpis, actual_kpis, verdict)
           VALUES ('content_format', 'compare test 1', '{"views": 1000}', '{"views": 800}', 'confirmed')
           RETURNING id`,
        );
        const res2 = await client.query(
          `INSERT INTO hypotheses (category, statement, predicted_kpis, actual_kpis, verdict)
           VALUES ('timing', 'compare test 2', '{"views": 500}', '{"views": 600}', 'rejected')
           RETURNING id`,
        );
        return [res1.rows[0].id, res2.rows[0].id];
      });

      const result = await compareHypothesisPredictions({ hypothesis_ids: ids });
      expect(result).toHaveProperty('comparisons');
      expect(result.comparisons.length).toBe(2);

      for (const comp of result.comparisons) {
        expect(comp).toHaveProperty('hypothesis_id');
        expect(comp).toHaveProperty('predicted');
        expect(comp).toHaveProperty('actual');
        expect(comp).toHaveProperty('error_rate');
        expect(typeof comp.error_rate).toBe('number');
        expect(ids).toContain(comp.hypothesis_id);
      }
    } finally {
      await withClient(async (client) => {
        await client.query(
          `DELETE FROM hypotheses WHERE statement IN ('compare test 1', 'compare test 2')`,
        );
      });
    }
  });

  test('returns empty comparisons for non-existent ids', async () => {
    const result = await compareHypothesisPredictions({ hypothesis_ids: [999998, 999999] });
    expect(result.comparisons).toHaveLength(0);
  });
});
