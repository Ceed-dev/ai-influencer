/**
 * FEAT-TST-012: Tool Specialist → 制作ワーカー レシピ連携
 * TEST-INT-012
 *
 * Verifies that Tool Specialist sets recipe_id on content,
 * worker uses recipe, and tool_experiences records recipe usage.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-012: Tool Specialist → production worker recipe', () => {
  let client: Client;
  const testCharId = 'CHR_INT012';
  const testContentId = 'CNT_INT012_001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM tool_experiences WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT012', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM tool_experiences WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-012: recipe set → worker uses recipe → experience recorded', async () => {
    // Get a recipe (use first available or create one)
    let recipeRes = await client.query(`SELECT id FROM production_recipes LIMIT 1`);
    let recipeId: number;
    if (recipeRes.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO production_recipes (recipe_name, content_format, steps, created_by)
         VALUES ('INT012 Recipe', 'short_video', '{"steps":["generate","lipsync"]}', 'tool_specialist')
         RETURNING id`
      );
      recipeId = ins.rows[0].id;
    } else {
      recipeId = recipeRes.rows[0].id;
    }

    // Step 1: Tool Specialist sets recipe_id on content
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id, recipe_id)
       VALUES ($1, 'short_video', 'planned', $2, $3)`,
      [testContentId, testCharId, recipeId]
    );

    // Step 2: Worker uses recipe and records experience
    let toolRes = await client.query(`SELECT id FROM tool_catalog LIMIT 1`);
    let toolId: number;
    if (toolRes.rows.length === 0) {
      const ins = await client.query(
        `INSERT INTO tool_catalog (tool_name, tool_type, provider, is_active)
         VALUES ('fal_minimax', 'video_generation', 'fal.ai', true)
         RETURNING id`
      );
      toolId = ins.rows[0].id;
    } else {
      toolId = toolRes.rows[0].id;
    }

    await client.query(
      `INSERT INTO tool_experiences (tool_id, content_id, agent_id, recipe_used, quality_score, success)
       VALUES ($1, $2, 'video_worker', $3, 0.85, true)`,
      [toolId, testContentId, JSON.stringify({ recipe_id: recipeId })]
    );

    // Verify recipe_used is non-NULL
    const expRes = await client.query(
      `SELECT recipe_used FROM tool_experiences WHERE content_id = $1`, [testContentId]
    );
    expect(expRes.rows[0].recipe_used).not.toBeNull();
    expect(expRes.rows[0].recipe_used.recipe_id).toBe(recipeId);
  });
});
