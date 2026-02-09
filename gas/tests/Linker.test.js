/**
 * Linker.test.js - Unit tests for Linker.gs
 *
 * Tests video linking functionality including:
 * - Exact platform ID matching
 * - Fuzzy title matching
 * - Levenshtein distance calculation
 * - Unlinked video handling
 * - video_uid generation
 */

// Import functions from Linker.gs (simulated for Jest)
// In actual GAS, these are global functions

// Recreate functions for testing (copy from Linker.gs)
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
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

function fuzzyTitleMatch(title1, title2) {
  if (!title1 || !title2) return false;

  const normalize = (str) => str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const n1 = normalize(title1);
  const n2 = normalize(title2);

  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarity = 1 - (distance / maxLen);

  return similarity > 0.85;
}

function findVideoUid(metric, platform, masterData) {
  const platformIdField = {
    youtube: 'youtube_id',
    tiktok: 'tiktok_id',
    instagram: 'instagram_id'
  }[platform];

  const exactMatch = masterData.find(master =>
    master[platformIdField] === metric.platform_id
  );

  if (exactMatch) {
    return exactMatch.video_uid;
  }

  if (metric.title) {
    const titleMatch = masterData.find(master =>
      fuzzyTitleMatch(master.title, metric.title)
    );

    if (titleMatch) {
      return titleMatch.video_uid;
    }
  }

  return null;
}

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

function getMasterData() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.MASTER);
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
// Test Suites
// ============================================================

