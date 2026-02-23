/**
 * FEAT-TP-005: Platform cooldown enforcement
 * Spec: 04-agent-design.md §4.7, 02-architecture.md §5
 *
 * PLATFORM_COOLDOWN_HOURS (default: 4) — minimum time between posts
 * on the same account+platform combination.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { Platform } from '@/types/database';
import { getSettingNumber } from '../../lib/settings.js';

/** Cooldown check result */
export interface CooldownCheckResult {
  canPost: boolean;
  accountId: string;
  platform: Platform;
  cooldownHours: number;
  lastPostedAt: string | null;
  nextAvailableAt: string | null;
  remainingMinutes: number;
}

/**
 * Calculate when the next post is allowed.
 *
 * @param lastPostedAt - ISO 8601 timestamp of last post
 * @param cooldownHours - Cooldown period in hours
 * @returns ISO 8601 timestamp of when next post is allowed, or null if no previous post
 */
export function calculateNextAvailable(
  lastPostedAt: string | null,
  cooldownHours: number,
): string | null {
  if (!lastPostedAt) return null;
  const lastDate = new Date(lastPostedAt);
  const nextDate = new Date(lastDate.getTime() + cooldownHours * 60 * 60 * 1000);
  return nextDate.toISOString();
}

/**
 * Calculate remaining minutes until cooldown expires.
 */
export function calculateRemainingMinutes(
  nextAvailableAt: string | null,
  now: Date = new Date(),
): number {
  if (!nextAvailableAt) return 0;
  const nextDate = new Date(nextAvailableAt);
  const diffMs = nextDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (60 * 1000)));
}

/**
 * Check if an account can post to a platform based on cooldown rules.
 *
 * @param client - Database client
 * @param accountId - Account identifier
 * @param platform - Target platform
 */
export async function checkPlatformCooldown(
  client: PoolClient,
  accountId: string,
  platform: Platform,
): Promise<CooldownCheckResult> {
  const cooldownHours = await getSettingNumber('PLATFORM_COOLDOWN_HOURS', client);

  // Get most recent post for this account+platform
  const res = await client.query(
    `SELECT posted_at
     FROM publications
     WHERE account_id = $1 AND platform = $2 AND status = 'posted'
     ORDER BY posted_at DESC
     LIMIT 1`,
    [accountId, platform],
  );

  const lastPostedAt = res.rows.length > 0
    ? String((res.rows[0] as Record<string, unknown>)['posted_at'])
    : null;

  const nextAvailableAt = calculateNextAvailable(lastPostedAt, cooldownHours);
  const now = new Date();
  const remainingMinutes = calculateRemainingMinutes(nextAvailableAt, now);
  const canPost = remainingMinutes === 0;

  return {
    canPost,
    accountId,
    platform,
    cooldownHours,
    lastPostedAt,
    nextAvailableAt,
    remainingMinutes,
  };
}

/**
 * Get all accounts that are ready to post (cooldown expired).
 */
export async function getReadyAccounts(
  client: PoolClient,
  platform?: Platform,
): Promise<Array<{ accountId: string; platform: Platform }>> {
  const cooldownHours = await getSettingNumber('PLATFORM_COOLDOWN_HOURS', client);

  let sql = `
    SELECT DISTINCT a.account_id, a.platform
    FROM accounts a
    WHERE a.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM publications p
        WHERE p.account_id = a.account_id
          AND p.platform = a.platform
          AND p.status = 'posted'
          AND p.posted_at > NOW() - make_interval(hours => $1)
      )
  `;
  const params: unknown[] = [cooldownHours];

  if (platform) {
    sql += ` AND a.platform = $2`;
    params.push(platform);
  }

  const res = await client.query(sql, params);
  return res.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      accountId: row['account_id'] as string,
      platform: row['platform'] as Platform,
    };
  });
}
