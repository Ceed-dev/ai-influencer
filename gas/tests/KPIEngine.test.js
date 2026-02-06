/**
 * KPIEngine Unit Tests
 *
 * Tests for KPI comparison and analysis functions.
 * Run with Jest: npm test
 */

// Mock GAS globals
const mockSheet = {
  getDataRange: jest.fn(),
};

const mockSheetData = {
  getValues: jest.fn(),
};

global.getSheet = jest.fn(() => mockSheet);

global.Logger = {
  log: jest.fn(),
};

global.CONFIG = {
  SHEETS: {
    KPI_TARGETS: 'kpi_targets',
    METRICS_YOUTUBE: 'metrics_youtube',
    METRICS_TIKTOK: 'metrics_tiktok',
    METRICS_INSTAGRAM: 'metrics_instagram',
  },
  KPI_DEFAULTS: {
    youtube: {
      completion_rate: 0.50,
      ctr: 0.05,
      engagement_rate: 0.03,
    },
    tiktok: {
      completion_rate: 0.40,
      engagement_rate: 0.08,
      avg_watch_time: 10,
    },
    instagram: {
      reach_rate: 0.30,
      avg_watch_time: 15,
      engagement_rate: 0.05,
    },
  },
};

// Import functions (simulating GAS module loading)
// In actual clasp setup, these would be loaded differently
const {
  getKPITargets,
  compareKPIs,
  comparePlatformKPIs,
  calculatePriority,
  getMetricsBundle,
  generateKPISummary,
} = (() => {
  // Re-implement functions for testing (GAS doesn't export modules)
  // These mirror the implementations in KPIEngine.gs

  function getKPITargets() {
    try {
      const sheet = getSheet(CONFIG.SHEETS.KPI_TARGETS);
      const data = sheet.getDataRange().getValues();

      if (data.length < 2) {
        return CONFIG.KPI_DEFAULTS;
      }

      const headers = data[0];
      const targets = {};

      for (let i = 1; i < data.length; i++) {
        const platform = data[i][headers.indexOf('platform')];
        const metric = data[i][headers.indexOf('metric')];
        const value = data[i][headers.indexOf('target_value')];

        if (!targets[platform]) {
          targets[platform] = {};
        }
        targets[platform][metric] = value;
      }

      Object.keys(CONFIG.KPI_DEFAULTS).forEach((platform) => {
        if (!targets[platform]) {
          targets[platform] = CONFIG.KPI_DEFAULTS[platform];
        } else {
          Object.keys(CONFIG.KPI_DEFAULTS[platform]).forEach((metric) => {
            if (targets[platform][metric] === undefined) {
              targets[platform][metric] = CONFIG.KPI_DEFAULTS[platform][metric];
            }
          });
        }
      });

      return targets;
    } catch (e) {
      Logger.log(`Error getting KPI targets: ${e.message}`);
      return CONFIG.KPI_DEFAULTS;
    }
  }

  function comparePlatformKPIs(metrics, targets) {
    const result = {
      score: 0,
      above_target: [],
      below_target: [],
      at_target: [],
      details: {},
    };

    let metricCount = 0;
    let achievedCount = 0;

    Object.entries(targets).forEach(([metric, target]) => {
      const actual = metrics[metric];

      if (actual === null || actual === undefined) {
        result.details[metric] = { status: 'no_data', target };
        return;
      }

      metricCount++;
      const ratio = actual / target;
      const gap = actual - target;
      const percentGap = ((actual - target) / target) * 100;

      const detail = {
        actual,
        target,
        ratio,
        gap,
        percent_gap: percentGap,
      };

      if (ratio >= 1) {
        achievedCount++;
        detail.status = 'above';
        result.above_target.push({ metric, ...detail });
      } else if (ratio >= 0.95) {
        achievedCount += 0.5;
        detail.status = 'at';
        result.at_target.push({ metric, ...detail });
      } else {
        detail.status = 'below';
        result.below_target.push({ metric, ...detail });
      }

      result.details[metric] = detail;
    });

    result.score = metricCount > 0 ? (achievedCount / metricCount) * 100 : 0;

    return result;
  }

  function calculatePriority(gap) {
    const absGap = Math.abs(gap);
    return Math.min(100, absGap * 100);
  }

  function compareKPIs(metricsBundle, kpiTargets) {
    const results = [];

    Object.entries(metricsBundle).forEach(([videoUid, platforms]) => {
      const videoResult = {
        video_uid: videoUid,
        platforms: {},
        overall_score: 0,
        improvement_areas: [],
      };

      let totalScore = 0;
      let platformCount = 0;

      Object.entries(platforms).forEach(([platform, metrics]) => {
        const targets = kpiTargets[platform] || {};
        const comparison = comparePlatformKPIs(metrics, targets);

        videoResult.platforms[platform] = comparison;
        totalScore += comparison.score;
        platformCount++;

        comparison.below_target.forEach((item) => {
          videoResult.improvement_areas.push({
            platform,
            metric: item.metric,
            gap: item.gap,
            priority: calculatePriority(item.gap),
          });
        });
      });

      videoResult.overall_score = platformCount > 0 ? totalScore / platformCount : 0;
      videoResult.improvement_areas.sort((a, b) => b.priority - a.priority);

      results.push(videoResult);
    });

    results.sort((a, b) => a.overall_score - b.overall_score);

    return results;
  }

  function getMetricsBundle(videoUids) {
    const bundle = {};

    videoUids.forEach((uid) => {
      bundle[uid] = {};
    });

    ['youtube', 'tiktok', 'instagram'].forEach((platform) => {
      try {
        const sheetName = CONFIG.SHEETS[`METRICS_${platform.toUpperCase()}`];
        const sheet = getSheet(sheetName);
        const data = sheet.getDataRange().getValues();

        if (data.length < 2) return;

        const headers = data[0];
        const videoUidCol = headers.indexOf('video_uid');

        for (let i = 1; i < data.length; i++) {
          const uid = data[i][videoUidCol];
          if (videoUids.includes(uid)) {
            if (!bundle[uid]) bundle[uid] = {};

            bundle[uid][platform] = {};
            headers.forEach((header, j) => {
              if (header !== 'video_uid' && header !== 'import_date') {
                bundle[uid][platform][header] = data[i][j];
              }
            });
          }
        }
      } catch (e) {
        Logger.log(`Error getting ${platform} metrics: ${e.message}`);
      }
    });

    return bundle;
  }

  function generateKPISummary(kpiResult) {
    const lines = [];

    lines.push(`Video: ${kpiResult.video_uid}`);
    lines.push(`Overall Score: ${kpiResult.overall_score.toFixed(1)}%`);
    lines.push('');

    Object.entries(kpiResult.platforms).forEach(([platform, comparison]) => {
      lines.push(`[${platform.toUpperCase()}]`);
      lines.push(`Score: ${comparison.score.toFixed(1)}%`);

      if (comparison.above_target.length > 0) {
        lines.push('✓ Above target: ' + comparison.above_target.map((m) => m.metric).join(', '));
      }

      if (comparison.below_target.length > 0) {
        lines.push(
          '✗ Below target: ' +
            comparison.below_target.map((m) => `${m.metric} (${m.percent_gap.toFixed(1)}%)`).join(', ')
        );
      }

      lines.push('');
    });

    if (kpiResult.improvement_areas.length > 0) {
      lines.push('Priority Improvements:');
      kpiResult.improvement_areas.slice(0, 5).forEach((area, i) => {
        lines.push(`${i + 1}. [${area.platform}] ${area.metric}`);
      });
    }

    return lines.join('\n');
  }

  return {
    getKPITargets,
    compareKPIs,
    comparePlatformKPIs,
    calculatePriority,
    getMetricsBundle,
    generateKPISummary,
  };
})();

