/**
 * Tests for FEAT-STR-009: Model allocation
 */
import {
  getModelForNode,
  getModelAllocation,
  estimateCycleCost,
  DEFAULT_NODE_MODELS,
} from '@/src/agents/strategy/model-allocation';

describe('STR-009: Model allocation', () => {
  test('set_strategy uses Opus', () => {
    expect(getModelForNode('set_strategy')).toBe('opus');
  });

  test('approve_plan uses Opus', () => {
    expect(getModelForNode('approve_plan')).toBe('opus');
  });

  test('collect_intel uses Sonnet', () => {
    expect(getModelForNode('collect_intel')).toBe('sonnet');
  });

  test('plan_content uses Sonnet', () => {
    expect(getModelForNode('plan_content')).toBe('sonnet');
  });

  test('unknown node defaults to Sonnet', () => {
    expect(getModelForNode('unknown_node')).toBe('sonnet');
  });

  test('overrides take precedence', () => {
    expect(getModelForNode('collect_intel', { collect_intel: 'opus' })).toBe('opus');
  });

  test('getModelAllocation returns configs for all nodes', () => {
    const allocation = getModelAllocation();
    expect(allocation.length).toBe(Object.keys(DEFAULT_NODE_MODELS).length);
    expect(allocation.every((c) => c.model === 'opus' || c.model === 'sonnet')).toBe(true);
  });

  test('estimateCycleCost returns positive cost', () => {
    const estimates = {
      set_strategy: { input: 5000, output: 2000 },
      collect_intel: { input: 3000, output: 1000 },
    };
    const result = estimateCycleCost(estimates);
    expect(result.totalCostUsd).toBeGreaterThan(0);
    expect(result.breakdown.length).toBe(2);
  });

  test('Opus nodes cost more than Sonnet nodes for same tokens', () => {
    const estimates = { node_a: { input: 1000, output: 1000 } };
    const opusCost = estimateCycleCost(estimates, { node_a: 'opus' });
    const sonnetCost = estimateCycleCost(estimates, { node_a: 'sonnet' });
    expect(opusCost.totalCostUsd).toBeGreaterThan(sonnetCost.totalCostUsd);
  });
});
