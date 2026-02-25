/**
 * MCI-012: update_learning_confidence — UPDATE learnings.confidence
 * Spec: 04-agent-design.md §4.3 #6
 */
import type {
  UpdateLearningConfidenceInput,
  UpdateLearningConfidenceOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function updateLearningConfidence(
  input: UpdateLearningConfidenceInput,
): Promise<UpdateLearningConfidenceOutput> {
  if (input.new_confidence < 0 || input.new_confidence > 1) {
    throw new McpValidationError('new_confidence must be between 0 and 1');
  }
  if (!input.additional_evidence || input.additional_evidence.trim().length === 0) {
    throw new McpValidationError('additional_evidence is required');
  }

  const pool = getPool();

  const res = await pool.query(
    `UPDATE learnings
     SET confidence = $1,
         evidence_count = evidence_count + 1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [input.new_confidence, input.learning_id],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(`Learning with id ${input.learning_id} not found`);
  }

  return { success: true };
}
