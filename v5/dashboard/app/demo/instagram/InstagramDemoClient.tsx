"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ConnectedAccount {
  platform_username: string;
}

interface Props {
  connectedAccount: ConnectedAccount | null;
}

interface AccountInfo {
  id: string;
  username?: string;
  name?: string;
  biography?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
}

interface PageInfo {
  id: string;
  name?: string;
  fan_count?: number;
}

interface PostItem {
  id: string;
  caption?: string;
  media_type?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

interface AccountInsights {
  impressions?: number;
  reach?: number;
  profile_views?: number;
}

interface PageInsights {
  page_impressions?: number;
  page_engaged_users?: number;
}

export function InstagramDemoClient({ connectedAccount }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [fetchingAccount, setFetchingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Step 2 state
  const [caption, setCaption] = useState("Test post from AI Influencer dashboard. #demo #test");
  const [imageUrl, setImageUrl] = useState("https://ai-dash.0xqube.xyz/test-post.jpg");
  const [publishing, setPublishing] = useState(false);
  const [publishedMediaId, setPublishedMediaId] = useState<string | null>(null);
  const [permalink, setPermalink] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Step 3 state
  const [recentPosts, setRecentPosts] = useState<PostItem[]>([]);
  const [accountInsights, setAccountInsights] = useState<AccountInsights | null>(null);
  const [pageInsights, setPageInsights] = useState<PageInsights | null>(null);
  const [fetchingInsights, setFetchingInsights] = useState(false);
  const [insightsFetched, setInsightsFetched] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsWarnings, setInsightsWarnings] = useState<string[]>([]);

  const steps = [
    t("instagramDemo.step1Label"),
    t("instagramDemo.step2Label"),
    t("instagramDemo.step3Label"),
  ];

  async function handleFetchAccount() {
    setFetchingAccount(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/demo/instagram/account");
      const data = (await res.json()) as {
        account?: AccountInfo;
        page?: PageInfo;
        error?: string;
      };
      if (!res.ok || data.error) {
        setAccountError(data.error ?? `HTTP ${res.status}`);
      } else {
        setAccountInfo(data.account ?? null);
        setPageInfo(data.page ?? null);
      }
    } catch (err) {
      setAccountError(String(err));
    } finally {
      setFetchingAccount(false);
    }
  }

  async function handlePublish() {
    if (!imageUrl.trim()) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/demo/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: imageUrl.trim(), caption: caption.trim() }),
      });
      const data = (await res.json()) as {
        media_id?: string;
        permalink?: string;
        error?: string;
      };
      if (!res.ok || data.error) {
        setPublishError(data.error ?? `HTTP ${res.status}`);
      } else {
        setPublishedMediaId(data.media_id ?? null);
        setPermalink(data.permalink ?? null);
      }
    } catch (err) {
      setPublishError(String(err));
    } finally {
      setPublishing(false);
    }
  }

  async function handleFetchInsights() {
    setFetchingInsights(true);
    setInsightsError(null);
    try {
      const res = await fetch("/api/demo/instagram/insights");
      const data = (await res.json()) as {
        recentPosts?: PostItem[];
        accountInsights?: AccountInsights;
        pageInsights?: PageInsights;
        error?: string;
        warnings?: string[];
      };
      if (!res.ok || data.error) {
        setInsightsError(data.error ?? `HTTP ${res.status}`);
      } else {
        setRecentPosts(data.recentPosts ?? []);
        setAccountInsights(data.accountInsights ?? null);
        setPageInsights(data.pageInsights ?? null);
        setInsightsWarnings(data.warnings ?? []);
        setInsightsFetched(true);
      }
    } catch (err) {
      setInsightsError(String(err));
    } finally {
      setFetchingInsights(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t("instagramDemo.pageTitle")}</h1>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const isDone = step > stepNum;
          const isCurrent = step === stepNum;
          return (
            <div key={label} className="flex items-center gap-1">
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : (
                <Circle
                  className={`h-5 w-5 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`}
                />
              )}
              <button
                onClick={() => setStep(stepNum)}
                className={`text-sm hover:underline ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}
              >
                {label}
              </button>
              {i < steps.length - 1 && (
                <span className="mx-2 text-muted-foreground">───</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Account Info */}
      {step === 1 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("instagramDemo.step1Title")}</h2>
          {connectedAccount ? (
            <>
              <p className="text-muted-foreground">{t("instagramDemo.step1ConnectedDesc")}</p>
              <p className="text-sm font-medium text-green-600">
                {t("instagramDemo.connectedAs")} @{connectedAccount.platform_username}
              </p>

              {accountError && (
                <p className="text-sm text-destructive font-mono break-all">{accountError}</p>
              )}

              {/* Account card */}
              {accountInfo && (
                <div className="rounded-md border bg-muted p-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    {t("instagramDemo.igAccount")}
                  </p>
                  <div className="flex items-center gap-3">
                    {accountInfo.profile_picture_url && (
                      <img
                        src={accountInfo.profile_picture_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-foreground">@{accountInfo.username ?? accountInfo.id}</p>
                      {accountInfo.name && <p className="text-sm text-muted-foreground">{accountInfo.name}</p>}
                    </div>
                  </div>
                  {accountInfo.biography && (
                    <p className="text-sm text-muted-foreground">{accountInfo.biography}</p>
                  )}
                  <div className="flex gap-4 text-sm">
                    <span><span className="font-bold text-foreground">{(accountInfo.followers_count ?? 0).toLocaleString()}</span> {t("instagramDemo.followers")}</span>
                    <span><span className="font-bold text-foreground">{(accountInfo.media_count ?? 0).toLocaleString()}</span> {t("instagramDemo.posts")}</span>
                  </div>
                </div>
              )}

              {/* Page card */}
              {pageInfo && (
                <div className="rounded-md border bg-muted p-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    {t("instagramDemo.fbPage")}
                  </p>
                  <p className="font-semibold text-foreground">{pageInfo.name ?? pageInfo.id}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{(pageInfo.fan_count ?? 0).toLocaleString()}</span>{" "}
                    {t("instagramDemo.pageLikes")}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleFetchAccount}
                  disabled={fetchingAccount}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetchingAccount ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                      {t("instagramDemo.fetching")}
                    </>
                  ) : (
                    t("instagramDemo.fetchAccountButton")
                  )}
                </button>
                {accountInfo && (
                  <button
                    onClick={() => setStep(2)}
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {t("instagramDemo.nextStep")}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">{t("instagramDemo.step1NotConnectedDesc")}</p>
              <a
                href="/auth/instagram/start"
                className="inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("instagramDemo.connectButton")}
              </a>
            </>
          )}
        </div>
      )}

      {/* Step 2: Publish Photo */}
      {step === 2 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("instagramDemo.step2Title")}</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t("instagramDemo.imageUrl")}
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t("instagramDemo.captionLabel")}
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="w-full rounded border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Caption..."
            />
          </div>

          {publishError && (
            <p className="text-sm text-destructive font-mono break-all">{publishError}</p>
          )}

          {publishedMediaId ? (
            <div className="space-y-3">
              <p className="text-sm text-green-600 font-medium">
                {t("instagramDemo.publishSuccess")}
              </p>
              <p className="text-xs text-muted-foreground font-mono break-all">
                media_id: {publishedMediaId}
              </p>
              {permalink && (
                <a
                  href={permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline break-all"
                >
                  {permalink}
                </a>
              )}
              <button
                onClick={() => setStep(3)}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("instagramDemo.nextStep")}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {t("instagramDemo.back")}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !imageUrl.trim()}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                    {t("instagramDemo.publishing")}
                  </>
                ) : (
                  t("instagramDemo.publishButton")
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Insights */}
      {step === 3 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("instagramDemo.step3Title")}</h2>

          {insightsError && (
            <p className="text-sm text-destructive font-mono break-all">{insightsError}</p>
          )}

          {insightsFetched && insightsWarnings.length > 0 && (
            <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Partial data — some API calls failed:</p>
              {insightsWarnings.map((w) => (
                <p key={w} className="font-mono">{w}</p>
              ))}
            </div>
          )}

          {/* Account insights summary */}
          {insightsFetched && accountInsights && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                {t("instagramDemo.accountInsights")}
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: t("instagramDemo.impressions"), value: (accountInsights.impressions ?? 0).toLocaleString() },
                  { label: t("instagramDemo.reach"), value: (accountInsights.reach ?? 0).toLocaleString() },
                  { label: t("instagramDemo.profileViews"), value: (accountInsights.profile_views ?? 0).toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border bg-muted px-3 py-2 text-center min-w-[110px]">
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Page insights summary */}
          {insightsFetched && pageInsights && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                {t("instagramDemo.pageInsights")}
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: t("instagramDemo.pageImpressions"), value: (pageInsights.page_impressions ?? 0).toLocaleString() },
                  { label: t("instagramDemo.pageEngagedUsers"), value: (pageInsights.page_engaged_users ?? 0).toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border bg-muted px-3 py-2 text-center min-w-[110px]">
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent posts table */}
          {insightsFetched && recentPosts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                {t("instagramDemo.recentPosts")}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground text-xs">
                      <th className="pb-2 pr-3">{t("instagramDemo.colCaption")}</th>
                      <th className="pb-2 pr-3">{t("instagramDemo.colType")}</th>
                      <th className="pb-2 pr-3 text-right">{t("instagramDemo.colLikes")}</th>
                      <th className="pb-2 pr-3 text-right">{t("instagramDemo.colComments")}</th>
                      <th className="pb-2 text-right">{t("instagramDemo.colDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPosts.map((post) => (
                      <tr key={post.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 max-w-[180px] truncate text-foreground">
                          {post.caption ? post.caption.slice(0, 60) + (post.caption.length > 60 ? "…" : "") : "(no caption)"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground text-xs">{post.media_type ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{(post.like_count ?? 0).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{(post.comments_count ?? 0).toLocaleString()}</td>
                        <td className="py-2 text-right text-muted-foreground text-xs">
                          {post.timestamp ? new Date(post.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {t("instagramDemo.back")}
            </button>
            <button
              onClick={handleFetchInsights}
              disabled={fetchingInsights}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fetchingInsights ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                  {t("instagramDemo.fetching")}
                </>
              ) : (
                t("instagramDemo.fetchInsightsButton")
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
