/**
 * FEAT-MCC-006: get_pending_directives
 * Spec: 04-agent-design.md S4.1 #6
 * Returns pending human directives ordered by priority and creation time.
 */
import type {
  GetPendingDirectivesInput,
  GetPendingDirectivesOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';

const PRIORITY_MAP: Record<string, number> = {
  urgent: 10,
  high: 7,
  normal: 4,
  low: 1,
};

export async function getPendingDirectives(
  _input: GetPendingDirectivesInput,
): Promise<GetPendingDirectivesOutput> {
  const pool = getPool();

  const res = await pool.query(`
    SELECT id, directive_type, content, priority, created_at
    FROM human_directives
    WHERE status = 'pending'
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      created_at ASC
  `);

  return {
    directives: res.rows.map((r: Record<string, unknown>) => ({
      id: r['id'] as number,
      directive_type: r['directive_type'] as string,
      content: r['content'] as string,
      priority: PRIORITY_MAP[r['priority'] as string] ?? 4,
      created_at: (r['created_at'] as Date).toISOString(),
    })),
  };
}