describe('Linker', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ----------------------------------------------------------
  // levenshteinDistance Tests
  // ----------------------------------------------------------
  describe('levenshteinDistance', () => {
    test('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    test('returns length of string when comparing with empty string', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'world')).toBe(5);
    });

    test('returns 0 for two empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
    });

    test('calculates distance for single character difference', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
      expect(levenshteinDistance('cat', 'car')).toBe(1);
    });

    test('calculates distance for insertion', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
    });

    test('calculates distance for deletion', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
    });

    test('calculates distance for multiple operations', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });

    test('handles unicode characters', () => {
      expect(levenshteinDistance('cafe', 'café')).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // fuzzyTitleMatch Tests
  // ----------------------------------------------------------
  describe('fuzzyTitleMatch', () => {
    test('returns false for null or empty titles', () => {
      expect(fuzzyTitleMatch(null, 'title')).toBe(false);
      expect(fuzzyTitleMatch('title', null)).toBe(false);
      expect(fuzzyTitleMatch('', 'title')).toBe(false);
      expect(fuzzyTitleMatch('title', '')).toBe(false);
    });

    test('matches exact titles after normalization', () => {
      expect(fuzzyTitleMatch('Hello World', 'hello world')).toBe(true);
      expect(fuzzyTitleMatch('HELLO WORLD', 'hello world')).toBe(true);
    });

    test('matches titles ignoring punctuation', () => {
      expect(fuzzyTitleMatch('Hello, World!', 'Hello World')).toBe(true);
      expect(fuzzyTitleMatch('What\'s up?', 'whats up')).toBe(true);
    });

    test('matches titles with normalized whitespace', () => {
      expect(fuzzyTitleMatch('Hello  World', 'Hello World')).toBe(true);
      expect(fuzzyTitleMatch(' Hello World ', 'Hello World')).toBe(true);
    });

    test('matches when one title contains the other (truncated titles)', () => {
      expect(fuzzyTitleMatch(
        'This is a very long video title that gets truncated',
        'This is a very long video title that gets truncated on some platforms'
      )).toBe(true);

      expect(fuzzyTitleMatch(
        'Short Title',
        'Short Title - Extended Version'
      )).toBe(true);
    });

    test('matches titles with 85% similarity threshold', () => {
      // 'hello world' (11 chars) vs 'hello worlx' (11 chars) = 1 edit = 90.9% similarity
      expect(fuzzyTitleMatch('hello world', 'hello worlx')).toBe(true);

      // 'hello world' (11 chars) vs 'hello worxx' (11 chars) = 2 edits = 81.8% similarity
      expect(fuzzyTitleMatch('hello world', 'hello worxx')).toBe(false);
    });

    test('does not match completely different titles', () => {
      expect(fuzzyTitleMatch('Hello World', 'Goodbye Universe')).toBe(false);
      expect(fuzzyTitleMatch('Video Tutorial Part 1', 'Recipe for Cake')).toBe(false);
    });

    test('handles Japanese titles', () => {
      expect(fuzzyTitleMatch('こんにちは世界', 'こんにちは世界')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // findVideoUid Tests
  // ----------------------------------------------------------
  describe('findVideoUid', () => {
    const masterData = [
      {
        video_uid: 'VID_202601_0001',
        title: 'My First Video',
        youtube_id: 'yt_abc123',
        tiktok_id: 'tt_xyz789',
        instagram_id: null
      },
      {
        video_uid: 'VID_202601_0002',
        title: 'Tutorial: How to Code',
        youtube_id: 'yt_def456',
        tiktok_id: null,
        instagram_id: 'ig_qwe321'
      }
    ];

    test('finds video by exact YouTube ID match', () => {
      const metric = { platform_id: 'yt_abc123', title: 'Some Title' };
      expect(findVideoUid(metric, 'youtube', masterData)).toBe('VID_202601_0001');
    });

    test('finds video by exact TikTok ID match', () => {
      const metric = { platform_id: 'tt_xyz789', title: 'Some Title' };
      expect(findVideoUid(metric, 'tiktok', masterData)).toBe('VID_202601_0001');
    });

    test('finds video by exact Instagram ID match', () => {
      const metric = { platform_id: 'ig_qwe321', title: 'Some Title' };
      expect(findVideoUid(metric, 'instagram', masterData)).toBe('VID_202601_0002');
    });

    test('returns null when platform ID not found and no title match', () => {
      const metric = { platform_id: 'yt_unknown', title: 'Completely Different Title' };
      expect(findVideoUid(metric, 'youtube', masterData)).toBeNull();
    });

    test('falls back to fuzzy title match when platform ID not found', () => {
      const metric = { platform_id: 'yt_new123', title: 'my first video' };
      expect(findVideoUid(metric, 'youtube', masterData)).toBe('VID_202601_0001');
    });

    test('matches truncated titles when platform ID not found', () => {
      const metric = { platform_id: 'ig_new', title: 'Tutorial: How to Code - Part 1' };
      expect(findVideoUid(metric, 'instagram', masterData)).toBe('VID_202601_0002');
    });

    test('returns null for metric without title and unknown platform ID', () => {
      const metric = { platform_id: 'yt_unknown' };
      expect(findVideoUid(metric, 'youtube', masterData)).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // linkVideos Tests
  // ----------------------------------------------------------
  describe('linkVideos', () => {
    beforeEach(() => {
      const mockData = [
        ['video_uid', 'title', 'youtube_id', 'tiktok_id', 'instagram_id'],
        ['VID_202601_0001', 'Intro to Programming', 'yt_001', 'tt_001', 'ig_001'],
        ['VID_202601_0002', 'Advanced Tips', 'yt_002', null, null]
      ];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockData);
    });

    test('links videos with exact platform ID match', () => {
      const normalized = [
        { platform_id: 'yt_001', title: 'Some Video', views: 1000 },
        { platform_id: 'yt_002', title: 'Another Video', views: 2000 }
      ];

      const result = linkVideos(normalized, 'youtube');

      expect(result.linked).toHaveLength(2);
      expect(result.unlinked).toHaveLength(0);
      expect(result.linked[0].video_uid).toBe('VID_202601_0001');
      expect(result.linked[1].video_uid).toBe('VID_202601_0002');
    });

    test('separates unlinked videos', () => {
      const normalized = [
        { platform_id: 'yt_001', title: 'Known Video', views: 1000 },
        { platform_id: 'yt_unknown', title: 'Unknown Video', views: 500 }
      ];

      const result = linkVideos(normalized, 'youtube');

      expect(result.linked).toHaveLength(1);
      expect(result.unlinked).toHaveLength(1);
      expect(result.linked[0].video_uid).toBe('VID_202601_0001');
      expect(result.unlinked[0].platform_id).toBe('yt_unknown');
    });

    test('handles empty input', () => {
      const result = linkVideos([], 'youtube');

      expect(result.linked).toHaveLength(0);
      expect(result.unlinked).toHaveLength(0);
    });

    test('links videos via fuzzy title match', () => {
      const normalized = [
        { platform_id: 'yt_new', title: 'Intro to Programming', views: 1000 }
      ];

      const result = linkVideos(normalized, 'youtube');

      expect(result.linked).toHaveLength(1);
      expect(result.linked[0].video_uid).toBe('VID_202601_0001');
    });

    test('preserves original metric properties after linking', () => {
      const normalized = [
        { platform_id: 'yt_001', title: 'Test', views: 1000, likes: 50, engagement: 0.05 }
      ];

      const result = linkVideos(normalized, 'youtube');

      expect(result.linked[0].views).toBe(1000);
      expect(result.linked[0].likes).toBe(50);
      expect(result.linked[0].engagement).toBe(0.05);
      expect(result.linked[0].video_uid).toBe('VID_202601_0001');
    });
  });

  // ----------------------------------------------------------
  // getMasterData Tests
  // ----------------------------------------------------------
  describe('getMasterData', () => {
    test('returns empty array when sheet has only headers', () => {
      const mockData = [
        ['video_uid', 'title', 'youtube_id']
      ];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockData);

      const result = getMasterData();
      expect(result).toEqual([]);
    });

    test('returns empty array when sheet is empty', () => {
      global.mockSheets[CONFIG.SHEETS.VIDEOS_MASTER] = createMockSheet([]);

      const result = getMasterData();
      expect(result).toEqual([]);
    });

    test('converts sheet data to array of objects', () => {
      const mockData = [
        ['video_uid', 'title', 'youtube_id'],
        ['VID_001', 'Video 1', 'yt_001'],
        ['VID_002', 'Video 2', 'yt_002']
      ];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockData);

      const result = getMasterData();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        video_uid: 'VID_001',
        title: 'Video 1',
        youtube_id: 'yt_001'
      });
      expect(result[1]).toEqual({
        video_uid: 'VID_002',
        title: 'Video 2',
        youtube_id: 'yt_002'
      });
    });

    test('returns empty array and logs error when sheet not found', () => {
      // No mock sheet set up

      const result = getMasterData();

      expect(result).toEqual([]);
      expect(Logger.log).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // generateVideoUid Tests
  // ----------------------------------------------------------
  describe('generateVideoUid', () => {
    test('generates UID in correct format', () => {
      const mockData = [
        ['video_uid'],
        ['VID_001'],
        ['VID_002'],
        ['VID_003']
      ];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockData);

      const uid = generateVideoUid();

      expect(uid).toMatch(/^VID_\d{6}_\d{4}$/);
    });

    test('uses current year and month', () => {
      const mockData = [['video_uid'], ['VID_001']];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockData);

      const uid = generateVideoUid();
      const now = new Date();
      const expectedPrefix = `VID_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      expect(uid.startsWith(expectedPrefix)).toBe(true);
    });

    test('pads count with zeros', () => {
      const mockData = [['video_uid'], ['VID_001']];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockData);

      const uid = generateVideoUid();

      expect(uid).toMatch(/_0002$/);
    });

    test('generates random UID when sheet access fails', () => {
      // No mock sheet - will throw error

      const uid = generateVideoUid();

      expect(uid).toMatch(/^VID_\d{6}_\d{4}$/);
    });

    test('generates unique UIDs based on row count', () => {
      const mockData = [
        ['video_uid'],
        ['VID_001'],
        ['VID_002'],
        ['VID_003'],
        ['VID_004'],
        ['VID_005']
      ];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockData);

      const uid = generateVideoUid();

      expect(uid).toMatch(/_0006$/);
    });
  });

  // ----------------------------------------------------------
  // Integration-style Tests
  // ----------------------------------------------------------
  describe('Integration scenarios', () => {
    beforeEach(() => {
      const mockMasterData = [
        ['video_uid', 'title', 'youtube_id', 'tiktok_id', 'instagram_id'],
        ['VID_202601_0001', 'Cooking Tutorial: Easy Pasta', 'yt_pasta', null, null],
        ['VID_202601_0002', 'Workout Routine for Beginners', null, 'tt_workout', 'ig_workout'],
        ['VID_202601_0003', 'Travel Vlog: Tokyo Day 1', 'yt_tokyo', 'tt_tokyo', null]
      ];
      global.mockSheets[CONFIG.SHEETS.MASTER] = createMockSheet(mockMasterData);
    });

    test('links cross-platform videos correctly', () => {
      const youtubeMetrics = [
        { platform_id: 'yt_pasta', title: 'Cooking Tutorial: Easy Pasta', views: 10000 }
      ];
      const tiktokMetrics = [
        { platform_id: 'tt_workout', title: 'Workout for Beginners', views: 50000 }
      ];

      const ytResult = linkVideos(youtubeMetrics, 'youtube');
      const ttResult = linkVideos(tiktokMetrics, 'tiktok');

      expect(ytResult.linked[0].video_uid).toBe('VID_202601_0001');
      expect(ttResult.linked[0].video_uid).toBe('VID_202601_0002');
    });

    test('handles mixed linked and unlinked videos', () => {
      const metrics = [
        { platform_id: 'yt_pasta', title: 'Known', views: 1000 },
        { platform_id: 'yt_unknown1', title: 'Brand New Video', views: 500 },
        { platform_id: 'yt_tokyo', title: 'Tokyo Vlog', views: 2000 },
        { platform_id: 'yt_unknown2', title: 'Another New One', views: 300 }
      ];

      const result = linkVideos(metrics, 'youtube');

      expect(result.linked).toHaveLength(2);
      expect(result.unlinked).toHaveLength(2);
    });

    test('fuzzy matching handles platform-specific title variations', () => {
      const metrics = [
        { platform_id: 'yt_new', title: 'Travel Vlog Tokyo Day 1', views: 1000 }  // Missing colon
      ];

      const result = linkVideos(metrics, 'youtube');

      expect(result.linked).toHaveLength(1);
      expect(result.linked[0].video_uid).toBe('VID_202601_0003');
    });
  });
});
