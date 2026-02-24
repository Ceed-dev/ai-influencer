/**
 * system_settings table read utility
 * All config values must be read via this module — no hardcoding.
 * Spec: 02-architecture.md §10, 10-implementation-guide.md §4.7
 *
 * Uses the shared pool from db/pool.ts — no separate pool.
 */
import type { PoolClient } from 'pg';
import { getPool as getDbPool } from '../db/pool.js';

/**
 * Get a setting value from system_settings by key.
 * Returns the raw setting_value (JSONB-stored).
 * Throws if key not found.
 */
export async function getSetting(key: string, client?: PoolClient): Promise<unknown> {
  const q = client || getDbPool();
  const res = await q.query(
    'SELECT setting_value FROM system_settings WHERE setting_key = $1',
    [key]
  );
  if (res.rows.length === 0) {
    throw new Error(`Setting not found: ${key}`);
  }
  return res.rows[0].setting_value;
}

/** Get a setting as number */
export async function getSettingNumber(key: string, client?: PoolClient): Promise<number> {
  const val = await getSetting(key, client);
  return Number(val);
}

/** Get a setting as boolean */
export async function getSettingBoolean(key: string, client?: PoolClient): Promise<boolean> {
  const val = await getSetting(key, client);
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val === 'true';
  return Boolean(val);
}

/** Get a setting as string */
export async function getSettingString(key: string, client?: PoolClient): Promise<string> {
  const val = await getSetting(key, client);
  return String(val);
}

/**
 * Shutdown the connection pool.
 * @deprecated Use closePool() from db/pool.ts instead. Kept for backward compatibility.
 */
export async function closeSettingsPool(): Promise<void> {
  // No-op: pool lifecycle is managed by db/pool.ts
}

/**
 * Get the shared pool.
 * @deprecated Import getPool() from db/pool.ts directly.
 */
export function getSharedPool() {
  return getDbPool();
}
