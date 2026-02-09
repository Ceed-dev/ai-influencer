/**
 * ComponentManager - CRUD operations for video production components
 * Manages scenarios, motions, characters, and audio across inventory spreadsheets
 */

/**
 * Add a new component to the appropriate inventory
 * @param {string} inventoryType - 'scenarios' | 'motions' | 'characters' | 'audio'
 * @param {Object} data - Component data
 * @returns {Object} Created component with generated ID
 */
function addComponent(inventoryType, data) {
  var sheet = getInventorySheet(inventoryType);
  var componentId;

  // Generate appropriate ID
  switch (inventoryType) {
    case 'scenarios':
      componentId = generateScenarioId(data.type, sheet);
      break;
    case 'motions':
      componentId = generateMotionId(sheet);
      break;
    case 'characters':
      componentId = generateCharacterId(sheet);
      break;
    case 'audio':
      componentId = generateAudioId(sheet);
      break;
    default:
      throw new Error('Unknown inventory type: ' + inventoryType);
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) {
    if (h === 'component_id') return componentId;
    if (h === 'times_used') return 0;
    if (h === 'avg_performance_score') return 0;
    if (h === 'created_date') return nowJapan();
    if (h === 'status') return data.status || 'active';
    return data[h] !== undefined ? data[h] : '';
  });

  sheet.appendRow(row);
  Logger.log('Added component: ' + componentId);

  return { component_id: componentId, inventory_type: inventoryType };
}

/**
 * Update an existing component
 * @param {string} componentId - The component ID to update
 * @param {Object} updates - Key-value pairs to update
 * @returns {boolean}
 */
function updateComponent(componentId, updates) {
  var type = getInventoryTypeFromId(componentId);
  if (!type) throw new Error('Unknown component type for ID: ' + componentId);

  var sheet = getInventorySheet(type);
  var row = findRowByColumn(sheet, 'component_id', componentId);

  if (!row) throw new Error('Component not found: ' + componentId);

  updateRowByIndex(sheet, row._rowIndex, updates);
  Logger.log('Updated component: ' + componentId);
  return true;
}

/**
 * Archive a component (set status to archived)
 * @param {string} componentId
 * @returns {boolean}
 */
function archiveComponent(componentId) {
  return updateComponent(componentId, { status: 'archived' });
}

/**
 * List all components of a given inventory type
 * @param {string} inventoryType - 'scenarios' | 'motions' | 'characters' | 'audio'
 * @param {Object} [filters] - Optional filters { type, status, tags }
 * @returns {Array<Object>}
 */
function listComponents(inventoryType, filters) {
  var sheet = getInventorySheet(inventoryType);
  var allData = readSheetAsObjects(sheet);

  if (!filters) return allData;

  return allData.filter(function(row) {
    if (filters.type && row.type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.tags) {
      var rowTags = (row.tags || '').split(',').map(function(t) { return t.trim(); });
      var filterTags = filters.tags.split(',').map(function(t) { return t.trim(); });
      var hasAnyTag = filterTags.some(function(t) { return rowTags.indexOf(t) !== -1; });
      if (!hasAnyTag) return false;
    }
    return true;
  });
}

/**
 * Get top-performing components by type
 * @param {string} inventoryType - 'scenarios' | 'motions' | 'characters' | 'audio'
 * @param {string} [componentType] - Optional sub-type filter (hook/body/cta/voice/bgm)
 * @param {number} [limit=5] - Number of top components to return
 * @returns {Array<Object>}
 */
function getTopPerformingComponents(inventoryType, componentType, limit) {
  limit = limit || 5;
  var filters = { status: 'active' };
  if (componentType) filters.type = componentType;

  var components = listComponents(inventoryType, filters);

  // Sort by avg_performance_score descending
  components.sort(function(a, b) {
    return (b.avg_performance_score || 0) - (a.avg_performance_score || 0);
  });

  return components.slice(0, limit);
}

/**
 * Build component context for a video (for LLM analysis)
 * @param {string} videoUid - The video UID
 * @returns {Object} Component context with full data
 */
