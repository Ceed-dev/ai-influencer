/**
 * MCI-043: run_baseline_update
 * Tests: baseline update batch wrapper
 */
import { runBaselineUpdateTool } from '../../../src/mcp-server/tools/intelligence/run-baseline-update';

describe('MCI-043: run_baseline_update', () => {
  test('returns correct structure with no account_id', async () => {
    const result = await runBaselineUpdateTool({});
    expect(result).toHaveProperty('updated_count');
    expect(result).toHaveProperty('source_breakdown');
    expect(typeof result.updated_count).toBe('number');
    expect(result.source_breakdown).toHaveProperty('own_history');
    expect(result.source_breakdown).toHaveProperty('cohort');
    expect(result.source_breakdown).toHaveProperty('default');
    expect(typeof result.source_breakdown.own_history).toBe('number');
    expect(typeof result.source_breakdown.cohort).toBe('number');
    expect(typeof result.source_breakdown['default']).toBe('number');
  });

  test('accepts optional account_id', async () => {
    const result = await runBaselineUpdateTool({ account_id: 'ACC_001' });
    expect(result).toHaveProperty('updated_count');
    expect(result).toHaveProperty('source_breakdown');
  });
});
