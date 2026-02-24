/**
 * Batch Job Orchestrator
 * Spec: 08-algorithm-analysis.md
 *
 * Schedules and runs all 5 algorithm batch jobs on their specified schedules:
 *   1. Baseline Update         — Daily UTC 01:00
 *   2. Adjustment Cache Update — Tier-based UTC 02:00
 *   3. Weight Recalculation    — Tier-based UTC 03:00
 *   4. KPI Snapshot            — Monthly, 1st of month UTC 04:00
 *   5. Embedding Batch         — Every 6 hours (UTC 00:00, 06:00, 12:00, 18:00)
 *
 * Tier Logic (based on total metrics count):
 *   Tier 1 (0-500):    Weekly, Monday only
 *   Tier 2 (500-5K):   Every 3 days (Mon, Thu)
 *   Tier 3 (5K-50K):   Daily
 *   Tier 4 (50K+):     Every 12 hours (UTC 02:00/03:00 + 14:00/15:00)
 *
 * Uses native Node.js setInterval — no external dependencies.
 */
import { getSharedPool } from '../lib/settings.js';
import { runBaselineUpdate } from './algorithm/baseline.js';
import { runAdjustmentCacheUpdate } from './algorithm/adjustment-cache.js';
import { runWeightRecalculation } from './algorithm/weight-recalc.js';
import { runKpiSnapshotGeneration } from './algorithm/kpi-snapshot.js';
import { runEmbeddingBatchRegeneration } from './algorithm/embedding-batch.js';
import type { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TierInfo {
  tier: 1 | 2 | 3 | 4;
  metricsCount: number;
}

interface JobExecution {
  jobName: string;
  startedAt: Date;
  durationMs: number;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tier Determination
// ---------------------------------------------------------------------------

/**
 * Query the total metrics count from the DB and return the current tier.
 *
 * Tier thresholds (spec 08-algorithm-analysis.md):
 *   Tier 1: 0 - 500
 *   Tier 2: 500 - 5,000
 *   Tier 3: 5,000 - 50,000
 *   Tier 4: 50,000+
 */
export async function determineTier(pool?: Pool): Promise<TierInfo> {
  const db = pool ?? getSharedPool();
  const res = await db.query('SELECT COUNT(*)::int AS cnt FROM metrics');
  const metricsCount: number = res.rows[0]?.cnt ?? 0;

  if (metricsCount >= 50_000) return { tier: 4, metricsCount };
  if (metricsCount >= 5_000) return { tier: 3, metricsCount };
  if (metricsCount >= 500) return { tier: 2, metricsCount };
  return { tier: 1, metricsCount };
}

// ---------------------------------------------------------------------------
// Schedule Helpers
// ---------------------------------------------------------------------------

/** Days of week: 0=Sunday, 1=Monday, ... 6=Saturday */
const MONDAY = 1;
const THURSDAY = 4;

/**
 * Check whether a tier-based job should run at the given UTC time.
 *
 * @param tier       Current data tier (1-4)
 * @param utcHour    The primary hour (e.g. 2 for adjustment cache, 3 for weight recalc)
 * @param nowHour    Current UTC hour
 * @param nowMinute  Current UTC minute
 * @param nowDay     Current UTC day of week (0=Sun)
 */
function shouldRunTierJob(
  tier: TierInfo['tier'],
  utcHour: number,
  nowHour: number,
  nowMinute: number,
  nowDay: number,
): boolean {
  // Minute must be 0 (we check once per minute, so 0 is the trigger minute)
  if (nowMinute !== 0) return false;

  switch (tier) {
    case 1:
      // Weekly, Monday only at utcHour
      return nowDay === MONDAY && nowHour === utcHour;
    case 2:
      // Every 3 days: Monday and Thursday at utcHour
      return (nowDay === MONDAY || nowDay === THURSDAY) && nowHour === utcHour;
    case 3:
      // Daily at utcHour
      return nowHour === utcHour;
    case 4:
      // Every 12 hours: utcHour and utcHour+12
      return nowHour === utcHour || nowHour === (utcHour + 12);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Job Execution Wrapper
// ---------------------------------------------------------------------------

/**
 * Execute a batch job with logging and error protection.
 * Never throws — logs errors and returns execution result.
 */
async function executeJob(
  jobName: string,
  fn: () => Promise<unknown>,
): Promise<JobExecution> {
  const startedAt = new Date();
  console.log(`[batch-orchestrator] [${jobName}] Starting at ${startedAt.toISOString()}`);

  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt.getTime();
    console.log(
      `[batch-orchestrator] [${jobName}] Completed in ${durationMs}ms. Result: ${JSON.stringify(result)}`,
    );
    return { jobName, startedAt, durationMs, success: true };
  } catch (err) {
    const durationMs = Date.now() - startedAt.getTime();
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[batch-orchestrator] [${jobName}] Failed after ${durationMs}ms: ${errorMsg}`,
    );
    return { jobName, startedAt, durationMs, success: false, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// Schedule Check (runs every minute)
// ---------------------------------------------------------------------------

/** Track last execution times to prevent double-runs within the same minute */
const lastRunTimestamps: Record<string, string> = {};

/**
 * Generate a dedup key from the current UTC date/time and job name.
 * Format: "YYYY-MM-DD HH:00 jobName"
 */
function dedupKey(jobName: string, now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:00 ${jobName}`;
}

/**
 * Core schedule check. Called every minute by the interval timer.
 * Evaluates each job's schedule and fires it if conditions are met.
 */
async function checkSchedule(pool?: Pool): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcDay = now.getUTCDay(); // 0=Sunday
  const utcDate = now.getUTCDate(); // 1-31

  // --- 1. Baseline Update: Daily UTC 01:00 ---
  if (utcHour === 1 && utcMinute === 0) {
    const key = dedupKey('baseline', now);
    if (lastRunTimestamps['baseline'] !== key) {
      lastRunTimestamps['baseline'] = key;
      executeJob('baseline-update', () => runBaselineUpdate(pool)).catch(() => {/* already logged in executeJob */});
    }
  }

  // --- 2 & 3. Tier-based jobs: Adjustment Cache (02:00) & Weight Recalc (03:00) ---
  // Only resolve tier when one of these jobs might run (hours 2, 3, 14, 15 and minute 0)
  if (
    utcMinute === 0 &&
    (utcHour === 2 || utcHour === 3 || utcHour === 14 || utcHour === 15)
  ) {
    let tierInfo: TierInfo;
    try {
      tierInfo = await determineTier(pool);
    } catch (err) {
      console.error(
        `[batch-orchestrator] Failed to determine tier: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    // Adjustment Cache: primary hour = 2
    if (shouldRunTierJob(tierInfo.tier, 2, utcHour, utcMinute, utcDay)) {
      const key = dedupKey('adjustment-cache', now);
      if (lastRunTimestamps['adjustment-cache'] !== key) {
        lastRunTimestamps['adjustment-cache'] = key;
        executeJob('adjustment-cache-update', () => runAdjustmentCacheUpdate(pool)).catch(() => {/* already logged in executeJob */});
      }
    }

    // Weight Recalculation: primary hour = 3
    if (shouldRunTierJob(tierInfo.tier, 3, utcHour, utcMinute, utcDay)) {
      const key = dedupKey('weight-recalc', now);
      if (lastRunTimestamps['weight-recalc'] !== key) {
        lastRunTimestamps['weight-recalc'] = key;
        executeJob('weight-recalculation', () => runWeightRecalculation(pool)).catch(() => {/* already logged in executeJob */});
      }
    }
  }

  // --- 4. KPI Snapshot: Monthly, 1st of month UTC 04:00 ---
  if (utcDate === 1 && utcHour === 4 && utcMinute === 0) {
    const key = dedupKey('kpi-snapshot', now);
    if (lastRunTimestamps['kpi-snapshot'] !== key) {
      lastRunTimestamps['kpi-snapshot'] = key;
      // Generate snapshot for the previous month (runKpiSnapshotGeneration defaults to prev month)
      executeJob('kpi-snapshot', () => runKpiSnapshotGeneration(undefined, pool)).catch(() => {/* already logged in executeJob */});
    }
  }

  // --- 5. Embedding Batch: Every 6 hours (UTC 00, 06, 12, 18) ---
  if (utcMinute === 0 && (utcHour % 6 === 0)) {
    const key = dedupKey('embedding-batch', now);
    if (lastRunTimestamps['embedding-batch'] !== key) {
      lastRunTimestamps['embedding-batch'] = key;
      executeJob('embedding-batch', () => runEmbeddingBatchRegeneration(pool)).catch(() => {/* already logged in executeJob */});
    }
  }
}

// ---------------------------------------------------------------------------
// Orchestrator Lifecycle
// ---------------------------------------------------------------------------

/** The interval timer handle — null when not running */
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/** Pool reference passed at start time */
let orchestratorPool: Pool | undefined;

/**
 * Start the batch orchestrator.
 * Runs a schedule check every 60 seconds (aligned to the start of each minute).
 */
export function startBatchOrchestrator(pool?: Pool): void {
  if (schedulerInterval !== null) {
    console.warn('[batch-orchestrator] Already running. Call stopBatchOrchestrator() first.');
    return;
  }

  orchestratorPool = pool;

  console.log('[batch-orchestrator] Starting batch job orchestrator...');
  console.log('[batch-orchestrator] Schedule:');
  console.log('[batch-orchestrator]   Baseline Update         — Daily UTC 01:00');
  console.log('[batch-orchestrator]   Adjustment Cache Update — Tier-based UTC 02:00 (+14:00 for Tier 4)');
  console.log('[batch-orchestrator]   Weight Recalculation    — Tier-based UTC 03:00 (+15:00 for Tier 4)');
  console.log('[batch-orchestrator]   KPI Snapshot            — Monthly, 1st UTC 04:00');
  console.log('[batch-orchestrator]   Embedding Batch         — Every 6h (UTC 00/06/12/18)');

  // Calculate delay to align with the next full minute
  const now = Date.now();
  const msUntilNextMinute = 60_000 - (now % 60_000);

  // Run the first check at the next full minute, then every 60 seconds
  const initialTimeout = setTimeout(() => {
    checkSchedule(orchestratorPool).catch((err) => {
      console.error(`[batch-orchestrator] Initial schedule check failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    schedulerInterval = setInterval(() => {
      checkSchedule(orchestratorPool).catch((err) => {
        console.error(`[batch-orchestrator] Schedule check failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, 60_000);
  }, msUntilNextMinute);

  // Store the initial timeout for cleanup. clearTimeout works on both timeout and interval handles in Node.js.
  schedulerInterval = initialTimeout as ReturnType<typeof setInterval>;

  console.log(
    `[batch-orchestrator] Scheduler started. First check in ${Math.round(msUntilNextMinute / 1000)}s.`,
  );
}

/**
 * Gracefully stop the batch orchestrator.
 * Clears all timers. Running jobs will complete but no new jobs will be triggered.
 */
export function stopBatchOrchestrator(): void {
  if (schedulerInterval !== null) {
    clearInterval(schedulerInterval);
    clearTimeout(schedulerInterval);
    schedulerInterval = null;
    orchestratorPool = undefined;
    console.log('[batch-orchestrator] Scheduler stopped.');
  } else {
    console.log('[batch-orchestrator] Scheduler was not running.');
  }
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

if (require.main === module) {
  console.log('Starting batch orchestrator in standalone mode...');
  startBatchOrchestrator();

  // Keep process alive
  process.on('SIGINT', () => {
    stopBatchOrchestrator();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopBatchOrchestrator();
    process.exit(0);
  });
}
