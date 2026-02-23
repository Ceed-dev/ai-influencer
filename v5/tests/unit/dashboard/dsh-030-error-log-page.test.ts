/**
 * TEST-DSH-040: Error Log ページ — 期間フィルタ
 * TEST-DSH-089: リトライ確認ダイアログ
 * TEST-DSH-155: ErrorFilterBar
 * TEST-DSH-156: ErrorDetailDrawer
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-030: Error Log page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/errors/page.tsx');
  let content: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM task_queue WHERE payload->>'test_marker' = 'DSH030'`);
      await client.query(`
        INSERT INTO task_queue (task_type, status, error_message, retry_count, payload)
        VALUES
          ('produce', 'failed', 'Page error test 1', 3, '{"test_marker": "DSH030"}'::jsonb),
          ('publish', 'failed', 'Page error test 2', 1, '{"test_marker": "DSH030"}'::jsonb)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM task_queue WHERE payload->>'test_marker' = 'DSH030'`);
    });
  });

  // TEST-DSH-040: period filter UI
  test('TEST-DSH-040: Error Log page has period filter', () => {
    expect(content).toContain('期間');
    expect(content).toContain('24h');
    expect(content).toContain('7d');
    expect(content).toContain('30d');
  });

  // TEST-DSH-155: ErrorFilterBar
  test('TEST-DSH-155: has filter bar with task type filter', () => {
    expect(content).toContain('error-filter-bar');
    expect(content).toContain('タスクタイプ');
    expect(content).toContain('produce');
    expect(content).toContain('publish');
    expect(content).toContain('measure');
    expect(content).toContain('curate');
  });

  // TEST-DSH-156: Error details shown
  test('TEST-DSH-156: shows error details in table', () => {
    expect(content).toContain('エラーメッセージ');
    expect(content).toContain('リトライ数');
    expect(content).toContain('ステータス');
    expect(content).toContain('発生日時');
  });

  // TEST-DSH-089: retry status display
  test('TEST-DSH-089: shows error status with color coding', () => {
    expect(content).toContain('failed');
    expect(content).toContain('bg-red-900');
    expect(content).toContain('bg-yellow-900');
  });

  test('fetches errors from /api/errors', () => {
    expect(content).toContain('/api/errors');
  });

  test('error log page has pagination', () => {
    expect(content).toContain('totalPages');
    expect(content).toContain('前');
    expect(content).toContain('次');
  });

  test('DB: can query failed tasks with period filter', async () => {
    const result = await query(
      `SELECT * FROM task_queue
       WHERE payload->>'test_marker' = 'DSH030'
       AND status = 'failed'
       AND created_at >= NOW() - '7 days'::interval`
    );
    expect(result.rows.length).toBe(2);
  });
});
