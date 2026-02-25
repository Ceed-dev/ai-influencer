/**
 * TEST-MCP-013: get_production_task — normal + empty queue
 * FEAT-MCC-013
 */
import { getProductionTask } from '@/src/mcp-server/tools/production/get-production-task';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { withClient } from '../../helpers/db';

describe('FEAT-MCC-013: get_production_task', () => {
  let insertedTaskId: number | null = null;

  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();

    // Insert a production task into task_queue
    const res = await withClient(async (client) => {
      const r = await client.query(
        `INSERT INTO task_queue (task_type, payload, status, priority)
         VALUES ('produce', $1, 'pending', 5)
         RETURNING id`,
        [JSON.stringify({ content_id: `${PREFIX}CNT_001`, extra: 'data' })],
      );
      return r;
    });
    insertedTaskId = res.rows[0]?.id as number ?? null;
  });

  afterAll(async () => {
    // Cleanup task_queue entries
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM task_queue WHERE payload::text LIKE '%${PREFIX}%'`,
      );
    });
    await cleanupBaseData();
  });

  test('TEST-MCP-013a: returns a task when pending produce tasks exist', async () => {
    const result = await getProductionTask({});

    expect(result).not.toBeNull();
    expect(result!.task_id).toBe(insertedTaskId);
    expect(result!.content_id).toBe(`${PREFIX}CNT_001`);
    expect(result!.payload).toHaveProperty('content_id');
    expect(result!.payload['extra']).toBe('data');
  });

  test('TEST-MCP-013b: returns null when queue is empty', async () => {
    // First call already moved the task to processing, so queue should be empty
    const result = await getProductionTask({});
    expect(result).toBeNull();
  });

  test('TEST-MCP-013c: output has required keys', async () => {
    // Insert another task to verify structure
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO task_queue (task_type, payload, status, priority)
         VALUES ('produce', $1, 'queued', 1)`,
        [JSON.stringify({ content_id: `${PREFIX}CNT_002` })],
      );
    });

    const result = await getProductionTask({});
    expect(result).not.toBeNull();
    expect(typeof result!.task_id).toBe('number');
    expect(typeof result!.content_id).toBe('string');
    expect(typeof result!.payload).toBe('object');
  });
});
