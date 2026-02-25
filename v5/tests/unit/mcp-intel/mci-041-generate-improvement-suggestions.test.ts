/**
 * MCI-041: generate_improvement_suggestions
 * Tests: improvement suggestion generation based on performance data
 */
import { generateImprovementSuggestions } from '../../../src/mcp-server/tools/intelligence/generate-improvement-suggestions';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-041: generate_improvement_suggestions', () => {
  test('rejects empty niche', async () => {
    await expect(
      generateImprovementSuggestions({ niche: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns suggestions array with required fields', async () => {
    const result = await generateImprovementSuggestions({ niche: 'beauty' });
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);

    for (const s of result.suggestions) {
      expect(s).toHaveProperty('suggestion');
      expect(s).toHaveProperty('rationale');
      expect(s).toHaveProperty('expected_impact');
      expect(s).toHaveProperty('priority');
      expect(typeof s.suggestion).toBe('string');
      expect(typeof s.rationale).toBe('string');
      expect(['high', 'medium', 'low']).toContain(s.priority);
    }
  });

  test('accepts optional account_id', async () => {
    const result = await generateImprovementSuggestions({ niche: 'tech', account_id: 'ACC_001' });
    expect(result).toHaveProperty('suggestions');
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  test('returns default suggestion when no data exists', async () => {
    const result = await generateImprovementSuggestions({ niche: 'nonexistent_niche_xyz' });
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    // Should have at least the default "collect more data" suggestion
    const hasDefault = result.suggestions.some(
      (s) => s.suggestion.includes('collect more data') || s.suggestion.includes('Continue'),
    );
    expect(hasDefault).toBe(true);
  });
});
