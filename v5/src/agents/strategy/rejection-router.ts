/**
 * FEAT-STR-004: Route by rejection_category
 * Spec: 04-agent-design.md §5.1, 02-architecture.md §3.3
 *
 * Routes rejected plans to the appropriate node based on rejection_category:
 * - plan_revision → plan_content (default)
 * - data_insufficient → collect_intel
 * - hypothesis_weak → analyze_cycle
 * All config from DB system_settings — no hardcoding.
 */
import type { RejectionCategory } from '@/types/database';

/** Routing target for rejected plans */
export type RejectionTarget =
  | 'plan_content'
  | 'collect_intel'
  | 'analyze_cycle';

/**
 * Route a rejection to the appropriate graph node.
 *
 * @param category - Rejection category from human/AI review
 * @returns Target node name for the graph
 */
export function routeRejection(
  category: RejectionCategory | null | undefined,
): RejectionTarget {
  switch (category) {
    case 'data_insufficient':
      return 'collect_intel';
    case 'hypothesis_weak':
      return 'analyze_cycle';
    case 'plan_revision':
    default:
      return 'plan_content';
  }
}

/**
 * Get a human-readable explanation for the rejection routing.
 */
export function getRejectionExplanation(
  category: RejectionCategory | null | undefined,
): string {
  switch (category) {
    case 'data_insufficient':
      return 'Rejection: insufficient data. Routing back to collect_intel for additional market research.';
    case 'hypothesis_weak':
      return 'Rejection: weak hypothesis. Routing back to analyze_cycle for deeper analysis.';
    case 'plan_revision':
      return 'Rejection: plan needs revision. Routing back to plan_content for adjustments.';
    default:
      return 'Rejection: unspecified reason. Routing to plan_content for revision (default).';
  }
}

/**
 * Validate that a rejection category is valid.
 */
export function isValidRejectionCategory(
  category: string,
): category is RejectionCategory {
  return ['plan_revision', 'data_insufficient', 'hypothesis_weak'].includes(category);
}
