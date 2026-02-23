import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

/**
 * PUT /api/communications/:id
 * Respond to an agent communication.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { human_response } = body;

  if (!human_response) {
    return NextResponse.json(
      { error: "human_response is required" },
      { status: 400 }
    );
  }

  const existing = await queryOne(
    `SELECT * FROM agent_communications WHERE id = $1`,
    [id]
  );
  if (!existing) {
    return NextResponse.json(
      { error: "Communication not found" },
      { status: 404 }
    );
  }

  const result = await query(
    `UPDATE agent_communications
     SET human_response = $1, status = 'responded', human_responded_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [human_response, id]
  );

  return NextResponse.json(result[0]);
}
