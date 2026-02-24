/**
 * FEAT-INT-001: Production Pipeline Graph — content_format dispatch
 * FEAT-INT-002: Production Pipeline Graph — recipe_id reference
 * Spec: 02-architecture.md §3.4, 04-agent-design.md §5.2
 *
 * Nodes: poll_tasks → sleep | fetch_data → dispatch → generate_video | generate_text
 *        → quality_check → poll_tasks
 *        → handle_error → poll_tasks
 *
 * Dispatch logic: content_format determines worker type:
 *   - short_video → generate_video (code-only, recipe-driven)
 *   - text_post   → generate_text  (LLM-driven)
 *   - image_post  → future extension
 */
import { StateGraph, Annotation, START } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type {
  ProductionPipelineState,
  ProductionPipelineNode,
  ProductionTask,
  ProductionCharacter,
  ProductionProgress,
  ProductionError,
  ProductionStatus,
  DispatchEdgeResult,
  ContentFormat,
  SectionResult,
  ProductionSection,
  ReviewStatus,
} from '@/types/langgraph-state';
import type {
  ContentRow,
  ContentSectionRow,
} from '@/types/database';

// MCP tool imports (same Node.js process, not remote)
import { getProductionTask } from '../../mcp-server/tools/production/get-production-task.js';
import { getCharacterInfo } from '../../mcp-server/tools/production/get-character-info.js';
import { getComponentData } from '../../mcp-server/tools/production/get-component-data.js';
import { updateContentStatus } from '../../mcp-server/tools/production/update-content-status.js';
import { startVideoGeneration } from '../../mcp-server/tools/production/start-video-generation.js';
import { startTts } from '../../mcp-server/tools/production/start-tts.js';
import { startLipsync } from '../../mcp-server/tools/production/start-lipsync.js';
import { checkVideoStatus } from '../../mcp-server/tools/production/check-video-status.js';
import { uploadToDrive } from '../../mcp-server/tools/production/upload-to-drive.js';
import { reportProductionComplete } from '../../mcp-server/tools/production/report-production-complete.js';
import { generateScript } from '../../mcp-server/tools/production/generate-script.js';
import { runQualityCheck } from '../../mcp-server/tools/production/run-quality-check.js';

// Settings
import { getSettingNumber, getSettingBoolean, getSettingString } from '../../lib/settings.js';

// DB pool for direct queries (content + content_sections lookups)
import { getPool } from '../../db/pool.js';

import type { RecipeStep, ProductionRecipeRow } from '@/types/database';

// ---------------------------------------------------------------------------
// State annotation
// ---------------------------------------------------------------------------

