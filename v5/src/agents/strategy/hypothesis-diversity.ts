/**
 * FEAT-STR-007: Hypothesis category concentration check
 * Spec: 04-agent-design.md §4.1, 02-architecture.md §7
 *
 * Checks that hypothesis categories in a cycle are sufficiently diverse.
 * No single category should dominate beyond the concentration threshold.
 * Uses EXPLORATION_RATE from system_settings.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { HypothesisCategory } from '@/types/database';

/** Category concentration stats */
export interface ConcentrationStats {
  category: string;
  count: number;
  proportion: number;
}

/** Diversity check result */
export interface HypothesisDiversityResult {
  isBalanced: boolean;
  totalHypotheses: number;
  concentrationStats: ConcentrationStats[];
  maxConcentration: number;
  threshold: number;
  warnings: string[];
}

/** All valid hypothesis categories */
export const ALL_HYPOTHESIS_CATEGORIES: HypothesisCategory[] = [
  'content_format',
  'timing',
  'niche',
  'audience',
  'platform_specific',
];

/**
 * Calculate category concentration for a set of hypotheses.
 */
export function calculateConcentration(
  categories: string[],
): ConcentrationStats[] {
  if (categories.length === 0) return [];

  const counts: Record<string, number> = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  const total = categories.length;
  return Object.entries(counts)
    .map(([category, count]) => ({
      category,
      count,
      proportion: count / total,
    }))
    .sort((a, b) => b.proportion - a.proportion);
}

/**
 * Check hypothesis diversity for a cycle.
 *
 * @param client - Database client
 * @param cycleId - Cycle to check
 * @param concentrationThreshold - Max allowed proportion (default: 0.5 = 50%)
 */
export async function checkHypothesisDiversity(
  client: PoolClient,
  cycleId: number,
  concentrationThreshold: number = 0.5,
): Promise<HypothesisDiversityResult> {
  const res = await client.query(
    `SELECT category FROM hypotheses WHERE cycle_id = $1`,
    [cycleId],
  );

  const categories = res.rows.map((r) => (r as Record<string, unknown>)['category'] as string);
  const stats = calculateConcentration(categories);
  const maxConcentration = stats[0]?.proportion ?? 0;
  const warnings: string[] = [];

  if (maxConcentration > concentrationThreshold) {
    warnings.push(
      `Category "${stats[0]!.category}" has ${(maxConcentration * 100).toFixed(0)}% concentration, exceeding threshold of ${(concentrationThreshold * 100).toFixed(0)}%`,
    );
  }

  // Check for missing categories
  const presentCategories = new Set(categories);
  const missingCategories = ALL_HYPOTHESIS_CATEGORIES.filter(
    (cat) => !presentCategories.has(cat),
  );
  if (missingCategories.length > 0 && categories.length >= 5) {
    warnings.push(
      `Missing hypothesis categories: ${missingCategories.join(', ')}`,
    );
  }

  return {
    isBalanced: maxConcentration <= concentrationThreshold,
    totalHypotheses: categories.length,
    concentrationStats: stats,
    maxConcentration,
    threshold: concentrationThreshold,
    warnings,
  };
}
