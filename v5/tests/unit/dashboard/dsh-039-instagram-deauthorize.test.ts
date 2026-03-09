/**
 * TEST-DSH-039: POST /api/auth/instagram/deauthorize
 * Tests the signed_request verification logic for Meta's deauthorize callback.
 */
import { createHmac } from "crypto";

const APP_SECRET = "test_app_secret_for_deauth";

/** Mirrors the verification logic in the route handler */
function verifySignedRequest(
  signedRequest: string,
  appSecret: string
): { valid: boolean; payload?: Record<string, unknown>; error?: string } {
  const dotIndex = signedRequest.indexOf(".");
  if (dotIndex === -1) return { valid: false, error: "malformed_signed_request" };

  const encodedSig = signedRequest.slice(0, dotIndex);
  const encodedPayload = signedRequest.slice(dotIndex + 1);

  const base64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
  const expectedSig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=+$/, "");
  const base64Sig = encodedSig.replace(/-/g, "+").replace(/_/g, "/");

  if (expectedSig !== base64Sig) return { valid: false, error: "invalid_signature" };

  try {
    const payload = JSON.parse(
      Buffer.from(base64Payload, "base64").toString("utf-8")
    ) as Record<string, unknown>;
    return { valid: true, payload };
  } catch {
    return { valid: false, error: "invalid_payload" };
  }
}

/** Creates a valid signed_request for testing */
function buildSignedRequest(
  payload: Record<string, unknown>,
  appSecret: string
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${sig}.${encodedPayload}`;
}

describe("FEAT-DSH-039: Instagram deauthorize signed_request verification", () => {
  const validPayload = {
    user_id: "123456789",
    algorithm: "HMAC-SHA256",
    issued_at: Math.floor(Date.now() / 1000),
  };

  test("valid signed_request is accepted", () => {
    const signedRequest = buildSignedRequest(validPayload, APP_SECRET);
    const result = verifySignedRequest(signedRequest, APP_SECRET);
    expect(result.valid).toBe(true);
    expect(result.payload?.user_id).toBe("123456789");
    expect(result.payload?.algorithm).toBe("HMAC-SHA256");
  });

  test("wrong app secret is rejected", () => {
    const signedRequest = buildSignedRequest(validPayload, APP_SECRET);
    const result = verifySignedRequest(signedRequest, "wrong_secret");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_signature");
  });

  test("tampered payload is rejected", () => {
    const signedRequest = buildSignedRequest(validPayload, APP_SECRET);
    const [sig, encodedPayload] = signedRequest.split(".");
    // Tamper the payload
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...validPayload, user_id: "evil_user" })
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = `${sig}.${tamperedPayload}`;
    const result = verifySignedRequest(tampered, APP_SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("invalid_signature");
  });

  test("malformed signed_request (no dot) is rejected", () => {
    const result = verifySignedRequest("nodothere", APP_SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("malformed_signed_request");
  });

  test("empty string is rejected", () => {
    const result = verifySignedRequest("", APP_SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("malformed_signed_request");
  });

  test("base64url special characters are handled correctly", () => {
    // Payload that produces base64 with +/= characters
    const payloadWithSpecialChars = {
      user_id: "987654321",
      algorithm: "HMAC-SHA256",
      issued_at: 1700000000,
      extra: ">>??<<",
    };
    const signedRequest = buildSignedRequest(payloadWithSpecialChars, APP_SECRET);
    const result = verifySignedRequest(signedRequest, APP_SECRET);
    expect(result.valid).toBe(true);
    expect(result.payload?.user_id).toBe("987654321");
  });

  test("payload JSON is correctly decoded", () => {
    const signedRequest = buildSignedRequest(validPayload, APP_SECRET);
    const result = verifySignedRequest(signedRequest, APP_SECRET);
    expect(result.valid).toBe(true);
    expect(result.payload).toMatchObject({
      user_id: "123456789",
      algorithm: "HMAC-SHA256",
    });
  });
});
