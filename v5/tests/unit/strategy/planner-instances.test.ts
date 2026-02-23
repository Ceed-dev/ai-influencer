/**
 * Tests for FEAT-STR-010: Parallel planner instances
 */
import { distributeAccountsToPlanners } from '@/src/agents/strategy/planner-instances';

describe('STR-010: Planner instances', () => {
  test('one planner per cluster when clusters <= maxPlanners', () => {
    const accounts = [
      { accountId: 'A1', cluster: 'beauty' },
      { accountId: 'A2', cluster: 'beauty' },
      { accountId: 'A3', cluster: 'tech' },
    ];
    const instances = distributeAccountsToPlanners(accounts, 5);
    expect(instances.length).toBe(2);
    expect(instances[0]!.cluster).toBe('beauty');
    expect(instances[0]!.accountIds).toContain('A1');
    expect(instances[0]!.accountIds).toContain('A2');
    expect(instances[1]!.cluster).toBe('tech');
  });

  test('merges clusters when more clusters than maxPlanners', () => {
    const accounts = [
      { accountId: 'A1', cluster: 'beauty' },
      { accountId: 'A2', cluster: 'tech' },
      { accountId: 'A3', cluster: 'fitness' },
      { accountId: 'A4', cluster: 'gaming' },
    ];
    const instances = distributeAccountsToPlanners(accounts, 2);
    expect(instances.length).toBe(2);
    // All 4 accounts should be distributed
    const totalAccounts = instances.reduce((s, i) => s + i.accountCount, 0);
    expect(totalAccounts).toBe(4);
  });

  test('handles empty accounts', () => {
    const instances = distributeAccountsToPlanners([], 3);
    expect(instances.length).toBe(0);
  });

  test('uses default cluster for accounts without cluster', () => {
    const accounts = [
      { accountId: 'A1', cluster: '' },
      { accountId: 'A2', cluster: '' },
    ];
    const instances = distributeAccountsToPlanners(accounts, 3);
    expect(instances.length).toBe(1);
    expect(instances[0]!.cluster).toBe('default');
  });

  test('instance IDs are sequential', () => {
    const accounts = [
      { accountId: 'A1', cluster: 'a' },
      { accountId: 'A2', cluster: 'b' },
      { accountId: 'A3', cluster: 'c' },
    ];
    const instances = distributeAccountsToPlanners(accounts, 5);
    expect(instances.map((i) => i.instanceId)).toEqual([1, 2, 3]);
  });
});
