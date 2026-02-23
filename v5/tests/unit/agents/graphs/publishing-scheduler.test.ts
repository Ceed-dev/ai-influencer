/**
 * Tests for FEAT-INT-003: Publishing Scheduler Graph
 */
import {
  buildPublishingSchedulerGraph,
  checkScheduleEdge,
  publishEdge,
  PublishingSchedulerAnnotation,
} from '@/src/agents/graphs/publishing-scheduler';
import type { PublishEdgeResult, Platform } from '@/types/langgraph-state';

describe('INT-003: Publishing Scheduler Graph', () => {
  test('graph builds without error', () => {
    const graph = buildPublishingSchedulerGraph();
    expect(graph).toBeDefined();
  });

  test('graph compiles successfully', () => {
    const graph = buildPublishingSchedulerGraph();
    const compiled = graph.compile();
    expect(compiled).toBeDefined();
  });

  test('graph has all required nodes', () => {
    const graph = buildPublishingSchedulerGraph();
    const compiled = graph.compile();
    const mermaid = compiled.getGraph().drawMermaid();

    expect(mermaid).toContain('check_schedule');
    expect(mermaid).toContain('sleep');
    expect(mermaid).toContain('publish');
    expect(mermaid).toContain('record');
    expect(mermaid).toContain('handle_error');
  });

  test('checkScheduleEdge returns sleep when no task', () => {
    const state = {
      current_task: null,
      publish_result: null,
      rate_limits: {} as Record<Platform, { remaining: number; reset_at: string }>,
    };
    expect(checkScheduleEdge(state)).toBe('sleep');
  });

  test('checkScheduleEdge returns publish when task exists', () => {
    const state = {
      current_task: {
        task_id: 1,
        content_id: 'CNT_001',
        account_id: 'ACC_001',
        platform: 'youtube' as Platform,
        video_drive_id: 'drv_001',
        metadata: {},
      },
      publish_result: null,
      rate_limits: {} as Record<Platform, { remaining: number; reset_at: string }>,
    };
    expect(checkScheduleEdge(state)).toBe('publish');
  });

  test('publishEdge returns record on success', () => {
    const state = {
      current_task: null,
      publish_result: { status: 'success' as const },
      rate_limits: {} as Record<Platform, { remaining: number; reset_at: string }>,
    };
    expect(publishEdge(state)).toBe('record');
  });

  test('publishEdge returns handle_error on failure', () => {
    const state = {
      current_task: null,
      publish_result: { status: 'failed' as const, error: 'API error' },
      rate_limits: {} as Record<Platform, { remaining: number; reset_at: string }>,
    };
    expect(publishEdge(state)).toBe('handle_error');
  });
});