function buildVideoComponentContext(videoUid) {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var videoRow = findRowByColumn(masterSheet, 'video_uid', videoUid);

  if (!videoRow) return null;

  // Collect all component IDs from the video
  var componentIds = [
    videoRow.hook_scenario_id,
    videoRow.hook_motion_id,
    videoRow.hook_audio_id,
    videoRow.body_scenario_id,
    videoRow.body_motion_id,
    videoRow.body_audio_id,
    videoRow.cta_scenario_id,
    videoRow.cta_motion_id,
    videoRow.cta_audio_id,
    videoRow.character_id
  ].filter(Boolean);

  // Batch fetch all component data
  var components = getComponentsById(componentIds);

  // Structure by role
  var context = {
    video_uid: videoUid,
    title: videoRow.title,
    hook: {
      scenario: components[videoRow.hook_scenario_id] || null,
      motion: components[videoRow.hook_motion_id] || null,
      audio: components[videoRow.hook_audio_id] || null
    },
    body: {
      scenario: components[videoRow.body_scenario_id] || null,
      motion: components[videoRow.body_motion_id] || null,
      audio: components[videoRow.body_audio_id] || null
    },
    cta: {
      scenario: components[videoRow.cta_scenario_id] || null,
      motion: components[videoRow.cta_motion_id] || null,
      audio: components[videoRow.cta_audio_id] || null
    },
    character: components[videoRow.character_id] || null
  };

  return context;
}

/**
 * Increment times_used counter for components used in a video
 * @param {string} videoUid - The video UID
 */
function incrementComponentUsage(videoUid) {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var videoRow = findRowByColumn(masterSheet, 'video_uid', videoUid);
  if (!videoRow) return;

  var componentIds = [
    videoRow.hook_scenario_id,
    videoRow.hook_motion_id,
    videoRow.hook_audio_id,
    videoRow.body_scenario_id,
    videoRow.body_motion_id,
    videoRow.body_audio_id,
    videoRow.cta_scenario_id,
    videoRow.cta_motion_id,
    videoRow.cta_audio_id,
    videoRow.character_id
  ].filter(Boolean);

  // Deduplicate (same audio might be used in hook and CTA)
  var uniqueIds = unique(componentIds);

  uniqueIds.forEach(function(id) {
    try {
      var type = getInventoryTypeFromId(id);
      if (!type) return;

      var sheet = getInventorySheet(type);
      var row = findRowByColumn(sheet, 'component_id', id);
      if (row) {
        var currentCount = row.times_used || 0;
        updateRowByIndex(sheet, row._rowIndex, { times_used: currentCount + 1 });
      }
    } catch (e) {
      Logger.log('Error incrementing usage for ' + id + ': ' + e.message);
    }
  });
}

/**
 * Get performance history for a component across all videos it was used in
 * @param {string} componentId
 * @returns {Array<Object>} Array of { video_uid, overall_score, analysis_date }
 */
function getComponentPerformanceHistory(componentId) {
  var masterSheet = getSheet(CONFIG.SHEETS.MASTER);
  var allVideos = readSheetAsObjects(masterSheet);

  // Find all columns that could contain this component ID
  var componentColumns = [].concat(
    CONFIG.MASTER_COLUMNS.HOOK,
    CONFIG.MASTER_COLUMNS.BODY,
    CONFIG.MASTER_COLUMNS.CTA,
    CONFIG.MASTER_COLUMNS.CHARACTER
  );

  var history = [];
  allVideos.forEach(function(video) {
    var usedInVideo = componentColumns.some(function(col) {
      return video[col] === componentId;
    });

    if (usedInVideo && video.overall_score) {
      history.push({
        video_uid: video.video_uid,
        title: video.title,
        overall_score: video.overall_score,
        analysis_date: video.analysis_date,
        status: video.status
      });
    }
  });

  // Sort by analysis_date descending
  history.sort(function(a, b) {
    return String(b.analysis_date).localeCompare(String(a.analysis_date));
  });

  return history;
}

/**
 * Build component recommendation context for LLM
 * Returns top-performing components for each role
 * @returns {Object}
 */
function buildRecommendationComponentPool() {
  var pool = {
    hook_scenarios: getTopPerformingComponents('scenarios', 'hook', 5),
    body_scenarios: getTopPerformingComponents('scenarios', 'body', 5),
    cta_scenarios: getTopPerformingComponents('scenarios', 'cta', 5),
    hook_motions: getTopPerformingComponents('motions', 'hook', 5),
    body_motions: getTopPerformingComponents('motions', 'body', 5),
    cta_motions: getTopPerformingComponents('motions', 'cta', 5),
    characters: getTopPerformingComponents('characters', null, 5),
    voice_audio: getTopPerformingComponents('audio', 'voice', 5),
    bgm_audio: getTopPerformingComponents('audio', 'bgm', 5)
  };

  return pool;
}
