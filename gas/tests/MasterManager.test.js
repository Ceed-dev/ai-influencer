/**
 * MasterManager.test.js - Unit tests for MasterManager.gs (v2.0)
 *
 * Tests video production lifecycle, approval workflow, and master sheet operations.
 * Run with: npm test -- gas/tests/MasterManager.test.js
 */

// Re-implement functions for testing (GAS has no module exports)
function createProduction(data) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var videoUid = data.video_uid || generateVideoUid();

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) {
    if (h === 'video_uid') return videoUid;
    if (h === 'status') return 'draft';
    if (h === 'created_date') return nowJapan();
    if (h === 'human_approved') return false;
    return data[h] !== undefined ? data[h] : '';
  });

  sheet.appendRow(row);
  Logger.log('Created production: ' + videoUid);
  return { video_uid: videoUid, status: 'draft' };
}

function getVideosByStatus(status) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  return findAllRowsByColumn(sheet, 'status', status);
}

function getApprovedVideos() {
  return getVideosByStatus('approved');
}

function getProductionData(videoUid) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var video = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!video) return null;
  video.components = buildVideoComponentContext(videoUid);
  return video;
}

function updateVideoStatus(videoUid, newStatus) {
  if (CONFIG.VIDEO_STATUSES.indexOf(newStatus) === -1) {
    throw new Error('Invalid status: ' + newStatus + '. Valid: ' + CONFIG.VIDEO_STATUSES.join(', '));
  }
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!row) throw new Error('Video not found: ' + videoUid);
  updateRowByIndex(sheet, row._rowIndex, { status: newStatus });
  if (newStatus === 'in_production') {
    incrementComponentUsage(videoUid);
  }
  Logger.log('Updated ' + videoUid + ' status to ' + newStatus);
  return true;
}

function approveVideo(videoUid, notes) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!row) throw new Error('Video not found: ' + videoUid);
  var updates = { status: 'approved', human_approved: true };
  if (notes) updates.approval_notes = notes;
  updateRowByIndex(sheet, row._rowIndex, updates);
  Logger.log('Approved video: ' + videoUid);
  return true;
}

function updateMetricsSnapshot(videoUid, metrics) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!row) throw new Error('Video not found: ' + videoUid);

  var validMetricFields = [].concat(
    CONFIG.MASTER_COLUMNS.YT_METRICS,
    CONFIG.MASTER_COLUMNS.TT_METRICS,
    CONFIG.MASTER_COLUMNS.IG_METRICS
  );

  var updates = {};
  Object.keys(metrics).forEach(function(key) {
    if (validMetricFields.indexOf(key) !== -1) {
      updates[key] = metrics[key];
    }
  });

  if (Object.keys(updates).length > 0) {
    updateRowByIndex(sheet, row._rowIndex, updates);
    Logger.log('Updated metrics snapshot for ' + videoUid);
  }
}

function writeAIRecommendations(videoUid, recommendations) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!row) throw new Error('Video not found: ' + videoUid);

  var updates = {};
  var aiFields = CONFIG.MASTER_COLUMNS.AI_NEXT;
  var fieldMap = {
    hook_scenario: 'ai_next_hook_scenario', hook_motion: 'ai_next_hook_motion', hook_audio: 'ai_next_hook_audio',
    body_scenario: 'ai_next_body_scenario', body_motion: 'ai_next_body_motion', body_audio: 'ai_next_body_audio',
    cta_scenario: 'ai_next_cta_scenario', cta_motion: 'ai_next_cta_motion', cta_audio: 'ai_next_cta_audio',
    character: 'ai_next_character'
  };

  Object.keys(fieldMap).forEach(function(recKey) {
    var sheetCol = fieldMap[recKey];
    if (recommendations[recKey] && aiFields.indexOf(sheetCol) !== -1) {
      updates[sheetCol] = recommendations[recKey];
    }
  });

  if (Object.keys(updates).length > 0) {
    updateRowByIndex(sheet, row._rowIndex, updates);
  }
}

function updateAnalysisResults(videoUid, overallScore, topRecommendations) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!row) throw new Error('Video not found: ' + videoUid);
  updateRowByIndex(sheet, row._rowIndex, {
    overall_score: overallScore,
    analysis_date: nowJapan(),
    top_recommendations: topRecommendations,
    status: 'analyzed'
  });
}

