/**
 * Utilities - Helper functions for Video Analytics Hub
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
 * Format date for sheets
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return Utilities.formatDate(d, 'GMT', 'yyyy-MM-dd HH:mm:ss');
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
    // Save state for continuation
    saveProcessingState(context);

    // Create trigger for continuation
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
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'continueProcessing') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger to run in 1 minute
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
    // Resume based on action type
    switch (state.action) {
      case 'import_csv':
        // Resume import from last processed row
        resumeImport(state);
        break;

      case 'analyze':
        // Resume analysis from last analyzed video
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
  // Implementation depends on specific needs
  Logger.log('Resuming import from row: ' + state.lastProcessedRow);
}

/**
 * Resume analysis processing
 */
function resumeAnalysis(state) {
  // Implementation depends on specific needs
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
