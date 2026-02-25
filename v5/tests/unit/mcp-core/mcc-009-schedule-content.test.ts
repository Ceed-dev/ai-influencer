/**
 * TEST-MCP-030: schedule_content — sets planned_post_date, 404 on missing content
 */
import { scheduleContent } from '@/src/mcp-server/tools/planner/schedule-content';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { McpNotFoundError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-009: schedule_content', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  // TEST-MCP-030: updates planned_post_date for existing content
  test('TEST-MCP-030: sets planned_post_date for existing content', async () => {
    const targetDate = '2026-03-15';
    const result = await scheduleContent({
      content_id: `${PREFIX}CNT_003`,
      planned_post_date: targetDate,
    });

    expect(result).toEqual({ success: true });
  });

  // TEST-MCP-030: throws McpNotFoundError for non-existent content
  test('TEST-MCP-030: throws McpNotFoundError for non-existent content_id', async () => {
    await expect(
      scheduleContent({
        content_id: 'CNT_NONEXISTENT',
        planned_post_date: '2026-03-20',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
