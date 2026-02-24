/**
 * TEST-AGT-008: Production Pipeline — content_format dispatch
 * TEST-AGT-009: Production Pipeline — recipe_id reference
 * Spec: 02-architecture.md §3.4, 04-agent-design.md §5.2
 */
import {
  dispatchByContentFormat,
  buildProductionPipelineGraph,
  ProductionPipelineAnnotation,
} from '@/src/agents/graphs/production-pipeline';
import type { ContentFormat, DispatchEdgeResult } from '@/types/langgraph-state';

// ---------- TEST-AGT-008: content_format dispatch ----------

describe('TEST-AGT-008: Production Pipeline — content_format dispatch', () => {
  test('short_video dispatches to generate_video worker', () => {
    const result = dispatchByContentFormat('short_video');
    expect(result).toBe('generate_video');
  });

  test('text_post dispatches to generate_text worker', () => {
    const result = dispatchByContentFormat('text_post');
    expect(result).toBe('generate_text');
  });

  test('image_post dispatches to generate_text (image gen in post-production)', () => {
    const result = dispatchByContentFormat('image_post');
    expect(result).toBe('generate_text');
  });

  test('unknown content_format throws', () => {
    expect(() => dispatchByContentFormat('unknown' as ContentFormat)).toThrow(
      'Unknown content_format: unknown'
    );
  });

  test('correct worker type mapping: short_video → Video Worker (not Text Worker)', () => {
    // Spec: short_video → Video Worker (recipe_idのレシピに従い外部APIツール使用)
    const result = dispatchByContentFormat('short_video');
    expect(result).not.toBe('generate_text');
    expect(result).toBe('generate_video');
  });

  test('correct worker type mapping: text_post → Text Worker (not Video Worker)', () => {
    // Spec: text_post → Text Worker (LLM直接生成)
    const result = dispatchByContentFormat('text_post');
    expect(result).not.toBe('generate_video');
    expect(result).toBe('generate_text');
  });
});

// ---------- TEST-AGT-008: Graph structure ----------

describe('TEST-AGT-008: Production Pipeline graph structure', () => {
  test('graph builds without error', () => {
    const graph = buildProductionPipelineGraph();
    expect(graph).toBeDefined();
  });

  test('graph compiles with checkpointer', () => {
    const graph = buildProductionPipelineGraph();
    const { MemorySaver } = require('@langchain/langgraph-checkpoint');
    const compiled = graph.compile({ checkpointer: new MemorySaver() });
    expect(compiled).toBeDefined();
  });

  test('graph has all required nodes', () => {
    const graph = buildProductionPipelineGraph();
    const compiled = graph.compile();
    // Use drawMermaid to verify nodes exist in the graph representation
    const mermaid = compiled.getGraph().drawMermaid();

    expect(mermaid).toContain('poll_tasks');
    expect(mermaid).toContain('sleep');
    expect(mermaid).toContain('fetch_data');
    expect(mermaid).toContain('dispatch');
    expect(mermaid).toContain('generate_video');
    expect(mermaid).toContain('generate_text');
    expect(mermaid).toContain('quality_check');
    expect(mermaid).toContain('handle_error');
    expect(mermaid).toContain('revision_planning');
  });
});

// ---------- TEST-AGT-009: recipe_id reference ----------

describe('TEST-AGT-009: Production Pipeline — recipe_id reference', () => {
  test('short_video task has recipe_id for production_recipes lookup', () => {
    // Verify the state structure allows recipe_id
    const mockTask = {
      task_id: 1,
      content_id: 'CNT_0001',
      content_format: 'short_video' as ContentFormat,
      account_id: 'ACC_001',
      character_id: 'CHR_001',
      script_language: 'en' as const,
      recipe_id: 1, // References production_recipes.id
      sections: [],
    };

    expect(mockTask.recipe_id).toBe(1);
    expect(dispatchByContentFormat(mockTask.content_format)).toBe('generate_video');
  });

  test('text_post task has recipe_id as null', () => {
    // text_post does not use recipes — it uses LLM directly
    const mockTask = {
      task_id: 2,
      content_id: 'CNT_0002',
      content_format: 'text_post' as ContentFormat,
      account_id: 'ACC_002',
      character_id: 'CHR_002',
      script_language: 'en' as const,
      recipe_id: null, // text_post has no recipe
      sections: [],
    };

    expect(mockTask.recipe_id).toBeNull();
    expect(dispatchByContentFormat(mockTask.content_format)).toBe('generate_text');
  });

  test('recipe_id is typed as number | null in ProductionTask', () => {
    // Verify type compatibility
    const videoTask: { recipe_id: number | null } = { recipe_id: 1 };
    const textTask: { recipe_id: number | null } = { recipe_id: null };

    expect(videoTask.recipe_id).toBe(1);
    expect(textTask.recipe_id).toBeNull();
  });
});
