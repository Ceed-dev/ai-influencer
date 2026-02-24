/**
 * Tests for submit_learning_guidance and get_learning_directives
 */
import { submitLearningGuidance } from '@/src/mcp-server/tools/dashboard/submit-learning-guidance';
import { getLearningDirectives } from '@/src/mcp-server/tools/dashboard/get-learning-directives';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const MARKER = 'TLG_test_guidance';

describe('submit_learning_guidance', () => {
  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM human_directives WHERE content LIKE '%${MARKER}%'`);
    });
  });

  test('submits learning guidance successfully', async () => {
    const result = await submitLearningGuidance({
      target_agent_type: 'analyst',
      guidance: `${MARKER}_focus_on_engagement`,
      category: 'analysis_method',
    });
    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
  });

  test('rejects invalid agent_type', async () => {
    await expect(
      submitLearningGuidance({
        target_agent_type: 'invalid' as any,
        guidance: 'test',
        category: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty guidance', async () => {
    await expect(
      submitLearningGuidance({
        target_agent_type: 'analyst',
        guidance: '',
        category: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty category', async () => {
    await expect(
      submitLearningGuidance({
        target_agent_type: 'analyst',
        guidance: 'test',
        category: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});

describe('get_learning_directives', () => {
  beforeAll(async () => {
    // Ensure at least one directive exists for the agent type
    await submitLearningGuidance({
      target_agent_type: 'planner',
      guidance: `${MARKER}_planner_guidance`,
      category: 'planning_strategy',
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM human_directives WHERE content LIKE '%${MARKER}%'`);
    });
  });

  test('returns directives for specific agent type', async () => {
    const result = await getLearningDirectives({ agent_type: 'planner' });
    expect(result).toHaveProperty('directives');
    const testDirectives = result.directives.filter(d => d.guidance.includes(MARKER));
    expect(testDirectives.length).toBeGreaterThanOrEqual(1);
  });

  test('returns correct structure', async () => {
    const result = await getLearningDirectives({ agent_type: 'planner' });
    if (result.directives.length > 0) {
      const d = result.directives[0]!;
      expect(d).toHaveProperty('guidance');
      expect(d).toHaveProperty('category');
      expect(d).toHaveProperty('created_at');
    }
  });

  test('rejects invalid agent_type', async () => {
    await expect(
      getLearningDirectives({ agent_type: 'invalid' as any }),
    ).rejects.toThrow(McpValidationError);
  });
});
