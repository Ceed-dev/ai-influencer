/**
 * FEAT-INT-003: Publishing Scheduler Graph
 * Spec: 04-agent-design.md §5.3, 02-architecture.md §3.4
 *
 * Nodes: check_schedule → (sleep if no tasks | publish if task found)
 *        publish → record → check_schedule
 *        handle_error → check_schedule
 *
 * Continuous polling at POSTING_POLL_INTERVAL_SEC (default: 120s).
 * Posts 'ready'/'approved' content at optimal times respecting rate limits.
 * All config from DB system_settings — no hardcoding.
 */
import { StateGraph, Annotation, START } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type {
  PublishTask,
  PublishResult,
  PlatformRateLimit,
  PublishEdgeResult,
  Platform,
  PublishMetadata,
} from '@/types/langgraph-state';
import type { Platform as DbPlatform } from '@/types/database';

// MCP tool imports (same Node.js process, not remote)
import { publishToYoutube, publishToTiktok, publishToInstagram, publishToX } from '../../mcp-server/tools/publishing/publish-to-platform.js';
// Infrastructure imports
import { getPool } from '../../db/pool.js';
import { getSettingNumber } from '../../lib/settings.js';

// Worker utilities
import { recordPublication } from '../../workers/posting/publish-recorder.js';
import { checkDailyPostLimit, checkPlatformCooldown as checkCooldown } from '../../workers/posting/scheduler.js';
import { createPrediction } from '../../workers/algorithm/prediction.js';

// ---------------------------------------------------------------------------
// State annotation
// ---------------------------------------------------------------------------

export const PublishingSchedulerAnnotation = Annotation.Root({
  current_task: Annotation<PublishTask | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  publish_result: Annotation<PublishResult | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  rate_limits: Annotation<Record<Platform, PlatformRateLimit>>({
    reducer: (_, b) => b,
    default: () => ({
      youtube: { remaining: 100, reset_at: new Date().toISOString() },
      tiktok: { remaining: 100, reset_at: new Date().toISOString() },
      instagram: { remaining: 100, reset_at: new Date().toISOString() },
      x: { remaining: 100, reset_at: new Date().toISOString() },
    }),
  }),
});

// ---------------------------------------------------------------------------
// Node functions
// ---------------------------------------------------------------------------

/**
 * check_schedule node — Query task_queue for the next pending publish task.
 *
 * Joins task_queue, content, publications, and accounts to find tasks where:
 * - task_type = 'publish' and status = 'pending'
 * - content.status IN ('ready', 'approved')
 * - content.planned_post_date <= CURRENT_DATE
 * - rate limits / cooldown are respected
 *
 * Returns the highest-priority task or null if none found.
 */
async function checkSchedule(
  _state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  const pool = getPool();

  try {
    // Query for the next eligible publish task
    const result = await pool.query<{
      task_id: number;
      content_id: string;
      account_id: string;
      platform: DbPlatform;
      video_drive_id: string | null;
      payload: Record<string, unknown>;
    }>(
      `SELECT
         tq.id AS task_id,
         c.content_id,
         p.account_id,
         a.platform,
         c.video_drive_id,
         tq.payload
       FROM task_queue tq
       JOIN content c ON c.content_id = (tq.payload->>'content_id')::varchar
       JOIN publications p ON p.content_id = c.content_id
       JOIN accounts a ON a.account_id = p.account_id
       WHERE tq.task_type = 'publish'
         AND tq.status = 'pending'
         AND c.status IN ('ready', 'approved')
         AND c.planned_post_date <= CURRENT_DATE
       ORDER BY tq.priority DESC, tq.created_at ASC
       LIMIT 1`,
    );

    const row = result.rows[0];
    if (!row) {
      return { current_task: null, publish_result: null };
    }

    // Check daily post limit for this account+platform
    const { limitReached } = await checkDailyPostLimit(
      row.account_id,
      row.platform,
    );
    if (limitReached) {
      return { current_task: null, publish_result: null };
    }

    // Check platform cooldown
    const { cooldownActive } = await checkCooldown(
      row.account_id,
      row.platform,
    );
    if (cooldownActive) {
      return { current_task: null, publish_result: null };
    }

    // Mark the task as processing
    await pool.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [row.task_id],
    );

    // Extract metadata from payload
    const payload = row.payload;
    const metadata: PublishMetadata = {
      title: typeof payload['title'] === 'string' ? payload['title'] : undefined,
      description: typeof payload['description'] === 'string' ? payload['description'] : undefined,
      caption: typeof payload['caption'] === 'string' ? payload['caption'] : undefined,
      text: typeof payload['text'] === 'string' ? payload['text'] : undefined,
      tags: Array.isArray(payload['tags']) ? payload['tags'] as string[] : undefined,
      thumbnail_drive_id: typeof payload['thumbnail_drive_id'] === 'string' ? payload['thumbnail_drive_id'] : undefined,
    };

    const task: PublishTask = {
      task_id: row.task_id,
      content_id: row.content_id,
      account_id: row.account_id,
      platform: row.platform,
      video_drive_id: row.video_drive_id ?? '',
      metadata,
    };

    return { current_task: task, publish_result: null };
  } catch (err) {
    console.error('[check_schedule] Error querying publish tasks:', err);
    return { current_task: null, publish_result: null };
  }
}

