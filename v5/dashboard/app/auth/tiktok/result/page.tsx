import { TikTokResultContent } from "./TikTokResultContent";

export const metadata = {
  title: "TikTok Connection - AI Influencer Dashboard",
};

interface PageProps {
  searchParams: {
    success?: string;
    account_id?: string;
    username?: string;
    error?: string;
  };
}

export default function TikTokResultPage({ searchParams }: PageProps) {
  return <TikTokResultContent {...searchParams} />;
}
