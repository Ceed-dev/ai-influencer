import { NextRequest, NextResponse } from "next/server";
import { query, queryCount } from "@/lib/db";
import { DEMO_ACCOUNTS, DEMO_ACCOUNTS_TOTAL } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS = ["youtube", "tiktok", "instagram", "x"] as const;
const VALID_STATUSES = ["active", "suspended", "setup"] as const;

/**
 * GET /api/accounts
 * List accounts with optional platform/status filter and pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  // Validate platform filter
  if (platform && !VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
    return NextResponse.json(
      { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate status filter
  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
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

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const offset = (page - 1) * limit;

  const [accounts, total] = await Promise.all([
    query(
      `SELECT * FROM accounts ${whereClause} ORDER BY id ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset]
    ),
    queryCount(
      `SELECT COUNT(*) as count FROM accounts ${whereClause}`,
      params
    ),
  ]);

  // If no accounts exist, return demo data
  if (accounts.length === 0 && total === 0) {
    return NextResponse.json({ accounts: DEMO_ACCOUNTS, total: DEMO_ACCOUNTS_TOTAL });
  }

  return NextResponse.json({ accounts, total });
}

/**
 * POST /api/accounts
 * Create a new account.
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

  const { platform, handle, character_id, niche, cluster, auth_credentials } = body as {
    platform?: string;
    handle?: string;
    character_id?: string;
    niche?: string;
    cluster?: string;
    auth_credentials?: Record<string, unknown>;
  };

  // Validate required fields
  if (!platform) {
    return NextResponse.json(
      { error: "platform is required" },
      { status: 400 }
    );
  }

  if (!VALID_PLATFORMS.includes(platform as typeof VALID_PLATFORMS[number])) {
    return NextResponse.json(
      { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!handle) {
    return NextResponse.json(
      { error: "handle is required" },
      { status: 400 }
    );
  }

  if (!character_id) {
    return NextResponse.json(
      { error: "character_id is required" },
      { status: 400 }
    );
  }

  // Generate next account_id (ACC_XXXX format)
  const maxResult = await query<{ max_id: string | null }>(
    `SELECT MAX(account_id) as max_id FROM accounts`
  );
  const maxId = maxResult[0]?.max_id;
  const nextNum = maxId ? parseInt(maxId.replace("ACC_", ""), 10) + 1 : 1;
  const accountId = `ACC_${String(nextNum).padStart(4, "0")}`;

  const result = await query(
    `INSERT INTO accounts (account_id, platform, platform_username, character_id, niche, cluster, auth_credentials, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'setup')
     RETURNING *`,
    [
      accountId,
      platform,
      handle,
      character_id,
      niche ?? null,
      cluster ?? null,
      auth_credentials ? JSON.stringify(auth_credentials) : null,
    ]
  );

  return NextResponse.json({ account: result[0] }, { status: 201 });
}
