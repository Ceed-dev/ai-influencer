/**
 * FEAT-MCC-011: create_hypothesis
 * Spec: 04-agent-design.md S4.4 #4
 * Creates a new hypothesis with category validation.
 */
import type {
  CreateHypothesisInput,
  CreateHypothesisOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

const VALID_CATEGORIES = [
  'hook_type',
  'content_length',
  'post_timing',
  'narrative',
  'sound',
  'hashtag',
  'audience_segment',
  'platform_specific',
  'cross_platform',
  'character_trait',
] as const;

export async function createHypothesis(
  input: CreateHypothesisInput,
): Promise<CreateHypothesisOutput> {
  if (!VALID_CATEGORIES.includes(input.category as typeof VALID_CATEGORIES[number])) {
    throw new McpValidationError(
      `Invalid category: "${input.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    );
  }

  const pool = getPool();

  try {
    const res = await pool.query(
      `
      INSERT INTO hypotheses (category, statement, rationale, target_accounts, predicted_kpis, verdict, cycle_id)
      VALUES ($1, $2, $3, $4, $5, 'pending', NULL)
      RETURNING id
      `,
      [
        input.category,
        input.statement,
        input.rationale,
        input.target_accounts,
        JSON.stringify(input.predicted_kpis),
      ],
    );

    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new McpDbError('Failed to create hypothesis: no row returned');
    }

    return { id: Number(row['id']) };
  } catch (err) {
    if (err instanceof McpValidationError || err instanceof McpDbError) throw err;
    throw new McpDbError('Failed to create hypothesis', err);
  }
}
