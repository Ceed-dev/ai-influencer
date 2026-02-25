/**
 * FEAT-MCC-035: approve_or_reject_plan
 * Spec: 04-agent-design.md §4.9 #5
 * Updates content status with approval or rejection decision.
 */
import type {
  ApproveOrRejectPlanInput,
  ApproveOrRejectPlanOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError, McpDbError } from '../../errors';

const VALID_DECISIONS = ['approve', 'reject'] as const;
const VALID_REJECTION_CATEGORIES = ['plan_revision', 'data_insufficient', 'hypothesis_weak'] as const;

export async function approveOrRejectPlan(
  input: ApproveOrRejectPlanInput,
): Promise<ApproveOrRejectPlanOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required and must be non-empty');
  }
  if (!VALID_DECISIONS.includes(input.decision as typeof VALID_DECISIONS[number])) {
    throw new McpValidationError(
      `Invalid decision: "${input.decision}". Must be one of: ${VALID_DECISIONS.join(', ')}`,
    );
  }
  if (input.decision === 'reject' && input.rejection_category) {
    if (!VALID_REJECTION_CATEGORIES.includes(input.rejection_category as typeof VALID_REJECTION_CATEGORIES[number])) {
      throw new McpValidationError(
        `Invalid rejection_category: "${input.rejection_category}". Must be one of: ${VALID_REJECTION_CATEGORIES.join(', ')}`,
      );
    }
  }

  const pool = getPool();

  // Verify content exists and is in pending_approval status
  const checkRes = await pool.query(
    `SELECT content_id, status FROM content WHERE content_id = $1`,
    [input.content_id],
  );

  const contentRow = checkRes.rows[0] as { content_id: string; status: string } | undefined;
  if (!contentRow) {
    throw new McpNotFoundError(`Content not found: ${input.content_id}`);
  }

  if (input.decision === 'approve') {
    const updateRes = await pool.query(
      `UPDATE content
       SET status = 'approved', approved_by = 'human', approved_at = NOW(),
           approval_feedback = $2, updated_at = NOW()
       WHERE content_id = $1`,
      [input.content_id, input.feedback ?? null],
    );
    if (updateRes.rowCount === 0) {
      throw new McpDbError(`Failed to approve content: ${input.content_id}`);
    }
  } else {
    const updateRes = await pool.query(
      `UPDATE content
       SET status = 'rejected', approval_feedback = $2,
           rejection_category = $3, updated_at = NOW()
       WHERE content_id = $1`,
      [input.content_id, input.feedback ?? null, input.rejection_category ?? null],
    );
    if (updateRes.rowCount === 0) {
      throw new McpDbError(`Failed to reject content: ${input.content_id}`);
    }
  }

  return { success: true };
}
