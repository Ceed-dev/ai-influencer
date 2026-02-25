/**
 * FEAT-DB-038: system_settings table structure
 * FEAT-DB-039: system_settings.category CHECK (8 values)
 * FEAT-DB-040: system_settings.value_type CHECK (6 values)
 * FEAT-DB-043: FK constraints — accounts→characters, content→hypotheses
 * FEAT-DB-044: updated_at triggers
 * FEAT-DB-045: indexes — accounts table
 * FEAT-DB-046: indexes — content table
 * FEAT-DB-047: HNSW vector index — hypotheses.embedding
 * FEAT-DB-049: content_learnings table + 4 indexes
 * Tests: TEST-DB-043 through TEST-DB-057
 */
import { withClient } from '../../helpers/db';

describe('FEAT-DB-038: system_settings table structure', () => {
  // TEST-DB-043
  test('TEST-DB-043: system_settings has correct 9 columns', async () => {
    const expected = [
      { column_name: 'setting_key', data_type: 'character varying' },
      { column_name: 'setting_value', data_type: 'jsonb' },
      { column_name: 'category', data_type: 'character varying' },
      { column_name: 'description', data_type: 'text' },
      { column_name: 'default_value', data_type: 'jsonb' },
      { column_name: 'value_type', data_type: 'character varying' },
      { column_name: 'constraints', data_type: 'jsonb' },
      { column_name: 'updated_at', data_type: 'timestamp with time zone' },
      { column_name: 'updated_by', data_type: 'character varying' },
    ];
    await withClient(async (c) => {
      const res = await c.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'system_settings' ORDER BY ordinal_position"
      );
      expect(res.rows).toHaveLength(9);
      for (const exp of expected) {
        const col = res.rows.find((r: any) => r.column_name === exp.column_name);
        expect(col).toBeDefined();
        expect(col.data_type).toBe(exp.data_type);
      }
    });
  });
});

describe('FEAT-DB-039: system_settings.category CHECK', () => {
  // TEST-DB-044
  test('TEST-DB-044: category CHECK constraint has 8 values', async () => {
    await withClient(async (c) => {
      const res = await c.query(`
        SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
        WHERE conrelid = 'system_settings'::regclass AND conname = 'system_settings_category_check'
      `);
      expect(res.rows).toHaveLength(1);
      for (const val of ['production', 'posting', 'agent', 'measurement', 'dashboard', 'credentials', 'cost_control', 'review']) {
        expect(res.rows[0].def).toContain(val);
      }
    });
  });
});

describe('FEAT-DB-040: system_settings.value_type CHECK', () => {
  // TEST-DB-045
  test('TEST-DB-045: value_type CHECK constraint has 6 values', async () => {
    await withClient(async (c) => {
      const res = await c.query(`
        SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
        WHERE conrelid = 'system_settings'::regclass AND conname = 'system_settings_value_type_check'
      `);
      expect(res.rows).toHaveLength(1);
      for (const val of ['integer', 'float', 'boolean', 'string', 'json', 'enum']) {
        expect(res.rows[0].def).toContain(val);
      }
    });
  });
});

describe('FEAT-DB-043: FK constraints', () => {
  // TEST-DB-049: accounts.character_id → characters.character_id
  test('TEST-DB-049: accounts FK to characters enforced', async () => {
    await withClient(async (c) => {
      await expect(
        c.query("INSERT INTO accounts (account_id, platform, character_id) VALUES ('FK_TEST1', 'youtube', 'NONEXIST')")
      ).rejects.toThrow(/foreign key constraint/);
    });
  });

  // TEST-DB-050: content.hypothesis_id → hypotheses.id (NULLable)
  test('TEST-DB-050: content FK to hypotheses enforced, NULL allowed', async () => {
    await withClient(async (c) => {
      await expect(
        c.query("INSERT INTO content (content_id, content_format, hypothesis_id) VALUES ('FK_TEST2', 'short_video', 999999)")
      ).rejects.toThrow(/foreign key constraint/);

      // NULL FK is fine
      await c.query("INSERT INTO content (content_id, content_format, hypothesis_id) VALUES ('FK_TEST3', 'short_video', NULL)");
      await c.query("DELETE FROM content WHERE content_id IN ('FK_TEST3')");
    });
  });
});

