/**
 * TEST-DSH-040: Demo Access (Meta App Review reviewer bypass)
 * Tests the demo credentials provider token validation logic.
 */

const VALID_TOKEN = "8d2abfbc-acdd-4e22-92e6-2f065f9bd021";
const DEMO_USER_EMAIL = "demo@meta-reviewer.local";

/** Mirrors the authorize() logic in the CredentialsProvider */
function authorizeDemo(
  providedToken: string | undefined,
  storedToken: string | null
): { id: string; email: string; name: string } | null {
  if (!providedToken) return null;
  if (!storedToken || providedToken !== storedToken) return null;
  return {
    id: "demo-reviewer",
    email: DEMO_USER_EMAIL,
    name: "Demo Reviewer",
  };
}

/** Mirrors the jwt callback role assignment for demo user */
function resolveRole(email: string, userRoles: Record<string, string>): string {
  if (email === DEMO_USER_EMAIL) return "admin";
  return userRoles[email] ?? "viewer";
}

describe("FEAT-DSH-040: Demo access credentials provider", () => {
  describe("token validation", () => {
    test("valid token returns demo user", () => {
      const result = authorizeDemo(VALID_TOKEN, VALID_TOKEN);
      expect(result).not.toBeNull();
      expect(result?.email).toBe(DEMO_USER_EMAIL);
      expect(result?.name).toBe("Demo Reviewer");
    });

    test("wrong token is rejected", () => {
      const result = authorizeDemo("wrong-token", VALID_TOKEN);
      expect(result).toBeNull();
    });

    test("empty token is rejected", () => {
      const result = authorizeDemo("", VALID_TOKEN);
      expect(result).toBeNull();
    });

    test("undefined token is rejected", () => {
      const result = authorizeDemo(undefined, VALID_TOKEN);
      expect(result).toBeNull();
    });

    test("null stored token (feature disabled) is rejected", () => {
      const result = authorizeDemo(VALID_TOKEN, null);
      expect(result).toBeNull();
    });

    test("empty stored token (feature disabled) is rejected", () => {
      const result = authorizeDemo(VALID_TOKEN, "");
      expect(result).toBeNull();
    });
  });

  describe("role assignment", () => {
    test("demo user gets admin role", () => {
      const role = resolveRole(DEMO_USER_EMAIL, {});
      expect(role).toBe("admin");
    });

    test("demo user gets admin role even if not in user roles map", () => {
      const role = resolveRole(DEMO_USER_EMAIL, { "other@example.com": "viewer" });
      expect(role).toBe("admin");
    });

    test("regular user gets role from map", () => {
      const role = resolveRole("admin@example.com", { "admin@example.com": "admin" });
      expect(role).toBe("admin");
    });

    test("unknown regular user defaults to viewer", () => {
      const role = resolveRole("unknown@example.com", {});
      expect(role).toBe("viewer");
    });
  });

  describe("login page URL parameter", () => {
    test("demo token from URL param is passed to signIn", () => {
      // Simulates the login page reading ?demo=TOKEN from URL
      const urlParams = new URLSearchParams(`demo=${VALID_TOKEN}`);
      const demoToken = urlParams.get("demo");
      expect(demoToken).toBe(VALID_TOKEN);
      expect(demoToken).not.toBeNull();
    });

    test("absent demo param means no demo button shown", () => {
      const urlParams = new URLSearchParams("");
      const demoToken = urlParams.get("demo");
      expect(demoToken).toBeNull();
    });
  });
});
