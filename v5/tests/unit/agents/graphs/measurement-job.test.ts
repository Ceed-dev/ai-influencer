/**
 * Tests for FEAT-INT-004: Measurement Job Graph
 */
import {
  buildMeasurementJobGraph,
  detectTargetsEdge,
  MeasurementJobAnnotation,
} from '@/src/agents/graphs/measurement-job';
import type { MeasurementTarget, CollectedMetrics, MeasurementType, Platform } from '@/types/langgraph-state';

describe('INT-004: Measurement Job Graph', () => {
  test('graph builds without error', () => {
    const graph = buildMeasurementJobGraph();
    expect(graph).toBeDefined();
  });

  test('graph compiles successfully', () => {
    const graph = buildMeasurementJobGraph();
    const compiled = graph.compile();
    expect(compiled).toBeDefined();
  });

  test('graph has all required nodes', () => {
    const graph = buildMeasurementJobGraph();
    const compiled = graph.compile();
    const mermaid = compiled.getGraph().drawMermaid();

    expect(mermaid).toContain('detect_targets');
    expect(mermaid).toContain('sleep');
    expect(mermaid).toContain('collect');
    expect(mermaid).toContain('save_metrics');
  });

  test('detectTargetsEdge returns sleep when no targets', () => {
    const state = {
      targets: [],
      current_target: null,
      collected_metrics: null,
      processed_count: 0,
      error_count: 0,
    };
    expect(detectTargetsEdge(state)).toBe('sleep');
  });

  test('detectTargetsEdge returns collect when targets exist', () => {
    const target: MeasurementTarget = {
      task_id: 1,
      publication_id: 100,
      content_id: 'CNT_001',
      account_id: 'ACC_001',
      platform: 'youtube',
      platform_post_id: 'yt_123',
      posted_at: '2026-01-01T00:00:00Z',
      measurement_type: '48h',
    };
    const state = {
      targets: [target],
      current_target: null,
      collected_metrics: null,
      processed_count: 0,
      error_count: 0,
    };
    expect(detectTargetsEdge(state)).toBe('collect');
  });
});
