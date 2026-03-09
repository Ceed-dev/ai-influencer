import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { queryOne } from "./db";

export type UserRole = "admin" | "viewer";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
  }
}

async function getAllowedEmails(): Promise<string[]> {
  try {
    const row = await queryOne<{ setting_value: string[] | string }>(
      "SELECT setting_value FROM system_settings WHERE setting_key = $1",
      ["AUTH_ALLOWED_EMAILS"]
    );
    if (!row) return [];
    // setting_value is jsonb — pg driver returns parsed object, not a string
    const val = row.setting_value;
    return (typeof val === "string" ? JSON.parse(val) : val) as string[];
  } catch {
    return [];
  }
}

async function getUserRoles(): Promise<Record<string, UserRole>> {
  try {
    const row = await queryOne<{ setting_value: Record<string, UserRole> | string }>(
      "SELECT setting_value FROM system_settings WHERE setting_key = $1",
      ["AUTH_USER_ROLES"]
    );
    if (!row) return {};
    // setting_value is jsonb — pg driver returns parsed object, not a string
    const val = row.setting_value;
    return (typeof val === "string" ? JSON.parse(val) : val) as Record<string, UserRole>;
  } catch {
    return {};
  }
}

async function getDemoAccessToken(): Promise<string | null> {
  try {
    const row = await queryOne<{ setting_value: unknown }>(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'DEMO_ACCESS_TOKEN'"
    );
    if (!row) return null;
    const val = String(row.setting_value).trim();
    return val || null;
  } catch {
    return null;
  }
}

export const DEMO_USER_EMAIL = "demo@meta-reviewer.local";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      id: "demo",
      name: "Demo",
      credentials: {
        token: { type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        const storedToken = await getDemoAccessToken();
        if (!storedToken || credentials.token !== storedToken) return null;
        return {
          id: "demo-reviewer",
          email: DEMO_USER_EMAIL,
          name: "Demo Reviewer",
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Demo provider: token already validated in authorize()
      if (account?.provider === "demo") return true;
      if (!user.email) return false;
      const allowed = await getAllowedEmails();
      return allowed.includes(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        if (user.email === DEMO_USER_EMAIL) {
          token.role = "admin";
        } else {
          const roles = await getUserRoles();
          token.role = roles[user.email] ?? "viewer";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as UserRole) ?? "viewer";
      }
      return session;
    },
  },
};
