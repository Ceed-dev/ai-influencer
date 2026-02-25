/**
 * TEST-MCP-021: report_production_complete — normal + error
 * FEAT-MCC-021
 */
import { reportProductionComplete } from '@/src/mcp-server/tools/production/report-production-complete';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { withClient } from '../../helpers/db';
import { McpDbError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-021: report_production_complete', () => {
  let taskId: number;

  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();

    // Insert a task_queue entry in processing state
    const res = await withClient(async (client) => {
      const r = await client.query(
        `INSERT INTO task_queue (task_type, payload, status, priority)
         VALUES ('produce', $1, 'processing', 5)
         RETURNING id`,
        [JSON.stringify({ content_id: `${PREFIX}CNT_001` })],
      );
      return r;
    });
    taskId = res.rows[0]?.id as number;
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM task_queue WHERE payload::text LIKE '%${PREFIX}%'`,
      );
    });
    await cleanupBaseData();
  });

  test('TEST-MCP-021a: marks task completed and updates content', async () => {
    const result = await reportProductionComplete({
      task_id: taskId,
      content_id: `${PREFIX}CNT_001`,
      drive_folder_id: 'folder_test_123',
      video_drive_id: 'video_drive_test_456',
    });

    expect(result).toEqual({ success: true });

    // Verify task status changed to completed
    const taskRes = await withClient(async (client) => {
      return client.query(
        `SELECT status, completed_at FROM task_queue WHERE id = $1`,
        [taskId],
      );
    });
    expect(taskRes.rows[0]?.status).toBe('completed');
    expect(taskRes.rows[0]?.completed_at).not.toBeNull();

    // Verify content status and video_drive_id
    const contentRes = await withClient(async (client) => {
      return client.query(
        `SELECT status, video_drive_id FROM content WHERE content_id = $1`,
        [`${PREFIX}CNT_001`],
      );
    });
    expect(contentRes.rows[0]?.status).toBe('ready');
    expect(contentRes.rows[0]?.video_drive_id).toBe('video_drive_test_456');
  });

  test('TEST-MCP-021b: throws McpDbError for non-existent task_id', async () => {
    await expect(
      reportProductionComplete({
        task_id: 999999,
        content_id: `${PREFIX}CNT_001`,
        drive_folder_id: 'folder_test',
        video_drive_id: 'video_test',
      }),
    ).rejects.toThrow(McpDbError);
  });

  test('TEST-MCP-021c: throws McpDbError for non-existent content_id', async () => {
    // Insert a new task to test content not found
    const res = await withClient(async (client) => {
      const r = await client.query(
        `INSERT INTO task_queue (task_type, payload, status, priority)
         VALUES ('produce', $1, 'processing', 1)
         RETURNING id`,
        [JSON.stringify({ content_id: 'NONEXISTENT_CNT' })],
      );
      return r;
    });
    const newTaskId = res.rows[0]?.id as number;

    await expect(
      reportProductionComplete({
        task_id: newTaskId,
        content_id: 'NONEXISTENT_CNT',
        drive_folder_id: 'folder_test',
        video_drive_id: 'video_test',
      }),
    ).rejects.toThrow(McpDbError);
  });
});
