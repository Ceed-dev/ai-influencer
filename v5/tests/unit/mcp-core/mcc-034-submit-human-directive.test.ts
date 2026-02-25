/**
 * TEST-MCP-034: submit_human_directive — normal + validation
 * FEAT-MCC-034
 */
import { submitHumanDirective } from '@/src/mcp-server/tools/dashboard/submit-human-directive';
import { withClient } from '../../helpers/db';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-034: submit_human_directive', () => {
  const insertedIds: number[] = [];

  afterAll(async () => {
    if (insertedIds.length > 0) {
      await withClient(async (client) => {
        await client.query(
          `DELETE FROM human_directives WHERE id = ANY($1)`,
          [insertedIds],
        );
      });
    }
  });

  test('TEST-MCP-034a: inserts directive and returns id', async () => {
    const result = await submitHumanDirective({
      directive_type: 'instruction',
      content: 'Focus on beauty niche this cycle',
      priority: 5,
    });

    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);
    insertedIds.push(result.id);

    // Verify insertion
    const res = await withClient(async (client) => {
      return client.query(
        `SELECT directive_type, content, status FROM human_directives WHERE id = $1`,
        [result.id],
      );
    });
    expect(res.rows[0]?.directive_type).toBe('instruction');
    expect(res.rows[0]?.content).toBe('Focus on beauty niche this cycle');
    expect(res.rows[0]?.status).toBe('pending');
  });

  test('TEST-MCP-034b: accepts target_accounts and target_agents', async () => {
    const result = await submitHumanDirective({
      directive_type: 'hypothesis',
      content: 'Try posting at 8pm',
      target_accounts: ['ACC_001'],
      target_agents: ['planner'],
      priority: 3,
    });

    expect(typeof result.id).toBe('number');
    insertedIds.push(result.id);
  });

  test('TEST-MCP-034c: throws McpValidationError for empty content', async () => {
    await expect(
      submitHumanDirective({
        directive_type: 'instruction',
        content: '',
        priority: 1,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-034d: throws McpValidationError for empty directive_type', async () => {
    await expect(
      submitHumanDirective({
        directive_type: '',
        content: 'test',
        priority: 1,
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
