/**
 * FEAT-ALG-014: Embedding batch regeneration
 * Spec: 08-algorithm-analysis.md §pgvector
 *
 * Batch regenerates embedding vectors across 5 tables:
 * 1. learnings        — text source: insight
 * 2. market_intel      — text source: JSON.stringify(data)
 * 3. agent_individual_learnings — text source: content
 * 4. content_learnings — text source: key_insight
 * 5. components        — text source: name + description
 *
 * Processing: 100 rows per transaction batch.
 * Uses placeholder embedding generator (OpenAI ada-002 in production).
 */
import { getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

/** Embedding dimension (OpenAI text-embedding-3-small) */
const EMBEDDING_DIM = 1536;

/** Default batch size */
const DEFAULT_BATCH_SIZE = 100;

/** Cached API key (loaded once from system_settings) */
let cachedApiKey: string | null | undefined;

/**
 * Generate an embedding vector from text.
 * Uses OpenAI text-embedding-3-small when CRED_OPENAI_API_KEY is configured.
 * Falls back to zero vector when API key is unavailable (development mode).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Lazy-load API key from system_settings
  if (cachedApiKey === undefined) {
    try {
      const pool = getSharedPool();
      const res = await pool.query(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'CRED_OPENAI_API_KEY'`,
      );
      cachedApiKey = (res.rows[0]?.setting_value as string) || null;
    } catch {
      cachedApiKey = null;
    }
  }

  if (!cachedApiKey || !text.trim()) {
    return new Array(EMBEDDING_DIM).fill(0);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cachedApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // Limit input to avoid token overflow
        dimensions: EMBEDDING_DIM,
      }),
    });

    if (!response.ok) {
      console.error(`[embedding] OpenAI API error: ${response.status} ${response.statusText}`);
      return new Array(EMBEDDING_DIM).fill(0);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0]?.embedding ?? new Array(EMBEDDING_DIM).fill(0);
  } catch (err) {
    console.error(`[embedding] Failed to generate embedding: ${err instanceof Error ? err.message : String(err)}`);
    return new Array(EMBEDDING_DIM).fill(0);
  }
}

/** Reset cached API key (for testing) */
export function resetEmbeddingCache(): void {
  cachedApiKey = undefined;
}

interface EmbeddingTableConfig {
  tableName: string;
  idColumn: string;
  textSourceFn: (row: Record<string, unknown>) => string;
  selectColumns: string[];
}

/**
 * Configuration for the 5 tables that have embedding columns.
 */
export const EMBEDDING_TABLES: EmbeddingTableConfig[] = [
  {
    tableName: 'learnings',
    idColumn: 'id',
    textSourceFn: (row) => String(row['insight'] ?? ''),
    selectColumns: ['id', 'insight'],
  },
  {
    tableName: 'market_intel',
    idColumn: 'id',
    textSourceFn: (row) => {
      const data = row['data'];
      return typeof data === 'string' ? data : JSON.stringify(data ?? {});
    },
    selectColumns: ['id', 'data'],
  },
  {
    tableName: 'agent_individual_learnings',
    idColumn: 'id',
    textSourceFn: (row) => String(row['content'] ?? ''),
    selectColumns: ['id', 'content'],
  },
  {
    tableName: 'content_learnings',
    idColumn: 'id',
    textSourceFn: (row) => String(row['key_insight'] ?? ''),
    selectColumns: ['id', 'key_insight'],
  },
  {
    tableName: 'components',
    idColumn: 'id',
    textSourceFn: (row) => {
      const name = String(row['name'] ?? '');
      const description = String(row['description'] ?? '');
      return `${name} ${description}`.trim();
    },
    selectColumns: ['id', 'name', 'description'],
  },
];

interface BatchResult {
  tableName: string;
  processed: number;
  errors: number;
}

/**
 * Regenerate embeddings for a single table in batches of batchSize rows.
 * Only processes rows where embedding IS NULL.
 */
export async function regenerateTableEmbeddings(
  client: PoolClient,
  config: EmbeddingTableConfig,
  batchSize: number,
): Promise<BatchResult> {
  let processed = 0;
  let errors = 0;
  let hasMore = true;

  while (hasMore) {
    const columns = config.selectColumns.join(', ');
    const res = await client.query(
      `SELECT ${columns} FROM ${config.tableName} WHERE embedding IS NULL LIMIT $1`,
      [batchSize],
    );

    if (res.rows.length === 0) {
      hasMore = false;
      break;
    }

    // Process in a savepoint (100-row transaction)
    await client.query('SAVEPOINT embedding_batch');
    try {
      for (const row of res.rows) {
        const typedRow = row as Record<string, unknown>;
        const text = config.textSourceFn(typedRow);
        if (text.length === 0) {
          errors++;
          continue;
        }

        const embedding = await generateEmbedding(text);
        const embeddingStr = `[${embedding.join(',')}]`;

        await client.query(
          `UPDATE ${config.tableName} SET embedding = $1::vector WHERE ${config.idColumn} = $2`,
          [embeddingStr, typedRow[config.idColumn]],
        );
        processed++;
      }
      await client.query('RELEASE SAVEPOINT embedding_batch');
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT embedding_batch');
      errors += res.rows.length;
    }

    // If we got fewer than batchSize, no more rows
    if (res.rows.length < batchSize) {
      hasMore = false;
    }
  }

  return { tableName: config.tableName, processed, errors };
}

/**
 * Run embedding regeneration across all 5 tables.
 */
export async function runEmbeddingBatchRegeneration(
  pool?: Pool,
  batchSize?: number,
): Promise<BatchResult[]> {
  const db = pool ?? getSharedPool();
  const client = await db.connect();
  const size = batchSize ?? DEFAULT_BATCH_SIZE;
  const results: BatchResult[] = [];

  try {
    await client.query('BEGIN');
    for (const config of EMBEDDING_TABLES) {
      const result = await regenerateTableEmbeddings(client, config, size);
      results.push(result);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return results;
}

/** CLI entry point */
if (require.main === module) {
  (async () => {
    console.log('Running embedding batch regeneration...');
    const results = await runEmbeddingBatchRegeneration();
    for (const r of results) {
      console.log(`  ${r.tableName}: ${r.processed} processed, ${r.errors} errors`);
    }
    await closeSettingsPool();
  })().catch((err) => {
    console.error('Embedding batch regeneration failed:', err);
    process.exit(1);
  });
}
