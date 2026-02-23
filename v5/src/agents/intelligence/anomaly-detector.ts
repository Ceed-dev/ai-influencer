/**
 * FEAT-INT-011: Statistical anomaly detection
 * Spec: 04-agent-design.md §4.3 (#8), 02-architecture.md §7
 *
 * Uses ANOMALY_DETECTION_SIGMA (default: 2.0) for z-score based detection.
 * Flags metrics that deviate > sigma standard deviations from the mean.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';

/** Detected anomaly */
export interface DetectedAnomaly {
  accountId: string;
  metricName: string;
  expectedValue: number;
  actualValue: number;
  sigmaDeviation: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

/** Result of anomaly detection */
export interface AnomalyDetectionResult {
  anomalies: DetectedAnomaly[];
  sigma: number;
  metricsAnalyzed: number;
}

/**
 * Calculate z-score for a value relative to a distribution.
 */
export function calculateZScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return value === mean ? 0 : Infinity;
  return (value - mean) / stddev;
}

/**
 * Determine anomaly severity from sigma deviation.
 */
export function classifySeverity(
  sigmaDeviation: number,
  sigma: number,
): 'low' | 'medium' | 'high' {
  const absDev = Math.abs(sigmaDeviation);
  if (absDev >= sigma * 2) return 'high';
  if (absDev >= sigma * 1.5) return 'medium';
  return 'low';
}

/**
 * Detect anomalies in a set of metric values.
 * A value is anomalous if its z-score exceeds the sigma threshold.
 *
 * @param values - Array of { id, value } pairs
 * @param sigma - Z-score threshold (default from ANOMALY_DETECTION_SIGMA)
 */
export function detectAnomaliesInValues(
  values: Array<{ id: string; value: number }>,
  sigma: number,
): Array<{ id: string; value: number; zScore: number; isAnomaly: boolean }> {
  if (values.length < 3) return []; // Need minimum sample size

  const nums = values.map((v) => v.value);
  const mean = nums.reduce((s, n) => s + n, 0) / nums.length;
  const variance = nums.reduce((s, n) => s + (n - mean) ** 2, 0) / nums.length;
  const stddev = Math.sqrt(variance);

  return values.map((v) => {
    const zScore = calculateZScore(v.value, mean, stddev);
    return {
      id: v.id,
      value: v.value,
      zScore,
      isAnomaly: Math.abs(zScore) > sigma,
    };
  });
}

/**
 * Run anomaly detection on recent metrics per account.
 * Checks views, engagement_rate for deviations from account historical averages.
 *
 * @param client - Database client
 * @param sigma - Z-score threshold
 * @param periodDays - Look-back period in days
 */
export async function detectMetricAnomalies(
  client: PoolClient,
  sigma: number = 2.0,
  periodDays: number = 7,
): Promise<AnomalyDetectionResult> {
  const anomalies: DetectedAnomaly[] = [];

  // Get per-account metric stats for the period
  const sql = `
    WITH recent_metrics AS (
      SELECT
        pub.account_id,
        m.views,
        m.engagement_rate
      FROM metrics m
      JOIN publications pub ON m.publication_id = pub.id
      WHERE m.measured_at >= NOW() - make_interval(days => $1)
        AND m.measurement_point = '48h'
    ),
    account_stats AS (
      SELECT
        account_id,
        AVG(views) AS mean_views,
        STDDEV_POP(views) AS stddev_views,
        AVG(engagement_rate) AS mean_engagement,
        STDDEV_POP(engagement_rate) AS stddev_engagement,
        COUNT(*) AS sample_count
      FROM recent_metrics
      GROUP BY account_id
      HAVING COUNT(*) >= 3
    )
    SELECT
      rm.account_id,
      rm.views,
      rm.engagement_rate,
      ast.mean_views,
      ast.stddev_views,
      ast.mean_engagement,
      ast.stddev_engagement
    FROM recent_metrics rm
    JOIN account_stats ast ON rm.account_id = ast.account_id
  `;

  const res = await client.query(sql, [periodDays]);
  let metricsAnalyzed = 0;

  for (const row of res.rows) {
    const r = row as Record<string, unknown>;
    metricsAnalyzed++;

    const accountId = r['account_id'] as string;
    const views = Number(r['views'] ?? 0);
    const engagementRate = Number(r['engagement_rate'] ?? 0);
    const meanViews = Number(r['mean_views'] ?? 0);
    const stddevViews = Number(r['stddev_views'] ?? 0);
    const meanEngagement = Number(r['mean_engagement'] ?? 0);
    const stddevEngagement = Number(r['stddev_engagement'] ?? 0);

    // Check views anomaly
    if (stddevViews > 0) {
      const viewsZScore = calculateZScore(views, meanViews, stddevViews);
      if (Math.abs(viewsZScore) > sigma) {
        anomalies.push({
          accountId,
          metricName: 'views',
          expectedValue: meanViews,
          actualValue: views,
          sigmaDeviation: viewsZScore,
          severity: classifySeverity(viewsZScore, sigma),
          description: `Views ${viewsZScore > 0 ? 'spike' : 'drop'}: ${views} vs expected ${Math.round(meanViews)} (${viewsZScore.toFixed(1)}σ)`,
        });
      }
    }

    // Check engagement_rate anomaly
    if (stddevEngagement > 0) {
      const engZScore = calculateZScore(engagementRate, meanEngagement, stddevEngagement);
      if (Math.abs(engZScore) > sigma) {
        anomalies.push({
          accountId,
          metricName: 'engagement_rate',
          expectedValue: meanEngagement,
          actualValue: engagementRate,
          sigmaDeviation: engZScore,
          severity: classifySeverity(engZScore, sigma),
          description: `Engagement ${engZScore > 0 ? 'spike' : 'drop'}: ${engagementRate.toFixed(4)} vs expected ${meanEngagement.toFixed(4)} (${engZScore.toFixed(1)}σ)`,
        });
      }
    }
  }

  return { anomalies, sigma, metricsAnalyzed };
}
