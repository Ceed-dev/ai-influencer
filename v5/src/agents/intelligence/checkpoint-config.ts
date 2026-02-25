/**
 * FEAT-INT-015: Checkpoint position configuration for production pipeline
 * Spec: 04-agent-design.md §5.2, 02-architecture.md §9
 *
 * Defines which nodes in the production pipeline trigger checkpoints.
 * Checkpoints allow resuming from the last completed step after failures.
 * All config from DB system_settings — no hardcoding.
 */
import type {
  ProductionPipelineNode,
  ProductionPipelineCheckpoint,
  PublishingSchedulerNode,
  PublishingSchedulerCheckpoint,
  MeasurementJobNode,
  MeasurementJobCheckpoint,
} from '@/types/langgraph-state';

/** Which nodes should trigger checkpoint saves */
export const PRODUCTION_CHECKPOINT_NODES: readonly ProductionPipelineNode[] = [
  'fetch_data',
  'generate_video',
  'generate_text',
  'quality_check',
] as const;

/** Publishing scheduler checkpoint nodes */
export const PUBLISHING_CHECKPOINT_NODES: readonly PublishingSchedulerNode[] = [
  'publish',
  'record',
] as const;

/** Measurement job checkpoint nodes */
export const MEASUREMENT_CHECKPOINT_NODES: readonly MeasurementJobNode[] = [
  'collect',
  'save_metrics',
] as const;

/**
 * Check if a node should trigger a checkpoint save.
 */
export function shouldCheckpoint(
  node: string,
  checkpointNodes: readonly string[],
): boolean {
  return checkpointNodes.includes(node);
}

/**
 * Create a production pipeline checkpoint entry.
 */
export function createProductionCheckpoint(
  threadId: string,
  contentId: string,
  lastCompletedNode: ProductionPipelineNode,
  completedSections: string[],
): ProductionPipelineCheckpoint {
  return {
    thread_id: threadId,
    content_id: contentId,
    last_completed_node: lastCompletedNode,
    completed_at: new Date().toISOString(),
    completed_sections: completedSections,
  };
}

/**
 * Create a publishing scheduler checkpoint entry.
 */
export function createPublishingCheckpoint(
  threadId: string,
  contentId: string,
  lastCompletedNode: PublishingSchedulerNode,
  platform: 'youtube' | 'tiktok' | 'instagram' | 'x',
): PublishingSchedulerCheckpoint {
  return {
    thread_id: threadId,
    content_id: contentId,
    last_completed_node: lastCompletedNode,
    completed_at: new Date().toISOString(),
    platform,
  };
}

/**
 * Create a measurement job checkpoint entry.
 */
export function createMeasurementCheckpoint(
  threadId: string,
  lastCompletedNode: MeasurementJobNode,
  batchProcessed: number,
  batchErrors: number,
): MeasurementJobCheckpoint {
  return {
    thread_id: threadId,
    last_completed_node: lastCompletedNode,
    completed_at: new Date().toISOString(),
    batch_processed: batchProcessed,
    batch_errors: batchErrors,
  };
}
