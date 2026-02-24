/**
 * MCI-015b: search_similar_tool_usage
 * Spec: 04-agent-design.md S4.5 #3
 * Searches tool experiences by similarity matching on content_type and niche.
 */
import type {
  SearchSimilarToolUsageInput,
  SearchSimilarToolUsageOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function searchSimilarToolUsage(
  input: SearchSimilarToolUsageInput,
): Promise<SearchSimilarToolUsageOutput> {
  const limit = input.limit ?? 5;
  if (limit < 1 || limit > 50) {
    throw new McpValidationError('limit must be between 1 and 50');
  }

  const pool = getPool();
  const reqs = input.requirements;

  // Build dynamic matching conditions with scoring
  const conditions: string[] = ['te.success = true'];
  const params: unknown[] = [];
  let paramIdx = 1;

  // Build similarity scoring expression parts
  const scoreParts: string[] = [];

  if (reqs.content_type) {
    conditions.push(`te.content_type = $${paramIdx++}`);
    params.push(reqs.content_type);
    scoreParts.push('1');
  }

  if (reqs.niche) {
    // Niche matching: join through content -> accounts for niche
    scoreParts.push(`CASE WHEN a.niche = $${paramIdx++} THEN 1 ELSE 0 END`);
    params.push(reqs.niche);
  }

  params.push(limit);

  // Query tool experiences grouped by recipe_used (tool combination)
  const nicheJoin = reqs.niche
    ? `LEFT JOIN content c ON te.content_id = c.content_id
       LEFT JOIN accounts a ON a.character_id = c.character_id`
    : '';

  const res = await pool.query(
    `SELECT
       te.recipe_used,
       AVG(te.quality_score)::float AS avg_quality_score,
       COUNT(*)::int AS usage_count,
       MAX(te.quality_notes) AS notes
     FROM tool_experiences te
     ${nicheJoin}
     WHERE ${conditions.join(' AND ')}
       AND te.recipe_used IS NOT NULL
     GROUP BY te.recipe_used
     ORDER BY AVG(te.quality_score) DESC NULLS LAST
     LIMIT $${paramIdx}`,
    params,
  );

  return {
    results: res.rows.map((r: Record<string, unknown>) => {
      const recipe = r['recipe_used'] as Record<string, unknown> | null;
      const tools = recipe
        ? (recipe['tools'] as string[] | undefined) ?? []
        : [];

      return {
        tool_combination: tools,
        avg_quality_score: Number(Number(r['avg_quality_score'] ?? 0).toFixed(2)),
        usage_count: r['usage_count'] as number,
        notes: (r['notes'] as string) ?? '',
      };
    }),
  };
}
