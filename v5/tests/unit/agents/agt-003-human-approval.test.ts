/**
 * TEST-AGT-003: 戦略サイクルグラフ — STRATEGY_APPROVAL_REQUIRED=true 時の人間承認フロー
 * Spec: 12-test-specifications.md TEST-AGT-003
 *
 * Verifies: When STRATEGY_APPROVAL_REQUIRED=true, graph pauses at human_review_gate
 *           with content.status = 'pending_approval'
 * Pass: status = 'pending_approval' AND graph is paused
 * Fail: Proceeds to 'planned' without human approval
 */
import { NodeInterrupt } from '@langchain/langgraph';
import {
  compileStrategyCycleGraph,
  HUMAN_REVIEW_NODE,
  type NodeFn,
  type StrategyCycleAnnotationType,
} from '../../../src/agents/graphs/strategy-cycle';
import {
  humanApprovalGateNode,
  createHumanApprovalGateNode,
} from '../../../src/agents/nodes/human-approval-gate';

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
      HUMAN_REVIEW_ENABLED: true,
    },
    reflections: [],
    errors: [],
    ...overrides,
  };
}

describe('TEST-AGT-003: Human Approval Flow (STRATEGY_APPROVAL_REQUIRED=true)', () => {
  it('should throw NodeInterrupt when human approval is needed', async () => {
    const state = makeState({
      human_approval: { status: 'approved' }, // Will be reset
    });
    // Override to simulate fresh state without prior approval
    const freshState = {
      ...state,
      human_approval: {} as StrategyCycleAnnotationType['human_approval'],
    };

    await expect(humanApprovalGateNode(freshState)).rejects.toThrow(NodeInterrupt);
  });

  it('should pass through when human_approval result is already set (approved)', async () => {
    const state = makeState({
      human_approval: { status: 'approved' },
    });

    const result = await humanApprovalGateNode(state);
    expect(result).toEqual({});
  });

  it('should pass through when human_approval result is already set (rejected)', async () => {
    const state = makeState({
      human_approval: { status: 'rejected', rejection_category: 'plan_revision' },
    });

    const result = await humanApprovalGateNode(state);
    expect(result).toEqual({});
  });

  it('createHumanApprovalGateNode should call onPendingApproval before interrupting', async () => {
    const onPendingApproval = jest.fn().mockResolvedValue(undefined);
    const node = createHumanApprovalGateNode(onPendingApproval);

    const state = makeState({
      human_approval: {} as StrategyCycleAnnotationType['human_approval'],
    });

    await expect(node(state)).rejects.toThrow(NodeInterrupt);
    expect(onPendingApproval).toHaveBeenCalledWith(1); // cycle_id = 1
  });

  it('graph with HUMAN_REVIEW_ENABLED=true should route to human_review_gate', async () => {
    const executionOrder: string[] = [];

    const makeTrackingNode = (name: string): NodeFn => {
      return async (_state) => {
        executionOrder.push(name);
        if (name === 'approve_plan') {
          return {
            approval: { status: 'approved' as const, revision_count: 0 },
          };
        }
        if (name === HUMAN_REVIEW_NODE) {
          // Simulate human approval (in real use, NodeInterrupt would pause here)
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
      humanReviewGate: makeTrackingNode(HUMAN_REVIEW_NODE),
      reflectAll: makeTrackingNode('reflect_all'),
    });

    const initialState = makeState({ config: { HUMAN_REVIEW_ENABLED: true } });
    await compiled.invoke(initialState);

    // human_review_gate should be in the execution order
    expect(executionOrder).toContain(HUMAN_REVIEW_NODE);
    // It should come after approve_plan
    expect(executionOrder.indexOf(HUMAN_REVIEW_NODE)).toBeGreaterThan(
      executionOrder.indexOf('approve_plan'),
    );
    // And before reflect_all
    expect(executionOrder.indexOf(HUMAN_REVIEW_NODE)).toBeLessThan(
      executionOrder.indexOf('reflect_all'),
    );
  });

  it('graph with HUMAN_REVIEW_ENABLED=false should skip human_review_gate', async () => {
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
      humanReviewGate: makeTrackingNode(HUMAN_REVIEW_NODE),
      reflectAll: makeTrackingNode('reflect_all'),
    });

    const initialState = makeState({ config: { HUMAN_REVIEW_ENABLED: false } });
    await compiled.invoke(initialState);

    // human_review_gate should NOT be in the execution order
    expect(executionOrder).not.toContain(HUMAN_REVIEW_NODE);
  });
});
