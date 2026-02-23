/**
 * FEAT-INT-004: Measurement Job Graph
 * Spec: 04-agent-design.md §5.4, 02-architecture.md §3.4
 *
 * Nodes: detect_targets → (collect if targets | sleep if none)
 *        collect → save_metrics → detect_targets
 *        sleep → detect_targets
 *
 * Continuous polling at MEASUREMENT_POLL_INTERVAL_SEC (default: 300s).
 * Collects metrics for content posted >= 48h ago.
 * All config from DB system_settings — no hardcoding.
 */
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type {
  MeasurementJobState,
  MeasurementJobNode,
  MeasurementTarget,
  CollectedMetrics,
  DetectTargetsEdgeResult,
} from '@/types/langgraph-state';

// ---------------------------------------------------------------------------
// State annotation
// ---------------------------------------------------------------------------

export const MeasurementJobAnnotation = Annotation.Root({
  targets: Annotation<MeasurementTarget[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  current_target: Annotation<MeasurementTarget | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  collected_metrics: Annotation<CollectedMetrics | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  processed_count: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
  error_count: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
});

// ---------------------------------------------------------------------------
// Node functions (stubs)
// ---------------------------------------------------------------------------

async function detectTargets(
  state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  // Stub: find publications where measure_after <= NOW()
  return { targets: [], current_target: null, collected_metrics: null };
}

async function sleep(
  _state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  // Stub: wait for MEASUREMENT_POLL_INTERVAL_SEC (default: 300s)
  return {};
}

async function collect(
  state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  // Stub: collect metrics from platform APIs for current_target
  return { collected_metrics: null };
}

async function saveMetrics(
  state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  // Stub: INSERT collected metrics into metrics table, update publication status
  return {
    processed_count: state.processed_count + 1,
    current_target: null,
    collected_metrics: null,
  };
}

// ---------------------------------------------------------------------------
// Conditional edge functions
// ---------------------------------------------------------------------------

export function detectTargetsEdge(
  state: typeof MeasurementJobAnnotation.State,
): DetectTargetsEdgeResult {
  return state.targets.length > 0 ? 'collect' : 'sleep';
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export interface MeasurementJobGraphOptions {
  detectTargets?: typeof detectTargets;
  sleep?: typeof sleep;
  collect?: typeof collect;
  saveMetrics?: typeof saveMetrics;
}

export function buildMeasurementJobGraph(
  options: MeasurementJobGraphOptions = {},
) {
  const graph = new StateGraph(MeasurementJobAnnotation)
    .addNode('detect_targets', options.detectTargets ?? detectTargets)
    .addNode('sleep', options.sleep ?? sleep)
    .addNode('collect', options.collect ?? collect)
    .addNode('save_metrics', options.saveMetrics ?? saveMetrics)

    // Edges
    .addEdge(START, 'detect_targets')
    .addConditionalEdges('detect_targets', detectTargetsEdge, {
      collect: 'collect',
      sleep: 'sleep',
    })
    .addEdge('sleep', 'detect_targets')
    .addEdge('collect', 'save_metrics')
    .addEdge('save_metrics', 'detect_targets');

  return graph;
}

/**
 * Create the compiled measurement job graph with checkpointing.
 */
export function createMeasurementJobGraph(
  options: MeasurementJobGraphOptions = {},
) {
  const graph = buildMeasurementJobGraph(options);
  const checkpointer = new MemorySaver();
  return graph.compile({ checkpointer });
}
