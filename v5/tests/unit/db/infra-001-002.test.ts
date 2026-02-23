/**
 * FEAT-INF-001: Docker Compose development environment
 * FEAT-INF-002: Environment variables + TypeScript config
 * Tests: TEST-DB-001 (reused), TEST-INT-001 (partial)
 */
import { withClient } from '../../helpers/db';
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-INF-001: Docker Compose development environment', () => {
  test('docker-compose.yml exists with required services', () => {
    const dcPath = path.resolve(__dirname, '../../../docker-compose.yml');
    expect(fs.existsSync(dcPath)).toBe(true);
    const content = fs.readFileSync(dcPath, 'utf8');
    expect(content).toContain('pgvector/pgvector:pg16');
    expect(content).toContain('pgbouncer');
    expect(content).toContain('healthcheck');
  });

  test('PostgreSQL is reachable via Docker', async () => {
    await withClient(async (c) => {
      const res = await c.query('SELECT 1 AS ok');
      expect(res.rows[0].ok).toBe(1);
    });
  });
});

describe('FEAT-INF-002: Environment + TypeScript config', () => {
  test('.env exists with required variables', () => {
    const envPath = path.resolve(__dirname, '../../../.env');
    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, 'utf8');
    expect(content).toContain('DATABASE_URL');
    expect(content).toContain('ANTHROPIC_API_KEY');
    expect(content).toContain('NODE_ENV');
  });

  test('tsconfig.json exists with correct settings', () => {
    const tscPath = path.resolve(__dirname, '../../../tsconfig.json');
    expect(fs.existsSync(tscPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(tscPath, 'utf8'));
    expect(config.compilerOptions.target).toBe('ES2022');
    expect(config.compilerOptions.strict).toBe(true);
    expect(config.compilerOptions.module).toBe('Node16');
  });

  test('package.json has required scripts and dependencies', () => {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.dependencies['drizzle-orm']).toBeDefined();
    expect(pkg.dependencies['pg']).toBeDefined();
    expect(pkg.dependencies['zod']).toBeDefined();
  });
});
