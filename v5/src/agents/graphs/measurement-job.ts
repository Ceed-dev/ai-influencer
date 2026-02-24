/**
 * FEAT-INT-004: Measurement Job Graph
 * Spec: 04-agent-design.md §5.4, 02-architecture.md §3.4
 *
 * Nodes: detect_targets -> (collect if targets | sleep if none)
 *        collect -> save_metrics -> trigger_analysis -> detect_targets
 *        sleep -> detect_targets
 *
 * 5 nodes total:
 *   1. detect_targets  - Find publications needing measurement (3 rounds: 48h/7d/30d)
 *   2. sleep           - Wait MEASUREMENT_POLL_INTERVAL_SEC (default: 300s)
 *   3. collect         - Collect metrics from platform APIs
 *   4. save_metrics    - INSERT metrics, UPDATE prediction_snapshots, mark measured
 *   5. trigger_analysis- Queue analysis tasks (48h->micro, 7d->cumulative, 30d->none)
 *
 * Continuous polling at MEASUREMENT_POLL_INTERVAL_SEC (default: 300s).
 * Collects metrics for content posted >= 48h ago across 3 measurement rounds.
 * All config from DB system_settings — no hardcoding.
 */
import { StateGraph, Annotation, START } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type {
  MeasurementTarget,
  CollectedMetrics,
  DetectTargetsEdgeResult,
  MeasurementType,
  Platform,
} from '@/types/langgraph-state';
import { getPool } from '../../db/pool.js';
import { getSettingNumber } from '../../lib/settings.js';
// MCP tool access via langchain-mcp-adapters (spec: 02-architecture.md SS4.3)
import { callMcpTool } from '../common/mcp-client.js';

// ---------------------------------------------------------------------------
// Analysis trigger type (spec: 04-agent-design.md §5.4 ステート構造)
// ---------------------------------------------------------------------------

export interface AnalysisTrigger {
  content_id: string;
  analysis_type: 'micro' | 'cumulative';
  measurement_point: '48h' | '7d';
}

// ---------------------------------------------------------------------------
// State annotation
// ---------------------------------------------------------------------------

