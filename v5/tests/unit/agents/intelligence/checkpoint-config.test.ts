/**
 * Tests for FEAT-INT-015: Checkpoint config
 */
import {
  shouldCheckpoint,
  createProductionCheckpoint,
  createPublishingCheckpoint,
  createMeasurementCheckpoint,
  PRODUCTION_CHECKPOINT_NODES,
  PUBLISHING_CHECKPOINT_NODES,
  MEASUREMENT_CHECKPOINT_NODES,
} from '@/src/agents/intelligence/checkpoint-config';

describe('INT-015: Checkpoint config', () => {
  test('production checkpoint nodes include fetch_data', () => {
    expect(PRODUCTION_CHECKPOINT_NODES).toContain('fetch_data');
  });

  test('production checkpoint nodes include generate_video', () => {
    expect(PRODUCTION_CHECKPOINT_NODES).toContain('generate_video');
  });

  test('shouldCheckpoint returns true for checkpoint node', () => {
    expect(shouldCheckpoint('fetch_data', PRODUCTION_CHECKPOINT_NODES)).toBe(true);
  });

  test('shouldCheckpoint returns false for non-checkpoint node', () => {
    expect(shouldCheckpoint('poll_tasks', PRODUCTION_CHECKPOINT_NODES)).toBe(false);
  });

  test('createProductionCheckpoint returns valid checkpoint', () => {
    const checkpoint = createProductionCheckpoint(
      'thread-1', 'CNT_001', 'fetch_data', ['hook'],
    );
    expect(checkpoint.thread_id).toBe('thread-1');
    expect(checkpoint.content_id).toBe('CNT_001');
    expect(checkpoint.last_completed_node).toBe('fetch_data');
    expect(checkpoint.completed_sections).toEqual(['hook']);
    expect(checkpoint.completed_at).toBeTruthy();
  });

  test('createPublishingCheckpoint returns valid checkpoint', () => {
    const checkpoint = createPublishingCheckpoint(
      'thread-2', 'CNT_002', 'publish', 'youtube',
    );
    expect(checkpoint.platform).toBe('youtube');
  });

  test('createMeasurementCheckpoint returns valid checkpoint', () => {
    const checkpoint = createMeasurementCheckpoint(
      'thread-3', 'collect', 5, 1,
    );
    expect(checkpoint.batch_processed).toBe(5);
    expect(checkpoint.batch_errors).toBe(1);
  });

  test('publishing checkpoint nodes are defined', () => {
    expect(PUBLISHING_CHECKPOINT_NODES.length).toBeGreaterThan(0);
  });

  test('measurement checkpoint nodes are defined', () => {
    expect(MEASUREMENT_CHECKPOINT_NODES.length).toBeGreaterThan(0);
  });
});
