/**
 * TEST-AGT-001: 戦略サイクルグラフ — ノード実行順序
 * Spec: 12-test-specifications.md TEST-AGT-001
 *
 * Verifies: collect_intel → analyze_cycle → set_strategy → plan_content →
 *           select_tools → approve_plan → (human_review_gate or reflect_all) → reflect_all
 *
 * Pass: collect_intel is first AND set_strategy follows analyze_cycle AND reflect_all is last
 */
import {
  buildStrategyCycleGraph,
  compileStrategyCycleGraph,
  approvePlanEdge,
  humanReviewEdge,
  STRATEGY_CYCLE_NODE_ORDER,
  HUMAN_REVIEW_NODE,
  SPEC_TO_GRAPH_NODE,
  type NodeFn,
  type StrategyCycleAnnotationType,
} from '../../../src/agents/graphs/strategy-cycle';

// Helper to create a minimal valid state
function makeState(overrides: Partial<StrategyCycleAnnotationType> = {}): StrategyCycleAnnotationType {
  return {
    cycle_id: 1,
    cycle_number: 1,
    started_at: new Date().toISOString(),
    market_intel: {
      trending_topics: [],
      competitor_insights: [],
      platform_updates: [],
      audience_signals: [],
    },
    analysis: {
      previous_cycle_review: null,
      hypothesis_verifications: [],
      anomalies: [],
      new_learnings: [],
      algorithm_accuracy: 0,
    },
    strategy: {
      focus_niches: [],
      resource_allocation: [],
      human_directives_processed: [],
      key_decisions: [],
    },
    content_plans: [],
    tool_recipes: [],
    approval: {
      status: 'approved',
      revision_count: 0,
    },
    human_approval: {
      status: 'approved',
    },
    config: {
      HUMAN_REVIEW_ENABLED: false,
    },
    reflections: [],
    errors: [],
    ...overrides,
  };
}

describe('TEST-AGT-001: Strategy Cycle Graph — Node Execution Order', () => {
  it('should define all 8 required nodes and compile', () => {
    const graph = buildStrategyCycleGraph();
    const compiled = graph.compile();
    expect(compiled).toBeDefined();
  });

  it('should execute nodes in correct order: collect_intel first, set_strategy after analyze_cycle, reflect_all last (HUMAN_REVIEW_ENABLED=false)', async () => {
    const executionOrder: string[] = [];

    const makeTrackingNode = (name: string): NodeFn => {
      return async (_state) => {
        executionOrder.push(name);
        if (name === 'approve_plan') {
          return {
            approval: { status: 'approved' as const, revision_count: 0 },
          };
        }
        return {};
      };
    };

    const compiled = compileStrategyCycleGraph({
      collectIntel: makeTrackingNode('collect_intel'),
      analyzeCycle: makeTrackingNode('analyze_cycle'),
      setStrategy: makeTrackingNode('set_strategy'),
      planContent: makeTrackingNode('plan_content'),
      selectTools: makeTrackingNode('select_tools'),
      approvePlan: makeTrackingNode('approve_plan'),
      humanReviewGate: makeTrackingNode('human_review_gate'),
      reflectAll: makeTrackingNode('reflect_all'),
    });

    const initialState = makeState({ config: { HUMAN_REVIEW_ENABLED: false } });
    await compiled.invoke(initialState);

    // Spec criteria:
    // - collect_intel is first
    expect(executionOrder[0]).toBe('collect_intel');
    // - set_strategy is directly after analyze_cycle
    expect(executionOrder.indexOf('set_strategy')).toBe(
      executionOrder.indexOf('analyze_cycle') + 1,
    );
    // - reflect_all is last
    expect(executionOrder[executionOrder.length - 1]).toBe('reflect_all');

    // Full order without human_review_gate (HUMAN_REVIEW_ENABLED=false)
    expect(executionOrder).toEqual([
      'collect_intel',
      'analyze_cycle',
      'set_strategy',
      'plan_content',
      'select_tools',
      'approve_plan',
      'reflect_all',
    ]);
  });

  it('should include human_review_gate when HUMAN_REVIEW_ENABLED=true', async () => {
    const executionOrder: string[] = [];

    const makeTrackingNode = (name: string): NodeFn => {
      return async (_state) => {
        executionOrder.push(name);
        if (name === 'approve_plan') {
          return {
            approval: { status: 'approved' as const, revision_count: 0 },
          };
        }
        if (name === 'human_review_gate') {
          return {
            human_approval: { status: 'approved' as const },
          };
        }
        return {};
      };
    };

    const compiled = compileStrategyCycleGraph({
      collectIntel: makeTrackingNode('collect_intel'),
      analyzeCycle: makeTrackingNode('analyze_cycle'),
      setStrategy: makeTrackingNode('set_strategy'),
      planContent: makeTrackingNode('plan_content'),
      selectTools: makeTrackingNode('select_tools'),
      approvePlan: makeTrackingNode('approve_plan'),
      humanReviewGate: makeTrackingNode('human_review_gate'),
      reflectAll: makeTrackingNode('reflect_all'),
    });

    const initialState = makeState({ config: { HUMAN_REVIEW_ENABLED: true } });
    await compiled.invoke(initialState);

    // Full order with human_review_gate (HUMAN_REVIEW_ENABLED=true)
    expect(executionOrder).toEqual([
      'collect_intel',
      'analyze_cycle',
      'set_strategy',
      'plan_content',
      'select_tools',
      'approve_plan',
      'human_review_gate',
      'reflect_all',
    ]);
    // reflect_all is still last
    expect(executionOrder[executionOrder.length - 1]).toBe('reflect_all');
  });

  it('should map all spec node names to graph node names', () => {
    expect(SPEC_TO_GRAPH_NODE.collect_intel).toBe('collect_intel');
    expect(SPEC_TO_GRAPH_NODE.human_approval).toBe(HUMAN_REVIEW_NODE);
    expect(SPEC_TO_GRAPH_NODE.reflect_all).toBe('reflect_all');
  });

  it('STRATEGY_CYCLE_NODE_ORDER should have 8 entries', () => {
    expect(STRATEGY_CYCLE_NODE_ORDER).toHaveLength(8);
    expect(STRATEGY_CYCLE_NODE_ORDER[0]).toBe('collect_intel');
    expect(STRATEGY_CYCLE_NODE_ORDER[STRATEGY_CYCLE_NODE_ORDER.length - 1]).toBe('reflect_all');
  });
});

