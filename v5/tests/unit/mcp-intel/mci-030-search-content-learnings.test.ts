/**
 * MCI-030: search_content_learnings
 * Tests: content_learnings vector search
 */
import { searchContentLearnings } from '../../../src/mcp-server/tools/intelligence/search-content-learnings';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-030: search_content_learnings', () => {
  test('rejects empty query_embedding', async () => {
    await expect(
      searchContentLearnings({ query_embedding: [] }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects min_confidence out of range', async () => {
    await expect(
      searchContentLearnings({
        query_embedding: new Array(1536).fill(0),
        min_confidence: 1.5,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns learnings array', async () => {
    const result = await searchContentLearnings({
      query_embedding: new Array(1536).fill(0),
      limit: 5,
      min_confidence: 0.5,
    });
    expect(result).toHaveProperty('learnings');
    expect(Array.isArray(result.learnings)).toBe(true);
  });
});
