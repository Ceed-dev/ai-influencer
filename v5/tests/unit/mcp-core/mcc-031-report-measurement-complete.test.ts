/**
 * TEST-MCP-031: report_measurement_complete — normal + validation
 * FEAT-MCC-031
 */
import { reportMeasurementComplete } from '@/src/mcp-server/tools/measurement/report-measurement-complete';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { withClient } from '../../helpers/db';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-031: report_measurement_complete', () => {
  let taskId: number;
  let publicationId: number;

  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();

    // Get a publication ID from seed data
    const pubRes = await withClient(async (client) => {
      return client.query(
        `SELECT id FROM publications WHERE content_id = '${PREFIX}CNT_001' LIMIT 1`,
      );
    });
    publicationId = pubRes.rows[0]?.id as number;

    // Insert a measure task
    const taskRes = await withClient(async (client) => {
      return client.query(
        `INSERT INTO task_queue (task_type, payload, status, priority)
         VALUES ('measure', $1, 'processing', 5)
         RETURNING id`,
        [JSON.stringify({ publication_id: publicationId, platform: 'youtube' })],
      );
    });
    taskId = taskRes.rows[0]?.id as number;
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM metrics WHERE publication_id = $1 AND measurement_point = '48h'
         AND id NOT IN (
           SELECT id FROM metrics WHERE publication_id = $1
           ORDER BY id ASC LIMIT 1
         )`,
        [publicationId],
      );
      await client.query(
        `DELETE FROM task_queue WHERE payload::text LIKE '%${PREFIX}%' OR id = $1`,
        [taskId],
      );
    });
    await cleanupBaseData();
  });

  test('TEST-MCP-031a: inserts metrics and completes task', async () => {
    const result = await reportMeasurementComplete({
      task_id: taskId,
      publication_id: publicationId,
      metrics_data: { views: 5000, likes: 200, comments: 50, shares: 20 },
    });

    expect(result).toEqual({ success: true });

    // Verify task status
    const taskRes = await withClient(async (client) => {
      return client.query(
        `SELECT status FROM task_queue WHERE id = $1`,
        [taskId],
      );
    });
    expect(taskRes.rows[0]?.status).toBe('completed');
  });

  test('TEST-MCP-031b: throws McpValidationError for invalid task_id', async () => {
    await expect(
      reportMeasurementComplete({
        task_id: -1,
        publication_id: publicationId,
        metrics_data: { views: 100 },
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-031c: throws McpValidationError for invalid publication_id', async () => {
    await expect(
      reportMeasurementComplete({
        task_id: 1,
        publication_id: 0,
        metrics_data: { views: 100 },
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
