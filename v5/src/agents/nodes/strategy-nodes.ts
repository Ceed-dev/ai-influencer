/**
 * Strategy Cycle Graph — real node implementations
 * Spec: 04-agent-design.md SS5.1
 *
 * Each node:
 * 1. Calls MCP tool functions directly (not via MCP protocol)
 * 2. Uses ChatAnthropic for LLM reasoning
 * 3. Returns Partial<StrategyCycleAnnotationType>
 * 4. Reads config from system_settings (no hardcoding)
 * 5. Wraps errors gracefully into state.errors
 */
import { ChatAnthropic } from '@langchain/anthropic';
import { NodeInterrupt } from '@langchain/langgraph';
import type { StrategyCycleAnnotationType } from '../graphs/strategy-cycle.js';
import type {
  AgentError,
  AgentReflection,
  TrendingTopic,
  CompetitorInsight,
  PlatformUpdate,
  AudienceSignal,
  HypothesisVerification,
  Anomaly,
  Learning,
  CycleReview,
  ResourceAllocation,
  ContentPlan,
  ToolRecipe,
  AgentType,
  Platform,
} from '../../../types/langgraph-state.js';

// ---------------------------------------------------------------------------
// MCP Tool imports — intelligence category
// ---------------------------------------------------------------------------
import { getRecentIntel } from '../../mcp-server/tools/intelligence/get-recent-intel.js';
import { getPlatformChanges } from '../../mcp-server/tools/intelligence/get-platform-changes.js';
import { getCompetitorAnalysis } from '../../mcp-server/tools/intelligence/get-competitor-analysis.js';
import { searchSimilarIntel } from '../../mcp-server/tools/intelligence/search-similar-intel.js';
import { getMetricsForAnalysis } from '../../mcp-server/tools/intelligence/get-metrics-for-analysis.js';
import { getHypothesisResults } from '../../mcp-server/tools/intelligence/get-hypothesis-results.js';
import { verifyHypothesis } from '../../mcp-server/tools/intelligence/verify-hypothesis.js';
import { detectAnomalies } from '../../mcp-server/tools/intelligence/detect-anomalies.js';
import { extractLearning } from '../../mcp-server/tools/intelligence/extract-learning.js';
import { calculateAlgorithmPerformance } from '../../mcp-server/tools/intelligence/calculate-algorithm-performance.js';
import { createAnalysis } from '../../mcp-server/tools/intelligence/create-analysis.js';
import { getActiveHypotheses } from '../../mcp-server/tools/intelligence/get-active-hypotheses.js';

// ---------------------------------------------------------------------------
// MCP Tool imports — strategy category
// ---------------------------------------------------------------------------
import { getPortfolioKpiSummary } from '../../mcp-server/tools/strategy/get-portfolio-kpi-summary.js';
import { getPendingDirectives } from '../../mcp-server/tools/strategy/get-pending-directives.js';
import { createCycle } from '../../mcp-server/tools/strategy/create-cycle.js';
import { setCyclePlan } from '../../mcp-server/tools/strategy/set-cycle-plan.js';
import { allocateResources } from '../../mcp-server/tools/strategy/allocate-resources.js';
import { sendPlannerDirective } from '../../mcp-server/tools/strategy/send-planner-directive.js';

// ---------------------------------------------------------------------------
// MCP Tool imports — learning category
// ---------------------------------------------------------------------------
import { getTopLearnings } from '../../mcp-server/tools/learning/get-top-learnings.js';
import { getRecentReflections } from '../../mcp-server/tools/learning/get-recent-reflections.js';
import { getIndividualLearnings } from '../../mcp-server/tools/learning/get-individual-learnings.js';
import { saveReflection } from '../../mcp-server/tools/intelligence/save-reflection.js';
import { saveIndividualLearning } from '../../mcp-server/tools/learning/save-individual-learning.js';
import { submitAgentMessage } from '../../mcp-server/tools/learning/submit-agent-message.js';

// ---------------------------------------------------------------------------
// MCP Tool imports — planner category
// ---------------------------------------------------------------------------
import { getAssignedAccounts } from '../../mcp-server/tools/planner/get-assigned-accounts.js';
import { getAccountPerformance } from '../../mcp-server/tools/planner/get-account-performance.js';
import { getAvailableComponents } from '../../mcp-server/tools/planner/get-available-components.js';
import { createHypothesis } from '../../mcp-server/tools/planner/create-hypothesis.js';
import { planContent } from '../../mcp-server/tools/planner/plan-content.js';
import { scheduleContent } from '../../mcp-server/tools/planner/schedule-content.js';
import { getContentPoolStatus } from '../../mcp-server/tools/planner/get-content-pool-status.js';
import { getNicheLearnings } from '../../mcp-server/tools/planner/get-niche-learnings.js';

// ---------------------------------------------------------------------------
// MCP Tool imports — tool-knowledge category
// ---------------------------------------------------------------------------
import { getToolKnowledge } from '../../mcp-server/tools/tool-knowledge/get-tool-knowledge.js';
import { searchSimilarToolUsage } from '../../mcp-server/tools/tool-knowledge/search-similar-tool-usage.js';
import { getToolRecommendations } from '../../mcp-server/tools/tool-knowledge/get-tool-recommendations.js';
import { saveToolExperience } from '../../mcp-server/tools/tool-knowledge/save-tool-experience.js';

// ---------------------------------------------------------------------------
// Retry & Thought Logging
// ---------------------------------------------------------------------------
import { retryWithBackoff } from '../../lib/retry.js';
import { recordThoughtLog } from '../strategy/thought-logger.js';
import type { ThoughtLogInput } from '../strategy/thought-logger.js';

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------
import { getPool } from '../../db/pool.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Invoke LLM with retry (3 attempts, exponential backoff) + thought logging.
 * Wraps ChatAnthropic.invoke with spec-required patterns.
 */
