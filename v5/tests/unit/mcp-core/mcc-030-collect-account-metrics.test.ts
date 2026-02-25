/**
 * TEST-MCP-030: collect_account_metrics — normal + not found + validation
 * FEAT-MCC-030
 */
import { collectAccountMetrics } from '@/src/mcp-server/tools/measurement/collect-account-metrics';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { McpNotFoundError, McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-030: collect_account_metrics', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  test('TEST-MCP-030a: returns follower_count and follower_delta for existing account', async () => {
    const result = await collectAccountMetrics({ account_id: `${PREFIX}ACC_001` });

    expect(typeof result.follower_count).toBe('number');
    expect(typeof result.follower_delta).toBe('number');
    expect(result.follower_count).toBe(1000);
  });

  test('TEST-MCP-030b: throws McpNotFoundError for non-existent account', async () => {
    await expect(
      collectAccountMetrics({ account_id: 'NONEXISTENT_ACC' }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-030c: throws McpValidationError for empty account_id', async () => {
    await expect(
      collectAccountMetrics({ account_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });
});
