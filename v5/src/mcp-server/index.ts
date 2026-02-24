/**
 * MCP Server entry point for ai-influencer-v5.
 * Registers all 103 MCP tools and connects via StdioServerTransport.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Strategy tools
// ---------------------------------------------------------------------------
import { getPortfolioKpiSummary } from './tools/strategy/get-portfolio-kpi-summary.js';
import { getClusterPerformance } from './tools/strategy/get-cluster-performance.js';
import { getAlgorithmPerformance } from './tools/strategy/get-algorithm-performance.js';
import { getPendingDirectives } from './tools/strategy/get-pending-directives.js';
import { createCycle } from './tools/strategy/create-cycle.js';
import { setCyclePlan } from './tools/strategy/set-cycle-plan.js';
import { allocateResources } from './tools/strategy/allocate-resources.js';
import { sendPlannerDirective } from './tools/strategy/send-planner-directive.js';

// ---------------------------------------------------------------------------
// Intelligence tools (Researcher + Analyst + micro-cycle)
// ---------------------------------------------------------------------------
import { saveTrendingTopic } from './tools/intelligence/save-trending-topic.js';
import { saveCompetitorPost } from './tools/intelligence/save-competitor-post.js';
import { saveCompetitorAccount } from './tools/intelligence/save-competitor-account.js';
import { saveAudienceSignal } from './tools/intelligence/save-audience-signal.js';
import { savePlatformUpdate } from './tools/intelligence/save-platform-update.js';
import { getRecentIntel } from './tools/intelligence/get-recent-intel.js';
import { searchSimilarIntel } from './tools/intelligence/search-similar-intel.js';
import { getNicheTrends } from './tools/intelligence/get-niche-trends.js';
import { getCompetitorAnalysis } from './tools/intelligence/get-competitor-analysis.js';
import { getPlatformChanges } from './tools/intelligence/get-platform-changes.js';
import { markIntelExpired } from './tools/intelligence/mark-intel-expired.js';
import { getIntelGaps } from './tools/intelligence/get-intel-gaps.js';
import { getMetricsForAnalysis } from './tools/intelligence/get-metrics-for-analysis.js';
import { getHypothesisResults } from './tools/intelligence/get-hypothesis-results.js';
import { verifyHypothesis } from './tools/intelligence/verify-hypothesis.js';
import { createAnalysis } from './tools/intelligence/create-analysis.js';
import { extractLearning } from './tools/intelligence/extract-learning.js';
import { updateLearningConfidence } from './tools/intelligence/update-learning-confidence.js';
import { detectAnomalies } from './tools/intelligence/detect-anomalies.js';
import { getComponentScores } from './tools/intelligence/get-component-scores.js';
import { updateComponentScore } from './tools/intelligence/update-component-score.js';
import { calculateAlgorithmPerformance } from './tools/intelligence/calculate-algorithm-performance.js';
import { getNichePerformanceTrends } from './tools/intelligence/get-niche-performance-trends.js';
import { compareHypothesisPredictions } from './tools/intelligence/compare-hypothesis-predictions.js';
import { generateImprovementSuggestions } from './tools/intelligence/generate-improvement-suggestions.js';
import { runWeightRecalculation } from './tools/intelligence/run-weight-recalculation.js';
import { runBaselineUpdateTool } from './tools/intelligence/run-baseline-update.js';
import { runAdjustmentCacheUpdate } from './tools/intelligence/run-adjustment-cache-update.js';
import { runKpiSnapshot } from './tools/intelligence/run-kpi-snapshot.js';
import { runCumulativeAnalysis } from './tools/intelligence/run-cumulative-analysis.js';
import { getActiveHypotheses } from './tools/intelligence/get-active-hypotheses.js';
import { searchContentLearnings } from './tools/intelligence/search-content-learnings.js';
import { createMicroAnalysis } from './tools/intelligence/create-micro-analysis.js';
import { saveMicroReflection } from './tools/intelligence/save-micro-reflection.js';
import { getContentMetrics } from './tools/intelligence/get-content-metrics.js';
import { getContentPrediction } from './tools/intelligence/get-content-prediction.js';
import { getDailyMicroAnalysesSummary } from './tools/intelligence/get-daily-micro-analyses-summary.js';
import { saveReflection } from './tools/intelligence/save-reflection.js';

// ---------------------------------------------------------------------------
// Planner tools
// ---------------------------------------------------------------------------
import { getAssignedAccounts } from './tools/planner/get-assigned-accounts.js';
import { getAccountPerformance } from './tools/planner/get-account-performance.js';
import { getAvailableComponents } from './tools/planner/get-available-components.js';
import { createHypothesis } from './tools/planner/create-hypothesis.js';
import { planContent } from './tools/planner/plan-content.js';
import { scheduleContent } from './tools/planner/schedule-content.js';
import { getNicheLearnings } from './tools/planner/get-niche-learnings.js';
import { getContentPoolStatus } from './tools/planner/get-content-pool-status.js';
import { requestProduction } from './tools/planner/request-production.js';

// ---------------------------------------------------------------------------
// Tool-knowledge tools
// ---------------------------------------------------------------------------
import { getToolKnowledge } from './tools/tool-knowledge/get-tool-knowledge.js';
import { saveToolExperience } from './tools/tool-knowledge/save-tool-experience.js';
import { searchSimilarToolUsage } from './tools/tool-knowledge/search-similar-tool-usage.js';
import { getToolRecommendations } from './tools/tool-knowledge/get-tool-recommendations.js';
import { updateToolKnowledgeFromExternal } from './tools/tool-knowledge/update-tool-knowledge-from-external.js';

// ---------------------------------------------------------------------------
// Production tools
// ---------------------------------------------------------------------------
import { getProductionTask } from './tools/production/get-production-task.js';
import { generateScript } from './tools/production/generate-script.js';
import { getCharacterInfo } from './tools/production/get-character-info.js';
import { getComponentData } from './tools/production/get-component-data.js';
import { startVideoGeneration } from './tools/production/start-video-generation.js';
import { checkVideoStatus } from './tools/production/check-video-status.js';
import { startTts } from './tools/production/start-tts.js';
import { startLipsync } from './tools/production/start-lipsync.js';
import { uploadToDrive } from './tools/production/upload-to-drive.js';
import { updateContentStatus } from './tools/production/update-content-status.js';
import { runQualityCheck } from './tools/production/run-quality-check.js';
import { reportProductionComplete } from './tools/production/report-production-complete.js';

// ---------------------------------------------------------------------------
// Publishing tools
// ---------------------------------------------------------------------------
import { getPublishTask } from './tools/publishing/get-publish-task.js';
import {
  publishToYoutube,
  publishToTiktok,
  publishToInstagram,
  publishToX,
} from './tools/publishing/publish-to-platform.js';
import { reportPublishResult } from './tools/publishing/report-publish-result.js';

// ---------------------------------------------------------------------------
// Measurement tools
// ---------------------------------------------------------------------------
import { getMeasurementTasks } from './tools/measurement/get-measurement-tasks.js';
import {
  collectYoutubeMetrics,
  collectTiktokMetrics,
  collectInstagramMetrics,
  collectXMetrics,
} from './tools/measurement/collect-platform-metrics.js';
import { collectAccountMetrics } from './tools/measurement/collect-account-metrics.js';
import { reportMeasurementComplete } from './tools/measurement/report-measurement-complete.js';

// ---------------------------------------------------------------------------
// Dashboard tools
// ---------------------------------------------------------------------------
import { getDashboardSummary } from './tools/dashboard/get-dashboard-summary.js';
import { updateSystemConfig } from './tools/dashboard/update-system-config.js';
import { submitHumanDirective } from './tools/dashboard/submit-human-directive.js';
import { getPendingApprovals } from './tools/dashboard/get-pending-approvals.js';
import { approveOrRejectPlan } from './tools/dashboard/approve-or-reject-plan.js';
import { submitLearningGuidance } from './tools/dashboard/submit-learning-guidance.js';
import { getLearningDirectives } from './tools/dashboard/get-learning-directives.js';
import { rollbackAgentPrompt } from './tools/dashboard/rollback-agent-prompt.js';

// ---------------------------------------------------------------------------
// Curation tools
// ---------------------------------------------------------------------------
import { getCurationQueue } from './tools/curation/get-curation-queue.js';
import { createComponent } from './tools/curation/create-component.js';
import { updateComponentData } from './tools/curation/update-component-data.js';
import { markCurationComplete } from './tools/curation/mark-curation-complete.js';
import { getSimilarComponents } from './tools/curation/get-similar-components.js';
import { submitForHumanReview } from './tools/curation/submit-for-human-review.js';
import { createCharacterProfile } from './tools/curation/create-character-profile.js';
import { generateCharacterImage } from './tools/curation/generate-character-image.js';
import { selectVoiceProfile } from './tools/curation/select-voice-profile.js';

// ---------------------------------------------------------------------------
// Agent management tools (Dashboard Curation + prompt management)
// ---------------------------------------------------------------------------
import { getCuratedComponentsForReview } from './tools/agent-mgmt/get-curated-components-for-review.js';
import { approveCuratedComponent } from './tools/agent-mgmt/approve-curated-component.js';
import { submitReferenceContent } from './tools/agent-mgmt/submit-reference-content.js';
import { updateAgentPrompt } from './tools/agent-mgmt/update-agent-prompt.js';
import { updatePromptSuggestionStatus } from './tools/agent-mgmt/update-prompt-suggestion-status.js';
import { checkToolCount } from './tools/agent-mgmt/check-tool-count.js';

// ---------------------------------------------------------------------------
// Learning / self-learning tools
// ---------------------------------------------------------------------------
import { getRecentReflections } from './tools/learning/get-recent-reflections.js';
import { saveIndividualLearning } from './tools/learning/save-individual-learning.js';
import { getIndividualLearnings } from './tools/learning/get-individual-learnings.js';
import { peekOtherAgentLearnings } from './tools/learning/peek-other-agent-learnings.js';
import { submitAgentMessage } from './tools/learning/submit-agent-message.js';
import { getHumanResponses } from './tools/learning/get-human-responses.js';
import { markLearningApplied } from './tools/learning/mark-learning-applied.js';
import { getTopLearnings } from './tools/learning/get-top-learnings.js';
import { searchSimilarLearnings } from './tools/learning/search-similar-learnings.js';

// ============================================================================
// Helper: wrap a tool function with error handling
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolFn = (...args: any[]) => Promise<unknown>;

/**
 * Wraps a tool implementation function with standardised error handling.
 * The returned callback matches the MCP SDK ToolCallback signature.
 * Returns `any` to bridge the zod version mismatch between project (3.23)
 * and the MCP SDK's bundled zod (3.25) which changes CallToolResult's shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapTool(fn: AnyToolFn): any {
  return async (args: Record<string, unknown>) => {
    try {
      const result = await fn(args);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text' as const, text: message }],
      };
    }
  };
}

/**
 * Wraps a zero-argument tool function with error handling.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapToolNoArgs(fn: () => Promise<unknown>): any {
  return async () => {
    try {
      const result = await fn();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: 'text' as const, text: message }],
      };
    }
  };
}

/**
 * Helper to cast a Zod schema shape for the MCP SDK's server.tool() method.
 * Required because the project uses zod 3.23.8 while the SDK bundles zod 3.25.x
 * which adds ~standard / ~validate properties to ZodType. The runtime instances
 * are compatible; only the declaration-level types diverge.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function schema(shape: Record<string, unknown>): any {
  return shape;
}

// ============================================================================
// Server setup
// ============================================================================

const server = new McpServer({ name: 'ai-influencer-v5', version: '5.0.0' });

// ---------------------------------------------------------------------------
// 4.1 Strategic Agent (10 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_portfolio_kpi_summary',
  'Returns KPI summary across all accounts for a given period',
  schema({ period: z.string().describe('Period: "7d" or "30d"') }),
  wrapTool(getPortfolioKpiSummary),
);

server.tool(
  'get_cluster_performance',
  'Returns performance metrics for a given cluster',
  schema({ cluster: z.string().describe('Cluster identifier') }),
  wrapTool(getClusterPerformance),
);

server.tool(
  'get_top_learnings',
  'Returns top N learnings by confidence',
  schema({ limit: z.number().optional(), min_confidence: z.number().optional() }),
  wrapTool(getTopLearnings),
);

server.tool(
  'get_active_hypotheses',
  'Returns active (pending) hypotheses',
  schema({ cluster: z.string().optional(), limit: z.number().optional() }),
  wrapTool(getActiveHypotheses),
);

server.tool(
  'get_algorithm_performance',
  'Returns algorithm performance metrics',
  schema({ period: z.string().optional() }),
  wrapTool(getAlgorithmPerformance),
);

server.tool(
  'get_pending_directives',
  'Returns pending human directives ordered by priority',
  schema({}),
  wrapTool(getPendingDirectives),
);

server.tool(
  'create_cycle',
  'Creates a new strategy cycle',
  schema({ cycle_type: z.string(), cluster: z.string().optional() }),
  wrapTool(createCycle),
);

server.tool(
  'set_cycle_plan',
  'Sets the plan for a cycle',
  schema({ cycle_id: z.number(), plan: z.any() }),
  wrapTool(setCyclePlan),
);

server.tool(
  'allocate_resources',
  'Allocates resources for a cycle',
  schema({ cycle_id: z.number(), allocations: z.any() }),
  wrapTool(allocateResources),
);

server.tool(
  'send_planner_directive',
  'Sends a directive to planner agents',
  schema({ cluster: z.string(), directive_text: z.string() }),
  wrapTool(sendPlannerDirective),
);

// ---------------------------------------------------------------------------
// 4.2 Researcher (12 tools)
// ---------------------------------------------------------------------------

server.tool(
  'save_trending_topic',
  'Saves a trending topic to intelligence store',
  schema({ platform: z.string(), topic: z.string(), relevance_score: z.number().optional() }),
  wrapTool(saveTrendingTopic),
);

server.tool(
  'save_competitor_post',
  'Saves a competitor post to intelligence store',
  schema({ competitor_account_id: z.string().optional(), platform: z.string(), post_url: z.string() }),
  wrapTool(saveCompetitorPost),
);

server.tool(
  'save_competitor_account',
  'Saves a competitor account to intelligence store',
  schema({ platform: z.string(), handle: z.string(), niche: z.string() }),
  wrapTool(saveCompetitorAccount),
);

server.tool(
  'save_audience_signal',
  'Saves an audience signal to intelligence store',
  schema({ signal_type: z.string(), description: z.string() }),
  wrapTool(saveAudienceSignal),
);

server.tool(
  'save_platform_update',
  'Saves a platform update to intelligence store',
  schema({ platform: z.string(), update_type: z.string(), description: z.string() }),
  wrapTool(savePlatformUpdate),
);

server.tool(
  'get_recent_intel',
  'Returns recent intelligence entries with optional filters',
  schema({ intel_type: z.string().optional(), platform: z.string().optional(), limit: z.number().optional() }),
  wrapTool(getRecentIntel),
);

server.tool(
  'search_similar_intel',
  'Vector search for similar intelligence entries',
  schema({ query_embedding: z.array(z.number()), limit: z.number().optional() }),
  wrapTool(searchSimilarIntel),
);

server.tool(
  'get_niche_trends',
  'Returns aggregated trend data for a niche',
  schema({ niche: z.string(), platform: z.string().optional() }),
  wrapTool(getNicheTrends),
);

server.tool(
  'get_competitor_analysis',
  'Returns competitor analysis data',
  schema({ niche: z.string().optional(), platform: z.string().optional() }),
  wrapTool(getCompetitorAnalysis),
);

server.tool(
  'get_platform_changes',
  'Returns recent platform changes and updates',
  schema({ platform: z.string().optional() }),
  wrapTool(getPlatformChanges),
);

server.tool(
  'mark_intel_expired',
  'Marks intelligence entries as expired',
  schema({ intel_ids: z.array(z.number()) }),
  wrapTool(markIntelExpired),
);

server.tool(
  'get_intel_gaps',
  'Identifies gaps in intelligence coverage',
  schema({ niche: z.string().optional() }),
  wrapTool(getIntelGaps),
);

// ---------------------------------------------------------------------------
// 4.3 Analyst (22 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_metrics_for_analysis',
  'Returns metrics data for analysis',
  schema({ cycle_id: z.number().optional(), account_id: z.string().optional() }),
  wrapTool(getMetricsForAnalysis),
);

server.tool(
  'get_hypothesis_results',
  'Returns results for hypotheses',
  schema({ hypothesis_id: z.number().optional(), cycle_id: z.number().optional() }),
  wrapTool(getHypothesisResults),
);

server.tool(
  'verify_hypothesis',
  'Updates hypothesis verdict based on evidence',
  schema({ hypothesis_id: z.number(), verdict: z.string(), evidence: z.string().optional() }),
  wrapTool(verifyHypothesis),
);

server.tool(
  'create_analysis',
  'Creates a new analysis record',
  schema({ cycle_id: z.number().optional(), analysis_type: z.string(), findings: z.string(), recommendations: z.string() }),
  wrapTool(createAnalysis),
);

server.tool(
  'extract_learning',
  'Extracts and saves a learning from analysis',
  schema({ analysis_id: z.number().optional(), insight: z.string(), category: z.string().optional() }),
  wrapTool(extractLearning),
);

server.tool(
  'update_learning_confidence',
  'Updates the confidence score of a learning',
  schema({ learning_id: z.number(), confidence: z.number() }),
  wrapTool(updateLearningConfidence),
);

server.tool(
  'search_similar_learnings',
  'Vector search for similar learnings',
  schema({ query_embedding: z.array(z.number()), limit: z.number().optional() }),
  wrapTool(searchSimilarLearnings),
);

server.tool(
  'detect_anomalies',
  'Detects statistical anomalies in metrics',
  schema({ account_id: z.string().optional(), threshold: z.number().optional() }),
  wrapTool(detectAnomalies),
);

server.tool(
  'get_component_scores',
  'Returns performance scores for components',
  schema({ component_type: z.string().optional(), limit: z.number().optional() }),
  wrapTool(getComponentScores),
);

server.tool(
  'update_component_score',
  'Updates the performance score of a component',
  schema({ component_id: z.string(), score: z.number() }),
  wrapTool(updateComponentScore),
);

server.tool(
  'calculate_algorithm_performance',
  'Calculates algorithm performance metrics',
  schema({ period: z.string().optional() }),
  wrapTool(calculateAlgorithmPerformance),
);

server.tool(
  'get_niche_performance_trends',
  'Returns niche performance trend data',
  schema({ niche: z.string(), period: z.string().optional() }),
  wrapTool(getNichePerformanceTrends),
);

server.tool(
  'compare_hypothesis_predictions',
  'Compares hypothesis predictions against actual results',
  schema({ hypothesis_id: z.number().optional(), cycle_id: z.number().optional() }),
  wrapTool(compareHypothesisPredictions),
);

server.tool(
  'generate_improvement_suggestions',
  'Generates improvement suggestions based on analysis',
  schema({ account_id: z.string().optional(), niche: z.string().optional() }),
  wrapTool(generateImprovementSuggestions),
);

server.tool(
  'get_content_prediction',
  'Returns content performance predictions',
  schema({ content_id: z.string() }),
  wrapTool(getContentPrediction),
);

server.tool(
  'get_content_metrics',
  'Returns actual metrics for a content item',
  schema({ content_id: z.string() }),
  wrapTool(getContentMetrics),
);

server.tool(
  'get_daily_micro_analyses_summary',
  'Returns summary of daily micro analyses',
  schema({ date: z.string().optional(), niche: z.string().optional() }),
  wrapTool(getDailyMicroAnalysesSummary),
);

server.tool(
  'run_weight_recalculation',
  'Runs weight recalculation for algorithm scoring',
  schema({}),
  wrapTool(runWeightRecalculation),
);

server.tool(
  'run_baseline_update',
  'Runs baseline update for accounts',
  schema({}),
  wrapTool(runBaselineUpdateTool),
);

server.tool(
  'run_adjustment_cache_update',
  'Updates adjustment cache for algorithm',
  schema({}),
  wrapTool(runAdjustmentCacheUpdate),
);

server.tool(
  'run_kpi_snapshot',
  'Takes a KPI snapshot',
  schema({}),
  wrapTool(runKpiSnapshot),
);

server.tool(
  'run_cumulative_analysis',
  'Runs cumulative analysis across cycles',
  schema({}),
  wrapTool(runCumulativeAnalysis),
);

// ---------------------------------------------------------------------------
// 4.4 Planner (9 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_assigned_accounts',
  'Returns active accounts for a cluster',
  schema({ cluster: z.string() }),
  wrapTool(getAssignedAccounts),
);

server.tool(
  'get_account_performance',
  'Returns performance data for an account',
  schema({ account_id: z.string() }),
  wrapTool(getAccountPerformance),
);

server.tool(
  'get_available_components',
  'Returns available components for content planning',
  schema({ component_type: z.string().optional(), niche: z.string().optional() }),
  wrapTool(getAvailableComponents),
);

server.tool(
  'create_hypothesis',
  'Creates a new hypothesis for testing',
  schema({ account_id: z.string().optional(), hypothesis_text: z.string(), predicted_outcome: z.string().optional() }),
  wrapTool(createHypothesis),
);

server.tool(
  'plan_content',
  'Plans content based on strategy and components',
  schema({ account_id: z.string(), scenario_data: z.any() }),
  wrapTool(planContent),
);

server.tool(
  'schedule_content',
  'Schedules content for publishing',
  schema({ content_id: z.string(), scheduled_at: z.string() }),
  wrapTool(scheduleContent),
);

server.tool(
  'get_niche_learnings',
  'Returns learnings specific to a niche',
  schema({ niche: z.string(), limit: z.number().optional() }),
  wrapTool(getNicheLearnings),
);

server.tool(
  'get_content_pool_status',
  'Returns content pool status for accounts',
  schema({ account_id: z.string().optional(), cluster: z.string().optional() }),
  wrapTool(getContentPoolStatus),
);

server.tool(
  'request_production',
  'Requests production for planned content',
  schema({ content_id: z.string() }),
  wrapTool(requestProduction),
);

// ---------------------------------------------------------------------------
// 4.5 Tool Specialist (5 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_tool_knowledge',
  'Returns knowledge about external tools',
  schema({ tool_name: z.string().optional(), category: z.string().optional() }),
  wrapTool(getToolKnowledge),
);

server.tool(
  'save_tool_experience',
  'Saves experience with an external tool',
  schema({ tool_name: z.string(), experience: z.string() }),
  wrapTool(saveToolExperience),
);

server.tool(
  'search_similar_tool_usage',
  'Searches for similar tool usage patterns',
  schema({ query_embedding: z.array(z.number()), limit: z.number().optional() }),
  wrapTool(searchSimilarToolUsage),
);

server.tool(
  'get_tool_recommendations',
  'Returns tool recommendations for a task',
  schema({ task_type: z.string().optional(), category: z.string().optional() }),
  wrapTool(getToolRecommendations),
);

server.tool(
  'update_tool_knowledge_from_external',
  'Updates tool knowledge from external source',
  schema({ tool_name: z.string(), update_type: z.string(), description: z.string(), source_url: z.string().optional() }),
  wrapTool(updateToolKnowledgeFromExternal),
);

// ---------------------------------------------------------------------------
// 4.6 Production Worker (12 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_production_task',
  'Returns the next pending production task',
  schema({}),
  wrapTool(getProductionTask),
);

server.tool(
  'generate_script',
  'Generates hook/body/CTA scripts from scenario data',
  schema({ content_id: z.string(), script_language: z.string(), scenario_data: z.any() }),
  wrapTool(generateScript),
);

server.tool(
  'get_character_info',
  'Returns character information',
  schema({ character_id: z.string() }),
  wrapTool(getCharacterInfo),
);

server.tool(
  'get_component_data',
  'Returns component data for production',
  schema({ component_id: z.string() }),
  wrapTool(getComponentData),
);

server.tool(
  'start_video_generation',
  'Starts video generation via external API',
  schema({ content_id: z.string(), prompt: z.string().optional() }),
  wrapTool(startVideoGeneration),
);

server.tool(
  'check_video_status',
  'Checks the status of a video generation job',
  schema({ job_id: z.string() }),
  wrapTool(checkVideoStatus),
);

server.tool(
  'start_tts',
  'Starts text-to-speech generation',
  schema({ content_id: z.string(), text: z.string(), voice_id: z.string().optional() }),
  wrapTool(startTts),
);

server.tool(
  'start_lipsync',
  'Starts lipsync generation',
  schema({ content_id: z.string(), video_url: z.string().optional(), audio_url: z.string().optional() }),
  wrapTool(startLipsync),
);

server.tool(
  'upload_to_drive',
  'Uploads content to Google Drive',
  schema({ content_id: z.string(), file_path: z.string().optional() }),
  wrapTool(uploadToDrive),
);

server.tool(
  'update_content_status',
  'Updates the status of a content item',
  schema({ content_id: z.string(), status: z.string() }),
  wrapTool(updateContentStatus),
);

server.tool(
  'run_quality_check',
  'Runs quality check on produced content',
  schema({ content_id: z.string() }),
  wrapTool(runQualityCheck),
);

server.tool(
  'report_production_complete',
  'Reports production as complete',
  schema({ content_id: z.string(), task_id: z.number().optional() }),
  wrapTool(reportProductionComplete),
);

// ---------------------------------------------------------------------------
// 4.7 Publishing Worker (6 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_publish_task',
  'Returns the next pending publish task',
  schema({}),
  wrapTool(getPublishTask),
);

server.tool(
  'publish_to_youtube',
  'Publishes content to YouTube',
  schema({ content_id: z.string() }),
  wrapTool(publishToYoutube),
);

server.tool(
  'publish_to_tiktok',
  'Publishes content to TikTok',
  schema({ content_id: z.string() }),
  wrapTool(publishToTiktok),
);

server.tool(
  'publish_to_instagram',
  'Publishes content to Instagram',
  schema({ content_id: z.string() }),
  wrapTool(publishToInstagram),
);

server.tool(
  'publish_to_x',
  'Publishes content to X (Twitter)',
  schema({ content_id: z.string() }),
  wrapTool(publishToX),
);

server.tool(
  'report_publish_result',
  'Reports the result of a platform publish',
  schema({
    task_id: z.number(),
    content_id: z.string(),
    platform_post_id: z.string(),
    post_url: z.string(),
    posted_at: z.string(),
  }),
  wrapTool(reportPublishResult),
);

// ---------------------------------------------------------------------------
// 4.8 Measurement Worker (7 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_measurement_tasks',
  'Returns pending measurement tasks',
  schema({}),
  wrapTool(getMeasurementTasks),
);

server.tool(
  'collect_youtube_metrics',
  'Collects metrics for a YouTube post',
  schema({ platform_post_id: z.string() }),
  wrapTool(collectYoutubeMetrics),
);

server.tool(
  'collect_tiktok_metrics',
  'Collects metrics for a TikTok post',
  schema({ platform_post_id: z.string() }),
  wrapTool(collectTiktokMetrics),
);

server.tool(
  'collect_instagram_metrics',
  'Collects metrics for an Instagram post',
  schema({ platform_post_id: z.string() }),
  wrapTool(collectInstagramMetrics),
);

server.tool(
  'collect_x_metrics',
  'Collects metrics for an X (Twitter) post',
  schema({ platform_post_id: z.string() }),
  wrapTool(collectXMetrics),
);

server.tool(
  'collect_account_metrics',
  'Collects account-level metrics (followers, delta)',
  schema({ account_id: z.string() }),
  wrapTool(collectAccountMetrics),
);

server.tool(
  'report_measurement_complete',
  'Reports measurement as complete for a task',
  schema({ task_id: z.number(), content_id: z.string() }),
  wrapTool(reportMeasurementComplete),
);

// ---------------------------------------------------------------------------
// 4.9 Dashboard (10 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_dashboard_summary',
  'Returns dashboard summary with KPIs and pending items',
  schema({}),
  wrapTool(getDashboardSummary),
);

server.tool(
  'update_system_config',
  'Updates a system configuration value',
  schema({ key: z.string(), value: z.any() }),
  wrapTool(updateSystemConfig),
);

server.tool(
  'submit_human_directive',
  'Submits a human directive',
  schema({ directive_type: z.string(), content: z.string(), priority: z.string().optional() }),
  wrapTool(submitHumanDirective),
);

server.tool(
  'get_pending_approvals',
  'Returns items pending human approval',
  schema({}),
  wrapTool(getPendingApprovals),
);

server.tool(
  'approve_or_reject_plan',
  'Approves or rejects a plan',
  schema({ plan_id: z.number(), action: z.string(), reason: z.string().optional() }),
  wrapTool(approveOrRejectPlan),
);

server.tool(
  'submit_learning_guidance',
  'Submits learning guidance from human',
  schema({ learning_id: z.number().optional(), guidance: z.string() }),
  wrapTool(submitLearningGuidance),
);

server.tool(
  'get_learning_directives',
  'Returns learning directives',
  schema({}),
  wrapTool(getLearningDirectives),
);

server.tool(
  'update_agent_prompt',
  'Updates an agent prompt configuration',
  schema({ agent_name: z.string(), prompt_text: z.string() }),
  wrapTool(updateAgentPrompt),
);

server.tool(
  'rollback_agent_prompt',
  'Rolls back an agent prompt to a previous version',
  schema({ agent_name: z.string(), version: z.number().optional() }),
  wrapTool(rollbackAgentPrompt),
);

server.tool(
  'update_prompt_suggestion_status',
  'Updates the status of a prompt suggestion',
  schema({ suggestion_id: z.number(), status: z.string() }),
  wrapTool(updatePromptSuggestionStatus),
);

// ---------------------------------------------------------------------------
// 4.10 Data Curator (9 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_curation_queue',
  'Returns the curation queue',
  schema({}),
  wrapTool(getCurationQueue),
);

server.tool(
  'create_component',
  'Creates a new component',
  schema({ component_type: z.string(), data: z.any() }),
  wrapTool(createComponent),
);

server.tool(
  'update_component_data',
  'Updates component data',
  schema({ component_id: z.string(), data: z.any() }),
  wrapTool(updateComponentData),
);

server.tool(
  'mark_curation_complete',
  'Marks a curation task as complete',
  schema({ component_id: z.string() }),
  wrapTool(markCurationComplete),
);

server.tool(
  'get_similar_components',
  'Returns similar components via vector search',
  schema({ query_embedding: z.array(z.number()), limit: z.number().optional() }),
  wrapTool(getSimilarComponents),
);

server.tool(
  'submit_for_human_review',
  'Submits a component for human review',
  schema({ component_id: z.string(), review_notes: z.string().optional() }),
  wrapTool(submitForHumanReview),
);

server.tool(
  'create_character_profile',
  'Creates a new character profile',
  schema({
    niche: z.string(),
    target_market: z.string(),
    name_suggestion: z.string().optional(),
    personality_traits: z.array(z.string()).optional(),
  }),
  wrapTool(createCharacterProfile),
);

server.tool(
  'generate_character_image',
  'Generates a character image via AI',
  schema({ character_id: z.string(), prompt: z.string().optional() }),
  wrapTool(generateCharacterImage),
);

server.tool(
  'select_voice_profile',
  'Selects a voice profile for a character',
  schema({ character_id: z.string(), voice_id: z.string().optional() }),
  wrapTool(selectVoiceProfile),
);

// ---------------------------------------------------------------------------
// 4.11 Dashboard Curation (3 tools)
// ---------------------------------------------------------------------------

server.tool(
  'get_curated_components_for_review',
  'Returns components awaiting human review',
  schema({}),
  wrapTool(getCuratedComponentsForReview),
);

server.tool(
  'approve_curated_component',
  'Approves a curated component',
  schema({ component_id: z.string(), modifications: z.any().optional() }),
  wrapTool(approveCuratedComponent),
);

server.tool(
  'submit_reference_content',
  'Submits reference content for curation',
  schema({ url: z.string(), description: z.string().optional() }),
  wrapTool(submitReferenceContent),
);

// ---------------------------------------------------------------------------
// 4.12 Self-Learning & Communication (11 unique tools; 3 shared listed in 4.3)
// ---------------------------------------------------------------------------

server.tool(
  'save_reflection',
  'Saves an agent reflection',
  schema({ agent_name: z.string(), reflection: z.string() }),
  wrapTool(saveReflection),
);

server.tool(
  'get_recent_reflections',
  'Returns recent agent reflections',
  schema({ agent_name: z.string().optional(), limit: z.number().optional() }),
  wrapTool(getRecentReflections),
);

server.tool(
  'save_individual_learning',
  'Saves an individual learning for an agent',
  schema({ agent_name: z.string(), insight: z.string(), category: z.string().optional() }),
  wrapTool(saveIndividualLearning),
);

server.tool(
  'get_individual_learnings',
  'Returns individual learnings for an agent',
  schema({ agent_name: z.string(), limit: z.number().optional() }),
  wrapTool(getIndividualLearnings),
);

server.tool(
  'peek_other_agent_learnings',
  'Peeks at learnings from other agents',
  schema({ agent_name: z.string().optional(), limit: z.number().optional() }),
  wrapTool(peekOtherAgentLearnings),
);

server.tool(
  'submit_agent_message',
  'Submits a message from agent to human',
  schema({ agent_name: z.string(), message: z.string() }),
  wrapTool(submitAgentMessage),
);

server.tool(
  'get_human_responses',
  'Returns human responses to agent messages',
  schema({ agent_name: z.string().optional() }),
  wrapTool(getHumanResponses),
);

server.tool(
  'mark_learning_applied',
  'Marks a learning as applied',
  schema({ learning_id: z.number() }),
  wrapTool(markLearningApplied),
);

server.tool(
  'search_content_learnings',
  'Vector search for content learnings',
  schema({ query_embedding: z.array(z.number()), niche: z.string().optional(), limit: z.number().optional() }),
  wrapTool(searchContentLearnings),
);

server.tool(
  'create_micro_analysis',
  'Creates a micro analysis for a content item',
  schema({ content_id: z.string(), predicted_kpis: z.any(), actual_kpis: z.any(), micro_verdict: z.string() }),
  wrapTool(createMicroAnalysis),
);

server.tool(
  'save_micro_reflection',
  'Saves a micro reflection for a content learning',
  schema({
    content_learning_id: z.string(),
    what_worked: z.array(z.string()),
    what_didnt_work: z.array(z.string()),
    key_insight: z.string(),
  }),
  wrapTool(saveMicroReflection),
);

// ---------------------------------------------------------------------------
// Meta-tool (agent management)
// ---------------------------------------------------------------------------

server.tool(
  'check_tool_count',
  'Returns the total number of registered MCP tools',
  wrapToolNoArgs(checkToolCount),
);

// ============================================================================
// Start the server
// ============================================================================

export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Allow direct execution
if (process.argv[1]?.endsWith('mcp-server/index.ts') || process.argv[1]?.endsWith('mcp-server/index.js')) {
  startMcpServer().catch((err: unknown) => {
    console.error('MCP Server failed to start:', err);
    process.exit(1);
  });
}
