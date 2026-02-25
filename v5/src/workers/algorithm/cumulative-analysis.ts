/**
 * ALG-008: Cumulative analysis
 * Spec: 08-algorithm-analysis.md
 *
 * 7d cumulative analysis: pgvector 5-table search, structured aggregation,
 * AI interpretation, cumulative_context write.
 *
 * Flow:
 * 1. Generate embedding from content_learning key_insight
 * 2. Vector search across 5 tables (content_learnings, learnings,
 *    market_intel, hypotheses, agent_individual_learnings)
 * 3. Structured aggregation of results
 * 4. AI interpretation via Claude Haiku (fallback: rule-based)
 * 5. Write cumulative_context to content_learnings
 */
import { getSharedPool } from '../../lib/settings';
import { generateEmbedding } from './embedding-batch.js';
import { ChatAnthropic } from '@langchain/anthropic';
import { getSetting } from '../../lib/settings.js';
import { retryWithBackoff } from '../../lib/retry.js';
import type { Pool } from 'pg';
import type { CumulativeContext, CumulativeContextStructured } from '@/types/database';

interface CumulativeAnalysisResult {
  structured: Record<string, unknown>;
  ai_interpretation: string;
  recommendations: string[];
}

/** LLM interpretation result */
interface LlmInterpretation {
  summary: string;
  key_findings: string[];
  recommendations: string[];
  confidence_level: 'high' | 'medium' | 'low';
}

/**
 * Generate AI interpretation via Claude Haiku for cost efficiency.
 * Returns null if API key is unavailable or LLM call fails.
 */
