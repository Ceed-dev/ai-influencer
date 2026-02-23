/**
 * MCI-007: verify_hypothesis
 * Tests: verdict validation, hypothesis not found
 */
import { verifyHypothesis } from '../../../src/mcp-server/tools/intelligence/verify-hypothesis';
import { McpValidationError, McpNotFoundError } from '../../../src/mcp-server/errors';

describe('MCI-007: verify_hypothesis', () => {
  test('rejects invalid verdict', async () => {
    await expect(
      verifyHypothesis({
        hypothesis_id: 1,
        verdict: 'invalid' as any,
        confidence: 0.8,
        evidence_summary: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects confidence out of range', async () => {
    await expect(
      verifyHypothesis({
        hypothesis_id: 1,
        verdict: 'confirmed',
        confidence: 1.5,
        evidence_summary: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty evidence_summary', async () => {
    await expect(
      verifyHypothesis({
        hypothesis_id: 1,
        verdict: 'confirmed',
        confidence: 0.8,
        evidence_summary: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws not found for non-existent hypothesis', async () => {
    await expect(
      verifyHypothesis({
        hypothesis_id: 999999,
        verdict: 'confirmed',
        confidence: 0.8,
        evidence_summary: 'test evidence',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
