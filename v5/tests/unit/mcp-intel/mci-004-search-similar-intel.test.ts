/**
 * MCI-004: search_similar_intel
 * Tests: vector search via pgvector
 */
import { searchSimilarIntel } from '../../../src/mcp-server/tools/intelligence/search-similar-intel';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-004: search_similar_intel', () => {
  test('rejects empty query_text', async () => {
    await expect(
      searchSimilarIntel({ query_text: '', limit: 10 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects limit out of range', async () => {
    await expect(
      searchSimilarIntel({ query_text: 'test', limit: 200 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns results array (may be empty if no embeddings)', async () => {
    const result = await searchSimilarIntel({ query_text: 'beauty trends', limit: 5 });
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });
});
