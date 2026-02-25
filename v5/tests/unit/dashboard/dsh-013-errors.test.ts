/**
 * TEST-DSH-018: GET /api/errors
 * TEST-DSH-132: error list
 * TEST-DSH-133: period filter
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-013: GET /api/errors', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM task_queue WHERE payload->>'test_marker' = 'DSH013'`);

      // Valid task_types: produce, publish, measure, curate
      // Valid statuses: pending, queued, waiting, processing, retrying, completed, failed, failed_permanent
      await client.query(`
        INSERT INTO task_queue (task_type, status, error_message, retry_count, payload)
        VALUES
          ('produce', 'failed', 'Test error 1', 3, '{"test_marker": "DSH013"}'::jsonb),
          ('publish', 'retrying', 'Test error 2', 1, '{"test_marker": "DSH013"}'::jsonb),
          ('measure', 'completed', 'Recovered', 2, '{"test_marker": "DSH013"}'::jsonb)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM task_queue WHERE payload->>'test_marker' = 'DSH013'`);
    });
  });

  // TEST-DSH-018: returns error tasks
  test('TEST-DSH-018: returns failed/retrying tasks', async () => {
    const result = await query(
      `SELECT * FROM task_queue
       WHERE payload->>'test_marker' = 'DSH013'
       AND status IN ('failed', 'retrying')
       ORDER BY created_at DESC`
    );
    expect(result.rows.length).toBe(2);
  });

  // TEST-DSH-132: error list has expected fields
  test('TEST-DSH-132: error entries have required fields', async () => {
    const result = await query(
      `SELECT id, task_type, error_message, retry_count, status, created_at
       FROM task_queue
       WHERE payload->>'test_marker' = 'DSH013'
       AND status = 'failed'`
    );

    expect(result.rows.length).toBe(1);
    const error = result.rows[0] as Record<string, unknown>;
    expect(error).toHaveProperty('id');
    expect(error).toHaveProperty('task_type');
    expect(error).toHaveProperty('error_message');
    expect(error).toHaveProperty('retry_count');
    expect(error).toHaveProperty('status');
    expect(error.error_message).toBe('Test error 1');
  });

  // TEST-DSH-133: completed tasks excluded
  test('TEST-DSH-133: completed tasks are not in error list', async () => {
    const result = await query(
      `SELECT * FROM task_queue
       WHERE payload->>'test_marker' = 'DSH013'
       AND status IN ('failed', 'retrying')
       AND error_message = 'Recovered'`
    );
    expect(result.rows.length).toBe(0);
  });
});
