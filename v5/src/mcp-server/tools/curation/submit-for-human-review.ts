/**
 * MCI-019: submit_for_human_review — UPDATE review_status
 * Spec: 04-agent-design.md §4.10 #6
 */
import type {
  SubmitForHumanReviewInput,
  SubmitForHumanReviewOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function submitForHumanReview(
  input: SubmitForHumanReviewInput,
): Promise<SubmitForHumanReviewOutput> {
  if (!input.component_ids || input.component_ids.length === 0) {
    throw new McpValidationError('component_ids must have at least one entry');
  }
  if (!input.summary || input.summary.trim().length === 0) {
    throw new McpValidationError('summary is required');
  }

  const pool = getPool();

  // Update review_status for all specified components
  await pool.query(
    `UPDATE components
     SET review_status = 'pending_review', updated_at = NOW()
     WHERE component_id = ANY($1)`,
    [input.component_ids],
  );

  return { success: true };
}
