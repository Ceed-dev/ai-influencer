/**
 * FEAT-TST-009: ベクトル検索 (embedding 生成 → 検索)
 * TEST-INT-009
 *
 * Verifies that vector embeddings can be stored and searched via pgvector.
 * Tests cosine similarity search on the hypotheses table.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

function generateMockEmbedding(seed: number): number[] {
  const embedding = new Array(1536).fill(0);
  for (let i = 0; i < 1536; i++) {
    embedding[i] = Math.sin(seed * (i + 1) * 0.001);
  }
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / norm);
}

describe('FEAT-TST-009: vector search (embedding → search)', () => {
  let client: Client;
  const testCycleNum = 9009;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM hypotheses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number = $1)`, [testCycleNum]);
    await client.query(`DELETE FROM cycles WHERE cycle_number = $1`, [testCycleNum]);
    await client.query(`INSERT INTO cycles (cycle_number, status) VALUES ($1, 'completed')`, [testCycleNum]);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM hypotheses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number = $1)`, [testCycleNum]);
    await client.query(`DELETE FROM cycles WHERE cycle_number = $1`, [testCycleNum]);
    await client.end();
  });

  test('TEST-INT-009: store embedding and perform cosine similarity search', async () => {
    const cycleRes = await client.query(`SELECT id FROM cycles WHERE cycle_number = $1`, [testCycleNum]);
    const cycleId = cycleRes.rows[0].id;

    // Insert hypotheses with embeddings
    const embeddings = [
      { statement: 'Morning posts get more views', seed: 1 },
      { statement: 'Beauty content performs well on TikTok', seed: 2 },
      { statement: 'Evening posts are better for engagement', seed: 1.1 }, // Similar to first
    ];

    for (const h of embeddings) {
      const emb = generateMockEmbedding(h.seed);
      await client.query(
        `INSERT INTO hypotheses (cycle_id, category, statement, verdict, embedding)
         VALUES ($1, 'timing', $2, 'pending', $3::vector)`,
        [cycleId, h.statement, `[${emb.join(',')}]`]
      );
    }

    // Search for similar to "Morning posts" (seed=1)
    const queryEmb = generateMockEmbedding(1);
    const searchRes = await client.query(
      `SELECT statement, 1 - (embedding <=> $1::vector) AS similarity
       FROM hypotheses
       WHERE cycle_id = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 2`,
      [`[${queryEmb.join(',')}]`, cycleId]
    );

    expect(searchRes.rows.length).toBeGreaterThan(0);
    // First result should be the exact match (highest similarity)
    expect(searchRes.rows[0].statement).toBe('Morning posts get more views');
    expect(parseFloat(searchRes.rows[0].similarity)).toBeGreaterThan(0.9);
  });
});
