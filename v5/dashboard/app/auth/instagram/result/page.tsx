import { InstagramResultContent } from "./InstagramResultContent";

export const metadata = {
  title: "Instagram Connection - AI Influencer Dashboard",
};

interface PageProps {
  searchParams: {
    success?: string;
    account_id?: string;
    username?: string;
    error?: string;
  };
}

export default function InstagramResultPage({ searchParams }: PageProps) {
  return <InstagramResultContent {...searchParams} />;
}
