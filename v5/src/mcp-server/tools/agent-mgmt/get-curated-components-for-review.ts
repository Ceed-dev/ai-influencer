/**
 * FEAT-MCC-039: get_curated_components_for_review
 * Spec: 04-agent-design.md §4.11 #1
 * Returns components with review_status='pending_review' for human review.
 */
import type {
  GetCuratedComponentsForReviewInput,
  GetCuratedComponentsForReviewOutput,
} from '@/types/mcp-tools';
import type { ComponentType } from '@/types/database';
import { getPool } from '../../db';

export async function getCuratedComponentsForReview(
  _input: GetCuratedComponentsForReviewInput,
): Promise<GetCuratedComponentsForReviewOutput> {
  const pool = getPool();

  const res = await pool.query(`
    SELECT component_id, type, data, curation_confidence
    FROM components
    WHERE review_status = 'pending_review'
    ORDER BY created_at ASC
  `);

  const components = res.rows.map((row) => ({
    component_id: row.component_id as string,
    type: row.type as ComponentType,
    data: (row.data as Record<string, unknown> | null) ?? {},
    curator_confidence: (row.curation_confidence as number | null) ?? 0,
  }));

  return { components };
}
