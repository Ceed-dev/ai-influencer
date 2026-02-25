/**
 * FEAT-MCC-007: get_assigned_accounts
 * Spec: 04-agent-design.md S4.4 #1
 * Returns list of active accounts for a given cluster.
 */
import type {
  GetAssignedAccountsInput,
  GetAssignedAccountsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpDbError } from '../../errors';

export async function getAssignedAccounts(
  input: GetAssignedAccountsInput,
): Promise<GetAssignedAccountsOutput> {
  const pool = getPool();

  try {
    const res = await pool.query(
      `
      SELECT account_id, platform, niche, follower_count, status
      FROM accounts
      WHERE cluster = $1 AND status = 'active'
      ORDER BY account_id
      `,
      [input.cluster],
    );

    const accounts = res.rows.map((row: Record<string, unknown>) => ({
      account_id: row['account_id'] as string,
      platform: row['platform'] as GetAssignedAccountsOutput['accounts'][number]['platform'],
      niche: (row['niche'] as string) ?? '',
      follower_count: Number(row['follower_count']),
      status: row['status'] as string,
    }));

    return { accounts };
  } catch (err) {
    throw new McpDbError('Failed to fetch assigned accounts', err);
  }
}
