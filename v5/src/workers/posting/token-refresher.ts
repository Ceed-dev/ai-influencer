/**
 * OAuth Token Refresher — manages token refresh lifecycle for all 4 platform adapters
 * Spec: 04-agent-design.md §4.7
 *
 * Periodically checks for accounts with expiring OAuth tokens and refreshes them
 * via the appropriate platform adapter (YouTube, TikTok, Instagram, X).
 *
 * Settings from system_settings:
 * - TOKEN_REFRESH_BUFFER_HOURS (default 2) — how far ahead to look for expiring tokens
 * - TOKEN_REFRESH_INTERVAL_SEC (default 3600) — polling interval in seconds
 */
import type { Platform } from '@/types/database';
import { getPool } from '../../db/pool.js';
import { getSettingNumber } from '../../lib/settings.js';
import { YouTubeAdapter } from './adapters/youtube.js';
import { TikTokAdapter } from './adapters/tiktok.js';
import { InstagramAdapter } from './adapters/instagram.js';
import { XAdapter } from './adapters/x.js';
import type { PlatformAdapter } from './adapters/types.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** Row returned from the expired-tokens query */
export interface ExpiredTokenRow {
  account_id: string;
  platform: Platform;
  auth_credentials: {
    oauth_access_token?: string;
    oauth_refresh_token?: string;
    oauth_token_expires_at?: string;
  } | null;
}

/** Result of a single token refresh attempt */
export interface TokenRefreshResult {
  account_id: string;
  platform: Platform;
  success: boolean;
  error?: string;
}

/** Summary of a full refresh cycle */
export interface RefreshCycleSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: TokenRefreshResult[];
  startedAt: string;
  completedAt: string;
}

// ── Adapter registry ─────────────────────────────────────────────────────────

const adapterRegistry: Record<Platform, PlatformAdapter> = {
  youtube: new YouTubeAdapter(),
  tiktok: new TikTokAdapter(),
  instagram: new InstagramAdapter(),
  x: new XAdapter(),
};

/**
 * Get the platform adapter for a given platform.
 */
function getAdapterForPlatform(platform: Platform): PlatformAdapter {
  const adapter = adapterRegistry[platform];
  if (!adapter) {
    throw new Error(`No adapter registered for platform: ${platform}`);
  }
  return adapter;
}

// ── Core functions ───────────────────────────────────────────────────────────

/**
 * Query accounts with OAuth tokens expiring within TOKEN_REFRESH_BUFFER_HOURS.
 *
 * Finds active accounts where:
 * - oauth_refresh_token is present (can actually refresh)
 * - oauth_token_expires_at is set and within the buffer window
 *
 * @returns Array of accounts needing token refresh
 */
export async function getExpiredTokens(): Promise<ExpiredTokenRow[]> {
  const pool = getPool();
  const bufferHours = await getSettingNumber('TOKEN_REFRESH_BUFFER_HOURS');

  const result = await pool.query<ExpiredTokenRow>(
    `SELECT account_id, platform, auth_credentials
     FROM accounts
     WHERE status = 'active'
       AND auth_credentials IS NOT NULL
       AND auth_credentials->>'oauth_refresh_token' IS NOT NULL
       AND (auth_credentials->>'oauth_token_expires_at')::timestamptz < NOW() + make_interval(hours => $1)`,
    [bufferHours],
  );

  return result.rows;
}

/**
 * Refresh the OAuth token for a single account by delegating to the
 * appropriate platform adapter's refreshToken method.
 *
 * On success the adapter is responsible for updating the accounts table
 * with the new access_token and expires_at values.
 *
 * @param account - The account row with expiring token
 * @returns Result indicating success or failure with error detail
 */
export async function refreshTokenForAccount(
  account: ExpiredTokenRow,
): Promise<TokenRefreshResult> {
  const { account_id, platform } = account;

  try {
    const adapter = getAdapterForPlatform(platform);
    const success = await adapter.refreshToken(account_id);

    if (!success) {
      return {
        account_id,
        platform,
        success: false,
        error: `Adapter returned false for ${platform} refresh`,
      };
    }

    return { account_id, platform, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      account_id,
      platform,
      success: false,
      error: message,
    };
  }
}

/**
 * Run a single token-refresh cycle:
 * 1. Fetch all accounts with tokens expiring soon
 * 2. Refresh each one via the platform adapter
 * 3. Collect and return summary results
 *
 * Designed to be called from a scheduler or invoked directly.
 */
export async function runTokenRefreshCycle(): Promise<RefreshCycleSummary> {
  const startedAt = new Date().toISOString();

  const expiredTokens = await getExpiredTokens();
  const results: TokenRefreshResult[] = [];

  for (const account of expiredTokens) {
    const result = await refreshTokenForAccount(account);
    results.push(result);
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  const summary: RefreshCycleSummary = {
    total: results.length,
    succeeded,
    failed,
    results,
    startedAt,
    completedAt: new Date().toISOString(),
  };

  if (summary.total > 0) {
    console.log(
      `[token-refresher] cycle complete: ${succeeded}/${summary.total} succeeded, ${failed} failed`,
    );
  }

  if (failed > 0) {
    for (const r of results.filter((r) => !r.success)) {
      console.warn(
        `[token-refresher] FAILED ${r.platform}/${r.account_id}: ${r.error}`,
      );
    }
  }

  return summary;
}

// ── Scheduler ────────────────────────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let schedulerRunning = false;

/**
 * Start a polling loop that runs runTokenRefreshCycle at
 * TOKEN_REFRESH_INTERVAL_SEC intervals (from system_settings, default 3600s).
 *
 * Only one scheduler instance runs at a time; calling this again is a no-op.
 * Use stopTokenRefreshScheduler() for graceful shutdown.
 */
export async function startTokenRefreshScheduler(): Promise<void> {
  if (schedulerRunning) {
    console.log('[token-refresher] scheduler already running — skipping start');
    return;
  }

  schedulerRunning = true;
  console.log('[token-refresher] scheduler starting');

  const scheduleNext = async (): Promise<void> => {
    if (!schedulerRunning) return;

    try {
      await runTokenRefreshCycle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[token-refresher] cycle error: ${message}`);
    }

    if (!schedulerRunning) return;

    // Re-read interval each cycle so it can be tuned at runtime
    let intervalSec: number;
    try {
      intervalSec = await getSettingNumber('TOKEN_REFRESH_INTERVAL_SEC');
    } catch {
      intervalSec = 3600; // default 1 hour
    }

    schedulerTimer = setTimeout(() => {
      scheduleNext().catch((err) => {
        console.error(`[token-refresher] Schedule cycle failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, intervalSec * 1000);
  };

  // Kick off the first cycle immediately
  scheduleNext().catch((err) => {
    console.error(`[token-refresher] Initial schedule cycle failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}

/**
 * Stop the token refresh scheduler gracefully.
 */
export function stopTokenRefreshScheduler(): void {
  schedulerRunning = false;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  console.log('[token-refresher] scheduler stopped');
}
