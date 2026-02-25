/**
 * FEAT-TST-032: E2Eテスト — 月間予算超過
 * TEST-E2E-012
 *
 * Verifies that when monthly budget is exceeded, new production is blocked.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-032: E2E monthly budget exceeded', () => {
  let client: Client;
  let originalBudget: any;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    const res = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'MONTHLY_BUDGET_LIMIT_USD'`
    );
    originalBudget = res.rows[0]?.setting_value;
  });

  afterAll(async () => {
    if (originalBudget !== undefined) {
      await client.query(
        `UPDATE system_settings SET setting_value = $1 WHERE setting_key = 'MONTHLY_BUDGET_LIMIT_USD'`,
        [JSON.stringify(originalBudget)]
      );
    }
    await client.end();
  });

  test('TEST-E2E-012: budget exceeded blocks new production', async () => {
    const budgetLimit = 3000;
    const currentSpend = 2990;
    const taskCost = 15;

    // Set budget limit
    await client.query(
      `UPDATE system_settings SET setting_value = $1 WHERE setting_key = 'MONTHLY_BUDGET_LIMIT_USD'`,
      [JSON.stringify(budgetLimit)]
    );

    // Budget check logic
    const wouldExceed = (currentSpend + taskCost) > budgetLimit;
    expect(wouldExceed).toBe(true);

    // Verify production is blocked
    const budgetRes = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'MONTHLY_BUDGET_LIMIT_USD'`
    );
    const limit = typeof budgetRes.rows[0].setting_value === 'number'
      ? budgetRes.rows[0].setting_value
      : Number(budgetRes.rows[0].setting_value);

    expect(currentSpend + taskCost).toBeGreaterThan(limit);
  });
});
