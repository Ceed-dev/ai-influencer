/**
 * FEAT-DB-048: Table creation order — FK dependency verification
 * Tests: TEST-DB-055
 */
import { withClient } from '../../helpers/db';

describe('FEAT-DB-048: FK dependency order verification', () => {
  // TEST-DB-055: All FK constraints are valid (tables exist in correct order)
  test('TEST-DB-055: all FK constraints are satisfied', async () => {
    await withClient(async (c) => {
      // Get all FK constraints and verify they reference existing tables
      const res = await c.query(`
        SELECT
          tc.table_name AS source_table,
          kcu.column_name AS source_column,
          ccu.table_name AS target_table,
          ccu.column_name AS target_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);

      // Must have FK constraints
      expect(res.rows.length).toBeGreaterThan(0);

      // Verify key FK relationships exist
      const fks = res.rows.map((r: any) => `${r.source_table}.${r.source_column}->${r.target_table}.${r.target_column}`);

      // Key FKs from spec
      expect(fks).toContain('accounts.character_id->characters.character_id');
      expect(fks).toContain('content.hypothesis_id->hypotheses.id');
      expect(fks).toContain('content.character_id->characters.character_id');
      expect(fks).toContain('publications.content_id->content.content_id');
      expect(fks).toContain('publications.account_id->accounts.account_id');
      expect(fks).toContain('content_learnings.content_id->content.content_id');
      expect(fks).toContain('content_learnings.hypothesis_id->hypotheses.id');
      expect(fks).toContain('metrics.publication_id->publications.id');
      expect(fks).toContain('hypotheses.cycle_id->cycles.id');
    });
  });
});
