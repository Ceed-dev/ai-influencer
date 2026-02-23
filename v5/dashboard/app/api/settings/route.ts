import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * GET /api/settings
 * List all system settings, optionally filtered by category.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  let settings;
  if (category) {
    settings = await query(
      `SELECT * FROM system_settings WHERE category = $1 ORDER BY setting_key ASC`,
      [category]
    );
  } else {
    settings = await query(
      `SELECT * FROM system_settings ORDER BY category ASC, setting_key ASC`
    );
  }

  return NextResponse.json({ settings });
}
