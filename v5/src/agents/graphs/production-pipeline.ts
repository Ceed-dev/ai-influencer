/**
 * FEAT-INT-001: Production Pipeline Graph — content_format dispatch
 * FEAT-INT-002: Production Pipeline Graph — recipe_id reference
 * Spec: 02-architecture.md §3.4, 04-agent-design.md §5.2
 *
 * Nodes: poll_tasks → sleep | fetch_data → dispatch → generate_video | generate_text
 *        → quality_check → poll_tasks
 *        → handle_error → poll_tasks
 *
 * Dispatch logic: content_format determines worker type:
 *   - short_video → generate_video (code-only, recipe-driven)
 *   - text_post   → generate_text  (LLM-driven)
 *   - image_post  → future extension
 */
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type {
  ProductionPipelineState,
  ProductionPipelineNode,
  ProductionTask,
  ProductionCharacter,
  ProductionProgress,
  ProductionError,
  ProductionStatus,
  DispatchEdgeResult,
  PostProductionEdgeResult,
  ContentFormat,
} from '@/types/langgraph-state';

// ---------------------------------------------------------------------------
// State annotation
// ---------------------------------------------------------------------------

export const ProductionPipelineAnnotation = Annotation.Root({
  current_task: Annotation<ProductionTask | null>({ reducer: (_, b) => b, default: () => null }),
  character: Annotation<ProductionCharacter | null>({ reducer: (_, b) => b, default: () => null }),
  production: Annotation<ProductionProgress>({
    reducer: (_, b) => b,
    default: () => ({
      status: 'idle' as ProductionStatus,
      sections: {},
    }),
  }),
  review: Annotation<ProductionPipelineState['review']>({
    reducer: (_, b) => b,
    default: () => ({
      status: 'pending_review' as const,
      revision_count: 0,
      auto_approve_threshold: 8.0,
    }),
  }),
  config: Annotation<ProductionPipelineState['config']>({
    reducer: (_, b) => b,
    default: () => ({
      HUMAN_REVIEW_ENABLED: true,
      AUTO_APPROVE_SCORE_THRESHOLD: 8.0,
      MAX_CONTENT_REVISION_COUNT: 3,
    }),
  }),
  errors: Annotation<ProductionError[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

// ---------------------------------------------------------------------------
// Dispatch logic — content_format determines worker type
// ---------------------------------------------------------------------------

/**
 * Determine which worker to dispatch to based on content_format.
 * Spec: 02-architecture.md §5.1, 04-agent-design.md §5.2
 */
export function dispatchByContentFormat(
  contentFormat: ContentFormat,
): DispatchEdgeResult {
  switch (contentFormat) {
    case 'short_video':
      return 'generate_video';
    case 'text_post':
      return 'generate_text';
    case 'image_post':
      // Future extension — currently not implemented
      throw new Error('image_post format is not yet supported');
    default:
      throw new Error(`Unknown content_format: ${contentFormat}`);
  }
}

// ---------------------------------------------------------------------------
// Node functions (stubs — actual implementations in worker agents)
// ---------------------------------------------------------------------------

async function pollTasks(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: actual implementation polls DB for planned content
  return { production: { ...state.production, status: 'idle' as ProductionStatus, sections: {} } };
}

async function sleep(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: sleep for PRODUCTION_POLL_INTERVAL_SEC (default: 30s)
  return {};
}

async function fetchData(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: fetch character info and component data, set status='producing'
  return { production: { ...state.production, status: 'fetching' as ProductionStatus, sections: {} } };
}

async function dispatch(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Updates status to dispatching; actual routing done by conditional edge
  return { production: { ...state.production, status: 'dispatching' as ProductionStatus, sections: {} } };
}

async function generateVideo(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: actual implementation in video-worker-agent
  // Uses recipe_id from current_task to load production_recipes.steps
  return { production: { ...state.production, status: 'generating' as ProductionStatus, sections: {} } };
}

async function generateText(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: actual implementation in text-post-agent
  return { production: { ...state.production, status: 'generating' as ProductionStatus, sections: {} } };
}

async function qualityCheck(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: quality check logic
  return { production: { ...state.production, status: 'quality_check' as ProductionStatus, sections: state.production.sections } };
}

async function handleError(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: error handling
  return { production: { ...state.production, status: 'error' as ProductionStatus, sections: {} } };
}

async function revisionPlanning(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  // Stub: revision planning after rejection
  return {};
}

// ---------------------------------------------------------------------------
// Conditional edge functions
// ---------------------------------------------------------------------------

function pollTasksEdge(
  state: typeof ProductionPipelineAnnotation.State,
): 'sleep' | 'fetch_data' {
  return state.current_task ? 'fetch_data' : 'sleep';
}

function dispatchEdge(
  state: typeof ProductionPipelineAnnotation.State,
): DispatchEdgeResult {
  if (!state.current_task) {
    throw new Error('No current task in dispatch node');
  }
  return dispatchByContentFormat(state.current_task.content_format);
}

function postProductionEdge(
  state: typeof ProductionPipelineAnnotation.State,
): 'poll_tasks' | 'handle_error' | 'revision_planning' {
  if (state.production.status === 'error') return 'handle_error';
  if (state.review.status === 'rejected') return 'revision_planning';
  return 'poll_tasks';
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export function buildProductionPipelineGraph() {
  const graph = new StateGraph(ProductionPipelineAnnotation)
    .addNode('poll_tasks', pollTasks)
    .addNode('sleep', sleep)
    .addNode('fetch_data', fetchData)
    .addNode('dispatch', dispatch)
    .addNode('generate_video', generateVideo)
    .addNode('generate_text', generateText)
    .addNode('quality_check', qualityCheck)
    .addNode('handle_error', handleError)
    .addNode('revision_planning', revisionPlanning)

    // Edges
    .addEdge(START, 'poll_tasks')
    .addConditionalEdges('poll_tasks', pollTasksEdge, {
      sleep: 'sleep',
      fetch_data: 'fetch_data',
    })
    .addEdge('sleep', 'poll_tasks')
    .addEdge('fetch_data', 'dispatch')
    .addConditionalEdges('dispatch', dispatchEdge, {
      generate_video: 'generate_video',
      generate_text: 'generate_text',
    })
    .addEdge('generate_video', 'quality_check')
    .addEdge('generate_text', 'quality_check')
    .addConditionalEdges('quality_check', postProductionEdge, {
      poll_tasks: 'poll_tasks',
      handle_error: 'handle_error',
      revision_planning: 'revision_planning',
    })
    .addEdge('handle_error', 'poll_tasks')
    .addEdge('revision_planning', 'poll_tasks');

  return graph;
}

/**
 * Create the compiled production pipeline graph with checkpointing.
 */
export function createProductionPipelineGraph() {
  const graph = buildProductionPipelineGraph();
  const checkpointer = new MemorySaver();
  return graph.compile({ checkpointer });
}
