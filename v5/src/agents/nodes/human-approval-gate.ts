/**
 * FEAT-STR-003: STRATEGY_APPROVAL_REQUIRED=true human approval flow
 * Spec: 04-agent-design.md §5.1, 02-architecture.md §3.3
 *
 * When STRATEGY_APPROVAL_REQUIRED (mapped to HUMAN_REVIEW_ENABLED in state config),
 * the graph pauses at the human_review_gate node using LangGraph NodeInterrupt.
 * Content status transitions to 'pending_approval' until human approves via dashboard.
 *
 * All config from DB system_settings — no hardcoding.
 */
import { NodeInterrupt } from '@langchain/langgraph';
import type { StrategyCycleAnnotationType } from '../graphs/strategy-cycle';
import type { HumanApprovalResult } from '../../../types/langgraph-state';

/**
 * Human approval gate node.
 *
 * When invoked:
 * 1. Sets content status to 'pending_approval' (via state update)
 * 2. Throws NodeInterrupt to pause the graph
 * 3. On resume (after dashboard approval), receives the human decision
 *
 * The resume value is expected to be a HumanApprovalResult.
 */
export async function humanApprovalGateNode(
  state: StrategyCycleAnnotationType,
): Promise<Partial<StrategyCycleAnnotationType>> {
  // If we already have a human approval result (resuming after interrupt),
  // just return the state as-is — the edge routing will handle the decision.
  if (state.human_approval?.status === 'approved' || state.human_approval?.status === 'rejected') {
    // Check if this is a resume with fresh data (not the initial default)
    // The graph framework will resume with updated state
    return {};
  }

  // First invocation: interrupt and wait for human decision
  throw new NodeInterrupt(
    'Awaiting human approval for strategy cycle plan. ' +
    'Review the content plans in the dashboard and approve or reject.',
  );
}

/**
 * Create a human approval gate node that updates content status
 * before interrupting.
 */
export function createHumanApprovalGateNode(
  onPendingApproval?: (cycleId: number) => Promise<void>,
) {
  return async (
    state: StrategyCycleAnnotationType,
  ): Promise<Partial<StrategyCycleAnnotationType>> => {
    // If already reviewed, pass through
    if (state.human_approval?.status === 'approved' || state.human_approval?.status === 'rejected') {
      return {};
    }

    // Notify that we're entering pending_approval
    if (onPendingApproval) {
      await onPendingApproval(state.cycle_id);
    }

    // Interrupt for human review
    throw new NodeInterrupt(
      'Awaiting human approval for strategy cycle plan.',
    );
  };
}
