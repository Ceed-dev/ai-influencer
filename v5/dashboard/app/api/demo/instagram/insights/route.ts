import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const GRAPH_API = "https://graph.facebook.com/v21.0";

interface AccountRow {
  auth_credentials: {
    oauth: { long_lived_token: string };
    ig_user_id: string;
    page_id: string;
  };
}

interface IgMediaItem {
  id: string;
  caption?: string;
  media_type?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface IgMediaListResponse {
  data?: IgMediaItem[];
  error?: { message: string; code: number };
}

interface InsightValue {
  value: number;
  end_time?: string;
}

interface InsightItem {
  name: string;
  period: string;
  values?: InsightValue[];
  total_value?: { value: number }; // returned when metric_type=total_value
}

interface IgInsightsResponse {
  data?: InsightItem[];
  error?: { message: string; code: number };
}

interface FbPageInsightsResponse {
  data?: InsightItem[];
  error?: { message: string; code: number };
}

/**
 * Extract insight value for a given metric name.
 * Handles both metric_type=total_value (single object) and time_series (values array) formats.
 */
function extractInsightValue(items: InsightItem[], metricName: string): number {
  const item = items.find((i) => i.name === metricName);
  if (!item) return 0;
  if (item.total_value !== undefined) return item.total_value.value ?? 0;
  if (!item.values || item.values.length === 0) return 0;
  return item.values[0]?.value ?? 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await queryOne<AccountRow>(
    `SELECT auth_credentials
     FROM accounts
     WHERE platform = 'instagram' AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`
  );

  if (!account) {
    return NextResponse.json({ error: "No active Instagram account found" }, { status: 404 });
  }

  const token = account.auth_credentials?.oauth?.long_lived_token;
  const igUserId = account.auth_credentials?.ig_user_id;
  const pageId = account.auth_credentials?.page_id;

  if (!token || !igUserId) {
    return NextResponse.json({ error: "Missing token or ig_user_id" }, { status: 400 });
  }

  const bearerHeaders = { Authorization: `Bearer ${token}` };
  const errors: string[] = [];

  // Fetch recent media (instagram_basic)
  let recentPosts: IgMediaItem[] = [];
  try {
    const fields = "id,caption,media_type,timestamp,like_count,comments_count";
    const res = await fetch(
      `${GRAPH_API}/${igUserId}/media?fields=${fields}&limit=10`,
      { headers: bearerHeaders }
    );
    const data = (await res.json()) as IgMediaListResponse;
    console.log("[demo/instagram/insights] Media:", res.status, data.error?.message ?? "ok");
    if (data.error) {
      errors.push(`media: ${data.error.message}`);
    } else {
      recentPosts = data.data ?? [];
    }
  } catch (err) {
    console.warn("[demo/instagram/insights] Media fetch failed:", err);
    errors.push("media: network error");
  }

  // Fetch account insights (instagram_manage_insights)
  // accounts_engaged and profile_views require metric_type=total_value in Graph API v21.0
  // reach supports both formats; include it in the same call for simplicity
  let accountInsights: { accounts_engaged?: number; reach?: number; profile_views?: number } = {};
  try {
    const metrics = "accounts_engaged,reach,profile_views";
    const res = await fetch(
      `${GRAPH_API}/${igUserId}/insights?metric=${metrics}&period=days_28&metric_type=total_value`,
      { headers: bearerHeaders }
    );
    const data = (await res.json()) as IgInsightsResponse;
    console.log("[demo/instagram/insights] Account insights:", res.status, data.error?.message ?? "ok");
    if (data.error) {
      errors.push(`account_insights: ${data.error.message}`);
    } else if (data.data) {
      accountInsights = {
        accounts_engaged: extractInsightValue(data.data, "accounts_engaged"),
        reach: extractInsightValue(data.data, "reach"),
        profile_views: extractInsightValue(data.data, "profile_views"),
      };
    }
  } catch (err) {
    console.warn("[demo/instagram/insights] Account insights fetch failed:", err);
    errors.push("account_insights: network error");
  }

  // Fetch page insights (pages_read_engagement)
  // page_fans with period=lifetime is reliably accessible with a User Access Token
  let pageInsights: { page_impressions?: number; page_engaged_users?: number } = {};
  if (pageId) {
    try {
      const res = await fetch(
        `${GRAPH_API}/${pageId}/insights?metric=page_fans&period=lifetime`,
        { headers: bearerHeaders }
      );
      const data = (await res.json()) as FbPageInsightsResponse;
      console.log("[demo/instagram/insights] Page insights:", res.status, data.error?.message ?? "ok");
      if (data.error) {
        errors.push(`page_insights: ${data.error.message}`);
      } else if (data.data) {
        pageInsights = {
          page_impressions: extractInsightValue(data.data, "page_fans"),
          page_engaged_users: 0,
        };
      }
    } catch (err) {
      console.warn("[demo/instagram/insights] Page insights fetch failed:", err);
      errors.push("page_insights: network error");
    }
  }

  // If all API calls failed, return an error
  const totalCalls = pageId ? 3 : 2;
  if (errors.length === totalCalls) {
    return NextResponse.json(
      { error: `All Instagram API calls failed: ${errors.join("; ")}` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    recentPosts,
    accountInsights,
    pageInsights,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
}
