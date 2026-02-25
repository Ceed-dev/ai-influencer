/**
 * TEST-MCP-028: get_measurement_tasks — normal + empty + validation
 * FEAT-MCC-028
 */
import { getMeasurementTasks } from '@/src/mcp-server/tools/measurement/get-measurement-tasks';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { withClient } from '../../helpers/db';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-028: get_measurement_tasks', () => {
  let insertedTaskId: number;

  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();

    const res = await withClient(async (client) => {
      const r = await client.query(
        `INSERT INTO task_queue (task_type, payload, status, priority)
         VALUES ('measure', $1, 'pending', 5)
         RETURNING id`,
        [JSON.stringify({
          publication_id: 1,
          platform: 'youtube',
          platform_post_id: 'yt_post_001',
        })],
      );
      return r;
    });
    insertedTaskId = res.rows[0]?.id as number;
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM task_queue WHERE payload::text LIKE '%yt_post_001%'`,
      );
    });
    await cleanupBaseData();
  });

  test('TEST-MCP-028a: returns measurement tasks', async () => {
    const result = await getMeasurementTasks({ limit: 10 });

    expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    const task = result.tasks.find((t) => t.task_id === insertedTaskId);
    expect(task).toBeDefined();
    expect(task?.platform).toBe('youtube');
    expect(task?.platform_post_id).toBe('yt_post_001');
  });

  test('TEST-MCP-028b: respects limit parameter', async () => {
    const result = await getMeasurementTasks({ limit: 1 });
    expect(result.tasks.length).toBeLessThanOrEqual(1);
  });

  test('TEST-MCP-028c: throws McpValidationError for invalid limit', async () => {
    await expect(
      getMeasurementTasks({ limit: 0 }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      getMeasurementTasks({ limit: 101 }),
    ).rejects.toThrow(McpValidationError);
  });
});
