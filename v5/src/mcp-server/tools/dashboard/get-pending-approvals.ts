/**
 * FEAT-MCC-036: get_pending_approvals
 * Spec: 04-agent-design.md §4.9 #4
 * Returns content plans waiting for human approval.
 */
import type {
  GetPendingApprovalsInput,
  GetPendingApprovalsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';

export async function getPendingApprovals(
  _input: GetPendingApprovalsInput,
): Promise<GetPendingApprovalsOutput> {
  const pool = getPool();

  const res = await pool.query(`
    SELECT c.content_id,
           COALESCE(h.statement, '') AS hypothesis,
           COALESCE(c.production_metadata::text, '{}') AS plan_summary,
           0 AS cost_estimate,
           c.created_at
    FROM content c
    LEFT JOIN hypotheses h ON h.id = c.hypothesis_id
    WHERE c.status = 'pending_approval'
    ORDER BY c.created_at ASC
  `);

  const approvals = res.rows.map((row) => ({
    content_id: row.content_id as string,
    hypothesis: row.hypothesis as string,
    plan_summary: row.plan_summary as string,
    cost_estimate: row.cost_estimate as number,
    created_at: (row.created_at as Date).toISOString(),
  }));

  return { approvals };
}
