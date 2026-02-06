/**
 * Linker - Match platform videos to video_uid
 */

/**
 * Link normalized metrics to video_uid
 * @param {Array<Object>} normalized - Normalized metrics
 * @param {string} platform - Platform name
 * @returns {Object} { linked: Array, unlinked: Array }
 */
function linkVideos(normalized, platform) {
  const masterData = getMasterData();
  const linked = [];
  const unlinked = [];

  normalized.forEach(metric => {
    const videoUid = findVideoUid(metric, platform, masterData);

    if (videoUid) {
      metric.video_uid = videoUid;
      linked.push(metric);
    } else {
      unlinked.push(metric);
    }
  });

  return { linked, unlinked };
}

/**
 * Get master data for linking
 */
function getMasterData() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.VIDEOS_MASTER);
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      return [];
    }

    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
      const record = {};
      headers.forEach((header, i) => {
        record[header] = row[i];
      });
      return record;
    });
  } catch (e) {
    Logger.log(`Error getting master data: ${e.message}`);
    return [];
  }
}

/**
 * Find video_uid for a metric
 */
function findVideoUid(metric, platform, masterData) {
  const platformIdField = {
    youtube: 'youtube_id',
    tiktok: 'tiktok_id',
    instagram: 'instagram_id'
  }[platform];

  // First try: exact platform ID match
  const exactMatch = masterData.find(master =>
    master[platformIdField] === metric.platform_id
  );

  if (exactMatch) {
    return exactMatch.video_uid;
  }

  // Second try: fuzzy title match
  if (metric.title) {
    const titleMatch = masterData.find(master =>
      fuzzyTitleMatch(master.title, metric.title)
    );

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

  // Normalize titles
  const normalize = (str) => str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();

  const n1 = normalize(title1);
  const n2 = normalize(title2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other (for truncated titles)
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Levenshtein distance check for small differences
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarity = 1 - (distance / maxLen);

  return similarity > 0.85;  // 85% similarity threshold
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + 1   // substitution
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
    const sheet = getSheet(CONFIG.SHEETS.VIDEOS_MASTER);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const videoUidCol = headers.indexOf('video_uid');
    const platformIdCol = headers.indexOf(`${platform}_id`);

    if (videoUidCol === -1 || platformIdCol === -1) return;

    for (let i = 1; i < data.length; i++) {
      if (data[i][videoUidCol] === videoUid) {
        sheet.getRange(i + 1, platformIdCol + 1).setValue(platformId);
        break;
      }
    }
  } catch (e) {
    Logger.log(`Error updating master: ${e.message}`);
  }
}

/**
 * Create a new video link in master
 */
function createVideoLink(videoUid, platformId, platform) {
  const sheet = getSheet(CONFIG.SHEETS.VIDEOS_MASTER);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const videoUidCol = headers.indexOf('video_uid');
  const platformIdCol = headers.indexOf(`${platform}_id`);

  // Check if video_uid exists
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][videoUidCol] === videoUid) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > 0) {
    // Update existing row
    sheet.getRange(rowIndex, platformIdCol + 1).setValue(platformId);
  } else {
    // Create new row
    const newRow = headers.map(h => {
      if (h === 'video_uid') return videoUid;
      if (h === `${platform}_id`) return platformId;
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
    const sheet = getSheet(CONFIG.SHEETS.UNLINKED_IMPORTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const platformIdCol = headers.indexOf('platform_id');
    const platformCol = headers.indexOf('platform');

    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][platformIdCol] === platformId && data[i][platformCol] === platform) {
        sheet.deleteRow(i + 1);
      }
    }
  } catch (e) {
    Logger.log(`Error removing from unlinked: ${e.message}`);
  }
}

/**
 * Generate new video_uid
 */
function generateVideoUid() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get current count from master
  try {
    const sheet = getSheet(CONFIG.SHEETS.VIDEOS_MASTER);
    const count = Math.max(1, sheet.getLastRow());
    return `VID_${year}${month}_${String(count).padStart(4, '0')}`;
  } catch (e) {
    const random = Math.floor(Math.random() * 10000);
    return `VID_${year}${month}_${String(random).padStart(4, '0')}`;
  }
}
