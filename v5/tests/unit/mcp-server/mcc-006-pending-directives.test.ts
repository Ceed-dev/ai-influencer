/**
 * Tests for get_pending_directives
 */
import { getPendingDirectives } from '@/src/mcp-server/tools/strategy/get-pending-directives';
import { withClient } from '../../helpers/db';

const PREFIX = 'TDIR_';

describe('get_pending_directives', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM human_directives WHERE content LIKE '${PREFIX}%'`);
      await client.query(`
        INSERT INTO human_directives (directive_type, content, priority, status)
        VALUES
          ('instruction', '${PREFIX}urgent_directive', 'urgent', 'pending'),
          ('hypothesis', '${PREFIX}normal_directive', 'normal', 'pending'),
          ('instruction', '${PREFIX}low_directive', 'low', 'pending'),
          ('instruction', '${PREFIX}applied_directive', 'high', 'applied')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM human_directives WHERE content LIKE '${PREFIX}%'`);
    });
  });

  test('returns only pending directives', async () => {
    const result = await getPendingDirectives({});
    const testResults = result.directives.filter(d => d.content.startsWith(PREFIX));
    // Should not include the 'applied' directive
    expect(testResults.find(d => d.content.includes('applied'))).toBeUndefined();
    expect(testResults.length).toBe(3);
  });

  test('returns directives ordered by priority', async () => {
    const result = await getPendingDirectives({});
    const testResults = result.directives.filter(d => d.content.startsWith(PREFIX));
    // Urgent should come before normal, which comes before low
    const urgentIdx = testResults.findIndex(d => d.content.includes('urgent'));
    const normalIdx = testResults.findIndex(d => d.content.includes('normal'));
    const lowIdx = testResults.findIndex(d => d.content.includes('low'));
    expect(urgentIdx).toBeLessThan(normalIdx);
    expect(normalIdx).toBeLessThan(lowIdx);
  });

  test('returns correct structure', async () => {
    const result = await getPendingDirectives({});
    expect(result).toHaveProperty('directives');
    if (result.directives.length > 0) {
      const d = result.directives[0]!;
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('directive_type');
      expect(d).toHaveProperty('content');
      expect(d).toHaveProperty('priority');
      expect(d).toHaveProperty('created_at');
      expect(typeof d.priority).toBe('number');
    }
  });
});
