import "./globals.css";
import type { Metadata, Viewport } from "next";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: {
    default: "AI Influencer Dashboard",
    template: "%s | AI Influencer",
  },
  description: "v5.0 AI Influencer Management Dashboard",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "AI Influencer",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#002b36",
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
