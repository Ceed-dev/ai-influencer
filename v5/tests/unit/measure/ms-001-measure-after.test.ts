/**
 * FEAT-MS-001: measure_after判定 (現在時刻 >= measure_after で実行)
 * Tests: TEST-WKR-015
 *
 * Verifies: measure_after <= NOW() の publications のみ計測対象として取得
 * Pass Criteria: measure_after > NOW() の行は取得されない
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-MS-001: measure_after判定', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  async function setupPublication(opts: {
    accountId: string;
    contentId: string;
    platform: string;
    hoursAgo: number;
    measureAfterHoursAgo: number;
    status?: string;
  }): Promise<number> {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_MS01', 'Measure Char', 'voice_001')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, character_id, status)
      VALUES ($1, $2, 'CH_MS01', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `, [opts.accountId, opts.platform]);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ($1, 'posted', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `, [opts.contentId]);

    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at, measure_after)
      VALUES ($1, $2, $3, $4,
        NOW() - ($5 || ' hours')::INTERVAL,
        NOW() - ($6 || ' hours')::INTERVAL)
      RETURNING id
    `, [
      opts.contentId,
      opts.accountId,
      opts.platform,
      opts.status || 'posted',
      opts.hoursAgo,
      opts.measureAfterHoursAgo,
    ]);

    return pubRes.rows[0].id;
  }

  // TEST-WKR-015: measure_after <= NOW() の publications のみ計測対象として取得
  test('TEST-WKR-015: only returns publications where measure_after <= NOW()', async () => {
    // Publication A: posted 50h ago, measure_after = 2h ago (ELIGIBLE)
    const pubIdEligible = await setupPublication({
      accountId: 'MS01A',
      contentId: 'CMS01A',
      platform: 'tiktok',
      hoursAgo: 50,
      measureAfterHoursAgo: 2, // measure_after is 2 hours in the past
    });

    // Publication B: posted 10h ago, measure_after = 38h in future (NOT ELIGIBLE)
    const pubIdNotEligible = await setupPublication({
      accountId: 'MS01B',
      contentId: 'CMS01B',
      platform: 'youtube',
      hoursAgo: 10,
      measureAfterHoursAgo: -38, // measure_after is 38 hours in the future
    });

    // Query for measurement-eligible publications
    const res = await client.query(`
      SELECT id, measure_after, status
      FROM publications
      WHERE measure_after <= NOW()
        AND status = 'posted'
      ORDER BY measure_after ASC
    `);

    const eligibleIds = res.rows.map((r: { id: number }) => r.id);

    // Eligible publication MUST be in results
    expect(eligibleIds).toContain(pubIdEligible);

    // Not-eligible publication MUST NOT be in results
    expect(eligibleIds).not.toContain(pubIdNotEligible);
  });

  test('publications with status != posted are excluded', async () => {
    // Publication with status='measured' — should NOT be eligible
    const pubId = await setupPublication({
      accountId: 'MS01C',
      contentId: 'CMS01C',
      platform: 'instagram',
      hoursAgo: 72,
      measureAfterHoursAgo: 24,
      status: 'measured',
    });

    const res = await client.query(`
      SELECT id FROM publications
      WHERE measure_after <= NOW()
        AND status = 'posted'
        AND id = $1
    `, [pubId]);

    expect(res.rows).toHaveLength(0);
  });

  test('publications with measure_after = NULL are excluded', async () => {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_MS01', 'Measure Char', 'voice_001')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, character_id, status)
      VALUES ('MS01D', 'x', 'CH_MS01', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ('CMS01D', 'posted', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `);

    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at, measure_after)
      VALUES ('CMS01D', 'MS01D', 'x', 'posted', NOW() - INTERVAL '72 hours', NULL)
      RETURNING id
    `);
    const pubId = pubRes.rows[0].id;

    const res = await client.query(`
      SELECT id FROM publications
      WHERE measure_after <= NOW()
        AND status = 'posted'
        AND id = $1
    `, [pubId]);

    expect(res.rows).toHaveLength(0);
  });
});
