import "./globals.css";
import type { Metadata } from "next";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { LanguageProvider } from "@/lib/i18n";

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <LayoutShell>{children}</LayoutShell>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
