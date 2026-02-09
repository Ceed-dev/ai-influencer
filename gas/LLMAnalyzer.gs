/**
 * LLM Analyzer - OpenAI integration for video performance analysis v2.0
 * Includes component context for comprehensive analysis and recommendations
 */

/**
 * Analyze metrics using LLM (basic, backward compatible)
 */
function analyzWithLLM(metricsBundle, kpiResults) {
  var reportId = generateReportId();
  var context = buildAnalysisContext(metricsBundle, kpiResults);

  var analysisResponse = callOpenAI(buildAnalysisPrompt(context));
  var parsedAnalysis = parseAnalysisResponse(analysisResponse);

  var recommendationsResponse = callOpenAI(buildRecommendationsPrompt(context, parsedAnalysis));
  var recommendations = parseRecommendationsResponse(recommendationsResponse);

  return {
    report_id: reportId,
    generated_at: new Date().toISOString(),
    video_count: Object.keys(metricsBundle).length,
    analysis: parsedAnalysis,
    recommendations: recommendations,
    raw_context: context
  };
}

/**
 * Build analysis context from metrics and KPI results
 */
function buildAnalysisContext(metricsBundle, kpiResults) {
  var context = {
    videos: [],
    summary: {
      total_videos: Object.keys(metricsBundle).length,
      platform_coverage: {},
      avg_scores: {}
    }
  };

  kpiResults.forEach(function(result) {
    var videoMetrics = metricsBundle[result.video_uid] || {};

    context.videos.push({
      video_uid: result.video_uid,
      overall_score: result.overall_score,
      platforms: result.platforms,
      improvement_areas: result.improvement_areas.slice(0, 3),
      metrics: videoMetrics
    });

    Object.keys(result.platforms).forEach(function(platform) {
      context.summary.platform_coverage[platform] =
        (context.summary.platform_coverage[platform] || 0) + 1;
    });
  });

  if (kpiResults.length > 0) {
    context.summary.avg_scores.overall =
      kpiResults.reduce(function(sum, r) { return sum + r.overall_score; }, 0) / kpiResults.length;
  }

  return context;
}

/**
 * Build analysis prompt
 */
function buildAnalysisPrompt(context) {
  return 'You are an AI video performance analyst. Analyze the following video metrics and provide insights.\n\n' +
    'CONTEXT:\n' + JSON.stringify(context, null, 2) + '\n\n' +
    'TASK:\nAnalyze the performance data and identify:\n' +
    '1. Overall performance trends\n2. Platform-specific patterns\n' +
    '3. Content elements that correlate with success\n4. Areas needing improvement\n\n' +
    'OUTPUT FORMAT (TSV - Tab Separated Values):\n' +
    'Return your analysis in TSV format with the following columns:\n' +
    'category\tinsight\tconfidence\timpact\n\n' +
    'Categories: trend, pattern, strength, weakness, opportunity\n' +
    'Confidence: high, medium, low\nImpact: high, medium, low\n\n' +
    'Provide 5-10 rows of analysis.';
}

/**
 * Build recommendations prompt
 */
function buildRecommendationsPrompt(context, analysis) {
  return 'You are an AI video content strategist. Based on the analysis, provide actionable recommendations.\n\n' +
    'CONTEXT:\n' + JSON.stringify(context, null, 2) + '\n\n' +
    'ANALYSIS:\n' + JSON.stringify(analysis, null, 2) + '\n\n' +
    'TASK:\nProvide specific, actionable recommendations for the next video.\n\n' +
    'OUTPUT FORMAT (TSV - Tab Separated Values):\n' +
    'priority\tcategory\trecommendation\tplatform\texpected_impact\n\n' +
    'Priority: 1 (highest) to 5 (lowest)\n' +
    'Category: hook, pacing, content, format, platform\n' +
    'Platform: youtube, tiktok, instagram, or all\n\n' +
    'Provide 5-8 prioritized recommendations.';
}

/**
 * Enhanced analysis with component context and historical data
 * This is the main v2.0 analysis function
 */
