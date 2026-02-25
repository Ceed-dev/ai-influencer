/**
 * MCI-027: search_similar_learnings
 * Tests: pgvector search + confidence filter
 */
import { searchSimilarLearnings } from '../../../src/mcp-server/tools/learning/search-similar-learnings';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-027: search_similar_learnings', () => {
  test('rejects empty query_text', async () => {
    await expect(
      searchSimilarLearnings({ query_text: '', limit: 10, min_confidence: 0.5 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects min_confidence out of range', async () => {
    await expect(
      searchSimilarLearnings({ query_text: 'test', limit: 10, min_confidence: 1.5 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns results array', async () => {
    const result = await searchSimilarLearnings({
      query_text: 'beauty content',
      limit: 5,
      min_confidence: 0.5,
    });
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });
});
