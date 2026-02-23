import "./globals.css";
import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
