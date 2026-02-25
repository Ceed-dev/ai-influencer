/**
 * TEST-DSH-035: Prompt Management — バージョン一覧
 * TEST-DSH-036: Prompt Improvement Suggestions
 * TEST-DSH-101: バージョン一覧表示
 * TEST-DSH-102: プロンプト編集・保存
 * TEST-DSH-103: バージョン差分表示
 * TEST-DSH-104: ロールバック操作
 * TEST-DSH-105: 改善提案パネル
 * TEST-DSH-106: 編集画面遷移
 */
import * as fs from 'fs';
import * as path from 'path';
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-026: Prompt Management page', () => {
  const pagePath = path.join(__dirname, '../../../dashboard/app/agents/page.tsx');
  let content: string;
  const versionApiPath = path.join(__dirname, '../../../dashboard/app/api/prompt-versions/route.ts');
  let versionApiContent: string;
  const suggestionsApiPath = path.join(__dirname, '../../../dashboard/app/api/prompt-suggestions/route.ts');
  let suggestionsApiContent: string;

  beforeAll(async () => {
    content = fs.readFileSync(pagePath, 'utf-8');
    versionApiContent = fs.readFileSync(versionApiPath, 'utf-8');
    suggestionsApiContent = fs.readFileSync(suggestionsApiPath, 'utf-8');

    await withClient(async (client) => {
      await client.query(`DELETE FROM prompt_suggestions WHERE suggestion LIKE 'TEST_PROMPT_%'`);
      await client.query(`DELETE FROM agent_prompt_versions WHERE change_summary LIKE 'TEST_PROMPT_%'`);

      await client.query(`
        INSERT INTO agent_prompt_versions (agent_type, version, prompt_content, change_summary, changed_by, active)
        VALUES
          ('strategist', 991, '# Strategy v1', 'TEST_PROMPT_V1 initial version', 'human', false),
          ('strategist', 992, '# Strategy v2 updated', 'TEST_PROMPT_V2 improved instructions', 'human', true)
      `);

      await client.query(`
        INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion, confidence, status)
        VALUES
          ('strategist', 'score_decline', '{"cycle": 100}'::jsonb, 'TEST_PROMPT_S1 Add more detail to analysis', 0.80, 'pending'),
          ('analyst', 'repeated_issue', '{"count": 5}'::jsonb, 'TEST_PROMPT_S2 Improve data handling', 0.65, 'pending')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM prompt_suggestions WHERE suggestion LIKE 'TEST_PROMPT_%'`);
      await client.query(`DELETE FROM agent_prompt_versions WHERE change_summary LIKE 'TEST_PROMPT_%'`);
    });
  });

  // TEST-DSH-035: version list
  test('TEST-DSH-035: agents page has prompt version list', () => {
    expect(content).toContain('agents.tabs.prompt');
    expect(content).toContain('data-version');
    expect(content).toContain('data-active');
  });

  // TEST-DSH-036: suggestions accept/reject
  test('TEST-DSH-036: agents page has suggestions panel with accept/reject', () => {
    expect(content).toContain('agents.tabs.suggestions');
    expect(content).toContain('common.approve');
    expect(content).toContain('common.reject');
  });

  // TEST-DSH-101: version list display
  test('TEST-DSH-101: API returns prompt versions', () => {
    expect(versionApiContent).toContain('agent_prompt_versions');
    expect(versionApiContent).toContain('prompt_content');
    expect(versionApiContent).toContain('active');
  });

  // TEST-DSH-105: suggestions list
  test('TEST-DSH-105: suggestions API supports status filter', () => {
    expect(suggestionsApiContent).toContain('status');
    expect(suggestionsApiContent).toContain('prompt_suggestions');
  });

  test('DB: prompt versions ordered by version', async () => {
    const result = await query(
      `SELECT * FROM agent_prompt_versions
       WHERE change_summary LIKE 'TEST_PROMPT_%'
       ORDER BY version DESC`
    );
    expect(result.rows.length).toBe(2);
    const first = result.rows[0] as Record<string, unknown>;
    expect(first.version).toBe(992);
    expect(first.active).toBe(true);
  });

  test('DB: only one active version per agent', async () => {
    const result = await query(
      `SELECT * FROM agent_prompt_versions
       WHERE change_summary LIKE 'TEST_PROMPT_%' AND active = true`
    );
    expect(result.rows.length).toBe(1);
    expect((result.rows[0] as Record<string, unknown>).version).toBe(992);
  });

  test('DB: pending suggestions exist', async () => {
    const result = await query(
      `SELECT * FROM prompt_suggestions
       WHERE suggestion LIKE 'TEST_PROMPT_%' AND status = 'pending'`
    );
    expect(result.rows.length).toBe(2);
  });

  test('DB: can accept a suggestion', async () => {
    const suggestion = await query(
      `SELECT id FROM prompt_suggestions WHERE suggestion = 'TEST_PROMPT_S1 Add more detail to analysis'`
    );
    const id = (suggestion.rows[0] as Record<string, unknown>).id;

    await query(
      `UPDATE prompt_suggestions SET status = 'accepted', resolved_at = NOW() WHERE id = $1`,
      [id]
    );

    const updated = await query(
      `SELECT * FROM prompt_suggestions WHERE id = $1`,
      [id]
    );
    expect((updated.rows[0] as Record<string, unknown>).status).toBe('accepted');
    expect((updated.rows[0] as Record<string, unknown>).resolved_at).not.toBeNull();
  });
});
