/**
 * TEST-MCP-005: set_cycle_plan — update cycle summary
 * FEAT-MCC-004
 */
import { setCyclePlan } from '@/src/mcp-server/tools/strategy/set-cycle-plan';
import { McpNotFoundError, McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const TEST_CYCLE_PREFIX = 99800;

describe('FEAT-MCC-004: set_cycle_plan', () => {
  let testCycleId: number;

  beforeAll(async () => {
    // Create a test cycle
    const res = await withClient(async (client) => {
      await client.query(`DELETE FROM cycles WHERE cycle_number = $1`, [TEST_CYCLE_PREFIX + 1]);
      return client.query(
        `INSERT INTO cycles (cycle_number, status) VALUES ($1, 'planning') RETURNING id`,
        [TEST_CYCLE_PREFIX + 1],
      );
    });
    testCycleId = res.rows[0].id as number;
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM cycles WHERE cycle_number >= $1`, [TEST_CYCLE_PREFIX]);
    });
  });

  test('TEST-MCP-005: sets cycle plan successfully', async () => {
    const summary = {
      contents_planned: 10,
      hypotheses_generated: 3,
      key_decisions: ['focus on beauty niche'],
    };

    const result = await setCyclePlan({
      cycle_id: testCycleId,
      summary,
    });

    expect(result.success).toBe(true);

    // Verify the update in DB
    const dbRes = await withClient(async (client) => {
      return client.query(`SELECT summary FROM cycles WHERE id = $1`, [testCycleId]);
    });

    const storedSummary = dbRes.rows[0]?.summary as Record<string, unknown>;
    expect(storedSummary).toBeDefined();
    expect(storedSummary['contents_planned']).toBe(10);
    expect(storedSummary['hypotheses_generated']).toBe(3);
  });

  test('TEST-MCP-005: throws McpNotFoundError for non-existent cycle', async () => {
    await expect(
      setCyclePlan({
        cycle_id: 999999,
        summary: { test: true },
      }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-005: rejects invalid inputs', async () => {
    await expect(
      setCyclePlan({
        cycle_id: null as any,
        summary: { test: true },
      }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      setCyclePlan({
        cycle_id: testCycleId,
        summary: null as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
