/**
 * FEAT-INT-012: Exploration rate for hypothesis diversity
 * Spec: 04-agent-design.md §4.1, 02-architecture.md §7
 *
 * EXPLORATION_RATE (default: 0.2 = 20%) controls the fraction of
 * hypotheses that should explore new, untested categories/approaches
 * vs exploiting known successful patterns.
 * All config from DB system_settings — no hardcoding.
 */

/** Exploration decision */
export interface ExplorationDecision {
  shouldExplore: boolean;
  explorationRate: number;
  randomValue: number;
}

/** Category distribution for diversity check */
export interface CategoryDistribution {
  category: string;
  count: number;
  proportion: number;
}

/** Diversity check result */
export interface DiversityResult {
  isBalanced: boolean;
  distributions: CategoryDistribution[];
  maxConcentration: number;
  concentrationThreshold: number;
}

/**
 * Decide whether to explore or exploit based on EXPLORATION_RATE.
 * Uses random sampling to determine if the next hypothesis should be exploratory.
 *
 * @param explorationRate - Fraction of hypotheses that should explore (0.0-1.0)
 * @param randomFn - Random number generator (default: Math.random, injectable for testing)
 */
export function shouldExplore(
  explorationRate: number,
  randomFn: () => number = Math.random,
): ExplorationDecision {
  const randomValue = randomFn();
  return {
    shouldExplore: randomValue < explorationRate,
    explorationRate,
    randomValue,
  };
}

/**
 * Check hypothesis diversity by analyzing category concentration.
 * A balanced portfolio should not have any single category > concentrationThreshold.
 *
 * @param categories - Array of hypothesis categories
 * @param concentrationThreshold - Max allowed proportion for any single category (default: 0.4 = 40%)
 */
export function checkHypothesisDiversity(
  categories: string[],
  concentrationThreshold: number = 0.4,
): DiversityResult {
  if (categories.length === 0) {
    return {
      isBalanced: true,
      distributions: [],
      maxConcentration: 0,
      concentrationThreshold,
    };
  }

  const counts: Record<string, number> = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  const total = categories.length;
  const distributions: CategoryDistribution[] = Object.entries(counts).map(
    ([category, count]) => ({
      category,
      count,
      proportion: count / total,
    }),
  );

  distributions.sort((a, b) => b.proportion - a.proportion);
  const maxConcentration = distributions[0]?.proportion ?? 0;

  return {
    isBalanced: maxConcentration <= concentrationThreshold,
    distributions,
    maxConcentration,
    concentrationThreshold,
  };
}

/**
 * Select a hypothesis category favoring underrepresented categories.
 *
 * @param existingCategories - Currently selected hypothesis categories
 * @param allCategories - All available categories to choose from
 * @param explorationRate - Exploration rate from system_settings
 */
export function selectNextCategory(
  existingCategories: string[],
  allCategories: string[],
  explorationRate: number,
  randomFn: () => number = Math.random,
): string {
  if (allCategories.length === 0) {
    throw new Error('No categories available');
  }

  const decision = shouldExplore(explorationRate, randomFn);

  if (decision.shouldExplore || existingCategories.length === 0) {
    // Exploration: pick from underrepresented categories
    const counts: Record<string, number> = {};
    for (const cat of allCategories) {
      counts[cat] = 0;
    }
    for (const cat of existingCategories) {
      if (counts[cat] !== undefined) {
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }

    // Find minimum count
    const minCount = Math.min(...Object.values(counts));
    const underrepresented = Object.entries(counts)
      .filter(([_, count]) => count === minCount)
      .map(([cat]) => cat);

    const idx = Math.floor(randomFn() * underrepresented.length);
    return underrepresented[idx] ?? allCategories[0]!;
  }

  // Exploitation: pick a random category from existing successful ones
  if (existingCategories.length > 0) {
    const idx = Math.floor(randomFn() * existingCategories.length);
    return existingCategories[idx]!;
  }

  return allCategories[0]!;
}
