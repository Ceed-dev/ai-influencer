/**
 * MCI-045: run_kpi_snapshot
 * Spec: 04-agent-design.md §4.3 #21
 *
 * Wraps src/workers/algorithm/kpi-snapshot.ts runKpiSnapshotGeneration.
 * Monthly KPI snapshot calculation + UPSERT.
 */
import type {
  RunKpiSnapshotInput,
  RunKpiSnapshotOutput,
} from '@/types/mcp-tools';
import type { Platform } from '@/types/database';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';
import { runKpiSnapshotGeneration } from '../../../workers/algorithm/kpi-snapshot.js';

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function runKpiSnapshot(
  input: RunKpiSnapshotInput,
): Promise<RunKpiSnapshotOutput> {
  if (!input.year_month || !YEAR_MONTH_REGEX.test(input.year_month)) {
    throw new McpValidationError(
      `Invalid year_month: "${input.year_month}". Must be in YYYY-MM format`,
    );
  }

  const pool = getPool();
  const results = await runKpiSnapshotGeneration(input.year_month, pool);

  const platforms = results.map((r) => ({
    platform: r.platform as Platform,
    achievement_rate: Number(r.achievementRate.toFixed(4)),
    prediction_accuracy: r.predictionAccuracy !== null
      ? Number(r.predictionAccuracy.toFixed(4))
      : 0,
    is_reliable: r.isReliable,
  }));

  return { platforms };
}
