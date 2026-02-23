/**
 * MCI-016: get_curation_queue
 * Tests: SELECT from market_intel
 */
import { getCurationQueue } from '../../../src/mcp-server/tools/curation/get-curation-queue';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-016: get_curation_queue', () => {
  test('rejects limit out of range', async () => {
    await expect(
      getCurationQueue({ limit: 200 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns items array', async () => {
    const result = await getCurationQueue({ limit: 5 });
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
  });
});
