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

interface ChannelInfo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

interface AnalyticsInfo {
  views: number;
  estimatedMinutesWatched: number;
  likes: number;
  comments: number;
  shares: number;
  startDate: string;
  endDate: string;
}

export function YouTubeDemoClient({ connectedAccount }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [fetchingChannel, setFetchingChannel] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Step 2 state
  const [videoTitle, setVideoTitle] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ video_id: string; url: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 3 state
  const [analytics, setAnalytics] = useState<AnalyticsInfo | null>(null);
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const steps = [
    t("youtubeDemo.step1Label"),
    t("youtubeDemo.step2Label"),
    t("youtubeDemo.step3Label"),
  ];

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/auth/youtube/initiate", { method: "POST" });
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setChannelError(data.error ?? "Failed to initiate OAuth");
        setConnecting(false);
      }
    } catch (err) {
      setChannelError(String(err));
      setConnecting(false);
    }
  }

  async function handleFetchChannel() {
    setFetchingChannel(true);
    setChannelError(null);
    try {
      const res = await fetch("/api/demo/youtube/channel");
      const data = (await res.json()) as { channel?: ChannelInfo; error?: string };
      if (!res.ok || data.error) {
        setChannelError(data.error ?? `HTTP ${res.status}`);
      } else if (data.channel) {
        setChannelInfo(data.channel);
      }
    } catch (err) {
      setChannelError(String(err));
    } finally {
      setFetchingChannel(false);
    }
  }

  async function handleUpload() {
    if (!videoFile || !videoTitle.trim()) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", videoFile);
    formData.append("title", videoTitle.trim());
    try {
      const res = await fetch("/api/demo/youtube/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { video_id?: string; url?: string; error?: string };
      if (!res.ok || data.error) {
        setUploadError(data.error ?? `HTTP ${res.status}`);
      } else {
        setUploadResult({ video_id: data.video_id ?? "", url: data.url ?? "" });
      }
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleFetchAnalytics() {
    setFetchingAnalytics(true);
    setAnalyticsError(null);
    try {
      const res = await fetch("/api/demo/youtube/analytics");
      const data = (await res.json()) as { analytics?: AnalyticsInfo; error?: string };
      if (!res.ok || data.error) {
        setAnalyticsError(data.error ?? `HTTP ${res.status}`);
      } else if (data.analytics) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      setAnalyticsError(String(err));
    } finally {
      setFetchingAnalytics(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 space-y-8">
      <h1 className="text-2xl font-bold text-foreground">{t("youtubeDemo.pageTitle")}</h1>

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
                <Circle className={`h-5 w-5 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
              )}
              <button
                onClick={() => setStep(stepNum)}
                className={`text-sm hover:underline ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}
              >
                {label}
              </button>
              {i < steps.length - 1 && <span className="mx-2 text-muted-foreground">───</span>}
            </div>
          );
        })}
      </div>

      {/* Step 1: Connect */}
      {step === 1 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("youtubeDemo.step1Title")}</h2>
          {connectedAccount ? (
            <>
              <p className="text-muted-foreground">{t("youtubeDemo.step1ConnectedDesc")}</p>
              <p className="text-sm font-medium text-green-600">
                {t("youtubeDemo.connectedChannel")}: {connectedAccount.platform_username}
              </p>

              {channelError && (
                <p className="text-sm text-destructive font-mono break-all">{channelError}</p>
              )}

              {channelInfo ? (
                <div className="rounded-md border bg-muted p-4 flex gap-4 items-start">
                  {channelInfo.thumbnail && (
                    <img src={channelInfo.thumbnail} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{channelInfo.title}</p>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {[
                        { label: t("youtubeDemo.subscribers"), value: channelInfo.subscriberCount.toLocaleString() },
                        { label: t("youtubeDemo.videos"), value: channelInfo.videoCount.toLocaleString() },
                        { label: t("youtubeDemo.totalViews"), value: channelInfo.viewCount.toLocaleString() },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded border bg-card px-3 py-2 text-center min-w-[100px]">
                          <p className="text-base font-bold text-foreground">{value}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleFetchChannel}
                  disabled={fetchingChannel}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {fetchingChannel ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" />{t("youtubeDemo.fetching")}</>
                  ) : (
                    t("youtubeDemo.fetchChannelButton")
                  )}
                </button>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="rounded border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  {connecting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" />{t("youtubeDemo.connecting")}</>
                  ) : (
                    t("youtubeDemo.reconnectButton")
                  )}
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t("youtubeDemo.nextStep")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">{t("youtubeDemo.step1NotConnectedDesc")}</p>
              {channelError && (
                <p className="text-sm text-destructive font-mono break-all">{channelError}</p>
              )}
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {connecting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" />{t("youtubeDemo.connecting")}</>
                ) : (
                  t("youtubeDemo.connectButton")
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 2 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("youtubeDemo.step2Title")}</h2>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">{t("youtubeDemo.videoTitle")}</label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="My test video"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">{t("youtubeDemo.videoFile")}</label>
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

          {uploadResult ? (
            <div className="space-y-3">
              <p className="text-sm text-green-600 font-medium">{t("youtubeDemo.uploadSuccess")}</p>
              <p className="text-xs text-muted-foreground font-mono break-all">video_id: {uploadResult.video_id}</p>
              <a
                href={uploadResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline break-all"
              >
                {uploadResult.url}
              </a>
              <button
                onClick={() => setStep(3)}
                className="block rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("youtubeDemo.nextStep")}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="rounded border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {t("youtubeDemo.back")}
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !videoFile || !videoTitle.trim()}
                className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" />{t("youtubeDemo.uploading")}</>
                ) : (
                  t("youtubeDemo.uploadButton")
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Analytics */}
      {step === 3 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t("youtubeDemo.step3Title")}</h2>

          {analyticsError && (
            <p className="text-sm text-destructive font-mono break-all">{analyticsError}</p>
          )}

          {analytics && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {analytics.startDate} — {analytics.endDate}
              </p>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: t("youtubeDemo.views"), value: analytics.views.toLocaleString() },
                  { label: t("youtubeDemo.watchTime"), value: analytics.estimatedMinutesWatched.toLocaleString() },
                  { label: t("youtubeDemo.likes"), value: analytics.likes.toLocaleString() },
                  { label: t("youtubeDemo.comments"), value: analytics.comments.toLocaleString() },
                  { label: t("youtubeDemo.shares"), value: analytics.shares.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-md border bg-muted px-3 py-2 text-center min-w-[110px]">
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="rounded border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {t("youtubeDemo.back")}
            </button>
            <button
              onClick={handleFetchAnalytics}
              disabled={fetchingAnalytics}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {fetchingAnalytics ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" />{t("youtubeDemo.fetching")}</>
              ) : (
                t("youtubeDemo.fetchAnalyticsButton")
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
