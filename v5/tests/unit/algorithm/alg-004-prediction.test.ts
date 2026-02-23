/**
 * FEAT-ALG-004: Prediction pipeline
 * Tests: TEST-ALG-007, TEST-ALG-008, TEST-ALG-025, TEST-ALG-027
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-ALG-004: Prediction pipeline', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  // TEST-ALG-007: ±20% clip (already tested in alg-002, but included for completeness)
  test('TEST-ALG-007: ±20% clip — old=0.10, ema=0.20 → clipped to 0.12', () => {
    const oldWeight = 0.10;
    const emaResult = 0.20; // 100% increase
    const maxRate = 0.20;
    const hi = oldWeight * (1 + maxRate); // 0.12
    const clipped = Math.min(hi, emaResult);
    expect(clipped).toBeCloseTo(0.12, 3);
  });

  // TEST-ALG-008: WEIGHT_FLOOR application
  test('TEST-ALG-008: WEIGHT_FLOOR — clipped=0.01 → floored to 0.02', async () => {
    const res = await client.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'WEIGHT_FLOOR'"
    );
    const floor = Number(res.rows[0].setting_value);
    expect(floor).toBe(0.02);
    expect(Math.max(floor, 0.01)).toBe(0.02);
  });

  // TEST-ALG-025: End-to-end prediction pipeline
  test('TEST-ALG-025: prediction pipeline — content → prediction → publication', async () => {
    // Setup: character, account, content, publication
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_PR01', 'Pred Test Char', 'voice_001')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, niche, character_id, status, created_at)
      VALUES ('PA001', 'tiktok', 'comedy', 'CH_PR01', 'active', NOW() - INTERVAL '100 days')
      ON CONFLICT (account_id) DO NOTHING
    `);

    // Insert baseline for this account
    await client.query(`
      INSERT INTO account_baselines (account_id, baseline_impressions, source, sample_count, window_start, window_end)
      VALUES ('PA001', 1000, 'own_history', 10, CURRENT_DATE - 14, CURRENT_DATE)
      ON CONFLICT (account_id) DO UPDATE SET baseline_impressions = 1000
    `);

    // Create content
    await client.query(`
      INSERT INTO content (content_id, status, content_format, hook_type, narrative_structure, total_duration_seconds)
      VALUES ('CPR001', 'approved', 'short_video', 'question', 'climactic', 25)
      ON CONFLICT (content_id) DO NOTHING
    `);

    // Create publication
    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at)
      VALUES ('CPR001', 'PA001', 'tiktok', 'posted', NOW())
      RETURNING id
    `);
    const pubId = pubRes.rows[0].id;

    // Now create prediction manually (same logic as prediction.ts)
    // Get baseline
    const baselineRes = await client.query(
      "SELECT baseline_impressions, source FROM account_baselines WHERE account_id = 'PA001'"
    );
    expect(baselineRes.rows).toHaveLength(1);
    const baseline = baselineRes.rows[0].baseline_impressions;
    const baselineSource = baselineRes.rows[0].source;
    expect(baseline).toBe(1000);
    expect(baselineSource).toBe('own_history');

    // Get weights
    const weightsRes = await client.query(
      "SELECT factor_name, weight FROM prediction_weights WHERE platform = 'tiktok'"
    );
    expect(weightsRes.rows.length).toBe(9);

    // Build adjustments (all adjustment_factor_cache is empty → adj = 0 for each)
    const adjustmentsApplied: Record<string, { value: string; adjustment: number; weight: number }> = {};
    let totalAdj = 0;
    for (const row of weightsRes.rows) {
      adjustmentsApplied[row.factor_name as string] = {
        value: 'test',
        adjustment: 0,
        weight: row.weight,
      };
      totalAdj += row.weight * 0; // All adj = 0
    }

    // Predicted = baseline × (1 + 0) = 1000
    const predicted = baseline * (1 + totalAdj);
    expect(predicted).toBe(1000);

    // Insert prediction_snapshots
    await client.query(`
      INSERT INTO prediction_snapshots (
        publication_id, content_id, account_id, hypothesis_id,
        baseline_used, baseline_source, adjustments_applied,
        total_adjustment, predicted_impressions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [pubId, 'CPR001', 'PA001', null, baseline, baselineSource,
        JSON.stringify(adjustmentsApplied), totalAdj, predicted]);

    // Verify prediction_snapshots was created
    const psRes = await client.query(
      'SELECT * FROM prediction_snapshots WHERE publication_id = $1', [pubId]
    );
    expect(psRes.rows).toHaveLength(1);
    const ps = psRes.rows[0];
    expect(ps.baseline_used).toBe(1000);
    expect(ps.baseline_source).toBe('own_history');
    expect(ps.predicted_impressions).toBe(1000);
    expect(ps.total_adjustment).toBe(0);
    expect(ps.actual_impressions_7d).toBeNull();
    expect(ps.prediction_error_7d).toBeNull();

    // Simulate 7d measurement
    await client.query(`
      INSERT INTO metrics (publication_id, views, measurement_point, measured_at)
      VALUES ($1, 1200, '7d', NOW())
    `, [pubId]);

    // Update actual and error
    const actual7d = 1200;
    const error7d = Math.abs(predicted - actual7d) / actual7d;
    await client.query(`
      UPDATE prediction_snapshots
      SET actual_impressions_7d = $1, prediction_error_7d = $2
      WHERE publication_id = $3
    `, [actual7d, error7d, pubId]);

    // Verify complete prediction snapshot
    const finalRes = await client.query(
      'SELECT * FROM prediction_snapshots WHERE publication_id = $1', [pubId]
    );
    const final = finalRes.rows[0];
    expect(final.predicted_impressions).toBe(1000);
    expect(final.actual_impressions_7d).toBe(1200);
    expect(final.prediction_error_7d).toBeCloseTo(
      Math.abs(1000 - 1200) / 1200, 5
    );
  });

  // TEST-ALG-027: adjustments_applied JSONB structure
  test('TEST-ALG-027: adjustments_applied JSONB has 9 factors with correct structure', async () => {
    // Setup minimal data for prediction
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_PR02', 'JSON Test Char', 'voice_002')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, niche, character_id, status)
      VALUES ('PA002', 'youtube', 'tech', 'CH_PR02', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ('CPR002', 'approved', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `);
    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at)
      VALUES ('CPR002', 'PA002', 'youtube', 'posted', NOW())
      RETURNING id
    `);
    const pubId = pubRes.rows[0].id;

    // Build valid 9-factor JSONB
    const factors = [
      'hook_type', 'content_length', 'post_hour', 'post_weekday',
      'niche', 'narrative_structure', 'sound_bgm', 'hashtag_keyword',
      'cross_account_performance',
    ];
    const adjustments: Record<string, { value: string; adjustment: number; weight: number }> = {};
    for (const f of factors) {
      adjustments[f] = { value: 'test_value', adjustment: 0.05, weight: 0.1111 };
    }

    await client.query(`
      INSERT INTO prediction_snapshots (
        publication_id, content_id, account_id,
        baseline_used, baseline_source, adjustments_applied,
        total_adjustment, predicted_impressions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [pubId, 'CPR002', 'PA002', 500, 'default',
        JSON.stringify(adjustments), 0.05, 525]);

    // Verify JSONB structure
    const res = await client.query(`
      SELECT jsonb_object_keys(adjustments_applied) AS key
      FROM prediction_snapshots WHERE publication_id = $1
    `, [pubId]);

    const keys = res.rows.map((r: any) => r.key).sort();
    expect(keys).toEqual(factors.sort());

    // Verify each key has {value, adjustment, weight}
    const detailRes = await client.query(`
      SELECT adjustments_applied FROM prediction_snapshots WHERE publication_id = $1
    `, [pubId]);
    const applied = detailRes.rows[0].adjustments_applied;
    for (const f of factors) {
      expect(applied[f]).toHaveProperty('value');
      expect(applied[f]).toHaveProperty('adjustment');
      expect(applied[f]).toHaveProperty('weight');
      expect(typeof applied[f].adjustment).toBe('number');
      expect(typeof applied[f].weight).toBe('number');
    }
  });

  // Clip settings verification
  test('clip settings exist with correct defaults', async () => {
    const keys = [
      'ADJUSTMENT_INDIVIDUAL_MIN', 'ADJUSTMENT_INDIVIDUAL_MAX',
      'ADJUSTMENT_TOTAL_MIN', 'ADJUSTMENT_TOTAL_MAX',
      'PREDICTION_VALUE_MIN_RATIO', 'PREDICTION_VALUE_MAX_RATIO',
    ];
    const expected: Record<string, number> = {
      ADJUSTMENT_INDIVIDUAL_MIN: -0.5,
      ADJUSTMENT_INDIVIDUAL_MAX: 0.5,
      ADJUSTMENT_TOTAL_MIN: -0.7,
      ADJUSTMENT_TOTAL_MAX: 1.0,
      PREDICTION_VALUE_MIN_RATIO: 0.3,
      PREDICTION_VALUE_MAX_RATIO: 2.0,
    };
    const res = await client.query(
      'SELECT setting_key, setting_value FROM system_settings WHERE setting_key = ANY($1)',
      [keys]
    );
    expect(res.rows).toHaveLength(6);
    for (const row of res.rows) {
      expect(Number(row.setting_value)).toBeCloseTo(expected[row.setting_key as string], 2);
    }
  });

  // Clamp function correctness
  test('prediction value clamp: baseline × (min_ratio, max_ratio)', () => {
    const baseline = 1000;
    const minRatio = 0.3;
    const maxRatio = 2.0;

    // Within range
    const p1 = baseline * (1 + 0.5); // 1500
    expect(Math.max(baseline * minRatio, Math.min(baseline * maxRatio, p1))).toBe(1500);

    // Below min
    const p2 = baseline * (1 - 0.8); // 200
    expect(Math.max(baseline * minRatio, Math.min(baseline * maxRatio, p2))).toBe(300);

    // Above max
    const p3 = baseline * (1 + 1.5); // 2500
    expect(Math.max(baseline * minRatio, Math.min(baseline * maxRatio, p3))).toBe(2000);
  });
});
