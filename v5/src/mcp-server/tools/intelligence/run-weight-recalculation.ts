/**
 * MCI-042: run_weight_recalculation
 * Spec: 04-agent-design.md §4.3 #18
 *
 * Wraps src/workers/algorithm/weight-recalc.ts recalcWeightsForPlatform.
 * Error Correlation -> EMA -> clip -> normalize -> UPSERT + audit log.
 */
import type {
  RunWeightRecalculationInput,
  RunWeightRecalculationOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';
import { recalcWeightsForPlatform } from '../../../workers/algorithm/weight-recalc.js';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function runWeightRecalculation(
  input: RunWeightRecalculationInput,
): Promise<RunWeightRecalculationOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as typeof VALID_PLATFORMS[number])) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Get old weights before recalculation
    const oldWeightsRes = await client.query(
      `SELECT factor_name, weight FROM prediction_weights WHERE platform = $1`,
      [input.platform],
    );
    const oldWeights: Record<string, number> = {};
    for (const row of oldWeightsRes.rows as Array<Record<string, unknown>>) {
      oldWeights[row['factor_name'] as string] = Number(row['weight']);
    }

    // Run recalculation
    const result = await recalcWeightsForPlatform(input.platform, client);

    if (!result.performed) {
      return {
        factors: [],
        data_count: 0,
        skipped_reason: result.reason ?? 'Unknown reason',
      };
    }

    // Get new weights after recalculation
    const newWeightsRes = await client.query(
      `SELECT factor_name, weight FROM prediction_weights WHERE platform = $1`,
      [input.platform],
    );

    const factors = (newWeightsRes.rows as Array<Record<string, unknown>>).map((row) => ({
      name: row['factor_name'] as string,
      old_weight: Number((oldWeights[row['factor_name'] as string] ?? 0).toFixed(6)),
      new_weight: Number(Number(row['weight']).toFixed(6)),
    }));

    // Get data_count from the most recent audit log entry
    const auditRes = await client.query(
      `SELECT data_count FROM weight_audit_log
       WHERE platform = $1
       ORDER BY calculated_at DESC
       LIMIT 1`,
      [input.platform],
    );
    const data_count = Number(
      (auditRes.rows[0] as Record<string, unknown> | undefined)?.['data_count'] ?? 0,
    );

    return {
      factors,
      data_count,
      skipped_reason: null,
    };
  } finally {
    client.release();
  }
}
