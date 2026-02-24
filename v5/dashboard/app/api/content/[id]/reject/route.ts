import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_REJECTION_CATEGORIES = [
  "plan_revision", "data_insufficient", "hypothesis_weak",
] as const;

/**
 * POST /api/content/:id/reject
 * Reject content (pending_approval -> rejected) with required comment.
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
      { error: `Content must be in pending_approval status to reject. Current: ${existing.status}` },
      { status: 400 }
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

  const { comment, rejection_category } = body as {
    comment?: string;
    rejection_category?: string;
  };

  // Comment is required for rejection
  if (!comment || comment.trim() === "") {
    return NextResponse.json(
      { error: "comment is required for rejection" },
      { status: 400 }
    );
  }

  // Validate rejection_category
  if (
    !rejection_category ||
    !VALID_REJECTION_CATEGORIES.includes(
      rejection_category as typeof VALID_REJECTION_CATEGORIES[number]
    )
  ) {
    return NextResponse.json(
      {
        error: `rejection_category is required. Must be one of: ${VALID_REJECTION_CATEGORIES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const result = await query(
    `UPDATE content
     SET status = 'rejected',
         approval_feedback = $1,
         rejection_category = $2,
         updated_at = NOW()
     WHERE content_id = $3
     RETURNING *`,
    [comment, rejection_category, id]
  );

  return NextResponse.json({ content: result[0] });
}
