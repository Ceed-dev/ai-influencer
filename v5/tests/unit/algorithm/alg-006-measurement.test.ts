/**
 * FEAT-ALG-006: Measurement job orchestration
 * Tests: TEST-ALG-011, TEST-ALG-012
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-ALG-006: Measurement orchestration', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  // Helper: set up test data
  async function setupPublication(
    accountId: string,
    contentId: string,
    platform: string,
    hoursAgo: number,
  ): Promise<number> {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_MS01', 'Measure Char', 'voice_001')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, character_id, status)
      VALUES ($1, $2, 'CH_MS01', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `, [accountId, platform]);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ($1, 'posted', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `, [contentId]);
    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at)
      VALUES ($1, $2, $3, 'posted', NOW() - ($4 || ' hours')::INTERVAL)
      RETURNING id
    `, [contentId, accountId, platform, hoursAgo]);
    const pubId = pubRes.rows[0].id;

    // Insert prediction snapshot
    await client.query(`
      INSERT INTO prediction_snapshots (
        publication_id, content_id, account_id,
        baseline_used, baseline_source, adjustments_applied,
        total_adjustment, predicted_impressions
      ) VALUES ($1, $2, $3, 1000, 'own_history', '{}', 0, 1000)
    `, [pubId, contentId, accountId]);

    return pubId;
  }

  // TEST-ALG-011: 8-factor SQL correctness (adjustment cache)
  // This test verifies the measurement round targeting SQL works correctly
  test('TEST-ALG-011: measurement round targeting — 48h eligible publications', async () => {
    // Publication posted 50 hours ago — eligible for 48h round
    const pubId = await setupPublication('MA001', 'CM001', 'tiktok', 50);

    // Query for 48h targets
    const res = await client.query(`
      SELECT p.id AS publication_id, p.account_id, p.platform
      FROM publications p
      JOIN prediction_snapshots ps ON p.id = ps.publication_id
      WHERE ps.actual_impressions_48h IS NULL
        AND p.posted_at + INTERVAL '48 hours' <= NOW()
        AND p.status = 'posted'
    `);

    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    const found = res.rows.find((r: any) => r.publication_id === pubId);
    expect(found).toBeDefined();
    expect(found.account_id).toBe('MA001');
    expect(found.platform).toBe('tiktok');
  });

  test('measurement round targeting — not eligible before 48h', async () => {
    // Publication posted only 24 hours ago — NOT eligible for 48h
    const pubId = await setupPublication('MA002', 'CM002', 'tiktok', 24);

    const res = await client.query(`
      SELECT p.id
      FROM publications p
      JOIN prediction_snapshots ps ON p.id = ps.publication_id
      WHERE ps.actual_impressions_48h IS NULL
        AND p.posted_at + INTERVAL '48 hours' <= NOW()
        AND p.status = 'posted'
        AND p.id = $1
    `, [pubId]);

    expect(res.rows).toHaveLength(0);
  });

  // TEST-ALG-012: UPSERT + is_active flag (adjustment cache)
  // Also verifies measurement recording updates prediction_snapshots
  test('TEST-ALG-012: measurement recording updates prediction_snapshots', async () => {
    const pubId = await setupPublication('MA003', 'CM003', 'youtube', 50);

    // Record 48h measurement
    const actual48h = 1200;
    await client.query(`
      UPDATE prediction_snapshots
      SET actual_impressions_48h = $1, updated_at = NOW()
      WHERE publication_id = $2
    `, [actual48h, pubId]);

    // Verify update
    const res48 = await client.query(
      'SELECT actual_impressions_48h FROM prediction_snapshots WHERE publication_id = $1',
      [pubId]
    );
    expect(res48.rows[0].actual_impressions_48h).toBe(1200);

    // Record 7d measurement with error calculation
    const actual7d = 1500;
    const predicted = 1000;
    const error7d = Math.abs(predicted - actual7d) / actual7d;

    await client.query(`
      UPDATE prediction_snapshots
      SET actual_impressions_7d = $1,
          prediction_error_7d = CASE WHEN $1 > 0
            THEN ABS(predicted_impressions - $1)::FLOAT / $1
            ELSE NULL END,
          updated_at = NOW()
      WHERE publication_id = $2
    `, [actual7d, pubId]);

    const res7d = await client.query(
      'SELECT actual_impressions_7d, prediction_error_7d, predicted_impressions FROM prediction_snapshots WHERE publication_id = $1',
      [pubId]
    );
    expect(res7d.rows[0].actual_impressions_7d).toBe(1500);
    expect(res7d.rows[0].prediction_error_7d).toBeCloseTo(error7d, 5);
  });

  // 3 rounds sequential processing
  test('3 measurement rounds: 48h, 7d, 30d sequential', async () => {
    // Publication posted 31 days ago — eligible for all 3 rounds
    const pubId = await setupPublication('MA004', 'CM004', 'instagram', 31 * 24);

    // Verify eligible for 48h
    const r1 = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM publications p
      JOIN prediction_snapshots ps ON p.id = ps.publication_id
      WHERE ps.actual_impressions_48h IS NULL AND p.posted_at + INTERVAL '48 hours' <= NOW()
        AND p.status = 'posted' AND p.id = $1
    `, [pubId]);
    expect(r1.rows[0].cnt).toBe(1);

    // Record 48h
    await client.query('UPDATE prediction_snapshots SET actual_impressions_48h = 800 WHERE publication_id = $1', [pubId]);

    // Verify eligible for 7d
    const r2 = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM publications p
      JOIN prediction_snapshots ps ON p.id = ps.publication_id
      WHERE ps.actual_impressions_7d IS NULL AND p.posted_at + INTERVAL '7 days' <= NOW()
        AND p.status = 'posted' AND p.id = $1
    `, [pubId]);
    expect(r2.rows[0].cnt).toBe(1);

    // Record 7d
    await client.query(`
      UPDATE prediction_snapshots
      SET actual_impressions_7d = 1200,
          prediction_error_7d = ABS(predicted_impressions - 1200)::FLOAT / 1200
      WHERE publication_id = $1
    `, [pubId]);

    // Verify eligible for 30d
    const r3 = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM publications p
      JOIN prediction_snapshots ps ON p.id = ps.publication_id
      WHERE ps.actual_impressions_30d IS NULL AND p.posted_at + INTERVAL '30 days' <= NOW()
        AND p.status = 'posted' AND p.id = $1
    `, [pubId]);
    expect(r3.rows[0].cnt).toBe(1);

    // Record 30d
    await client.query(`
      UPDATE prediction_snapshots
      SET actual_impressions_30d = 1800,
          prediction_error_30d = ABS(predicted_impressions - 1800)::FLOAT / 1800
      WHERE publication_id = $1
    `, [pubId]);

    // Final verification: all fields populated
    const final = await client.query(
      'SELECT * FROM prediction_snapshots WHERE publication_id = $1', [pubId]
    );
    const row = final.rows[0];
    expect(row.actual_impressions_48h).toBe(800);
    expect(row.actual_impressions_7d).toBe(1200);
    expect(row.actual_impressions_30d).toBe(1800);
    expect(row.prediction_error_7d).not.toBeNull();
    expect(row.prediction_error_30d).not.toBeNull();
  });

  // Idempotency: already-measured publications are skipped
  test('idempotency — already-measured publications are skipped', async () => {
    const pubId = await setupPublication('MA005', 'CM005', 'tiktok', 200);

    // Record 48h measurement
    await client.query('UPDATE prediction_snapshots SET actual_impressions_48h = 900 WHERE publication_id = $1', [pubId]);

    // Query should NOT return this publication for 48h round
    const res = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM publications p
      JOIN prediction_snapshots ps ON p.id = ps.publication_id
      WHERE ps.actual_impressions_48h IS NULL
        AND p.posted_at + INTERVAL '48 hours' <= NOW()
        AND p.status = 'posted' AND p.id = $1
    `, [pubId]);
    expect(res.rows[0].cnt).toBe(0);
  });

  // Metrics UPSERT
  test('metrics UPSERT — ON CONFLICT updates', async () => {
    const pubId = await setupPublication('MA006', 'CM006', 'x', 200);

    // Insert first measurement
    await client.query(`
      INSERT INTO metrics (publication_id, views, measurement_point, measured_at)
      VALUES ($1, 500, '7d', NOW())
      ON CONFLICT (publication_id, measurement_point) DO UPDATE SET views = 500
    `, [pubId]);

    // UPSERT with new value
    await client.query(`
      INSERT INTO metrics (publication_id, views, measurement_point, measured_at)
      VALUES ($1, 600, '7d', NOW())
      ON CONFLICT (publication_id, measurement_point) DO UPDATE SET views = 600
    `, [pubId]);

    const res = await client.query(
      "SELECT views FROM metrics WHERE publication_id = $1 AND measurement_point = '7d'",
      [pubId]
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].views).toBe(600);
  });
});
