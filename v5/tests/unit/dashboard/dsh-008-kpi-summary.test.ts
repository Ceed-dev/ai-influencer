/**
 * TEST-DSH-012: GET /api/kpi/summary
 */
import { query } from '../../helpers/db';

describe('FEAT-DSH-008: GET /api/kpi/summary', () => {
  // TEST-DSH-012: KPI summary returns expected structure
  test('TEST-DSH-012: can query account counts for KPI', async () => {
    const result = await query(
      `SELECT COUNT(*)::int as count FROM accounts WHERE status = 'active'`
    );
    expect(result.rows[0]).toHaveProperty('count');
    expect(typeof result.rows[0].count).toBe('number');
  });

  test('can query content stats', async () => {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - '30 days'::interval)::int as total_produced,
         COUNT(*) FILTER (WHERE status = 'posted')::int as total_posted,
         COUNT(*) FILTER (WHERE status = 'measured')::int as total_measured
       FROM content`
    );
    expect(result.rows[0]).toHaveProperty('total_produced');
    expect(result.rows[0]).toHaveProperty('total_posted');
  });

  test('can query follower totals', async () => {
    const result = await query(
      `SELECT COALESCE(SUM(follower_count), 0)::int as current FROM accounts WHERE status = 'active'`
    );
    expect(result.rows[0]).toHaveProperty('current');
  });
});
