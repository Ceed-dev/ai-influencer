"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
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
        setVideos(data.videos ?? []);
      }
    } catch (err) {
      setFetchError(String(err));
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-10 space-y-8">
      <h1 className="text-2xl font-bold text-foreground">TikTok Demo</h1>

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
              <span
                className={`text-sm ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}
              >
                {label}
              </span>
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
                {uploading ? t("tiktokDemo.uploading") : t("tiktokDemo.uploadButton")}
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

          {videos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {videos.map((v, i) => (
                <div key={v.id ?? v.title ?? `video-${i}`} className="rounded border bg-background p-3 space-y-1">
                  {v.cover_image_url && (
                    <img
                      src={v.cover_image_url}
                      alt={v.title ?? ""}
                      className="w-full h-24 object-cover rounded"
                    />
                  )}
                  <p className="text-xs font-medium truncate">{v.title ?? "(no title)"}</p>
                  <p className="text-xs text-muted-foreground">
                    Views: {v.view_count ?? 0} · Likes: {v.like_count ?? 0}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

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
              {fetching ? t("tiktokDemo.fetching") : t("tiktokDemo.fetchVideosButton")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