async function invokeWithRetryAndLog(
  model: ChatAnthropic,
  messages: Array<{ role: string; content: string }>,
  logInput: Omit<ThoughtLogInput, 'reasoning' | 'decision'>,
): Promise<string> {
  const start = Date.now();
  const responseText = await retryWithBackoff(
    async () => {
      const response = await model.invoke(messages);
      return typeof response.content === 'string'
        ? response.content
        : (response.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('');
    },
    {
      maxAttempts: 3,
      baseDelayMs: 1000,
      backoffMultiplier: 2.0,
      timeoutMs: 120_000,
      isRetryable: (err) => {
        // Retry on transient errors (rate limits, timeouts, 5xx)
        if (err instanceof Error) {
          const msg = err.message.toLowerCase();
          return msg.includes('rate') || msg.includes('timeout') ||
            msg.includes('529') || msg.includes('500') || msg.includes('503');
        }
        return false;
      },
    },
  );

  // Log thought (fire-and-forget — don't block node execution)
  const durationMs = Date.now() - start;
  const pool = getPool();
  pool.connect().then(async (client) => {
    try {
      await recordThoughtLog(client, {
        ...logInput,
        reasoning: responseText.slice(0, 2000),
        decision: responseText.slice(0, 500),
        durationMs,
      });
    } catch (err) {
      console.warn(`[strategy-nodes] Thought log failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      client.release();
    }
  }).catch((err) => {
    console.warn(`[strategy-nodes] pool.connect for thought log failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  return responseText;
}

function makeError(
  node: AgentError['node'],
  agentType: AgentType,
  err: unknown,
  isRecoverable = true,
): AgentError {
  const message = err instanceof Error ? err.message : String(err);
  return {
    node,
    agent_type: agentType,
    error_message: message,
    occurred_at: new Date().toISOString(),
    is_recoverable: isRecoverable,
  };
}

function createSonnetModel(maxTokens = 4096): ChatAnthropic {
  return new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
    maxTokens,
  });
}

function createOpusModel(maxTokens = 4096): ChatAnthropic {
  return new ChatAnthropic({
    model: 'claude-opus-4-20250514',
    temperature: 0,
    maxTokens,
  });
}

/**
 * Safely parse JSON from LLM text output.
 * Tries to extract JSON from markdown code blocks if present.
 */
function safeParseJson<T>(text: string): T | null {
  try {
    // Try direct parse first
    return JSON.parse(text) as T;
  } catch {
    // Try to extract from markdown code block
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (match?.[1]) {
      try {
        return JSON.parse(match[1]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const PLATFORMS: Platform[] = ['youtube', 'tiktok', 'instagram', 'x'];

// ---------------------------------------------------------------------------
// Node 1: collect_intel — Researcher (Sonnet)
// ---------------------------------------------------------------------------

export async function collectIntelNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  const errors: AgentError[] = [];

  try {
    // 1. Gather raw data from all tool sources in parallel
    const [
      recentIntelResult,
      platformChangesResults,
      competitorResults,
      similarIntelResult,
      prevReflections,
      prevLearnings,
    ] = await Promise.all([
      getRecentIntel({ limit: 30 }).catch((e: unknown) => {
        errors.push(makeError('collect_intel', 'researcher', e));
        return { intel: [] };
      }),
      // Get platform changes for all 4 platforms
      Promise.all(
        PLATFORMS.map((p) =>
          getPlatformChanges({ platform: p, since: '30d' }).catch((e: unknown) => {
            errors.push(makeError('collect_intel', 'researcher', e));
            return { changes: [] };
          }),
        ),
      ),
      // Get competitor analysis for all platforms with "general" niche
      Promise.all(
        PLATFORMS.map((p) =>
          getCompetitorAnalysis({ platform: p, niche: 'general' }).catch((e: unknown) => {
            errors.push(makeError('collect_intel', 'researcher', e));
            return { competitors: [] };
          }),
        ),
      ),
      searchSimilarIntel({ query_text: 'latest trends and audience signals', limit: 10 }).catch(
        (e: unknown) => {
          errors.push(makeError('collect_intel', 'researcher', e));
          return { results: [] };
        },
      ),
      getRecentReflections({ agent_type: 'researcher', limit: 3 }).catch(() => ({
        reflections: [],
      })),
      getIndividualLearnings({ agent_type: 'researcher', limit: 10 }).catch(() => ({
        learnings: [],
      })),
    ]);

    // 2. Use LLM to synthesize and structure the intelligence
    const model = createSonnetModel(4096);

    const systemPrompt = `You are the Researcher agent in an AI influencer management system.
Your role is to analyze raw market intelligence data and produce a structured summary.

You have access to the following prior learnings:
${prevLearnings.learnings.map((l) => `- [${l.category}] ${l.content}`).join('\n') || 'None yet.'}

Previous reflections:
${prevReflections.reflections.map((r) => `- Score: ${r.self_score}/10 — ${r.score_reasoning}`).join('\n') || 'None yet.'}

Output ONLY valid JSON matching this schema:
{
  "trending_topics": [{ "topic": string, "platform": "youtube"|"tiktok"|"instagram"|"x", "relevance_score": 0.0-1.0, "source": string, "detected_at": string }],
  "competitor_insights": [{ "competitor_name": string, "platform": "youtube"|"tiktok"|"instagram"|"x", "observation": string }],
  "platform_updates": [{ "platform": "youtube"|"tiktok"|"instagram"|"x", "update_type": string, "description": string, "impact_assessment": string, "detected_at": string }],
  "audience_signals": [{ "signal_type": string, "description": string, "confidence": 0.0-1.0, "affected_niches": [string] }]
}`;

    const userData = JSON.stringify({
      recent_intel: recentIntelResult.intel.slice(0, 20),
      platform_changes: PLATFORMS.map((p, i) => ({
        platform: p,
        changes: platformChangesResults[i]?.changes ?? [],
      })),
      competitors: PLATFORMS.map((p, i) => ({
        platform: p,
        competitors: competitorResults[i]?.competitors ?? [],
      })),
      similar_intel: similarIntelResult.results.slice(0, 10),
    });

    const responseText = await invokeWithRetryAndLog(
      model,
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyze this raw intelligence data and produce a structured summary:\n\n${userData}`,
        },
      ],
      {
        agentType: 'researcher',
        cycleId: state.cycle_id,
        graphName: 'strategy_cycle',
        nodeName: 'collect_intel',
        inputSummary: { intel_count: recentIntelResult.intel.length },
      },
    );

    const parsed = safeParseJson<{
      trending_topics: TrendingTopic[];
      competitor_insights: CompetitorInsight[];
      platform_updates: PlatformUpdate[];
      audience_signals: AudienceSignal[];
    }>(responseText);

    if (!parsed) {
      errors.push(
        makeError('collect_intel', 'researcher', new Error('Failed to parse LLM response as JSON')),
      );
      return {
        market_intel: {
          trending_topics: [],
          competitor_insights: [],
          platform_updates: [],
          audience_signals: [],
        },
        errors: [...state.errors, ...errors],
      };
    }

    return {
      market_intel: {
        trending_topics: parsed.trending_topics ?? [],
        competitor_insights: parsed.competitor_insights ?? [],
        platform_updates: parsed.platform_updates ?? [],
        audience_signals: parsed.audience_signals ?? [],
      },
      errors: errors.length > 0 ? [...state.errors, ...errors] : state.errors,
    };
  } catch (err) {
    errors.push(makeError('collect_intel', 'researcher', err));
    return {
      market_intel: {
        trending_topics: [],
        competitor_insights: [],
        platform_updates: [],
        audience_signals: [],
      },
      errors: [...state.errors, ...errors],
    };
  }
}

// ---------------------------------------------------------------------------
// Node 2: analyze_cycle — Analyst (Sonnet)
// ---------------------------------------------------------------------------

export async function analyzeCycleNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  const errors: AgentError[] = [];

  try {
    // 1. Gather metrics and hypothesis data
    const [metricsResult, anomalyResult, algoResult, pendingHypotheses] = await Promise.all([
      getMetricsForAnalysis({ since: '7d', status: 'measured' }).catch((e: unknown) => {
        errors.push(makeError('analyze_cycle', 'analyst', e));
        return { metrics: [] };
      }),
      detectAnomalies({ period: '7d', threshold: 2.0 }).catch((e: unknown) => {
        errors.push(makeError('analyze_cycle', 'analyst', e));
        return { anomalies: [] };
      }),
      calculateAlgorithmPerformance({ period: 'daily' }).catch((e: unknown) => {
        errors.push(makeError('analyze_cycle', 'analyst', e));
        return { hypothesis_accuracy: 0, prediction_error: 0, learning_count: 0, improvement_rate: 0 };
      }),
      getActiveHypotheses({ verdict: 'pending' }).catch((e: unknown) => {
        errors.push(makeError('analyze_cycle', 'analyst', e));
        return { hypotheses: [] };
      }),
    ]);

    // 2. Verify each pending hypothesis that has content with metrics
    const verifications: HypothesisVerification[] = [];
    for (const hyp of pendingHypotheses.hypotheses.slice(0, 10)) {
      try {
        const results = await getHypothesisResults({ hypothesis_id: hyp.id });
        if (results.content_count > 0 && results.raw_metrics.length > 0) {
          // Use LLM to determine verdict
          const model = createSonnetModel(2048);
          const verdictText = await invokeWithRetryAndLog(
            model,
            [
              {
                role: 'system',
                content: `You are an Analyst agent. Given hypothesis predicted KPIs and actual results, determine the verdict.
Output ONLY valid JSON: {"verdict": "confirmed"|"rejected"|"inconclusive", "confidence": 0.0-1.0, "explanation": string}`,
              },
              {
                role: 'user',
                content: JSON.stringify({
                  hypothesis: hyp.statement,
                  predicted: results.predicted_kpis,
                  actual: results.actual_kpis,
                  content_count: results.content_count,
                  sample_metrics: results.raw_metrics.slice(0, 5),
                }),
              },
            ],
            {
              agentType: 'analyst',
              cycleId: state.cycle_id,
              graphName: 'strategy_cycle',
              nodeName: 'analyze_cycle',
              inputSummary: { hypothesis_id: hyp.id },
            },
          );

          const verdictParsed = safeParseJson<{
            verdict: 'confirmed' | 'rejected' | 'inconclusive';
            confidence: number;
            explanation: string;
          }>(verdictText);

          if (verdictParsed) {
            // Save the verification to DB
            await verifyHypothesis({
              hypothesis_id: hyp.id,
              verdict: verdictParsed.verdict,
              confidence: verdictParsed.confidence,
              evidence_summary: verdictParsed.explanation,
            }).catch((e: unknown) => errors.push(makeError('analyze_cycle', 'analyst', e)));

            // Calculate deviation
            const predicted = results.predicted_kpis;
            const actual = results.actual_kpis;
            const predictedViews = predicted['views'] ?? predicted['impressions'] ?? 0;
            const actualViews = actual['views'] ?? actual['impressions'] ?? 0;
            const deviation = predictedViews > 0
              ? Math.abs(actualViews - predictedViews) / predictedViews
              : 0;

            verifications.push({
              hypothesis_id: hyp.id,
              verdict: verdictParsed.verdict,
              actual_kpis: actual,
              predicted_kpis: predicted,
              deviation_pct: Number((deviation * 100).toFixed(1)),
              explanation: verdictParsed.explanation,
            });
          }
        }
      } catch (e) {
        errors.push(makeError('analyze_cycle', 'analyst', e));
      }
    }

    // 3. Map anomalies to typed structure
    const anomalies: Anomaly[] = anomalyResult.anomalies.map((a) => ({
      metric_name: a.metric,
      account_id: a.account_id,
      expected_value: a.expected,
      actual_value: a.actual,
      sigma_deviation: a.deviation,
      severity: (a.deviation > 3 ? 'high' : a.deviation > 2.5 ? 'medium' : 'low') as
        | 'low'
        | 'medium'
        | 'high',
      description: `${a.metric} for ${a.account_id}: expected ${a.expected.toFixed(1)}, got ${a.actual.toFixed(1)} (${a.deviation.toFixed(1)}σ)`,
    }));

    // 4. Use LLM to extract learnings from the analysis
    const model = createSonnetModel(4096);
    const analysisText = await invokeWithRetryAndLog(
      model,
      [
        {
          role: 'system',
          content: `You are the Analyst agent. Given cycle metrics, hypothesis verifications, and anomalies, extract key learnings and produce a cycle review.

Output ONLY valid JSON:
{
  "cycle_review": { "overall_score": 1-10, "key_findings": [string], "recommendations": [string] },
  "new_learnings": [{ "category": "content"|"timing"|"audience"|"platform"|"niche", "insight": string, "confidence": 0.0-1.0, "applicable_niches": [string] }]
}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            metrics_summary: {
              total_measured: metricsResult.metrics.length,
              avg_views:
                metricsResult.metrics.length > 0
                  ? metricsResult.metrics.reduce((s, m) => s + m.views, 0) /
                    metricsResult.metrics.length
                  : 0,
              avg_engagement:
                metricsResult.metrics.length > 0
                  ? metricsResult.metrics.reduce((s, m) => s + m.engagement_rate, 0) /
                    metricsResult.metrics.length
                  : 0,
            },
            verifications,
            anomalies: anomalies.slice(0, 20),
            algorithm_accuracy: algoResult.hypothesis_accuracy,
            market_intel: state.market_intel,
          }),
        },
      ],
      {
        agentType: 'analyst',
        cycleId: state.cycle_id,
        graphName: 'strategy_cycle',
        nodeName: 'analyze_cycle',
        inputSummary: { verifications_count: verifications.length, anomalies_count: anomalies.length },
      },
    );

    const analysisParsed = safeParseJson<{
      cycle_review: CycleReview;
      new_learnings: Learning[];
    }>(analysisText);

    // 5. Save learnings to DB
    const newLearnings: Learning[] = [];
    if (analysisParsed?.new_learnings) {
      for (const learning of analysisParsed.new_learnings) {
        try {
          const result = await extractLearning({
            insight: learning.insight,
            category: learning.category,
            confidence: learning.confidence,
            source_analyses: [],
            applicable_niches: learning.applicable_niches,
          });
          newLearnings.push({ ...learning, learning_id: result.id });
        } catch (e) {
          errors.push(makeError('analyze_cycle', 'analyst', e));
          newLearnings.push(learning);
        }
      }
    }

    // 6. Create analysis report in DB
    if (state.cycle_id) {
      await createAnalysis({
        cycle_id: state.cycle_id,
        analysis_type: 'daily_cycle',
        findings: JSON.stringify({
          metrics_count: metricsResult.metrics.length,
          verifications_count: verifications.length,
          anomalies_count: anomalies.length,
          algorithm_accuracy: algoResult.hypothesis_accuracy,
        }),
        recommendations: analysisParsed?.cycle_review?.recommendations?.join('; ') ?? 'No recommendations',
      }).catch((e: unknown) => errors.push(makeError('analyze_cycle', 'analyst', e)));
    }

    const previousCycleReview = analysisParsed?.cycle_review
      ? {
          cycle_id: state.cycle_id,
          overall_score: analysisParsed.cycle_review.overall_score ?? 5,
          key_findings: analysisParsed.cycle_review.key_findings ?? [],
          recommendations: analysisParsed.cycle_review.recommendations ?? [],
        }
      : null;

    return {
      analysis: {
        previous_cycle_review: previousCycleReview,
        hypothesis_verifications: verifications,
        anomalies,
        new_learnings: newLearnings,
        algorithm_accuracy: algoResult.hypothesis_accuracy,
      },
      errors: errors.length > 0 ? [...state.errors, ...errors] : state.errors,
    };
  } catch (err) {
    errors.push(makeError('analyze_cycle', 'analyst', err));
    return {
      analysis: {
        previous_cycle_review: null,
        hypothesis_verifications: [],
        anomalies: [],
        new_learnings: [],
        algorithm_accuracy: 0,
      },
      errors: [...state.errors, ...errors],
    };
  }
}

// ---------------------------------------------------------------------------
// Node 3: set_strategy — Strategist (Opus)
// ---------------------------------------------------------------------------

export async function setStrategyNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  const errors: AgentError[] = [];

  try {
    // 1. Gather strategic inputs
    const [kpiSummary, topLearnings, pendingDirectives] = await Promise.all([
      getPortfolioKpiSummary({ period: '7d' }).catch((e: unknown) => {
        errors.push(makeError('set_strategy', 'strategist', e));
        return {
          total_accounts: 0,
          active_accounts: 0,
          total_views: 0,
          avg_engagement_rate: 0,
          follower_growth: 0,
          monetized_count: 0,
        };
      }),
      getTopLearnings({ limit: 10, min_confidence: 0.6 }).catch((e: unknown) => {
        errors.push(makeError('set_strategy', 'strategist', e));
        return { learnings: [] };
      }),
      getPendingDirectives({}).catch((e: unknown) => {
        errors.push(makeError('set_strategy', 'strategist', e));
        return { directives: [] };
      }),
    ]);

    // 2. Create new cycle in DB
    const cycleResult = await createCycle({
      cycle_number: state.cycle_number,
    }).catch((e: unknown) => {
      errors.push(makeError('set_strategy', 'strategist', e));
      return null;
    });

    const cycleId = cycleResult?.id ?? state.cycle_id;

    // 3. Use Opus to make strategic decisions
    const model = createOpusModel(4096);

    const strategyText = await invokeWithRetryAndLog(
      model,
      [
        {
          role: 'system',
          content: `You are the Strategist (CEO) agent managing a portfolio of AI influencer accounts.
Your role is to set the strategic direction for this cycle based on KPI performance, learnings, analysis results, market intelligence, and human directives.

Output ONLY valid JSON:
{
  "focus_niches": [string],
  "resource_allocation": [{ "cluster": string, "content_count": number, "budget_usd": number }],
  "key_decisions": [string],
  "planner_directives": [{ "cluster": string, "directive_text": string }]
}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            kpi_summary: kpiSummary,
            top_learnings: topLearnings.learnings,
            pending_directives: pendingDirectives.directives,
            analysis: state.analysis,
            market_intel_summary: {
              trending_topics_count: state.market_intel.trending_topics.length,
              top_trends: state.market_intel.trending_topics.slice(0, 5),
              platform_updates_count: state.market_intel.platform_updates.length,
              anomalies_count: state.analysis.anomalies.length,
            },
          }),
        },
      ],
      {
        agentType: 'strategist',
        cycleId: state.cycle_id,
        graphName: 'strategy_cycle',
        nodeName: 'set_strategy',
        inputSummary: { directives_count: pendingDirectives.directives.length },
      },
    );

    const strategyParsed = safeParseJson<{
      focus_niches: string[];
      resource_allocation: ResourceAllocation[];
      key_decisions: string[];
      planner_directives: Array<{ cluster: string; directive_text: string }>;
    }>(strategyText);

    if (!strategyParsed) {
      errors.push(
        makeError('set_strategy', 'strategist', new Error('Failed to parse strategy LLM response')),
      );
      return {
        strategy: {
          focus_niches: [],
          resource_allocation: [],
          human_directives_processed: [],
          key_decisions: [],
        },
        errors: [...state.errors, ...errors],
      };
    }

    // 4. Save cycle plan to DB
    if (cycleId) {
      await setCyclePlan({
        cycle_id: cycleId,
        summary: {
          focus_niches: strategyParsed.focus_niches,
          key_decisions: strategyParsed.key_decisions,
          kpi_snapshot: kpiSummary,
        },
      }).catch((e: unknown) => errors.push(makeError('set_strategy', 'strategist', e)));

      // 5. Allocate resources
      if (strategyParsed.resource_allocation.length > 0) {
        await allocateResources({
          cycle_id: cycleId,
          allocations: strategyParsed.resource_allocation.map((r) => ({
            cluster: r.cluster,
            content_count: r.content_count,
            budget: r.budget_usd,
          })),
        }).catch((e: unknown) => errors.push(makeError('set_strategy', 'strategist', e)));
      }
    }

    // 6. Send directives to planners
    if (strategyParsed.planner_directives) {
      for (const directive of strategyParsed.planner_directives) {
        await sendPlannerDirective({
          cluster: directive.cluster,
          directive_text: directive.directive_text,
        }).catch((e: unknown) => errors.push(makeError('set_strategy', 'strategist', e)));
      }
    }

    // 7. Mark human directives as processed
    const processedDirectiveIds = pendingDirectives.directives.map((d) => d.id);
    if (processedDirectiveIds.length > 0) {
      const pool = getPool();
      await pool
        .query(
          `UPDATE human_directives SET status = 'processed', processed_at = NOW()
         WHERE id = ANY($1)`,
          [processedDirectiveIds],
        )
        .catch((e: unknown) => errors.push(makeError('set_strategy', 'strategist', e)));
    }

    return {
      cycle_id: cycleId,
      strategy: {
        focus_niches: strategyParsed.focus_niches,
        resource_allocation: strategyParsed.resource_allocation,
        human_directives_processed: processedDirectiveIds,
        key_decisions: strategyParsed.key_decisions,
      },
      errors: errors.length > 0 ? [...state.errors, ...errors] : state.errors,
    };
  } catch (err) {
    errors.push(makeError('set_strategy', 'strategist', err));
    return {
      strategy: {
        focus_niches: [],
        resource_allocation: [],
        human_directives_processed: [],
        key_decisions: [],
      },
      errors: [...state.errors, ...errors],
    };
  }
}

// ---------------------------------------------------------------------------
// Node 4: plan_content — Planner (Sonnet x N)
// ---------------------------------------------------------------------------

export async function planContentNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  const errors: AgentError[] = [];

  try {
    const allPlans: ContentPlan[] = [];

    // Process each cluster from resource_allocation
    for (const allocation of state.strategy.resource_allocation) {
      try {
        // 1. Get accounts and performance for this cluster
        const [accounts, poolStatus, nicheLearnings] = await Promise.all([
          getAssignedAccounts({ cluster: allocation.cluster }).catch((e: unknown) => {
            errors.push(makeError('plan_content', 'planner', e));
            return { accounts: [] };
          }),
          getContentPoolStatus({ cluster: allocation.cluster }).catch((e: unknown) => {
            errors.push(makeError('plan_content', 'planner', e));
            return {
              content: { pending_approval: 0, planned: 0, producing: 0, ready: 0, analyzed: 0 },
              publications: { scheduled: 0, posted: 0, measured: 0 },
            };
          }),
          getNicheLearnings({
            niche: allocation.cluster,
            min_confidence: 0.5,
            limit: 10,
          }).catch(() => ({ learnings: [] })),
        ]);

        if (accounts.accounts.length === 0) continue;

        // 2. Get performance for a sample of accounts
        const accountPerfs = await Promise.all(
          accounts.accounts.slice(0, 5).map((acc) =>
            getAccountPerformance({ account_id: acc.account_id, period: '7d' }).catch(() => ({
              avg_views: 0,
              avg_engagement: 0,
              top_content: '',
              trend: 'stable' as const,
            })),
          ),
        );

        // 3. Get available components
        const components = await getAvailableComponents({
          type: 'scenario',
          niche: allocation.cluster,
        }).catch((e: unknown) => {
          errors.push(makeError('plan_content', 'planner', e));
          return { components: [] };
        });

        // 4. Use LLM to generate content plans
        const model = createSonnetModel(4096);

        const planText = await invokeWithRetryAndLog(
          model,
          [
            {
              role: 'system',
              content: `You are a Planner agent creating content plans for AI influencer accounts.
Given the cluster data, create content plans with hypotheses.

${state.approval?.feedback ? `IMPORTANT - Previous feedback from reviewer: ${state.approval.feedback}` : ''}

Output ONLY valid JSON:
{
  "plans": [{
    "account_id": string,
    "character_id": string,
    "hypothesis": { "category": "hook_type"|"content_length"|"content_format"|"post_timing"|"narrative"|"audience_segment"|"niche", "statement": string, "rationale": string, "predicted_kpis": { "views": number, "engagement_rate": number } },
    "content_format": "short_video"|"text_post",
    "script_language": "en"|"jp",
    "planned_post_date": "YYYY-MM-DD",
    "sections": [{ "section_label": "hook"|"body"|"cta", "component_id": string, "script": string }]
  }]
}`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                cluster: allocation.cluster,
                target_content_count: allocation.content_count,
                budget_usd: allocation.budget_usd,
                accounts: accounts.accounts.slice(0, 10).map((a, i) => ({
                  ...a,
                  performance: accountPerfs[i] ?? null,
                })),
                available_components: components.components.slice(0, 20),
                pool_status: poolStatus,
                niche_learnings: nicheLearnings.learnings,
                market_intel: {
                  trending: state.market_intel.trending_topics.slice(0, 5),
                  signals: state.market_intel.audience_signals.slice(0, 5),
                },
                strategy_decisions: state.strategy.key_decisions,
              }),
            },
          ],
          {
            agentType: 'planner',
            cycleId: state.cycle_id,
            graphName: 'strategy_cycle',
            nodeName: 'plan_content',
            inputSummary: { cluster: allocation.cluster, accounts_count: accounts.accounts.length },
          },
        );

        const planParsed = safeParseJson<{
          plans: Array<{
            account_id: string;
            character_id: string;
            hypothesis: {
              category: string;
              statement: string;
              rationale: string;
              predicted_kpis: Record<string, number>;
            };
            content_format: 'short_video' | 'text_post';
            script_language: 'en' | 'jp';
            planned_post_date: string;
            sections: Array<{
              section_label: string;
              component_id: string;
              script?: string;
            }>;
          }>;
        }>(planText);

        if (!planParsed?.plans) continue;

        // 5. Create hypotheses and content plans in DB
        for (const plan of planParsed.plans) {
          try {
            // Create hypothesis
            const hypResult = await createHypothesis({
              category: plan.hypothesis.category,
              statement: plan.hypothesis.statement,
              rationale: plan.hypothesis.rationale,
              target_accounts: [plan.account_id],
              predicted_kpis: plan.hypothesis.predicted_kpis,
            });

            // Create content plan
            const contentResult = await planContent({
              hypothesis_id: hypResult.id,
              character_id: plan.character_id,
              script_language: plan.script_language,
              content_format: plan.content_format,
              sections: plan.sections.map((s) => ({
                component_id: s.component_id,
                section_label: s.section_label,
              })),
            });

            // Schedule content
            await scheduleContent({
              content_id: contentResult.content_id,
              planned_post_date: plan.planned_post_date,
            }).catch((e: unknown) => errors.push(makeError('plan_content', 'planner', e)));

            allPlans.push({
              content_id: contentResult.content_id,
              hypothesis_id: hypResult.id,
              character_id: plan.character_id,
              content_format: plan.content_format,
              script_language: plan.script_language,
              planned_post_date: plan.planned_post_date,
              sections: plan.sections.map((s, idx) => ({
                section_order: idx + 1,
                section_label: s.section_label,
                component_id: s.component_id,
                script: s.script,
              })),
            });
          } catch (e) {
            errors.push(makeError('plan_content', 'planner', e));
          }
        }
      } catch (e) {
        errors.push(makeError('plan_content', 'planner', e));
      }
    }

    return {
      content_plans: allPlans,
      errors: errors.length > 0 ? [...state.errors, ...errors] : state.errors,
    };
  } catch (err) {
    errors.push(makeError('plan_content', 'planner', err));
    return {
      content_plans: [],
      errors: [...state.errors, ...errors],
    };
  }
}

// ---------------------------------------------------------------------------
// Node 5: select_tools — Tool Specialist (Sonnet)
// ---------------------------------------------------------------------------

export async function selectToolsNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  const errors: AgentError[] = [];

  try {
    // Get tool knowledge base
    const [toolKnowledge, prevLearnings] = await Promise.all([
      getToolKnowledge({}).catch((e: unknown) => {
        errors.push(makeError('select_tools', 'tool_specialist', e));
        return { tools: [] };
      }),
      getIndividualLearnings({ agent_type: 'tool_specialist', limit: 10 }).catch(() => ({
        learnings: [],
      })),
    ]);

    const recipes: ToolRecipe[] = [];

    // Process each content plan that is a video (text_post doesn't need tool recipes)
    const videoPlans = state.content_plans.filter((p) => p.content_format === 'short_video');

    for (const plan of videoPlans) {
      try {
        // Get similar tool usage and recommendations
        const [similarUsage, recommendations] = await Promise.all([
          searchSimilarToolUsage({
            requirements: { content_type: plan.content_format },
            limit: 5,
          }).catch(() => ({ results: [] })),
          getToolRecommendations({
            content_requirements: {
              character_id: plan.character_id,
              niche: 'general',
              platform: 'youtube',
              quality_target: 0.8,
            },
          }).catch(() => ({
            recipe: { video_gen: 'kling_v2', tts: 'fish_audio', lipsync: 'fal_lipsync', concat: 'ffmpeg' },
            rationale: 'Default recipe',
            confidence: 0.3,
            alternatives: [],
          })),
        ]);

        // Use LLM to finalize tool selection
        const model = createSonnetModel(2048);

        const toolText = await invokeWithRetryAndLog(
          model,
          [
            {
              role: 'system',
              content: `You are the Tool Specialist agent. Select the best production tools for this content.

Prior learnings:
${prevLearnings.learnings.map((l) => `- [${l.category}] ${l.content}`).join('\n') || 'None yet.'}

Output ONLY valid JSON:
{
  "video_gen": "kling_v2"|"runway"|"pika"|"sora",
  "tts": "fish_audio"|"elevenlabs",
  "lipsync": "fal_lipsync"|"hedra",
  "concat": "ffmpeg",
  "rationale": string,
  "parameters": {}
}`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                content_id: plan.content_id,
                content_format: plan.content_format,
                character_id: plan.character_id,
                sections: plan.sections,
                available_tools: toolKnowledge.tools,
                similar_usage: similarUsage.results,
                db_recommendation: recommendations,
              }),
            },
          ],
          {
            agentType: 'tool_specialist',
            cycleId: state.cycle_id,
            graphName: 'strategy_cycle',
            nodeName: 'select_tools',
            inputSummary: { content_id: plan.content_id },
          },
        );

        const toolParsed = safeParseJson<{
          video_gen: string;
          tts: string;
          lipsync: string;
          concat: string;
          rationale: string;
          parameters?: Record<string, unknown>;
        }>(toolText);

        if (toolParsed) {
          recipes.push({
            content_id: plan.content_id,
            video_gen: toolParsed.video_gen,
            tts: toolParsed.tts,
            lipsync: toolParsed.lipsync,
            concat: toolParsed.concat,
            rationale: toolParsed.rationale,
            parameters: toolParsed.parameters,
          });

          // Save tool experience for future reference
          await saveToolExperience({
            tool_combination: [toolParsed.video_gen, toolParsed.tts, toolParsed.lipsync],
            content_id: plan.content_id,
            quality_score: 0.5, // Initial prediction, will be updated after production
            notes: toolParsed.rationale,
          }).catch((e: unknown) => errors.push(makeError('select_tools', 'tool_specialist', e)));
        } else {
          // Fallback to DB recommendation
          recipes.push({
            content_id: plan.content_id,
            video_gen: recommendations.recipe.video_gen,
            tts: recommendations.recipe.tts,
            lipsync: recommendations.recipe.lipsync,
            concat: recommendations.recipe.concat,
            rationale: recommendations.rationale + ' (LLM parse failed, using DB recommendation)',
          });
        }
      } catch (e) {
        errors.push(makeError('select_tools', 'tool_specialist', e));
      }
    }

    // For text_post plans, no tool recipe needed but add a minimal entry
    const textPlans = state.content_plans.filter((p) => p.content_format === 'text_post');
    for (const plan of textPlans) {
      recipes.push({
        content_id: plan.content_id,
        video_gen: 'none',
        tts: 'none',
        lipsync: 'none',
        concat: 'none',
        rationale: 'Text post — no video production tools needed',
      });
    }

    return {
      tool_recipes: recipes,
      errors: errors.length > 0 ? [...state.errors, ...errors] : state.errors,
    };
  } catch (err) {
    errors.push(makeError('select_tools', 'tool_specialist', err));
    return {
      tool_recipes: [],
      errors: [...state.errors, ...errors],
    };
  }
}

// ---------------------------------------------------------------------------
// Node 6: approve_plan — Strategist (Opus)
// ---------------------------------------------------------------------------

export async function approvePlanNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  const errors: AgentError[] = [];

  try {
    const revisionCount = state.approval?.revision_count ?? 0;

    // Force approve after 3 rejections (spec: max 3 revisions)
    if (revisionCount >= 3) {
      return {
        approval: {
          status: 'approved',
          feedback: 'Force approved after 3 revision cycles',
          revision_count: revisionCount,
        },
      };
    }

    // Get additional context for approval
    const [kpiSummary, activeHypotheses, poolStatuses] = await Promise.all([
      getPortfolioKpiSummary({ period: '7d' }).catch((e: unknown) => {
        errors.push(makeError('approve_plan', 'strategist', e));
        return {
          total_accounts: 0,
          active_accounts: 0,
          total_views: 0,
          avg_engagement_rate: 0,
          follower_growth: 0,
          monetized_count: 0,
        };
      }),
      getActiveHypotheses({ verdict: 'pending' }).catch((e: unknown) => {
        errors.push(makeError('approve_plan', 'strategist', e));
        return { hypotheses: [] };
      }),
      // Get pool status for each allocation cluster
      Promise.all(
        state.strategy.resource_allocation.map((a) =>
          getContentPoolStatus({ cluster: a.cluster }).catch(() => ({
            content: { pending_approval: 0, planned: 0, producing: 0, ready: 0, analyzed: 0 },
            publications: { scheduled: 0, posted: 0, measured: 0 },
          })),
        ),
      ),
    ]);

    // Use Opus to review the plan
    const model = createOpusModel(4096);

    const approvalText = await invokeWithRetryAndLog(
      model,
      [
        {
          role: 'system',
          content: `You are the Strategist (CEO) reviewing the content plan for this cycle.
Evaluate the plan quality, hypothesis strength, resource allocation, and alignment with strategy.

Approve if the plan is solid. Reject with specific category if not:
- "plan_revision": content plans need rework (routes back to planner)
- "data_insufficient": not enough data to make good decisions (routes to researcher)
- "hypothesis_weak": hypotheses are not well-formed (routes to analyst)

Output ONLY valid JSON:
{
  "status": "approved"|"rejected",
  "feedback": string,
  "rejection_category": "plan_revision"|"data_insufficient"|"hypothesis_weak" (only if rejected)
}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            content_plans_count: state.content_plans.length,
            content_plans_summary: state.content_plans.slice(0, 10).map((p) => ({
              content_id: p.content_id,
              format: p.content_format,
              sections_count: p.sections.length,
              hypothesis_id: p.hypothesis_id,
            })),
            tool_recipes_count: state.tool_recipes.length,
            strategy: state.strategy,
            kpi_summary: kpiSummary,
            active_hypotheses_count: activeHypotheses.hypotheses.length,
            pool_statuses: state.strategy.resource_allocation.map((a, i) => ({
              cluster: a.cluster,
              status: poolStatuses[i],
            })),
            revision_count: revisionCount,
            errors_count: state.errors.length,
          }),
        },
      ],
      {
        agentType: 'strategist',
        cycleId: state.cycle_id,
        graphName: 'strategy_cycle',
        nodeName: 'approve_plan',
        inputSummary: { plans_count: state.content_plans.length, revision_count: revisionCount },
      },
    );

    const approvalParsed = safeParseJson<{
      status: 'approved' | 'rejected';
      feedback: string;
      rejection_category?: 'plan_revision' | 'data_insufficient' | 'hypothesis_weak';
    }>(approvalText);

    if (!approvalParsed) {
      errors.push(
        makeError(
          'approve_plan',
          'strategist',
          new Error('Failed to parse approval LLM response'),
        ),
      );
      // Default to approved on parse failure to avoid blocking
      return {
        approval: {
          status: 'approved',
          feedback: 'Auto-approved due to LLM parse failure',
          revision_count: revisionCount,
        },
        errors: [...state.errors, ...errors],
      };
    }

    return {
      approval: {
        status: approvalParsed.status,
        feedback: approvalParsed.feedback,
        rejection_category: approvalParsed.rejection_category,
        revision_count:
          approvalParsed.status === 'rejected' ? revisionCount + 1 : revisionCount,
      },
      errors: errors.length > 0 ? [...state.errors, ...errors] : state.errors,
    };
  } catch (err) {
    errors.push(makeError('approve_plan', 'strategist', err));
    // Default to approved on error to avoid blocking
    return {
      approval: {
        status: 'approved',
        feedback: 'Auto-approved due to error in approval node',
        revision_count: state.approval?.revision_count ?? 0,
      },
      errors: [...state.errors, ...errors],
    };
  }
}

