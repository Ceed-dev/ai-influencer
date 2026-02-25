/**
 * TEST-MCP-004: create_cycle — new cycle creation
 * FEAT-MCC-003
 */
import { createCycle } from '@/src/mcp-server/tools/strategy/create-cycle';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const TEST_CYCLE_PREFIX = 99900;

describe('FEAT-MCC-003: create_cycle', () => {
  afterAll(async () => {
    // Cleanup test cycles
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM cycles WHERE cycle_number >= $1`,
        [TEST_CYCLE_PREFIX],
      );
    });
  });

  test('TEST-MCP-004: creates a cycle with status planning', async () => {
    const cycleNum = TEST_CYCLE_PREFIX + 1;

    // Cleanup in case of leftover
    await withClient(async (client) => {
      await client.query(`DELETE FROM cycles WHERE cycle_number = $1`, [cycleNum]);
    });

    const result = await createCycle({ cycle_number: cycleNum });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('cycle_number');
    expect(result).toHaveProperty('status');

    expect(typeof result.id).toBe('number');
    expect(result.cycle_number).toBe(cycleNum);
    expect(result.status).toBe('planning');
  });

  test('TEST-MCP-004: rejects duplicate cycle_number', async () => {
    const cycleNum = TEST_CYCLE_PREFIX + 2;

    // Cleanup in case of leftover
    await withClient(async (client) => {
      await client.query(`DELETE FROM cycles WHERE cycle_number = $1`, [cycleNum]);
    });

    await createCycle({ cycle_number: cycleNum });

    await expect(
      createCycle({ cycle_number: cycleNum }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-004: rejects invalid cycle_number', async () => {
    await expect(
      createCycle({ cycle_number: -1 }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      createCycle({ cycle_number: 0 }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      createCycle({ cycle_number: 1.5 }),
    ).rejects.toThrow(McpValidationError);
  });
});
