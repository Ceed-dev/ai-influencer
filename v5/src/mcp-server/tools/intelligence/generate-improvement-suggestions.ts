/**
 * MCI-041: generate_improvement_suggestions
 * Spec: 04-agent-design.md §4.3 #14
 *
 * Analyzes recent performance + learnings to generate data-driven improvement suggestions.
 */
import type {
  GenerateImprovementSuggestionsInput,
  GenerateImprovementSuggestionsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function generateImprovementSuggestions(
  input: GenerateImprovementSuggestionsInput,
): Promise<GenerateImprovementSuggestionsOutput> {
  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required');
  }

  const pool = getPool();
  const suggestions: GenerateImprovementSuggestionsOutput['suggestions'] = [];

  // 1. Analyze recent content learnings for the niche
  const learningsRes = await pool.query(
    `SELECT
       micro_verdict,
       prediction_error,
       contributing_factors,
       detractors,
       key_insight,
       confidence
     FROM content_learnings
     WHERE niche = $1
       AND created_at >= NOW() - INTERVAL '30 days'
     ORDER BY created_at DESC
     LIMIT 50`,
    [input.niche],
  );

  const learnings = learningsRes.rows as Array<Record<string, unknown>>;

  // 2. Analyze top detractors
  const detractorCounts: Record<string, number> = {};
  const factorCounts: Record<string, number> = {};

  for (const l of learnings) {
    const detractors = l['detractors'] as string[] | null;
    if (detractors) {
      for (const d of detractors) {
        detractorCounts[d] = (detractorCounts[d] ?? 0) + 1;
      }
    }
    const factors = l['contributing_factors'] as string[] | null;
    if (factors) {
      for (const f of factors) {
        factorCounts[f] = (factorCounts[f] ?? 0) + 1;
      }
    }
  }

  // Generate detractor-based suggestions
  const topDetractors = Object.entries(detractorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [detractor, count] of topDetractors) {
    suggestions.push({
      suggestion: `Address recurring detractor: "${detractor}"`,
      rationale: `Found in ${count} of ${learnings.length} recent content analyses for niche "${input.niche}"`,
      expected_impact: count >= 5 ? 'high' : 'medium',
      priority: count >= 5 ? 'high' : 'medium',
    });
  }

  // 3. Analyze hypothesis accuracy for the niche
  const hypothesisRes = await pool.query(
    `SELECT
       category,
       COUNT(*) FILTER (WHERE verdict = 'confirmed')::int AS confirmed,
       COUNT(*) FILTER (WHERE verdict = 'rejected')::int AS rejected,
       COUNT(*)::int AS total
     FROM hypotheses h
     JOIN content c ON c.hypothesis_id = h.id
     JOIN publications p ON p.content_id = c.content_id
     JOIN accounts a ON p.account_id = a.account_id
     WHERE a.niche = $1
       AND h.verdict IN ('confirmed', 'rejected')
       AND h.updated_at >= NOW() - INTERVAL '30 days'
     GROUP BY category
     ORDER BY rejected DESC`,
    [input.niche],
  );

  for (const row of hypothesisRes.rows as Array<Record<string, unknown>>) {
    const category = row['category'] as string;
    const confirmed = Number(row['confirmed']);
    const _rejected = Number(row['rejected']);
    const total = Number(row['total']);
    const accuracy = total > 0 ? confirmed / total : 0;

    if (accuracy < 0.4 && total >= 3) {
      suggestions.push({
        suggestion: `Revisit hypothesis strategy for category: "${category}"`,
        rationale: `Only ${(accuracy * 100).toFixed(0)}% accuracy (${confirmed}/${total}) in the last 30 days`,
        expected_impact: 'high',
        priority: 'high',
      });
    }
  }

  // 4. Check for high-performing contributing factors to double down on
  const topFactors = Object.entries(factorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  for (const [factor, count] of topFactors) {
    if (count >= 3) {
      suggestions.push({
        suggestion: `Leverage successful factor: "${factor}"`,
        rationale: `Contributing factor in ${count} successful content pieces for niche "${input.niche}"`,
        expected_impact: 'medium',
        priority: 'medium',
      });
    }
  }

  // 5. Check prediction error trends
  const avgErrorRes = await pool.query(
    `SELECT COALESCE(AVG(prediction_error), 0)::float AS avg_error
     FROM content_learnings
     WHERE niche = $1
       AND created_at >= NOW() - INTERVAL '30 days'`,
    [input.niche],
  );

  const avgError = Number(
    (avgErrorRes.rows[0] as Record<string, unknown>)['avg_error'] ?? 0,
  );

  if (avgError > 0.3) {
    suggestions.push({
      suggestion: 'Improve prediction model accuracy for this niche',
      rationale: `Average prediction error is ${(avgError * 100).toFixed(1)}%, indicating model calibration issues`,
      expected_impact: 'high',
      priority: 'high',
    });
  }

  // If no suggestions generated, provide a default
  if (suggestions.length === 0) {
    suggestions.push({
      suggestion: 'Continue current strategy and collect more data',
      rationale: `Insufficient data for niche "${input.niche}" to generate specific improvement suggestions`,
      expected_impact: 'low',
      priority: 'low',
    });
  }

  return { suggestions };
}
