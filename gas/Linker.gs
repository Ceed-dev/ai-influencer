/**
 * Linker - Match platform videos to video_uid (v2.0)
 * Uses CONFIG.SHEETS.MASTER instead of videos_master
 */

/**
 * Link normalized metrics to video_uid
 * @param {Array<Object>} normalized - Normalized metrics
 * @param {string} platform - Platform name
 * @returns {Object} { linked: Array, unlinked: Array }
 */
function linkVideos(normalized, platform) {
  var masterData = getMasterData();
  var linked = [];
  var unlinked = [];

  normalized.forEach(function(metric) {
    var videoUid = findVideoUid(metric, platform, masterData);

    if (videoUid) {
      metric.video_uid = videoUid;
      linked.push(metric);
    } else {
      unlinked.push(metric);
    }
  });

  return { linked: linked, unlinked: unlinked };
}

/**
 * Find video_uid for a metric
 */
function findVideoUid(metric, platform, masterData) {
  var platformIdField = {
    youtube: 'youtube_id',
    tiktok: 'tiktok_id',
    instagram: 'instagram_id'
  }[platform];

  // First try: exact platform ID match
  var exactMatch = masterData.find(function(master) {
    return master[platformIdField] === metric.platform_id;
  });

  if (exactMatch) {
    return exactMatch.video_uid;
  }

  // Second try: fuzzy title match
  if (metric.title) {
    var titleMatch = masterData.find(function(master) {
      return fuzzyTitleMatch(master.title, metric.title);
    });

    if (titleMatch) {
      // Update master with platform ID for future matches
      updateMasterPlatformId(titleMatch.video_uid, platform, metric.platform_id);
      return titleMatch.video_uid;
    }
  }

  return null;
}

/**
 * Fuzzy title matching
 */
function fuzzyTitleMatch(title1, title2) {
  if (!title1 || !title2) return false;

  var normalize = function(str) {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  var n1 = normalize(title1);
  var n2 = normalize(title2);

  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  var distance = levenshteinDistance(n1, n2);
  var maxLen = Math.max(n1.length, n2.length);
  var similarity = 1 - (distance / maxLen);

  return similarity > 0.85;
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1, str2) {
  var m = str1.length;
  var n = str2.length;
  var dp = Array(m + 1).fill(null).map(function() { return Array(n + 1).fill(0); });

  for (var i = 0; i <= m; i++) dp[i][0] = i;
  for (var j = 0; j <= n; j++) dp[0][j] = j;

  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Update master record with platform ID
 */
function updateMasterPlatformId(videoUid, platform, platformId) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.MASTER);
    var row = findRowByColumn(sheet, 'video_uid', videoUid);
    if (row) {
      var updates = {};
      updates[platform + '_id'] = platformId;
      updateRowByIndex(sheet, row._rowIndex, updates);
    }
  } catch (e) {
    Logger.log('Error updating master: ' + e.message);
  }
}

/**
 * Create a new video link in master
 */
function createVideoLink(videoUid, platformId, platform) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  var row = findRowByColumn(sheet, 'video_uid', videoUid);

  if (row) {
    // Update existing row
    var updates = {};
    updates[platform + '_id'] = platformId;
    updateRowByIndex(sheet, row._rowIndex, updates);
  } else {
    // Create new row
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = headers.map(function(h) {
      if (h === 'video_uid') return videoUid;
      if (h === platform + '_id') return platformId;
      if (h === 'status') return 'draft';
      if (h === 'created_date') return nowJapan();
      if (h === 'human_approved') return false;
      return '';
    });
    sheet.appendRow(newRow);
  }

  // Move from unlinked to linked
  removeFromUnlinked(platformId, platform);
}

/**
 * Remove entry from unlinked imports
 */
function removeFromUnlinked(platformId, platform) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.UNLINKED_IMPORTS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var platformIdCol = headers.indexOf('platform_id');
    var platformCol = headers.indexOf('platform');

    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][platformIdCol] === platformId && data[i][platformCol] === platform) {
        sheet.deleteRow(i + 1);
      }
    }
  } catch (e) {
    Logger.log('Error removing from unlinked: ' + e.message);
  }
}

/**
 * Update metrics snapshot on master after import
 * Takes the latest metrics and updates the master snapshot columns
 * @param {string} videoUid
 * @param {string} platform
 * @param {Object} metrics - Latest platform metrics
 */
function updateMasterMetricsSnapshot(videoUid, platform, metrics) {
  var snapshotMap = {
    youtube: {
      views: 'yt_views',
      engagement_rate: 'yt_engagement',
      completion_rate: 'yt_completion'
    },
    tiktok: {
      views: 'tt_views',
      engagement_rate: 'tt_engagement',
      completion_rate: 'tt_completion'
    },
    instagram: {
      views: 'ig_views',
      engagement_rate: 'ig_engagement',
      reach: 'ig_reach'
    }
  };

  var mapping = snapshotMap[platform];
  if (!mapping) return;

  var updates = {};
  Object.keys(mapping).forEach(function(metricKey) {
    if (metrics[metricKey] !== undefined) {
      updates[mapping[metricKey]] = metrics[metricKey];
    }
  });

  if (Object.keys(updates).length > 0) {
    try {
      var sheet = getSheet(CONFIG.SHEETS.MASTER);
      var row = findRowByColumn(sheet, 'video_uid', videoUid);
      if (row) {
        updateRowByIndex(sheet, row._rowIndex, updates);
      }
    } catch (e) {
      Logger.log('Error updating master metrics snapshot: ' + e.message);
    }
  }
}
