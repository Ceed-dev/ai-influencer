/**
 * MCI-018: get_similar_components
 * Tests: vector search for components
 */
import { getSimilarComponents } from '../../../src/mcp-server/tools/curation/get-similar-components';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-018: get_similar_components', () => {
  test('rejects invalid type', async () => {
    await expect(
      getSimilarComponents({ type: 'invalid' as any, query_text: 'test', limit: 5 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty query_text', async () => {
    await expect(
      getSimilarComponents({ type: 'scenario', query_text: '', limit: 5 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns results array', async () => {
    const result = await getSimilarComponents({
      type: 'scenario',
      query_text: 'beauty hook',
      limit: 5,
    });
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });
});
