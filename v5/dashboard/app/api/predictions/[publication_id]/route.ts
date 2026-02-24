import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/predictions/:publication_id
 * Returns prediction snapshot for a specific publication.
 * Spec: api-schemas.ts GetPredictionRequest/GetPredictionResponse
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { publication_id: string } }
) {
  const { publication_id } = params;
  const pubId = parseInt(publication_id, 10);

  if (isNaN(pubId) || pubId <= 0) {
    return NextResponse.json(
      { error: "publication_id must be a positive integer" },
      { status: 400 }
    );
  }

  const row = await queryOne<Record<string, unknown>>(
    `SELECT id, publication_id, content_id, account_id, hypothesis_id,
            baseline_used, baseline_source, adjustments_applied,
            total_adjustment, predicted_impressions,
            actual_impressions_48h, actual_impressions_7d, actual_impressions_30d,
            prediction_error_7d, prediction_error_30d,
            created_at, updated_at
     FROM prediction_snapshots
     WHERE publication_id = $1`,
    [pubId]
  );

  if (!row) {
    return NextResponse.json({ prediction: null });
  }

  return NextResponse.json({
    prediction: {
      id: row.id as number,
      publication_id: row.publication_id as number,
      content_id: row.content_id as string,
      account_id: row.account_id as string,
      hypothesis_id: (row.hypothesis_id as number) ?? null,
      baseline_used: Number(row.baseline_used),
      baseline_source: row.baseline_source as string,
      adjustments_applied: row.adjustments_applied as Record<
        string,
        { value: string; adjustment: number; weight: number }
      >,
      total_adjustment: Number(row.total_adjustment),
      predicted_impressions: Number(row.predicted_impressions),
      actual_impressions_48h: (row.actual_impressions_48h as number) ?? null,
      actual_impressions_7d: (row.actual_impressions_7d as number) ?? null,
      actual_impressions_30d: (row.actual_impressions_30d as number) ?? null,
      prediction_error_7d:
        row.prediction_error_7d !== null && row.prediction_error_7d !== undefined
          ? Number(row.prediction_error_7d)
          : null,
      prediction_error_30d:
        row.prediction_error_30d !== null && row.prediction_error_30d !== undefined
          ? Number(row.prediction_error_30d)
          : null,
      created_at: row.created_at
        ? (row.created_at as Date).toISOString()
        : new Date().toISOString(),
      updated_at: row.updated_at
        ? (row.updated_at as Date).toISOString()
        : new Date().toISOString(),
    },
  });
}
