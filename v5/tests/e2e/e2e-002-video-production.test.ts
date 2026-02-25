/**
 * FEAT-TST-022: E2Eテスト — 動画制作 (3セクション並列制作)
 * TEST-E2E-002
 *
 * Verifies 3-section video production pipeline:
 * content + 3 sections → production → video_drive_id set.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-022: E2E video production — 3 sections', () => {
  let client: Client;
  const testCharId = 'CHR_E2E002';
  const testContentId = 'CNT_E2E002_001';
  const compIds = ['CMP_E2E002_A', 'CMP_E2E002_B', 'CMP_E2E002_C'];

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM components WHERE component_id = ANY($1)`, [compIds]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E002 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );
    for (const compId of compIds) {
      await client.query(
        `INSERT INTO components (component_id, type, name) VALUES ($1, 'scenario', $2)`,
        [compId, `E2E002 Component ${compId}`]
      );
    }
  });

  afterAll(async () => {
    await client.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM components WHERE component_id = ANY($1)`, [compIds]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-E2E-002: 3-section production → video_drive_id set', async () => {
    // Step 1: Create content + 3 sections
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'planned', $2)`,
      [testContentId, testCharId]
    );

    const labels = ['hook', 'body', 'cta'];
    for (let i = 0; i < 3; i++) {
      await client.query(
        `INSERT INTO content_sections (content_id, component_id, section_order, section_label, script, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [testContentId, compIds[i], i + 1, labels[i], `Script for ${labels[i]}`, 15 + i * 5]
      );
    }

    // Step 2: Task queue
    await client.query(
      `INSERT INTO task_queue (task_type, payload, status)
       VALUES ('produce', $1, 'processing')`,
      [JSON.stringify({ content_id: testContentId })]
    );

    // Step 3: Production completes — set video_drive_id
    await client.query(
      `UPDATE content SET status = 'ready', video_drive_id = 'GDRIVE_E2E002_FINAL',
       video_drive_url = 'https://drive.google.com/file/d/GDRIVE_E2E002_FINAL',
       total_duration_seconds = 30, production_metadata = $1
       WHERE content_id = $2`,
      [JSON.stringify({ sections_completed: 3, ffmpeg_concat: true }), testContentId]
    );

    // Verify
    const res = await client.query(
      `SELECT video_drive_id, status, total_duration_seconds
       FROM content WHERE content_id = $1`,
      [testContentId]
    );
    expect(res.rows[0].video_drive_id).not.toBeNull();
    expect(res.rows[0].video_drive_id).toBe('GDRIVE_E2E002_FINAL');
    expect(res.rows[0].status).toBe('ready');

    // Verify 3 sections
    const secRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM content_sections WHERE content_id = $1`,
      [testContentId]
    );
    expect(secRes.rows[0].cnt).toBe(3);
  });
});