async function generateLlmInterpretation(
  contentId: string,
  niche: string | null,
  successRate: number,
  predictionError: number,
  totalResults: number,
  topFactors: Array<{ factor: string; frequency: number }>,
  topDetractors: Array<{ factor: string; frequency: number }>,
): Promise<LlmInterpretation | null> {
  let apiKey: string;
  try {
    apiKey = String(await getSetting('CRED_ANTHROPIC_API_KEY'));
  } catch {
    return null;
  }
  if (!apiKey) return null;

  const llm = new ChatAnthropic({
    model: 'claude-haiku-4-5-20251001',
    anthropicApiKey: apiKey,
    maxTokens: 1024,
    temperature: 0,
  });

  const systemPrompt = `You are a content performance analyst. Analyze cumulative data and provide actionable insights.

Return ONLY valid JSON matching this exact schema:
{
  "summary": "1-2 sentence overview",
  "key_findings": ["insight1", "insight2", ...],
  "recommendations": ["action1", "action2", ...],
  "confidence_level": "high" | "medium" | "low"
}`;

  const userPrompt = `Analyze cumulative performance data for content ${contentId}:

- Niche: ${niche ?? 'unknown'}
- Similar content success rate: ${(successRate * 100).toFixed(1)}%
- Average prediction error: ${(predictionError * 100).toFixed(1)}%
- Total similar items found: ${totalResults} (across 5 knowledge bases)
- Top contributing factors: ${topFactors.map((f) => `"${f.factor}" (${f.frequency}x)`).join(', ') || 'none'}
- Top detractors: ${topDetractors.map((f) => `"${f.factor}" (${f.frequency}x)`).join(', ') || 'none'}

Provide a concise analysis with actionable recommendations.`;

  console.log(`[cumulative-analysis] Calling Claude Haiku for AI interpretation (content=${contentId})`);

  try {
    const responseText = await retryWithBackoff(
      async () => {
        const res = await llm.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);
        return typeof res.content === 'string'
          ? res.content
          : (res.content as Array<{ type: string; text?: string }>)
              .filter((c) => c.type === 'text')
              .map((c) => c.text ?? '')
              .join('');
      },
      { maxAttempts: 3, baseDelayMs: 1000 },
    );

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (
      typeof parsed['summary'] !== 'string' ||
      !Array.isArray(parsed['recommendations'])
    ) {
      return null;
    }

    const confidenceLevel = parsed['confidence_level'];
    const validConfidence = confidenceLevel === 'high' || confidenceLevel === 'medium' || confidenceLevel === 'low'
      ? confidenceLevel
      : 'medium';

    console.log(`[cumulative-analysis] LLM interpretation generated (confidence=${validConfidence})`);

    return {
      summary: parsed['summary'] as string,
      key_findings: Array.isArray(parsed['key_findings'])
        ? (parsed['key_findings'] as unknown[]).filter((f): f is string => typeof f === 'string')
        : [],
      recommendations: (parsed['recommendations'] as unknown[]).filter((r): r is string => typeof r === 'string'),
      confidence_level: validConfidence,
    };
  } catch (err) {
    console.warn(
      `[cumulative-analysis] LLM interpretation failed, using rule-based fallback: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Run cumulative analysis for a given content_id.
 * Should be called 7d after publication.
 */
export async function runCumulativeAnalysis(
  contentId: string,
): Promise<CumulativeAnalysisResult> {
  const pool: Pool = getSharedPool();

  // 1. Get the content_learning for this content
  const clRes = await pool.query(
    `SELECT id, key_insight, niche, contributing_factors, detractors,
            micro_verdict, prediction_error, confidence
     FROM content_learnings
     WHERE content_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [contentId],
  );

  const cl = clRes.rows[0] as Record<string, unknown> | undefined;
  const keyInsight = (cl?.['key_insight'] as string | null) ?? contentId;
  const contentLearningId = cl?.['id'] as string | undefined;
  const niche = cl?.['niche'] as string | null;

  // 2. Generate embedding for search
  const embedding = await generateEmbedding(keyInsight);
  const embeddingStr = `[${embedding.join(',')}]`;

  // 3. Search across 5 tables
  const searchLimit = 10;
  const results: Record<string, { count: number; items: Array<Record<string, unknown>> }> = {};

  // 3a. content_learnings
  const clSearch = await pool.query(
    `SELECT id, micro_verdict, prediction_error, contributing_factors, detractors
     FROM content_learnings
     WHERE embedding IS NOT NULL
       AND content_id != $1
       AND 1 - (embedding <=> $2::vector) > 0.0
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [contentId, embeddingStr, searchLimit],
  );
  results['content_learnings'] = { count: clSearch.rowCount ?? 0, items: clSearch.rows as Array<Record<string, unknown>> };

  // 3b. learnings
  const lSearch = await pool.query(
    `SELECT id, insight, confidence, category
     FROM learnings
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.0
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, searchLimit],
  );
  results['learnings'] = { count: lSearch.rowCount ?? 0, items: lSearch.rows as Array<Record<string, unknown>> };

  // 3c. market_intel
  const miSearch = await pool.query(
    `SELECT id, intel_type, data
     FROM market_intel
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.0
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, searchLimit],
  );
  results['market_intel'] = { count: miSearch.rowCount ?? 0, items: miSearch.rows as Array<Record<string, unknown>> };

  // 3d. hypotheses
  const hSearch = await pool.query(
    `SELECT id, statement, verdict, category
     FROM hypotheses
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.0
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, searchLimit],
  );
  results['hypotheses'] = { count: hSearch.rowCount ?? 0, items: hSearch.rows as Array<Record<string, unknown>> };

  // 3e. agent_individual_learnings
  const ailSearch = await pool.query(
    `SELECT id, content, category, agent_type
     FROM agent_individual_learnings
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.0
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, searchLimit],
  );
  results['agent_individual_learnings'] = { count: ailSearch.rowCount ?? 0, items: ailSearch.rows as Array<Record<string, unknown>> };

  // 4. Structured aggregation
  const totalResults = Object.values(results).reduce((sum, r) => sum + r.count, 0);

  const bySource: Record<string, { count: number }> = {};
  for (const [source, data] of Object.entries(results)) {
    bySource[source] = { count: data.count };
  }

  // Calculate patterns from similar content learnings
  const similarCL = results['content_learnings']?.items ?? [];
  const confirmedCount = similarCL.filter(
    (r) => r['micro_verdict'] === 'confirmed',
  ).length;
  const similarContentSuccessRate = similarCL.length > 0
    ? confirmedCount / similarCL.length
    : 0;

  const similarH = results['hypotheses']?.items ?? [];
  const confirmedH = similarH.filter(
    (r) => r['verdict'] === 'confirmed',
  ).length;
  const similarHypothesisSuccessRate = similarH.length > 0
    ? confirmedH / similarH.length
    : 0;

  const avgPredError = similarCL.length > 0
    ? similarCL.reduce(
        (sum, r) => sum + Number(r['prediction_error'] ?? 0),
        0,
      ) / similarCL.length
    : 0;

  // Count contributing factors and detractors
  const factorCounts: Record<string, number> = {};
  const detractorCounts: Record<string, number> = {};
  for (const r of similarCL) {
    const factors = r['contributing_factors'] as string[] | null;
    if (factors) {
      for (const f of factors) {
        factorCounts[f] = (factorCounts[f] ?? 0) + 1;
      }
    }
    const detractors = r['detractors'] as string[] | null;
    if (detractors) {
      for (const d of detractors) {
        detractorCounts[d] = (detractorCounts[d] ?? 0) + 1;
      }
    }
  }

  const topFactors = Object.entries(factorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([factor, frequency]) => ({ factor, frequency }));

  const topDetractors = Object.entries(detractorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([factor, frequency]) => ({ factor, frequency }));

  const structured: CumulativeContextStructured = {
    search_meta: {
      query_embedding_source: keyInsight,
      total_results: totalResults,
      searched_at: new Date().toISOString(),
    },
    by_source: bySource,
    patterns: {
      similar_content_success_rate: Number(similarContentSuccessRate.toFixed(4)),
      similar_hypothesis_success_rate: Number(similarHypothesisSuccessRate.toFixed(4)),
      avg_prediction_error_of_similar: Number(avgPredError.toFixed(4)),
      top_contributing_factors: topFactors,
      top_detractors: topDetractors,
    },
  };

  // 5. AI interpretation via LLM (fallback: rule-based)
  let aiInterpretation: string;
  let recommendations: string[];

  const llmResult = await generateLlmInterpretation(
    contentId,
    niche,
    similarContentSuccessRate,
    avgPredError,
    totalResults,
    topFactors,
    topDetractors,
  );

  if (llmResult) {
    aiInterpretation = llmResult.summary;
    recommendations = llmResult.recommendations;
  } else {
    // Fallback: rule-based interpretation
    recommendations = [];
    if (similarContentSuccessRate > 0.7) {
      recommendations.push('High success rate among similar content - continue current approach');
    }
    if (avgPredError > 0.3) {
      recommendations.push('High prediction error in similar content - review prediction model weights');
    }
    if (topFactors.length > 0 && topFactors[0]) {
      recommendations.push(
        `Top contributing factor: "${topFactors[0].factor}" (found in ${topFactors[0].frequency} similar analyses)`,
      );
    }

    aiInterpretation = [
      `Cumulative analysis for ${contentId}:`,
      `Found ${totalResults} similar items across 5 knowledge bases.`,
      `Similar content success rate: ${(similarContentSuccessRate * 100).toFixed(1)}%`,
      `Average prediction error of similar: ${(avgPredError * 100).toFixed(1)}%`,
      niche ? `Niche: ${niche}` : '',
    ].filter(Boolean).join(' ');
  }

  // 6. Write cumulative_context to content_learnings
  if (contentLearningId) {
    const cumulativeContext: CumulativeContext = {
      structured,
      ai_interpretation: aiInterpretation,
      recommendations,
      analyzed_at: new Date().toISOString(),
    };

    await pool.query(
      `UPDATE content_learnings
       SET cumulative_context = $1
       WHERE id = $2`,
      [JSON.stringify(cumulativeContext), contentLearningId],
    );
  }

  return {
    structured: structured as unknown as Record<string, unknown>,
    ai_interpretation: aiInterpretation,
    recommendations,
  };
}
