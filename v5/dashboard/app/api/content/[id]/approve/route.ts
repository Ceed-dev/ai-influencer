import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

/**
 * POST /api/content/:id/approve
 * Approve content (pending_approval -> approved).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Check content exists
  const existing = await queryOne<Record<string, unknown>>(
    `SELECT * FROM content WHERE content_id = $1`,
    [id]
  );

  if (!existing) {
    return NextResponse.json(
      { error: `Content ${id} not found` },
      { status: 404 }
    );
  }

  if (existing.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Content must be in pending_approval status to approve. Current: ${existing.status}` },
      { status: 400 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // comment is optional for approve
  }

  const comment = (body.comment as string) ?? null;

  const result = await query(
    `UPDATE content
     SET status = 'approved',
         approved_by = 'dashboard_user',
         approved_at = NOW(),
         approval_feedback = $1,
         updated_at = NOW()
     WHERE content_id = $2
     RETURNING *`,
    [comment, id]
  );

  return NextResponse.json({ content: result[0] });
}