function analyzWithLLMEnhanced(metricsBundle, kpiResults) {
  var reportId = generateReportId();

  // Get previous recommendations and component pool
  var previousRecs = getPreviousRecommendations();
  var context = buildAnalysisContext(metricsBundle, kpiResults);
  context.previous_recommendations = previousRecs;

  // Build component context for each video
  context.videos.forEach(function(video) {
    try {
      var componentContext = buildVideoComponentContext(video.video_uid);
      if (componentContext) {
        video.components = componentContext;
      }
    } catch (e) {
      Logger.log('Could not load components for ' + video.video_uid + ': ' + e.message);
    }
  });

  // Get top-performing component pool for recommendations
  try {
    context.component_pool = buildRecommendationComponentPool();
  } catch (e) {
    Logger.log('Could not load component pool: ' + e.message);
    context.component_pool = null;
  }

  // Generate analysis
  var analysisPrompt = buildAnalysisPromptWithComponents(context);
  var analysisResponse = callOpenAI(analysisPrompt);
  var parsedAnalysis = parseAnalysisResponse(analysisResponse);

  // Generate recommendations with component suggestions
  var recommendationsPrompt = buildRecommendationsPromptWithComponents(context, parsedAnalysis);
  var recommendationsResponse = callOpenAI(recommendationsPrompt);
  var recommendations = parseRecommendationsResponseEnhanced(recommendationsResponse);

  // Generate component-specific recommendations
  var componentRecs = null;
  if (context.component_pool) {
    try {
      var componentPrompt = buildComponentRecommendationPrompt(context, parsedAnalysis);
      var componentResponse = callOpenAI(componentPrompt);
      componentRecs = parseComponentRecommendations(componentResponse);
    } catch (e) {
      Logger.log('Could not generate component recommendations: ' + e.message);
    }
  }

  return {
    report_id: reportId,
    generated_at: nowJapan(),
    video_count: Object.keys(metricsBundle).length,
    analysis: parsedAnalysis,
    recommendations: recommendations,
    component_recommendations: componentRecs,
    raw_context: context
  };
}

/**
 * Build analysis prompt with component context
 */
function buildAnalysisPromptWithComponents(context) {
  var componentSection = '';

  context.videos.forEach(function(video) {
    if (video.components) {
      componentSection += '\nVideo: ' + video.video_uid + '\nCOMPONENTS USED:\n';

      var sections = ['hook', 'body', 'cta'];
      sections.forEach(function(section) {
        var comp = video.components[section];
        if (comp) {
          if (comp.scenario) {
            componentSection += '- ' + section.toUpperCase() + ' Scenario: ' + comp.scenario.component_id +
              ' "' + (comp.scenario.name || '') + '"' +
              (comp.scenario.avg_performance_score ? ' (avg score: ' + comp.scenario.avg_performance_score + ')' : '') + '\n';
            if (comp.scenario.script_en) {
              componentSection += '  Script: "' + comp.scenario.script_en + '"\n';
            }
          }
          if (comp.motion) {
            componentSection += '- ' + section.toUpperCase() + ' Motion: ' + comp.motion.component_id +
              ' "' + (comp.motion.name || '') + '"' +
              (comp.motion.avg_performance_score ? ' (avg score: ' + comp.motion.avg_performance_score + ')' : '') + '\n';
          }
          if (comp.audio) {
            componentSection += '- ' + section.toUpperCase() + ' Audio: ' + comp.audio.component_id +
              ' "' + (comp.audio.name || '') + '"\n';
          }
        }
      });

      if (video.components.character) {
        componentSection += '- Character: ' + video.components.character.component_id +
          ' "' + (video.components.character.name || '') + '"' +
          (video.components.character.avg_performance_score ? ' (avg score: ' + video.components.character.avg_performance_score + ')' : '') + '\n';
      }
    }
  });

  var prevRecsInfo = context.previous_recommendations && context.previous_recommendations.length > 0
    ? '\n\nPREVIOUS RECOMMENDATIONS (last ' + context.previous_recommendations.length + '):\n' +
      JSON.stringify(context.previous_recommendations.slice(-5), null, 2)
    : '';

  return 'You are an AI video performance analyst. Analyze the following video metrics with full component context.\n\n' +
    'VIDEO ANALYSIS CONTEXT:\n' + JSON.stringify(context.videos.map(function(v) {
      return { video_uid: v.video_uid, overall_score: v.overall_score, platforms: v.platforms, improvement_areas: v.improvement_areas };
    }), null, 2) + '\n\n' +
    componentSection +
    '\nSUMMARY:\n' + JSON.stringify(context.summary, null, 2) +
    prevRecsInfo + '\n\n' +
    'TASK:\nAnalyze the performance data considering:\n' +
    '1. Overall performance trends\n2. Platform-specific patterns\n' +
    '3. Which COMPONENTS (hooks, motions, scenarios) correlate with better/worse performance\n' +
    '4. Areas needing improvement\n' +
    '5. Compare to previous recommendations\n\n' +
    'OUTPUT FORMAT (TSV):\ncategory\tinsight\tconfidence\timpact\n\n' +
    'Categories: trend, pattern, strength, weakness, opportunity, component_insight, improvement_from_previous\n' +
    'Provide 5-10 rows.';
}

