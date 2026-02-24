import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["active", "paused", "suspended", "setup"] as const;

/**
 * GET /api/accounts/:id
 * Get account details with related character and recent publications.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const account = await queryOne(
    `SELECT * FROM accounts WHERE account_id = $1`,
    [id]
  );

  if (!account) {
    return NextResponse.json(
      { error: `Account ${id} not found` },
      { status: 404 }
    );
  }

  // Fetch related character
  const accountData = account as Record<string, unknown>;
  let character = null;
  if (accountData.character_id) {
    character = await queryOne(
      `SELECT * FROM characters WHERE character_id = $1`,
      [accountData.character_id as string]
    );
  }

  // Fetch recent publications
  const recentPublications = await query(
    `SELECT p.* FROM publications p
     JOIN content c ON p.content_id = c.content_id
     JOIN accounts a ON c.character_id = a.character_id AND a.account_id = $1
     WHERE p.account_id = $1
     ORDER BY p.created_at DESC
     LIMIT 10`,
    [id]
  );

  return NextResponse.json({
    account: {
      ...accountData,
      character: character ?? undefined,
      recent_publications: recentPublications.length > 0 ? recentPublications : undefined,
    },
  });
}

/**
 * PUT /api/accounts/:id
 * Update account fields.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Check account exists
  const existing = await queryOne(
    `SELECT * FROM accounts WHERE account_id = $1`,
    [id]
  );

  if (!existing) {
    return NextResponse.json(
      { error: `Account ${id} not found` },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { handle, status, niche, cluster, character_id, auth_credentials } = body as {
    handle?: string;
    status?: string;
    niche?: string;
    cluster?: string;
    character_id?: string;
    auth_credentials?: Record<string, unknown>;
  };

  // Validate status if provided
  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (handle !== undefined) {
    updates.push(`platform_username = $${paramIdx++}`);
    values.push(handle);
  }
  if (status !== undefined) {
    updates.push(`status = $${paramIdx++}`);
    values.push(status);
  }
  if (niche !== undefined) {
    updates.push(`niche = $${paramIdx++}`);
    values.push(niche);
  }
  if (cluster !== undefined) {
    updates.push(`cluster = $${paramIdx++}`);
    values.push(cluster);
  }
  if (character_id !== undefined) {
    updates.push(`character_id = $${paramIdx++}`);
    values.push(character_id);
  }
  if (auth_credentials !== undefined) {
    updates.push(`auth_credentials = $${paramIdx++}`);
    values.push(JSON.stringify(auth_credentials));
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 }
    );
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE accounts SET ${updates.join(", ")} WHERE account_id = $${paramIdx} RETURNING *`,
    values
  );

  return NextResponse.json({ account: result[0] });
}
