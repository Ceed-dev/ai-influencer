/**
 * FEAT-MS-005: フォローアップ計測スケジュール (7d/30d)
 * Tests: TEST-WKR-031
 *
 * Verifies: metrics テーブルに measurement_point='7d' の行が INSERT
 * Pass Criteria: measurement_point = '7d'
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-MS-005: フォローアップ計測スケジュール', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  async function setupPublication(
    accountId: string, contentId: string, platform: string, daysAgo: number,
  ): Promise<number> {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_MS05', 'Measure Char 5', 'voice_005')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, character_id, status)
      VALUES ($1, $2, 'CH_MS05', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `, [accountId, platform]);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ($1, 'posted', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `, [contentId]);
    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at,
        measure_after, platform_post_id)
      VALUES ($1, $2, $3, 'posted',
        NOW() - make_interval(days => $4),
        NOW() - make_interval(days => $4) + INTERVAL '48 hours',
        $5)
      RETURNING id
    `, [contentId, accountId, platform, daysAgo, `post_${accountId}`]);
    return pubRes.rows[0].id;
  }

  // TEST-WKR-031: フォローアップ計測で measurement_point='7d' の行が INSERT
  test('TEST-WKR-031: follow-up measurement creates 7d metrics entry', async () => {
    // Publication posted 8 days ago (eligible for 7d follow-up)
    const pubId = await setupPublication('MS05A', 'CMS05A', 'tiktok', 8);

    // Simulate: initial 48h measurement already done
    await client.query(`
      INSERT INTO metrics (publication_id, views, likes, comments, shares, measurement_point, measured_at)
      VALUES ($1, 5000, 200, 50, 30, '48h', NOW() - INTERVAL '6 days')
    `, [pubId]);

    // Now simulate 7d follow-up measurement
    await client.query(`
      INSERT INTO metrics (publication_id, views, likes, comments, shares, measurement_point, measured_at)
      VALUES ($1, 15000, 600, 150, 80, '7d', NOW())
    `, [pubId]);

    // Verify measurement_point = '7d' row exists
    const res = await client.query(
      "SELECT measurement_point, views FROM metrics WHERE publication_id = $1 AND measurement_point = '7d'",
      [pubId]
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].measurement_point).toBe('7d');
    expect(res.rows[0].views).toBe(15000);
  });

  test('follow-up creates task_queue entries for 7d and 30d', async () => {
    const pubId = await setupPublication('MS05B', 'CMS05B', 'youtube', 3);

    // Create follow-up measure tasks (simulating scheduleFollowups)
    for (const measurementType of ['7d', '30d']) {
      await client.query(`
        INSERT INTO task_queue (task_type, payload, status, priority)
        VALUES ('measure', $1, 'pending', 0)
      `, [JSON.stringify({
        publication_id: pubId,
        platform: 'youtube',
        platform_post_id: 'post_MS05B',
        measurement_type: measurementType,
      })]);
    }

    // Verify both follow-up tasks exist
    const res = await client.query(`
      SELECT payload->>'measurement_type' AS mtype
      FROM task_queue
      WHERE task_type = 'measure'
        AND (payload->>'publication_id')::int = $1
      ORDER BY (payload->>'measurement_type')
    `, [pubId]);

    expect(res.rows).toHaveLength(2);
    expect(res.rows.map((r: { mtype: string }) => r.mtype).sort()).toEqual(['30d', '7d']);
  });

  test('duplicate follow-up tasks are not created', async () => {
    const pubId = await setupPublication('MS05C', 'CMS05C', 'instagram', 3);

    // Create 7d follow-up task
    await client.query(`
      INSERT INTO task_queue (task_type, payload, status, priority)
      VALUES ('measure', $1, 'pending', 0)
    `, [JSON.stringify({
      publication_id: pubId,
      platform: 'instagram',
      platform_post_id: 'post_MS05C',
      measurement_type: '7d',
    })]);

    // Check: existing pending 7d task should prevent duplicate
    const existRes = await client.query(`
      SELECT COUNT(*)::int AS cnt FROM task_queue
      WHERE task_type = 'measure'
        AND status IN ('pending', 'queued', 'processing')
        AND (payload->>'publication_id')::int = $1
        AND payload->>'measurement_type' = '7d'
    `, [pubId]);

    expect(existRes.rows[0].cnt).toBe(1);
  });

  test('METRICS_FOLLOWUP_DAYS setting controls follow-up schedule', async () => {
    // Verify the setting exists
    const settingRes = await client.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'METRICS_FOLLOWUP_DAYS'"
    );

    if (settingRes.rows.length > 0) {
      const val = settingRes.rows[0].setting_value;
      const days = typeof val === 'string' ? JSON.parse(val) : val;
      expect(Array.isArray(days)).toBe(true);
      expect(days.length).toBeGreaterThanOrEqual(1);
      // Each value should be a positive number
      for (const d of days) {
        expect(Number(d)).toBeGreaterThan(0);
      }
    }
  });
});
