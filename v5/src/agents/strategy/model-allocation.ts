/**
 * FEAT-STR-009: Opus/Sonnet per-node model allocation
 * Spec: 04-agent-design.md §5.1, 02-architecture.md §3.3
 *
 * Defines which LLM model (Opus or Sonnet) to use for each graph node.
 * Strategic nodes use Opus (higher quality); operational nodes use Sonnet (faster, cheaper).
 * All config from DB system_settings — no hardcoding.
 */
import type { StrategyCycleNode } from '@/types/langgraph-state';

/** Available LLM models */
export type LlmModel = 'opus' | 'sonnet';

/** Model allocation config for a node */
export interface NodeModelConfig {
  node: string;
  model: LlmModel;
  rationale: string;
}

/**
 * Default model allocation per strategy cycle node.
 * Spec: 04-agent-design.md §5.1
 *   - Strategist (Opus): set_strategy, approve_plan
 *   - Researcher (Sonnet): collect_intel
 *   - Analyst (Sonnet): analyze_cycle
 *   - Planner (Sonnet x N): plan_content
 *   - Tool Specialist (Sonnet): select_tools
 *   - All agents (Sonnet): reflect_all
 */
export const DEFAULT_NODE_MODELS: Record<string, LlmModel> = {
  collect_intel: 'sonnet',
  analyze_cycle: 'sonnet',
  set_strategy: 'opus',
  plan_content: 'sonnet',
  select_tools: 'sonnet',
  approve_plan: 'opus',
  human_approval: 'opus', // N/A (human), but Opus if AI-processed
  human_review_gate: 'opus',
  reflect_all: 'sonnet',
};

/**
 * Get the model to use for a given node.
 *
 * @param nodeName - Graph node name
 * @param overrides - Optional per-node model overrides (from system_settings)
 */
export function getModelForNode(
  nodeName: string,
  overrides?: Record<string, LlmModel>,
): LlmModel {
  if (overrides?.[nodeName]) {
    return overrides[nodeName]!;
  }
  return DEFAULT_NODE_MODELS[nodeName] ?? 'sonnet';
}

/**
 * Get the full model allocation config for all nodes.
 */
export function getModelAllocation(
  overrides?: Record<string, LlmModel>,
): NodeModelConfig[] {
  const nodes = Object.keys(DEFAULT_NODE_MODELS);
  return nodes.map((node) => ({
    node,
    model: getModelForNode(node, overrides),
    rationale: getModelRationale(node),
  }));
}

/**
 * Get rationale for model allocation.
 */
function getModelRationale(nodeName: string): string {
  const rationales: Record<string, string> = {
    collect_intel: 'Research tasks: high throughput, moderate complexity. Sonnet is cost-effective.',
    analyze_cycle: 'Analysis: pattern recognition, moderate complexity. Sonnet is sufficient.',
    set_strategy: 'Strategic decisions: highest complexity, long-term impact. Opus required.',
    plan_content: 'Content planning: moderate complexity, parallelized. Sonnet for cost.',
    select_tools: 'Tool selection: knowledge-based, moderate complexity. Sonnet is sufficient.',
    approve_plan: 'Quality gate: high-stakes decision. Opus for best judgment.',
    human_approval: 'Human step: model used for AI-side processing if needed.',
    human_review_gate: 'Human step: model used for AI-side processing if needed.',
    reflect_all: 'Self-reflection: structured output, moderate complexity. Sonnet for cost.',
  };
  return rationales[nodeName] ?? 'Default allocation';
}

/**
 * Calculate estimated cost for a cycle based on model allocation.
 *
 * @param nodeTokenEstimates - Estimated tokens per node
 * @param overrides - Model overrides
 */
export function estimateCycleCost(
  nodeTokenEstimates: Record<string, { input: number; output: number }>,
  overrides?: Record<string, LlmModel>,
): { totalCostUsd: number; breakdown: Array<{ node: string; model: LlmModel; costUsd: number }> } {
  // Approximate pricing per 1M tokens (as of 2025)
  const PRICING: Record<LlmModel, { input: number; output: number }> = {
    opus: { input: 15.0, output: 75.0 },
    sonnet: { input: 3.0, output: 15.0 },
  };

  let totalCostUsd = 0;
  const breakdown: Array<{ node: string; model: LlmModel; costUsd: number }> = [];

  for (const [node, estimate] of Object.entries(nodeTokenEstimates)) {
    const model = getModelForNode(node, overrides);
    const pricing = PRICING[model];
    const costUsd =
      (estimate.input / 1_000_000) * pricing.input +
      (estimate.output / 1_000_000) * pricing.output;
    totalCostUsd += costUsd;
    breakdown.push({ node, model, costUsd });
  }

  return { totalCostUsd, breakdown };
}
