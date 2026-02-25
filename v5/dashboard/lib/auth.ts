import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
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
    const row = await queryOne<{ setting_value: string }>(
      "SELECT setting_value FROM system_settings WHERE setting_key = $1",
      ["AUTH_ALLOWED_EMAILS"]
    );
    if (!row) return [];
    return JSON.parse(row.setting_value) as string[];
  } catch {
    return [];
  }
}

async function getUserRoles(): Promise<Record<string, UserRole>> {
  try {
    const row = await queryOne<{ setting_value: string }>(
      "SELECT setting_value FROM system_settings WHERE setting_key = $1",
      ["AUTH_USER_ROLES"]
    );
    if (!row) return {};
    return JSON.parse(row.setting_value) as Record<string, UserRole>;
  } catch {
    return {};
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
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
    async signIn({ user }) {
      if (!user.email) return false;
      const allowed = await getAllowedEmails();
      return allowed.includes(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const roles = await getUserRoles();
        token.role = roles[user.email] ?? "viewer";
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
