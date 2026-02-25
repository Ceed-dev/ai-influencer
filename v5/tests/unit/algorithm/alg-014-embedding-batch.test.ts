/**
 * FEAT-ALG-014: Embedding batch regeneration
 * Tests: TEST-ALG-021
 *
 * Tests the configuration and text extraction logic.
 * Pure-function tests for table configs — no DB required.
 */
import {
  EMBEDDING_TABLES,
  generateEmbedding,
} from '../../../src/workers/algorithm/embedding-batch';

describe('FEAT-ALG-014: Embedding batch regeneration', () => {
  // TEST-ALG-021: 5 tables configured for embedding regeneration
  test('TEST-ALG-021: exactly 5 tables configured', () => {
    expect(EMBEDDING_TABLES).toHaveLength(5);
    const tableNames = EMBEDDING_TABLES.map(t => t.tableName);
    expect(tableNames).toContain('learnings');
    expect(tableNames).toContain('market_intel');
    expect(tableNames).toContain('agent_individual_learnings');
    expect(tableNames).toContain('content_learnings');
    expect(tableNames).toContain('components');
  });

  test('learnings — text source is insight column', () => {
    const config = EMBEDDING_TABLES.find(t => t.tableName === 'learnings');
    expect(config).toBeDefined();
    const text = config?.textSourceFn({ id: 1, insight: 'Short videos perform 2x better at 7pm' });
    expect(text).toBe('Short videos perform 2x better at 7pm');
  });

  test('market_intel — text source is JSON.stringify(data)', () => {
    const config = EMBEDDING_TABLES.find(t => t.tableName === 'market_intel');
    expect(config).toBeDefined();
    const data = { trend: 'AI fitness', volume: 5000 };
    const text = config?.textSourceFn({ id: 1, data });
    expect(text).toBe(JSON.stringify(data));
  });

  test('agent_individual_learnings — text source is content column', () => {
    const config = EMBEDDING_TABLES.find(t => t.tableName === 'agent_individual_learnings');
    expect(config).toBeDefined();
    const text = config?.textSourceFn({ id: 'uuid-123', content: 'Hook type A works best for beauty niche' });
    expect(text).toBe('Hook type A works best for beauty niche');
  });

  test('content_learnings — text source is key_insight column', () => {
    const config = EMBEDDING_TABLES.find(t => t.tableName === 'content_learnings');
    expect(config).toBeDefined();
    const text = config?.textSourceFn({ id: 'uuid-456', key_insight: 'Engagement peaks on Tuesdays' });
    expect(text).toBe('Engagement peaks on Tuesdays');
  });

  test('components — text source is name + description', () => {
    const config = EMBEDDING_TABLES.find(t => t.tableName === 'components');
    expect(config).toBeDefined();
    const text = config?.textSourceFn({ id: 1, name: 'Beauty Hook', description: 'Opening scene for beauty content' });
    expect(text).toBe('Beauty Hook Opening scene for beauty content');
  });

  test('components — handles null description', () => {
    const config = EMBEDDING_TABLES.find(t => t.tableName === 'components');
    expect(config).toBeDefined();
    const text = config?.textSourceFn({ id: 1, name: 'Tech CTA', description: null });
    expect(text).toBe('Tech CTA');
  });

  test('empty text source returns empty string', () => {
    const config = EMBEDDING_TABLES.find(t => t.tableName === 'learnings');
    expect(config).toBeDefined();
    const text = config?.textSourceFn({ id: 1, insight: null });
    expect(text).toBe('');
  });

  test('generateEmbedding returns 1536-dimension vector', async () => {
    const embedding = await generateEmbedding('test text');
    expect(embedding).toHaveLength(1536);
  });

  test('each table has an idColumn and selectColumns', () => {
    for (const config of EMBEDDING_TABLES) {
      expect(config.idColumn).toBeTruthy();
      expect(config.selectColumns.length).toBeGreaterThan(0);
      expect(config.selectColumns).toContain(config.idColumn);
    }
  });
});
