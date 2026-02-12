/**
 * PipelineUI.gs - Pipeline menu handlers for Google Sheets UI
 *
 * Provides menu functions to queue videos for pipeline processing.
 * The actual video generation runs on the VM via watch-pipeline.js;
 * these functions only validate and set pipeline_status in the sheet.
 */

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Read all production rows as objects.
 * @returns {{ headers: string[], rows: object[] }}
 */
function getProductionRows_() {
  var sheet = getSheet(CONFIG.SHEETS.PRODUCTION);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { headers: data[0] || [], rows: [], sheet: sheet };

  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    // Skip completely empty rows
    if (data[i].every(function(c) { return c === '' || c === undefined || c === null; })) continue;
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = data[i][idx]; });
    obj._rowIndex = i + 1; // 1-based sheet row number
    rows.push(obj);
  }
  return { headers: headers, rows: rows, sheet: sheet };
}

/**
 * Validate required fields for a production row.
 * @param {object} row - Production row object
 * @returns {string[]} List of missing field names (empty = valid)
 */
function validateProductionRow_(row) {
  var missing = [];
  CONFIG.PRODUCTION_REQUIRED_FIELDS.forEach(function(field) {
    if (!row[field] || String(row[field]).trim() === '') {
      missing.push(field);
    }
  });
  return missing;
}

/**
 * Filter rows that are ready to queue.
 * Criteria: edit_status = 'ready' AND pipeline_status is empty
 * @param {object[]} rows
 * @returns {object[]}
 */
function filterReadyRows_(rows) {
  return rows.filter(function(r) {
    return String(r.edit_status).trim() === 'ready' &&
           (!r.pipeline_status || String(r.pipeline_status).trim() === '');
  });
}

/**
 * Set pipeline_status for a list of rows.
 * @param {Sheet} sheet
 * @param {string[]} headers
 * @param {object[]} rows - Must have _rowIndex
 * @param {string} status - 'queued' or 'queued_dry'
 */
function setPipelineStatus_(sheet, headers, rows, status) {
  var colIdx = headers.indexOf('pipeline_status');
  if (colIdx === -1) throw new Error('pipeline_status column not found in production tab');

  rows.forEach(function(row) {
    sheet.getRange(row._rowIndex, colIdx + 1).setValue(status);
  });

  SpreadsheetApp.flush();
}

// ============================================================
// Queue Functions
// ============================================================

/**
 * Core queue logic shared by normal and dry-run modes.
 * @param {string} mode - 'queued' or 'queued_dry'
 */
