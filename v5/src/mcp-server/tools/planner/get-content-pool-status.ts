/**
 * FEAT-MCC-012: get_content_pool_status
 * Spec: 04-agent-design.md S4.4 #8
 * Returns content and publication status counts for a cluster.
 */
import type {
  GetContentPoolStatusInput,
  GetContentPoolStatusOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpDbError } from '../../errors';

export async function getContentPoolStatus(
  input: GetContentPoolStatusInput,
): Promise<GetContentPoolStatusOutput> {
  const pool = getPool();

  try {
    // Content counts grouped by status, filtered by cluster accounts
    const contentRes = await pool.query(
      `
      SELECT c.status, COUNT(*)::int AS cnt
      FROM content c
      JOIN accounts a ON a.character_id = c.character_id
      WHERE a.cluster = $1 AND a.status = 'active'
      GROUP BY c.status
      `,
      [input.cluster],
    );

    const contentCounts: Record<string, number> = {};
    for (const row of contentRes.rows) {
      const r = row as Record<string, unknown>;
      const status = r['status'] as string;
      contentCounts[status] = Number(r['cnt']);
    }

    // Publication counts grouped by status, filtered by cluster accounts
    const pubRes = await pool.query(
      `
      SELECT p.status, COUNT(*)::int AS cnt
      FROM publications p
      JOIN accounts a ON a.account_id = p.account_id
      WHERE a.cluster = $1 AND a.status = 'active'
      GROUP BY p.status
      `,
      [input.cluster],
    );

    const pubCounts: Record<string, number> = {};
    for (const row of pubRes.rows) {
      const r = row as Record<string, unknown>;
      const status = r['status'] as string;
      pubCounts[status] = Number(r['cnt']);
    }

    return {
      content: {
        pending_approval: contentCounts['pending_approval'] ?? 0,
        planned: contentCounts['planned'] ?? 0,
        producing: contentCounts['producing'] ?? 0,
        ready: contentCounts['ready'] ?? 0,
        analyzed: contentCounts['analyzed'] ?? 0,
      },
      publications: {
        scheduled: pubCounts['scheduled'] ?? 0,
        posted: pubCounts['posted'] ?? 0,
        measured: pubCounts['measured'] ?? 0,
      },
    };
  } catch (err) {
    throw new McpDbError('Failed to fetch content pool status', err);
  }
}
