/**
 * MCI-020: save_reflection
 * Tests: INSERT into agent_reflections, validate self_score 1-10
 */
import { saveReflection } from '../../../src/mcp-server/tools/intelligence/save-reflection';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM agent_reflections WHERE task_description LIKE 'test_mci_020%'`);
  });
}

describe('MCI-020: save_reflection', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('rejects invalid agent_type', async () => {
    await expect(
      saveReflection({
        agent_type: 'invalid' as any,
        cycle_id: 1,
        task_description: 'test',
        self_score: 5,
        score_reasoning: 'test',
        what_went_well: 'good',
        what_to_improve: 'bad',
        next_actions: ['action'],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects self_score outside 1-10', async () => {
    await expect(
      saveReflection({
        agent_type: 'analyst',
        cycle_id: 1,
        task_description: 'test',
        self_score: 0,
        score_reasoning: 'test',
        what_went_well: 'good',
        what_to_improve: 'bad',
        next_actions: ['action'],
      }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      saveReflection({
        agent_type: 'analyst',
        cycle_id: 1,
        task_description: 'test',
        self_score: 11,
        score_reasoning: 'test',
        what_went_well: 'good',
        what_to_improve: 'bad',
        next_actions: ['action'],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('saves reflection and returns id', async () => {
    const result = await saveReflection({
      agent_type: 'analyst',
      cycle_id: 1,
      task_description: 'test_mci_020 analysis task',
      self_score: 7,
      score_reasoning: 'good analysis',
      what_went_well: 'identified patterns',
      what_to_improve: 'speed',
      next_actions: ['optimize queries'],
    });
    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
  });
});
