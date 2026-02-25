/**
 * FEAT-MCC-030: collect_account_metrics
 * Spec: 04-agent-design.md §4.8 #6
 * Returns follower_count and follower_delta for an account.
 * Queries accounts table for current follower_count and computes delta from metrics.
 */
import type {
  CollectAccountMetricsInput,
  CollectAccountMetricsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function collectAccountMetrics(
  input: CollectAccountMetricsInput,
): Promise<CollectAccountMetricsOutput> {
  if (!input.account_id || input.account_id.trim() === '') {
    throw new McpValidationError('account_id is required and must be non-empty');
  }

  const pool = getPool();

  // Get current follower count
  const accountRes = await pool.query(
    `SELECT follower_count FROM accounts WHERE account_id = $1`,
    [input.account_id],
  );

  const accountRow = accountRes.rows[0] as { follower_count: number } | undefined;
  if (!accountRow) {
    throw new McpNotFoundError(`Account not found: ${input.account_id}`);
  }

  // Compute follower delta from recent metrics (last 7 days)
  const deltaRes = await pool.query(
    `SELECT COALESCE(SUM(m.follower_delta), 0)::int AS total_delta
     FROM metrics m
     JOIN publications p ON p.id = m.publication_id
     WHERE p.account_id = $1
       AND m.measured_at >= NOW() - INTERVAL '7 days'`,
    [input.account_id],
  );

  const deltaRow = deltaRes.rows[0] as { total_delta: number } | undefined;
  const followerDelta = deltaRow?.total_delta ?? 0;

  return {
    follower_count: accountRow.follower_count,
    follower_delta: followerDelta,
  };
}
