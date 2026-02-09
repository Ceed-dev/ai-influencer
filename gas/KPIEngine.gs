/**
 * KPI Engine - Compare metrics against targets (v2.0)
 */

/**
 * Get KPI targets from sheet or defaults
 */
function getKPITargets() {
  try {
    var sheet = getSheet(CONFIG.SHEETS.KPI_TARGETS);
    var data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return CONFIG.KPI_DEFAULTS;
    }

    var headers = data[0];
    var targets = {};

    for (var i = 1; i < data.length; i++) {
      var platform = data[i][headers.indexOf('platform')];
      var metric = data[i][headers.indexOf('metric')];
      var value = data[i][headers.indexOf('target_value')];

      if (!targets[platform]) {
        targets[platform] = {};
      }
      targets[platform][metric] = value;
    }

    // Merge with defaults for missing values
    Object.keys(CONFIG.KPI_DEFAULTS).forEach(function(platform) {
      if (!targets[platform]) {
        targets[platform] = CONFIG.KPI_DEFAULTS[platform];
      } else {
        Object.keys(CONFIG.KPI_DEFAULTS[platform]).forEach(function(metric) {
          if (targets[platform][metric] === undefined) {
            targets[platform][metric] = CONFIG.KPI_DEFAULTS[platform][metric];
          }
        });
      }
    });

    return targets;
  } catch (e) {
    Logger.log('Error getting KPI targets: ' + e.message);
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
  var results = [];

  Object.entries(metricsBundle).forEach(function(entry) {
    var videoUid = entry[0];
    var platforms = entry[1];

    var videoResult = {
      video_uid: videoUid,
      platforms: {},
      overall_score: 0,
      improvement_areas: []
    };

    var totalScore = 0;
    var platformCount = 0;

    Object.entries(platforms).forEach(function(platformEntry) {
      var platform = platformEntry[0];
      var metrics = platformEntry[1];
      var targets = kpiTargets[platform] || {};
      var comparison = comparePlatformKPIs(metrics, targets);

      videoResult.platforms[platform] = comparison;
      totalScore += comparison.score;
      platformCount++;

      comparison.below_target.forEach(function(item) {
        videoResult.improvement_areas.push({
          platform: platform,
          metric: item.metric,
          gap: item.gap,
          priority: calculatePriority(item.gap)
        });
      });
    });

    videoResult.overall_score = platformCount > 0 ? totalScore / platformCount : 0;
    videoResult.improvement_areas.sort(function(a, b) { return b.priority - a.priority; });

    results.push(videoResult);
  });

  results.sort(function(a, b) { return a.overall_score - b.overall_score; });
  return results;
}

/**
 * Compare single platform metrics against targets
 */
function comparePlatformKPIs(metrics, targets) {
  var result = {
    score: 0,
    above_target: [],
    below_target: [],
    at_target: [],
    details: {}
  };

  var metricCount = 0;
  var achievedCount = 0;

  Object.entries(targets).forEach(function(entry) {
    var metric = entry[0];
    var target = entry[1];
    var actual = metrics[metric];

    if (actual === null || actual === undefined) {
      result.details[metric] = { status: 'no_data', target: target };
      return;
    }

    metricCount++;
    var ratio = actual / target;
    var gap = actual - target;
    var percentGap = ((actual - target) / target) * 100;

    var detail = {
      actual: actual,
      target: target,
      ratio: ratio,
      gap: gap,
      percent_gap: percentGap
    };

    if (ratio >= 1) {
      achievedCount++;
      detail.status = 'above';
      result.above_target.push({ metric: metric, actual: actual, target: target, ratio: ratio, gap: gap, percent_gap: percentGap, status: 'above' });
    } else if (ratio >= 0.95) {
      achievedCount += 0.5;
      detail.status = 'at';
      result.at_target.push({ metric: metric, actual: actual, target: target, ratio: ratio, gap: gap, percent_gap: percentGap, status: 'at' });
    } else {
      detail.status = 'below';
      result.below_target.push({ metric: metric, actual: actual, target: target, ratio: ratio, gap: gap, percent_gap: percentGap, status: 'below' });
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
  var absGap = Math.abs(gap);
  return Math.min(100, absGap * 100);
}

/**
 * Get metrics bundle for specified videos
 */
function getMetricsBundle(videoUids) {
  var bundle = {};

  videoUids.forEach(function(uid) {
    bundle[uid] = {};
  });

  ['youtube', 'tiktok', 'instagram'].forEach(function(platform) {
    try {
      var sheetName = CONFIG.SHEETS['METRICS_' + platform.toUpperCase()];
      var sheet = getSheet(sheetName);
      var data = sheet.getDataRange().getValues();

      if (data.length < 2) return;

      var headers = data[0];
      var videoUidCol = headers.indexOf('video_uid');

      for (var i = 1; i < data.length; i++) {
        var uid = data[i][videoUidCol];
        if (videoUids.indexOf(uid) !== -1) {
          if (!bundle[uid]) bundle[uid] = {};
          bundle[uid][platform] = {};
          headers.forEach(function(header, j) {
            if (header !== 'video_uid' && header !== 'import_date') {
              bundle[uid][platform][header] = data[i][j];
            }
          });
        }
      }
    } catch (e) {
      Logger.log('Error getting ' + platform + ' metrics: ' + e.message);
    }
  });

  return bundle;
}

/**
 * Generate KPI summary for a video
 */
function generateKPISummary(kpiResult) {
  var lines = [];

  lines.push('Video: ' + kpiResult.video_uid);
  lines.push('Overall Score: ' + kpiResult.overall_score.toFixed(1) + '%');
  lines.push('');

  Object.entries(kpiResult.platforms).forEach(function(entry) {
    var platform = entry[0];
    var comparison = entry[1];
    lines.push('[' + platform.toUpperCase() + ']');
    lines.push('Score: ' + comparison.score.toFixed(1) + '%');

    if (comparison.above_target.length > 0) {
      lines.push('Above target: ' + comparison.above_target.map(function(m) { return m.metric; }).join(', '));
    }

    if (comparison.below_target.length > 0) {
      lines.push('Below target: ' + comparison.below_target.map(function(m) {
        return m.metric + ' (' + m.percent_gap.toFixed(1) + '%)';
      }).join(', '));
    }

    lines.push('');
  });

  if (kpiResult.improvement_areas.length > 0) {
    lines.push('Priority Improvements:');
    kpiResult.improvement_areas.slice(0, 5).forEach(function(area, i) {
      lines.push((i + 1) + '. [' + area.platform + '] ' + area.metric);
    });
  }

  return lines.join('\n');
}