function getAllVideoUids() {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var videoUidCol = headers.indexOf('video_uid');
  return data.slice(1).map(function(row) { return row[videoUidCol]; }).filter(Boolean);
}

function updateVideoMaster(videoUid, updates) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!row) return false;
  updateRowByIndex(sheet, row._rowIndex, updates);
  return true;
}

function getMasterData() {
  try {
    var sheet = getSheet(CONFIG.SHEETS.MASTER);
    return readSheetAsObjects(sheet);
  } catch (e) {
    Logger.log('Error getting master data: ' + e.message);
    return [];
  }
}

// Mock buildVideoComponentContext and incrementComponentUsage for tests
global.buildVideoComponentContext = jest.fn(() => ({
  hook: { scenario: null, motion: null, audio: null },
  body: { scenario: null, motion: null, audio: null },
  cta: { scenario: null, motion: null, audio: null },
  character: null
}));

global.incrementComponentUsage = jest.fn();

// Helper to build a master row from partial data
function buildMasterRow(data) {
  return CONFIG.MASTER_ALL_COLUMNS.map(function(col) {
    return data[col] !== undefined ? data[col] : '';
  });
}

// ============================================================
// Tests
// ============================================================

describe('MasterManager', () => {
  beforeEach(() => {
    resetMocks();

    const masterHeaders = CONFIG.MASTER_ALL_COLUMNS;
    global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
      masterHeaders,
      buildMasterRow({ video_uid: 'VID_202602_0001', title: 'Video One', status: 'draft', created_date: '2026-02-01', human_approved: false }),
      buildMasterRow({ video_uid: 'VID_202602_0002', title: 'Video Two', status: 'approved', created_date: '2026-02-02', human_approved: true }),
      buildMasterRow({ video_uid: 'VID_202602_0003', title: 'Video Three', status: 'published', created_date: '2026-02-03',
        yt_views: 10000, yt_engagement: 0.05, tt_views: 50000, overall_score: 75 })
    ], CONFIG.SHEETS.MASTER);
  });

  // ----------------------------------------------------------
  // createProduction Tests
  // ----------------------------------------------------------
  describe('createProduction', () => {
    test('creates a new video production with auto-generated UID', () => {
      const result = createProduction({ title: 'New Video' });
      expect(result.video_uid).toMatch(/^VID_\d{6}_\d{4}$/);
      expect(result.status).toBe('draft');
    });

    test('uses provided video_uid', () => {
      const result = createProduction({ video_uid: 'VID_CUSTOM_0001', title: 'Custom UID' });
      expect(result.video_uid).toBe('VID_CUSTOM_0001');
    });

    test('sets status to draft', () => {
      const result = createProduction({ title: 'Draft Video' });
      expect(result.status).toBe('draft');
    });

    test('sets human_approved to false', () => {
      createProduction({ title: 'Unapproved' });
      const sheet = global.mockSheets[CONFIG.SHEETS.MASTER];
      const data = sheet._getData();
      const lastRow = data[data.length - 1];
      const headers = data[0];
      const approvedIdx = headers.indexOf('human_approved');
      expect(lastRow[approvedIdx]).toBe(false);
    });

    test('includes component IDs when provided', () => {
      createProduction({
        title: 'Component Video',
        hook_scenario_id: 'SCN_H_0001',
        character_id: 'CHR_0001'
      });
      const sheet = global.mockSheets[CONFIG.SHEETS.MASTER];
      const data = sheet._getData();
      const lastRow = data[data.length - 1];
      const headers = data[0];
      expect(lastRow[headers.indexOf('hook_scenario_id')]).toBe('SCN_H_0001');
      expect(lastRow[headers.indexOf('character_id')]).toBe('CHR_0001');
    });

    test('appends to sheet', () => {
      const sheet = global.mockSheets[CONFIG.SHEETS.MASTER];
      const before = sheet._getData().length;
      createProduction({ title: 'Another' });
      const after = sheet._getData().length;
      expect(after).toBe(before + 1);
    });
  });

  // ----------------------------------------------------------
  // getVideosByStatus Tests
  // ----------------------------------------------------------
  describe('getVideosByStatus', () => {
    test('returns draft videos', () => {
      const result = getVideosByStatus('draft');
      expect(result).toHaveLength(1);
      expect(result[0].video_uid).toBe('VID_202602_0001');
    });

    test('returns approved videos', () => {
      const result = getVideosByStatus('approved');
      expect(result).toHaveLength(1);
      expect(result[0].video_uid).toBe('VID_202602_0002');
    });

    test('returns published videos', () => {
      const result = getVideosByStatus('published');
      expect(result).toHaveLength(1);
      expect(result[0].video_uid).toBe('VID_202602_0003');
    });

    test('returns empty for non-existent status', () => {
      const result = getVideosByStatus('analyzed');
      expect(result).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // getApprovedVideos Tests
  // ----------------------------------------------------------
  describe('getApprovedVideos', () => {
    test('returns only approved videos', () => {
      const result = getApprovedVideos();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('approved');
    });
  });

  // ----------------------------------------------------------
  // getProductionData Tests
  // ----------------------------------------------------------
  describe('getProductionData', () => {
    test('returns video data with component context', () => {
      const result = getProductionData('VID_202602_0001');
      expect(result).not.toBeNull();
      expect(result.video_uid).toBe('VID_202602_0001');
      expect(result.components).toBeDefined();
      expect(global.buildVideoComponentContext).toHaveBeenCalledWith('VID_202602_0001');
    });

    test('returns null for non-existent video', () => {
      const result = getProductionData('VID_NONEXISTENT');
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // updateVideoStatus Tests
  // ----------------------------------------------------------
  describe('updateVideoStatus', () => {
    test('updates to valid status', () => {
      const result = updateVideoStatus('VID_202602_0001', 'approved');
      expect(result).toBe(true);
    });

    test('throws for invalid status', () => {
      expect(() => updateVideoStatus('VID_202602_0001', 'invalid_status'))
        .toThrow('Invalid status');
    });

    test('throws for non-existent video', () => {
      expect(() => updateVideoStatus('VID_NONEXISTENT', 'approved'))
        .toThrow('Video not found');
    });

    test('increments component usage when moving to in_production', () => {
      updateVideoStatus('VID_202602_0001', 'in_production');
      expect(global.incrementComponentUsage).toHaveBeenCalledWith('VID_202602_0001');
    });

    test('does not increment usage for other status changes', () => {
      updateVideoStatus('VID_202602_0001', 'approved');
      expect(global.incrementComponentUsage).not.toHaveBeenCalled();
    });

    test('accepts all valid statuses', () => {
      CONFIG.VIDEO_STATUSES.forEach(function(status) {
        jest.clearAllMocks();
        expect(() => updateVideoStatus('VID_202602_0001', status)).not.toThrow();
      });
    });
  });

  // ----------------------------------------------------------
  // approveVideo Tests
  // ----------------------------------------------------------
  describe('approveVideo', () => {
    test('approves a video', () => {
      const result = approveVideo('VID_202602_0001');
      expect(result).toBe(true);
    });

    test('sets human_approved to true', () => {
      approveVideo('VID_202602_0001');
      expect(updateRowByIndex).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.objectContaining({ human_approved: true, status: 'approved' })
      );
    });

    test('includes approval notes when provided', () => {
      approveVideo('VID_202602_0001', 'Looks good!');
      expect(updateRowByIndex).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.objectContaining({ approval_notes: 'Looks good!' })
      );
    });

    test('throws for non-existent video', () => {
      expect(() => approveVideo('VID_NONEXISTENT')).toThrow('Video not found');
    });
  });

  // ----------------------------------------------------------
  // updateMetricsSnapshot Tests
  // ----------------------------------------------------------
  describe('updateMetricsSnapshot', () => {
    test('updates valid metric fields', () => {
      updateMetricsSnapshot('VID_202602_0001', {
        yt_views: 15000, yt_engagement: 0.06, yt_completion: 0.55
      });
      expect(updateRowByIndex).toHaveBeenCalled();
    });

    test('ignores invalid metric fields', () => {
      updateMetricsSnapshot('VID_202602_0001', {
        yt_views: 15000,
        invalid_field: 'should be ignored'
      });
      const calls = updateRowByIndex.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).not.toHaveProperty('invalid_field');
    });

    test('throws for non-existent video', () => {
      expect(() => updateMetricsSnapshot('VID_NONEXISTENT', { yt_views: 100 }))
        .toThrow('Video not found');
    });

    test('does nothing when no valid fields', () => {
      updateMetricsSnapshot('VID_202602_0001', { invalid1: 1, invalid2: 2 });
      expect(updateRowByIndex).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // writeAIRecommendations Tests
  // ----------------------------------------------------------
  describe('writeAIRecommendations', () => {
    test('writes component recommendations to AI_NEXT columns', () => {
      writeAIRecommendations('VID_202602_0001', {
        hook_scenario: 'SCN_H_0002',
        hook_motion: 'MOT_0003',
        character: 'CHR_0002'
      });
      expect(updateRowByIndex).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.objectContaining({
          ai_next_hook_scenario: 'SCN_H_0002',
          ai_next_hook_motion: 'MOT_0003',
          ai_next_character: 'CHR_0002'
        })
      );
    });

    test('throws for non-existent video', () => {
      expect(() => writeAIRecommendations('VID_NONEXISTENT', { hook_scenario: 'SCN_H_0001' }))
        .toThrow('Video not found');
    });

    test('ignores empty recommendations', () => {
      writeAIRecommendations('VID_202602_0001', {});
      expect(updateRowByIndex).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // updateAnalysisResults Tests
  // ----------------------------------------------------------
  describe('updateAnalysisResults', () => {
    test('updates score and status to analyzed', () => {
      updateAnalysisResults('VID_202602_0001', 85, 'Improve hooks');
      expect(updateRowByIndex).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Number),
        expect.objectContaining({
          overall_score: 85,
          top_recommendations: 'Improve hooks',
          status: 'analyzed'
        })
      );
    });

    test('throws for non-existent video', () => {
      expect(() => updateAnalysisResults('VID_NONEXISTENT', 80, 'Tips'))
        .toThrow('Video not found');
    });
  });

  // ----------------------------------------------------------
  // getAllVideoUids Tests
  // ----------------------------------------------------------
  describe('getAllVideoUids', () => {
    test('returns all UIDs', () => {
      const result = getAllVideoUids();
      expect(result).toEqual(['VID_202602_0001', 'VID_202602_0002', 'VID_202602_0003']);
    });

    test('returns empty for header-only sheet', () => {
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
        CONFIG.MASTER_ALL_COLUMNS
      ], CONFIG.SHEETS.MASTER);

      const result = getAllVideoUids();
      expect(result).toEqual([]);
    });

    test('filters out empty UIDs', () => {
      const headers = CONFIG.MASTER_ALL_COLUMNS;
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet([
        headers,
        buildMasterRow({ video_uid: 'VID_001' }),
        buildMasterRow({ video_uid: '' }),
        buildMasterRow({ video_uid: 'VID_003' })
      ], CONFIG.SHEETS.MASTER);

      const result = getAllVideoUids();
      expect(result).toEqual(['VID_001', 'VID_003']);
    });
  });

  // ----------------------------------------------------------
  // updateVideoMaster Tests
  // ----------------------------------------------------------
  describe('updateVideoMaster', () => {
    test('updates fields for existing video', () => {
      const result = updateVideoMaster('VID_202602_0001', { title: 'Updated Title' });
      expect(result).toBe(true);
    });

    test('returns false for non-existent video', () => {
      const result = updateVideoMaster('VID_NONEXISTENT', { title: 'Test' });
      expect(result).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // getMasterData Tests
  // ----------------------------------------------------------
  describe('getMasterData', () => {
    test('returns all rows as objects', () => {
      const result = getMasterData();
      expect(result).toHaveLength(3);
      expect(result[0].video_uid).toBe('VID_202602_0001');
    });

    test('returns empty array on error', () => {
      delete global.mockSheets[CONFIG.SHEETS.MASTER];
      const result = getMasterData();
      expect(result).toEqual([]);
    });
  });
});
