import "./globals.css";
import type { Metadata } from "next";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { AuthProvider } from "@/components/providers/AuthProvider";

export const metadata: Metadata = {
  title: "AI Influencer Dashboard",
  description: "v5.0 AI Influencer Management Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          <LayoutShell>{children}</LayoutShell>
        </AuthProvider>
      </body>
    </html>
  );
}