/**
 * Build recommendations prompt with component suggestions
 */
function buildRecommendationsPromptWithComponents(context, analysis) {
  var poolSection = '';
  if (context.component_pool) {
    poolSection = '\n\nAVAILABLE TOP-PERFORMING COMPONENTS:\n';
    Object.keys(context.component_pool).forEach(function(category) {
      var items = context.component_pool[category];
      if (items && items.length > 0) {
        poolSection += '\n' + category + ':\n';
        items.forEach(function(item) {
          poolSection += '  ' + item.component_id + ' "' + item.name + '" (score: ' + (item.avg_performance_score || 0) + ', used: ' + (item.times_used || 0) + 'x)\n';
        });
      }
    });
  }

  return 'You are an AI video content strategist. Based on the analysis, provide recommendations.\n\n' +
    'ANALYSIS:\n' + JSON.stringify(analysis, null, 2) + '\n' +
    poolSection + '\n\n' +
    'PREVIOUS RECOMMENDATIONS:\n' +
    JSON.stringify(context.previous_recommendations ? context.previous_recommendations.slice(-5) : [], null, 2) + '\n\n' +
    'TASK:\nProvide recommendations including:\n' +
    '1. Content hooks and openers\n2. Pacing and structure\n' +
    '3. Platform-specific optimizations\n4. Component choices\n\n' +
    'OUTPUT FORMAT (TSV):\npriority\tcategory\trecommendation\tplatform\texpected_impact\tcompared_to_previous\n\n' +
    'Priority: 1-5, Category: hook/pacing/content/format/platform/component\n' +
    'compared_to_previous: NEW, CONTINUATION, or IMPROVED\n\n' +
    'Provide 5-8 recommendations.';
}

/**
 * Build prompt for AI to recommend specific components for next video
 */
function buildComponentRecommendationPrompt(context, analysis) {
  var poolSection = '';
  if (context.component_pool) {
    Object.keys(context.component_pool).forEach(function(category) {
      var items = context.component_pool[category];
      if (items && items.length > 0) {
        poolSection += '\n' + category + ':\n';
        items.forEach(function(item) {
          poolSection += '  ' + item.component_id + ': "' + item.name + '" - ' + (item.description || '') +
            ' (score: ' + (item.avg_performance_score || 0) + ', used: ' + (item.times_used || 0) + 'x)\n';
        });
      }
    });
  }

  return 'You are an AI video production planner. Based on the analysis, recommend specific components for the next video.\n\n' +
    'ANALYSIS SUMMARY:\n' + JSON.stringify(analysis, null, 2) + '\n\n' +
    'AVAILABLE COMPONENTS:' + poolSection + '\n\n' +
    'TASK: Select the best component for each role. Return JSON:\n' +
    '{\n' +
    '  "hook_scenario": "SCN_H_XXXX",\n  "hook_motion": "MOT_XXXX",\n  "hook_audio": "AUD_XXXX",\n' +
    '  "body_scenario": "SCN_B_XXXX",\n  "body_motion": "MOT_XXXX",\n  "body_audio": "AUD_XXXX",\n' +
    '  "cta_scenario": "SCN_C_XXXX",\n  "cta_motion": "MOT_XXXX",\n  "cta_audio": "AUD_XXXX",\n' +
    '  "character": "CHR_XXXX",\n' +
    '  "reasoning": "Brief explanation of choices"\n' +
    '}\n\nRespond with ONLY the JSON object.';
}

