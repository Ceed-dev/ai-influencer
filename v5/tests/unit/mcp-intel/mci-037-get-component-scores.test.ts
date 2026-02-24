/**
 * MCI-037: get_component_scores
 * Tests: component score/usage retrieval by type and subtype
 */
import { getComponentScores } from '../../../src/mcp-server/tools/intelligence/get-component-scores';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-037: get_component_scores', () => {
  test('rejects invalid type', async () => {
    await expect(
      getComponentScores({ type: 'invalid' as any, subtype: 'hook', limit: 20 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty subtype', async () => {
    await expect(
      getComponentScores({ type: 'scenario', subtype: '', limit: 20 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid limit', async () => {
    await expect(
      getComponentScores({ type: 'scenario', subtype: 'hook', limit: 0 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns components array with required fields', async () => {
    const result = await getComponentScores({ type: 'scenario', subtype: 'hook', limit: 20 });
    expect(result).toHaveProperty('components');
    expect(Array.isArray(result.components)).toBe(true);

    for (const comp of result.components) {
      expect(comp).toHaveProperty('component_id');
      expect(comp).toHaveProperty('name');
      expect(comp).toHaveProperty('score');
      expect(comp).toHaveProperty('usage_count');
      expect(typeof comp.component_id).toBe('string');
      expect(typeof comp.score).toBe('number');
    }
  });

  test('respects limit parameter', async () => {
    const result = await getComponentScores({ type: 'scenario', subtype: 'hook', limit: 1 });
    expect(result.components.length).toBeLessThanOrEqual(1);
  });
});
