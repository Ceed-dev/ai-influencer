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
  'content_format',
  'post_timing',
  'timing',
  'narrative',
  'sound',
  'hashtag',
  'audience_segment',
  'audience',
  'niche',
  'platform_specific',
  'cross_platform',
  'character_trait',
] as const;

/**
 * Map application-level category to DB-allowed category.
 * DB CHECK constraint allows: content_format, timing, niche, audience, platform_specific
 */
function mapCategoryToDb(category: string): string {
  const mapping: Record<string, string> = {
    hook_type: 'content_format',
    content_length: 'content_format',
    content_format: 'content_format',
    narrative: 'content_format',
    sound: 'content_format',
    post_timing: 'timing',
    timing: 'timing',
    hashtag: 'audience',
    audience_segment: 'audience',
    audience: 'audience',
    niche: 'niche',
    platform_specific: 'platform_specific',
    cross_platform: 'platform_specific',
    character_trait: 'audience',
  };
  return mapping[category] ?? category;
}

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
    const dbCategory = mapCategoryToDb(input.category);
    const res = await pool.query(
      `
      INSERT INTO hypotheses (category, statement, rationale, target_accounts, predicted_kpis, verdict, cycle_id)
      VALUES ($1, $2, $3, $4, $5, 'pending', NULL)
      RETURNING id
      `,
      [
        dbCategory,
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
