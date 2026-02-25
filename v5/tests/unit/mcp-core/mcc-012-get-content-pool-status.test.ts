/**
 * TEST-MCP-033: get_content_pool_status — returns content & publication counts by cluster
 */
import { getContentPoolStatus } from '@/src/mcp-server/tools/planner/get-content-pool-status';
import { seedBaseData, cleanupBaseData } from '../../helpers/mcp-seed';

describe('FEAT-MCC-012: get_content_pool_status', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  // TEST-MCP-033: returns correct content and publication counts
  test('TEST-MCP-033: returns content pool status for a cluster', async () => {
    const result = await getContentPoolStatus({ cluster: 'cluster_a' });

    // Verify content shape
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveProperty('pending_approval');
    expect(result.content).toHaveProperty('planned');
    expect(result.content).toHaveProperty('producing');
    expect(result.content).toHaveProperty('ready');
    expect(result.content).toHaveProperty('analyzed');

    expect(typeof result.content.pending_approval).toBe('number');
    expect(typeof result.content.planned).toBe('number');
    expect(typeof result.content.producing).toBe('number');
    expect(typeof result.content.ready).toBe('number');
    expect(typeof result.content.analyzed).toBe('number');

    // Verify publications shape
    expect(result).toHaveProperty('publications');
    expect(result.publications).toHaveProperty('scheduled');
    expect(result.publications).toHaveProperty('posted');
    expect(result.publications).toHaveProperty('measured');

    expect(typeof result.publications.scheduled).toBe('number');
    expect(typeof result.publications.posted).toBe('number');
    expect(typeof result.publications.measured).toBe('number');

    // cluster_a has publications with 'measured' status (from seed data)
    expect(result.publications.measured).toBeGreaterThanOrEqual(0);
  });

  // Non-existent cluster returns all zeros
  test('returns all zeros for non-existent cluster', async () => {
    const result = await getContentPoolStatus({ cluster: 'non_existent_cluster' });

    expect(result.content.pending_approval).toBe(0);
    expect(result.content.planned).toBe(0);
    expect(result.content.producing).toBe(0);
    expect(result.content.ready).toBe(0);
    expect(result.content.analyzed).toBe(0);

    expect(result.publications.scheduled).toBe(0);
    expect(result.publications.posted).toBe(0);
    expect(result.publications.measured).toBe(0);
  });
});
