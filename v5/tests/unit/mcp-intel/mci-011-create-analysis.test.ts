/**
 * MCI-011: create_analysis
 * Tests: INSERT into analyses
 */
import { createAnalysis } from '../../../src/mcp-server/tools/intelligence/create-analysis';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-011: create_analysis', () => {
  test('rejects empty findings', async () => {
    await expect(
      createAnalysis({
        cycle_id: 1,
        analysis_type: 'cycle_review',
        findings: '',
        recommendations: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty recommendations', async () => {
    await expect(
      createAnalysis({
        cycle_id: 1,
        analysis_type: 'cycle_review',
        findings: 'test findings',
        recommendations: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
