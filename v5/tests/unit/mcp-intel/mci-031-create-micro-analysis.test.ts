/**
 * MCI-031: create_micro_analysis
 * Tests: INSERT into content_learnings
 */
import { createMicroAnalysis } from '../../../src/mcp-server/tools/intelligence/create-micro-analysis';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM content_learnings WHERE content_id LIKE 'CNT_MCI031%'`);
  });
}

describe('MCI-031: create_micro_analysis', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('rejects empty content_id', async () => {
    await expect(
      createMicroAnalysis({
        content_id: '',
        predicted_kpis: { views: 1000 },
        actual_kpis: { views: 800 },
        micro_verdict: 'confirmed',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid micro_verdict', async () => {
    await expect(
      createMicroAnalysis({
        content_id: 'CNT_MCI031_001',
        predicted_kpis: { views: 1000 },
        actual_kpis: { views: 800 },
        micro_verdict: 'invalid' as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('creates micro analysis with prediction error calculation', async () => {
    const result = await createMicroAnalysis({
      content_id: 'CNT_MCI031_001',
      predicted_kpis: { views: 1000 },
      actual_kpis: { views: 800 },
      micro_verdict: 'confirmed',
    });
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('prediction_error');
    expect(result.prediction_error).toBeCloseTo(0.25, 2);
    expect(result.micro_verdict).toBe('confirmed');
  });
});
