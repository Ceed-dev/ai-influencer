/**
 * TEST-MCP-027: get_assigned_accounts — cluster filter returns active accounts
 * TEST-MCP-118: get_assigned_accounts — empty cluster returns empty array
 */
import { getAssignedAccounts } from '@/src/mcp-server/tools/planner/get-assigned-accounts';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';

describe('FEAT-MCC-007: get_assigned_accounts', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  // TEST-MCP-027: cluster_a returns only active accounts in that cluster
  test('TEST-MCP-027: returns active accounts for a given cluster', async () => {
    const result = await getAssignedAccounts({ cluster: 'cluster_a' });

    expect(result).toHaveProperty('accounts');
    expect(Array.isArray(result.accounts)).toBe(true);

    // cluster_a has ACC_001 (active) and ACC_002 (active)
    expect(result.accounts.length).toBe(2);

    for (const account of result.accounts) {
      expect(account).toHaveProperty('account_id');
      expect(account).toHaveProperty('platform');
      expect(account).toHaveProperty('niche');
      expect(account).toHaveProperty('follower_count');
      expect(account).toHaveProperty('status');
      expect(account.status).toBe('active');
      expect(account.account_id).toMatch(new RegExp(`^${PREFIX}`));
    }
  });

  // TEST-MCP-118: non-existent cluster returns empty array
  test('TEST-MCP-118: returns empty array for non-existent cluster', async () => {
    const result = await getAssignedAccounts({ cluster: 'non_existent_cluster' });

    expect(result).toHaveProperty('accounts');
    expect(result.accounts).toEqual([]);
  });

  // cluster_b has ACC_003 (active) and ACC_004 (suspended)
  test('excludes suspended accounts from cluster_b', async () => {
    const result = await getAssignedAccounts({ cluster: 'cluster_b' });

    expect(result.accounts.length).toBe(1);
    expect(result.accounts[0]?.status).toBe('active');
    // The suspended ACC_004 should not appear
    const accountIds = result.accounts.map((a) => a.account_id);
    expect(accountIds).not.toContain(`${PREFIX}ACC_004`);
  });
});