/**
 * Parse component recommendation response (JSON)
 */
function parseComponentRecommendations(response) {
  try {
    var cleaned = response.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    return JSON.parse(cleaned.trim());
  } catch (e) {
    Logger.log('Failed to parse component recommendations: ' + e.message);
    return null;
  }
}

/**
 * Call OpenAI API
 */
function callOpenAI(prompt) {
  if (!CONFIG.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  var payload = {
    model: CONFIG.OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You are an expert video performance analyst. Respond only with the requested format.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2000
  };

  var options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + CONFIG.OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var lastError;
  for (var attempt = 0; attempt < CONFIG.RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
      var responseCode = response.getResponseCode();

      if (responseCode === 200) {
        var json = JSON.parse(response.getContentText());
        return json.choices[0].message.content;
      } else if (responseCode === 429) {
        var delay = Math.min(CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt), CONFIG.RETRY.MAX_DELAY_MS);
        Utilities.sleep(delay);
        continue;
      } else {
        throw new Error('OpenAI API error: ' + responseCode + ' - ' + response.getContentText());
      }
    } catch (e) {
      lastError = e;
      var retryDelay = Math.min(CONFIG.RETRY.BASE_DELAY_MS * Math.pow(2, attempt), CONFIG.RETRY.MAX_DELAY_MS);
      Utilities.sleep(retryDelay);
    }
  }

  throw lastError || new Error('OpenAI API call failed after retries');
}

/**
 * Parse TSV analysis response
 */
function parseAnalysisResponse(response) {
  var lines = response.trim().split('\n');
  var insights = [];

  lines.forEach(function(line) {
    if (line.toLowerCase().startsWith('category\t')) return;
    var parts = line.split('\t');
    if (parts.length >= 4) {
      insights.push({
        category: parts[0].trim(),
        insight: parts[1].trim(),
        confidence: parts[2].trim(),
        impact: parts[3].trim()
      });
    }
  });

  return { insights: insights };
}

/**
 * Parse TSV recommendations response
 */
function parseRecommendationsResponse(response) {
  var lines = response.trim().split('\n');
  var recommendations = [];

  lines.forEach(function(line) {
    if (line.toLowerCase().startsWith('priority\t')) return;
    var parts = line.split('\t');
    if (parts.length >= 5) {
      recommendations.push({
        priority: parseInt(parts[0].trim()) || 99,
        category: parts[1].trim(),
        recommendation: parts[2].trim(),
        platform: parts[3].trim(),
        expected_impact: parts[4].trim()
      });
    }
  });

  recommendations.sort(function(a, b) { return a.priority - b.priority; });
  return recommendations;
}

/**
 * Parse enhanced recommendations with compared_to_previous
 */
function parseRecommendationsResponseEnhanced(response) {
  var lines = response.trim().split('\n');
  var recommendations = [];

  lines.forEach(function(line) {
    if (line.toLowerCase().startsWith('priority\t')) return;
    var parts = line.split('\t');
    if (parts.length >= 5) {
      recommendations.push({
        priority: parseInt(parts[0].trim()) || 99,
        category: parts[1].trim(),
        recommendation: parts[2].trim(),
        platform: parts[3].trim(),
        expected_impact: parts[4].trim(),
        compared_to_previous: parts[5] ? parts[5].trim() : 'NEW'
      });
    }
  });

  recommendations.sort(function(a, b) { return a.priority - b.priority; });
  return recommendations;
}

