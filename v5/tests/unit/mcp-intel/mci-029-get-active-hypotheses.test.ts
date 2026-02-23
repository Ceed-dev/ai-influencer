/**
 * MCI-029: get_active_hypotheses
 * Tests: SELECT hypotheses WHERE verdict='pending'
 */
import { getActiveHypotheses } from '../../../src/mcp-server/tools/intelligence/get-active-hypotheses';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-029: get_active_hypotheses', () => {
  test('rejects invalid verdict', async () => {
    await expect(
      getActiveHypotheses({ verdict: 'invalid' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns hypotheses array for pending', async () => {
    const result = await getActiveHypotheses({ verdict: 'pending' });
    expect(result).toHaveProperty('hypotheses');
    expect(Array.isArray(result.hypotheses)).toBe(true);
  });

  test('accepts all valid verdicts', async () => {
    for (const verdict of ['pending', 'confirmed', 'rejected', 'inconclusive'] as const) {
      const result = await getActiveHypotheses({ verdict });
      expect(result).toHaveProperty('hypotheses');
    }
  });
});
