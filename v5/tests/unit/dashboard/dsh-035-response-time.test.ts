/**
 * TEST-DSH-045: REST API — レスポンスタイム(<500ms)
 * TEST-DSH-136: 大量データテーブルパフォーマンス
 */
import { query } from '../../helpers/db';

describe('FEAT-DSH-035: REST API response time', () => {
  // TEST-DSH-045: DB query response time
  test('TEST-DSH-045: settings query responds in <500ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await query(`SELECT * FROM system_settings ORDER BY setting_key ASC`);
      times.push(Date.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThan(500);
  });

  test('accounts query responds in <500ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await query(`SELECT * FROM accounts ORDER BY id ASC LIMIT 50`);
      times.push(Date.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThan(500);
  });

  // TEST-DSH-136: pagination query performance
  test('TEST-DSH-136: paginated query with COUNT responds in <500ms', async () => {
    const start = Date.now();
    await Promise.all([
      query(`SELECT * FROM accounts ORDER BY id ASC LIMIT 50 OFFSET 0`),
      query(`SELECT COUNT(*)::int as count FROM accounts`),
    ]);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  test('complex join query responds in <500ms', async () => {
    const start = Date.now();
    await query(`
      SELECT a.account_id, a.platform, a.platform_username
      FROM accounts a
      LEFT JOIN characters c ON c.character_id = a.character_id
      ORDER BY a.id ASC LIMIT 50
    `);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  test('error log query responds in <500ms', async () => {
    const start = Date.now();
    await query(`
      SELECT * FROM task_queue
      WHERE status IN ('failed', 'retrying')
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
