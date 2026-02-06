/**
 * KPI Engine - Compare metrics against targets
 */

/**
 * Get KPI targets from sheet or defaults
 */
function getKPITargets() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.KPI_TARGETS);
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return CONFIG.KPI_DEFAULTS;
    }

    const headers = data[0];
    const targets = {};

    // Parse sheet data into targets object
    for (let i = 1; i < data.length; i++) {
      const platform = data[i][headers.indexOf('platform')];
      const metric = data[i][headers.indexOf('metric')];
      const value = data[i][headers.indexOf('target_value')];

      if (!targets[platform]) {
        targets[platform] = {};
      }
      targets[platform][metric] = value;
    }

    // Merge with defaults for missing values
    Object.keys(CONFIG.KPI_DEFAULTS).forEach(platform => {
      if (!targets[platform]) {
        targets[platform] = CONFIG.KPI_DEFAULTS[platform];
      } else {
        Object.keys(CONFIG.KPI_DEFAULTS[platform]).forEach(metric => {
          if (targets[platform][metric] === undefined) {
            targets[platform][metric] = CONFIG.KPI_DEFAULTS[platform][metric];
          }
        });
      }
    });

    return targets;
  } catch (e) {
    Logger.log(`Error getting KPI targets: ${e.message}`);
    return CONFIG.KPI_DEFAULTS;
  }
}

/**
 * Compare metrics against KPI targets
 * @param {Object} metricsBundle - Metrics grouped by video_uid
 * @param {Object} kpiTargets - KPI targets by platform
 * @returns {Array<Object>} Comparison results
 */
function compareKPIs(metricsBundle, kpiTargets) {
  const results = [];

  Object.entries(metricsBundle).forEach(([videoUid, platforms]) => {
    const videoResult = {
      video_uid: videoUid,
      platforms: {},
      overall_score: 0,
      improvement_areas: []
    };

    let totalScore = 0;
    let platformCount = 0;

    Object.entries(platforms).forEach(([platform, metrics]) => {
      const targets = kpiTargets[platform] || {};
      const comparison = comparePlatformKPIs(metrics, targets);

      videoResult.platforms[platform] = comparison;
      totalScore += comparison.score;
      platformCount++;

      // Collect improvement areas
      comparison.below_target.forEach(item => {
        videoResult.improvement_areas.push({
          platform,
          metric: item.metric,
          gap: item.gap,
          priority: calculatePriority(item.gap)
        });
      });
    });

    videoResult.overall_score = platformCount > 0 ? totalScore / platformCount : 0;

    // Sort improvement areas by priority
    videoResult.improvement_areas.sort((a, b) => b.priority - a.priority);

    results.push(videoResult);
  });

  // Sort by overall score (lowest first - needs most improvement)
  results.sort((a, b) => a.overall_score - b.overall_score);

  return results;
}

/**
 * Compare single platform metrics against targets
 */
function comparePlatformKPIs(metrics, targets) {
  const result = {
    score: 0,
    above_target: [],
    below_target: [],
    at_target: [],
    details: {}
  };

  let metricCount = 0;
  let achievedCount = 0;

  Object.entries(targets).forEach(([metric, target]) => {
    const actual = metrics[metric];

    if (actual === null || actual === undefined) {
      result.details[metric] = { status: 'no_data', target };
      return;
    }

    metricCount++;
    const ratio = actual / target;
    const gap = actual - target;
    const percentGap = ((actual - target) / target) * 100;

    const detail = {
      actual,
      target,
      ratio,
      gap,
      percent_gap: percentGap
    };

    if (ratio >= 1) {
      achievedCount++;
      detail.status = 'above';
      result.above_target.push({ metric, ...detail });
    } else if (ratio >= 0.95) {
      achievedCount += 0.5;
      detail.status = 'at';
      result.at_target.push({ metric, ...detail });
    } else {
      detail.status = 'below';
      result.below_target.push({ metric, ...detail });
    }

    result.details[metric] = detail;
  });

  result.score = metricCount > 0 ? (achievedCount / metricCount) * 100 : 0;

  return result;
}

/**
 * Calculate priority score for improvement area
 */
function calculatePriority(gap) {
  // Larger negative gaps = higher priority
  const absGap = Math.abs(gap);

  // Normalize to 0-100 scale
  return Math.min(100, absGap * 100);
}

/**
 * Get metrics bundle for specified videos
 */
function getMetricsBundle(videoUids) {
  const bundle = {};

  videoUids.forEach(uid => {
    bundle[uid] = {};
  });

  // Get from each platform sheet
  ['youtube', 'tiktok', 'instagram'].forEach(platform => {
    try {
      const sheetName = CONFIG.SHEETS[`METRICS_${platform.toUpperCase()}`];
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();

      if (data.length < 2) return;

      const headers = data[0];
      const videoUidCol = headers.indexOf('video_uid');

      for (let i = 1; i < data.length; i++) {
        const uid = data[i][videoUidCol];
        if (videoUids.includes(uid)) {
          if (!bundle[uid]) bundle[uid] = {};

          bundle[uid][platform] = {};
          headers.forEach((header, j) => {
            if (header !== 'video_uid' && header !== 'import_date') {
              bundle[uid][platform][header] = data[i][j];
            }
          });
        }
      }
    } catch (e) {
      Logger.log(`Error getting ${platform} metrics: ${e.message}`);
    }
  });

  return bundle;
}

/**
 * Generate KPI summary for a video
 */
function generateKPISummary(kpiResult) {
  const lines = [];

  lines.push(`Video: ${kpiResult.video_uid}`);
  lines.push(`Overall Score: ${kpiResult.overall_score.toFixed(1)}%`);
  lines.push('');

  Object.entries(kpiResult.platforms).forEach(([platform, comparison]) => {
    lines.push(`[${platform.toUpperCase()}]`);
    lines.push(`Score: ${comparison.score.toFixed(1)}%`);

    if (comparison.above_target.length > 0) {
      lines.push('✓ Above target: ' + comparison.above_target.map(m => m.metric).join(', '));
    }

    if (comparison.below_target.length > 0) {
      lines.push('✗ Below target: ' + comparison.below_target.map(m =>
        `${m.metric} (${m.percent_gap.toFixed(1)}%)`
      ).join(', '));
    }

    lines.push('');
  });

  if (kpiResult.improvement_areas.length > 0) {
    lines.push('Priority Improvements:');
    kpiResult.improvement_areas.slice(0, 5).forEach((area, i) => {
      lines.push(`${i + 1}. [${area.platform}] ${area.metric}`);
    });
  }

  return lines.join('\n');
}
