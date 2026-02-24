import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

/**
 * GET /api/baselines/:account_id
 * Returns the baseline data for a specific account.
 * Spec: api-schemas.ts #16 (GetBaselineRequest/Response)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { account_id: string } }
) {
  const { account_id } = params;

  if (!account_id || account_id.trim().length === 0) {
    return NextResponse.json(
      { error: "account_id is required" },
      { status: 400 }
    );
  }

  // Check account exists
  const account = await queryOne(
    `SELECT account_id FROM accounts WHERE account_id = $1`,
    [account_id]
  );

  if (!account) {
    return NextResponse.json(
      { error: `Account ${account_id} not found` },
      { status: 404 }
    );
  }

  const baseline = await queryOne(
    `SELECT account_id, baseline_impressions, source, sample_count,
            window_start, window_end, calculated_at
     FROM account_baselines
     WHERE account_id = $1`,
    [account_id]
  );

  if (!baseline) {
    return NextResponse.json({ baseline: null });
  }

  const row = baseline as Record<string, unknown>;

  return NextResponse.json({
    baseline: {
      account_id: row.account_id as string,
      baseline_impressions: Number(row.baseline_impressions),
      source: row.source as string,
      sample_count: row.sample_count as number,
      window_start: String(row.window_start),
      window_end: String(row.window_end),
      calculated_at: row.calculated_at
        ? (row.calculated_at as Date).toISOString()
        : new Date().toISOString(),
    },
  });
}
