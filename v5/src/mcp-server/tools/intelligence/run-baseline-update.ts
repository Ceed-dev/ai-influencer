/**
 * MCI-043: run_baseline_update
 * Spec: 04-agent-design.md §4.3 #19
 *
 * Wraps src/workers/algorithm/baseline.ts runBaselineUpdate.
 * Daily baseline calculation for all accounts or a specific account.
 */
import type {
  RunBaselineUpdateInput,
  RunBaselineUpdateOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { runBaselineUpdate } from '../../../workers/algorithm/baseline.js';

export async function runBaselineUpdateTool(
  input: RunBaselineUpdateInput,
): Promise<RunBaselineUpdateOutput> {
  const pool = getPool();

  // Run baseline update using the worker
  const result = await runBaselineUpdate(pool);

  // Get source breakdown from account_baselines
  const breakdownRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE source = 'own_history')::int AS own_history,
       COUNT(*) FILTER (WHERE source = 'cohort')::int AS cohort,
       COUNT(*) FILTER (WHERE source = 'default')::int AS "default"
     FROM account_baselines
     ${input.account_id ? 'WHERE account_id = $1' : ''}`,
    input.account_id ? [input.account_id] : [],
  );

  const breakdown = breakdownRes.rows[0] as Record<string, unknown>;

  return {
    updated_count: result.rowCount,
    source_breakdown: {
      own_history: Number(breakdown['own_history'] ?? 0),
      cohort: Number(breakdown['cohort'] ?? 0),
      default: Number(breakdown['default'] ?? 0),
    },
  };
}