/**
 * Generate unique report ID
 */
function generateReportId() {
  var now = new Date();
  var datePart = Utilities.formatDate(now, 'GMT', 'yyyyMMdd_HHmmss');
  var random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return 'RPT_' + datePart + '_' + random;
}

/**
 * Analyze a single video across all platforms (v2.0 with component context)
 */
function analyzeVideoSingle(videoUid) {
  var videoData = getVideoMasterData(videoUid);
  if (!videoData) throw new Error('Video not found: ' + videoUid);

  var metrics = {
    youtube: getLatestMetrics(videoUid, 'youtube'),
    tiktok: getLatestMetrics(videoUid, 'tiktok'),
    instagram: getLatestMetrics(videoUid, 'instagram')
  };

  var previousAnalysis = getPreviousVideoAnalysis(videoUid);

  // v2.0: Get component context
  var componentContext = null;
  try {
    componentContext = buildVideoComponentContext(videoUid);
  } catch (e) {
    Logger.log('Could not load components for single analysis: ' + e.message);
  }

  var context = {
    video_uid: videoUid,
    title: videoData.title,
    status: videoData.status,
    metrics: metrics,
    previous_analysis: previousAnalysis,
    kpi_targets: getKPITargets(),
    components: componentContext
  };

  var analysisResponse = callOpenAI(buildSingleVideoAnalysisPrompt(context));
  var analysis = parseSingleVideoAnalysisResponse(analysisResponse);

  return {
    video_uid: videoUid,
    analyzed_at: nowJapan(),
    youtube_performance: analysis.youtube_performance,
    tiktok_performance: analysis.tiktok_performance,
    instagram_performance: analysis.instagram_performance,
    cross_platform_insights: analysis.cross_platform_insights,
    kpi_achievement: analysis.kpi_achievement,
    improvements_from_previous: analysis.improvements_from_previous,
    prompt_effectiveness: analysis.prompt_effectiveness,
    recommendations: analysis.recommendations
  };
}

/**
 * Build prompt for single video cross-platform analysis (v2.0)
 */
function buildSingleVideoAnalysisPrompt(context) {
  var previousInfo = context.previous_analysis
    ? '\n\nPREVIOUS ANALYSIS (' + context.previous_analysis.analyzed_at + '):\n' + JSON.stringify(context.previous_analysis, null, 2)
    : '\n\nPREVIOUS ANALYSIS: None (first analysis)';

  var componentInfo = '';
  if (context.components) {
    componentInfo = '\n\nCOMPONENTS USED:';
    ['hook', 'body', 'cta'].forEach(function(section) {
      var comp = context.components[section];
      if (comp) {
        if (comp.scenario) componentInfo += '\n- ' + section.toUpperCase() + ' Scenario: ' + comp.scenario.component_id + ' "' + (comp.scenario.name || '') + '"' + (comp.scenario.script_en ? ' - "' + comp.scenario.script_en + '"' : '');
        if (comp.motion) componentInfo += '\n- ' + section.toUpperCase() + ' Motion: ' + comp.motion.component_id + ' "' + (comp.motion.name || '') + '"';
        if (comp.audio) componentInfo += '\n- ' + section.toUpperCase() + ' Audio: ' + comp.audio.component_id + ' "' + (comp.audio.name || '') + '"';
      }
    });
    if (context.components.character) {
      componentInfo += '\n- Character: ' + context.components.character.component_id + ' "' + (context.components.character.name || '') + '"';
    }
  }

  return 'You are an expert AI video performance analyst. Analyze a single video\'s performance across multiple platforms.\n\n' +
    'VIDEO INFORMATION:\n- Video UID: ' + context.video_uid + '\n- Title: ' + (context.title || 'Unknown') +
    componentInfo + '\n\n' +
    'METRICS BY PLATFORM:\nYouTube: ' + JSON.stringify(context.metrics.youtube || 'No data', null, 2) +
    '\nTikTok: ' + JSON.stringify(context.metrics.tiktok || 'No data', null, 2) +
    '\nInstagram: ' + JSON.stringify(context.metrics.instagram || 'No data', null, 2) + '\n\n' +
    'KPI TARGETS:\n' + JSON.stringify(context.kpi_targets, null, 2) +
    previousInfo + '\n\n' +
    'OUTPUT FORMAT (JSON):\n{\n' +
    '  "youtube_performance": "summary",\n  "tiktok_performance": "summary",\n' +
    '  "instagram_performance": "summary",\n  "cross_platform_insights": "patterns",\n' +
    '  "kpi_achievement": "exceeded|met|partially_met|not_met",\n' +
    '  "improvements_from_previous": "what improved",\n' +
    '  "prompt_effectiveness": "component effectiveness analysis",\n' +
    '  "recommendations": "2-3 specific recommendations"\n}\n\nRespond with ONLY the JSON object.';
}

