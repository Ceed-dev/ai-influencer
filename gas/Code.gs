/**
 * Video Analytics Hub - Main Entry Points
 *
 * Web App endpoints for n8n integration
 */

/**
 * Handle GET requests (health check)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests (main processing endpoint)
 *
 * Expected payload:
 * {
 *   "action": "import_csv" | "analyze" | "link_videos",
 *   "platform": "youtube" | "tiktok" | "instagram",
 *   "csv_data": "base64-encoded-csv" (for import_csv),
 *   "video_uids": ["VID_001", "VID_002"] (for analyze)
 * }
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    let result;

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

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log(`Error in doPost: ${error.message}`);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle CSV import action
 */
function handleImportCSV(payload) {
  const { platform, csv_data } = payload;

  if (!platform || !csv_data) {
    throw new Error('Missing required fields: platform, csv_data');
  }

  // Decode base64 CSV
  const csvContent = Utilities.newBlob(Utilities.base64Decode(csv_data)).getDataAsString('UTF-8');

  // Parse CSV
  const parsed = parseCSV(csvContent, platform);

  // Normalize to unified schema
  const normalized = normalizeMetrics(parsed, platform);

  // Attempt to link with video_uid
  const { linked, unlinked } = linkVideos(normalized, platform);

  // Write to sheets
  writeMetrics(linked, platform);
  writeUnlinked(unlinked, platform);

  return {
    platform: platform,
    total_rows: parsed.length,
    linked: linked.length,
    unlinked: unlinked.length
  };
}

/**
 * Handle analysis action
 */
function handleAnalyze(payload) {
  const { video_uids } = payload;

  if (!video_uids || !Array.isArray(video_uids)) {
    throw new Error('Missing or invalid video_uids array');
  }

  // Get metrics for specified videos
  const metricsBundle = getMetricsBundle(video_uids);

  // Get KPI targets
  const kpiTargets = getKPITargets();

  // Run KPI comparison
  const kpiResults = compareKPIs(metricsBundle, kpiTargets);

  // Generate LLM analysis
  const analysis = analyzWithLLM(metricsBundle, kpiResults);

  // Write reports
  writeAnalysisReport(analysis);
  writeRecommendations(analysis.recommendations);

  return {
    analyzed_count: video_uids.length,
    report_id: analysis.report_id
  };
}

/**
 * Handle manual video linking action
 */
function handleLinkVideos(payload) {
  const { links } = payload;

  if (!links || !Array.isArray(links)) {
    throw new Error('Missing or invalid links array');
  }

  // Each link: { video_uid, platform_id, platform }
  const results = links.map(link => {
    try {
      createVideoLink(link.video_uid, link.platform_id, link.platform);
      return { ...link, status: 'success' };
    } catch (error) {
      return { ...link, status: 'error', error: error.message };
    }
  });

  return {
    processed: results.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length,
    details: results
  };
}

/**
 * Handle status check action
 */
function handleGetStatus(payload) {
  const ss = getSpreadsheet();

  // Get counts from each sheet
  const counts = {};
  Object.entries(CONFIG.SHEETS).forEach(([key, sheetName]) => {
    try {
      const sheet = ss.getSheetByName(sheetName);
      counts[key] = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
    } catch (e) {
      counts[key] = 0;
    }
  });

  // Get unlinked count
  const unlinkedSheet = ss.getSheetByName(CONFIG.SHEETS.UNLINKED_IMPORTS);
  const unlinkedCount = unlinkedSheet ? Math.max(0, unlinkedSheet.getLastRow() - 1) : 0;

  return {
    spreadsheet_id: CONFIG.SPREADSHEET_ID,
    record_counts: counts,
    pending_links: unlinkedCount,
    last_updated: new Date().toISOString()
  };
}

/**
 * Manual trigger for testing
 */
function testImport() {
  // Sample test - replace with actual test data
  Logger.log('Test import function called');
  Logger.log('Configuration check:');
  Logger.log(`SPREADSHEET_ID set: ${!!CONFIG.SPREADSHEET_ID}`);
  Logger.log(`OPENAI_API_KEY set: ${!!CONFIG.OPENAI_API_KEY}`);
}
