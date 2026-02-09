/**
 * Utilities - Helper functions for Video Analytics Hub v2.0
 */

/**
 * Safe JSON parse with default
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Format date for sheets (Japan timezone, readable format)
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}

/**
 * Format date for sheets (ISO format for API)
 */
function formatDateISO(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString();
}

/**
 * Get current date formatted for Japan timezone
 */
function nowJapan() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
}

/**
 * Sleep with progress logging
 */
function sleepWithLog(ms, message) {
  Logger.log(`${message} - waiting ${ms}ms`);
  Utilities.sleep(ms);
}

/**
 * Check execution time and handle timeout
 */
function checkExecutionTime(startTime, context) {
  const elapsed = new Date().getTime() - startTime.getTime();

  if (elapsed > CONFIG.EXECUTION_TIME_LIMIT_MS) {
    saveProcessingState(context);
    createContinuationTrigger();
    throw new Error('TIMEOUT_CONTINUATION');
  }

  return elapsed;
}

/**
 * Save processing state for timeout continuation
 */
function saveProcessingState(context) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('PROCESSING_STATE', JSON.stringify({
    savedAt: new Date().toISOString(),
    ...context
  }));
}

/**
 * Load processing state
 */
function loadProcessingState() {
  const props = PropertiesService.getScriptProperties();
  const state = props.getProperty('PROCESSING_STATE');
  return state ? JSON.parse(state) : null;
}

/**
 * Clear processing state
 */
function clearProcessingState() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('PROCESSING_STATE');
}

/**
 * Create time-based trigger for continuation
 */
function createContinuationTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'continueProcessing') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('continueProcessing')
    .timeBased()
    .after(60 * 1000)
    .create();
}

/**
 * Continue processing after timeout
 */
function continueProcessing() {
  const state = loadProcessingState();

  if (!state) {
    Logger.log('No processing state found');
    return;
  }

  Logger.log(`Resuming processing from state saved at ${state.savedAt}`);

  try {
    switch (state.action) {
      case 'import_csv':
        resumeImport(state);
        break;
      case 'analyze':
        resumeAnalysis(state);
        break;
      default:
        Logger.log(`Unknown action type: ${state.action}`);
    }

    clearProcessingState();
  } catch (e) {
    if (e.message === 'TIMEOUT_CONTINUATION') {
      Logger.log('Processing continues in next trigger');
    } else {
      throw e;
    }
  }
}

/**
 * Resume import processing
 */
function resumeImport(state) {
  Logger.log('Resuming import from row: ' + state.lastProcessedRow);
}

/**
 * Resume analysis processing
 */
function resumeAnalysis(state) {
  Logger.log('Resuming analysis from video: ' + state.lastProcessedVideo);
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Deep clone object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get unique values from array
 */
function unique(arr) {
  return [...new Set(arr)];
}

/**
 * Group array by key
 */
function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const val = item[key];
    groups[val] = groups[val] || [];
    groups[val].push(item);
    return groups;
  }, {});
}

/**
 * Calculate percentage
 */
function percentage(value, total) {
  if (!total || total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '';
  return num.toLocaleString();
}

/**
 * Round to specified decimal places
 */
function roundTo(num, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Get property with default
 */
function getProperty(key, defaultValue) {
  const props = PropertiesService.getScriptProperties();
  const value = props.getProperty(key);
  return value !== null ? value : defaultValue;
}

/**
 * Set property
 */
function setProperty(key, value) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(key, String(value));
}

/**
 * Log with timestamp
 */
function logWithTimestamp(message) {
  const timestamp = Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd HH:mm:ss');
  Logger.log(`[${timestamp}] ${message}`);
}

/**
 * Batch array into chunks
 */
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Retry function with exponential backoff
 */
function withRetry(fn, maxAttempts, baseDelayMs) {
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return fn();
    } catch (e) {
      lastError = e;

      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        Utilities.sleep(delay);
      }
    }
  }

  throw lastError;
}

// ============================================================
// v2.0 Component ID Generators
// ============================================================

/**
 * Generate a component ID with the given prefix
 * @param {string} prefix - e.g. 'SCN_H_', 'MOT_', 'CHR_', 'AUD_'
 * @param {Sheet} sheet - The inventory sheet to check for existing IDs
 * @returns {string} New unique component ID
 */
