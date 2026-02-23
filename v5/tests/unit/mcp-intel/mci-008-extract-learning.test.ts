/**
 * MCI-008: extract_learning
 * Tests: category validation, INSERT into learnings
 */
import { extractLearning } from '../../../src/mcp-server/tools/intelligence/extract-learning';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM learnings WHERE insight LIKE 'test_mci_008%'`);
  });
}

describe('MCI-008: extract_learning', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('rejects invalid category', async () => {
    await expect(
      extractLearning({
        insight: 'test',
        category: 'invalid_cat' as any,
        confidence: 0.7,
        source_analyses: [],
        applicable_niches: [],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects confidence out of range', async () => {
    await expect(
      extractLearning({
        insight: 'test',
        category: 'content',
        confidence: -0.1,
        source_analyses: [],
        applicable_niches: [],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('inserts learning and returns id', async () => {
    const result = await extractLearning({
      insight: 'test_mci_008 beauty content works well',
      category: 'content',
      confidence: 0.75,
      source_analyses: [1],
      applicable_niches: ['beauty'],
    });
    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
  });
});
