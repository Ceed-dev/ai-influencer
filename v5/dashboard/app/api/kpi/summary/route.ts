import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getSettingValue(key: string): Promise<unknown> {
  const row = await queryOne<{ setting_value: unknown }>(
    `SELECT setting_value FROM system_settings WHERE setting_key = $1`,
    [key]
  );
  return row?.setting_value ?? null;
}

/**
 * GET /api/kpi/summary
 * KPI dashboard data — targets vs actuals, by period.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "30d";

  const validPeriods = ["7d", "30d", "90d"];
  if (!validPeriods.includes(period)) {
    return NextResponse.json(
      { error: `Invalid period. Must be one of: ${validPeriods.join(", ")}` },
      { status: 400 }
    );
  }

  const intervalMap: Record<string, string> = {
    "7d": "7 days",
    "30d": "30 days",
    "90d": "90 days",
  };
  const interval = intervalMap[period]!;

  // Total accounts
  const accountsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM accounts WHERE status = 'active'`
  );
  const accounts = parseInt(accountsResult?.count ?? "0", 10);

  // Follower data
  const followerResult = await queryOne<{
    current: string;
    growth_rate: string;
  }>(
    `SELECT
       COALESCE(SUM(follower_count), 0)::text as current,
       0::text as growth_rate
     FROM accounts WHERE status = 'active'`
  );

  // Content stats
  const contentResult = await queryOne<{
    total_produced: string;
    total_posted: string;
    total_measured: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= NOW() - $1::interval)::text as total_produced,
       COUNT(*) FILTER (WHERE status = 'posted' AND created_at >= NOW() - $1::interval)::text as total_posted,
       COUNT(*) FILTER (WHERE status = 'measured' AND created_at >= NOW() - $1::interval)::text as total_measured
     FROM content`,
    [interval]
  );

  // Monetization
  const monetizationResult = await queryOne<{
    monetized_count: string;
  }>(
    `SELECT COUNT(*) FILTER (WHERE monetization_status = 'active')::text as monetized_count
     FROM accounts`
  );

  // Prediction accuracy (from algorithm_performance if available)
  // The table stores prediction_error; accuracy ≈ 1 - error
  const predictionResult = await queryOne<{ accuracy: string | null }>(
    `SELECT (1 - COALESCE(AVG(prediction_error), 0))::text as accuracy
     FROM algorithm_performance
     WHERE measured_at >= NOW() - $1::interval`,
    [interval]
  );

  // Engagement (from metrics table — engagement_rate is a direct column)
  const engagementResult = await queryOne<{
    avg_rate: string;
  }>(
    `SELECT COALESCE(AVG(engagement_rate), 0)::text as avg_rate
     FROM metrics
     WHERE measured_at >= NOW() - $1::interval
       AND engagement_rate IS NOT NULL`,
    [interval]
  );

  // Read targets from system_settings (no hardcoding)
  let followerTarget = 0;
  let revenuePerEngagement = 0;
  try {
    const ft = await getSettingValue('KPI_FOLLOWER_TARGET');
    if (ft != null) followerTarget = Number(ft);
    const rpe = await getSettingValue('KPI_REVENUE_PER_ENGAGEMENT');
    if (rpe != null) revenuePerEngagement = Number(rpe);
  } catch { /* settings may not exist yet */ }

  const totalEngagement = parseInt(contentResult?.total_posted ?? "0", 10);
  const revenueEstimate = totalEngagement * revenuePerEngagement;

  return NextResponse.json({
    accounts,
    followers: {
      current: parseInt(followerResult?.current ?? "0", 10),
      target: followerTarget,
      growth_rate: parseFloat(followerResult?.growth_rate ?? "0"),
    },
    engagement: {
      avg_rate: parseFloat(engagementResult?.avg_rate ?? "0"),
      trend: "stable" as const,
    },
    content: {
      total_produced: parseInt(contentResult?.total_produced ?? "0", 10),
      total_posted: parseInt(contentResult?.total_posted ?? "0", 10),
      total_measured: parseInt(contentResult?.total_measured ?? "0", 10),
    },
    monetization: {
      monetized_count: parseInt(monetizationResult?.monetized_count ?? "0", 10),
      revenue_estimate: revenueEstimate,
    },
    prediction_accuracy: predictionResult?.accuracy
      ? parseFloat(predictionResult.accuracy)
      : null,
  });
}
