/**
 * MasterManager - Master sheet operations, approval workflow, status management
 */

/**
 * Create a new video production entry in master sheet
 * @param {Object} data - Video production data
 * @returns {Object} Created video with generated UID
 */
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

/**
 * Get all videos with a specific status
 * @param {string} status - Video status to filter
 * @returns {Array<Object>}
 */
function getVideosByStatus(status) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  return findAllRowsByColumn(sheet, 'status', status);
}

/**
 * Get approved videos ready for production
 * @returns {Array<Object>}
 */
function getApprovedVideos() {
  return getVideosByStatus('approved');
}

/**
 * Get video production data with full component details
 * @param {string} videoUid
 * @returns {Object|null}
 */
function getProductionData(videoUid) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var video = findRowByColumn(sheet, 'video_uid', videoUid);
  if (!video) return null;

  // Attach component details
  video.components = buildVideoComponentContext(videoUid);

  return video;
}

/**
 * Update video status
 * @param {string} videoUid
 * @param {string} newStatus - One of VIDEO_STATUSES
 * @returns {boolean}
 */
function updateVideoStatus(videoUid, newStatus) {
  if (CONFIG.VIDEO_STATUSES.indexOf(newStatus) === -1) {
    throw new Error('Invalid status: ' + newStatus + '. Valid: ' + CONFIG.VIDEO_STATUSES.join(', '));
  }

  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);

  if (!row) throw new Error('Video not found: ' + videoUid);

  updateRowByIndex(sheet, row._rowIndex, { status: newStatus });

  // Side effects based on status change
  if (newStatus === 'in_production') {
    incrementComponentUsage(videoUid);
  }

  Logger.log('Updated ' + videoUid + ' status to ' + newStatus);
  return true;
}

/**
 * Approve a video for production
 * @param {string} videoUid
 * @param {string} [notes] - Optional approval notes
 * @returns {boolean}
 */
function approveVideo(videoUid, notes) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);

  if (!row) throw new Error('Video not found: ' + videoUid);

  var updates = {
    status: 'approved',
    human_approved: true
  };

  if (notes) {
    updates.approval_notes = notes;
  }

  updateRowByIndex(sheet, row._rowIndex, updates);
  Logger.log('Approved video: ' + videoUid);
  return true;
}

/**
 * Update metrics snapshot on master sheet
 * @param {string} videoUid
 * @param {Object} metrics - { yt_views, yt_engagement, yt_completion, tt_*, ig_* }
 */
function updateMetricsSnapshot(videoUid, metrics) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);

  if (!row) throw new Error('Video not found: ' + videoUid);

  // Only update provided metric fields
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

/**
 * Write AI recommended components to master sheet
 * @param {string} videoUid - Target video (or new video to create)
 * @param {Object} recommendations - AI recommended component IDs
 */
function writeAIRecommendations(videoUid, recommendations) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);

  if (!row) throw new Error('Video not found: ' + videoUid);

  var updates = {};
  var aiFields = CONFIG.MASTER_COLUMNS.AI_NEXT;

  // Map recommendation fields to AI_NEXT columns
  var fieldMap = {
    hook_scenario: 'ai_next_hook_scenario',
    hook_motion: 'ai_next_hook_motion',
    hook_audio: 'ai_next_hook_audio',
    body_scenario: 'ai_next_body_scenario',
    body_motion: 'ai_next_body_motion',
    body_audio: 'ai_next_body_audio',
    cta_scenario: 'ai_next_cta_scenario',
    cta_motion: 'ai_next_cta_motion',
    cta_audio: 'ai_next_cta_audio',
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
    Logger.log('Wrote AI recommendations for ' + videoUid);
  }
}

/**
 * Update analysis results on master sheet
 * @param {string} videoUid
 * @param {number} overallScore - 0-100
 * @param {string} topRecommendations - Top 3 recommendations text
 */
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

  Logger.log('Updated analysis for ' + videoUid + ': score=' + overallScore);
}

/**
 * Get all video UIDs from master sheet
 * @returns {Array<string>}
 */
function getAllVideoUids() {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  var headers = data[0];
  var videoUidCol = headers.indexOf('video_uid');

  return data.slice(1).map(function(row) { return row[videoUidCol]; }).filter(Boolean);
}

/**
 * Update video master fields
 * @param {string} videoUid
 * @param {Object} updates - Key-value pairs
 * @returns {boolean}
 */
function updateVideoMaster(videoUid, updates) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);

  if (!row) return false;

  updateRowByIndex(sheet, row._rowIndex, updates);
  return true;
}

/**
 * Get master data for linking (backward compatibility)
 * @returns {Array<Object>}
 */
function getMasterData() {
  try {
    var sheet = getSheet(CONFIG.SHEETS.MASTER);
    return readSheetAsObjects(sheet);
  } catch (e) {
    Logger.log('Error getting master data: ' + e.message);
    return [];
  }
}
