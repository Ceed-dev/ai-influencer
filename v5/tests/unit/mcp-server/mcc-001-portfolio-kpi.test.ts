/**
 * TEST-MCP-001: get_portfolio_kpi_summary — 正常系
 * TEST-MCP-002: get_portfolio_kpi_summary — period バリデーション
 */
import { getPortfolioKpiSummary } from '@/src/mcp-server/tools/strategy/get-portfolio-kpi-summary';
import { seedBaseData, cleanupBaseData } from '../../helpers/mcp-seed';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-001: get_portfolio_kpi_summary', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  // TEST-MCP-001: 正常系
  test('TEST-MCP-001: returns KPI summary with all required keys for period=7d', async () => {
    const result = await getPortfolioKpiSummary({ period: '7d' });

    expect(result).toHaveProperty('total_accounts');
    expect(result).toHaveProperty('active_accounts');
    expect(result).toHaveProperty('total_views');
    expect(result).toHaveProperty('avg_engagement_rate');
    expect(result).toHaveProperty('follower_growth');
    expect(result).toHaveProperty('monetized_count');

    expect(typeof result.total_accounts).toBe('number');
    expect(typeof result.active_accounts).toBe('number');
    expect(typeof result.total_views).toBe('number');
    expect(typeof result.avg_engagement_rate).toBe('number');
    expect(typeof result.follower_growth).toBe('number');
    expect(typeof result.monetized_count).toBe('number');

    expect(result.total_accounts).toBeGreaterThanOrEqual(0);
    expect(result.avg_engagement_rate).toBeGreaterThanOrEqual(0.0);
  });

  // TEST-MCP-002: period バリデーション
  test('TEST-MCP-002: accepts valid periods 7d and 30d', async () => {
    const result7d = await getPortfolioKpiSummary({ period: '7d' });
    expect(result7d.total_accounts).toBeGreaterThanOrEqual(0);

    const result30d = await getPortfolioKpiSummary({ period: '30d' });
    expect(result30d.total_accounts).toBeGreaterThanOrEqual(0);
  });

  test('TEST-MCP-002: rejects invalid period', async () => {
    await expect(
      getPortfolioKpiSummary({ period: '1y' as any }),
    ).rejects.toThrow(McpValidationError);
  });
});
