/**
 * Posting Scheduler — FEAT-TP-001, FEAT-TP-002, FEAT-TP-005
 * Spec: 04-agent-design.md §5.3, 10-implementation-guide.md §6.5
 *
 * Polls task_queue for publish tasks and executes them with:
 * - Time jitter (POSTING_TIME_JITTER_MIN)
 * - Daily post limit (MAX_POSTS_PER_ACCOUNT_PER_DAY)
 * - Platform cooldown (PLATFORM_COOLDOWN_HOURS)
 * - Platform routing to correct adapter
 */
import type { Platform } from '@/types/database';
import { getPool } from '../../db/pool';
import { getSettingNumber } from '../../lib/settings';

/** Result of jitter calculation */
export interface JitterResult {
  /** Jitter offset in milliseconds (can be positive or negative) */
  jitterMs: number;
  /** Scheduled time with jitter applied */
  scheduledWithJitter: Date;
}

/**
 * Calculate a random jitter offset within ±POSTING_TIME_JITTER_MIN minutes.
 * The jitter uniformly distributes actual posting time around the scheduled time.
 *
 * @param scheduledTime - The originally scheduled posting time
 * @param jitterMinutes - Max jitter range in minutes (from system_settings)
 * @returns JitterResult with the offset and adjusted time
 */
export function calculateJitter(scheduledTime: Date, jitterMinutes: number): JitterResult {
  // Random value between -jitterMinutes and +jitterMinutes
  const jitterMs = Math.round((Math.random() * 2 - 1) * jitterMinutes * 60 * 1000) || 0;
  const scheduledWithJitter = new Date(scheduledTime.getTime() + jitterMs);
  return { jitterMs, scheduledWithJitter };
}

/**
 * Apply posting time jitter to a scheduled time using POSTING_TIME_JITTER_MIN
 * from system_settings.
 *
 * @param scheduledTime - The originally scheduled posting time
 * @returns The jitter-adjusted time and the offset applied
 */
export async function applyPostingJitter(scheduledTime: Date): Promise<JitterResult> {
  const jitterMinutes = await getSettingNumber('POSTING_TIME_JITTER_MIN');
  return calculateJitter(scheduledTime, jitterMinutes);
}

/**
 * Check if an account has reached its daily post limit.
 *
 * @param accountId - The account to check
 * @param platform - The platform to check
 * @returns Object with limitReached flag and current count
 */
export async function checkDailyPostLimit(
  accountId: string,
  platform: Platform,
): Promise<{ limitReached: boolean; currentCount: number; maxPosts: number }> {
  const pool = getPool();
  const maxPosts = await getSettingNumber('MAX_POSTS_PER_ACCOUNT_PER_DAY');

  const result = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM publications
     WHERE account_id = $1
       AND platform = $2
       AND posted_at >= CURRENT_DATE
       AND posted_at < CURRENT_DATE + INTERVAL '1 day'
       AND status IN ('posted', 'measured')`,
    [accountId, platform],
  );

  const currentCount = result.rows[0]?.cnt ?? 0;
  return {
    limitReached: currentCount >= maxPosts,
    currentCount,
    maxPosts,
  };
}

/**
 * Check if a platform cooldown period has elapsed since the last post.
 *
 * @param accountId - The account to check
 * @param platform - The platform to check
 * @returns Object with cooldownActive flag and remaining hours
 */
export async function checkPlatformCooldown(
  accountId: string,
  platform: Platform,
): Promise<{ cooldownActive: boolean; remainingHours: number; lastPostedAt: Date | null }> {
  const pool = getPool();
  const cooldownHours = await getSettingNumber('PLATFORM_COOLDOWN_HOURS');

  const result = await pool.query(
    `SELECT MAX(posted_at) AS last_posted
     FROM publications
     WHERE account_id = $1
       AND platform = $2
       AND status IN ('posted', 'measured')`,
    [accountId, platform],
  );

  const lastPostedAt = result.rows[0]?.last_posted
    ? new Date(result.rows[0].last_posted as string)
    : null;

  if (!lastPostedAt) {
    return { cooldownActive: false, remainingHours: 0, lastPostedAt: null };
  }

  const hoursSinceLastPost =
    (Date.now() - lastPostedAt.getTime()) / (1000 * 60 * 60);
  const cooldownActive = hoursSinceLastPost < cooldownHours;
  const remainingHours = cooldownActive
    ? cooldownHours - hoursSinceLastPost
    : 0;

  return { cooldownActive, remainingHours, lastPostedAt };
}

/**
 * Route a publish task to the correct platform adapter.
 *
 * @param platform - Target platform
 * @returns The adapter module name for the platform
 */
export function routeToPlatformAdapter(
  platform: Platform,
): 'youtube' | 'tiktok' | 'instagram' | 'x' {
  const adapterMap: Record<Platform, 'youtube' | 'tiktok' | 'instagram' | 'x'> = {
    youtube: 'youtube',
    tiktok: 'tiktok',
    instagram: 'instagram',
    x: 'x',
  };

  const adapter = adapterMap[platform];
  if (!adapter) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return adapter;
}
