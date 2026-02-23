/**
 * FEAT-DB-012: content.status CHECK (12 values)
 * FEAT-DB-013: content.content_format CHECK
 * FEAT-DB-014: content.quality_score CHECK (0-10)
 * FEAT-DB-015: content.rejection_category CHECK
 * FEAT-DB-016: content.review_status CHECK + default
 * Tests: TEST-DB-015 through TEST-DB-020
 */
import { withClient } from '../../helpers/db';

let counter = 0;
const uniqueId = () => `CX${(++counter).toString().padStart(3, '0')}`;

describe('content table constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM content WHERE content_id LIKE 'CX%'");
    });
  });

  // TEST-DB-015: content.status CHECK (12 values)
  test('TEST-DB-015: all 12 status values accepted, invalid rejected', async () => {
    const validStatuses = [
      'planned', 'producing', 'ready', 'pending_review', 'pending_approval',
      'approved', 'rejected', 'revision_needed', 'posted', 'measured', 'cancelled', 'analyzed'
    ];
    await withClient(async (c) => {
      for (const status of validStatuses) {
        const id = uniqueId();
        await c.query("INSERT INTO content (content_id, content_format, status) VALUES ($1, 'short_video', $2)", [id, status]);
      }
      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO content (content_id, content_format, status) VALUES ($1, 'short_video', 'draft')", [invalidId])
      ).rejects.toThrow(/chk_content_status/);
    });
  });

  // TEST-DB-016: content.status default
  test('TEST-DB-016: status defaults to planned', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await c.query("INSERT INTO content (content_id, content_format) VALUES ($1, 'short_video')", [id]);
      const res = await c.query("SELECT status FROM content WHERE content_id = $1", [id]);
      expect(res.rows[0].status).toBe('planned');
    });
  });

  // TEST-DB-017: content.content_format CHECK
  test('TEST-DB-017: valid content_format values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const fmt of ['short_video', 'text_post', 'image_post']) {
        const id = uniqueId();
        await c.query("INSERT INTO content (content_id, content_format) VALUES ($1, $2)", [id, fmt]);
      }
      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO content (content_id, content_format) VALUES ($1, 'reel')", [invalidId])
      ).rejects.toThrow(/chk_content_format/);
    });
  });

  // TEST-DB-018: content.quality_score CHECK (0-10)
  test('TEST-DB-018: quality_score range 0-10 enforced, NULL allowed', async () => {
    await withClient(async (c) => {
      for (const score of [0, 10, 8.5]) {
        const id = uniqueId();
        await c.query("INSERT INTO content (content_id, content_format, quality_score) VALUES ($1, 'short_video', $2)", [id, score]);
      }
      // NULL allowed
      const nullId = uniqueId();
      await c.query("INSERT INTO content (content_id, content_format, quality_score) VALUES ($1, 'short_video', NULL)", [nullId]);

      const lowId = uniqueId();
      await expect(
        c.query("INSERT INTO content (content_id, content_format, quality_score) VALUES ($1, 'short_video', -1)", [lowId])
      ).rejects.toThrow(/chk_content_quality_score/);

      const highId = uniqueId();
      await expect(
        c.query("INSERT INTO content (content_id, content_format, quality_score) VALUES ($1, 'short_video', 10.1)", [highId])
      ).rejects.toThrow(/chk_content_quality_score/);
    });
  });

  // TEST-DB-019: content.rejection_category CHECK
  test('TEST-DB-019: valid rejection_category values + NULL succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const cat of ['plan_revision', 'data_insufficient', 'hypothesis_weak']) {
        const id = uniqueId();
        await c.query("INSERT INTO content (content_id, content_format, rejection_category) VALUES ($1, 'short_video', $2)", [id, cat]);
      }
      // NULL allowed
      const nullId = uniqueId();
      await c.query("INSERT INTO content (content_id, content_format, rejection_category) VALUES ($1, 'short_video', NULL)", [nullId]);

      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO content (content_id, content_format, rejection_category) VALUES ($1, 'short_video', 'quality_low')", [invalidId])
      ).rejects.toThrow(/chk_content_rejection_category/);
    });
  });

  // TEST-DB-020: content.review_status CHECK + default
  test('TEST-DB-020: review_status defaults to not_required, invalid rejected', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await c.query("INSERT INTO content (content_id, content_format) VALUES ($1, 'short_video')", [id]);
      const res = await c.query("SELECT review_status FROM content WHERE content_id = $1", [id]);
      expect(res.rows[0].review_status).toBe('not_required');

      for (const st of ['not_required', 'pending_review', 'approved', 'rejected']) {
        const sid = uniqueId();
        await c.query("INSERT INTO content (content_id, content_format, review_status) VALUES ($1, 'short_video', $2)", [sid, st]);
      }

      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO content (content_id, content_format, review_status) VALUES ($1, 'short_video', 'auto_approved')", [invalidId])
      ).rejects.toThrow(/chk_content_review_status/);
    });
  });
});
