/**
 * Tests for mark_curation_complete
 */
import { markCurationComplete } from '@/src/mcp-server/tools/curation/mark-curation-complete';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';
import { withClient, query } from '../../helpers/db';

describe('mark_curation_complete', () => {
  let queueId: number;

  beforeAll(async () => {
    await withClient(async (client) => {
      const res = await client.query(`
        INSERT INTO task_queue (task_type, payload, status, priority)
        VALUES ('curate', '{"source": "test_curation"}', 'processing', 0)
        RETURNING id
      `);
      queueId = res.rows[0].id;
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM task_queue WHERE id = $1`, [queueId]);
    });
  });

  test('marks curation task as complete', async () => {
    const result = await markCurationComplete({
      queue_id: queueId,
      result_component_ids: ['SCN_0001', 'SCN_0002'],
    });
    expect(result).toEqual({ success: true });

    // Verify DB state
    const dbResult = await query(
      `SELECT status, completed_at FROM task_queue WHERE id = $1`,
      [queueId]
    );
    expect(dbResult.rows[0].status).toBe('completed');
    expect(dbResult.rows[0].completed_at).not.toBeNull();
  });

  test('rejects invalid queue_id', async () => {
    await expect(
      markCurationComplete({ queue_id: 0, result_component_ids: [] }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws NotFoundError for nonexistent queue entry', async () => {
    await expect(
      markCurationComplete({ queue_id: 999999, result_component_ids: [] }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
