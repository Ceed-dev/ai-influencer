/**
 * FEAT-INT-003: Publishing Scheduler Graph
 * Spec: 04-agent-design.md §5.3, 02-architecture.md §3.4
 *
 * Nodes: check_schedule → (sleep if no tasks | publish if task found)
 *        publish → record → check_schedule
 *        handle_error → check_schedule
 *
 * Continuous polling at POSTING_POLL_INTERVAL_SEC (default: 120s).
 * Posts 'ready'/'approved' content at optimal times respecting rate limits.
 * All config from DB system_settings — no hardcoding.
 */
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type {
  PublishingSchedulerState,
  PublishingSchedulerNode,
  PublishTask,
  PublishResult,
  PlatformRateLimit,
  PublishEdgeResult,
  Platform,
} from '@/types/langgraph-state';

// ---------------------------------------------------------------------------
// State annotation
// ---------------------------------------------------------------------------

export const PublishingSchedulerAnnotation = Annotation.Root({
  current_task: Annotation<PublishTask | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  publish_result: Annotation<PublishResult | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  rate_limits: Annotation<Record<Platform, PlatformRateLimit>>({
    reducer: (_, b) => b,
    default: () => ({
      youtube: { remaining: 100, reset_at: new Date().toISOString() },
      tiktok: { remaining: 100, reset_at: new Date().toISOString() },
      instagram: { remaining: 100, reset_at: new Date().toISOString() },
      x: { remaining: 100, reset_at: new Date().toISOString() },
    }),
  }),
});

// ---------------------------------------------------------------------------
// Node functions (stubs)
// ---------------------------------------------------------------------------

async function checkSchedule(
  state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  // Stub: query DB for content with status='ready' or 'approved'
  // Check posting schedule and rate limits
  return { current_task: null, publish_result: null };
}

async function sleep(
  _state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  // Stub: wait for POSTING_POLL_INTERVAL_SEC (default: 120s)
  return {};
}

async function publish(
  state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  // Stub: execute platform-specific posting via adapters
  return {
    publish_result: {
      status: 'success',
      posted_at: new Date().toISOString(),
    },
  };
}

async function record(
  state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  // Stub: update publications, set posted_at, post_url, measure_after
  return { current_task: null };
}

async function handleError(
  state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  // Stub: log error, update task status
  return { current_task: null, publish_result: null };
}

// ---------------------------------------------------------------------------
// Conditional edge functions
// ---------------------------------------------------------------------------

export function checkScheduleEdge(
  state: typeof PublishingSchedulerAnnotation.State,
): 'sleep' | 'publish' {
  return state.current_task ? 'publish' : 'sleep';
}

export function publishEdge(
  state: typeof PublishingSchedulerAnnotation.State,
): PublishEdgeResult {
  if (state.publish_result?.status === 'failed') {
    return 'handle_error';
  }
  return 'record';
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export interface PublishingSchedulerGraphOptions {
  checkSchedule?: typeof checkSchedule;
  sleep?: typeof sleep;
  publish?: typeof publish;
  record?: typeof record;
  handleError?: typeof handleError;
}

export function buildPublishingSchedulerGraph(
  options: PublishingSchedulerGraphOptions = {},
) {
  const graph = new StateGraph(PublishingSchedulerAnnotation)
    .addNode('check_schedule', options.checkSchedule ?? checkSchedule)
    .addNode('sleep', options.sleep ?? sleep)
    .addNode('publish', options.publish ?? publish)
    .addNode('record', options.record ?? record)
    .addNode('handle_error', options.handleError ?? handleError)

    // Edges
    .addEdge(START, 'check_schedule')
    .addConditionalEdges('check_schedule', checkScheduleEdge, {
      sleep: 'sleep',
      publish: 'publish',
    })
    .addEdge('sleep', 'check_schedule')
    .addConditionalEdges('publish', publishEdge, {
      record: 'record',
      handle_error: 'handle_error',
    })
    .addEdge('record', 'check_schedule')
    .addEdge('handle_error', 'check_schedule');

  return graph;
}

/**
 * Create the compiled publishing scheduler graph with checkpointing.
 */
export function createPublishingSchedulerGraph(
  options: PublishingSchedulerGraphOptions = {},
) {
  const graph = buildPublishingSchedulerGraph(options);
  const checkpointer = new MemorySaver();
  return graph.compile({ checkpointer });
}
