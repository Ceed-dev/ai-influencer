/**
 * MCI-036: get_hypothesis_results
 * Tests: hypothesis predicted vs actual data retrieval
 */
import { getHypothesisResults } from '../../../src/mcp-server/tools/intelligence/get-hypothesis-results';
import { McpValidationError, McpNotFoundError } from '../../../src/mcp-server/errors';

describe('MCI-036: get_hypothesis_results', () => {
  test('rejects missing hypothesis_id', async () => {
    await expect(
      getHypothesisResults({ hypothesis_id: undefined as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects non-numeric hypothesis_id', async () => {
    await expect(
      getHypothesisResults({ hypothesis_id: 'abc' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws not found for non-existent hypothesis', async () => {
    await expect(
      getHypothesisResults({ hypothesis_id: 999999 }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('returns correct structure for existing hypothesis', async () => {
    // Insert a test hypothesis
    const { withClient } = await import('../../helpers/db');
    let hypothesisId: number;

    try {
      hypothesisId = await withClient(async (client) => {
        const res = await client.query(
          `INSERT INTO hypotheses (category, statement, predicted_kpis, actual_kpis, verdict)
           VALUES ('content_format', 'test hypothesis', '{"views": 1000}', '{"views": 800}', 'confirmed')
           RETURNING id`,
        );
        return res.rows[0].id;
      });

      const result = await getHypothesisResults({ hypothesis_id: hypothesisId });

      expect(result).toHaveProperty('predicted_kpis');
      expect(result).toHaveProperty('actual_kpis');
      expect(result).toHaveProperty('content_count');
      expect(result).toHaveProperty('raw_metrics');
      expect(typeof result.content_count).toBe('number');
      expect(Array.isArray(result.raw_metrics)).toBe(true);
      expect(result.predicted_kpis).toEqual({ views: 1000 });
      expect(result.actual_kpis).toEqual({ views: 800 });
    } finally {
      await withClient(async (client) => {
        await client.query(
          `DELETE FROM hypotheses WHERE statement = 'test hypothesis'`,
        );
      });
    }
  });
});
