import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

/**
 * PUT /api/settings/:key
 * Update a system setting value with constraint validation.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  const { key } = params;

  // Fetch existing setting
  const existing = await queryOne<Record<string, unknown>>(
    `SELECT * FROM system_settings WHERE setting_key = $1`,
    [key]
  );

  if (!existing) {
    return NextResponse.json(
      { error: `Setting '${key}' not found` },
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

  if (!("value" in body)) {
    return NextResponse.json(
      { error: "value is required" },
      { status: 400 }
    );
  }

  const newValue = body.value;
  const valueType = existing.value_type as string;
  const constraints = existing.constraints as Record<string, unknown> | null;

  // Type validation
  if (valueType === "integer" && typeof newValue !== "number") {
    return NextResponse.json(
      { error: `Value must be an integer` },
      { status: 400 }
    );
  }

  if (valueType === "float" && typeof newValue !== "number") {
    return NextResponse.json(
      { error: `Value must be a number` },
      { status: 400 }
    );
  }

  if (valueType === "boolean" && typeof newValue !== "boolean") {
    return NextResponse.json(
      { error: `Value must be a boolean` },
      { status: 400 }
    );
  }

  if (valueType === "string" && typeof newValue !== "string") {
    return NextResponse.json(
      { error: `Value must be a string` },
      { status: 400 }
    );
  }

  // Constraint validation
  if (constraints) {
    if (typeof newValue === "number") {
      const min = constraints.min as number | undefined;
      const max = constraints.max as number | undefined;

      if (min !== undefined && newValue < min) {
        return NextResponse.json(
          { error: `Value must be >= ${min}` },
          { status: 400 }
        );
      }
      if (max !== undefined && newValue > max) {
        return NextResponse.json(
          { error: `Value must be <= ${max}` },
          { status: 400 }
        );
      }
    }

    if (valueType === "enum") {
      const options = constraints.options as string[] | undefined;
      if (options && !options.includes(newValue as string)) {
        return NextResponse.json(
          { error: `Value must be one of: ${options.join(", ")}` },
          { status: 400 }
        );
      }
    }
  }

  const result = await query(
    `UPDATE system_settings
     SET setting_value = $1::jsonb,
         updated_at = NOW(),
         updated_by = 'human'
     WHERE setting_key = $2
     RETURNING *`,
    [JSON.stringify(newValue), key]
  );

  return NextResponse.json({ setting: result[0] });
}
