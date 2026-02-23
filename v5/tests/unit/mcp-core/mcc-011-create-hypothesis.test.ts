/**
 * TEST-MCP-032: create_hypothesis — creates hypothesis and returns id
 * TEST-MCP-096: create_hypothesis — category validation
 */
import { createHypothesis } from '@/src/mcp-server/tools/planner/create-hypothesis';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

describe('FEAT-MCC-011: create_hypothesis', () => {
  const createdIds: number[] = [];

  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    // Clean up hypotheses created by tests
    if (createdIds.length > 0) {
      await withClient(async (client) => {
        await client.query(
          `DELETE FROM hypotheses WHERE id = ANY($1)`,
          [createdIds],
        );
      });
    }
    await cleanupBaseData();
  });

  // TEST-MCP-032: creates hypothesis and returns id
  test('TEST-MCP-032: creates hypothesis with valid category', async () => {
    const result = await createHypothesis({
      category: 'hook_type',
      statement: 'Question hooks increase engagement by 20%',
      rationale: 'Based on competitor analysis of top beauty channels',
      target_accounts: [`${PREFIX}ACC_001`, `${PREFIX}ACC_002`],
      predicted_kpis: { engagement_rate: 0.08, views: 5000 },
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);
    createdIds.push(result.id);

    // Verify the hypothesis was inserted
    await withClient(async (client) => {
      const res = await client.query(
        `SELECT * FROM hypotheses WHERE id = $1`,
        [result.id],
      );
      expect(res.rowCount).toBe(1);

      const row = res.rows[0] as Record<string, unknown>;
      expect(row['verdict']).toBe('pending');
      expect(row['statement']).toBe('Question hooks increase engagement by 20%');
      expect(row['rationale']).toBe('Based on competitor analysis of top beauty channels');
      expect(row['cycle_id']).toBeNull();
    });
  });

  // TEST-MCP-096: rejects invalid category
  test('TEST-MCP-096: rejects invalid category', async () => {
    await expect(
      createHypothesis({
        category: 'invalid_category',
        statement: 'This should fail',
        rationale: 'N/A',
        target_accounts: [],
        predicted_kpis: {},
      }),
    ).rejects.toThrow(McpValidationError);
  });

  // All valid categories should be accepted (application-level)
  test('accepts platform_specific category', async () => {
    const result = await createHypothesis({
      category: 'platform_specific',
      statement: 'TikTok duets increase reach by 30%',
      rationale: 'Observed trend in cooking niche',
      target_accounts: [`${PREFIX}ACC_002`],
      predicted_kpis: { views: 10000 },
    });

    expect(result.id).toBeGreaterThan(0);
    createdIds.push(result.id);
  });
});
