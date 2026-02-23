/**
 * FEAT-ALG-010: Prediction error calculation
 * Tests: TEST-ALG-016
 */
import { Client } from 'pg';
import { calcPredictionError } from '../../../src/workers/algorithm/prediction-error';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-ALG-010: Prediction error calculation', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  // TEST-ALG-016: prediction error formula
  test('TEST-ALG-016: prediction_error = ABS(predicted - actual) / actual', () => {
    // Normal case
    expect(calcPredictionError(1000, 1200)).toBeCloseTo(200 / 1200, 5);
    expect(calcPredictionError(1000, 800)).toBeCloseTo(200 / 800, 5);

    // Perfect prediction
    expect(calcPredictionError(1000, 1000)).toBe(0);
  });

  test('E2: predicted=0 AND actual=0 → error=0', () => {
    expect(calcPredictionError(0, 0)).toBe(0);
  });

  test('E3: actual=0 AND predicted>0 → error=1.0', () => {
    expect(calcPredictionError(500, 0)).toBe(1.0);
    expect(calcPredictionError(10000, 0)).toBe(1.0);
  });

  test('prediction error stored correctly in DB', async () => {
    // Setup
    await client.query(`INSERT INTO characters (character_id, name, voice_id) VALUES ('CH_PE01', 'Error Char', 'voice_001') ON CONFLICT (character_id) DO NOTHING`);
    await client.query(`INSERT INTO accounts (account_id, platform, character_id, status) VALUES ('PE001', 'tiktok', 'CH_PE01', 'active') ON CONFLICT (account_id) DO NOTHING`);
    await client.query(`INSERT INTO content (content_id, status, content_format) VALUES ('CPE001', 'posted', 'short_video') ON CONFLICT (content_id) DO NOTHING`);
    const pubRes = await client.query(`INSERT INTO publications (content_id, account_id, platform, status, posted_at) VALUES ('CPE001', 'PE001', 'tiktok', 'posted', NOW() - INTERVAL '10 days') RETURNING id`);
    const pubId = pubRes.rows[0].id;

    await client.query(`INSERT INTO prediction_snapshots (publication_id, content_id, account_id, baseline_used, baseline_source, adjustments_applied, total_adjustment, predicted_impressions) VALUES ($1, 'CPE001', 'PE001', 1000, 'own_history', '{}', 0, 1000)`, [pubId]);

    // Update with 7d measurement
    const error7d = calcPredictionError(1000, 1200);
    await client.query(`UPDATE prediction_snapshots SET actual_impressions_7d = 1200, prediction_error_7d = $1 WHERE publication_id = $2`, [error7d, pubId]);

    // Verify
    const res = await client.query('SELECT prediction_error_7d, actual_impressions_7d FROM prediction_snapshots WHERE publication_id = $1', [pubId]);
    expect(res.rows[0].actual_impressions_7d).toBe(1200);
    expect(res.rows[0].prediction_error_7d).toBeCloseTo(200 / 1200, 5);
  });

  test('30d error stored independently from 7d', async () => {
    await client.query(`INSERT INTO characters (character_id, name, voice_id) VALUES ('CH_PE02', 'Error Char 2', 'voice_002') ON CONFLICT (character_id) DO NOTHING`);
    await client.query(`INSERT INTO accounts (account_id, platform, character_id, status) VALUES ('PE002', 'youtube', 'CH_PE02', 'active') ON CONFLICT (account_id) DO NOTHING`);
    await client.query(`INSERT INTO content (content_id, status, content_format) VALUES ('CPE002', 'posted', 'short_video') ON CONFLICT (content_id) DO NOTHING`);
    const pubRes = await client.query(`INSERT INTO publications (content_id, account_id, platform, status, posted_at) VALUES ('CPE002', 'PE002', 'youtube', 'posted', NOW() - INTERVAL '35 days') RETURNING id`);
    const pubId = pubRes.rows[0].id;

    await client.query(`INSERT INTO prediction_snapshots (publication_id, content_id, account_id, baseline_used, baseline_source, adjustments_applied, total_adjustment, predicted_impressions) VALUES ($1, 'CPE002', 'PE002', 500, 'default', '{}', 0, 500)`, [pubId]);

    // Update 7d
    await client.query(`UPDATE prediction_snapshots SET actual_impressions_7d = 600, prediction_error_7d = $1 WHERE publication_id = $2`, [calcPredictionError(500, 600), pubId]);

    // Update 30d independently
    await client.query(`UPDATE prediction_snapshots SET actual_impressions_30d = 1000, prediction_error_30d = $1 WHERE publication_id = $2`, [calcPredictionError(500, 1000), pubId]);

    const res = await client.query('SELECT prediction_error_7d, prediction_error_30d FROM prediction_snapshots WHERE publication_id = $1', [pubId]);
    expect(res.rows[0].prediction_error_7d).toBeCloseTo(100 / 600, 5);
    expect(res.rows[0].prediction_error_30d).toBeCloseTo(500 / 1000, 5);
  });

  test('large prediction errors are not capped', () => {
    // predicted=1000, actual=100 → error = 9.0
    expect(calcPredictionError(1000, 100)).toBeCloseTo(9.0, 5);
    // predicted=100, actual=1000 → error = 0.9
    expect(calcPredictionError(100, 1000)).toBeCloseTo(0.9, 5);
  });
});
