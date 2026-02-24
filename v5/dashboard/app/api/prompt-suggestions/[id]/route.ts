import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * PUT /api/prompt-suggestions/:id
 * Accept or reject a prompt suggestion.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const { status, human_feedback } = body;

  const validStatuses = ["accepted", "rejected", "expired"];
  if (!status || !validStatuses.includes(status as string)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await queryOne(
    `SELECT * FROM prompt_suggestions WHERE id = $1`,
    [parseInt(id, 10)]
  );
  if (!existing) {
    return NextResponse.json(
      { error: "Suggestion not found" },
      { status: 404 }
    );
  }

  const result = await query(
    `UPDATE prompt_suggestions
     SET status = $1, human_feedback = $2, resolved_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [status, human_feedback || null, parseInt(id, 10)]
  );

  return NextResponse.json(result[0]);
}
