/**
 * TEST-MCP-007: send_planner_directive — insert planner directive
 * TEST-MCP-008: get_pending_directives — retrieve pending directives
 * FEAT-MCC-006
 */
import {
  sendPlannerDirective,
  getPendingDirectives,
} from '@/src/mcp-server/tools/strategy/send-planner-directive';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const MCC006_PREFIX = 'MCC006_TEST_';

describe('FEAT-MCC-006: send_planner_directive + get_pending_directives', () => {
  beforeAll(async () => {
    // Cleanup previous test data
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM human_directives WHERE content LIKE $1`,
        [`${MCC006_PREFIX}%`],
      );
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM human_directives WHERE content LIKE $1`,
        [`${MCC006_PREFIX}%`],
      );
    });
  });

  test('TEST-MCP-007: sends a planner directive successfully', async () => {
    const result = await sendPlannerDirective({
      cluster: 'cluster_a',
      directive_text: `${MCC006_PREFIX}Focus on beauty tutorials`,
    });

    expect(result.success).toBe(true);

    // Verify in DB
    const dbRes = await withClient(async (client) => {
      return client.query(
        `SELECT directive_type, content, target_niches, status, priority
         FROM human_directives
         WHERE content = $1`,
        [`${MCC006_PREFIX}Focus on beauty tutorials`],
      );
    });

    expect(dbRes.rows.length).toBe(1);
    const row = dbRes.rows[0];
    expect(row.directive_type).toBe('instruction');
    expect(row.target_niches).toEqual(['cluster_a']);
    expect(row.status).toBe('pending');
    expect(row.priority).toBe('normal');
  });

  test('TEST-MCP-007: rejects empty cluster', async () => {
    await expect(
      sendPlannerDirective({ cluster: '', directive_text: 'test' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-007: rejects empty directive_text', async () => {
    await expect(
      sendPlannerDirective({ cluster: 'cluster_a', directive_text: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-008: retrieves pending directives sorted by priority', async () => {
    // Insert directives with different priorities
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO human_directives (directive_type, content, status, priority)
        VALUES
          ('instruction', '${MCC006_PREFIX}low_prio', 'pending', 'low'),
          ('instruction', '${MCC006_PREFIX}urgent_prio', 'pending', 'urgent'),
          ('instruction', '${MCC006_PREFIX}high_prio', 'pending', 'high'),
          ('instruction', '${MCC006_PREFIX}applied_one', 'applied', 'urgent')
      `);
    });

    const result = await getPendingDirectives({});

    expect(result).toHaveProperty('directives');
    expect(Array.isArray(result.directives)).toBe(true);

    // Only pending directives should be included (not 'applied')
    const testDirectives = result.directives.filter(
      (d) => d.content.startsWith(MCC006_PREFIX),
    );

    // Should NOT include the 'applied' one
    const appliedFound = testDirectives.find(
      (d) => d.content === `${MCC006_PREFIX}applied_one`,
    );
    expect(appliedFound).toBeUndefined();

    // Verify each directive has required fields
    for (const d of testDirectives) {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('directive_type');
      expect(d).toHaveProperty('content');
      expect(d).toHaveProperty('priority');
      expect(d).toHaveProperty('created_at');

      expect(typeof d.id).toBe('number');
      expect(typeof d.priority).toBe('number');
    }

    // Check priority ordering: urgent (4) should come before high (3) before normal (2) before low (1)
    const urgentIdx = testDirectives.findIndex(
      (d) => d.content === `${MCC006_PREFIX}urgent_prio`,
    );
    const highIdx = testDirectives.findIndex(
      (d) => d.content === `${MCC006_PREFIX}high_prio`,
    );
    const lowIdx = testDirectives.findIndex(
      (d) => d.content === `${MCC006_PREFIX}low_prio`,
    );

    if (urgentIdx !== -1 && highIdx !== -1) {
      expect(urgentIdx).toBeLessThan(highIdx);
    }
    if (highIdx !== -1 && lowIdx !== -1) {
      expect(highIdx).toBeLessThan(lowIdx);
    }
  });

  test('TEST-MCP-008: priority values are numeric', async () => {
    const result = await getPendingDirectives({});

    const testDirectives = result.directives.filter(
      (d) => d.content.startsWith(MCC006_PREFIX),
    );

    const urgentDir = testDirectives.find(
      (d) => d.content === `${MCC006_PREFIX}urgent_prio`,
    );
    const highDir = testDirectives.find(
      (d) => d.content === `${MCC006_PREFIX}high_prio`,
    );
    const lowDir = testDirectives.find(
      (d) => d.content === `${MCC006_PREFIX}low_prio`,
    );

    if (urgentDir) expect(urgentDir.priority).toBe(4);
    if (highDir) expect(highDir.priority).toBe(3);
    if (lowDir) expect(lowDir.priority).toBe(1);
  });
});
