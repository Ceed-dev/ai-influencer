/**
 * Sheet Writer - Handle all Google Sheets write operations (v2.0)
 */

/**
 * Write metrics to platform-specific sheet
 * Also updates master metrics snapshot
 */
function writeMetrics(metrics, platform) {
  if (metrics.length === 0) return;

  var sheetName = CONFIG.SHEETS['METRICS_' + platform.toUpperCase()];
  var sheet = getSheet(sheetName);
  var fields = getPlatformFields(platform);

  ensureHeaders(sheet, fields);

  var rows = metrics.map(function(m) {
    return fields.map(function(f) { return m[f] !== undefined ? m[f] : ''; });
  });

  if (rows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }

  // v2.0: Update master metrics snapshot for each linked video
  metrics.forEach(function(m) {
    if (m.video_uid) {
      try {
        updateMasterMetricsSnapshot(m.video_uid, platform, m);
      } catch (e) {
        Logger.log('Error updating snapshot for ' + m.video_uid + ': ' + e.message);
      }
    }
  });

  Logger.log('Wrote ' + rows.length + ' rows to ' + sheetName);
}

/**
 * Write unlinked imports for manual review
 */
function writeUnlinked(unlinked, platform) {
  if (unlinked.length === 0) return;

  var sheet = getSheet(CONFIG.SHEETS.UNLINKED_IMPORTS);
  var fields = ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row'];

  ensureHeaders(sheet, fields);

  var rows = unlinked.map(function(m) {
    return [
      platform,
      m.platform_id,
      m.title,
      m.views,
      m.import_date,
      m.raw_csv_row
    ];
  });

  if (rows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, fields.length).setValues(rows);
  }

  Logger.log('Wrote ' + rows.length + ' unlinked rows');
}

/**
 * Write analysis report
 */
function writeAnalysisReport(analysis) {
  var sheet = getSheet(CONFIG.SHEETS.ANALYSIS_REPORTS);
  var fields = ['report_id', 'generated_at', 'video_count', 'insights_json'];

  ensureHeaders(sheet, fields);

  var row = [
    analysis.report_id,
    analysis.generated_at,
    analysis.video_count,
    JSON.stringify(analysis.analysis)
  ];

  sheet.appendRow(row);
  Logger.log('Wrote analysis report: ' + analysis.report_id);
}

/**
 * Write recommendations (basic)
 */
function writeRecommendations(recommendations) {
  if (recommendations.length === 0) return;

  var sheet = getSheet(CONFIG.SHEETS.RECOMMENDATIONS);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var now = nowJapan();

  var rows = recommendations.map(function(r) {
    return headers.map(function(h) {
      switch(h) {
        case 'video_uid': return r.video_uid || 'all';
        case 'created_at': return now;
        case 'priority': return String(r.priority);
        case 'category': return r.category;
        case 'recommendation': return r.recommendation;
        case 'platform': return r.platform;
        case 'expected_impact': return r.expected_impact;
        case 'status': return 'pending';
        case 'compared_to_previous': return r.compared_to_previous || 'NEW';
        default: return '';
      }
    });
  });

  if (rows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  }

  Logger.log('Wrote ' + rows.length + ' recommendations');
}

/**
 * Write recommendations with enhanced fields (v2.0)
 */
function writeRecommendationsEnhanced(recommendations) {
  writeRecommendations(recommendations);
}

/**
 * Write video analysis to sheet
 */
function writeVideoAnalysis(analysis) {
  var sheet;
  try {
    sheet = getSheet(CONFIG.SHEETS.VIDEO_ANALYSIS);
  } catch (e) {
    // Create sheet if it doesn't exist
    var ss = getSpreadsheet();
    sheet = ss.insertSheet(CONFIG.SHEETS.VIDEO_ANALYSIS);
    var headers = [
      'video_uid', 'analyzed_at', 'youtube_performance', 'tiktok_performance',
      'instagram_performance', 'cross_platform_insights', 'kpi_achievement',
      'improvements_from_previous', 'prompt_effectiveness', 'recommendations'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(CONFIG.COLORS.HEADER)
      .setFontColor(CONFIG.COLORS.HEADER_FONT)
      .setFontWeight('bold');
  }

  var row = [
    analysis.video_uid,
    analysis.analyzed_at,
    analysis.youtube_performance,
    analysis.tiktok_performance,
    analysis.instagram_performance,
    analysis.cross_platform_insights,
    analysis.kpi_achievement,
    analysis.improvements_from_previous,
    analysis.prompt_effectiveness,
    analysis.recommendations
  ];

  sheet.appendRow(row);
  Logger.log('Written video analysis for: ' + analysis.video_uid);
}

/**
 * Ensure sheet has correct headers
 */
function ensureHeaders(sheet, fields) {
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getMaxColumns()).getValues()[0];
  var hasHeaders = fields.every(function(field, i) { return currentHeaders[i] === field; });

  if (!hasHeaders && sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, fields.length).setValues([fields]);
  } else if (!hasHeaders && sheet.getLastRow() > 0) {
    Logger.log('Warning: Headers mismatch on ' + sheet.getName());
  }
}

/**
 * Create all required sheets if they don't exist
 */
function initializeSheets() {
  var ss = getSpreadsheet();

  var sheetConfigs = [
    {
      name: CONFIG.SHEETS.MASTER,
      headers: CONFIG.MASTER_ALL_COLUMNS
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
      name: CONFIG.SHEETS.ANALYSIS_REPORTS,
      headers: ['report_id', 'generated_at', 'video_count', 'insights_json']
    },
    {
      name: CONFIG.SHEETS.RECOMMENDATIONS,
      headers: ['video_uid', 'created_at', 'priority', 'category', 'recommendation',
                'platform', 'expected_impact', 'status', 'compared_to_previous']
    },
    {
      name: CONFIG.SHEETS.UNLINKED_IMPORTS,
      headers: ['platform', 'platform_id', 'title', 'views', 'import_date', 'raw_csv_row']
    }
  ];

  sheetConfigs.forEach(function(config) {
    var sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.setFrozenRows(1);
      Logger.log('Created sheet: ' + config.name);
    }
  });

  Logger.log('Sheet initialization complete');
}

/**
 * Clear all data (keep headers)
 */
function clearAllData() {
  var ss = getSpreadsheet();

  Object.values(CONFIG.SHEETS).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  });

  Logger.log('All data cleared');
}

/**
 * Write component data to inventory sheet
 * @param {string} inventoryType - 'scenarios' | 'motions' | 'characters' | 'audio'
 * @param {Object} data - Component data with headers as keys
 */
function writeToInventory(inventoryType, data) {
  var sheet = getInventorySheet(inventoryType);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var row = headers.map(function(h) {
    return data[h] !== undefined ? data[h] : '';
  });

  sheet.appendRow(row);
  Logger.log('Wrote to ' + inventoryType + ' inventory: ' + data.component_id);
}
