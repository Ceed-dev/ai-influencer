/**
 * FEAT-INT-010: Weighted quality score calculation
 * Spec: 04-agent-design.md §4.6 (#11), 02-architecture.md §5
 *
 * Calculates a composite quality score for content
 * using configurable weights per dimension.
 * Score range: 0.0 - 10.0
 * All config from DB system_settings — no hardcoding.
 */

/** Quality dimension with weight */
export interface QualityDimension {
  name: string;
  score: number; // 0.0-10.0
  weight: number; // 0.0-1.0
}

/** Result of quality scoring */
export interface QualityScoreResult {
  overallScore: number;
  dimensions: QualityDimension[];
  passed: boolean;
  threshold: number;
}

/** Default quality dimensions and weights */
export const DEFAULT_QUALITY_WEIGHTS: Record<string, number> = {
  visual_quality: 0.25,
  audio_quality: 0.20,
  script_coherence: 0.20,
  engagement_potential: 0.15,
  brand_consistency: 0.10,
  technical_compliance: 0.10,
};

/**
 * Calculate weighted quality score from dimensions.
 * Weights are normalized to sum to 1.0.
 *
 * @param dimensions - Array of quality dimensions with scores and weights
 * @returns Overall weighted score (0.0-10.0)
 */
export function calculateWeightedScore(dimensions: QualityDimension[]): number {
  if (dimensions.length === 0) return 0;

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = dimensions.reduce(
    (sum, d) => sum + d.score * (d.weight / totalWeight),
    0,
  );

  return Math.round(weightedSum * 10) / 10; // Round to 1 decimal
}

/**
 * Score content quality using weighted dimensions.
 *
 * @param dimensionScores - Map of dimension name to score (0.0-10.0)
 * @param weights - Map of dimension name to weight (0.0-1.0)
 * @param threshold - Minimum score for passing (default: 8.0)
 */
export function scoreQuality(
  dimensionScores: Record<string, number>,
  weights: Record<string, number> = DEFAULT_QUALITY_WEIGHTS,
  threshold: number = 8.0,
): QualityScoreResult {
  const dimensions: QualityDimension[] = [];

  for (const [name, weight] of Object.entries(weights)) {
    const score = dimensionScores[name] ?? 0;
    dimensions.push({ name, score, weight });
  }

  const overallScore = calculateWeightedScore(dimensions);

  return {
    overallScore,
    dimensions,
    passed: overallScore >= threshold,
    threshold,
  };
}
