import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

export function createTestClient(): Client {
  return new Client({ connectionString: TEST_DB_URL });
}

export async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = createTestClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function query(sql: string, params?: unknown[]) {
  return withClient(client => client.query(sql, params));
}