describe('FEAT-DB-044: updated_at triggers', () => {
  // TEST-DB-051
  test('TEST-DB-051: updated_at auto-updates on UPDATE', async () => {
    await withClient(async (c) => {
      await c.query("INSERT INTO accounts (account_id, platform) VALUES ('TRIG_T01', 'youtube')");
      const before = await c.query("SELECT updated_at FROM accounts WHERE account_id = 'TRIG_T01'");
      const beforeTs = before.rows[0].updated_at;

      // Small delay
      await new Promise(r => setTimeout(r, 50));
      await c.query("UPDATE accounts SET platform_username = 'updated' WHERE account_id = 'TRIG_T01'");

      const after = await c.query("SELECT updated_at FROM accounts WHERE account_id = 'TRIG_T01'");
      const afterTs = after.rows[0].updated_at;
      expect(new Date(afterTs).getTime()).toBeGreaterThan(new Date(beforeTs).getTime());

      await c.query("DELETE FROM accounts WHERE account_id = 'TRIG_T01'");
    });
  });
});

describe('FEAT-DB-045: accounts indexes', () => {
  // TEST-DB-052
  test('TEST-DB-052: accounts has required indexes', async () => {
    const expectedIndexes = [
      'idx_accounts_character', 'idx_accounts_cluster', 'idx_accounts_niche',
      'idx_accounts_platform', 'idx_accounts_platform_status', 'idx_accounts_status'
    ];
    await withClient(async (c) => {
      const res = await c.query("SELECT indexname FROM pg_indexes WHERE tablename = 'accounts' ORDER BY indexname");
      const indexes = res.rows.map((r: any) => r.indexname);
      for (const idx of expectedIndexes) {
        expect(indexes).toContain(idx);
      }
    });
  });
});

describe('FEAT-DB-046: content indexes', () => {
  // TEST-DB-053
  test('TEST-DB-053: content has required indexes', async () => {
    const expectedIndexes = [
      'idx_content_character', 'idx_content_created_at', 'idx_content_format',
      'idx_content_format_status', 'idx_content_hypothesis', 'idx_content_planned_date',
      'idx_content_production_metadata', 'idx_content_quality_score', 'idx_content_recipe',
      'idx_content_review_status', 'idx_content_status', 'idx_content_status_planned_date'
    ];
    await withClient(async (c) => {
      const res = await c.query("SELECT indexname FROM pg_indexes WHERE tablename = 'content' ORDER BY indexname");
      const indexes = res.rows.map((r: any) => r.indexname);
      for (const idx of expectedIndexes) {
        expect(indexes).toContain(idx);
      }
    });
  });
});

describe('FEAT-DB-047: HNSW vector indexes', () => {
  // TEST-DB-054
  test('TEST-DB-054: HNSW vector indexes exist on embedding columns', async () => {
    await withClient(async (c) => {
      const res = await c.query(
        "SELECT indexname FROM pg_indexes WHERE indexdef LIKE '%hnsw%' ORDER BY indexname"
      );
      const indexNames = res.rows.map((r: any) => r.indexname);
      // Must have vector indexes on these tables
      expect(indexNames).toContain('idx_hypotheses_embedding');
      expect(indexNames).toContain('idx_market_intel_embedding');
      expect(indexNames).toContain('idx_learnings_embedding');
      expect(indexNames).toContain('idx_individual_learnings_embedding');
      expect(indexNames).toContain('idx_content_learnings_embedding');
    });
  });
});

describe('FEAT-DB-049: content_learnings table + indexes', () => {
  test('content_learnings table exists with correct structure', async () => {
    await withClient(async (c) => {
      const res = await c.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'content_learnings' ORDER BY ordinal_position"
      );
      const cols = res.rows.map((r: any) => r.column_name);
      expect(cols).toContain('id');
      expect(cols).toContain('content_id');
      expect(cols).toContain('hypothesis_id');
      expect(cols).toContain('predicted_kpis');
      expect(cols).toContain('actual_kpis');
      expect(cols).toContain('micro_verdict');
      expect(cols).toContain('embedding');
      expect(cols).toContain('niche');
    });
  });

  test('content_learnings has 4 required indexes', async () => {
    await withClient(async (c) => {
      const res = await c.query("SELECT indexname FROM pg_indexes WHERE tablename = 'content_learnings' ORDER BY indexname");
      const indexes = res.rows.map((r: any) => r.indexname);
      expect(indexes).toContain('idx_content_learnings_embedding');
      expect(indexes).toContain('idx_content_learnings_niche');
      expect(indexes).toContain('idx_content_learnings_verdict');
      expect(indexes).toContain('idx_content_learnings_created');
    });
  });
});
