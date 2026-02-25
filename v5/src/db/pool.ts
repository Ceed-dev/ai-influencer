/**
 * FEAT-INF-005: DB connection pool + health check
 * Spec: 01-tech-stack.md §データアクセス, 10-implementation-guide.md §4.4
 *
 * Provides centralized Pool management with:
 * - Configurable pool options (max, idle timeout, connect timeout)
 * - Health check via SELECT 1
 * - Graceful shutdown
 */
import { Pool, type PoolClient } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'] || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

export interface PoolConfig {
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  application_name?: string;
}

const DEFAULT_CONFIG: Required<PoolConfig> = {
  connectionString: DATABASE_URL,
  max: Number(process.env['DB_POOL_MAX']) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env['DB_CONNECTION_TIMEOUT_MS']) || 2000,
  application_name: 'ai-influencer-v5',
};

let sharedPool: Pool | null = null;

/**
 * Create a new Pool with merged config.
 */
export function createPool(config?: PoolConfig): Pool {
  const merged = { ...DEFAULT_CONFIG, ...config };
  return new Pool(merged);
}

/**
 * Get or create the shared singleton pool.
 */
export function getPool(config?: PoolConfig): Pool {
  if (!sharedPool) {
    sharedPool = createPool(config);
  }
  return sharedPool;
}

/**
 * Health check: execute SELECT 1 against the pool.
 * Returns true if healthy, false otherwise.
 */
export async function healthCheck(pool?: Pool): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const db = pool || getPool();
  const start = Date.now();
  let client: PoolClient | null = null;
  try {
    client = await db.connect();
    const res = await client.query('SELECT 1 AS ok');
    const latencyMs = Date.now() - start;
    return {
      healthy: res.rows[0]?.ok === 1,
      latencyMs,
    };
  } catch (err: any) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: err.message || String(err),
    };
  } finally {
    if (client) client.release();
  }
}

/**
 * Pool statistics for monitoring.
 */
export function poolStats(pool?: Pool): {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
} {
  const db = pool || getPool();
  return {
    totalCount: db.totalCount,
    idleCount: db.idleCount,
    waitingCount: db.waitingCount,
  };
}

/**
 * Graceful shutdown of the shared pool.
 */
export async function closePool(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}

/**
 * Execute a function within a client from the pool.
 * Automatically releases the client when done.
 */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
  pool?: Pool,
): Promise<T> {
  const db = pool || getPool();
  const client = await db.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Execute a function within a transaction.
 * Automatically commits on success, rolls back on error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  pool?: Pool,
): Promise<T> {
  const db = pool || getPool();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
