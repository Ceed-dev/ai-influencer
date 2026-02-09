/**
 * ScoreUpdater.test.js - Unit tests for ScoreUpdater.gs (v2.0)
 *
 * Tests component score calculation, updating, and normalization.
 * Run with: npm test -- gas/tests/ScoreUpdater.test.js
 */

// Re-implement functions for testing (GAS has no module exports)
function updateAllComponentScores() {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var allVideos = readSheetAsObjects(masterSheet);

  var scoredVideos = allVideos.filter(function(v) {
    return v.status === 'analyzed' && v.overall_score;
  });

  if (scoredVideos.length === 0) {
    Logger.log('No analyzed videos with scores found');
    return;
  }

  var componentScores = {};
  var componentColumns = [].concat(
    CONFIG.MASTER_COLUMNS.HOOK, CONFIG.MASTER_COLUMNS.BODY,
    CONFIG.MASTER_COLUMNS.CTA, CONFIG.MASTER_COLUMNS.CHARACTER
  );

  scoredVideos.forEach(function(video) {
    componentColumns.forEach(function(col) {
      var componentId = video[col];
      if (componentId) {
        if (!componentScores[componentId]) componentScores[componentId] = [];
        componentScores[componentId].push(Number(video.overall_score));
      }
    });
  });

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

function calculateAvgScore(scores) {
  if (!scores || scores.length === 0) return 0;
  var validScores = scores.filter(function(s) { return !isNaN(s) && s > 0; });
  if (validScores.length === 0) return 0;
  var sum = validScores.reduce(function(a, b) { return a + b; }, 0);
  return Math.round(sum / validScores.length);
}

function updateComponentScoresForVideo(videoUid, overallScore) {
  if (!overallScore || overallScore <= 0) return;

  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var video = findRowByColumn(masterSheet, 'video_uid', videoUid);
  if (!video) return;

  var componentColumns = [].concat(
    CONFIG.MASTER_COLUMNS.HOOK, CONFIG.MASTER_COLUMNS.BODY,
    CONFIG.MASTER_COLUMNS.CTA, CONFIG.MASTER_COLUMNS.CHARACTER
  );

  var componentIds = [];
  componentColumns.forEach(function(col) {
    if (video[col]) componentIds.push(video[col]);
  });

  var uniqueIds = unique(componentIds);
  uniqueIds.forEach(function(id) {
    try {
      updateSingleComponentScore(id, overallScore);
    } catch (e) {
      Logger.log('Error updating score for ' + id + ': ' + e.message);
    }
  });
}

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

// Mock dependencies
global.getComponentPerformanceHistory = jest.fn(() => []);
global.listComponents = jest.fn((type, filters) => []);

// Helper to build a master row from partial data
function buildMasterRow(data) {
  return CONFIG.MASTER_ALL_COLUMNS.map(function(col) {
    return data[col] !== undefined ? data[col] : '';
  });
}

// Standard inventory headers
const INVENTORY_HEADERS = CONFIG.INVENTORY_COLUMNS;

function buildInventoryData(items) {
  const rows = [INVENTORY_HEADERS];
  items.forEach(function(item) {
    rows.push(INVENTORY_HEADERS.map(function(h) { return item[h] !== undefined ? item[h] : ''; }));
  });
  return rows;
}

// ============================================================
// Tests
// ============================================================

describe('ScoreUpdater', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // calculateAvgScore Tests
  // ----------------------------------------------------------
  describe('calculateAvgScore', () => {
    test('calculates average of valid scores', () => {
      expect(calculateAvgScore([80, 90, 70])).toBe(80);
    });

    test('rounds to nearest integer', () => {
      expect(calculateAvgScore([80, 90, 75])).toBe(82); // 81.67 -> 82
    });

    test('returns 0 for empty array', () => {
      expect(calculateAvgScore([])).toBe(0);
    });

    test('returns 0 for null input', () => {
      expect(calculateAvgScore(null)).toBe(0);
    });

    test('filters out NaN values', () => {
      expect(calculateAvgScore([80, NaN, 90])).toBe(85);
    });

    test('filters out zero and negative values', () => {
      expect(calculateAvgScore([80, 0, -10, 90])).toBe(85);
    });

    test('returns 0 when all values are invalid', () => {
      expect(calculateAvgScore([0, NaN, -5])).toBe(0);
    });

    test('handles single value', () => {
      expect(calculateAvgScore([75])).toBe(75);
    });
  });

  // ----------------------------------------------------------
  // normalizeOverallScore Tests
  // ----------------------------------------------------------
  describe('normalizeOverallScore', () => {
    test('averages platform scores', () => {
      const result = normalizeOverallScore({
        platforms: {
          youtube: { score: 80 },
          tiktok: { score: 60 }
        }
      });
      expect(result).toBe(70);
    });

    test('returns 0 for null input', () => {
      expect(normalizeOverallScore(null)).toBe(0);
    });

    test('returns 0 for missing platforms', () => {
      expect(normalizeOverallScore({})).toBe(0);
    });

    test('returns 0 for empty platforms', () => {
      expect(normalizeOverallScore({ platforms: {} })).toBe(0);
    });

    test('caps at 100', () => {
      const result = normalizeOverallScore({
        platforms: { youtube: { score: 150 } }
      });
      expect(result).toBe(100);
    });

    test('floors at 0', () => {
      const result = normalizeOverallScore({
        platforms: { youtube: { score: -10 } }
      });
      expect(result).toBe(0);
    });

    test('rounds to integer', () => {
      const result = normalizeOverallScore({
        platforms: {
          youtube: { score: 80 },
          tiktok: { score: 75 },
          instagram: { score: 65 }
        }
      });
      expect(result).toBe(73); // 73.33 -> 73
    });

    test('skips platforms without numeric score', () => {
      const result = normalizeOverallScore({
        platforms: {
          youtube: { score: 80 },
          tiktok: { score: 'invalid' },
          instagram: { score: 60 }
        }
      });
      expect(result).toBe(70); // Only youtube + instagram
    });

    test('handles single platform', () => {
      const result = normalizeOverallScore({
        platforms: { youtube: { score: 85 } }
      });
      expect(result).toBe(85);
    });
  });

  // ----------------------------------------------------------
  // updateAllComponentScores Tests
  // ----------------------------------------------------------
  describe('updateAllComponentScores', () => {
    test('updates scores for all components in analyzed videos', () => {
      const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
        masterHeaders,
        buildMasterRow({ video_uid: 'VID_001', status: 'analyzed', overall_score: 80,
          hook_scenario_id: 'SCN_H_0001', character_id: 'CHR_0001' }),
        buildMasterRow({ video_uid: 'VID_002', status: 'analyzed', overall_score: 90,
          hook_scenario_id: 'SCN_H_0001', character_id: 'CHR_0002' })
      ], CONFIG.SHEETS.MASTER);

      global.mockInventorySheets['scenarios'] = createMockSheet(buildInventoryData([
        { component_id: 'SCN_H_0001', type: 'hook', name: 'Hook 1', times_used: 0, avg_performance_score: 0, status: 'active' }
      ]), 'scenarios');
      global.mockInventorySheets['characters'] = createMockSheet(buildInventoryData([
        { component_id: 'CHR_0001', type: 'character', name: 'Char 1', times_used: 0, avg_performance_score: 0, status: 'active' },
        { component_id: 'CHR_0002', type: 'character', name: 'Char 2', times_used: 0, avg_performance_score: 0, status: 'active' }
      ]), 'characters');

      const count = updateAllComponentScores();
      expect(count).toBe(3); // SCN_H_0001, CHR_0001, CHR_0002
    });

    test('skips non-analyzed videos', () => {
      const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
        masterHeaders,
        buildMasterRow({ video_uid: 'VID_001', status: 'draft', overall_score: 80,
          hook_scenario_id: 'SCN_H_0001' })
      ], CONFIG.SHEETS.MASTER);

      global.mockInventorySheets['scenarios'] = createMockSheet(buildInventoryData([
        { component_id: 'SCN_H_0001', type: 'hook', name: 'Hook 1', status: 'active' }
      ]), 'scenarios');

      updateAllComponentScores();
      // Should log no analyzed videos
      expect(Logger.log).toHaveBeenCalledWith('No analyzed videos with scores found');
    });

    test('skips videos without scores', () => {
      const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
        masterHeaders,
        buildMasterRow({ video_uid: 'VID_001', status: 'analyzed', overall_score: '',
          hook_scenario_id: 'SCN_H_0001' })
      ], CONFIG.SHEETS.MASTER);

      updateAllComponentScores();
      expect(Logger.log).toHaveBeenCalledWith('No analyzed videos with scores found');
    });
  });

  // ----------------------------------------------------------
  // updateComponentScoresForVideo Tests
  // ----------------------------------------------------------
  describe('updateComponentScoresForVideo', () => {
    beforeEach(() => {
      const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
        masterHeaders,
        buildMasterRow({ video_uid: 'VID_001', status: 'analyzed',
          hook_scenario_id: 'SCN_H_0001', body_scenario_id: 'SCN_B_0001',
          character_id: 'CHR_0001' })
      ], CONFIG.SHEETS.MASTER);

      global.mockInventorySheets['scenarios'] = createMockSheet(buildInventoryData([
        { component_id: 'SCN_H_0001', type: 'hook', name: 'Hook', status: 'active' },
        { component_id: 'SCN_B_0001', type: 'body', name: 'Body', status: 'active' }
      ]), 'scenarios');
      global.mockInventorySheets['characters'] = createMockSheet(buildInventoryData([
        { component_id: 'CHR_0001', type: 'character', name: 'Char', status: 'active' }
      ]), 'characters');

      global.getComponentPerformanceHistory.mockReturnValue([]);
    });

    test('updates scores for all components in a video', () => {
      updateComponentScoresForVideo('VID_001', 85);
      // Should call updateSingleComponentScore for each unique component
      expect(updateRowByIndex).toHaveBeenCalled();
    });

    test('does nothing for zero score', () => {
      updateComponentScoresForVideo('VID_001', 0);
      expect(updateRowByIndex).not.toHaveBeenCalled();
    });

    test('does nothing for negative score', () => {
      updateComponentScoresForVideo('VID_001', -5);
      expect(updateRowByIndex).not.toHaveBeenCalled();
    });

    test('does nothing for non-existent video', () => {
      updateComponentScoresForVideo('VID_NONEXISTENT', 85);
      expect(updateRowByIndex).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // updateSingleComponentScore Tests
  // ----------------------------------------------------------
  describe('updateSingleComponentScore', () => {
    beforeEach(() => {
      global.mockInventorySheets['scenarios'] = createMockSheet(buildInventoryData([
        { component_id: 'SCN_H_0001', type: 'hook', name: 'Hook', times_used: 2, avg_performance_score: 70, status: 'active' }
      ]), 'scenarios');
    });

    test('updates score including new score', () => {
      global.getComponentPerformanceHistory.mockReturnValue([
        { overall_score: 80 },
        { overall_score: 70 }
      ]);

      updateSingleComponentScore('SCN_H_0001', 90);
      expect(updateRowByIndex).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.objectContaining({
          avg_performance_score: 80, // avg of 80,70,90
          times_used: 3
        })
      );
    });

    test('handles component with no history', () => {
      global.getComponentPerformanceHistory.mockReturnValue([]);

      updateSingleComponentScore('SCN_H_0001', 85);
      expect(updateRowByIndex).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.objectContaining({
          avg_performance_score: 85,
          times_used: 1
        })
      );
    });

    test('does nothing for unknown component type', () => {
      global.getComponentPerformanceHistory.mockReturnValue([]);
      updateSingleComponentScore('XXX_0001', 80);
      expect(updateRowByIndex).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // getScoreSummary Tests
  // ----------------------------------------------------------
  describe('getScoreSummary', () => {
    test('returns summary for all inventory types', () => {
      global.listComponents.mockImplementation((type, filters) => {
        if (type === 'scenarios') return [
          { component_id: 'SCN_H_0001', name: 'Hook 1', avg_performance_score: 80, status: 'active' },
          { component_id: 'SCN_B_0001', name: 'Body 1', avg_performance_score: 70, status: 'active' },
          { component_id: 'SCN_C_0001', name: 'CTA 1', avg_performance_score: 0, status: 'active' }
        ];
        if (type === 'motions') return [
          { component_id: 'MOT_0001', name: 'Motion 1', avg_performance_score: 85, status: 'active' }
        ];
        if (type === 'characters') return [];
        if (type === 'audio') return [
          { component_id: 'AUD_0001', name: 'Audio 1', avg_performance_score: 90, status: 'active' }
        ];
        return [];
      });

      const summary = getScoreSummary();

      expect(summary.scenarios.total).toBe(3);
      expect(summary.scenarios.scored).toBe(2); // Only non-zero scores
      expect(summary.scenarios.avg_score).toBe(75); // (80+70)/2
      expect(summary.scenarios.top).toHaveLength(2);
      expect(summary.scenarios.top[0].score).toBe(80);

      expect(summary.motions.total).toBe(1);
      expect(summary.motions.scored).toBe(1);

      expect(summary.characters.total).toBe(0);
      expect(summary.characters.scored).toBe(0);
      expect(summary.characters.avg_score).toBe(0);

      expect(summary.audio.total).toBe(1);
      expect(summary.audio.top[0].score).toBe(90);
    });

    test('handles errors gracefully', () => {
      global.listComponents.mockImplementation(() => { throw new Error('Sheet error'); });

      const summary = getScoreSummary();

      expect(summary.scenarios).toEqual({ total: 0, scored: 0, avg_score: 0, top: [] });
      expect(summary.motions).toEqual({ total: 0, scored: 0, avg_score: 0, top: [] });
    });

    test('limits top to 3 items', () => {
      global.listComponents.mockReturnValue([
        { component_id: 'A', name: 'A', avg_performance_score: 90, status: 'active' },
        { component_id: 'B', name: 'B', avg_performance_score: 85, status: 'active' },
        { component_id: 'C', name: 'C', avg_performance_score: 80, status: 'active' },
        { component_id: 'D', name: 'D', avg_performance_score: 75, status: 'active' },
        { component_id: 'E', name: 'E', avg_performance_score: 70, status: 'active' }
      ]);

      const summary = getScoreSummary();
      expect(summary.scenarios.top).toHaveLength(3);
      expect(summary.scenarios.top[0].score).toBe(90);
      expect(summary.scenarios.top[2].score).toBe(80);
    });
  });
});
