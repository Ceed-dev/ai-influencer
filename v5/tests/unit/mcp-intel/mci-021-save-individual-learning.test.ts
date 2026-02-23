/**
 * MCI-021: save_individual_learning
 * Tests: validate 17 categories
 */
import { saveIndividualLearning } from '../../../src/mcp-server/tools/learning/save-individual-learning';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM agent_individual_learnings WHERE content LIKE 'test_mci_021%'`);
  });
}

describe('MCI-021: save_individual_learning', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('rejects invalid agent_type', async () => {
    await expect(
      saveIndividualLearning({
        agent_type: 'invalid' as any,
        content: 'test',
        category: 'pattern',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid category', async () => {
    await expect(
      saveIndividualLearning({
        agent_type: 'analyst',
        content: 'test',
        category: 'invalid_cat' as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('accepts all 17 valid categories', async () => {
    const categories = [
      'data_source', 'technique', 'pattern', 'mistake', 'insight',
      'tool_characteristics', 'tool_combination', 'tool_failure_pattern', 'tool_update',
      'data_classification', 'curation_quality', 'source_reliability',
      'content', 'timing', 'audience', 'platform', 'niche',
    ] as const;

    for (const category of categories) {
      const result = await saveIndividualLearning({
        agent_type: 'analyst',
        content: `test_mci_021 ${category}`,
        category,
      });
      expect(result).toHaveProperty('id');
    }
  });
});
