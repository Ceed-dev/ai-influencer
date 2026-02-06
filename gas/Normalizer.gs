/**
 * Normalizer - Convert platform-specific metrics to unified schema
 */

/**
 * Unified metric schema
 * All platforms normalize to this structure
 */
const UNIFIED_SCHEMA = {
  // Identity
  platform_id: null,      // Platform-specific ID
  platform: null,         // youtube, tiktok, instagram
  title: null,

  // Core metrics (available on all platforms)
  views: null,
  likes: null,
  comments: null,
  shares: null,

  // Engagement metrics
  saves: null,            // TikTok, Instagram
  engagement_rate: null,  // Calculated if not provided

  // Watch metrics
  avg_watch_time_sec: null,
  completion_rate: null,

  // Platform-specific (preserved but normalized)
  watch_time_hours: null, // YouTube only
  ctr: null,              // YouTube only
  subscribers_gained: null, // YouTube only
  reach: null,            // Instagram only

  // Metadata
  import_date: null,
  raw_csv_row: null
};

/**
 * Normalize parsed metrics to unified schema
 * @param {Array<Object>} parsed - Parsed CSV data
 * @param {string} platform - Platform name
 * @returns {Array<Object>} Normalized metrics
 */
function normalizeMetrics(parsed, platform) {
  const normalizers = {
    youtube: normalizeYouTube,
    tiktok: normalizeTikTok,
    instagram: normalizeInstagram
  };

  const normalizer = normalizers[platform];
  if (!normalizer) {
    throw new Error(`No normalizer for platform: ${platform}`);
  }

  return parsed.map(row => normalizer(row));
}

/**
 * Normalize YouTube metrics
 */
function normalizeYouTube(row) {
  const normalized = createEmptyNormalized();

  normalized.platform = 'youtube';
  normalized.platform_id = row.video_id;
  normalized.title = row.title;

  // Core metrics
  normalized.views = row.views;
  normalized.likes = row.likes;
  normalized.comments = row.comments;
  normalized.shares = row.shares;

  // Watch metrics
  normalized.watch_time_hours = row.watch_time_hours;
  normalized.avg_watch_time_sec = row.avg_view_duration;

  // Calculate completion rate if we have duration data
  // YouTube provides this in different ways depending on export type
  if (row.completion_rate) {
    normalized.completion_rate = row.completion_rate;
  }

  // Platform-specific
  normalized.ctr = row.ctr;
  normalized.subscribers_gained = row.subscribers_gained;

  // Calculate engagement rate if not provided
  if (normalized.views > 0) {
    const engagements = (normalized.likes || 0) + (normalized.comments || 0) + (normalized.shares || 0);
    normalized.engagement_rate = engagements / normalized.views;
  }

  // Metadata
  normalized.import_date = new Date().toISOString();
  normalized.raw_csv_row = row._raw_row;

  return normalized;
}

/**
 * Normalize TikTok metrics
 */
function normalizeTikTok(row) {
  const normalized = createEmptyNormalized();

  normalized.platform = 'tiktok';
  normalized.platform_id = row.video_id;
  normalized.title = row.title;

  // Core metrics
  normalized.views = row.views;
  normalized.likes = row.likes;
  normalized.comments = row.comments;
  normalized.shares = row.shares;
  normalized.saves = row.saves;

  // Watch metrics
  normalized.avg_watch_time_sec = row.avg_watch_time;
  normalized.completion_rate = row.completion_rate;

  // Engagement rate (TikTok usually provides this)
  normalized.engagement_rate = row.engagement_rate;

  // Calculate if not provided
  if (!normalized.engagement_rate && normalized.views > 0) {
    const engagements = (normalized.likes || 0) + (normalized.comments || 0) +
                       (normalized.shares || 0) + (normalized.saves || 0);
    normalized.engagement_rate = engagements / normalized.views;
  }

  // Metadata
  normalized.import_date = new Date().toISOString();
  normalized.raw_csv_row = row._raw_row;

  return normalized;
}

/**
 * Normalize Instagram metrics
 */
function normalizeInstagram(row) {
  const normalized = createEmptyNormalized();

  normalized.platform = 'instagram';
  normalized.platform_id = row.reel_id;
  normalized.title = row.title;

  // Core metrics
  normalized.views = row.views;
  normalized.likes = row.likes;
  normalized.comments = row.comments;
  normalized.shares = row.shares;
  normalized.saves = row.saves;

  // Watch metrics
  normalized.avg_watch_time_sec = row.avg_watch_time;

  // Instagram-specific
  normalized.reach = row.reach;

  // Calculate engagement rate
  if (normalized.views > 0) {
    const engagements = (normalized.likes || 0) + (normalized.comments || 0) +
                       (normalized.shares || 0) + (normalized.saves || 0);
    normalized.engagement_rate = engagements / normalized.views;
  }

  // Metadata
  normalized.import_date = new Date().toISOString();
  normalized.raw_csv_row = row._raw_row;

  return normalized;
}

/**
 * Create empty normalized object with all fields
 */
function createEmptyNormalized() {
  return JSON.parse(JSON.stringify(UNIFIED_SCHEMA));
}

/**
 * Get platform-specific fields for sheet writing
 */
function getPlatformFields(platform) {
  const common = ['video_uid', 'import_date', 'views', 'likes', 'comments', 'shares', 'engagement_rate'];

  const platformSpecific = {
    youtube: [...common, 'watch_time_hours', 'avg_watch_time_sec', 'completion_rate', 'ctr', 'subscribers_gained'],
    tiktok: [...common, 'saves', 'avg_watch_time_sec', 'completion_rate'],
    instagram: [...common, 'saves', 'avg_watch_time_sec', 'reach']
  };

  return platformSpecific[platform] || common;
}

/**
 * Convert normalized metrics to sheet row
 */
function normalizedToSheetRow(normalized, platform) {
  const fields = getPlatformFields(platform);
  return fields.map(field => normalized[field] ?? '');
}
