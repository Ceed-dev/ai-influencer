/**
 * FEAT-ALG-009: cross_account_performance calculation
 * Tests: TEST-ALG-015
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-ALG-009: cross_account_performance', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  async function setupCrossAccount(
    accountId: string, contentId: string, platform: string,
    baseline: number, views: number,
  ): Promise<number> {
    await client.query(`INSERT INTO characters (character_id, name, voice_id) VALUES ('CH_CA01', 'Cross Char', 'voice_001') ON CONFLICT (character_id) DO NOTHING`);
    await client.query(`INSERT INTO accounts (account_id, platform, character_id, status) VALUES ($1, $2, 'CH_CA01', 'active') ON CONFLICT (account_id) DO NOTHING`, [accountId, platform]);
    await client.query(`INSERT INTO content (content_id, status, content_format) VALUES ($1, 'posted', 'short_video') ON CONFLICT (content_id) DO NOTHING`, [contentId]);
    const pubRes = await client.query(`INSERT INTO publications (content_id, account_id, platform, status, posted_at) VALUES ($1, $2, $3, 'posted', NOW() - INTERVAL '10 days') RETURNING id`, [contentId, accountId, platform]);
    const pubId = pubRes.rows[0].id;
    await client.query(`INSERT INTO prediction_snapshots (publication_id, content_id, account_id, baseline_used, baseline_source, adjustments_applied, total_adjustment, predicted_impressions) VALUES ($1, $2, $3, $4, 'own_history', '{}', 0, $4)`, [pubId, contentId, accountId, baseline]);
    await client.query(`INSERT INTO metrics (publication_id, views, measurement_point, measured_at) VALUES ($1, $2, '7d', NOW())`, [pubId, views]);
    return pubId;
  }

  test('TEST-ALG-015: cross_account — AVG(actual/baseline - 1.0) across other accounts', async () => {
    const contentId = 'CCA001';
    await setupCrossAccount('XA001', contentId, 'tiktok', 1000, 1200);
    await setupCrossAccount('XA002', contentId, 'tiktok', 1000, 800);
    await setupCrossAccount('XA003', contentId, 'tiktok', 1000, 1500);
    const res = await client.query(`SELECT AVG(m.views / NULLIF(ps.baseline_used, 0) - 1.0) AS cross_adj, COUNT(*)::int AS sample_count FROM prediction_snapshots ps JOIN publications p ON ps.publication_id = p.id JOIN metrics m ON p.id = m.publication_id WHERE ps.content_id = $1 AND p.platform = 'tiktok' AND p.account_id != 'XA003' AND m.measurement_point = '7d' AND ps.baseline_used > 0`, [contentId]);
    expect(res.rows[0].sample_count).toBe(2);
    expect(parseFloat(res.rows[0].cross_adj)).toBeCloseTo(0.0, 5);
  });

  test('cross_account returns 0 when insufficient sample', async () => {
    await setupCrossAccount('XA004', 'CCA002', 'tiktok', 1000, 1200);
    await setupCrossAccount('XA005', 'CCA002', 'tiktok', 1000, 1500);
    const res = await client.query(`SELECT AVG(m.views / NULLIF(ps.baseline_used, 0) - 1.0) AS cross_adj FROM prediction_snapshots ps JOIN publications p ON ps.publication_id = p.id JOIN metrics m ON p.id = m.publication_id WHERE ps.content_id = 'CCA002' AND p.platform = 'tiktok' AND p.account_id != 'XA005' AND m.measurement_point = '7d' AND ps.baseline_used > 0 HAVING COUNT(*) >= 2`);
    expect(res.rows).toHaveLength(0);
  });

  test('cross_account excludes other platforms', async () => {
    await setupCrossAccount('XA006', 'CCA003', 'tiktok', 1000, 1200);
    await setupCrossAccount('XA007', 'CCA003', 'youtube', 1000, 1500);
    await setupCrossAccount('XA008', 'CCA003', 'tiktok', 1000, 900);
    const res = await client.query(`SELECT COUNT(*)::int AS cnt FROM prediction_snapshots ps JOIN publications p ON ps.publication_id = p.id JOIN metrics m ON p.id = m.publication_id WHERE ps.content_id = 'CCA003' AND p.platform = 'tiktok' AND p.account_id != 'XA008' AND m.measurement_point = '7d' AND ps.baseline_used > 0`);
    expect(res.rows[0].cnt).toBe(1);
  });

  test('CROSS_ACCOUNT_MIN_SAMPLE setting exists', async () => {
    const res = await client.query("SELECT setting_value FROM system_settings WHERE setting_key = 'CROSS_ACCOUNT_MIN_SAMPLE'");
    expect(res.rows).toHaveLength(1);
    expect(Number(res.rows[0].setting_value)).toBe(2);
  });

  test('cross_account with positive performance bias', async () => {
    await setupCrossAccount('XA009', 'CCA004', 'instagram', 1000, 1500);
    await setupCrossAccount('XA010', 'CCA004', 'instagram', 1000, 1300);
    await setupCrossAccount('XA011', 'CCA004', 'instagram', 1000, 1100);
    const res = await client.query(`SELECT AVG(m.views / NULLIF(ps.baseline_used, 0) - 1.0) AS cross_adj FROM prediction_snapshots ps JOIN publications p ON ps.publication_id = p.id JOIN metrics m ON p.id = m.publication_id WHERE ps.content_id = 'CCA004' AND p.platform = 'instagram' AND p.account_id != 'XA011' AND m.measurement_point = '7d' AND ps.baseline_used > 0 HAVING COUNT(*) >= 2`);
    expect(parseFloat(res.rows[0].cross_adj)).toBeCloseTo(0.4, 5);
  });
});
