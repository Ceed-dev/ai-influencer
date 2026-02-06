/**
 * Sheet Writer - Handle all Google Sheets write operations
 */

/**
 * Write metrics to platform-specific sheet
 * @param {Array<Object>} metrics - Normalized and linked metrics
 * @param {string} platform - Platform name
 */
function writeMetrics(metrics, platform) {
  if (metrics.length === 0) return;

  const sheetName = CONFIG.SHEETS[`METRICS_${platform.toUpperCase()}`];
  const sheet = getSheet(sheetName);
  const fields = getPlatformFields(platform);

  // Ensure headers exist
  ensureHeaders(sheet, fields);

  // Convert metrics to rows
  const rows = metrics.map(m => fields.map(f => m[f] ?? ''));

  // Append rows
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }

  Logger.log(`Wrote ${rows.length} rows to ${sheetName}`);
}

/**
 * Write unlinked imports for manual review
 * @param {Array<Object>} unlinked - Unlinked metrics
 * @param {string} platform - Platform name
 */
function writeUnlinked(unlinked, platform) {
  if (unlinked.length === 0) return;

  const sheet = getSheet(CONFIG.SHEETS.UNLINKED_IMPORTS);
  const fields = ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row'];

  // Ensure headers exist
  ensureHeaders(sheet, fields);

  // Convert to rows
  const rows = unlinked.map(m => [
    platform,
    m.platform_id,
    m.title,
    m.views,
    m.import_date,
    m.raw_csv_row
  ]);

  // Append rows
  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }

  Logger.log(`Wrote ${rows.length} unlinked rows`);
}

/**
 * Write analysis report
 * @param {Object} analysis - Analysis results
 */
function writeAnalysisReport(analysis) {
  const sheet = getSheet(CONFIG.SHEETS.ANALYSIS_REPORTS);
  const fields = ['report_id', 'generated_at', 'video_count', 'insights_json'];

  // Ensure headers exist
  ensureHeaders(sheet, fields);

  const row = [
    analysis.report_id,
    analysis.generated_at,
    analysis.video_count,
    JSON.stringify(analysis.analysis)
  ];

  sheet.appendRow(row);
  Logger.log(`Wrote analysis report: ${analysis.report_id}`);
}

/**
 * Write recommendations
 * @param {Array<Object>} recommendations - Recommendations list
 */
function writeRecommendations(recommendations) {
  if (recommendations.length === 0) return;

  const sheet = getSheet(CONFIG.SHEETS.RECOMMENDATIONS);
  const fields = ['created_at', 'priority', 'category', 'recommendation', 'platform', 'expected_impact', 'status'];

  // Ensure headers exist
  ensureHeaders(sheet, fields);

  const now = new Date().toISOString();
  const rows = recommendations.map(r => [
    now,
    r.priority,
    r.category,
    r.recommendation,
    r.platform,
    r.expected_impact,
    'pending'  // Initial status
  ]);

  if (rows.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }

  Logger.log(`Wrote ${rows.length} recommendations`);
}

/**
 * Ensure sheet has correct headers
 */
function ensureHeaders(sheet, fields) {
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];

  // Check if headers match
  const hasHeaders = fields.every((field, i) => currentHeaders[i] === field);

  if (!hasHeaders && sheet.getLastRow() === 0) {
    // Sheet is empty, write headers
    sheet.getRange(1, 1, 1, fields.length).setValues([fields]);
  } else if (!hasHeaders && sheet.getLastRow() > 0) {
    // Headers mismatch on non-empty sheet - log warning
    Logger.log(`Warning: Headers mismatch on ${sheet.getName()}`);
  }
}

/**
 * Create all required sheets if they don't exist
 */
function initializeSheets() {
  const ss = getSpreadsheet();

  const sheetConfigs = [
    {
      name: CONFIG.SHEETS.VIDEOS_MASTER,
      headers: ['video_uid', 'title', 'created_date', 'youtube_id', 'tiktok_id', 'instagram_id', 'scenario_id']
    },
    {
      name: CONFIG.SHEETS.METRICS_YOUTUBE,
      headers: getPlatformFields('youtube')
    },
    {
      name: CONFIG.SHEETS.METRICS_TIKTOK,
      headers: getPlatformFields('tiktok')
    },
    {
      name: CONFIG.SHEETS.METRICS_INSTAGRAM,
      headers: getPlatformFields('instagram')
    },
    {
      name: CONFIG.SHEETS.KPI_TARGETS,
      headers: ['platform', 'metric', 'target_value', 'description']
    },
    {
      name: CONFIG.SHEETS.SCENARIO_CUTS,
      headers: ['scenario_id', 'video_uid', 'cut_number', 'start_time', 'end_time', 'description', 'hook_type']
    },
    {
      name: CONFIG.SHEETS.ANALYSIS_REPORTS,
      headers: ['report_id', 'generated_at', 'video_count', 'insights_json']
    },
    {
      name: CONFIG.SHEETS.RECOMMENDATIONS,
      headers: ['created_at', 'priority', 'category', 'recommendation', 'platform', 'expected_impact', 'status']
    },
    {
      name: CONFIG.SHEETS.UNLINKED_IMPORTS,
      headers: ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row']
    }
  ];

  sheetConfigs.forEach(config => {
    let sheet = ss.getSheetByName(config.name);

    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.setFrozenRows(1);
      Logger.log(`Created sheet: ${config.name}`);
    }
  });

  Logger.log('Sheet initialization complete');
}

/**
 * Clear all data (keep headers) - for testing
 */
function clearAllData() {
  const ss = getSpreadsheet();

  Object.values(CONFIG.SHEETS).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  });

  Logger.log('All data cleared');
}

/**
 * Update video in master sheet
 */
function updateVideoMaster(videoUid, updates) {
  const sheet = getSheet(CONFIG.SHEETS.VIDEOS_MASTER);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const videoUidCol = headers.indexOf('video_uid');

  for (let i = 1; i < data.length; i++) {
    if (data[i][videoUidCol] === videoUid) {
      Object.entries(updates).forEach(([field, value]) => {
        const col = headers.indexOf(field);
        if (col !== -1) {
          sheet.getRange(i + 1, col + 1).setValue(value);
        }
      });
      return true;
    }
  }

  return false;
}

/**
 * Get all video UIDs from master
 */
function getAllVideoUids() {
  const sheet = getSheet(CONFIG.SHEETS.VIDEOS_MASTER);
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  const headers = data[0];
  const videoUidCol = headers.indexOf('video_uid');

  return data.slice(1).map(row => row[videoUidCol]).filter(Boolean);
}
