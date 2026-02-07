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

      case 'analyze_single':
        result = handleAnalyzeSingle(payload);
        break;

      case 'analyze_all':
        result = handleAnalyzeAll(payload);
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
    last_updated: nowJapan()
  };
}

/**
 * Handle single video analysis action (API)
 */
function handleAnalyzeSingle(payload) {
  const { video_uid } = payload;

  if (!video_uid) {
    throw new Error('Missing video_uid');
  }

  // Run single video analysis
  const analysis = analyzeVideoSingle(video_uid);

  // Write to video_analysis sheet
  writeVideoAnalysis(analysis);

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
  const videoUids = getAllVideoUids();

  if (videoUids.length === 0) {
    throw new Error('No videos found in videos_master');
  }

  const metricsBundle = getMetricsBundle(videoUids);
  const kpiTargets = getKPITargets();
  const kpiResults = compareKPIs(metricsBundle, kpiTargets);

  // Use enhanced analysis with historical context
  const analysis = analyzWithLLMEnhanced(metricsBundle, kpiResults);

  writeAnalysisReport(analysis);
  writeRecommendationsEnhanced(analysis.recommendations);

  return {
    analyzed_count: videoUids.length,
    report_id: analysis.report_id,
    generated_at: analysis.generated_at
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

/**
 * One-time setup function - Run this first!
 * Sets up Script Properties and initializes all sheets
 */
function setupVideoAnalyticsHub() {
  const props = PropertiesService.getScriptProperties();

  // Set Spreadsheet ID (bound script gets it automatically)
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheetId = ss.getId();
  props.setProperty('SPREADSHEET_ID', spreadsheetId);

  Logger.log(`Spreadsheet ID set: ${spreadsheetId}`);

  // Initialize all required sheets
  initializeSheetsForBoundScript(ss);

  Logger.log('Setup complete! Now set your OPENAI_API_KEY in Script Properties.');
  Logger.log('Go to: Project Settings (gear icon) → Script Properties → Add Property');
  Logger.log('Key: OPENAI_API_KEY, Value: your-api-key');

  // Show completion message
  SpreadsheetApp.getUi().alert(
    'Setup Complete!',
    'All sheets have been created.\n\n' +
    'Next step: Set your OpenAI API Key\n' +
    '1. Click "Project Settings" (gear icon) in Apps Script\n' +
    '2. Scroll to "Script Properties"\n' +
    '3. Click "Add Property"\n' +
    '4. Key: OPENAI_API_KEY\n' +
    '5. Value: your OpenAI API key',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Initialize sheets for bound script (uses active spreadsheet)
 */
function initializeSheetsForBoundScript(ss) {
  const sheetConfigs = [
    {
      name: 'videos_master',
      headers: ['video_uid', 'title', 'created_date', 'youtube_id', 'tiktok_id', 'instagram_id', 'scenario_id']
    },
    {
      name: 'metrics_youtube',
      headers: ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate', 'watch_time_hours', 'avg_watch_time_sec', 'completion_rate', 'ctr', 'subscribers_gained']
    },
    {
      name: 'metrics_tiktok',
      headers: ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate', 'saves', 'avg_watch_time_sec', 'completion_rate']
    },
    {
      name: 'metrics_instagram',
      headers: ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate', 'saves', 'avg_watch_time_sec', 'reach']
    },
    {
      name: 'kpi_targets',
      headers: ['platform', 'metric', 'target_value', 'description']
    },
    {
      name: 'scenario_cuts',
      headers: ['scenario_id', 'video_uid', 'cut_number', 'start_time', 'end_time', 'description', 'hook_type']
    },
    {
      name: 'analysis_reports',
      headers: ['report_id', 'generated_at', 'video_count', 'insights_json']
    },
    {
      name: 'recommendations',
      headers: ['created_at', 'priority', 'category', 'recommendation', 'platform', 'expected_impact', 'status']
    },
    {
      name: 'unlinked_imports',
      headers: ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row']
    }
  ];

  // Delete default Sheet1 if it exists and is empty
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() <= 1) {
    // Will delete after creating other sheets
  }

  sheetConfigs.forEach(config => {
    let sheet = ss.getSheetByName(config.name);

    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.setFrozenRows(1);

      // Format header row
      sheet.getRange(1, 1, 1, config.headers.length)
        .setBackground('#4285f4')
        .setFontColor('#ffffff')
        .setFontWeight('bold');

      Logger.log(`Created sheet: ${config.name}`);
    }
  });

  // Now safe to delete Sheet1
  if (sheet1 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(sheet1);
      Logger.log('Deleted default Sheet1');
    } catch (e) {
      // Ignore if can't delete
    }
  }

  // Add default KPI targets
  const kpiSheet = ss.getSheetByName('kpi_targets');
  if (kpiSheet.getLastRow() === 1) {
    const defaultKPIs = [
      ['youtube', 'completion_rate', '0.5', '50% of viewers watch to end'],
      ['youtube', 'ctr', '0.05', '5% click-through rate'],
      ['youtube', 'engagement_rate', '0.03', '3% engagement'],
      ['tiktok', 'completion_rate', '0.4', '40% watch to end'],
      ['tiktok', 'engagement_rate', '0.08', '8% engagement'],
      ['tiktok', 'avg_watch_time_sec', '10', '10 seconds average'],
      ['instagram', 'reach_rate', '0.3', '30% of followers reached'],
      ['instagram', 'avg_watch_time_sec', '15', '15 seconds average'],
      ['instagram', 'engagement_rate', '0.05', '5% engagement']
    ];
    kpiSheet.getRange(2, 1, defaultKPIs.length, 4).setValues(defaultKPIs);
    Logger.log('Added default KPI targets');
  }

  Logger.log('Sheet initialization complete');
}

/**
 * Add custom menu to Sheets UI
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Video Analytics')
    .addItem('🚀 Initial Setup', 'setupVideoAnalyticsHub')
    .addItem('📖 Create README Sheet', 'createReadmeSheet')
    .addItem('⬆️ Upgrade Sheet Structure', 'upgradeSheetStructure')
    .addSeparator()
    .addItem('📥 Import YouTube CSV', 'importYouTubeCSV')
    .addItem('📥 Import TikTok CSV', 'importTikTokCSV')
    .addItem('📥 Import Instagram CSV', 'importInstagramCSV')
    .addSeparator()
    .addSubMenu(ui.createMenu('🔍 Analyze')
      .addItem('📊 Analyze Single Video', 'analyzeSingleVideoPrompt')
      .addItem('📈 Analyze All Videos', 'analyzeAllVideosEnhanced'))
    .addItem('📋 Check Status', 'showStatus')
    .addToUi();
}

/**
 * Prompt user to select a video for single analysis
 */
function analyzeSingleVideoPrompt() {
  const ui = SpreadsheetApp.getUi();

  // Get list of videos
  const videoUids = getAllVideoUids();
  if (videoUids.length === 0) {
    ui.alert('エラー', 'videos_master に動画が登録されていません。', ui.ButtonSet.OK);
    return;
  }

  const result = ui.prompt(
    '動画を選択',
    '分析する動画のUIDを入力してください:\n\n' +
    '登録済み動画:\n' + videoUids.join('\n'),
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  const videoUid = result.getResponseText().trim();
  if (!videoUids.includes(videoUid)) {
    ui.alert('エラー', `動画が見つかりません: ${videoUid}`, ui.ButtonSet.OK);
    return;
  }

  try {
    ui.alert('分析中', '分析を開始します。完了までお待ちください...', ui.ButtonSet.OK);

    const analysis = analyzeVideoSingle(videoUid);
    writeVideoAnalysis(analysis);

    ui.alert(
      '分析完了',
      `動画: ${videoUid}\n\n` +
      `KPI達成: ${analysis.kpi_achievement}\n\n` +
      `YouTube: ${truncate(analysis.youtube_performance, 50)}\n` +
      `TikTok: ${truncate(analysis.tiktok_performance, 50)}\n` +
      `Instagram: ${truncate(analysis.instagram_performance, 50)}\n\n` +
      '詳細は video_analysis シートを確認してください。',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('エラー', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Analyze all videos with enhanced historical context
 */
function analyzeAllVideosEnhanced() {
  const ui = SpreadsheetApp.getUi();

  try {
    const videoUids = getAllVideoUids();

    if (videoUids.length === 0) {
      ui.alert('エラー', 'videos_master に動画が登録されていません。', ui.ButtonSet.OK);
      return;
    }

    const metricsBundle = getMetricsBundle(videoUids);
    const kpiTargets = getKPITargets();
    const kpiResults = compareKPIs(metricsBundle, kpiTargets);

    // Use enhanced analysis with historical context
    const analysis = analyzWithLLMEnhanced(metricsBundle, kpiResults);

    writeAnalysisReport(analysis);
    writeRecommendationsEnhanced(analysis.recommendations);

    ui.alert(
      '分析完了',
      `分析した動画数: ${videoUids.length}\n` +
      `レポートID: ${analysis.report_id}\n\n` +
      '改善提案は recommendations シートを確認してください。\n' +
      '（過去の分析との比較情報も含まれています）',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('エラー', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Write recommendations with enhanced fields
 */
function writeRecommendationsEnhanced(recommendations) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.RECOMMENDATIONS);

  if (!sheet) {
    throw new Error('recommendations sheet not found');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now = nowJapan();

  recommendations.forEach(rec => {
    const row = headers.map(h => {
      switch(h) {
        case 'video_uid': return rec.video_uid || 'all';
        case 'created_at': return now;
        case 'priority': return String(rec.priority);
        case 'category': return rec.category;
        case 'recommendation': return rec.recommendation;
        case 'platform': return rec.platform;
        case 'expected_impact': return rec.expected_impact;
        case 'status': return 'pending';
        case 'compared_to_previous': return rec.compared_to_previous || 'NEW';
        default: return '';
      }
    });

    sheet.appendRow(row);
  });

  Logger.log(`Written ${recommendations.length} enhanced recommendations`);
}

/**
 * Import CSV from file picker
 */
function importYouTubeCSV() {
  importCSVFromPicker('youtube');
}

function importTikTokCSV() {
  importCSVFromPicker('tiktok');
}

function importInstagramCSV() {
  importCSVFromPicker('instagram');
}

function importCSVFromPicker(platform) {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    `Import ${platform.toUpperCase()} CSV`,
    'Paste CSV content here (or paste a Google Drive file URL):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() === ui.Button.OK) {
    const input = result.getResponseText();

    try {
      let csvContent = input;

      // Check if it's a Drive URL
      if (input.includes('drive.google.com') || input.includes('docs.google.com')) {
        const fileId = extractFileId(input);
        const file = DriveApp.getFileById(fileId);
        csvContent = file.getBlob().getDataAsString('UTF-8');
      }

      const parsed = parseCSV(csvContent, platform);
      const normalized = normalizeMetrics(parsed, platform);
      const { linked, unlinked } = linkVideos(normalized, platform);

      writeMetrics(linked, platform);
      writeUnlinked(unlinked, platform);

      ui.alert(
        'Import Complete!',
        `Platform: ${platform}\n` +
        `Total rows: ${parsed.length}\n` +
        `Linked: ${linked.length}\n` +
        `Unlinked: ${unlinked.length}`,
        ui.ButtonSet.OK
      );
    } catch (e) {
      ui.alert('Import Error', e.message, ui.ButtonSet.OK);
    }
  }
}

function extractFileId(url) {
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Could not extract file ID from URL');
}

/**
 * Analyze all videos in master sheet
 */
function analyzeAllVideos() {
  const ui = SpreadsheetApp.getUi();

  try {
    const videoUids = getAllVideoUids();

    if (videoUids.length === 0) {
      ui.alert('No Videos', 'No videos found in videos_master sheet.', ui.ButtonSet.OK);
      return;
    }

    const metricsBundle = getMetricsBundle(videoUids);
    const kpiTargets = getKPITargets();
    const kpiResults = compareKPIs(metricsBundle, kpiTargets);
    const analysis = analyzWithLLM(metricsBundle, kpiResults);

    writeAnalysisReport(analysis);
    writeRecommendations(analysis.recommendations);

    ui.alert(
      'Analysis Complete!',
      `Analyzed: ${videoUids.length} videos\n` +
      `Report ID: ${analysis.report_id}\n\n` +
      'Check the "recommendations" sheet for improvement suggestions.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('Analysis Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Show current status
 */
function showStatus() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheets = ['videos_master', 'metrics_youtube', 'metrics_tiktok', 'metrics_instagram', 'recommendations', 'unlinked_imports'];

  let status = 'Current Status:\n\n';

  sheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    const count = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
    status += `${name}: ${count} records\n`;
  });

  const props = PropertiesService.getScriptProperties();
  status += `\nOpenAI API Key: ${props.getProperty('OPENAI_API_KEY') ? '✅ Set' : '❌ Not set'}`;

  ui.alert('Status', status, ui.ButtonSet.OK);
}

/**
 * Insert demo data for testing - Run this from Apps Script editor
 */
function insertDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // 1. Add demo videos to videos_master
  var masterSheet = ss.getSheetByName('videos_master');
  var masterData = [
    ['VID_001', 'AI Mika Day in Tokyo', '2026-02-01', 'YT_VID001', 'TT_VID001', 'IG_VID001', ''],
    ['VID_002', 'Cooking with AI Mika', '2026-02-02', 'YT_VID002', 'TT_VID002', 'IG_VID002', ''],
    ['VID_003', 'AI Mika reacts to viral videos', '2026-02-03', 'YT_VID003', 'TT_VID003', 'IG_VID003', '']
  ];

  // Check if data already exists
  var existingData = masterSheet.getDataRange().getValues();
  if (existingData.length <= 1) {
    masterSheet.getRange(2, 1, masterData.length, masterData[0].length).setValues(masterData);
    Logger.log('Added demo videos to videos_master');
  }

  // 2. Add YouTube metrics
  var ytSheet = ss.getSheetByName('metrics_youtube');
  var ytData = [
    ['VID_001', nowJapan(), 185000, 7200, 520, 280, 4.3, 3200.5, 85, 45, 9.8, 620],
    ['VID_002', nowJapan(), 142000, 5100, 380, 195, 4.0, 2450.2, 75, 40, 8.1, 410],
    ['VID_003', nowJapan(), 210000, 8900, 1200, 650, 5.1, 4100.8, 92, 52, 10.5, 880]
  ];
  if (ytSheet.getLastRow() <= 1) {
    ytSheet.getRange(2, 1, ytData.length, ytData[0].length).setValues(ytData);
    Logger.log('Added YouTube metrics');
  }

  // 3. Add TikTok metrics
  var ttSheet = ss.getSheetByName('metrics_tiktok');
  var ttData = [
    ['VID_001', nowJapan(), 620000, 45000, 1800, 7200, 10.5, 11000, 14.2, 48],
    ['VID_002', nowJapan(), 480000, 32000, 1100, 4800, 8.4, 7200, 10.5, 38],
    ['VID_003', nowJapan(), 780000, 58000, 2500, 12000, 13.2, 18000, 16.5, 55]
  ];
  if (ttSheet.getLastRow() <= 1) {
    ttSheet.getRange(2, 1, ttData.length, ttData[0].length).setValues(ttData);
    Logger.log('Added TikTok metrics');
  }

  // 4. Add Instagram metrics
  var igSheet = ss.getSheetByName('metrics_instagram');
  var igData = [
    ['VID_001', nowJapan(), 125000, 8500, 620, 1200, 8.3, 2800, 20.5, 105000],
    ['VID_002', nowJapan(), 98000, 6200, 480, 850, 7.7, 1950, 16.8, 82000],
    ['VID_003', nowJapan(), 168000, 12500, 950, 1800, 9.1, 4200, 24.2, 142000]
  ];
  if (igSheet.getLastRow() <= 1) {
    igSheet.getRange(2, 1, igData.length, igData[0].length).setValues(igData);
    Logger.log('Added Instagram metrics');
  }

  ui.alert('デモデータ挿入完了',
    '以下のデータを追加しました:\n\n' +
    '✅ videos_master: 3動画\n' +
    '✅ metrics_youtube: 3レコード\n' +
    '✅ metrics_tiktok: 3レコード\n' +
    '✅ metrics_instagram: 3レコード\n\n' +
    '次に「Analyze All Videos」を実行してください。',
    ui.ButtonSet.OK);
}

/**
 * Clear all demo data - Run this to reset
 */
function clearAllDemoData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var result = ui.alert('確認', '全てのデータを削除しますか？\n（ヘッダー行は残ります）', ui.ButtonSet.YES_NO);

  if (result !== ui.Button.YES) return;

  var sheetNames = ['videos_master', 'metrics_youtube', 'metrics_tiktok', 'metrics_instagram',
                    'recommendations', 'analysis_reports', 'video_analysis', 'unlinked_imports'];

  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  });

  ui.alert('完了', '全てのデータを削除しました。', ui.ButtonSet.OK);
}
