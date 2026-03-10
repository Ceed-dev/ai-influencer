import { YouTubeResultContent } from "./YouTubeResultContent";

export const metadata = {
  title: "YouTube Connection - AI Influencer Dashboard",
};

interface PageProps {
  searchParams: {
    success?: string;
    account_id?: string;
    username?: string;
    error?: string;
  };
}

export default function YouTubeResultPage({ searchParams }: PageProps) {
  return <YouTubeResultContent {...searchParams} />;
}