export const MeasurementJobAnnotation = Annotation.Root({
  targets: Annotation<MeasurementTarget[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  current_target: Annotation<MeasurementTarget | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  collected_metrics: Annotation<CollectedMetrics | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),
  processed_count: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
  error_count: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
  analysis_triggers: Annotation<AnalysisTrigger[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
});

// ---------------------------------------------------------------------------
// Node functions
// ---------------------------------------------------------------------------

/**
 * detect_targets: Find publications needing measurement across 3 rounds.
 *
 * Queries publications joined with prediction_snapshots to find targets where:
 *   48h: actual_impressions_48h IS NULL AND posted_at + 48h <= NOW()
 *   7d:  actual_impressions_7d IS NULL AND posted_at + 7d <= NOW()
 *   30d: actual_impressions_30d IS NULL AND posted_at + 30d <= NOW()
 *
 * Spec: 04-agent-design.md §5.4 detect_targets
 */
async function detectTargets(
  _state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  const pool = getPool();

  let batchSize: number;
  try {
    batchSize = await getSettingNumber('MEASUREMENT_BATCH_SIZE');
  } catch {
    batchSize = 20; // fallback default
  }

  try {
    const res = await pool.query(
      `SELECT
         p.id AS publication_id,
         p.content_id,
         p.account_id,
         a.platform,
         p.platform_post_id,
         p.posted_at,
         ps.id AS prediction_snapshot_id,
         CASE
           WHEN ps.actual_impressions_48h IS NULL
                AND p.posted_at + INTERVAL '48 hours' <= NOW()
             THEN '48h'
           WHEN ps.actual_impressions_7d IS NULL
                AND p.posted_at + INTERVAL '7 days' <= NOW()
             THEN '7d'
           WHEN ps.actual_impressions_30d IS NULL
                AND p.posted_at + INTERVAL '30 days' <= NOW()
             THEN '30d'
         END AS measurement_point
       FROM publications p
       JOIN accounts a ON a.account_id = p.account_id
       LEFT JOIN prediction_snapshots ps ON ps.publication_id = p.id
       WHERE p.status = 'posted'
         AND p.platform_post_id IS NOT NULL
         AND (
           (ps.actual_impressions_48h IS NULL AND p.posted_at + INTERVAL '48 hours' <= NOW())
           OR (ps.actual_impressions_7d IS NULL AND p.posted_at + INTERVAL '7 days' <= NOW())
           OR (ps.actual_impressions_30d IS NULL AND p.posted_at + INTERVAL '30 days' <= NOW())
         )
       ORDER BY p.posted_at ASC
       LIMIT $1`,
      [batchSize],
    );

    const targets: MeasurementTarget[] = res.rows
      .filter((row) => row.measurement_point != null)
      .map((row) => ({
        task_id: 0, // No task_queue row for direct-detect targets
        publication_id: row.publication_id as number,
        content_id: row.content_id as string,
        account_id: row.account_id as string,
        platform: row.platform as Platform,
        platform_post_id: row.platform_post_id as string,
        posted_at: (row.posted_at as Date).toISOString(),
        measurement_type: row.measurement_point as MeasurementType,
      }));

    console.log(
      `[measurement-job] detect_targets: found ${targets.length} targets ` +
      `(48h: ${targets.filter(t => t.measurement_type === '48h').length}, ` +
      `7d: ${targets.filter(t => t.measurement_type === '7d').length}, ` +
      `30d: ${targets.filter(t => t.measurement_type === '30d').length})`,
    );

    return {
      targets,
      current_target: targets[0] ?? null,
      collected_metrics: null,
      analysis_triggers: [],
    };
  } catch (err) {
    console.error('[measurement-job] detect_targets error:', err);
    return {
      targets: [],
      current_target: null,
      collected_metrics: null,
      analysis_triggers: [],
    };
  }
}

/**
 * sleep: Wait for MEASUREMENT_POLL_INTERVAL_SEC before next detection round.
 * Spec: 04-agent-design.md §5.4, default 300s from system_settings.
 */
async function sleep(
  _state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  let intervalSec: number;
  try {
    intervalSec = await getSettingNumber('MEASUREMENT_POLL_INTERVAL_SEC');
  } catch {
    intervalSec = 300; // fallback default
  }

  console.log(`[measurement-job] sleep: waiting ${intervalSec}s before next poll`);
  await new Promise((resolve) => setTimeout(resolve, intervalSec * 1000));
  return {};
}

/**
 * collect: Collect metrics from platform-specific APIs for the current_target.
 *
 * Routes to the appropriate platform collector:
 *   youtube   -> collectYoutubeMetrics
 *   tiktok    -> collectTiktokMetrics
 *   instagram -> collectInstagramMetrics
 *   x         -> collectXMetrics
 *
 * Also calls collectAccountMetrics for follower_delta.
 *
 * Spec: 04-agent-design.md §5.4 collect
 */
async function collect(
  state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  const target = state.current_target;
  if (!target) {
    console.error('[measurement-job] collect: no current_target');
    return { collected_metrics: null };
  }

  try {
    // Collect platform-specific metrics
    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;
    let saves: number | undefined;
    let watchTimeSeconds: number | undefined;
    let completionRate: number | undefined;
    let impressions: number | undefined;
    let reach: number | undefined;
    let rawData: Record<string, unknown> = {};

    const postId = target.platform_post_id;

    switch (target.platform) {
      case 'youtube': {
        const yt = await callMcpTool<{ views: number; likes: number; comments: number; shares: number; watch_time: number; completion_rate: number }>('collect_youtube_metrics', { platform_post_id: postId });
        views = yt.views;
        likes = yt.likes;
        comments = yt.comments;
        shares = yt.shares;
        watchTimeSeconds = yt.watch_time;
        completionRate = yt.completion_rate;
        rawData = { ...yt };
        break;
      }
      case 'tiktok': {
        const tt = await callMcpTool<{ views: number; likes: number; comments: number; shares: number; saves: number; completion_rate: number }>('collect_tiktok_metrics', { platform_post_id: postId });
        views = tt.views;
        likes = tt.likes;
        comments = tt.comments;
        shares = tt.shares;
        saves = tt.saves;
        completionRate = tt.completion_rate;
        rawData = { ...tt };
        break;
      }
      case 'instagram': {
        const ig = await callMcpTool<{ views: number; likes: number; comments: number; saves: number; impressions: number; reach: number }>('collect_instagram_metrics', { platform_post_id: postId });
        views = ig.views;
        likes = ig.likes;
        comments = ig.comments;
        saves = ig.saves;
        impressions = ig.impressions;
        reach = ig.reach;
        rawData = { ...ig };
        break;
      }
      case 'x': {
        const xm = await callMcpTool<{ impressions: number; likes: number; replies: number; retweets: number; quotes: number }>('collect_x_metrics', { platform_post_id: postId });
        views = xm.impressions; // X uses impressions as view equivalent
        likes = xm.likes;
        comments = xm.replies;
        shares = xm.retweets;
        impressions = xm.impressions;
        rawData = { ...xm, quotes: xm.quotes };
        break;
      }
      default:
        console.error(`[measurement-job] collect: unsupported platform '${target.platform}'`);
        return { collected_metrics: null };
    }

    // Collect account-level metrics for follower_delta
    let followerDelta = 0;
    try {
      const accountMetrics = await callMcpTool<{ follower_delta: number }>('collect_account_metrics', {
        account_id: target.account_id,
      });
      followerDelta = accountMetrics.follower_delta;
    } catch (err) {
      console.error('[measurement-job] collect: failed to get account metrics:', err);
      // Non-fatal: continue with follower_delta = 0
    }

    // Calculate engagement rate: (likes + comments + shares) / views
    const totalEngagement = likes + comments + (shares ?? 0);
    const engagementRate = views > 0
      ? Number((totalEngagement / views).toFixed(4))
      : 0;

    const collectedMetrics: CollectedMetrics = {
      views,
      likes,
      comments,
      shares: shares ?? 0,
      saves,
      watch_time_seconds: watchTimeSeconds,
      completion_rate: completionRate,
      engagement_rate: engagementRate,
      follower_delta: followerDelta,
      impressions,
      reach,
      raw_data: rawData,
    };

    console.log(
      `[measurement-job] collect: ${target.platform}/${target.platform_post_id} ` +
      `(${target.measurement_type}) views=${views} engagement=${engagementRate}`,
    );

    return { collected_metrics: collectedMetrics };
  } catch (err) {
    console.error(
      `[measurement-job] collect error for pub=${target.publication_id}:`,
      err,
    );
    return {
      collected_metrics: null,
      error_count: state.error_count + 1,
    };
  }
}

/**
 * save_metrics: Persist collected metrics to DB.
 *
 * 1. INSERT into metrics table via reportMeasurementComplete MCP tool
 * 2. UPDATE prediction_snapshots based on measurement_type:
 *    - 48h: SET actual_impressions_48h
 *    - 7d:  SET actual_impressions_7d, prediction_error_7d
 *    - 30d: SET actual_impressions_30d, prediction_error_30d
 * 3. UPDATE publications.status -> 'measured' (when all rounds complete)
 *
 * Spec: 04-agent-design.md §5.4 save_metrics
 */
async function saveMetrics(
  state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  const target = state.current_target;
  const metrics = state.collected_metrics;

  if (!target || !metrics) {
    console.error('[measurement-job] save_metrics: missing target or metrics');
    return {
      processed_count: state.processed_count,
      current_target: null,
      collected_metrics: null,
    };
  }

  const pool = getPool();

  try {
    // 1. INSERT metrics directly (bypasses reportMeasurementComplete which
    //    requires task_id >= 1; direct-detect targets have no task_queue row)
    const measurementType = target.measurement_type;

    await pool.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, saves,
                            engagement_rate, follower_delta, impressions, reach, measurement_point)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (publication_id, measurement_point)
       DO UPDATE SET
         views = EXCLUDED.views,
         likes = EXCLUDED.likes,
         comments = EXCLUDED.comments,
         shares = EXCLUDED.shares,
         saves = EXCLUDED.saves,
         engagement_rate = EXCLUDED.engagement_rate,
         follower_delta = EXCLUDED.follower_delta,
         impressions = EXCLUDED.impressions,
         reach = EXCLUDED.reach,
         measured_at = NOW()`,
      [
        target.publication_id,
        metrics.views,
        metrics.likes,
        metrics.comments,
        metrics.shares,
        metrics.saves ?? null,
        metrics.engagement_rate,
        metrics.follower_delta,
        metrics.impressions ?? null,
        metrics.reach ?? null,
        measurementType,
      ],
    );

    // 2. UPDATE prediction_snapshots based on measurement_type
    const actualImpressions = metrics.views;

    switch (measurementType) {
      case '48h':
        await pool.query(
          `UPDATE prediction_snapshots
           SET actual_impressions_48h = $1, updated_at = NOW()
           WHERE publication_id = $2`,
          [actualImpressions, target.publication_id],
        );
        break;

      case '7d':
        // prediction_error_7d = ABS(predicted - actual) / actual
        await pool.query(
          `UPDATE prediction_snapshots
           SET actual_impressions_7d = $1,
               prediction_error_7d = CASE
                 WHEN $1 > 0 THEN ABS(predicted_impressions - $1)::NUMERIC / $1
                 ELSE NULL
               END,
               updated_at = NOW()
           WHERE publication_id = $2`,
          [actualImpressions, target.publication_id],
        );
        break;

      case '30d':
        // prediction_error_30d = ABS(predicted - actual) / actual
        await pool.query(
          `UPDATE prediction_snapshots
           SET actual_impressions_30d = $1,
               prediction_error_30d = CASE
                 WHEN $1 > 0 THEN ABS(predicted_impressions - $1)::NUMERIC / $1
                 ELSE NULL
               END,
               updated_at = NOW()
           WHERE publication_id = $2`,
          [actualImpressions, target.publication_id],
        );
        break;
    }

    // 3. Check if all measurement rounds are complete -> update status to 'measured'
    // Only mark as 'measured' after 30d round, or if this is the final expected round
    if (measurementType === '30d') {
      await pool.query(
        `UPDATE publications SET status = 'measured', updated_at = NOW()
         WHERE id = $1 AND status = 'posted'`,
        [target.publication_id],
      );
    }

    console.log(
      `[measurement-job] save_metrics: pub=${target.publication_id} ` +
      `${measurementType} saved (views=${metrics.views})`,
    );

    return {
      processed_count: state.processed_count + 1,
    };
  } catch (err) {
    console.error(
      `[measurement-job] save_metrics error for pub=${target.publication_id}:`,
      err,
    );
    return {
      processed_count: state.processed_count,
      error_count: state.error_count + 1,
    };
  }
}

/**
 * trigger_analysis: Queue analysis tasks based on measurement_type.
 *
 * - 48h -> INSERT task_queue (task_type='curate', payload includes analysis_type='micro')
 * - 7d  -> INSERT task_queue (task_type='curate', payload includes analysis_type='cumulative')
 * - 30d -> No trigger (data preservation only)
 *
 * After processing, advance to the next target in the targets array.
 *
 * Note: The spec calls for task_type='analyze' but the DB constraint only permits
 * 'produce'|'publish'|'measure'|'curate'. We use 'curate' as the closest match
 * since analysis/curation are handled by the same downstream pipeline.
 *
 * Spec: 04-agent-design.md §5.4 trigger_analysis
 */
async function triggerAnalysis(
  state: typeof MeasurementJobAnnotation.State,
): Promise<Partial<typeof MeasurementJobAnnotation.State>> {
  const target = state.current_target;

  if (!target) {
    console.error('[measurement-job] trigger_analysis: no current_target');
    return advanceToNextTarget(state);
  }

  const pool = getPool();
  const measurementType = target.measurement_type;
  const triggers = [...state.analysis_triggers];

  try {
    if (measurementType === '48h' || measurementType === '7d') {
      const analysisType = measurementType === '48h' ? 'micro' : 'cumulative';

      await pool.query(
        `INSERT INTO task_queue (task_type, payload, status, priority)
         VALUES ('curate', $1::jsonb, 'pending', 0)`,
        [
          JSON.stringify({
            analysis_type: analysisType,
            content_id: target.content_id,
            publication_id: target.publication_id,
            account_id: target.account_id,
            platform: target.platform,
            measurement_point: measurementType,
            triggered_by: 'measurement_job',
          }),
        ],
      );

      triggers.push({
        content_id: target.content_id,
        analysis_type: analysisType,
        measurement_point: measurementType,
      });

      console.log(
        `[measurement-job] trigger_analysis: queued ${analysisType} analysis ` +
        `for content=${target.content_id} (${measurementType})`,
      );
    } else {
      // 30d: no analysis trigger, data preservation only
      console.log(
        `[measurement-job] trigger_analysis: 30d measurement for ` +
        `content=${target.content_id} — no analysis trigger`,
      );
    }
  } catch (err) {
    console.error(
      `[measurement-job] trigger_analysis error for content=${target?.content_id}:`,
      err,
    );
    // Non-fatal: continue to next target even if trigger fails
  }

  return {
    ...advanceToNextTarget(state),
    analysis_triggers: triggers,
  };
}

/**
 * Helper: advance to the next target in the targets array.
 * Removes the current target and sets the next one (or null if done).
 */
function advanceToNextTarget(
  state: typeof MeasurementJobAnnotation.State,
): Partial<typeof MeasurementJobAnnotation.State> {
  const currentTarget = state.current_target;
  const remaining = state.targets.filter(
    (t) =>
      t.publication_id !== currentTarget?.publication_id ||
      t.measurement_type !== currentTarget?.measurement_type,
  );
  return {
    targets: remaining,
    current_target: remaining[0] ?? null,
    collected_metrics: null,
  };
}

// ---------------------------------------------------------------------------
// Conditional edge functions
// ---------------------------------------------------------------------------

export function detectTargetsEdge(
  state: typeof MeasurementJobAnnotation.State,
): DetectTargetsEdgeResult {
  return state.targets.length > 0 ? 'collect' : 'sleep';
}

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

export interface MeasurementJobGraphOptions {
  detectTargets?: typeof detectTargets;
  sleep?: typeof sleep;
  collect?: typeof collect;
  saveMetrics?: typeof saveMetrics;
  triggerAnalysis?: typeof triggerAnalysis;
}

export function buildMeasurementJobGraph(
  options: MeasurementJobGraphOptions = {},
) {
  const graph = new StateGraph(MeasurementJobAnnotation)
    .addNode('detect_targets', options.detectTargets ?? detectTargets)
    .addNode('sleep', options.sleep ?? sleep)
    .addNode('collect', options.collect ?? collect)
    .addNode('save_metrics', options.saveMetrics ?? saveMetrics)
    .addNode('trigger_analysis', options.triggerAnalysis ?? triggerAnalysis)

    // Edges
    .addEdge(START, 'detect_targets')
    .addConditionalEdges('detect_targets', detectTargetsEdge, {
      collect: 'collect',
      sleep: 'sleep',
    })
    .addEdge('sleep', 'detect_targets')
    .addEdge('collect', 'save_metrics')
    .addEdge('save_metrics', 'trigger_analysis')
    .addEdge('trigger_analysis', 'detect_targets');

  return graph;
}

/**
 * Create the compiled measurement job graph with checkpointing.
 */
export function createMeasurementJobGraph(
  options: MeasurementJobGraphOptions = {},
) {
  const graph = buildMeasurementJobGraph(options);
  const checkpointer = new MemorySaver();
  return graph.compile({ checkpointer });
}