export const ProductionPipelineAnnotation = Annotation.Root({
  current_task: Annotation<ProductionTask | null>({ reducer: (_, b) => b, default: () => null }),
  character: Annotation<ProductionCharacter | null>({ reducer: (_, b) => b, default: () => null }),
  production: Annotation<ProductionProgress>({
    reducer: (_, b) => b,
    default: () => ({
      status: 'idle' as ProductionStatus,
      sections: {},
    }),
  }),
  review: Annotation<ProductionPipelineState['review']>({
    reducer: (_, b) => b,
    default: () => ({
      status: 'pending_review' as const,
      revision_count: 0,
      auto_approve_threshold: 8.0,
    }),
  }),
  config: Annotation<ProductionPipelineState['config']>({
    reducer: (_, b) => b,
    default: () => ({
      HUMAN_REVIEW_ENABLED: true,
      AUTO_APPROVE_SCORE_THRESHOLD: 8.0,
      MAX_CONTENT_REVISION_COUNT: 3,
    }),
  }),
  errors: Annotation<ProductionError[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

// ---------------------------------------------------------------------------
// Dispatch logic — content_format determines worker type
// ---------------------------------------------------------------------------

/**
 * Determine which worker to dispatch to based on content_format.
 * Spec: 02-architecture.md §5.1, 04-agent-design.md §5.2
 */
export function dispatchByContentFormat(
  contentFormat: ContentFormat,
): DispatchEdgeResult {
  switch (contentFormat) {
    case 'short_video':
      return 'generate_video';
    case 'text_post':
      return 'generate_text';
    case 'image_post':
      // Future extension — routed to generate_text for now (image gen happens in post-production)
      return 'generate_text';
    default:
      throw new Error(`Unknown content_format: ${contentFormat}`);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIDEO_STATUS_POLL_INTERVAL_MS = 5_000;
const VIDEO_STATUS_MAX_POLLS = 180; // 15 minutes max per section

// ---------------------------------------------------------------------------
// Helper: build ProductionTask from DB content + sections
// ---------------------------------------------------------------------------

async function buildProductionTask(
  taskId: number,
  contentId: string,
): Promise<ProductionTask> {
  const pool = getPool();

  // Fetch content record
  const contentRes = await pool.query<ContentRow>(
    'SELECT * FROM content WHERE content_id = $1',
    [contentId],
  );
  const content = contentRes.rows[0];
  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  // Fetch content sections
  const sectionsRes = await pool.query<ContentSectionRow>(
    'SELECT * FROM content_sections WHERE content_id = $1 ORDER BY section_order ASC',
    [contentId],
  );

  // Build sections with component data
  const sections: ProductionSection[] = await Promise.all(
    sectionsRes.rows.map(async (row) => {
      const compData = await getComponentData({ component_id: row.component_id });
      return {
        section_order: row.section_order,
        section_label: row.section_label,
        component: {
          component_id: row.component_id,
          component_type: compData.type,
          content: compData.data,
          drive_file_id: compData.drive_file_id ?? undefined,
        },
      };
    }),
  );

  // Determine account_id from the first publication or fallback
  const accountRes = await pool.query<{ account_id: string }>(
    `SELECT a.account_id FROM accounts a
     JOIN publications p ON p.account_id = a.account_id
     WHERE p.content_id = $1 LIMIT 1`,
    [contentId],
  );
  const accountId = accountRes.rows[0]?.account_id ?? '';

  return {
    task_id: taskId,
    content_id: contentId,
    content_format: content.content_format as ContentFormat,
    account_id: accountId,
    character_id: content.character_id ?? '',
    script_language: (content.script_language ?? 'en') as 'en' | 'jp',
    recipe_id: content.recipe_id,
    sections,
  };
}

// ---------------------------------------------------------------------------
// Helper: poll video generation until completed or failed
// ---------------------------------------------------------------------------

async function pollVideoUntilDone(requestId: string): Promise<string> {
  for (let i = 0; i < VIDEO_STATUS_MAX_POLLS; i++) {
    const status = await checkVideoStatus({ request_id: requestId });
    if (status.status === 'completed') {
      return status.video_url ?? '';
    }
    if (status.status === 'failed') {
      throw new Error(`Video generation failed for request ${requestId}`);
    }
    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, VIDEO_STATUS_POLL_INTERVAL_MS));
  }
  throw new Error(`Video generation timed out for request ${requestId} after ${VIDEO_STATUS_MAX_POLLS} polls`);
}

// ---------------------------------------------------------------------------
// Helper: fetch recipe steps from production_recipes table
// ---------------------------------------------------------------------------

interface ResolvedRecipe {
  recipe_id: number;
  recipe_name: string;
  steps: RecipeStep[];
}

async function fetchRecipeSteps(recipeId: number | null | undefined): Promise<ResolvedRecipe | null> {
  if (recipeId == null) return null;
  const pool = getPool();
  const res = await pool.query<ProductionRecipeRow>(
    `SELECT id, recipe_name, steps FROM production_recipes WHERE id = $1 AND is_active = true`,
    [recipeId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const steps = Array.isArray(row.steps) ? row.steps : [];
  return { recipe_id: row.id, recipe_name: row.recipe_name, steps };
}

/**
 * Resolve tool function name from recipe step.
 * Maps step_name categories to our available tool functions.
 */
function getStepToolCategory(stepName: string): 'video_gen' | 'tts' | 'lipsync' | 'concat' | 'unknown' {
  const lower = stepName.toLowerCase();
  if (lower.includes('video') || lower.includes('image_gen') || lower.includes('kling') || lower.includes('runway')) return 'video_gen';
  if (lower.includes('tts') || lower.includes('voice') || lower.includes('audio')) return 'tts';
  if (lower.includes('lipsync') || lower.includes('lip')) return 'lipsync';
  if (lower.includes('concat') || lower.includes('merge') || lower.includes('ffmpeg')) return 'concat';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Helper: compute quality score from QC check results (0.0 – 10.0)
// ---------------------------------------------------------------------------

function computeQualityScore(checks: Array<{ name: string; passed: boolean; details?: string }>): number {
  if (checks.length === 0) return 0;
  // Each check contributes equally. Score = (passed_count / total) * 10
  const passedCount = checks.filter((c) => c.passed).length;
  return Number(((passedCount / checks.length) * 10).toFixed(1));
}

// ---------------------------------------------------------------------------
// Node functions
// ---------------------------------------------------------------------------

/**
 * poll_tasks: Fetch the next production task from the queue.
 * If no task available, set current_task=null (edge routes to sleep).
 * If task found, populate current_task from DB content + sections.
 */
async function pollTasks(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  try {
    const taskResult = await getProductionTask({});

    if (!taskResult) {
      return {
        current_task: null,
        production: { ...state.production, status: 'idle' as ProductionStatus, sections: {} },
      };
    }

    const task = await buildProductionTask(taskResult.task_id, taskResult.content_id);

    return {
      current_task: task,
      production: { ...state.production, status: 'idle' as ProductionStatus, sections: {} },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      current_task: null,
      production: { ...state.production, status: 'error' as ProductionStatus, sections: {} },
      errors: [{
        node: 'poll_tasks' as ProductionPipelineNode,
        error_message: `poll_tasks failed: ${message}`,
        occurred_at: new Date().toISOString(),
        retry_count: 0,
        is_retryable: true,
      }],
    };
  }
}

/**
 * sleep: Read PRODUCTION_POLL_INTERVAL_SEC from system_settings and sleep.
 */
async function sleep(
  _state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  const pollIntervalSec = await getSettingNumber('PRODUCTION_POLL_INTERVAL_SEC').catch(() => 30);
  await new Promise((resolve) => setTimeout(resolve, pollIntervalSec * 1000));
  return {};
}

/**
 * fetch_data: Fetch character info and component data for each section.
 * Transition content status to 'producing'.
 */
async function fetchData(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  if (!state.current_task) {
    throw new Error('fetch_data called without current_task');
  }

  const task = state.current_task;

  try {
    // Transition content status to 'producing'
    await updateContentStatus({
      content_id: task.content_id,
      status: 'producing',
    });

    // Fetch character info
    let character: ProductionCharacter | null = null;
    if (task.character_id) {
      const charInfo = await getCharacterInfo({ character_id: task.character_id });
      character = {
        name: charInfo.name,
        voice_id: charInfo.voice_id,
        image_drive_id: charInfo.image_drive_id,
      };
    }

    // Refresh component data for each section (may have been updated since poll)
    const updatedSections: ProductionSection[] = await Promise.all(
      task.sections.map(async (section) => {
        const compData = await getComponentData({
          component_id: section.component.component_id,
        });
        return {
          section_order: section.section_order,
          section_label: section.section_label,
          component: {
            component_id: section.component.component_id,
            component_type: compData.type,
            content: compData.data,
            drive_file_id: compData.drive_file_id ?? undefined,
          },
        };
      }),
    );

    return {
      current_task: { ...task, sections: updatedSections },
      character,
      production: { ...state.production, status: 'fetching' as ProductionStatus, sections: {} },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      production: { ...state.production, status: 'error' as ProductionStatus, sections: {} },
      errors: [{
        node: 'fetch_data' as ProductionPipelineNode,
        error_message: `fetch_data failed: ${message}`,
        occurred_at: new Date().toISOString(),
        retry_count: 0,
        is_retryable: true,
      }],
    };
  }
}

/**
 * dispatch: Validate task readiness and set status to 'dispatching'.
 * Validates recipe_id for short_video format. Loads config from system_settings.
 * Actual format-based routing is done by the conditional edge function.
 */
async function dispatch(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  const task = state.current_task;

  // Validate recipe_id for short_video (required per spec)
  if (task && task.content_format === 'short_video' && task.recipe_id == null) {
    return {
      production: { ...state.production, status: 'error' as ProductionStatus },
      errors: [{
        node: 'dispatch' as ProductionPipelineNode,
        error_message: `short_video content ${task.content_id} requires recipe_id but has none`,
        occurred_at: new Date().toISOString(),
        retry_count: 0,
        is_retryable: false,
      }],
    };
  }

  // Load config from system_settings
  const humanReviewEnabled = await getSettingBoolean('HUMAN_REVIEW_ENABLED').catch(() => true);
  const autoApproveThreshold = await getSettingNumber('AUTO_APPROVE_SCORE_THRESHOLD').catch(() => 8.0);
  const maxRevisionCount = await getSettingNumber('MAX_CONTENT_REVISION_COUNT').catch(() => 3);

  return {
    production: { ...state.production, status: 'dispatching' as ProductionStatus },
    config: {
      HUMAN_REVIEW_ENABLED: humanReviewEnabled,
      AUTO_APPROVE_SCORE_THRESHOLD: autoApproveThreshold,
      MAX_CONTENT_REVISION_COUNT: maxRevisionCount,
    },
  };
}

/**
 * generate_video: Recipe-driven video production.
 * Fetches production_recipes.steps by recipe_id, then executes tools
 * in the order specified by the recipe.
 * Fallback: if no recipe found, uses default sequence (video_gen → tts → lipsync).
 * After all sections: uploadToDrive, reportProductionComplete.
 */
async function generateVideoNode(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  if (!state.current_task) {
    throw new Error('generate_video called without current_task');
  }

  const task = state.current_task;
  const character = state.character;
  const startTime = Date.now();
  const sectionResults: Record<string, SectionResult | null> = {};

  try {
    // Fetch recipe steps from production_recipes table
    const recipe = await fetchRecipeSteps(task.recipe_id);
    const recipeSteps = recipe?.steps ?? [];

    // Determine which tool categories the recipe requires
    const hasVideoGen = recipeSteps.length === 0 || recipeSteps.some((s) => getStepToolCategory(s.step_name) === 'video_gen');
    const hasTts = recipeSteps.length === 0 || recipeSteps.some((s) => getStepToolCategory(s.step_name) === 'tts');
    const hasLipsync = recipeSteps.length === 0 || recipeSteps.some((s) => getStepToolCategory(s.step_name) === 'lipsync');

    // Process all sections (parallelized per spec)
    const sectionPromises = task.sections.map(async (section) => {
      const sectionStart = Date.now();
      const imageUrl = character?.image_fal_url ?? character?.image_drive_id ?? '';
      const motionData = section.component.content;

      let videoUrl = '';
      let audioUrl = '';
      let lipsyncVideoUrl = '';
      let requestId = '';

      // Check if section has a pre-generated base video (skip video gen if so)
      const preGenVideoUrl = (section.component.content['base_video_url'] as string | undefined);

      // Step 1: Video generation (if recipe includes it and no pre-generated video)
      if (hasVideoGen && !preGenVideoUrl) {
        // Get recipe params for video_gen step if available
        const videoGenStep = recipeSteps.find((s) => getStepToolCategory(s.step_name) === 'video_gen');
        const videoGenParams = videoGenStep?.params ?? {};

        const videoGen = await startVideoGeneration({
          image_url: imageUrl,
          motion_data: motionData,
          section: section.section_label,
          ...videoGenParams,
        });
        requestId = videoGen.request_id;
        videoUrl = await pollVideoUntilDone(videoGen.request_id);
      } else if (preGenVideoUrl) {
        // Use pre-generated base video
        videoUrl = preGenVideoUrl;
        requestId = `pregen_${section.section_label}`;
      }

      // Step 2: TTS (if recipe includes it)
      if (hasTts) {
        const script = (section.component.content['script'] as string | undefined) ?? '';
        const ttsStep = recipeSteps.find((s) => getStepToolCategory(s.step_name) === 'tts');
        const ttsParams = ttsStep?.params ?? {};

        const ttsResult = await startTts({
          text: script,
          voice_id: character?.voice_id ?? '',
          language: task.script_language,
          ...ttsParams,
        });
        audioUrl = ttsResult.audio_url;
      }

      // Step 3: Lipsync (if recipe includes it and we have both video and audio)
      if (hasLipsync && videoUrl && audioUrl) {
        const lipsyncStep = recipeSteps.find((s) => getStepToolCategory(s.step_name) === 'lipsync');
        const lipsyncParams = lipsyncStep?.params ?? {};

        const lipsyncResult = await startLipsync({
          video_url: videoUrl,
          audio_url: audioUrl,
          ...lipsyncParams,
        });
        lipsyncVideoUrl = await pollVideoUntilDone(lipsyncResult.request_id);
      }

      const result: SectionResult = {
        request_id: requestId,
        video_url: videoUrl,
        tts_audio_url: audioUrl,
        lipsync_video_url: lipsyncVideoUrl || videoUrl,
        processing_seconds: (Date.now() - sectionStart) / 1000,
      };

      return { label: section.section_label, result };
    });

    const results = await Promise.all(sectionPromises);
    for (const { label, result } of results) {
      sectionResults[label] = result;
    }

    // Get final video URL — prefer lipsync result, fallback to video
    const lastResult = results[results.length - 1];
    const finalVideoUrl = lastResult?.result.lipsync_video_url ?? lastResult?.result.video_url ?? '';

    // Upload to Google Drive
    const driveFolderId = await getSettingString('PRODUCTION_OUTPUT_DRIVE_FOLDER_ID').catch(() => 'default_production_folder');
    const driveResult = await uploadToDrive({
      file_url: finalVideoUrl,
      folder_id: driveFolderId,
      filename: `${task.content_id}_final.mp4`,
    });

    // Report production complete
    await reportProductionComplete({
      task_id: task.task_id,
      content_id: task.content_id,
      drive_folder_id: driveFolderId,
      video_drive_id: driveResult.drive_file_id,
    });

    // Increment recipe usage count
    if (recipe) {
      const pool = getPool();
      await pool.query(
        `UPDATE production_recipes SET times_used = times_used + 1, updated_at = NOW() WHERE id = $1`,
        [recipe.recipe_id],
      ).catch((err) => {
        console.warn(`[production-pipeline] Failed to update recipe usage count: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      production: {
        status: 'completed' as ProductionStatus,
        sections: sectionResults,
        final_video_url: driveResult.drive_url,
        drive_folder_id: driveFolderId,
        video_drive_id: driveResult.drive_file_id,
        processing_time_seconds: processingTime,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      production: {
        status: 'error' as ProductionStatus,
        sections: sectionResults,
      },
      errors: [{
        node: 'generate_video' as ProductionPipelineNode,
        error_message: `generate_video failed: ${message}`,
        occurred_at: new Date().toISOString(),
        retry_count: 0,
        is_retryable: true,
      }],
    };
  }
}

/**
 * generate_text: LLM-driven text generation using generateScript.
 * Input: scenario from component data, character personality, platform constraints.
 * Output: generated text stored in production.generated_text.
 */
async function generateTextNode(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  if (!state.current_task) {
    throw new Error('generate_text called without current_task');
  }

  const task = state.current_task;
  const startTime = Date.now();

  try {
    // Build scenario_data from sections and character info
    const scenarioData: Record<string, unknown> = {};
    for (const section of task.sections) {
      for (const [key, value] of Object.entries(section.component.content)) {
        scenarioData[key] = value;
      }
    }
    if (state.character) {
      scenarioData['character_name'] = state.character.name;
    }

    const scriptResult = await generateScript({
      content_id: task.content_id,
      scenario_data: scenarioData,
      script_language: task.script_language,
    });

    // Combine hook + body + cta into full generated text
    const generatedText = [
      scriptResult.hook_script,
      scriptResult.body_script,
      scriptResult.cta_script,
    ].join('\n\n');

    // Update content status to ready (text generation is quick, no separate upload needed)
    await updateContentStatus({
      content_id: task.content_id,
      status: 'producing',
      metadata: {
        generated_text: generatedText,
        hook_script: scriptResult.hook_script,
        body_script: scriptResult.body_script,
        cta_script: scriptResult.cta_script,
      },
    });

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      production: {
        status: 'generating' as ProductionStatus,
        sections: {},
        generated_text: generatedText,
        processing_time_seconds: processingTime,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      production: {
        status: 'error' as ProductionStatus,
        sections: {},
      },
      errors: [{
        node: 'generate_text' as ProductionPipelineNode,
        error_message: `generate_text failed: ${message}`,
        occurred_at: new Date().toISOString(),
        retry_count: 0,
        is_retryable: true,
      }],
    };
  }
}

/**
 * quality_check: Run quality checks on produced content.
 * For video: file size, black frame detection, Drive save confirmation.
 * For text: character count, character consistency.
 * If passed and review policy allows: set status to 'ready'.
 * If failed: add error, route to handle_error.
 */
async function qualityCheck(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  if (!state.current_task) {
    throw new Error('quality_check called without current_task');
  }

  const task = state.current_task;
  const isVideo = task.content_format === 'short_video';
  const videoUrl = state.production.final_video_url ?? '';

  try {
    const qcResult = await runQualityCheck({
      content_id: task.content_id,
      video_url: isVideo ? videoUrl : (state.production.generated_text ?? ''),
    });

    // Compute quality score from individual check results
    const qualityScore = computeQualityScore(qcResult.checks);

    if (qcResult.passed) {
      // Read review settings
      const humanReviewEnabled = await getSettingBoolean('HUMAN_REVIEW_ENABLED').catch(() => true);
      const autoApproveThreshold = await getSettingNumber('AUTO_APPROVE_SCORE_THRESHOLD').catch(() => 8.0);

      // Determine review routing
      let reviewStatus: ReviewStatus = 'pending_review';
      let contentStatus: 'ready' | 'pending_review' = 'pending_review';

      if (humanReviewEnabled) {
        // All content requires human review
        reviewStatus = 'pending_review';
        contentStatus = 'pending_review';
      } else {
        // Auto-approve if computed quality score meets threshold
        if (qualityScore >= autoApproveThreshold) {
          reviewStatus = 'auto_approved';
          contentStatus = 'ready';
        } else {
          reviewStatus = 'pending_review';
          contentStatus = 'pending_review';
        }
      }

      // Store quality_score in content metadata
      await updateContentStatus({
        content_id: task.content_id,
        status: contentStatus,
        metadata: { quality_score: qualityScore },
      });

      return {
        production: {
          ...state.production,
          status: 'quality_check' as ProductionStatus,
        },
        review: {
          ...state.review,
          status: reviewStatus,
          quality_score: qualityScore,
          auto_approve_threshold: autoApproveThreshold,
        },
      };
    } else {
      // Quality check failed
      const failedChecks = qcResult.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}: ${c.details ?? 'failed'}`)
        .join('; ');

      return {
        production: {
          ...state.production,
          status: 'error' as ProductionStatus,
        },
        errors: [{
          node: 'quality_check' as ProductionPipelineNode,
          error_message: `Quality check failed: ${failedChecks}`,
          occurred_at: new Date().toISOString(),
          retry_count: 0,
          is_retryable: false,
        }],
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      production: {
        ...state.production,
        status: 'error' as ProductionStatus,
      },
      errors: [{
        node: 'quality_check' as ProductionPipelineNode,
        error_message: `quality_check exception: ${message}`,
        occurred_at: new Date().toISOString(),
        retry_count: 0,
        is_retryable: true,
      }],
    };
  }
}

/**
 * handle_error: Record error, check retry count, re-queue if retryable.
 * If retry count exceeds max_retries, mark content as cancelled.
 */
async function handleError(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  const latestError = state.errors[state.errors.length - 1];
  const task = state.current_task;

  if (!task) {
    // No task context — just reset to idle
    return {
      current_task: null,
      production: { status: 'idle' as ProductionStatus, sections: {} },
    };
  }

  try {
    const pool = getPool();
    const maxRetries = 3; // task_queue default max_retries

    // Check current retry_count from task_queue
    const taskRes = await pool.query<{ retry_count: number; max_retries: number }>(
      'SELECT retry_count, max_retries FROM task_queue WHERE id = $1',
      [task.task_id],
    );
    const taskRow = taskRes.rows[0];
    const retryCount = taskRow?.retry_count ?? 0;
    const taskMaxRetries = taskRow?.max_retries ?? maxRetries;

    const errorMessage = latestError?.error_message ?? 'Unknown error';
    const isRetryable = latestError?.is_retryable ?? false;

    if (isRetryable && retryCount < taskMaxRetries) {
      // Re-queue the task: reset status to pending, increment retry_count
      await pool.query(
        `UPDATE task_queue
         SET status = 'pending',
             retry_count = retry_count + 1,
             error_message = $2,
             last_error_at = NOW(),
             assigned_worker = NULL,
             started_at = NULL
         WHERE id = $1`,
        [task.task_id, errorMessage],
      );
    } else {
      // Mark as permanently failed
      await pool.query(
        `UPDATE task_queue
         SET status = 'failed_permanent',
             error_message = $2,
             last_error_at = NOW()
         WHERE id = $1`,
        [task.task_id, errorMessage],
      );

      // Mark content as cancelled
      await updateContentStatus({
        content_id: task.content_id,
        status: 'cancelled',
        metadata: { error_message: errorMessage },
      });
    }
  } catch (dbErr) {
    const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error(
      `[handle_error] DB update failed for task ${task.task_id}: ${dbMsg}. ` +
      `Task may remain stuck in 'processing' status.`,
    );
  }

  return {
    current_task: null,
    production: { status: 'error' as ProductionStatus, sections: {} },
  };
}

/**
 * revision_planning: After human rejection, plan revision.
 * Reads reviewer_comment, determines component changes, increments revision_count,
 * and creates a new task_queue entry for re-production.
 * If MAX_CONTENT_REVISION_COUNT exceeded, cancels the content.
 */
async function revisionPlanning(
  state: typeof ProductionPipelineAnnotation.State,
): Promise<Partial<typeof ProductionPipelineAnnotation.State>> {
  if (!state.current_task) {
    return {};
  }

  const task = state.current_task;
  const revisionCount = state.review.revision_count + 1;

  try {
    const maxRevisions = await getSettingNumber('MAX_CONTENT_REVISION_COUNT').catch(() => 3);

    if (revisionCount > maxRevisions) {
      // Exceeded max revisions — cancel content
      await updateContentStatus({
        content_id: task.content_id,
        status: 'cancelled',
        metadata: { reason: `Exceeded MAX_CONTENT_REVISION_COUNT (${maxRevisions})` },
      });

      return {
        current_task: null,
        review: {
          ...state.review,
          status: 'revision_planned' as ReviewStatus,
          revision_count: revisionCount,
        },
        production: { status: 'idle' as ProductionStatus, sections: {} },
      };
    }

    // Update content for re-production
    const pool = getPool();
    await pool.query(
      `UPDATE content SET status = 'planned', revision_count = $2, updated_at = NOW() WHERE content_id = $1`,
      [task.content_id, revisionCount],
    );

    // Create a new task_queue entry for re-production
    await pool.query(
      `INSERT INTO task_queue (task_type, payload, status, priority)
       VALUES ('produce', $1::jsonb, 'pending', 1)`,
      [JSON.stringify({ content_id: task.content_id })],
    );

    return {
      current_task: null,
      review: {
        ...state.review,
        status: 'revision_planned' as ReviewStatus,
        revision_count: revisionCount,
      },
      production: { status: 'idle' as ProductionStatus, sections: {} },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      errors: [{
        node: 'revision_planning' as ProductionPipelineNode,
        error_message: `revision_planning failed: ${message}`,
        occurred_at: new Date().toISOString(),
        retry_count: 0,
        is_retryable: false,
      }],
    };
  }
}

// ---------------------------------------------------------------------------
// Conditional edge functions
// ---------------------------------------------------------------------------

function pollTasksEdge(
  state: typeof ProductionPipelineAnnotation.State,
): 'sleep' | 'fetch_data' {
  return state.current_task ? 'fetch_data' : 'sleep';
}

function dispatchEdge(
  state: typeof ProductionPipelineAnnotation.State,
): DispatchEdgeResult {
  if (!state.current_task) {
    throw new Error('No current task in dispatch node');
  }
  return dispatchByContentFormat(state.current_task.content_format);
}

function postProductionEdge(
  state: typeof ProductionPipelineAnnotation.State,
): 'poll_tasks' | 'handle_error' | 'revision_planning' {
  if (state.production.status === 'error') return 'handle_error';
  if (state.review.status === 'rejected') return 'revision_planning';
  return 'poll_tasks';
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export function buildProductionPipelineGraph() {
  const graph = new StateGraph(ProductionPipelineAnnotation)
    .addNode('poll_tasks', pollTasks)
    .addNode('sleep', sleep)
    .addNode('fetch_data', fetchData)
    .addNode('dispatch', dispatch)
    .addNode('generate_video', generateVideoNode)
    .addNode('generate_text', generateTextNode)
    .addNode('quality_check', qualityCheck)
    .addNode('handle_error', handleError)
    .addNode('revision_planning', revisionPlanning)

    // Edges
    .addEdge(START, 'poll_tasks')
    .addConditionalEdges('poll_tasks', pollTasksEdge, {
      sleep: 'sleep',
      fetch_data: 'fetch_data',
    })
    .addEdge('sleep', 'poll_tasks')
    .addEdge('fetch_data', 'dispatch')
    .addConditionalEdges('dispatch', dispatchEdge, {
      generate_video: 'generate_video',
      generate_text: 'generate_text',
    })
    .addEdge('generate_video', 'quality_check')
    .addEdge('generate_text', 'quality_check')
    .addConditionalEdges('quality_check', postProductionEdge, {
      poll_tasks: 'poll_tasks',
      handle_error: 'handle_error',
      revision_planning: 'revision_planning',
    })
    .addEdge('handle_error', 'poll_tasks')
    .addEdge('revision_planning', 'poll_tasks');

  return graph;
}

/**
 * Create the compiled production pipeline graph with checkpointing.
 */
export function createProductionPipelineGraph() {
  const graph = buildProductionPipelineGraph();
  const checkpointer = new MemorySaver();
  return graph.compile({ checkpointer });
}
