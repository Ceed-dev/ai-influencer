/**
 * Video Analytics Hub v2.0 - Main Entry Points
 *
 * Web App endpoints for n8n integration + UI menu
 */

/**
 * Handle GET requests (health check + read-only queries)
 */
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action;

  try {
    var result;

    switch (action) {
      case 'get_status':
        result = handleGetStatus({});
        break;

      case 'get_approved':
        result = handleGetApproved();
        break;

      case 'get_production':
        result = handleGetProduction(params);
        break;

      case 'get_components':
        result = handleGetComponents(params);
        break;

      case 'get_score_summary':
        result = getScoreSummary();
        break;

      default:
        result = {
          status: 'ok',
          version: CONFIG.VERSION,
          timestamp: new Date().toISOString(),
          endpoints: [
            'GET: get_status, get_approved, get_production, get_components, get_score_summary',
            'POST: import_csv, analyze, analyze_single, analyze_all, link_videos, create_production, approve_video, update_status, add_component, update_scores'
          ]
        };
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in doGet: ' + error.message);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests (main processing endpoint)
 *
 * Expected payload:
 * {
 *   "action": "import_csv" | "analyze" | "analyze_single" | "analyze_all" |
 *             "link_videos" | "create_production" | "approve_video" |
 *             "update_status" | "add_component" | "update_scores",
 *   ...action-specific fields
 * }
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    var result;

    switch (action) {
      case 'import_csv':
        result = handleImportCSV(payload);
        break;

      case 'analyze':
        result = handleAnalyze(payload);
        break;

      case 'link_videos':
        result = handleLinkVideos(payload);
        break;

      case 'get_status':
        result = handleGetStatus(payload);
        break;

      case 'analyze_single':
        result = handleAnalyzeSingle(payload);
        break;

      case 'analyze_all':
        result = handleAnalyzeAll(payload);
        break;

      // v2.0 Production workflow
      case 'create_production':
        result = handleCreateProduction(payload);
        break;

      case 'approve_video':
        result = handleApproveVideo(payload);
        break;

      case 'update_status':
        result = handleUpdateStatus(payload);
        break;

      // v2.0 Component management
      case 'add_component':
        result = handleAddComponent(payload);
        break;

      case 'update_component':
        result = handleUpdateComponent(payload);
        break;

      case 'get_components':
        result = handleGetComponents(payload);
        break;

      // v2.0 Score management
      case 'update_scores':
        result = handleUpdateScores(payload);
        break;

      default:
        throw new Error('Unknown action: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in doPost: ' + error.message);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// Existing Action Handlers (updated for v2.0)
// ============================================================

/**
 * Handle CSV import action
 */
function handleImportCSV(payload) {
  var platform = payload.platform;
  var csv_data = payload.csv_data;

  if (!platform || !csv_data) {
    throw new Error('Missing required fields: platform, csv_data');
  }

  // Decode base64 CSV
  var csvContent = Utilities.newBlob(Utilities.base64Decode(csv_data)).getDataAsString('UTF-8');

  // Parse CSV
  var parsed = parseCSV(csvContent, platform);

  // Normalize to unified schema
  var normalized = normalizeMetrics(parsed, platform);

  // Attempt to link with video_uid
  var linkResult = linkVideos(normalized, platform);

  // Write to sheets
  writeMetrics(linkResult.linked, platform);
  writeUnlinked(linkResult.unlinked, platform);

  return {
    platform: platform,
    total_rows: parsed.length,
    linked: linkResult.linked.length,
    unlinked: linkResult.unlinked.length
  };
}

/**
 * Handle analysis action
 */
function handleAnalyze(payload) {
  var video_uids = payload.video_uids;

  if (!video_uids || !Array.isArray(video_uids)) {
    throw new Error('Missing or invalid video_uids array');
  }

  var metricsBundle = getMetricsBundle(video_uids);
  var kpiTargets = getKPITargets();
  var kpiResults = compareKPIs(metricsBundle, kpiTargets);

  // Use enhanced analysis with component context
  var analysis = analyzWithLLMEnhanced(metricsBundle, kpiResults);

  writeAnalysisReport(analysis);
  writeRecommendations(analysis.recommendations);

  // Update scores for analyzed videos
  video_uids.forEach(function(uid) {
    try {
      var kpiResult = kpiResults.find(function(r) { return r.video_uid === uid; });
      if (kpiResult) {
        var score = normalizeOverallScore(kpiResult);
        updateAnalysisResults(uid, score, analysis.recommendations.slice(0, 3).map(function(r) { return r.recommendation; }).join('; '));
        updateComponentScoresForVideo(uid, score);
      }
    } catch (e) {
      Logger.log('Error updating scores for ' + uid + ': ' + e.message);
    }
  });

  return {
    analyzed_count: video_uids.length,
    report_id: analysis.report_id
  };
}

/**
 * Handle manual video linking action
 */
function handleLinkVideos(payload) {
  var links = payload.links;

  if (!links || !Array.isArray(links)) {
    throw new Error('Missing or invalid links array');
  }

  var results = links.map(function(link) {
    try {
      createVideoLink(link.video_uid, link.platform_id, link.platform);
      return { video_uid: link.video_uid, platform_id: link.platform_id, platform: link.platform, status: 'success' };
    } catch (error) {
      return { video_uid: link.video_uid, platform_id: link.platform_id, platform: link.platform, status: 'error', error: error.message };
    }
  });

  return {
    processed: results.length,
    successful: results.filter(function(r) { return r.status === 'success'; }).length,
    failed: results.filter(function(r) { return r.status === 'error'; }).length,
    details: results
  };
}

/**
 * Handle status check action
 */
function handleGetStatus(payload) {
  var ss = getSpreadsheet();

  var counts = {};
  Object.keys(CONFIG.SHEETS).forEach(function(key) {
    var sheetName = CONFIG.SHEETS[key];
    try {
      var sheet = ss.getSheetByName(sheetName);
      counts[key] = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
    } catch (e) {
      counts[key] = 0;
    }
  });

  // Video status breakdown
  var statusBreakdown = {};
  try {
    CONFIG.VIDEO_STATUSES.forEach(function(status) {
      var videos = getVideosByStatus(status);
      statusBreakdown[status] = videos.length;
    });
  } catch (e) {
    Logger.log('Error getting status breakdown: ' + e.message);
  }

  return {
    version: CONFIG.VERSION,
    record_counts: counts,
    video_statuses: statusBreakdown,
    last_updated: nowJapan()
  };
}

/**
 * Handle single video analysis action (API)
 */
function handleAnalyzeSingle(payload) {
  var video_uid = payload.video_uid;

  if (!video_uid) {
    throw new Error('Missing video_uid');
  }

  var analysis = analyzeVideoSingle(video_uid);
  writeVideoAnalysis(analysis);

  // Update master with score
  if (analysis.kpi_achievement) {
    try {
      var score = parseInt(analysis.kpi_achievement, 10) || 0;
      updateAnalysisResults(video_uid, score, analysis.recommendations || '');
      updateComponentScoresForVideo(video_uid, score);
    } catch (e) {
      Logger.log('Error updating analysis results: ' + e.message);
    }
  }

  return {
    video_uid: video_uid,
    kpi_achievement: analysis.kpi_achievement,
    youtube_performance: truncate(analysis.youtube_performance, 100),
    tiktok_performance: truncate(analysis.tiktok_performance, 100),
    instagram_performance: truncate(analysis.instagram_performance, 100),
    analyzed_at: analysis.analyzed_at
  };
}

/**
 * Handle analyze all videos action (API)
 */
function handleAnalyzeAll(payload) {
  var videoUids = getAllVideoUids();

  if (videoUids.length === 0) {
    throw new Error('No videos found in master sheet');
  }

  var metricsBundle = getMetricsBundle(videoUids);
  var kpiTargets = getKPITargets();
  var kpiResults = compareKPIs(metricsBundle, kpiTargets);

  // Use enhanced analysis with component context
  var analysis = analyzWithLLMEnhanced(metricsBundle, kpiResults);

  writeAnalysisReport(analysis);
  writeRecommendations(analysis.recommendations);

  // Update scores for all analyzed videos
  kpiResults.forEach(function(kpiResult) {
    try {
      var score = normalizeOverallScore(kpiResult);
      var topRecs = analysis.recommendations.slice(0, 3).map(function(r) { return r.recommendation; }).join('; ');
      updateAnalysisResults(kpiResult.video_uid, score, topRecs);
      updateComponentScoresForVideo(kpiResult.video_uid, score);
    } catch (e) {
      Logger.log('Error updating scores for ' + kpiResult.video_uid + ': ' + e.message);
    }
  });

  return {
    analyzed_count: videoUids.length,
    report_id: analysis.report_id,
    generated_at: analysis.generated_at
  };
}

// ============================================================
// v2.0 Production Workflow Handlers
// ============================================================

/**
 * Handle create production action
 * Payload: { action: 'create_production', title, hook_scenario_id, hook_motion_id, ... }
 */
function handleCreateProduction(payload) {
  var data = {};
  // Copy all fields except 'action'
  Object.keys(payload).forEach(function(key) {
    if (key !== 'action') data[key] = payload[key];
  });

  return createProduction(data);
}

/**
 * Handle get approved videos
 */
function handleGetApproved() {
  var approved = getApprovedVideos();
  return {
    count: approved.length,
    videos: approved.map(function(v) {
      return {
        video_uid: v.video_uid,
        title: v.title,
        status: v.status,
        human_approved: v.human_approved
      };
    })
  };
}

/**
 * Handle get production data
 * Params/Payload: { video_uid }
 */
function handleGetProduction(params) {
  var videoUid = params.video_uid;
  if (!videoUid) throw new Error('Missing video_uid');

  var data = getProductionData(videoUid);
  if (!data) throw new Error('Video not found: ' + videoUid);

  return data;
}

/**
 * Handle approve video action
 * Payload: { action: 'approve_video', video_uid, notes? }
 */
function handleApproveVideo(payload) {
  var videoUid = payload.video_uid;
  var notes = payload.notes;

  if (!videoUid) throw new Error('Missing video_uid');

  approveVideo(videoUid, notes);
  return { video_uid: videoUid, status: 'approved' };
}

/**
 * Handle update status action
 * Payload: { action: 'update_status', video_uid, status }
 */
function handleUpdateStatus(payload) {
  var videoUid = payload.video_uid;
  var newStatus = payload.status;

  if (!videoUid) throw new Error('Missing video_uid');
  if (!newStatus) throw new Error('Missing status');

  updateVideoStatus(videoUid, newStatus);
  return { video_uid: videoUid, status: newStatus };
}

// ============================================================
// v2.0 Component Management Handlers
// ============================================================

/**
 * Handle add component action
 * Payload: { action: 'add_component', inventory_type, type, name, description, ... }
 */
function handleAddComponent(payload) {
  var inventoryType = payload.inventory_type;
  if (!inventoryType) throw new Error('Missing inventory_type');

  var data = {};
  Object.keys(payload).forEach(function(key) {
    if (key !== 'action' && key !== 'inventory_type') {
      data[key] = payload[key];
    }
  });

  return addComponent(inventoryType, data);
}

/**
 * Handle update component action
 * Payload: { action: 'update_component', component_id, ...updates }
 */
function handleUpdateComponent(payload) {
  var componentId = payload.component_id;
  if (!componentId) throw new Error('Missing component_id');

  var updates = {};
  Object.keys(payload).forEach(function(key) {
    if (key !== 'action' && key !== 'component_id') {
      updates[key] = payload[key];
    }
  });

  updateComponent(componentId, updates);
  return { component_id: componentId, updated: true };
}

/**
 * Handle get components action
 * Params/Payload: { inventory_type, type?, status? }
 */
function handleGetComponents(params) {
  var inventoryType = params.inventory_type;
  if (!inventoryType) throw new Error('Missing inventory_type');

  var filters = {};
  if (params.type) filters.type = params.type;
  if (params.status) filters.status = params.status;
  if (params.tags) filters.tags = params.tags;

  var components = listComponents(inventoryType, Object.keys(filters).length > 0 ? filters : null);
  return {
    inventory_type: inventoryType,
    count: components.length,
    components: components
  };
}

// ============================================================
// v2.0 Score Management Handlers
// ============================================================

/**
 * Handle update scores action
 * Payload: { action: 'update_scores', video_uid? }
 * If video_uid is provided, update scores for that video only
 * Otherwise, recalculate all component scores
 */
function handleUpdateScores(payload) {
  if (payload.video_uid) {
    var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
    var video = findRowByColumn(masterSheet, 'video_uid', payload.video_uid);
    if (!video) throw new Error('Video not found: ' + payload.video_uid);

    var score = video.overall_score;
    if (score) {
      updateComponentScoresForVideo(payload.video_uid, score);
    }
    return { video_uid: payload.video_uid, score: score };
  }

  var updatedCount = updateAllComponentScores();
  return { updated_components: updatedCount };
}

// ============================================================
// UI Menu
// ============================================================

/**
 * Add custom menu to Sheets UI
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Video Analytics v2')
    .addItem('Initial Setup (v2.0)', 'setupCompleteSystem')
    .addItem('Upgrade from v1.0', 'migrateV1toV2')
    .addSeparator()
    .addSubMenu(ui.createMenu('Import CSV')
      .addItem('YouTube CSV', 'importYouTubeCSV')
      .addItem('TikTok CSV', 'importTikTokCSV')
      .addItem('Instagram CSV', 'importInstagramCSV'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Analyze')
      .addItem('Single Video...', 'analyzeSingleVideoPrompt')
      .addItem('All Videos (Enhanced)', 'analyzeAllVideosEnhanced'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Production')
      .addItem('Create New Video...', 'createProductionPrompt')
      .addItem('View Approved Videos', 'showApprovedVideos')
      .addItem('Approve Video...', 'approveVideoPrompt')
      .addItem('Update Video Status...', 'updateStatusPrompt'))
    .addSubMenu(ui.createMenu('Pipeline')
      .addItem('Queue All Ready Videos...', 'queueReadyVideosPrompt')
      .addItem('Queue All Ready (Dry Run)...', 'queueReadyVideosDryRunPrompt')
      .addItem('Queue Selected Videos', 'queueSelectedVideos')
      .addSeparator()
      .addItem('Pipeline Status', 'showPipelineStatus')
      .addItem('Stop Pipeline', 'stopPipeline'))
    .addSubMenu(ui.createMenu('Components')
      .addItem('Add Component...', 'addComponentPrompt')
      .addItem('Browse Scenarios', 'browseScenarios')
      .addItem('Browse Motions', 'browseMotions')
      .addItem('Browse Characters', 'browseCharacters')
      .addItem('Browse Audio', 'browseAudio')
      .addItem('Update All Scores', 'updateScoresUI')
      .addItem('Score Summary', 'showScoreSummary'))
    .addSeparator()
    .addItem('Status Dashboard', 'showStatus')
    .addItem('Insert Demo Data', 'insertDemoData')
    .addItem('Clear All Data', 'clearAllDemoData')
    .addToUi();
}

// ============================================================
// UI Functions - Analysis
// ============================================================

/**
 * Prompt user to select a video for single analysis
 */
function analyzeSingleVideoPrompt() {
  var ui = SpreadsheetApp.getUi();

  var videoUids = getAllVideoUids();
  if (videoUids.length === 0) {
    ui.alert('Error', 'master sheet has no videos registered.', ui.ButtonSet.OK);
    return;
  }

  var result = ui.prompt(
    'Select Video',
    'Enter video UID to analyze:\n\n' +
    'Registered videos:\n' + videoUids.join('\n'),
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  var videoUid = result.getResponseText().trim();
  if (videoUids.indexOf(videoUid) === -1) {
    ui.alert('Error', 'Video not found: ' + videoUid, ui.ButtonSet.OK);
    return;
  }

  try {
    ui.alert('Analyzing', 'Starting analysis. Please wait...', ui.ButtonSet.OK);

    var analysis = analyzeVideoSingle(videoUid);
    writeVideoAnalysis(analysis);

    // Update master scores
    if (analysis.kpi_achievement) {
      var score = parseInt(analysis.kpi_achievement, 10) || 0;
      updateAnalysisResults(videoUid, score, analysis.recommendations || '');
      updateComponentScoresForVideo(videoUid, score);
    }

    ui.alert(
      'Analysis Complete',
      'Video: ' + videoUid + '\n\n' +
      'KPI: ' + analysis.kpi_achievement + '\n\n' +
      'YouTube: ' + truncate(analysis.youtube_performance, 50) + '\n' +
      'TikTok: ' + truncate(analysis.tiktok_performance, 50) + '\n' +
      'Instagram: ' + truncate(analysis.instagram_performance, 50) + '\n\n' +
      'See video_analysis sheet for details.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Analyze all videos with enhanced component context
 */
function analyzeAllVideosEnhanced() {
  var ui = SpreadsheetApp.getUi();

  try {
    var videoUids = getAllVideoUids();

    if (videoUids.length === 0) {
      ui.alert('Error', 'master sheet has no videos registered.', ui.ButtonSet.OK);
      return;
    }

    var metricsBundle = getMetricsBundle(videoUids);
    var kpiTargets = getKPITargets();
    var kpiResults = compareKPIs(metricsBundle, kpiTargets);

    var analysis = analyzWithLLMEnhanced(metricsBundle, kpiResults);

    writeAnalysisReport(analysis);
    writeRecommendations(analysis.recommendations);

    // Update scores
    kpiResults.forEach(function(kpiResult) {
      try {
        var score = normalizeOverallScore(kpiResult);
        var topRecs = analysis.recommendations.slice(0, 3).map(function(r) { return r.recommendation; }).join('; ');
        updateAnalysisResults(kpiResult.video_uid, score, topRecs);
        updateComponentScoresForVideo(kpiResult.video_uid, score);
      } catch (e) {
        Logger.log('Score update error: ' + e.message);
      }
    });

    ui.alert(
      'Analysis Complete',
      'Analyzed: ' + videoUids.length + ' videos\n' +
      'Report: ' + analysis.report_id + '\n\n' +
      'Check recommendations sheet for improvement suggestions.\n' +
      'Component scores have been updated.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

// ============================================================
// UI Functions - CSV Import
// ============================================================

function importYouTubeCSV() { importCSVFromPicker('youtube'); }
function importTikTokCSV() { importCSVFromPicker('tiktok'); }
function importInstagramCSV() { importCSVFromPicker('instagram'); }

function importCSVFromPicker(platform) {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt(
    'Import ' + platform.toUpperCase() + ' CSV',
    'Paste CSV content here (or paste a Google Drive file URL):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    var input = result.getResponseText();

    try {
      var csvContent = input;

      if (input.indexOf('drive.google.com') !== -1 || input.indexOf('docs.google.com') !== -1) {
        var fileId = extractFileId(input);
        var file = DriveApp.getFileById(fileId);
        csvContent = file.getBlob().getDataAsString('UTF-8');
      }

      var parsed = parseCSV(csvContent, platform);
      var normalized = normalizeMetrics(parsed, platform);
      var linkResult = linkVideos(normalized, platform);

      writeMetrics(linkResult.linked, platform);
      writeUnlinked(linkResult.unlinked, platform);

      ui.alert(
        'Import Complete',
        'Platform: ' + platform + '\n' +
        'Total rows: ' + parsed.length + '\n' +
        'Linked: ' + linkResult.linked.length + '\n' +
        'Unlinked: ' + linkResult.unlinked.length,
        ui.ButtonSet.OK
      );
    } catch (e) {
      ui.alert('Import Error', e.message, ui.ButtonSet.OK);
    }
  }
}

function extractFileId(url) {
  var patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = url.match(patterns[i]);
    if (match) return match[1];
  }

  throw new Error('Could not extract file ID from URL');
}

// ============================================================
// UI Functions - Production Workflow
// ============================================================

/**
 * Prompt user to create a new video production
 */
function createProductionPrompt() {
  var ui = SpreadsheetApp.getUi();

  var result = ui.prompt(
    'Create New Video',
    'Enter video title:',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  var title = result.getResponseText().trim();
  if (!title) {
    ui.alert('Error', 'Title is required.', ui.ButtonSet.OK);
    return;
  }

  try {
    var production = createProduction({ title: title });
    ui.alert(
      'Video Created',
      'Video UID: ' + production.video_uid + '\n' +
      'Status: ' + production.status + '\n\n' +
      'Now assign components in the master sheet,\n' +
      'then approve when ready for production.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Show approved videos ready for production
 */
function showApprovedVideos() {
  var ui = SpreadsheetApp.getUi();

  try {
    var approved = getApprovedVideos();

    if (approved.length === 0) {
      ui.alert('No Approved Videos', 'No videos are approved for production.', ui.ButtonSet.OK);
      return;
    }

    var lines = approved.map(function(v) {
      return v.video_uid + ' - ' + (v.title || 'untitled');
    });

    ui.alert(
      'Approved Videos (' + approved.length + ')',
      lines.join('\n'),
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Prompt user to approve a video
 */
function approveVideoPrompt() {
  var ui = SpreadsheetApp.getUi();

  try {
    var drafts = getVideosByStatus('draft');
    if (drafts.length === 0) {
      ui.alert('No Draft Videos', 'No draft videos to approve.', ui.ButtonSet.OK);
      return;
    }

    var lines = drafts.map(function(v) {
      return v.video_uid + ' - ' + (v.title || 'untitled');
    });

    var result = ui.prompt(
      'Approve Video',
      'Draft videos:\n' + lines.join('\n') + '\n\nEnter video UID to approve:',
      ui.ButtonSet.OK_CANCEL
    );

    if (result.getSelectedButton() !== ui.Button.OK) return;

    var videoUid = result.getResponseText().trim();

    var notesResult = ui.prompt(
      'Approval Notes',
      'Optional notes (leave blank to skip):',
      ui.ButtonSet.OK_CANCEL
    );

    var notes = '';
    if (notesResult.getSelectedButton() === ui.Button.OK) {
      notes = notesResult.getResponseText().trim();
    }

    approveVideo(videoUid, notes || undefined);
    ui.alert('Approved', 'Video ' + videoUid + ' has been approved for production.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Prompt user to update a video status
 */
function updateStatusPrompt() {
  var ui = SpreadsheetApp.getUi();

  var uidResult = ui.prompt(
    'Update Video Status',
    'Enter video UID:',
    ui.ButtonSet.OK_CANCEL
  );

  if (uidResult.getSelectedButton() !== ui.Button.OK) return;

  var videoUid = uidResult.getResponseText().trim();

  var statusResult = ui.prompt(
    'New Status',
    'Available statuses: ' + CONFIG.VIDEO_STATUSES.join(', ') + '\n\nEnter new status:',
    ui.ButtonSet.OK_CANCEL
  );

  if (statusResult.getSelectedButton() !== ui.Button.OK) return;

  var newStatus = statusResult.getResponseText().trim();

  try {
    updateVideoStatus(videoUid, newStatus);
    ui.alert('Updated', 'Video ' + videoUid + ' status changed to: ' + newStatus, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

// ============================================================
// UI Functions - Component Management
// ============================================================

/**
 * Prompt user to add a new component
 */
function addComponentPrompt() {
  var ui = SpreadsheetApp.getUi();

  var typeResult = ui.prompt(
    'Add Component',
    'Inventory type (scenarios, motions, characters, audio):',
    ui.ButtonSet.OK_CANCEL
  );

  if (typeResult.getSelectedButton() !== ui.Button.OK) return;

  var inventoryType = typeResult.getResponseText().trim().toLowerCase();
  var validTypes = ['scenarios', 'motions', 'characters', 'audio'];
  if (validTypes.indexOf(inventoryType) === -1) {
    ui.alert('Error', 'Invalid type. Use: ' + validTypes.join(', '), ui.ButtonSet.OK);
    return;
  }

  var nameResult = ui.prompt('Component Name', 'Enter name:', ui.ButtonSet.OK_CANCEL);
  if (nameResult.getSelectedButton() !== ui.Button.OK) return;

  var subTypeResult = ui.prompt(
    'Component Sub-type',
    inventoryType === 'audio' ? 'Type (voice, bgm):' :
    inventoryType === 'characters' ? 'Type (character):' :
    'Type (hook, body, cta):',
    ui.ButtonSet.OK_CANCEL
  );
  if (subTypeResult.getSelectedButton() !== ui.Button.OK) return;

  try {
    var result = addComponent(inventoryType, {
      name: nameResult.getResponseText().trim(),
      type: subTypeResult.getResponseText().trim().toLowerCase()
    });

    ui.alert(
      'Component Added',
      'ID: ' + result.component_id + '\n' +
      'Type: ' + result.inventory_type + '\n\n' +
      'Edit additional fields in the inventory spreadsheet.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Browse components by inventory type
 */
function browseScenarios() { browseComponentType('scenarios'); }
function browseMotions() { browseComponentType('motions'); }
function browseCharacters() { browseComponentType('characters'); }
function browseAudio() { browseComponentType('audio'); }

function browseComponentType(inventoryType) {
  var ui = SpreadsheetApp.getUi();

  try {
    var components = listComponents(inventoryType, { status: 'active' });

    if (components.length === 0) {
      ui.alert('No Components', 'No active ' + inventoryType + ' found.', ui.ButtonSet.OK);
      return;
    }

    var lines = components.map(function(c) {
      var score = c.avg_performance_score ? ' (score: ' + c.avg_performance_score + ')' : '';
      return c.component_id + ' [' + (c.type || '-') + '] ' + (c.name || 'unnamed') + score;
    });

    // GAS alert has character limits, show first 20
    var displayLines = lines.slice(0, 20);
    var suffix = lines.length > 20 ? '\n\n... and ' + (lines.length - 20) + ' more' : '';

    ui.alert(
      inventoryType.charAt(0).toUpperCase() + inventoryType.slice(1) + ' (' + components.length + ')',
      displayLines.join('\n') + suffix,
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Update all component scores from UI
 */
function updateScoresUI() {
  var ui = SpreadsheetApp.getUi();

  try {
    var count = updateAllComponentScores();
    ui.alert('Scores Updated', 'Updated scores for ' + count + ' components.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Show component score summary
 */
function showScoreSummary() {
  var ui = SpreadsheetApp.getUi();

  try {
    var summary = getScoreSummary();

    var lines = [];
    Object.keys(summary).forEach(function(type) {
      var s = summary[type];
      lines.push('[' + type.toUpperCase() + ']');
      lines.push('  Total: ' + s.total + ', Scored: ' + s.scored + ', Avg: ' + s.avg_score);

      if (s.top && s.top.length > 0) {
        lines.push('  Top performers:');
        s.top.forEach(function(t) {
          lines.push('    ' + t.id + ' ' + t.name + ' (score: ' + t.score + ')');
        });
      }
      lines.push('');
    });

    ui.alert('Score Summary', lines.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

// ============================================================
// UI Functions - Status & Data
// ============================================================

/**
 * Show current status dashboard
 */
function showStatus() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetNames = Object.keys(CONFIG.SHEETS).map(function(key) { return CONFIG.SHEETS[key]; });

  var lines = ['Video Analytics Hub v' + CONFIG.VERSION, '', 'Sheet Records:'];

  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    var count = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
    lines.push('  ' + name + ': ' + count);
  });

  // Video status breakdown
  lines.push('');
  lines.push('Video Statuses:');
  try {
    CONFIG.VIDEO_STATUSES.forEach(function(status) {
      var videos = getVideosByStatus(status);
      lines.push('  ' + status + ': ' + videos.length);
    });
  } catch (e) {
    lines.push('  (unable to load)');
  }

  var props = PropertiesService.getScriptProperties();
  lines.push('');
  lines.push('OpenAI API Key: ' + (props.getProperty('OPENAI_API_KEY') ? 'Set' : 'Not set'));

  // Check inventory connections
  lines.push('');
  lines.push('Inventories:');
  ['scenarios', 'motions', 'characters', 'audio'].forEach(function(type) {
    var propKey = CONFIG.PROP_KEYS[type.toUpperCase() + '_INVENTORY_ID'];
    var id = props.getProperty(propKey);
    lines.push('  ' + type + ': ' + (id ? 'Connected' : 'Not set'));
  });

  ui.alert('Status Dashboard', lines.join('\n'), ui.ButtonSet.OK);
}

/**
 * Clear all demo data
 */
function clearAllDemoData() {
  var ui = SpreadsheetApp.getUi();

  var result = ui.alert('Confirm', 'Delete all data? (headers will be kept)', ui.ButtonSet.YES_NO);
  if (result !== ui.Button.YES) return;

  clearAllData();
  ui.alert('Done', 'All data has been cleared.', ui.ButtonSet.OK);
}

// ============================================================
// Legacy / Compatibility
// ============================================================

/**
 * One-time setup function (v1.0 compatibility, redirects to v2.0)
 */
function setupVideoAnalyticsHub() {
  setupCompleteSystem();
}

/**
 * Analyze all videos (v1.0 compatibility)
 */
function analyzeAllVideos() {
  analyzeAllVideosEnhanced();
}

/**
 * Manual trigger for testing
 */
function testImport() {
  Logger.log('Test import function called');
  Logger.log('Configuration check:');
  Logger.log('Version: ' + CONFIG.VERSION);
  Logger.log('SPREADSHEET_ID set: ' + !!CONFIG.SPREADSHEET_ID);
  Logger.log('OPENAI_API_KEY set: ' + !!CONFIG.OPENAI_API_KEY);
}

/**
 * Create README sheet (retained from v1.0)
 */
function createReadmeSheet() {
  var ss = getSpreadsheet();
  var existing = ss.getSheetByName('README');

  if (existing) {
    SpreadsheetApp.getUi().alert('README sheet already exists.');
    return;
  }

  var sheet = ss.insertSheet('README');
  sheet.getRange('A1').setValue('Video Analytics Hub v' + CONFIG.VERSION);
  sheet.getRange('A1').setFontSize(16).setFontWeight('bold');
  sheet.getRange('A3').setValue('This spreadsheet is the master data store for the Video Analytics Hub system.');
  sheet.getRange('A5').setValue('Sheets:');

  var row = 6;
  Object.keys(CONFIG.SHEETS).forEach(function(key) {
    sheet.getRange('A' + row).setValue(CONFIG.SHEETS[key]);
    row++;
  });

  sheet.setColumnWidth(1, 400);
  Logger.log('Created README sheet');
}
