/**
 * FEAT-MCC-038: update_prompt_suggestion_status
 * Spec: 04-agent-design.md §4.9 #10
 * Updates the status of a prompt suggestion.
 */
import type {
  UpdatePromptSuggestionStatusInput,
  UpdatePromptSuggestionStatusOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError, McpDbError } from '../../errors';

const VALID_STATUSES = ['accepted', 'rejected', 'on_hold'] as const;

export async function updatePromptSuggestionStatus(
  input: UpdatePromptSuggestionStatusInput,
): Promise<UpdatePromptSuggestionStatusOutput> {
  if (typeof input.suggestion_id !== 'number' || input.suggestion_id < 1) {
    throw new McpValidationError('suggestion_id must be a positive number');
  }
  if (!VALID_STATUSES.includes(input.status as typeof VALID_STATUSES[number])) {
    throw new McpValidationError(
      `Invalid status: "${input.status}". Must be one of: ${VALID_STATUSES.join(', ')}`,
    );
  }

  const pool = getPool();

  // Verify suggestion exists
  const checkRes = await pool.query(
    `SELECT id FROM prompt_suggestions WHERE id = $1`,
    [input.suggestion_id],
  );
  if (checkRes.rowCount === 0) {
    throw new McpNotFoundError(`Prompt suggestion not found: ${input.suggestion_id}`);
  }

  // Map 'on_hold' to a DB-compatible status — store as 'pending' with human_feedback
  const dbStatus = input.status === 'on_hold' ? 'pending' : input.status;
  const resolvedAt = input.status === 'on_hold' ? null : new Date().toISOString();

  const updateRes = await pool.query(
    `UPDATE prompt_suggestions
     SET status = $2, resolved_at = $3,
         human_feedback = CASE WHEN $4 = true THEN 'on_hold' ELSE human_feedback END
     WHERE id = $1`,
    [input.suggestion_id, dbStatus, resolvedAt, input.status === 'on_hold'],
  );

  if (updateRes.rowCount === 0) {
    throw new McpDbError(`Failed to update prompt suggestion id=${input.suggestion_id}`);
  }

  return { success: true };
}
