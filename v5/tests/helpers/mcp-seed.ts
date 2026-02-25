/**
 * Shared seed/cleanup helpers for MCP server tests.
 * Uses a consistent prefix (MCP_TEST_) to avoid conflicts.
 */
import { withClient } from './db';

const PREFIX = 'MCP_TEST_';

export async function seedBaseData() {
  await withClient(async (client) => {
    // Characters
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id, appearance, status)
      VALUES
        ('${PREFIX}CHR_001', 'Test Char 1', 'abc123def456abc123def456abc12345', '{"style":"anime"}', 'active'),
        ('${PREFIX}CHR_002', 'Test Char 2', 'def456abc123def456abc123def45678', '{"style":"realistic"}', 'active')
      ON CONFLICT (character_id) DO NOTHING
    `);

    // Accounts
    await client.query(`
      INSERT INTO accounts (account_id, platform, status, follower_count, monetization_status, character_id, niche, cluster)
      VALUES
        ('${PREFIX}ACC_001', 'youtube', 'active', 1000, 'active', '${PREFIX}CHR_001', 'beauty', 'cluster_a'),
        ('${PREFIX}ACC_002', 'tiktok', 'active', 2000, 'none', '${PREFIX}CHR_001', 'beauty', 'cluster_a'),
        ('${PREFIX}ACC_003', 'instagram', 'active', 500, 'none', '${PREFIX}CHR_002', 'tech', 'cluster_b'),
        ('${PREFIX}ACC_004', 'x', 'suspended', 300, 'none', '${PREFIX}CHR_002', 'tech', 'cluster_b')
      ON CONFLICT (account_id) DO NOTHING
    `);

    // Content
    await client.query(`
      INSERT INTO content (content_id, character_id, content_format, status)
      VALUES
        ('${PREFIX}CNT_001', '${PREFIX}CHR_001', 'short_video', 'posted'),
        ('${PREFIX}CNT_002', '${PREFIX}CHR_001', 'short_video', 'measured'),
        ('${PREFIX}CNT_003', '${PREFIX}CHR_002', 'text_post', 'planned')
      ON CONFLICT (content_id) DO NOTHING
    `);

    // Publications
    await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at)
      VALUES
        ('${PREFIX}CNT_001', '${PREFIX}ACC_001', 'youtube', 'measured', NOW() - INTERVAL '2 days'),
        ('${PREFIX}CNT_002', '${PREFIX}ACC_002', 'tiktok', 'measured', NOW() - INTERVAL '1 day')
      ON CONFLICT DO NOTHING
    `);

    // Get publication IDs and insert metrics
    const pubRes = await client.query(`
      SELECT id, content_id FROM publications
      WHERE content_id IN ('${PREFIX}CNT_001', '${PREFIX}CNT_002')
      ORDER BY content_id
    `);

    for (const row of pubRes.rows) {
      if (row.content_id === `${PREFIX}CNT_001`) {
        await client.query(`
          INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, follower_delta, measurement_point)
          VALUES ($1, 5000, 250, 50, 30, 0.0660, 15, '48h')
          ON CONFLICT (publication_id, measurement_point) DO NOTHING
        `, [row.id]);
      } else if (row.content_id === `${PREFIX}CNT_002`) {
        await client.query(`
          INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, follower_delta, measurement_point)
          VALUES ($1, 3000, 150, 30, 20, 0.0500, 10, '48h')
          ON CONFLICT (publication_id, measurement_point) DO NOTHING
        `, [row.id]);
      }
    }
  });
}

export async function cleanupBaseData() {
  await withClient(async (client) => {
    // Delete in strict FK dependency order — deepest dependents first.
    // Use sub-selects to catch all rows that transitively reference MCP_TEST_ data.
    await client.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id LIKE '${PREFIX}%')`);
    await client.query(`DELETE FROM task_queue WHERE payload::text LIKE '%${PREFIX}%'`);
    await client.query(`DELETE FROM content_sections WHERE content_id LIKE '${PREFIX}%' OR content_id LIKE 'CNT_%'`);
    await client.query(`DELETE FROM publications WHERE content_id LIKE '${PREFIX}%' OR content_id LIKE 'CNT_%'`);
    await client.query(`DELETE FROM content_learnings WHERE content_id LIKE '${PREFIX}%' OR content_id LIKE 'CNT_%'`);
    await client.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}%' OR content_id LIKE 'CNT_%'`);
    await client.query(`DELETE FROM hypotheses WHERE id IN (SELECT id FROM hypotheses WHERE statement LIKE 'Test %' OR statement LIKE 'Text post %')`);
    await client.query(`DELETE FROM prediction_snapshots WHERE account_id LIKE '${PREFIX}%'`);
    await client.query(`DELETE FROM account_baselines WHERE account_id LIKE '${PREFIX}%'`);
    await client.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
    await client.query(`DELETE FROM characters WHERE character_id LIKE '${PREFIX}%'`);
  });
}

export { PREFIX };