// ============================================================
// Test Suites
// ============================================================

describe('KPIEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSheet.getDataRange.mockReturnValue(mockSheetData);
  });

  // ============================================================
  // getKPITargets Tests
  // ============================================================
  describe('getKPITargets', () => {
    test('should return defaults when sheet has no data rows', () => {
      mockSheetData.getValues.mockReturnValue([['platform', 'metric', 'target_value']]);

      const result = getKPITargets();

      expect(result).toEqual(CONFIG.KPI_DEFAULTS);
    });

    test('should parse KPI targets from sheet', () => {
      mockSheetData.getValues.mockReturnValue([
        ['platform', 'metric', 'target_value'],
        ['youtube', 'completion_rate', 0.60],
        ['youtube', 'ctr', 0.08],
      ]);

      const result = getKPITargets();

      expect(result.youtube.completion_rate).toBe(0.60);
      expect(result.youtube.ctr).toBe(0.08);
      // Should merge with defaults for missing metrics
      expect(result.youtube.engagement_rate).toBe(0.03);
    });

    test('should merge sheet data with defaults for missing platforms', () => {
      mockSheetData.getValues.mockReturnValue([
        ['platform', 'metric', 'target_value'],
        ['youtube', 'completion_rate', 0.55],
      ]);

      const result = getKPITargets();

      // YouTube partially from sheet
      expect(result.youtube.completion_rate).toBe(0.55);
      expect(result.youtube.ctr).toBe(0.05); // Default

      // TikTok and Instagram entirely from defaults
      expect(result.tiktok).toEqual(CONFIG.KPI_DEFAULTS.tiktok);
      expect(result.instagram).toEqual(CONFIG.KPI_DEFAULTS.instagram);
    });

    test('should return defaults on sheet error', () => {
      global.getSheet.mockImplementation(() => {
        throw new Error('Sheet not found');
      });

      const result = getKPITargets();

      expect(result).toEqual(CONFIG.KPI_DEFAULTS);
      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Error getting KPI targets'));
    });
  });

  // ============================================================
  // comparePlatformKPIs Tests
  // ============================================================
  describe('comparePlatformKPIs', () => {
    test('should classify metrics above target (ratio >= 1)', () => {
      const metrics = { completion_rate: 0.55, ctr: 0.06 };
      const targets = { completion_rate: 0.50, ctr: 0.05 };

      const result = comparePlatformKPIs(metrics, targets);

      expect(result.above_target).toHaveLength(2);
      expect(result.below_target).toHaveLength(0);
      expect(result.at_target).toHaveLength(0);
      expect(result.score).toBe(100);
    });

    test('should classify metrics at target (ratio >= 0.95 and < 1)', () => {
      const metrics = { completion_rate: 0.48 }; // 96% of 0.50
      const targets = { completion_rate: 0.50 };

      const result = comparePlatformKPIs(metrics, targets);

      expect(result.at_target).toHaveLength(1);
      expect(result.at_target[0].metric).toBe('completion_rate');
      expect(result.at_target[0].status).toBe('at');
      expect(result.score).toBe(50); // 0.5 achievedCount / 1 metricCount * 100
    });

    test('should classify metrics below target (ratio < 0.95)', () => {
      const metrics = { completion_rate: 0.30 }; // 60% of 0.50
      const targets = { completion_rate: 0.50 };

      const result = comparePlatformKPIs(metrics, targets);

      expect(result.below_target).toHaveLength(1);
      expect(result.below_target[0].metric).toBe('completion_rate');
      expect(result.below_target[0].gap).toBe(-0.20);
      expect(result.below_target[0].percent_gap).toBe(-40);
      expect(result.score).toBe(0);
    });

    test('should handle null/undefined metrics as no_data', () => {
      const metrics = { completion_rate: null, ctr: undefined };
      const targets = { completion_rate: 0.50, ctr: 0.05, engagement_rate: 0.03 };

      const result = comparePlatformKPIs(metrics, targets);

      expect(result.details.completion_rate.status).toBe('no_data');
      expect(result.details.ctr.status).toBe('no_data');
      expect(result.score).toBe(0); // No valid metrics
    });

    test('should calculate correct score with mixed results', () => {
      const metrics = {
        completion_rate: 0.60, // above (1 point)
        ctr: 0.048, // at (0.5 points)
        engagement_rate: 0.02, // below (0 points)
      };
      const targets = {
        completion_rate: 0.50,
        ctr: 0.05,
        engagement_rate: 0.03,
      };

      const result = comparePlatformKPIs(metrics, targets);

      expect(result.above_target).toHaveLength(1);
      expect(result.at_target).toHaveLength(1);
      expect(result.below_target).toHaveLength(1);
      // Score: (1 + 0.5 + 0) / 3 * 100 = 50
      expect(result.score).toBe(50);
    });

    test('should return zero score for empty targets', () => {
      const metrics = { completion_rate: 0.55 };
      const targets = {};

      const result = comparePlatformKPIs(metrics, targets);

      expect(result.score).toBe(0);
      expect(result.above_target).toHaveLength(0);
    });
  });

  // ============================================================
  // calculatePriority Tests
  // ============================================================
  describe('calculatePriority', () => {
    test('should calculate priority from negative gap', () => {
      expect(calculatePriority(-0.20)).toBe(20);
      expect(calculatePriority(-0.50)).toBe(50);
    });

    test('should calculate priority from positive gap', () => {
      expect(calculatePriority(0.30)).toBe(30);
    });

    test('should cap priority at 100', () => {
      expect(calculatePriority(-1.5)).toBe(100);
      expect(calculatePriority(2.0)).toBe(100);
    });

    test('should return 0 for zero gap', () => {
      expect(calculatePriority(0)).toBe(0);
    });
  });

  // ============================================================
  // compareKPIs Tests
  // ============================================================
  describe('compareKPIs', () => {
    const kpiTargets = {
      youtube: { completion_rate: 0.50, ctr: 0.05 },
      tiktok: { completion_rate: 0.40, engagement_rate: 0.08 },
    };

    test('should compare multiple videos across platforms', () => {
      const metricsBundle = {
        video_001: {
          youtube: { completion_rate: 0.55, ctr: 0.06 },
          tiktok: { completion_rate: 0.45, engagement_rate: 0.10 },
        },
        video_002: {
          youtube: { completion_rate: 0.30, ctr: 0.03 },
        },
      };

      const results = compareKPIs(metricsBundle, kpiTargets);

      expect(results).toHaveLength(2);
      // Results should be sorted by overall_score (lowest first)
      expect(results[0].video_uid).toBe('video_002'); // Lower score
      expect(results[1].video_uid).toBe('video_001'); // Higher score
    });

    test('should collect improvement areas from below_target metrics', () => {
      const metricsBundle = {
        video_001: {
          youtube: { completion_rate: 0.30, ctr: 0.03 }, // Both below
        },
      };

      const results = compareKPIs(metricsBundle, kpiTargets);

      expect(results[0].improvement_areas).toHaveLength(2);
      expect(results[0].improvement_areas[0].platform).toBe('youtube');
    });

    test('should sort improvement areas by priority (descending)', () => {
      const metricsBundle = {
        video_001: {
          youtube: { completion_rate: 0.40, ctr: 0.02 }, // ctr has larger gap
        },
      };

      const results = compareKPIs(metricsBundle, kpiTargets);
      const areas = results[0].improvement_areas;

      // ctr gap: 0.02 - 0.05 = -0.03, priority = 3
      // completion_rate gap: 0.40 - 0.50 = -0.10, priority = 10
      // So completion_rate should come first
      expect(areas[0].metric).toBe('completion_rate');
      expect(areas[1].metric).toBe('ctr');
    });

    test('should handle empty platforms gracefully', () => {
      const metricsBundle = {
        video_001: {},
      };

      const results = compareKPIs(metricsBundle, kpiTargets);

      expect(results[0].overall_score).toBe(0);
      expect(results[0].platforms).toEqual({});
    });

    test('should handle missing platform targets', () => {
      const metricsBundle = {
        video_001: {
          instagram: { reach_rate: 0.35, engagement_rate: 0.06 },
        },
      };

      const results = compareKPIs(metricsBundle, { youtube: { ctr: 0.05 } });

      // Instagram not in targets, so empty targets used
      expect(results[0].platforms.instagram.score).toBe(0);
    });
  });

  // ============================================================
  // getMetricsBundle Tests
  // ============================================================
  describe('getMetricsBundle', () => {
    test('should fetch metrics from multiple platform sheets', () => {
      const mockYouTubeData = [
        ['video_uid', 'completion_rate', 'ctr', 'import_date'],
        ['video_001', 0.55, 0.06, '2026-02-01'],
        ['video_002', 0.45, 0.04, '2026-02-01'],
      ];

      const mockTikTokData = [
        ['video_uid', 'completion_rate', 'engagement_rate'],
        ['video_001', 0.42, 0.09],
      ];

      const mockInstagramData = [['video_uid', 'reach_rate']]; // No data rows

      let callCount = 0;
      mockSheetData.getValues.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return mockYouTubeData;
        if (callCount === 2) return mockTikTokData;
        return mockInstagramData;
      });

      const result = getMetricsBundle(['video_001', 'video_002']);

      expect(result.video_001.youtube.completion_rate).toBe(0.55);
      expect(result.video_001.youtube.ctr).toBe(0.06);
      expect(result.video_001.youtube.import_date).toBeUndefined(); // Excluded
      expect(result.video_001.tiktok.completion_rate).toBe(0.42);
      expect(result.video_002.youtube.completion_rate).toBe(0.45);
    });

    test('should initialize empty bundle for requested video uids', () => {
      mockSheetData.getValues.mockReturnValue([['video_uid']]);

      const result = getMetricsBundle(['video_001', 'video_002']);

      expect(result.video_001).toEqual({});
      expect(result.video_002).toEqual({});
    });

    test('should handle sheet errors gracefully', () => {
      global.getSheet.mockImplementation(() => {
        throw new Error('Sheet access error');
      });

      const result = getMetricsBundle(['video_001']);

      expect(result.video_001).toEqual({});
      expect(Logger.log).toHaveBeenCalled();
    });
  });

  // ============================================================
  // generateKPISummary Tests
  // ============================================================
  describe('generateKPISummary', () => {
    test('should generate formatted summary string', () => {
      const kpiResult = {
        video_uid: 'video_001',
        overall_score: 75.5,
        platforms: {
          youtube: {
            score: 100,
            above_target: [{ metric: 'completion_rate' }, { metric: 'ctr' }],
            below_target: [],
            at_target: [],
          },
          tiktok: {
            score: 50,
            above_target: [{ metric: 'engagement_rate' }],
            below_target: [{ metric: 'completion_rate', percent_gap: -15.5 }],
            at_target: [],
          },
        },
        improvement_areas: [{ platform: 'tiktok', metric: 'completion_rate', priority: 15 }],
      };

      const summary = generateKPISummary(kpiResult);

      expect(summary).toContain('Video: video_001');
      expect(summary).toContain('Overall Score: 75.5%');
      expect(summary).toContain('[YOUTUBE]');
      expect(summary).toContain('Score: 100.0%');
      expect(summary).toContain('✓ Above target: completion_rate, ctr');
      expect(summary).toContain('[TIKTOK]');
      expect(summary).toContain('✗ Below target: completion_rate (-15.5%)');
      expect(summary).toContain('Priority Improvements:');
      expect(summary).toContain('1. [tiktok] completion_rate');
    });

    test('should handle video with no improvement areas', () => {
      const kpiResult = {
        video_uid: 'perfect_video',
        overall_score: 100,
        platforms: {
          youtube: {
            score: 100,
            above_target: [{ metric: 'ctr' }],
            below_target: [],
            at_target: [],
          },
        },
        improvement_areas: [],
      };

      const summary = generateKPISummary(kpiResult);

      expect(summary).toContain('Video: perfect_video');
      expect(summary).toContain('Overall Score: 100.0%');
      expect(summary).not.toContain('Priority Improvements:');
    });

    test('should limit priority improvements to 5 items', () => {
      const kpiResult = {
        video_uid: 'video_001',
        overall_score: 20,
        platforms: {},
        improvement_areas: [
          { platform: 'youtube', metric: 'metric1' },
          { platform: 'youtube', metric: 'metric2' },
          { platform: 'youtube', metric: 'metric3' },
          { platform: 'youtube', metric: 'metric4' },
          { platform: 'youtube', metric: 'metric5' },
          { platform: 'youtube', metric: 'metric6' }, // Should be excluded
          { platform: 'youtube', metric: 'metric7' }, // Should be excluded
        ],
      };

      const summary = generateKPISummary(kpiResult);

      expect(summary).toContain('1. [youtube] metric1');
      expect(summary).toContain('5. [youtube] metric5');
      expect(summary).not.toContain('6. [youtube] metric6');
    });
  });
});
