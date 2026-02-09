/**
 * ScoreUpdater - Calculate and update component performance scores
 * Updates avg_performance_score in component inventories based on video analysis results
 */

/**
 * Update all component scores based on master sheet data
 * Call this after analysis is complete
 */
function updateAllComponentScores() {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var allVideos = readSheetAsObjects(masterSheet);

  // Filter to only analyzed videos with scores
  var scoredVideos = allVideos.filter(function(v) {
    return v.status === 'analyzed' && v.overall_score;
  });

  if (scoredVideos.length === 0) {
    Logger.log('No analyzed videos with scores found');
    return;
  }

  // Build component → scores map
  var componentScores = {};
  var componentColumns = [].concat(
    CONFIG.MASTER_COLUMNS.HOOK,
    CONFIG.MASTER_COLUMNS.BODY,
    CONFIG.MASTER_COLUMNS.CTA,
    CONFIG.MASTER_COLUMNS.CHARACTER
  );

  scoredVideos.forEach(function(video) {
    componentColumns.forEach(function(col) {
      var componentId = video[col];
      if (componentId) {
        if (!componentScores[componentId]) {
          componentScores[componentId] = [];
        }
        componentScores[componentId].push(Number(video.overall_score));
      }
    });
  });

  // Group by inventory type and batch update
  var byType = {};
  Object.keys(componentScores).forEach(function(id) {
    var type = getInventoryTypeFromId(id);
    if (type) {
      if (!byType[type]) byType[type] = {};
      byType[type][id] = componentScores[id];
    }
  });

  var updatedCount = 0;
  Object.keys(byType).forEach(function(type) {
    try {
      var sheet = getInventorySheet(type);
      var allData = readSheetAsObjects(sheet);

      allData.forEach(function(row) {
        var id = row.component_id;
        if (byType[type][id]) {
          var scores = byType[type][id];
          var avgScore = calculateAvgScore(scores);
          var timesUsed = scores.length;

          updateRowByIndex(sheet, row._rowIndex, {
            avg_performance_score: avgScore,
            times_used: timesUsed
          });
          updatedCount++;
        }
      });
    } catch (e) {
      Logger.log('Error updating scores for ' + type + ': ' + e.message);
    }
  });

  Logger.log('Updated scores for ' + updatedCount + ' components');
  return updatedCount;
}

/**
 * Calculate average score from array of scores
 * @param {Array<number>} scores
 * @returns {number} Rounded average
 */
function calculateAvgScore(scores) {
  if (!scores || scores.length === 0) return 0;
  var validScores = scores.filter(function(s) { return !isNaN(s) && s > 0; });
  if (validScores.length === 0) return 0;
  var sum = validScores.reduce(function(a, b) { return a + b; }, 0);
  return Math.round(sum / validScores.length);
}

/**
 * Update scores for components used in a specific video
 * @param {string} videoUid
 * @param {number} overallScore
 */
function updateComponentScoresForVideo(videoUid, overallScore) {
  if (!overallScore || overallScore <= 0) return;

  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var video = findRowByColumn(masterSheet, 'video_uid', videoUid);
  if (!video) return;

  var componentColumns = [].concat(
    CONFIG.MASTER_COLUMNS.HOOK,
    CONFIG.MASTER_COLUMNS.BODY,
    CONFIG.MASTER_COLUMNS.CTA,
    CONFIG.MASTER_COLUMNS.CHARACTER
  );

  var componentIds = [];
  componentColumns.forEach(function(col) {
    if (video[col]) componentIds.push(video[col]);
  });

  // Deduplicate
  var uniqueIds = unique(componentIds);

  uniqueIds.forEach(function(id) {
    try {
      updateSingleComponentScore(id, overallScore);
    } catch (e) {
      Logger.log('Error updating score for ' + id + ': ' + e.message);
    }
  });
}

/**
 * Recalculate and update score for a single component
 * @param {string} componentId
 * @param {number} [newScore] - Optional new score to include
 */
function updateSingleComponentScore(componentId, newScore) {
  var history = getComponentPerformanceHistory(componentId);

  var scores = history.map(function(h) { return Number(h.overall_score); });
  if (newScore) scores.push(Number(newScore));

  var avgScore = calculateAvgScore(scores);

  var type = getInventoryTypeFromId(componentId);
  if (!type) return;

  var sheet = getInventorySheet(type);
  var row = findRowByColumn(sheet, 'component_id', componentId);

  if (row) {
    updateRowByIndex(sheet, row._rowIndex, {
      avg_performance_score: avgScore,
      times_used: scores.length
    });
  }
}

/**
 * Normalize overall_score to 0-100 scale
 * Used when KPI comparison returns raw percentages
 * @param {Object} kpiResult - KPI comparison result for a video
 * @returns {number} Normalized score 0-100
 */
function normalizeOverallScore(kpiResult) {
  if (!kpiResult || !kpiResult.platforms) return 0;

  var platformScores = [];
  Object.keys(kpiResult.platforms).forEach(function(platform) {
    var comparison = kpiResult.platforms[platform];
    if (comparison && typeof comparison.score === 'number') {
      platformScores.push(comparison.score);
    }
  });

  if (platformScores.length === 0) return 0;

  var avg = platformScores.reduce(function(a, b) { return a + b; }, 0) / platformScores.length;
  return Math.round(Math.min(100, Math.max(0, avg)));
}

/**
 * Get score summary for all component types
 * @returns {Object} Summary by inventory type
 */
function getScoreSummary() {
  var summary = {};

  ['scenarios', 'motions', 'characters', 'audio'].forEach(function(type) {
    try {
      var components = listComponents(type, { status: 'active' });
      var scored = components.filter(function(c) { return c.avg_performance_score > 0; });

      summary[type] = {
        total: components.length,
        scored: scored.length,
        avg_score: scored.length > 0
          ? Math.round(scored.reduce(function(sum, c) { return sum + c.avg_performance_score; }, 0) / scored.length)
          : 0,
        top: scored.sort(function(a, b) { return b.avg_performance_score - a.avg_performance_score; }).slice(0, 3).map(function(c) {
          return { id: c.component_id, name: c.name, score: c.avg_performance_score };
        })
      };
    } catch (e) {
      summary[type] = { total: 0, scored: 0, avg_score: 0, top: [] };
    }
  });

  return summary;
}
