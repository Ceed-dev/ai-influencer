/**
 * FEAT-DB-003: accounts.platform CHECK constraint
 * FEAT-DB-004: accounts.status CHECK constraint + default
 * FEAT-DB-005: accounts.monetization_status CHECK constraint
 * FEAT-DB-006: accounts.account_id UNIQUE constraint
 * Tests: TEST-DB-003 through TEST-DB-008
 */
import { withClient } from '../../helpers/db';

let counter = 0;
const uniqueId = () => `AT${(++counter).toString().padStart(3, '0')}`;

describe('accounts table constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM accounts WHERE account_id LIKE 'AT%'");
    });
  });

  // TEST-DB-003: accounts.platform CHECK
  test('TEST-DB-003: valid platform succeeds, invalid fails', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await c.query("INSERT INTO accounts (account_id, platform, status) VALUES ($1, 'youtube', 'setup')", [id]);
      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO accounts (account_id, platform, status) VALUES ($1, 'facebook', 'setup')", [invalidId])
      ).rejects.toThrow(/chk_accounts_platform/);
    });
  });

  // TEST-DB-004: all 4 platform values accepted
  test('TEST-DB-004: all platform values accepted', async () => {
    await withClient(async (c) => {
      for (const platform of ['youtube', 'tiktok', 'instagram', 'x']) {
        const id = uniqueId();
        await c.query("INSERT INTO accounts (account_id, platform) VALUES ($1, $2)", [id, platform]);
      }
      const res = await c.query(
        "SELECT COUNT(*) as cnt FROM accounts WHERE account_id LIKE 'AT%' AND platform IN ('youtube','tiktok','instagram','x')"
      );
      expect(parseInt(res.rows[0].cnt)).toBeGreaterThanOrEqual(4);
    });
  });

  // TEST-DB-005: accounts.status CHECK
  test('TEST-DB-005: valid status values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const status of ['active', 'suspended', 'setup']) {
        const id = uniqueId();
        await c.query("INSERT INTO accounts (account_id, platform, status) VALUES ($1, 'youtube', $2)", [id, status]);
      }
      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO accounts (account_id, platform, status) VALUES ($1, 'youtube', 'deleted')", [invalidId])
      ).rejects.toThrow(/chk_accounts_status/);
    });
  });

  // TEST-DB-006: accounts.status default value
  test('TEST-DB-006: status defaults to setup', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await c.query("INSERT INTO accounts (account_id, platform) VALUES ($1, 'youtube')", [id]);
      const res = await c.query("SELECT status FROM accounts WHERE account_id = $1", [id]);
      expect(res.rows[0].status).toBe('setup');
    });
  });

  // TEST-DB-007: accounts.monetization_status CHECK
  test('TEST-DB-007: valid monetization_status values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const ms of ['none', 'eligible', 'active']) {
        const id = uniqueId();
        await c.query("INSERT INTO accounts (account_id, platform, monetization_status) VALUES ($1, 'youtube', $2)", [id, ms]);
      }
      const invalidId = uniqueId();
      await expect(
        c.query("INSERT INTO accounts (account_id, platform, monetization_status) VALUES ($1, 'youtube', 'pending')", [invalidId])
      ).rejects.toThrow(/chk_accounts_monetization/);
    });
  });

  // TEST-DB-008: accounts.account_id UNIQUE
  test('TEST-DB-008: duplicate account_id rejected', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await c.query("INSERT INTO accounts (account_id, platform) VALUES ($1, 'youtube')", [id]);
      await expect(
        c.query("INSERT INTO accounts (account_id, platform) VALUES ($1, 'tiktok')", [id])
      ).rejects.toThrow(/duplicate key value violates unique constraint/);
    });
  });
});
