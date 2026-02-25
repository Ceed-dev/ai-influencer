/**
 * FEAT-MS-003: publicationsステータス更新 (posted → measured)
 * Tests: TEST-WKR-017
 *
 * Verifies: status = 'measured'
 * Pass Criteria: status が 'measured' に更新
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-MS-003: publicationsステータス更新', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  async function setupPublication(accountId: string, contentId: string, platform: string): Promise<number> {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_MS03', 'Measure Char 3', 'voice_003')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, character_id, status)
      VALUES ($1, $2, 'CH_MS03', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `, [accountId, platform]);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ($1, 'posted', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `, [contentId]);
    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at, measure_after)
      VALUES ($1, $2, $3, 'posted', NOW() - INTERVAL '50 hours', NOW() - INTERVAL '2 hours')
      RETURNING id
    `, [contentId, accountId, platform]);
    return pubRes.rows[0].id;
  }

  // TEST-WKR-017: publications.status が 'measured' に更新される
  test('TEST-WKR-017: publication status updates from posted to measured', async () => {
    const pubId = await setupPublication('MS03A', 'CMS03A', 'tiktok');

    // Verify initial status is 'posted'
    const before = await client.query('SELECT status FROM publications WHERE id = $1', [pubId]);
    expect(before.rows[0].status).toBe('posted');

    // Simulate measurement completion: insert metrics + update status
    await client.query(`
      INSERT INTO metrics (publication_id, views, likes, comments, shares, measurement_point, measured_at)
      VALUES ($1, 5000, 200, 50, 30, '48h', NOW())
    `, [pubId]);

    await client.query(
      "UPDATE publications SET status = 'measured', updated_at = NOW() WHERE id = $1",
      [pubId]
    );

    // Verify status is now 'measured'
    const after = await client.query('SELECT status FROM publications WHERE id = $1', [pubId]);
    expect(after.rows[0].status).toBe('measured');
  });

  test('measured publication is no longer picked up by measure_after query', async () => {
    const pubId = await setupPublication('MS03B', 'CMS03B', 'youtube');

    // Update to measured
    await client.query(
      "UPDATE publications SET status = 'measured', updated_at = NOW() WHERE id = $1",
      [pubId]
    );

    // Query should NOT return this publication
    const res = await client.query(`
      SELECT id FROM publications
      WHERE measure_after <= NOW() AND status = 'posted' AND id = $1
    `, [pubId]);

    expect(res.rows).toHaveLength(0);
  });

  test('full measurement cycle: metrics INSERT + status update', async () => {
    const pubId = await setupPublication('MS03C', 'CMS03C', 'instagram');

    // Insert metrics
    await client.query(`
      INSERT INTO metrics (publication_id, views, likes, comments, shares, measurement_point, measured_at)
      VALUES ($1, 3000, 150, 30, 20, '48h', NOW())
    `, [pubId]);

    // Verify metrics exist
    const metricsRes = await client.query(
      'SELECT COUNT(*)::int AS cnt FROM metrics WHERE publication_id = $1',
      [pubId]
    );
    expect(metricsRes.rows[0].cnt).toBe(1);

    // Update status
    await client.query(
      "UPDATE publications SET status = 'measured', updated_at = NOW() WHERE id = $1",
      [pubId]
    );

    // Verify both metrics and status
    const pubRes = await client.query('SELECT status FROM publications WHERE id = $1', [pubId]);
    expect(pubRes.rows[0].status).toBe('measured');
  });
});
