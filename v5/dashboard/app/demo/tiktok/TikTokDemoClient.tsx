"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ConnectedAccount {
  platform_username: string;
}

interface Props {
  connectedAccount: ConnectedAccount | null;
}

interface VideoItem {
  id?: string;
  title?: string;
  create_time?: number;
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
  like_count?: number;
}

const DEMO_VIDEOS: VideoItem[] = [
  { id: "demo_001", title: "Morning Routine Tips #productivity", create_time: 1772668800, view_count: 23400, like_count: 1200 },
  { id: "demo_002", title: "Tokyo Street Food 🍜", create_time: 1772496000, view_count: 15800, like_count: 680 },
  { id: "demo_003", title: "Productivity Hacks for Creators", create_time: 1772323200, view_count: 6000, like_count: 220 },
];

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function TikTokDemoClient({ connectedAccount }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 2 state
  const [videoTitle, setVideoTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Step 3 state
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [videosFetched, setVideosFetched] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const steps = [
    t("tiktokDemo.step1Label"),
    t("tiktokDemo.step2Label"),
    t("tiktokDemo.step3Label"),
  ];

  async function handleUpload() {
    if (!videoFile || !videoTitle.trim()) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", videoFile);
    formData.append("title", videoTitle.trim());

    try {
      const res = await fetch("/api/demo/tiktok/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { publish_id?: string; error?: string };
      if (!res.ok || data.error) {
        setUploadError(data.error ?? `HTTP ${res.status}`);
      } else {
        setPublishId(data.publish_id ?? null);
      }
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleFetchVideos() {
    setFetching(true);
    setFetchError(null);

    try {
      const res = await fetch("/api/demo/tiktok/videos");
      const data = (await res.json()) as { videos?: VideoItem[]; error?: string };
      if (!res.ok || data.error) {
        setFetchError(data.error ?? `HTTP ${res.status}`);
      } else {
        const fetched = data.videos ?? [];
        if (fetched.length === 0) {
          setIsDemo(true);
          setVideos(DEMO_VIDEOS);
        } else {
          setVideos(fetched);
        }
        setVideosFetched(true);
      }
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t("tiktokDemo.pageTitle")}</h1>

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

      {/* Step 1: Connect */}
      {step === 1 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("tiktokDemo.step1Title")}</h2>
          {connectedAccount ? (
            <>
              <p className="text-muted-foreground">{t("tiktokDemo.step1ConnectedDesc")}</p>
              <p className="text-sm font-medium text-green-600">
                {t("tiktokDemo.connectedAs")} @{connectedAccount.platform_username}
              </p>
              <button
                onClick={() => setStep(2)}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("tiktokDemo.nextStep")}
              </button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">{t("tiktokDemo.step1NotConnectedDesc")}</p>
              <Link
                href="/auth/tiktok/start"
                className="inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("tiktokDemo.connectButton")}
              </Link>
            </>
          )}
        </div>
      )}

      {/* Step 2: Post */}
      {step === 2 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("tiktokDemo.step2Title")}</h2>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t("tiktokDemo.videoTitle")}
            </label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="My test video"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t("tiktokDemo.videoFile")}
            </label>
            <input
              type="file"
              accept="video/mp4"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {uploadError && (
            <p className="text-sm text-destructive font-mono break-all">{uploadError}</p>
          )}

          {publishId ? (
            <div className="space-y-3">
              <p className="text-sm text-green-600 font-medium">
                {t("tiktokDemo.uploadSuccess")}
              </p>
              <p className="text-xs text-muted-foreground font-mono break-all">
                publish_id: {publishId}
              </p>
              <button
                onClick={() => setStep(3)}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("tiktokDemo.nextStep")}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {t("tiktokDemo.back")}
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !videoFile || !videoTitle.trim()}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                  {t("tiktokDemo.uploading")}
                </>
              ) : (
                t("tiktokDemo.uploadButton")
              )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: View Videos */}
      {step === 3 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("tiktokDemo.step3Title")}</h2>

          {fetchError && (
            <p className="text-sm text-destructive font-mono break-all">{fetchError}</p>
          )}

          {/* Demo banner */}
          {isDemo && videosFetched && (
            <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">⚠️ {t("tiktokDemo.demoBanner")}</p>
              <p className="text-xs leading-relaxed">{t("tiktokDemo.demoBannerDesc")}</p>
            </div>
          )}

          {/* Summary stats */}
          {videos.length > 0 && videosFetched && (() => {
            const totalViews = videos.reduce((s, v) => s + (v.view_count ?? 0), 0);
            const totalLikes = videos.reduce((s, v) => s + (v.like_count ?? 0), 0);
            const avgEng = totalViews > 0 ? (totalLikes / totalViews * 100).toFixed(1) + "%" : "—";
            return (
              <div className="flex flex-wrap gap-3">
                {[
                  { label: t("tiktokDemo.totalVideos"), value: videos.length },
                  { label: t("tiktokDemo.totalViews"), value: totalViews.toLocaleString() },
                  { label: t("tiktokDemo.totalLikes"), value: totalLikes.toLocaleString() },
                  { label: t("tiktokDemo.avgEngagement"), value: avgEng },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border bg-muted px-3 py-2 text-center min-w-[110px]">
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Video table */}
          {videos.length > 0 && videosFetched && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="pb-2 pr-3 w-12">Cover</th>
                    <th className="pb-2 pr-3">{t("tiktokDemo.colTitle")}</th>
                    <th className="pb-2 pr-3 text-right">{t("tiktokDemo.colViews")}</th>
                    <th className="pb-2 pr-3 text-right">{t("tiktokDemo.colLikes")}</th>
                    <th className="pb-2 pr-3 text-right">{t("tiktokDemo.colEngagement")}</th>
                    <th className="pb-2 text-right">{t("tiktokDemo.colDate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v, i) => {
                    const eng = v.view_count ? ((v.like_count ?? 0) / v.view_count * 100).toFixed(1) + "%" : "—";
                    return (
                      <tr key={v.id ?? `video-${i}`} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          {v.cover_image_url ? (
                            <img src={v.cover_image_url} alt="" className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                              TK
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 max-w-[200px] truncate font-medium">{v.title ?? "(no title)"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{(v.view_count ?? 0).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{(v.like_count ?? 0).toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{eng}</td>
                        <td className="py-2 text-right text-muted-foreground">{v.create_time ? formatDate(v.create_time) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {t("tiktokDemo.back")}
            </button>
            <button
              onClick={handleFetchVideos}
              disabled={fetching}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                  {t("tiktokDemo.fetching")}
                </>
              ) : (
                t("tiktokDemo.fetchVideosButton")
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