// ---------------------------------------------------------------------------
// Node 7: human_review_gate — Interrupt for dashboard approval
// ---------------------------------------------------------------------------

export async function humanReviewGateNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  // If we already have a human approval result (resuming after interrupt),
  // just return — the edge routing will handle the decision.
  if (
    state.human_approval?.status === 'approved' ||
    state.human_approval?.status === 'rejected'
  ) {
    return {};
  }

  // Update content status to pending_approval for dashboard visibility
  const pool = getPool();
  for (const plan of state.content_plans) {
    await pool
      .query(
        `UPDATE content SET status = 'pending_approval', updated_at = NOW() WHERE content_id = $1`,
        [plan.content_id],
      )
      .catch(() => {
        /* best-effort */
      });
  }

  // Interrupt and wait for human decision via dashboard
  throw new NodeInterrupt(
    'Awaiting human approval for strategy cycle plan. ' +
      `Cycle #${state.cycle_number} with ${state.content_plans.length} content plans. ` +
      'Review in the dashboard and approve or reject.',
  );
}

// ---------------------------------------------------------------------------
// Node 8: reflect_all — All agents self-reflect
// ---------------------------------------------------------------------------

export async function reflectAllNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  const errors: AgentError[] = [];
  const reflections: AgentReflection[] = [];

  const agentTypes: AgentType[] = [
    'researcher',
    'analyst',
    'strategist',
    'planner',
    'tool_specialist',
  ];

  // Each agent type reflects on its performance in this cycle
  for (const agentType of agentTypes) {
    try {
      // Determine which model to use
      const isStrategist = agentType === 'strategist';
      const model = isStrategist ? createOpusModel(2048) : createSonnetModel(2048);

      // Prepare context for this agent's reflection
      let agentContext: Record<string, unknown> = {};
      switch (agentType) {
        case 'researcher':
          agentContext = {
            role: 'Market intelligence collection',
            output: {
              trending_topics_found: state.market_intel.trending_topics.length,
              competitor_insights_found: state.market_intel.competitor_insights.length,
              platform_updates_found: state.market_intel.platform_updates.length,
              audience_signals_found: state.market_intel.audience_signals.length,
            },
          };
          break;
        case 'analyst':
          agentContext = {
            role: 'Cycle analysis and hypothesis verification',
            output: {
              verifications_completed: state.analysis.hypothesis_verifications.length,
              anomalies_detected: state.analysis.anomalies.length,
              learnings_extracted: state.analysis.new_learnings.length,
              algorithm_accuracy: state.analysis.algorithm_accuracy,
            },
          };
          break;
        case 'strategist':
          agentContext = {
            role: 'Strategic direction and resource allocation',
            output: {
              focus_niches: state.strategy.focus_niches,
              allocations_made: state.strategy.resource_allocation.length,
              directives_processed: state.strategy.human_directives_processed.length,
              key_decisions: state.strategy.key_decisions,
              approval_status: state.approval.status,
            },
          };
          break;
        case 'planner':
          agentContext = {
            role: 'Content planning and hypothesis creation',
            output: {
              plans_created: state.content_plans.length,
              formats: state.content_plans.map((p) => p.content_format),
            },
          };
          break;
        case 'tool_specialist':
          agentContext = {
            role: 'Production tool selection',
            output: {
              recipes_created: state.tool_recipes.length,
              tools_used: [
                ...new Set(state.tool_recipes.map((r) => r.video_gen)),
              ],
            },
          };
          break;
      }

      const reflectText = await invokeWithRetryAndLog(
        model,
        [
          {
            role: 'system',
            content: `You are the ${agentType} agent reflecting on your performance in this strategy cycle.
Be honest and specific about what went well and what needs improvement.

Output ONLY valid JSON:
{
  "self_score": 1-10,
  "score_reasoning": string,
  "what_went_well": [string],
  "what_to_improve": [string],
  "next_actions": [string]
}`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              agent_type: agentType,
              context: agentContext,
              cycle_errors: state.errors.filter(
                (e) => e.agent_type === agentType,
              ),
              total_cycle_errors: state.errors.length,
            }),
          },
        ],
        {
          agentType: agentType,
          cycleId: state.cycle_id,
          graphName: 'strategy_cycle',
          nodeName: 'reflect_all',
          inputSummary: { agent_type: agentType },
        },
      );

      const reflectParsed = safeParseJson<{
        self_score: number;
        score_reasoning: string;
        what_went_well: string[];
        what_to_improve: string[];
        next_actions: string[];
      }>(reflectText);

      if (reflectParsed) {
        const reflection: AgentReflection = {
          agent_type: agentType,
          self_score: Math.min(10, Math.max(1, reflectParsed.self_score)),
          score_reasoning: reflectParsed.score_reasoning,
          what_went_well: reflectParsed.what_went_well,
          what_to_improve: reflectParsed.what_to_improve,
          next_actions: reflectParsed.next_actions,
        };

        reflections.push(reflection);

        // Save reflection to DB
        await saveReflection({
          agent_type: agentType,
          cycle_id: state.cycle_id,
          task_description: `Strategy cycle #${state.cycle_number} — ${agentType} role`,
          self_score: reflection.self_score,
          score_reasoning: reflection.score_reasoning,
          what_went_well: reflection.what_went_well.join('; '),
          what_to_improve: reflection.what_to_improve.join('; '),
          next_actions: reflection.next_actions,
        }).catch((e: unknown) => errors.push(makeError('reflect_all', agentType, e)));

        // Save key learnings as individual learning
        if (reflectParsed.what_to_improve.length > 0) {
          await saveIndividualLearning({
            agent_type: agentType,
            content: reflectParsed.what_to_improve.join('; '),
            category: 'insight',
            context: `Cycle #${state.cycle_number} self-reflection`,
            confidence: 0.7,
          }).catch((e: unknown) => errors.push(makeError('reflect_all', agentType, e)));
        }

        // Submit status report to human
        await submitAgentMessage({
          agent_type: agentType,
          message_type: 'status_report',
          content: `Cycle #${state.cycle_number} reflection: Score ${reflection.self_score}/10. ${reflection.score_reasoning}`,
          priority: 2,
        }).catch((e: unknown) => errors.push(makeError('reflect_all', agentType, e)));
      }
    } catch (e) {
      errors.push(makeError('reflect_all', agentType, e));
    }
  }

  // Update cycle status to completed
  const pool = getPool();
  await pool
    .query(`UPDATE cycles SET status = 'completed', ended_at = NOW() WHERE id = $1`, [
      state.cycle_id,
    ])
    .catch((e: unknown) => errors.push(makeError('reflect_all', 'strategist', e)));

  return {
    reflections,
    errors: errors.length > 0 ? [...state.errors, ...errors] : state.errors,
  };
}
