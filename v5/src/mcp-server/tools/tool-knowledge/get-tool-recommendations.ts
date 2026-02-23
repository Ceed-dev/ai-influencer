/**
 * MCI-015: get_tool_recommendations
 * Spec: 04-agent-design.md §4.5 #4
 */
import type {
  GetToolRecommendationsInput,
  GetToolRecommendationsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function getToolRecommendations(
  input: GetToolRecommendationsInput,
): Promise<GetToolRecommendationsOutput> {
  const reqs = input.content_requirements;
  if (!reqs.character_id || reqs.character_id.trim().length === 0) {
    throw new McpValidationError('content_requirements.character_id is required');
  }
  if (!VALID_PLATFORMS.includes(reqs.platform as typeof VALID_PLATFORMS[number])) {
    throw new McpValidationError(
      `Invalid platform: "${reqs.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  const pool = getPool();

  // Find best recipe based on avg_quality_score
  const recipeRes = await pool.query(
    `SELECT id, recipe_name, steps, avg_quality_score, success_rate
     FROM production_recipes
     WHERE is_active = true
       AND (target_platform IS NULL OR target_platform = $1)
     ORDER BY COALESCE(avg_quality_score, 0) DESC, COALESCE(success_rate, 0) DESC
     LIMIT 3`,
    [reqs.platform],
  );

  // Extract tool names from recipe steps
  function extractRecipe(steps: Array<Record<string, unknown>>): {
    video_gen: string; tts: string; lipsync: string; concat: string;
  } {
    const recipe = { video_gen: 'kling_v2', tts: 'fish_audio', lipsync: 'fal_lipsync', concat: 'ffmpeg' };
    for (const step of steps) {
      const name = step['tool_name'] as string | undefined;
      const stepName = step['step_name'] as string | undefined;
      if (!name || !stepName) continue;
      if (stepName.includes('video') || stepName.includes('image')) {
        recipe.video_gen = name;
      } else if (stepName.includes('tts') || stepName.includes('voice')) {
        recipe.tts = name;
      } else if (stepName.includes('lipsync') || stepName.includes('lip')) {
        recipe.lipsync = name;
      } else if (stepName.includes('concat') || stepName.includes('merge')) {
        recipe.concat = name;
      }
    }
    return recipe;
  }

  if (recipeRes.rowCount === 0 || recipeRes.rows.length === 0) {
    // Return defaults
    return {
      recipe: { video_gen: 'kling_v2', tts: 'fish_audio', lipsync: 'fal_lipsync', concat: 'ffmpeg' },
      rationale: 'Default recipe — no production recipes found in database',
      confidence: 0.3,
      alternatives: [],
    };
  }

  const primary = recipeRes.rows[0] as Record<string, unknown>;
  const primarySteps = (primary['steps'] as Array<Record<string, unknown>>) ?? [];
  const primaryRecipe = extractRecipe(primarySteps);

  const alternatives = recipeRes.rows.slice(1).map((row: Record<string, unknown>) => {
    const steps = (row['steps'] as Array<Record<string, unknown>>) ?? [];
    return {
      recipe: extractRecipe(steps),
      rationale: `Alternative recipe: ${row['recipe_name'] as string}`,
      confidence: Number(Number(row['avg_quality_score'] ?? 0).toFixed(2)),
    };
  });

  return {
    recipe: primaryRecipe,
    rationale: `Best recipe: ${primary['recipe_name'] as string} (quality: ${Number(primary['avg_quality_score'] ?? 0).toFixed(2)})`,
    confidence: Number(Number(primary['avg_quality_score'] ?? 0.5).toFixed(2)),
    alternatives,
  };
}
