/**
 * TEST-MCP-003: get_cluster_performance — cluster-level performance comparison
 * FEAT-MCC-002
 */
import { getClusterPerformance } from '@/src/mcp-server/tools/strategy/get-cluster-performance';
import { seedBaseData, cleanupBaseData } from '../../helpers/mcp-seed';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-002: get_cluster_performance', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  test('TEST-MCP-003: returns clusters array with required fields for period=7d', async () => {
    const result = await getClusterPerformance({ period: '7d' });

    expect(result).toHaveProperty('clusters');
    expect(Array.isArray(result.clusters)).toBe(true);

    // Seeded data has cluster_a and cluster_b
    expect(result.clusters.length).toBeGreaterThanOrEqual(2);

    for (const cluster of result.clusters) {
      expect(cluster).toHaveProperty('cluster');
      expect(cluster).toHaveProperty('account_count');
      expect(cluster).toHaveProperty('avg_views');
      expect(cluster).toHaveProperty('avg_engagement');

      expect(typeof cluster.cluster).toBe('string');
      expect(typeof cluster.account_count).toBe('number');
      expect(typeof cluster.avg_views).toBe('number');
      expect(typeof cluster.avg_engagement).toBe('number');

      expect(cluster.account_count).toBeGreaterThanOrEqual(1);
      expect(cluster.avg_views).toBeGreaterThanOrEqual(0);
      expect(cluster.avg_engagement).toBeGreaterThanOrEqual(0);
    }
  });

  test('TEST-MCP-003: clusters are grouped correctly from seeded data', async () => {
    const result = await getClusterPerformance({ period: '7d' });

    const clusterA = result.clusters.find((c) => c.cluster === 'cluster_a');
    const clusterB = result.clusters.find((c) => c.cluster === 'cluster_b');

    // Seeded: cluster_a has ACC_001 and ACC_002 = 2 accounts
    expect(clusterA).toBeDefined();
    expect(clusterA!.account_count).toBe(2);

    // Seeded: cluster_b has ACC_003 and ACC_004 = 2 accounts
    expect(clusterB).toBeDefined();
    expect(clusterB!.account_count).toBe(2);
  });

  test('TEST-MCP-003: rejects invalid period', async () => {
    await expect(
      getClusterPerformance({ period: '30d' as any }),
    ).rejects.toThrow(McpValidationError);
  });
});
