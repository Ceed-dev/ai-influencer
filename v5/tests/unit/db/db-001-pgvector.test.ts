/**
 * TEST-DB-001: pgvector拡張の有効化確認
 * TEST-DB-002: 全33テーブルの存在確認
 * Feature: FEAT-DB-001
 */
import { query } from '../../helpers/db';

describe('FEAT-DB-001: PostgreSQL 16 + pgvector setup', () => {
  test('TEST-DB-001: pgvector extension is enabled', async () => {
    const result = await query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.extname).toBe('vector');
  });

  test('TEST-DB-002: all 33 tables exist', async () => {
    const expectedTables = [
      'account_baselines', 'accounts', 'adjustment_factor_cache',
      'agent_communications', 'agent_individual_learnings', 'agent_prompt_versions',
      'agent_reflections', 'agent_thought_logs', 'algorithm_performance',
      'analyses', 'characters', 'components', 'content', 'content_learnings',
      'content_sections', 'cycles', 'human_directives', 'hypotheses',
      'kpi_snapshots', 'learnings', 'market_intel', 'metrics',
      'prediction_snapshots', 'prediction_weights', 'production_recipes',
      'prompt_suggestions', 'publications', 'system_settings', 'task_queue',
      'tool_catalog', 'tool_experiences', 'tool_external_sources', 'weight_audit_log',
    ].sort();

    const result = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"
    );
    const actualTables = result.rows.map((r: { table_name: string }) => r.table_name).sort();

    expect(actualTables).toEqual(expectedTables);
    expect(actualTables).toHaveLength(33);
  });
});
