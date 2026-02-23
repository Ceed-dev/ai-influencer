/**
 * FEAT-STR-001: Strategy Cycle Graph — node execution order
 * Spec: 04-agent-design.md §5.1, 02-architecture.md §3.3
 *
 * Daily strategy cycle: collect_intel → analyze_cycle → set_strategy →
 * plan_content → select_tools → approve_plan → (human_review_gate?) → reflect_all
 *
 * Note: The spec node "human_approval" is named "human_review_gate" in the graph
 * because LangGraph disallows node names that collide with state attribute names.
 * The state field `human_approval` holds the human review result.
 *
 * All config from DB system_settings — no hardcoding.
 */
import { StateGraph, Annotation } from '@langchain/langgraph';
import type {
  StrategyCycleState,
  StrategyCycleNode,
  RejectionCategory,
} from '../../../types/langgraph-state';

// ---------------------------------------------------------------------------
// Node name constants
// ---------------------------------------------------------------------------

/** Internal graph node name for the human approval step.
 *  Renamed from spec's "human_approval" to avoid LangGraph state/node name collision.
 */
export const HUMAN_REVIEW_NODE = 'human_review_gate' as const;

// ---------------------------------------------------------------------------
// State annotation — LangGraph requires Annotation-based state definition
// ---------------------------------------------------------------------------

export const StrategyCycleAnnotation = Annotation.Root({
  cycle_id: Annotation<number>,
  cycle_number: Annotation<number>,
  started_at: Annotation<string>,

  market_intel: Annotation<StrategyCycleState['market_intel']>,
  analysis: Annotation<StrategyCycleState['analysis']>,
  strategy: Annotation<StrategyCycleState['strategy']>,
  content_plans: Annotation<StrategyCycleState['content_plans']>,
  tool_recipes: Annotation<StrategyCycleState['tool_recipes']>,
  approval: Annotation<StrategyCycleState['approval']>,
  human_approval: Annotation<StrategyCycleState['human_approval']>,
  config: Annotation<StrategyCycleState['config']>,
  reflections: Annotation<StrategyCycleState['reflections']>,
  errors: Annotation<StrategyCycleState['errors']>,
});

export type StrategyCycleAnnotationType = typeof StrategyCycleAnnotation.State;

// ---------------------------------------------------------------------------
// Node function type
// ---------------------------------------------------------------------------

export type NodeFn = (
  state: StrategyCycleAnnotationType,
) => Promise<Partial<StrategyCycleAnnotationType>>;

// ---------------------------------------------------------------------------
// Default (stub) node implementations
// Each real node will be imported from src/agents/nodes/
// ---------------------------------------------------------------------------

const defaultCollectIntel: NodeFn = async (_state) => ({});
const defaultAnalyzeCycle: NodeFn = async (_state) => ({});
const defaultSetStrategy: NodeFn = async (_state) => ({});
const defaultPlanContent: NodeFn = async (_state) => ({});
const defaultSelectTools: NodeFn = async (_state) => ({});
const defaultApprovePlan: NodeFn = async (_state) => ({});
const defaultHumanReviewGate: NodeFn = async (_state) => ({});
const defaultReflectAll: NodeFn = async (_state) => ({});

// ---------------------------------------------------------------------------
// Edge routing types (graph-internal, maps to spec types via HUMAN_REVIEW_NODE)
// ---------------------------------------------------------------------------

type ApprovePlanEdgeTarget =
  | typeof HUMAN_REVIEW_NODE
  | 'reflect_all'
  | 'collect_intel'
  | 'analyze_cycle'
  | 'plan_content';

type HumanReviewEdgeTarget =
  | 'reflect_all'
  | 'collect_intel'
  | 'analyze_cycle'
  | 'plan_content';

// ---------------------------------------------------------------------------
// Edge routing functions
// ---------------------------------------------------------------------------

/**
 * After approve_plan: route based on approval result.
 * - rejected + plan_revision → plan_content
 * - rejected + data_insufficient → collect_intel
 * - rejected + hypothesis_weak → analyze_cycle
 * - approved + HUMAN_REVIEW_ENABLED → human_review_gate
 * - approved + !HUMAN_REVIEW_ENABLED → reflect_all
 */
export function approvePlanEdge(
  state: StrategyCycleAnnotationType,
): ApprovePlanEdgeTarget {
  const { approval, config } = state;

  if (approval.status === 'rejected') {
    const category: RejectionCategory = approval.rejection_category ?? 'plan_revision';
    switch (category) {
      case 'data_insufficient':
        return 'collect_intel';
      case 'hypothesis_weak':
        return 'analyze_cycle';
      case 'plan_revision':
      default:
        return 'plan_content';
    }
  }

  // Approved
  if (config.HUMAN_REVIEW_ENABLED) {
    return HUMAN_REVIEW_NODE;
  }
  return 'reflect_all';
}

