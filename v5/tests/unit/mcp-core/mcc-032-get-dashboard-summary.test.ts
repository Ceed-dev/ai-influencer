/**
 * TEST-MCP-032: get_dashboard_summary — returns composed summary
 * FEAT-MCC-032
 */
import { getDashboardSummary } from '@/src/mcp-server/tools/dashboard/get-dashboard-summary';
import { seedBaseData, cleanupBaseData } from '../../helpers/mcp-seed';

describe('FEAT-MCC-032: get_dashboard_summary', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  test('TEST-MCP-032a: returns dashboard summary with correct structure', async () => {
    const result = await getDashboardSummary({});

    expect(result).toHaveProperty('kpi');
    expect(result).toHaveProperty('algorithm_accuracy');
    expect(result).toHaveProperty('active_cycles');
    expect(result).toHaveProperty('pending_tasks');

    // KPI sub-object
    expect(result.kpi).toHaveProperty('total_accounts');
    expect(result.kpi).toHaveProperty('active_accounts');
    expect(result.kpi).toHaveProperty('total_views');
    expect(result.kpi).toHaveProperty('avg_engagement_rate');
    expect(result.kpi).toHaveProperty('follower_growth');
    expect(result.kpi).toHaveProperty('monetized_count');

    expect(typeof result.kpi.total_accounts).toBe('number');
    expect(typeof result.algorithm_accuracy).toBe('number');
    expect(typeof result.active_cycles).toBe('number');
    expect(typeof result.pending_tasks).toBe('number');
  });

  test('TEST-MCP-032b: kpi accounts include seed data', async () => {
    const result = await getDashboardSummary({});

    // Seed data has 4 accounts, at least some should show
    expect(result.kpi.total_accounts).toBeGreaterThanOrEqual(1);
  });
});
