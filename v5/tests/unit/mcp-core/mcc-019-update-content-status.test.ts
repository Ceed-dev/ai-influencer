/**
 * TEST-MCP-019: update_content_status — normal + validation + not found
 * FEAT-MCC-019
 */
import { updateContentStatus } from '@/src/mcp-server/tools/production/update-content-status';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-019: update_content_status', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  test('TEST-MCP-019a: updates status for existing content', async () => {
    const result = await updateContentStatus({
      content_id: `${PREFIX}CNT_003`,
      status: 'producing',
    });

    expect(result).toEqual({ success: true });
  });

  test('TEST-MCP-019b: updates status with metadata', async () => {
    const result = await updateContentStatus({
      content_id: `${PREFIX}CNT_003`,
      status: 'ready',
      metadata: { pipeline_version: '1.0' },
    });

    expect(result).toEqual({ success: true });
  });

  test('TEST-MCP-019c: throws McpValidationError for invalid status', async () => {
    await expect(
      updateContentStatus({
        content_id: `${PREFIX}CNT_003`,
        status: 'invalid_status' as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-019d: throws McpNotFoundError for non-existent content', async () => {
    await expect(
      updateContentStatus({
        content_id: 'NONEXISTENT_CNT',
        status: 'producing',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-019e: accepts all valid ContentStatus values', async () => {
    // Test a few valid statuses
    const validStatuses = ['planned', 'producing', 'ready', 'cancelled'] as const;

    for (const status of validStatuses) {
      const result = await updateContentStatus({
        content_id: `${PREFIX}CNT_003`,
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});
