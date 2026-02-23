/**
 * TEST-MCP-031: request_production — inserts into task_queue
 */
import { requestProduction } from '@/src/mcp-server/tools/planner/request-production';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { withClient } from '../../helpers/db';

describe('FEAT-MCC-010: request_production', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    // Clean up task_queue entries created by tests
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM task_queue WHERE task_type = 'produce' AND payload->>'content_id' LIKE '${PREFIX}%'`,
      );
    });
    await cleanupBaseData();
  });

  // TEST-MCP-031: inserts task into task_queue and returns task_id
  test('TEST-MCP-031: inserts production task into task_queue', async () => {
    const result = await requestProduction({
      content_id: `${PREFIX}CNT_003`,
      priority: 5,
    });

    expect(result).toHaveProperty('task_id');
    expect(typeof result.task_id).toBe('number');
    expect(result.task_id).toBeGreaterThan(0);

    // Verify the task was actually inserted
    await withClient(async (client) => {
      const res = await client.query(
        `SELECT * FROM task_queue WHERE id = $1`,
        [result.task_id],
      );
      expect(res.rowCount).toBe(1);

      const row = res.rows[0] as Record<string, unknown>;
      expect(row['task_type']).toBe('produce');
      expect(row['status']).toBe('pending');
      expect(row['priority']).toBe(5);

      const payload = row['payload'] as Record<string, unknown>;
      expect(payload['content_id']).toBe(`${PREFIX}CNT_003`);
    });
  });

  // Default priority = 0
  test('inserts with priority 0', async () => {
    const result = await requestProduction({
      content_id: `${PREFIX}CNT_001`,
      priority: 0,
    });

    expect(result.task_id).toBeGreaterThan(0);

    await withClient(async (client) => {
      const res = await client.query(
        `SELECT priority FROM task_queue WHERE id = $1`,
        [result.task_id],
      );
      expect((res.rows[0] as Record<string, unknown>)['priority']).toBe(0);
    });
  });
});
