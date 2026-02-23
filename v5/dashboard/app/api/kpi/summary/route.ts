import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

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
  const predictionResult = await queryOne<{ accuracy: string | null }>(
    `SELECT AVG(prediction_accuracy)::text as accuracy
     FROM algorithm_performance
     WHERE calculated_at >= NOW() - $1::interval`,
    [interval]
  );

  // Engagement (from metrics if available)
  const engagementResult = await queryOne<{
    avg_rate: string;
  }>(
    `SELECT COALESCE(AVG((metric_value->>'engagement_rate')::numeric), 0)::text as avg_rate
     FROM metrics
     WHERE metric_name = 'engagement_rate'
       AND recorded_at >= NOW() - $1::interval`,
    [interval]
  );

  return NextResponse.json({
    accounts,
    followers: {
      current: parseInt(followerResult?.current ?? "0", 10),
      target: 0, // Set from system_settings
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
      revenue_estimate: 0,
    },
    prediction_accuracy: predictionResult?.accuracy
      ? parseFloat(predictionResult.accuracy)
      : null,
  });
}