function generateComponentId(prefix, sheet) {
  let maxNum = 0;

  if (sheet && sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const id = String(data[i][0]);
      if (id.startsWith(prefix)) {
        const numPart = parseInt(id.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
  }

  return prefix + String(maxNum + 1).padStart(4, '0');
}

/**
 * Generate scenario ID based on type
 * @param {string} type - 'hook' | 'body' | 'cta'
 * @param {Sheet} sheet - The scenarios inventory sheet
 * @returns {string}
 */
function generateScenarioId(type, sheet) {
  const prefixMap = {
    hook: CONFIG.COMPONENT_PREFIXES.SCENARIO_HOOK,
    body: CONFIG.COMPONENT_PREFIXES.SCENARIO_BODY,
    cta: CONFIG.COMPONENT_PREFIXES.SCENARIO_CTA
  };
  return generateComponentId(prefixMap[type], sheet);
}

/**
 * Generate motion ID
 * @param {Sheet} sheet - The motions inventory sheet
 * @returns {string}
 */
function generateMotionId(sheet) {
  return generateComponentId(CONFIG.COMPONENT_PREFIXES.MOTION, sheet);
}

/**
 * Generate character ID
 * @param {Sheet} sheet - The characters inventory sheet
 * @returns {string}
 */
function generateCharacterId(sheet) {
  return generateComponentId(CONFIG.COMPONENT_PREFIXES.CHARACTER, sheet);
}

/**
 * Generate audio ID
 * @param {Sheet} sheet - The audio inventory sheet
 * @returns {string}
 */
function generateAudioId(sheet) {
  return generateComponentId(CONFIG.COMPONENT_PREFIXES.AUDIO, sheet);
}

/**
 * Generate new video_uid
 * @returns {string} Format: VID_YYYYMM_XXXX
 */
function generateVideoUid() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  try {
    const sheet = getSheet(CONFIG.SHEETS.MASTER);
    const count = Math.max(1, sheet.getLastRow());
    return `VID_${year}${month}_${String(count).padStart(4, '0')}`;
  } catch (e) {
    const random = Math.floor(Math.random() * 10000);
    return `VID_${year}${month}_${String(random).padStart(4, '0')}`;
  }
}

// ============================================================
// v2.0 Generic Sheet Helpers
// ============================================================

/**
 * Read all data from a sheet as array of objects (header-keyed)
 * @param {Sheet} sheet - The sheet to read
 * @returns {Array<Object>}
 */
function readSheetAsObjects(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

/**
 * Find a row in sheet by column value
 * @param {Sheet} sheet - The sheet to search
 * @param {string} column - The column header name
 * @param {*} value - The value to match
 * @returns {Object|null} The matching row as an object, or null
 */
function findRowByColumn(sheet, column, value) {
  if (!sheet || sheet.getLastRow() < 2) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(column);

  if (colIdx === -1) return null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][colIdx] === value) {
      const obj = {};
      headers.forEach((h, j) => {
        obj[h] = data[i][j];
      });
      obj._rowIndex = i + 1; // 1-based sheet row index
      return obj;
    }
  }

  return null;
}

/**
 * Find all rows matching a column value
 * @param {Sheet} sheet - The sheet to search
 * @param {string} column - The column header name
 * @param {*} value - The value to match
 * @returns {Array<Object>}
 */
function findAllRowsByColumn(sheet, column, value) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(column);

  if (colIdx === -1) return [];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIdx] === value) {
      const obj = {};
      headers.forEach((h, j) => {
        obj[h] = data[i][j];
      });
      obj._rowIndex = i + 1;
      results.push(obj);
    }
  }

  return results;
}

/**
 * Update a row in a sheet by row index
 * @param {Sheet} sheet - The sheet to update
 * @param {number} rowIndex - 1-based row index
 * @param {Object} updates - Key-value pairs of column name → new value
 */
function updateRowByIndex(sheet, rowIndex, updates) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Object.entries(updates).forEach(([field, value]) => {
    const colIdx = headers.indexOf(field);
    if (colIdx !== -1) {
      sheet.getRange(rowIndex, colIdx + 1).setValue(value);
    }
  });
}

/**
 * Determine inventory type from component ID prefix
 * @param {string} componentId - e.g. 'SCN_H_0001', 'MOT_0001', 'CHR_0001', 'AUD_0001'
 * @returns {string} 'scenarios' | 'motions' | 'characters' | 'audio'
 */
function getInventoryTypeFromId(componentId) {
  if (!componentId) return null;
  if (componentId.startsWith('SCN_')) return 'scenarios';
  if (componentId.startsWith('MOT_')) return 'motions';
  if (componentId.startsWith('CHR_')) return 'characters';
  if (componentId.startsWith('AUD_')) return 'audio';
  return null;
}

/**
 * Get component data by ID (looks up the correct inventory)
 * @param {string} componentId
 * @returns {Object|null}
 */
function getComponentById(componentId) {
  const type = getInventoryTypeFromId(componentId);
  if (!type) return null;

  try {
    const sheet = getInventorySheet(type);
    return findRowByColumn(sheet, 'component_id', componentId);
  } catch (e) {
    Logger.log(`Error getting component ${componentId}: ${e.message}`);
    return null;
  }
}

/**
 * Get multiple components by IDs
 * @param {Array<string>} ids - Array of component IDs
 * @returns {Object} Map of componentId → component data
 */
function getComponentsById(ids) {
  const result = {};
  const byType = {};

  // Group IDs by inventory type
  ids.forEach(id => {
    if (!id) return;
    const type = getInventoryTypeFromId(id);
    if (type) {
      if (!byType[type]) byType[type] = [];
      byType[type].push(id);
    }
  });

  // Read each inventory once
  Object.entries(byType).forEach(([type, typeIds]) => {
    try {
      const sheet = getInventorySheet(type);
      const allData = readSheetAsObjects(sheet);

      allData.forEach(row => {
        if (typeIds.includes(row.component_id)) {
          result[row.component_id] = row;
        }
      });
    } catch (e) {
      Logger.log(`Error reading ${type} inventory: ${e.message}`);
    }
  });

  return result;
}
