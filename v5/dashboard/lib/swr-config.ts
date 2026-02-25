/**
 * SWR configuration with auto-refresh from system_settings.
 * DASHBOARD_AUTO_REFRESH_SEC controls the refetch interval.
 */

const DEFAULT_REFRESH_INTERVAL_SEC = 30;

export async function getRefreshInterval(): Promise<number> {
  try {
    const res = await fetch("/api/settings?category=dashboard");
    if (!res.ok) return DEFAULT_REFRESH_INTERVAL_SEC * 1000;
    const data = await res.json();
    const setting = data.settings?.find(
      (s: { key: string }) => s.key === "DASHBOARD_AUTO_REFRESH_SEC"
    );
    return (setting ? parseInt(setting.value, 10) : DEFAULT_REFRESH_INTERVAL_SEC) * 1000;
  } catch {
    return DEFAULT_REFRESH_INTERVAL_SEC * 1000;
  }
}

export const swrConfig = {
  refreshInterval: DEFAULT_REFRESH_INTERVAL_SEC * 1000,
  revalidateOnFocus: true,
  dedupingInterval: 5000,
};

/**
 * Default fetcher for useSWR.
 * Returns parsed JSON; throws on non-OK responses.
 */
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Failed to fetch");
    throw error;
  }
  return res.json();
};