/**
 * Parse single video analysis response
 */
function parseSingleVideoAnalysisResponse(response) {
  try {
    var cleaned = response.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    return JSON.parse(cleaned.trim());
  } catch (e) {
    Logger.log('Failed to parse single video analysis: ' + e.message);
    return {
      youtube_performance: 'Parse error',
      tiktok_performance: 'Parse error',
      instagram_performance: 'Parse error',
      cross_platform_insights: response,
      kpi_achievement: 'not_met',
      improvements_from_previous: 'Parse error',
      prompt_effectiveness: 'Parse error',
      recommendations: 'Parse error'
    };
  }
}

/**
 * Get video master data
 */
function getVideoMasterData(videoUid) {
  var sheet = getSheet(CONFIG.SHEETS.MASTER);
  return findRowByColumn(sheet, 'video_uid', videoUid);
}

/**
 * Get latest metrics for a video from a specific platform
 */
function getLatestMetrics(videoUid, platform) {
  var sheetName = 'metrics_' + platform;
  try {
    var sheet = getSheet(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return null;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var latestRow = null;
    var latestDate = null;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === videoUid) {
        var importDate = data[i][1];
        if (!latestDate || importDate > latestDate) {
          latestDate = importDate;
          latestRow = data[i];
        }
      }
    }

    if (!latestRow) return null;

    var metrics = {};
    headers.forEach(function(h, idx) { metrics[h] = latestRow[idx]; });
    return metrics;
  } catch (e) {
    return null;
  }
}

/**
 * Get previous analysis for a video
 */
function getPreviousVideoAnalysis(videoUid) {
  try {
    var sheet = getSheet(CONFIG.SHEETS.VIDEO_ANALYSIS);
    if (!sheet || sheet.getLastRow() < 2) return null;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var latestRow = null;
    var latestDate = null;

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === videoUid) {
        var analyzedAt = data[i][1];
        if (!latestDate || analyzedAt > latestDate) {
          latestDate = analyzedAt;
          latestRow = data[i];
        }
      }
    }

    if (!latestRow) return null;

    var analysis = {};
    headers.forEach(function(h, idx) { analysis[h] = latestRow[idx]; });
    return analysis;
  } catch (e) {
    return null;
  }
}

/**
 * Get previous recommendations
 */
function getPreviousRecommendations(limit) {
  limit = limit || 20;
  try {
    var sheet = getSheet(CONFIG.SHEETS.RECOMMENDATIONS);
    if (!sheet || sheet.getLastRow() < 2) return [];

    var data = sheet.getDataRange().getValues();
    var headers = data[0];

    var startRow = Math.max(1, data.length - limit);
    var recommendations = [];

    for (var i = startRow; i < data.length; i++) {
      var rec = {};
      headers.forEach(function(h, idx) { rec[h] = data[i][idx]; });
      recommendations.push(rec);
    }

    return recommendations;
  } catch (e) {
    return [];
  }
}
