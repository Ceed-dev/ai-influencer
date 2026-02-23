/**
 * Tests for FEAT-INT-012: Exploration rate
 */
import {
  shouldExplore,
  checkHypothesisDiversity,
  selectNextCategory,
} from '@/src/agents/intelligence/exploration-rate';

describe('INT-012: Exploration rate', () => {
  describe('shouldExplore', () => {
    test('explores when random < rate', () => {
      const result = shouldExplore(0.2, () => 0.1);
      expect(result.shouldExplore).toBe(true);
    });

    test('exploits when random >= rate', () => {
      const result = shouldExplore(0.2, () => 0.5);
      expect(result.shouldExplore).toBe(false);
    });

    test('always explores at rate 1.0', () => {
      const result = shouldExplore(1.0, () => 0.99);
      expect(result.shouldExplore).toBe(true);
    });

    test('never explores at rate 0.0', () => {
      const result = shouldExplore(0.0, () => 0.01);
      expect(result.shouldExplore).toBe(false);
    });
  });

  describe('checkHypothesisDiversity', () => {
    test('balanced with even distribution', () => {
      const result = checkHypothesisDiversity(
        ['timing', 'niche', 'audience', 'content_format'],
        0.4,
      );
      expect(result.isBalanced).toBe(true);
    });

    test('unbalanced with high concentration', () => {
      const result = checkHypothesisDiversity(
        ['timing', 'timing', 'timing', 'niche'],
        0.4,
      );
      expect(result.isBalanced).toBe(false);
      expect(result.maxConcentration).toBe(0.75);
    });

    test('empty categories are balanced', () => {
      const result = checkHypothesisDiversity([], 0.4);
      expect(result.isBalanced).toBe(true);
    });
  });

  describe('selectNextCategory', () => {
    test('selects underrepresented category on exploration', () => {
      const result = selectNextCategory(
        ['timing', 'timing', 'timing'],
        ['timing', 'niche', 'audience'],
        1.0, // always explore
        () => 0.0, // first underrepresented
      );
      // Should pick niche or audience (both have 0 count)
      expect(['niche', 'audience']).toContain(result);
    });

    test('throws for empty allCategories', () => {
      expect(() => selectNextCategory([], [], 0.5)).toThrow('No categories available');
    });
  });
});
