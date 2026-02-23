/**
 * TEST-DSH-044: REST API — CORS設定
 */
import * as fs from 'fs';
import * as path from 'path';

describe('FEAT-DSH-034: REST API CORS configuration', () => {
  let middlewareContent: string;

  beforeAll(() => {
    middlewareContent = fs.readFileSync(
      path.join(__dirname, '../../../dashboard/middleware.ts'),
      'utf-8'
    );
  });

  // TEST-DSH-044: CORS headers
  test('TEST-DSH-044: CORS middleware is configured', () => {
    expect(middlewareContent).toContain('Access-Control-Allow-Origin');
    expect(middlewareContent).toContain('Access-Control-Allow-Methods');
    expect(middlewareContent).toContain('Access-Control-Allow-Headers');
  });

  test('supports required HTTP methods', () => {
    expect(middlewareContent).toContain('GET');
    expect(middlewareContent).toContain('POST');
    expect(middlewareContent).toContain('PUT');
    expect(middlewareContent).toContain('DELETE');
    expect(middlewareContent).toContain('OPTIONS');
  });

  test('handles preflight OPTIONS requests', () => {
    expect(middlewareContent).toContain('OPTIONS');
    expect(middlewareContent).toContain('204');
  });

  test('middleware targets API routes', () => {
    expect(middlewareContent).toContain('/api/');
    expect(middlewareContent).toContain('matcher');
  });
});
