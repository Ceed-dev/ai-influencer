/**
 * MCI-032: save_micro_reflection
 * Spec: 04-agent-design.md §4.12 #11
 */
import type {
  SaveMicroReflectionInput,
  SaveMicroReflectionOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function saveMicroReflection(
  input: SaveMicroReflectionInput,
): Promise<SaveMicroReflectionOutput> {
  if (!input.content_learning_id || input.content_learning_id.trim().length === 0) {
    throw new McpValidationError('content_learning_id is required');
  }
  if (!input.key_insight || input.key_insight.trim().length === 0) {
    throw new McpValidationError('key_insight is required');
  }

  const pool = getPool();

  // Update the content_learning record with reflection data
  const res = await pool.query(
    `UPDATE content_learnings
     SET what_worked = $1,
         what_didnt_work = $2,
         key_insight = $3,
         applicable_to = $4,
         confidence = COALESCE($5, confidence),
         embedding = CASE WHEN $6::text IS NOT NULL THEN $6::vector ELSE embedding END
     WHERE id = $7
     RETURNING id, promoted_to_learning_id`,
    [
      input.what_worked,
      input.what_didnt_work,
      input.key_insight,
      input.applicable_to ?? null,
      input.confidence ?? null,
      input.embedding ? `[${input.embedding.join(',')}]` : null,
      input.content_learning_id,
    ],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(
      `Content learning with id ${input.content_learning_id} not found`,
    );
  }

  const row = res.rows[0] as Record<string, unknown>;
  return {
    success: true,
    promoted_to_learning_id: (row['promoted_to_learning_id'] as string | null) ?? null,
  };
}
