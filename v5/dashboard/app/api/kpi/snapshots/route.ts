import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";

const VALID_PLATFORMS = ["youtube", "tiktok", "instagram", "x"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const KPI_TARGET_KEYS: Record<Platform, string> = {
  tiktok: "KPI_TARGET_TIKTOK",
  instagram: "KPI_TARGET_INSTAGRAM",
  youtube: "KPI_TARGET_YOUTUBE",
  x: "KPI_TARGET_TWITTER",
};

/**
 * GET /api/kpi/snapshots
 * List KPI snapshots with optional platform and year_month filters.
 * Spec: api-schemas.ts ListKpiSnapshotsRequest/ListKpiSnapshotsResponse
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const yearMonth = searchParams.get("year_month");

  if (
    platform &&
    !VALID_PLATFORMS.includes(platform as Platform)
  ) {
    return NextResponse.json(
      {
        error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (yearMonth && !YEAR_MONTH_RE.test(yearMonth)) {
    return NextResponse.json(
      { error: "Invalid year_month format. Must be YYYY-MM" },
      { status: 400 }
    );
  }

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (platform) {
    conditions.push(`platform = $${paramIdx++}`);
    params.push(platform);
  }
  if (yearMonth) {
    conditions.push(`year_month = $${paramIdx++}`);
    params.push(yearMonth);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const snapshots = await query(
    `SELECT id, platform, year_month, kpi_target, avg_impressions,
            achievement_rate, account_count, publication_count,
            prediction_accuracy, is_reliable, calculated_at
     FROM kpi_snapshots ${whereClause}
     ORDER BY year_month DESC, platform ASC`,
    params
  );

  return NextResponse.json({
    snapshots: snapshots.map((row: Record<string, unknown>) => ({
      id: row.id as number,
      platform: row.platform as string,
      year_month: row.year_month as string,
      kpi_target: Number(row.kpi_target),
      avg_impressions: Number(row.avg_impressions),
      achievement_rate: Number(row.achievement_rate),
      account_count: row.account_count as number,
      publication_count: row.publication_count as number,
      prediction_accuracy:
        row.prediction_accuracy !== null && row.prediction_accuracy !== undefined
          ? Number(row.prediction_accuracy)
          : null,
      is_reliable: row.is_reliable as boolean,
      calculated_at: row.calculated_at
        ? (row.calculated_at as Date).toISOString()
        : new Date().toISOString(),
    })),
  });
}

/**
 * POST /api/kpi/snapshots
 * Trigger KPI snapshot calculation for a specific platform and month.
 * Spec: api-schemas.ts CreateKpiSnapshotRequest/CreateKpiSnapshotResponse
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { platform, year_month } = body as {
    platform?: string;
    year_month?: string;
  };

  if (!platform || !VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json(
      {
        error: `platform is required and must be one of: ${VALID_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (!year_month || !YEAR_MONTH_RE.test(year_month)) {
    return NextResponse.json(
      { error: "year_month is required and must be YYYY-MM format" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Read KPI target from system_settings
    const settingRow = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1`,
      [KPI_TARGET_KEYS[platform as Platform]]
    );
    const kpiTarget = settingRow.rows[0]
      ? parseInt(settingRow.rows[0].setting_value, 10)
      : 10000;

    // Read KPI_CALC_MONTH_START_DAY from system_settings
    const startDayRow = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'KPI_CALC_MONTH_START_DAY'`
    );
    const startDay = startDayRow.rows[0]
      ? parseInt(startDayRow.rows[0].setting_value, 10)
      : 21;

    // Calculate date range
    const parts = year_month.split("-").map(Number);
    const year = parts[0] ?? 2026;
    const month = parts[1] ?? 1;
    const nextMonthStart = new Date(Date.UTC(year, month, 1));
    const eligibleStart = new Date(Date.UTC(year, month - 1, startDay));

    // Calculate KPI metrics
    const res = await client.query(
      `SELECT
        COUNT(DISTINCT p.id) AS publication_count,
        COUNT(DISTINCT p.account_id) AS account_count,
        AVG(m.views) AS avg_impressions,
        AVG(
          CASE
            WHEN ps.predicted_impressions = 0 AND ps.actual_impressions_7d = 0 THEN 0
            WHEN ps.actual_impressions_7d > 0 THEN
              ABS(ps.predicted_impressions - ps.actual_impressions_7d)::FLOAT / ps.actual_impressions_7d
            ELSE NULL
          END
        ) AS avg_error
      FROM publications p
      JOIN metrics m ON p.id = m.publication_id
      LEFT JOIN prediction_snapshots ps ON p.id = ps.publication_id
      WHERE p.platform = $1
        AND p.status = 'posted'
        AND p.posted_at >= $2
        AND p.posted_at < $3
        AND m.measurement_point = '7d'
        AND m.views IS NOT NULL
        AND ps.actual_impressions_7d IS NOT NULL`,
      [platform, eligibleStart.toISOString(), nextMonthStart.toISOString()]
    );

    const row = res.rows[0];
    const pubCount = parseInt(row.publication_count) || 0;
    const acctCount = parseInt(row.account_count) || 0;
    const avgImpressions = parseFloat(row.avg_impressions) || 0;
    const avgError =
      row.avg_error !== null ? parseFloat(row.avg_error) : null;

    const achievementRate = kpiTarget > 0
      ? Math.min(1.0, avgImpressions / kpiTarget)
      : 0;
    const predictionAccuracy = avgError !== null ? 1 - avgError : null;
    const isReliable = acctCount >= 5;

    // UPSERT into kpi_snapshots
    const upsertResult = await client.query(
      `INSERT INTO kpi_snapshots (
        platform, year_month, kpi_target, avg_impressions,
        achievement_rate, account_count, publication_count,
        prediction_accuracy, is_reliable, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (platform, year_month) DO UPDATE SET
        kpi_target = EXCLUDED.kpi_target,
        avg_impressions = EXCLUDED.avg_impressions,
        achievement_rate = EXCLUDED.achievement_rate,
        account_count = EXCLUDED.account_count,
        publication_count = EXCLUDED.publication_count,
        prediction_accuracy = EXCLUDED.prediction_accuracy,
        is_reliable = EXCLUDED.is_reliable,
        calculated_at = NOW()
      RETURNING id, platform, year_month, kpi_target, avg_impressions,
                achievement_rate, account_count, publication_count,
                prediction_accuracy, is_reliable, calculated_at`,
      [
        platform,
        year_month,
        kpiTarget,
        avgImpressions,
        achievementRate,
        acctCount,
        pubCount,
        predictionAccuracy,
        isReliable,
      ]
    );

    const snapshot = upsertResult.rows[0];

    return NextResponse.json(
      {
        snapshot: {
          id: snapshot.id as number,
          platform: snapshot.platform as string,
          year_month: snapshot.year_month as string,
          kpi_target: Number(snapshot.kpi_target),
          avg_impressions: Number(snapshot.avg_impressions),
          achievement_rate: Number(snapshot.achievement_rate),
          account_count: snapshot.account_count as number,
          publication_count: snapshot.publication_count as number,
          prediction_accuracy:
            snapshot.prediction_accuracy !== null &&
            snapshot.prediction_accuracy !== undefined
              ? Number(snapshot.prediction_accuracy)
              : null,
          is_reliable: snapshot.is_reliable as boolean,
          calculated_at: snapshot.calculated_at
            ? (snapshot.calculated_at as Date).toISOString()
            : new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } finally {
    client.release();
  }
}