describe('approve_plan edge routing', () => {
  it('routes to plan_content on plan_revision rejection', () => {
    const state = makeState({
      approval: { status: 'rejected', rejection_category: 'plan_revision', revision_count: 1 },
    });
    expect(approvePlanEdge(state)).toBe('plan_content');
  });

  it('routes to collect_intel on data_insufficient rejection', () => {
    const state = makeState({
      approval: { status: 'rejected', rejection_category: 'data_insufficient', revision_count: 1 },
    });
    expect(approvePlanEdge(state)).toBe('collect_intel');
  });

  it('routes to analyze_cycle on hypothesis_weak rejection', () => {
    const state = makeState({
      approval: { status: 'rejected', rejection_category: 'hypothesis_weak', revision_count: 1 },
    });
    expect(approvePlanEdge(state)).toBe('analyze_cycle');
  });

  it('routes to human_review_gate when approved and HUMAN_REVIEW_ENABLED=true', () => {
    const state = makeState({
      approval: { status: 'approved', revision_count: 0 },
      config: { HUMAN_REVIEW_ENABLED: true },
    });
    expect(approvePlanEdge(state)).toBe(HUMAN_REVIEW_NODE);
  });

  it('routes to reflect_all when approved and HUMAN_REVIEW_ENABLED=false', () => {
    const state = makeState({
      approval: { status: 'approved', revision_count: 0 },
      config: { HUMAN_REVIEW_ENABLED: false },
    });
    expect(approvePlanEdge(state)).toBe('reflect_all');
  });

  it('defaults to plan_content when rejection_category is undefined', () => {
    const state = makeState({
      approval: { status: 'rejected', revision_count: 1 },
    });
    expect(approvePlanEdge(state)).toBe('plan_content');
  });
});

describe('human_review edge routing', () => {
  it('routes to reflect_all on approval', () => {
    const state = makeState({
      human_approval: { status: 'approved' },
    });
    expect(humanReviewEdge(state)).toBe('reflect_all');
  });

  it('routes to plan_content on plan_revision rejection', () => {
    const state = makeState({
      human_approval: { status: 'rejected', rejection_category: 'plan_revision' },
    });
    expect(humanReviewEdge(state)).toBe('plan_content');
  });

  it('routes to collect_intel on data_insufficient rejection', () => {
    const state = makeState({
      human_approval: { status: 'rejected', rejection_category: 'data_insufficient' },
    });
    expect(humanReviewEdge(state)).toBe('collect_intel');
  });

  it('routes to analyze_cycle on hypothesis_weak rejection', () => {
    const state = makeState({
      human_approval: { status: 'rejected', rejection_category: 'hypothesis_weak' },
    });
    expect(humanReviewEdge(state)).toBe('analyze_cycle');
  });
});
