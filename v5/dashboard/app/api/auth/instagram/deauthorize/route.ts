import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SettingRow {
  setting_value: unknown;
}

interface DeauthorizePayload {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
}

/**
 * POST /api/auth/instagram/deauthorize
 * Meta calls this webhook when a user removes the app from their Facebook account.
 * Verifies the signed_request using HMAC-SHA256 with the app secret.
 * Spec: Facebook Login for Business > Settings > Deauthorize Callback URL
 */
export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    console.error("[instagram-deauthorize] Failed to read request body");
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Parse form-encoded body
  const params = new URLSearchParams(body);
  const signedRequest = params.get("signed_request");

  if (!signedRequest) {
    console.error("[instagram-deauthorize] Missing signed_request");
    return NextResponse.json({ error: "missing_signed_request" }, { status: 400 });
  }

  // Split into signature and payload
  const dotIndex = signedRequest.indexOf(".");
  if (dotIndex === -1) {
    console.error("[instagram-deauthorize] Malformed signed_request");
    return NextResponse.json({ error: "malformed_signed_request" }, { status: 400 });
  }
  const encodedSig = signedRequest.slice(0, dotIndex);
  const encodedPayload = signedRequest.slice(dotIndex + 1);

  // Get app secret from system_settings
  const appSecretSetting = await queryOne<SettingRow>(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'INSTAGRAM_APP_SECRET'`
  );
  if (!appSecretSetting) {
    console.error("[instagram-deauthorize] INSTAGRAM_APP_SECRET not found in system_settings");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  const appSecret = String(appSecretSetting.setting_value);

  // Verify HMAC-SHA256 signature
  // Meta uses base64url encoding (no padding, - instead of +, _ instead of /)
  const base64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
  // Compute expected sig and strip padding for comparison
  const expectedSig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=+$/, "");

  // Convert received sig from base64url to base64 (no padding)
  const base64Sig = encodedSig.replace(/-/g, "+").replace(/_/g, "/");
  if (expectedSig !== base64Sig) {
    console.error("[instagram-deauthorize] Signature mismatch — possible forgery");
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  // Decode payload
  let payload: DeauthorizePayload;
  try {
    payload = JSON.parse(Buffer.from(base64Payload, "base64").toString("utf-8")) as DeauthorizePayload;
  } catch {
    console.error("[instagram-deauthorize] Failed to decode payload");
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const userId = payload.user_id ?? "";
  console.log(`[instagram-deauthorize] User ${userId} deauthorized the app`);

  // Meta's deauthorize callback sends the Facebook App-scoped User ID (ASID).
  // We don't store ASID directly; log the event for audit purposes.
  // Accounts are managed by ig_user_id — manual review may be needed for cleanup.

  return NextResponse.json({ success: true });
}
