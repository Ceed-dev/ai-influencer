/**
 * MCP Server DB connection layer
 * Re-exports the shared pool for use by all MCP tools.
 */
import { getPool, closePool, withClient, withTransaction } from '../db/pool';
import type { Pool, PoolClient } from 'pg';

export { getPool, closePool, withClient, withTransaction };
export type { Pool, PoolClient };
