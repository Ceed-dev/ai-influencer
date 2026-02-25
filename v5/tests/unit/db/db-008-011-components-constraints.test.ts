/**
 * FEAT-DB-008: components.type CHECK
 * FEAT-DB-009: components.score CHECK (0.00-100.00)
 * FEAT-DB-010: components.curated_by CHECK + default
 * FEAT-DB-011: components.review_status CHECK + default
 * Tests: TEST-DB-011 through TEST-DB-014
 */
import { withClient } from '../../helpers/db';

let counter = 0;
const uniqueId = () => `CP${(++counter).toString().padStart(3, '0')}`;

describe('components table constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM components WHERE component_id LIKE 'CP%'");
    });
  });

  // TEST-DB-011: components.type CHECK
  test('TEST-DB-011: valid type values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const type of ['scenario', 'motion', 'audio', 'image']) {
        const id = uniqueId();
        await c.query("INSERT INTO components (component_id, type, name) VALUES ($1, $2, 'Test')", [id, type]);
      }
      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO components (component_id, type, name) VALUES ($1, 'video', 'Test')", [invalidId])
      ).rejects.toThrow(/chk_components_type/);
    });
  });

  // TEST-DB-012: components.score CHECK (0.00-100.00)
  test('TEST-DB-012: score range 0.00-100.00 enforced, NULL allowed', async () => {
    await withClient(async (c) => {
      // Valid values
      for (const score of [0.00, 100.00, 50.50]) {
        const id = uniqueId();
        await c.query("INSERT INTO components (component_id, type, name, score) VALUES ($1, 'scenario', 'Test', $2)", [id, score]);
      }
      // NULL allowed
      const nullId = uniqueId();
      await c.query("INSERT INTO components (component_id, type, name, score) VALUES ($1, 'scenario', 'Test', NULL)", [nullId]);

      // Invalid: below range
      const lowId = uniqueId();
      await expect(
        c.query("INSERT INTO components (component_id, type, name, score) VALUES ($1, 'scenario', 'Test', -0.01)", [lowId])
      ).rejects.toThrow(/components_score_check/);

      // Invalid: above range
      const highId = uniqueId();
      await expect(
        c.query("INSERT INTO components (component_id, type, name, score) VALUES ($1, 'scenario', 'Test', 100.01)", [highId])
      ).rejects.toThrow(/components_score_check/);
    });
  });

  // TEST-DB-013: components.curated_by CHECK + default
  test('TEST-DB-013: curated_by defaults to human, invalid value rejected', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await c.query("INSERT INTO components (component_id, type, name) VALUES ($1, 'scenario', 'Test')", [id]);
      const res = await c.query("SELECT curated_by FROM components WHERE component_id = $1", [id]);
      expect(res.rows[0].curated_by).toBe('human');

      const autoId = uniqueId();
      await c.query("INSERT INTO components (component_id, type, name, curated_by) VALUES ($1, 'scenario', 'Test', 'auto')", [autoId]);

      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO components (component_id, type, name, curated_by) VALUES ($1, 'scenario', 'Test', 'system')", [invalidId])
      ).rejects.toThrow(/chk_components_curated_by/);
    });
  });

  // TEST-DB-014: components.review_status CHECK + default
  test('TEST-DB-014: review_status defaults to auto_approved, invalid rejected', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await c.query("INSERT INTO components (component_id, type, name) VALUES ($1, 'scenario', 'Test')", [id]);
      const res = await c.query("SELECT review_status FROM components WHERE component_id = $1", [id]);
      expect(res.rows[0].review_status).toBe('auto_approved');

      for (const status of ['auto_approved', 'pending_review', 'human_approved']) {
        const sid = uniqueId();
        await c.query("INSERT INTO components (component_id, type, name, review_status) VALUES ($1, 'scenario', 'Test', $2)", [sid, status]);
      }

      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO components (component_id, type, name, review_status) VALUES ($1, 'scenario', 'Test', 'rejected')", [invalidId])
      ).rejects.toThrow(/chk_components_review_status/);
    });
  });
});
