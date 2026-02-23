/**
 * MCI-026: mark_learning_applied — UPDATE applied status
 * Spec: 04-agent-design.md §4.12 #8
 */
import type {
  MarkLearningAppliedInput,
  MarkLearningAppliedOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpNotFoundError } from '../../errors';

export async function markLearningApplied(
  input: MarkLearningAppliedInput,
): Promise<MarkLearningAppliedOutput> {
  const pool = getPool();

  const res = await pool.query(
    `UPDATE agent_individual_learnings
     SET times_applied = times_applied + 1,
         last_applied_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [input.learning_id],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(`Learning with id ${input.learning_id} not found`);
  }

  return { success: true };
}
