/**
 * FEAT-ALG-013: Data decay — 90-day hard cutoff
 * Spec: 08-algorithm-analysis.md §18 (G16)
 *
 * All batch SQL queries that read historical performance data must include
 * a WHERE clause restricting to the most recent 90 days.
 *
 * This module provides the cutoff constant and a SQL fragment builder
 * for consistent application across all algorithm workers.
 *
 * Verified locations:
 * - weight-recalc.ts line 150: AND ps.created_at > NOW() - INTERVAL '90 days'
 * - adjustment-cache.ts line 34: AND ps.created_at > NOW() - INTERVAL '90 days'
 * - baseline.ts lines 57, 76, 87: AND m.measured_at >= NOW() - INTERVAL '90 days'
 */

/** Hard cutoff in days — data older than this is excluded from all algorithm calculations */
export const DATA_DECAY_CUTOFF_DAYS = 90;

/** SQL fragment for WHERE clause filtering by created_at */
export const DATA_DECAY_SQL_CREATED_AT = `AND created_at > NOW() - INTERVAL '${DATA_DECAY_CUTOFF_DAYS} days'`;

/** SQL fragment for WHERE clause filtering by measured_at */
export const DATA_DECAY_SQL_MEASURED_AT = `AND measured_at >= NOW() - INTERVAL '${DATA_DECAY_CUTOFF_DAYS} days'`;

/**
 * Build a decay cutoff SQL condition for an arbitrary column.
 * Returns a SQL string: `AND {column} > NOW() - INTERVAL '90 days'`
 */
export function buildDecayCutoffSql(column: string): string {
  return `AND ${column} > NOW() - INTERVAL '${DATA_DECAY_CUTOFF_DAYS} days'`;
}

/**
 * Check if a given date is within the decay window (i.e., NOT decayed).
 * Pure function — useful for in-memory filtering.
 */
export function isWithinDecayWindow(date: Date, referenceDate?: Date): boolean {
  const ref = referenceDate ?? new Date();
  const cutoff = new Date(ref.getTime() - DATA_DECAY_CUTOFF_DAYS * 24 * 60 * 60 * 1000);
  return date > cutoff;
}

/**
 * Get the cutoff date (90 days before reference).
 */
export function getDecayCutoffDate(referenceDate?: Date): Date {
  const ref = referenceDate ?? new Date();
  return new Date(ref.getTime() - DATA_DECAY_CUTOFF_DAYS * 24 * 60 * 60 * 1000);
}