/**
 * sleep node — Wait for POSTING_POLL_INTERVAL_SEC before polling again.
 * Default: 120 seconds. Configured via system_settings.
 */
async function sleep(
  _state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  let interval: number;
  try {
    interval = await getSettingNumber('POSTING_POLL_INTERVAL_SEC');
  } catch {
    // Fallback to default if setting not found
    interval = 120;
  }
  await new Promise((r) => setTimeout(r, interval * 1000));
  return {};
}

/**
 * publish node — Execute platform-specific posting via the appropriate adapter.
 *
 * Routes to the correct MCP publish tool based on task.platform:
 * - youtube  → publishToYoutube
 * - tiktok   → publishToTiktok
 * - instagram → publishToInstagram
 * - x        → publishToX
 *
 * On success: returns publish_result with status='success', post details.
 * On failure: returns publish_result with status='failed' and error message.
 */
async function publish(
  state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  const task = state.current_task;
  if (!task) {
    return {
      publish_result: { status: 'failed', error: 'No task to publish' },
    };
  }

  try {
    let platformPostId: string;
    let postUrl: string;

    const { platform, content_id, video_drive_id, metadata } = task;

    switch (platform) {
      case 'youtube': {
        const result = await publishToYoutube({
          content_id,
          title: metadata.title ?? '',
          description: metadata.description ?? '',
          tags: metadata.tags ?? [],
          video_drive_id,
        });
        platformPostId = result.platform_post_id;
        postUrl = result.post_url;
        break;
      }
      case 'tiktok': {
        const result = await publishToTiktok({
          content_id,
          description: metadata.description ?? metadata.caption ?? '',
          tags: metadata.tags ?? [],
          video_drive_id,
        });
        platformPostId = result.platform_post_id;
        postUrl = result.post_url;
        break;
      }
      case 'instagram': {
        const result = await publishToInstagram({
          content_id,
          caption: metadata.caption ?? metadata.description ?? '',
          tags: metadata.tags ?? [],
          video_drive_id,
        });
        platformPostId = result.platform_post_id;
        postUrl = result.post_url;
        break;
      }
      case 'x': {
        const result = await publishToX({
          content_id,
          text: metadata.text ?? metadata.description ?? '',
          video_drive_id,
        });
        platformPostId = result.platform_post_id;
        postUrl = result.post_url;
        break;
      }
      default: {
        const _exhaustive: never = platform;
        return {
          publish_result: {
            status: 'failed',
            error: `Unsupported platform: ${platform as string}`,
          },
        };
      }
    }

    const postedAt = new Date().toISOString();

    return {
      publish_result: {
        status: 'success',
        platform_post_id: platformPostId,
        post_url: postUrl,
        posted_at: postedAt,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[publish] Error publishing content:', errorMessage);
    return {
      publish_result: {
        status: 'failed',
        error: errorMessage,
      },
    };
  }
}

/**
 * record node — Record the successful publication.
 *
 * Updates:
 * 1. publications: SET post_url, posted_at, measure_after = posted_at + 48h, status = 'posted'
 * 2. content: SET status = 'posted'
 * 3. task_queue: SET status = 'completed', completed_at = NOW()
 * 4. Enqueue a measurement task via recordPublication
 */
async function record(
  state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  const task = state.current_task;
  const result = state.publish_result;

  if (!task || !result || result.status !== 'success') {
    return { current_task: null };
  }

  try {
    // Use recordPublication to handle publications + measure task atomically
    const pubResult = await recordPublication({
      content_id: task.content_id,
      account_id: task.account_id,
      platform: task.platform,
      platform_post_id: result.platform_post_id ?? '',
      post_url: result.post_url ?? '',
      posted_at: result.posted_at ?? new Date().toISOString(),
    });

    const pool = getPool();

    // Update content status to 'posted'
    await pool.query(
      `UPDATE content SET status = 'posted', updated_at = NOW() WHERE content_id = $1`,
      [task.content_id],
    );

    // Mark task_queue entry as completed
    await pool.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [task.task_id],
    );

    // Generate prediction snapshot (spec §5.3: record node calls get_content_prediction / G5 workflow)
    try {
      const contentRes = await pool.query<{ hypothesis_id: number | null }>(
        `SELECT hypothesis_id FROM content WHERE content_id = $1`,
        [task.content_id],
      );
      const hypothesisId = contentRes.rows[0]?.hypothesis_id ?? null;
      await createPrediction(
        pubResult.publication_id,
        task.content_id,
        task.account_id,
        hypothesisId,
      );
    } catch (predErr) {
      // Non-fatal: prediction snapshot failure should not block publication recording
      console.warn(
        `[record] Prediction snapshot creation failed for content=${task.content_id}:`,
        predErr instanceof Error ? predErr.message : String(predErr),
      );
    }

    return { current_task: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[record] Error recording publication:', errorMessage);

    // Mark the task as failed to prevent infinite re-processing
    try {
      const pool = getPool();
      await pool.query(
        `UPDATE task_queue
         SET status = 'failed_permanent',
             error_message = $2,
             last_error_at = NOW()
         WHERE id = $1`,
        [task.task_id, `record failed: ${errorMessage}`],
      );
    } catch (dbErr) {
      console.error('[record] Failed to mark task as failed:', dbErr);
    }

    return { current_task: null };
  }
}

/**
 * handle_error node — Handle publish failures.
 *
 * Increments the retry count on the task_queue entry.
 * If retry_count >= max_retries, marks the task as 'failed_permanent'.
 * Otherwise, resets status to 'pending' for retry.
 */
async function handleError(
  state: typeof PublishingSchedulerAnnotation.State,
): Promise<Partial<typeof PublishingSchedulerAnnotation.State>> {
  const task = state.current_task;
  const result = state.publish_result;

  if (!task) {
    return { current_task: null, publish_result: null };
  }

  const errorMessage = result?.error ?? 'Unknown error';
  const pool = getPool();

  try {
    // Fetch current retry_count and max_retries
    const taskRes = await pool.query<{
      retry_count: number;
      max_retries: number;
    }>(
      `SELECT retry_count, max_retries FROM task_queue WHERE id = $1`,
      [task.task_id],
    );

    const row = taskRes.rows[0];
    if (!row) {
      console.error(`[handle_error] Task ${task.task_id} not found in task_queue`);
      return { current_task: null, publish_result: null };
    }

    const newRetryCount = row.retry_count + 1;

    if (newRetryCount >= row.max_retries) {
      // Max retries exceeded — mark as permanently failed
      await pool.query(
        `UPDATE task_queue
         SET status = 'failed_permanent',
             retry_count = $2,
             error_message = $3,
             last_error_at = NOW()
         WHERE id = $1`,
        [task.task_id, newRetryCount, errorMessage],
      );
      console.error(
        `[handle_error] Task ${task.task_id} permanently failed after ${newRetryCount} retries: ${errorMessage}`,
      );
    } else {
      // Set back to pending for retry
      await pool.query(
        `UPDATE task_queue
         SET status = 'pending',
             retry_count = $2,
             error_message = $3,
             last_error_at = NOW(),
             started_at = NULL
         WHERE id = $1`,
        [task.task_id, newRetryCount, errorMessage],
      );
      console.warn(
        `[handle_error] Task ${task.task_id} retry ${newRetryCount}/${row.max_retries}: ${errorMessage}`,
      );
    }
  } catch (err) {
    console.error('[handle_error] Error updating task_queue:', err);
  }

  return { current_task: null, publish_result: null };
}

// ---------------------------------------------------------------------------
// Conditional edge functions
// ---------------------------------------------------------------------------

export function checkScheduleEdge(
  state: typeof PublishingSchedulerAnnotation.State,
): 'sleep' | 'publish' {
  return state.current_task ? 'publish' : 'sleep';
}

export function publishEdge(
  state: typeof PublishingSchedulerAnnotation.State,
): PublishEdgeResult {
  if (state.publish_result?.status === 'failed') {
    return 'handle_error';
  }
  return 'record';
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export interface PublishingSchedulerGraphOptions {
  checkSchedule?: typeof checkSchedule;
  sleep?: typeof sleep;
  publish?: typeof publish;
  record?: typeof record;
  handleError?: typeof handleError;
}

export function buildPublishingSchedulerGraph(
  options: PublishingSchedulerGraphOptions = {},
) {
  const graph = new StateGraph(PublishingSchedulerAnnotation)
    .addNode('check_schedule', options.checkSchedule ?? checkSchedule)
    .addNode('sleep', options.sleep ?? sleep)
    .addNode('publish', options.publish ?? publish)
    .addNode('record', options.record ?? record)
    .addNode('handle_error', options.handleError ?? handleError)

    // Edges
    .addEdge(START, 'check_schedule')
    .addConditionalEdges('check_schedule', checkScheduleEdge, {
      sleep: 'sleep',
      publish: 'publish',
    })
    .addEdge('sleep', 'check_schedule')
    .addConditionalEdges('publish', publishEdge, {
      record: 'record',
      handle_error: 'handle_error',
    })
    .addEdge('record', 'check_schedule')
    .addEdge('handle_error', 'check_schedule');

  return graph;
}

/**
 * Create the compiled publishing scheduler graph with checkpointing.
 */
export function createPublishingSchedulerGraph(
  options: PublishingSchedulerGraphOptions = {},
) {
  const graph = buildPublishingSchedulerGraph(options);
  const checkpointer = new MemorySaver();
  return graph.compile({ checkpointer });
}
