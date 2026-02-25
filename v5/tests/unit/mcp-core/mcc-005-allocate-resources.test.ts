/**
 * TEST-MCP-006: allocate_resources — store resource allocations
 * FEAT-MCC-005
 */
import { allocateResources } from '@/src/mcp-server/tools/strategy/allocate-resources';
import { McpNotFoundError, McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const TEST_CYCLE_PREFIX = 99700;

describe('FEAT-MCC-005: allocate_resources', () => {
  let testCycleId: number;

  beforeAll(async () => {
    // Create a test cycle with an existing summary
    const res = await withClient(async (client) => {
      await client.query(`DELETE FROM cycles WHERE cycle_number = $1`, [TEST_CYCLE_PREFIX + 1]);
      return client.query(
        `INSERT INTO cycles (cycle_number, status, summary)
         VALUES ($1, 'planning', '{"contents_planned": 10}')
         RETURNING id`,
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

  test('TEST-MCP-006: allocates resources and merges into existing summary', async () => {
    const allocations = [
      { cluster: 'cluster_a', content_count: 5, budget: 100 },
      { cluster: 'cluster_b', content_count: 3, budget: 60 },
    ];

    const result = await allocateResources({
      cycle_id: testCycleId,
      allocations,
    });

    expect(result.success).toBe(true);

    // Verify the merged summary in DB
    const dbRes = await withClient(async (client) => {
      return client.query(`SELECT summary FROM cycles WHERE id = $1`, [testCycleId]);
    });

    const storedSummary = dbRes.rows[0]?.summary as Record<string, unknown>;
    expect(storedSummary).toBeDefined();
    // Existing key preserved
    expect(storedSummary['contents_planned']).toBe(10);
    // New allocations added
    expect(storedSummary['allocations']).toEqual(allocations);
  });

  test('TEST-MCP-006: throws McpNotFoundError for non-existent cycle', async () => {
    await expect(
      allocateResources({
        cycle_id: 999999,
        allocations: [{ cluster: 'x', content_count: 1, budget: 10 }],
      }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-006: rejects empty allocations', async () => {
    await expect(
      allocateResources({
        cycle_id: testCycleId,
        allocations: [],
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-006: rejects allocations with invalid fields', async () => {
    await expect(
      allocateResources({
        cycle_id: testCycleId,
        allocations: [{ cluster: '', content_count: 1, budget: 10 }],
      }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      allocateResources({
        cycle_id: testCycleId,
        allocations: [{ cluster: 'x', content_count: -1, budget: 10 }],
      }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      allocateResources({
        cycle_id: testCycleId,
        allocations: [{ cluster: 'x', content_count: 1, budget: -5 }],
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