/**
 * After human_review_gate: route based on human decision.
 * - rejected + rejection_category routing (same as approve_plan)
 * - approved → reflect_all
 */
export function humanReviewEdge(
  state: StrategyCycleAnnotationType,
): HumanReviewEdgeTarget {
  const { human_approval } = state;

  if (human_approval.status === 'rejected') {
    const category: RejectionCategory = human_approval.rejection_category ?? 'plan_revision';
    switch (category) {
      case 'data_insufficient':
        return 'collect_intel';
      case 'hypothesis_weak':
        return 'analyze_cycle';
      case 'plan_revision':
      default:
        return 'plan_content';
    }
  }

  return 'reflect_all';
}

// ---------------------------------------------------------------------------
// Graph builder options
// ---------------------------------------------------------------------------

export interface StrategyGraphOptions {
  collectIntel?: NodeFn;
  analyzeCycle?: NodeFn;
  setStrategy?: NodeFn;
  planContent?: NodeFn;
  selectTools?: NodeFn;
  approvePlan?: NodeFn;
  humanReviewGate?: NodeFn;
  reflectAll?: NodeFn;
}

// ---------------------------------------------------------------------------
// Build the strategy cycle graph
// ---------------------------------------------------------------------------

/**
 * Create the Strategy Cycle StateGraph.
 * Node functions can be injected for testing or replaced with real implementations.
 */
export function buildStrategyCycleGraph(options: StrategyGraphOptions = {}) {
  const graph = new StateGraph(StrategyCycleAnnotation)
    // Add nodes
    .addNode('collect_intel', options.collectIntel ?? defaultCollectIntel)
    .addNode('analyze_cycle', options.analyzeCycle ?? defaultAnalyzeCycle)
    .addNode('set_strategy', options.setStrategy ?? defaultSetStrategy)
    .addNode('plan_content', options.planContent ?? defaultPlanContent)
    .addNode('select_tools', options.selectTools ?? defaultSelectTools)
    .addNode('approve_plan', options.approvePlan ?? defaultApprovePlan)
    .addNode(HUMAN_REVIEW_NODE, options.humanReviewGate ?? defaultHumanReviewGate)
    .addNode('reflect_all', options.reflectAll ?? defaultReflectAll)

    // Linear edges: START → collect_intel → analyze_cycle → set_strategy → plan_content → select_tools → approve_plan
    .addEdge('__start__', 'collect_intel')
    .addEdge('collect_intel', 'analyze_cycle')
    .addEdge('analyze_cycle', 'set_strategy')
    .addEdge('set_strategy', 'plan_content')
    .addEdge('plan_content', 'select_tools')
    .addEdge('select_tools', 'approve_plan')

    // Conditional edge: approve_plan → (human_review_gate | reflect_all | plan_content | collect_intel | analyze_cycle)
    .addConditionalEdges('approve_plan', approvePlanEdge, {
      [HUMAN_REVIEW_NODE]: HUMAN_REVIEW_NODE,
      reflect_all: 'reflect_all',
      plan_content: 'plan_content',
      collect_intel: 'collect_intel',
      analyze_cycle: 'analyze_cycle',
    })

    // Conditional edge: human_review_gate → (reflect_all | plan_content | collect_intel | analyze_cycle)
    .addConditionalEdges(HUMAN_REVIEW_NODE, humanReviewEdge, {
      reflect_all: 'reflect_all',
      plan_content: 'plan_content',
      collect_intel: 'collect_intel',
      analyze_cycle: 'analyze_cycle',
    })

    // reflect_all → END
    .addEdge('reflect_all', '__end__');

  return graph;
}

/**
 * Compile the strategy cycle graph into a runnable.
 */
export function compileStrategyCycleGraph(options: StrategyGraphOptions = {}) {
  return buildStrategyCycleGraph(options).compile();
}

/**
 * Node execution order as defined in spec.
 * Maps spec node names to internal graph node names.
 */
export const STRATEGY_CYCLE_NODE_ORDER: readonly string[] = [
  'collect_intel',
  'analyze_cycle',
  'set_strategy',
  'plan_content',
  'select_tools',
  'approve_plan',
  HUMAN_REVIEW_NODE, // spec: human_approval (renamed to avoid LangGraph collision)
  'reflect_all',
] as const;

/**
 * Map from spec node name to graph internal node name.
 */
export const SPEC_TO_GRAPH_NODE: Record<StrategyCycleNode, string> = {
  collect_intel: 'collect_intel',
  analyze_cycle: 'analyze_cycle',
  set_strategy: 'set_strategy',
  plan_content: 'plan_content',
  select_tools: 'select_tools',
  approve_plan: 'approve_plan',
  human_approval: HUMAN_REVIEW_NODE,
  reflect_all: 'reflect_all',
};
