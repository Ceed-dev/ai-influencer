/**
 * MCI-007: verify_hypothesis — UPDATE hypotheses.verdict
 * Spec: 04-agent-design.md §4.3 #3
 */
import type {
  VerifyHypothesisInput,
  VerifyHypothesisOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

const VALID_VERDICTS = ['pending', 'confirmed', 'rejected', 'inconclusive'] as const;

export async function verifyHypothesis(
  input: VerifyHypothesisInput,
): Promise<VerifyHypothesisOutput> {
  if (!VALID_VERDICTS.includes(input.verdict as typeof VALID_VERDICTS[number])) {
    throw new McpValidationError(
      `Invalid verdict: "${input.verdict}". Must be one of: ${VALID_VERDICTS.join(', ')}`,
    );
  }
  if (input.confidence < 0 || input.confidence > 1) {
    throw new McpValidationError('confidence must be between 0 and 1');
  }
  if (!input.evidence_summary || input.evidence_summary.trim().length === 0) {
    throw new McpValidationError('evidence_summary is required');
  }

  const pool = getPool();

  const res = await pool.query(
    `UPDATE hypotheses
     SET verdict = $1, confidence = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id`,
    [input.verdict, input.confidence, input.hypothesis_id],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(`Hypothesis with id ${input.hypothesis_id} not found`);
  }

  return { success: true };
}
