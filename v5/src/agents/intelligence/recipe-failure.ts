/**
 * FEAT-INT-016: Recipe failure threshold check
 * Spec: 04-agent-design.md §4.5, 02-architecture.md §6
 *
 * RECIPE_FAILURE_THRESHOLD (default: 0.3 = 30%) — if a production recipe's
 * failure rate exceeds this threshold, it should be flagged or deactivated.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import { getSettingNumber } from '../../lib/settings.js';

/** Recipe failure stats */
export interface RecipeFailureStats {
  recipeId: number;
  recipeName: string;
  timesUsed: number;
  successRate: number | null;
  failureRate: number;
  exceedsThreshold: boolean;
}

/** Result of failure threshold check */
export interface RecipeFailureCheckResult {
  threshold: number;
  checkedCount: number;
  flaggedRecipes: RecipeFailureStats[];
  deactivatedCount: number;
}

/**
 * Check if a recipe's failure rate exceeds the threshold.
 */
export function exceedsFailureThreshold(
  successRate: number | null,
  threshold: number,
): boolean {
  if (successRate === null) return false; // No data yet
  const failureRate = 1 - successRate;
  return failureRate > threshold;
}

/**
 * Check all active recipes for failure rate threshold violations.
 * Optionally deactivates recipes that exceed the threshold.
 *
 * @param client - Database client
 * @param deactivate - If true, set is_active=false on flagged recipes
 */
export async function checkRecipeFailures(
  client: PoolClient,
  deactivate: boolean = false,
): Promise<RecipeFailureCheckResult> {
  const threshold = await getSettingNumber('RECIPE_FAILURE_THRESHOLD', client);

  const res = await client.query(
    `SELECT id, recipe_name, times_used, success_rate
     FROM production_recipes
     WHERE is_active = true AND times_used > 0
     ORDER BY success_rate ASC NULLS LAST`,
  );

  const flaggedRecipes: RecipeFailureStats[] = [];

  for (const row of res.rows) {
    const r = row as Record<string, unknown>;
    const successRate = r['success_rate'] != null ? Number(r['success_rate']) : null;
    const failureRate = successRate != null ? 1 - successRate : 0;
    const exceeds = exceedsFailureThreshold(successRate, threshold);

    if (exceeds) {
      flaggedRecipes.push({
        recipeId: Number(r['id']),
        recipeName: r['recipe_name'] as string,
        timesUsed: Number(r['times_used']),
        successRate,
        failureRate,
        exceedsThreshold: true,
      });
    }
  }

  let deactivatedCount = 0;
  if (deactivate && flaggedRecipes.length > 0) {
    const ids = flaggedRecipes.map((r) => r.recipeId);
    const deactivateRes = await client.query(
      `UPDATE production_recipes
       SET is_active = false, updated_at = NOW()
       WHERE id = ANY($1) AND is_default = false`,
      [ids],
    );
    deactivatedCount = deactivateRes.rowCount ?? 0;
  }

  return {
    threshold,
    checkedCount: res.rows.length,
    flaggedRecipes,
    deactivatedCount,
  };
}
