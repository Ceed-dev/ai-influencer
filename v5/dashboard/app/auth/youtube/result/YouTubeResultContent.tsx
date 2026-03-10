"use client";

import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Props {
  success?: string;
  account_id?: string;
  username?: string;
  error?: string;
}

export function YouTubeResultContent({ success, account_id, username, error }: Props) {
  const { t } = useTranslation();
  const isSuccess = success === "true";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 shadow-lg text-center">
        {isSuccess ? (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h1 className="text-2xl font-bold text-foreground">
              {t("youtubeAuth.resultSuccess")}
            </h1>
            <p className="text-muted-foreground">
              {t("youtubeAuth.resultSuccessDetail")
                .replace("{account_id}", account_id ?? "")
                .replace("{username}", username ?? "")}
            </p>
            <Link
              href="/demo/youtube"
              className="inline-block text-primary hover:underline text-sm"
            >
              {t("youtubeDemo.backToDemo")}
            </Link>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-16 w-16 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">
              {t("youtubeAuth.resultError")}
            </h1>
            {error && (
              <p className="text-sm text-muted-foreground font-mono break-all">{error}</p>
            )}
            <Link
              href="/demo/youtube"
              className="inline-block text-primary hover:underline text-sm"
            >
              {t("youtubeAuth.resultBackLink")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