function queueReadyVideos_(mode) {
  var ui = SpreadsheetApp.getUi();
  var label = mode === 'queued_dry' ? 'Dry Run' : 'Queue';

  try {
    var prod = getProductionRows_();
    var readyRows = filterReadyRows_(prod.rows);

    if (readyRows.length === 0) {
      ui.alert('No Ready Videos', 'No videos with edit_status=ready and empty pipeline_status found.', ui.ButtonSet.OK);
      return;
    }

    // Validate required fields
    var errors = [];
    readyRows.forEach(function(row) {
      var missing = validateProductionRow_(row);
      if (missing.length > 0) {
        errors.push('Row ' + row._rowIndex + ' (' + (row.video_id || 'no ID') + '): missing ' + missing.join(', '));
      }
    });

    if (errors.length > 0) {
      ui.alert('Validation Errors',
        'The following rows have missing required fields:\n\n' + errors.join('\n') +
        '\n\nRequired fields: ' + CONFIG.PRODUCTION_REQUIRED_FIELDS.join(', '),
        ui.ButtonSet.OK);
      return;
    }

    // Ask for limit
    var promptResult = ui.prompt(label + ' Videos',
      readyRows.length + ' video(s) ready.\nHow many to ' + label.toLowerCase() + '? (blank = all)',
      ui.ButtonSet.OK_CANCEL);

    if (promptResult.getSelectedButton() !== ui.Button.OK) return;

    var limitStr = promptResult.getResponseText().trim();
    var limit = limitStr ? parseInt(limitStr, 10) : readyRows.length;

    if (isNaN(limit) || limit < 1) {
      ui.alert('Error', 'Invalid number: ' + limitStr, ui.ButtonSet.OK);
      return;
    }

    var toQueue = readyRows.slice(0, limit);

    // Set pipeline_status
    setPipelineStatus_(prod.sheet, prod.headers, toQueue, mode);

    var ids = toQueue.map(function(r) { return r.video_id || 'row ' + r._rowIndex; });
    ui.alert(label + ' Complete',
      toQueue.length + ' video(s) set to ' + mode + ':\n' + ids.join('\n') +
      '\n\nThe VM watcher will pick them up within 30 seconds.',
      ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Menu handler: Queue All Ready Videos...
 */
function queueReadyVideosPrompt() {
  queueReadyVideos_('queued');
}

/**
 * Menu handler: Queue All Ready (Dry Run)...
 */
function queueReadyVideosDryRunPrompt() {
  queueReadyVideos_('queued_dry');
}

/**
 * Menu handler: Queue Selected Videos
 * Uses the active selection range in the production sheet.
 */
function queueSelectedVideos() {
  var ui = SpreadsheetApp.getUi();

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var activeSheet = ss.getActiveSheet();

    if (activeSheet.getName() !== CONFIG.SHEETS.PRODUCTION) {
      ui.alert('Wrong Sheet', 'Please select rows in the "' + CONFIG.SHEETS.PRODUCTION + '" tab first.', ui.ButtonSet.OK);
      return;
    }

    var selection = activeSheet.getActiveRange();
    if (!selection) {
      ui.alert('No Selection', 'Please select one or more rows first.', ui.ButtonSet.OK);
      return;
    }

    var startRow = selection.getRow();
    var endRow = startRow + selection.getNumRows() - 1;

    // Read full production data to get headers and row objects
    var prod = getProductionRows_();

    // Filter to selected rows that are ready
    var selectedReady = prod.rows.filter(function(r) {
      return r._rowIndex >= startRow && r._rowIndex <= endRow &&
             String(r.edit_status).trim() === 'ready' &&
             (!r.pipeline_status || String(r.pipeline_status).trim() === '');
    });

    if (selectedReady.length === 0) {
      ui.alert('No Ready Videos',
        'No videos in the selected range (rows ' + startRow + '-' + endRow + ') with edit_status=ready and empty pipeline_status.',
        ui.ButtonSet.OK);
      return;
    }

    // Validate required fields
    var errors = [];
    selectedReady.forEach(function(row) {
      var missing = validateProductionRow_(row);
      if (missing.length > 0) {
        errors.push('Row ' + row._rowIndex + ' (' + (row.video_id || 'no ID') + '): missing ' + missing.join(', '));
      }
    });

    if (errors.length > 0) {
      ui.alert('Validation Errors',
        'The following rows have missing required fields:\n\n' + errors.join('\n'),
        ui.ButtonSet.OK);
      return;
    }

    // Set pipeline_status
    setPipelineStatus_(prod.sheet, prod.headers, selectedReady, 'queued');

    var ids = selectedReady.map(function(r) { return r.video_id || 'row ' + r._rowIndex; });
    ui.alert('Queued', selectedReady.length + ' video(s) queued from selected rows:\n' + ids.join('\n'), ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

// ============================================================
// Status & Control
// ============================================================

/**
 * Menu handler: Pipeline Status
 */
function showPipelineStatus() {
  var ui = SpreadsheetApp.getUi();

  try {
    var prod = getProductionRows_();
    var counts = {};
    var processing = [];

    prod.rows.forEach(function(row) {
      var status = String(row.pipeline_status || '').trim();
      if (!status) status = '(empty)';
      counts[status] = (counts[status] || 0) + 1;

      if (status === 'processing') {
        processing.push((row.video_id || '?') + ' — phase: ' + (row.current_phase || '?'));
      }
    });

    var lines = ['Pipeline Status Summary', ''];
    Object.keys(counts).sort().forEach(function(status) {
      lines.push('  ' + status + ': ' + counts[status]);
    });

    if (processing.length > 0) {
      lines.push('');
      lines.push('Currently processing:');
      processing.forEach(function(p) { lines.push('  ' + p); });
    }

    lines.push('');
    lines.push('Total rows: ' + prod.rows.length);

    ui.alert('Pipeline Status', lines.join('\n'), ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Menu handler: Stop Pipeline
 * Resets all queued/queued_dry rows back to empty pipeline_status.
 */
function stopPipeline() {
  var ui = SpreadsheetApp.getUi();

  try {
    var confirm = ui.alert('Stop Pipeline',
      'This will reset all queued and queued_dry rows to empty pipeline_status.\n' +
      'Currently processing jobs will complete (they cannot be interrupted).\n\nContinue?',
      ui.ButtonSet.YES_NO);

    if (confirm !== ui.Button.YES) return;

    var prod = getProductionRows_();
    var colIdx = prod.headers.indexOf('pipeline_status');
    if (colIdx === -1) throw new Error('pipeline_status column not found');

    var cleared = 0;
    prod.rows.forEach(function(row) {
      var status = String(row.pipeline_status || '').trim();
      if (status === 'queued' || status === 'queued_dry') {
        prod.sheet.getRange(row._rowIndex, colIdx + 1).setValue('');
        cleared++;
      }
    });

    SpreadsheetApp.flush();
    ui.alert('Pipeline Stopped', cleared + ' row(s) reset to empty pipeline_status.\nAny currently processing jobs will finish their current video.', ui.ButtonSet.OK);

  } catch (e) {
    ui.alert('Error', e.message, ui.ButtonSet.OK);
  }
}
