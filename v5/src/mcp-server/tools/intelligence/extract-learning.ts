/**
 * MCI-008: extract_learning — INSERT into learnings
 * Spec: 04-agent-design.md §4.3 #5
 */
import type {
  ExtractLearningInput,
  ExtractLearningOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_CATEGORIES = ['content', 'timing', 'audience', 'platform', 'niche'] as const;

export async function extractLearning(
  input: ExtractLearningInput,
): Promise<ExtractLearningOutput> {
  if (!VALID_CATEGORIES.includes(input.category as typeof VALID_CATEGORIES[number])) {
    throw new McpValidationError(
      `Invalid category: "${input.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    );
  }
  if (input.confidence < 0 || input.confidence > 1) {
    throw new McpValidationError('confidence must be between 0 and 1');
  }
  if (!input.insight || input.insight.trim().length === 0) {
    throw new McpValidationError('insight is required');
  }

  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO learnings (category, insight, confidence, source_analyses, applicable_niches)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.category,
      input.insight,
      input.confidence,
      input.source_analyses,
      input.applicable_niches,
    ],
  );

  return { id: res.rows[0]['id'] as number };
}
