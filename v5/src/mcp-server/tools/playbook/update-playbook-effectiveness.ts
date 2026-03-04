/**
 * FEAT-CPB-004: update_playbook_effectiveness
 * Spec: content_playbooks — 効果スコアのrolling average更新
 * new_avg = (old_avg * times_used + new_score) / (times_used + 1)
 */
import type {
  UpdatePlaybookEffectivenessInput,
  UpdatePlaybookEffectivenessOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db.js';
import { McpValidationError, McpNotFoundError } from '../../errors.js';

export async function updatePlaybookEffectiveness(
  input: UpdatePlaybookEffectivenessInput,
): Promise<UpdatePlaybookEffectivenessOutput> {
  if (input.id == null || typeof input.id !== 'number') {
    throw new McpValidationError('id is required and must be a number');
  }
  if (
    input.effectiveness_score == null ||
    typeof input.effectiveness_score !== 'number' ||
    input.effectiveness_score < 0 ||
    input.effectiveness_score > 1
  ) {
    throw new McpValidationError('effectiveness_score must be a number between 0 and 1');
  }

  const pool = getPool();

  // Rolling average update in a single atomic query:
  // new_avg = (COALESCE(old_avg, 0) * times_used + new_score) / (times_used + 1)
  const res = await pool.query(
    `UPDATE content_playbooks
     SET avg_effectiveness_score =
           (COALESCE(avg_effectiveness_score, 0) * times_used + $2) / (times_used + 1),
         times_used = times_used + 1
     WHERE id = $1
     RETURNING id, avg_effectiveness_score, times_used`,
    [input.id, input.effectiveness_score],
  );

  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    throw new McpNotFoundError(`Playbook with id=${input.id} not found`);
  }

  return {
    id: row['id'] as number,
    avg_effectiveness_score: Number(row['avg_effectiveness_score']),
    times_used: row['times_used'] as number,
  };
}
