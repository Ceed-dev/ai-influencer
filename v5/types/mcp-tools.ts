// AUTO-GENERATED from 04-agent-design.md Section 4 — DO NOT EDIT MANUALLY
//
// MCP Server Tool interfaces for all 105 tools
// Organized by agent role (12 categories)

import type {
  AccountRow,
  CharacterRow,
  ComponentRow,
  ContentRow,
  PublicationRow,
  HypothesisRow,
  MarketIntelRow,
  MetricsRow,
  AnalysisRow,
  LearningRow,
  CycleRow,
  HumanDirectiveRow,
  TaskQueueRow,
  AlgorithmPerformanceRow,
  AgentPromptVersionRow,
  AgentThoughtLogRow,
  AgentReflectionRow,
  AgentIndividualLearningRow,
  AgentCommunicationRow,
  ToolCatalogRow,
  ToolExperienceRow,
  ToolExternalSourceRow,
  ProductionRecipeRow,
  PromptSuggestionRow,
  SystemSettingRow,
  ContentSectionRow,
  AgentType,
  ContentFormat,
  ContentStatus,
  PublicationStatus,
  HypothesisVerdict,
  Platform,
  IntelType,
  ComponentType,
  ComponentSubtype,
} from './database';

// ============================================================================
// 4.1 Strategic Agent Tools (10 tools)
// 社長が全体状況を把握し、方針を決定するためのツール群
// ============================================================================

/** #1 — 全アカウントのKPIサマリー取得 */
export interface GetPortfolioKpiSummaryInput {
  period: '7d' | '30d';
}
export interface GetPortfolioKpiSummaryOutput {
  total_accounts: number;
  active_accounts: number;
  total_views: number;
  avg_engagement_rate: number;
  follower_growth: number;
  monetized_count: number;
}

/** #2 — クラスター別パフォーマンス比較 */
export interface GetClusterPerformanceInput {
  period: '7d';
}
export interface GetClusterPerformanceOutput {
  clusters: Array<{
    cluster: string;
    account_count: number;
    avg_views: number;
    avg_engagement: number;
  }>;
}

/** #3 — 最新の高信頼知見一覧 */
export interface GetTopLearningsInput {
  limit: number; // default: 10
  min_confidence: number; // default: 0.7
}
export interface GetTopLearningsOutput {
  learnings: Array<{
    insight: string;
    confidence: number;
    evidence_count: number;
    category: string;
  }>;
}

/** #4 — 実行中/検証待ち仮説一覧 */
export interface GetActiveHypothesesInput {
  verdict: HypothesisVerdict; // default: 'pending'
}
export interface GetActiveHypothesesOutput {
  hypotheses: Array<{
    id: number;
    statement: string;
    category: string;
    predicted_kpis: Record<string, number>;
    evidence_count: number;
  }>;
}

/** #5 — アルゴリズム精度推移 */
export interface GetAlgorithmPerformanceInput {
  period: 'weekly' | 'daily';
  limit: number; // default: 12
}
export interface GetAlgorithmPerformanceOutput {
  data: Array<{
    measured_at: string;
    hypothesis_accuracy: number;
    prediction_error: number;
    improvement_rate: number;
  }>;
}

/** #6 — 人間からの未処理指示 (社長専用) */
export interface GetPendingDirectivesInput {
  // no parameters
}
export interface GetPendingDirectivesOutput {
  directives: Array<{
    id: number;
    directive_type: string;
    content: string;
    priority: number;
    created_at: string;
  }>;
}

/** #7 — 新サイクル開始 */
export interface CreateCycleInput {
  cycle_number: number;
}
export interface CreateCycleOutput {
  id: number;
  cycle_number: number;
  status: string;
}

/** #8 — サイクルの方針設定 */
export interface SetCyclePlanInput {
  cycle_id: number;
  summary: Record<string, unknown>;
}
export interface SetCyclePlanOutput {
  success: boolean;
}

/** #9 — クラスター間リソース配分 */
export interface AllocateResourcesInput {
  cycle_id: number;
  allocations: Array<{
    cluster: string;
    content_count: number;
    budget: number;
  }>;
}
export interface AllocateResourcesOutput {
  success: boolean;
}

/** #10 — プランナーへの個別指示 */
export interface SendPlannerDirectiveInput {
  cluster: string;
  directive_text: string;
}
export interface SendPlannerDirectiveOutput {
  success: boolean;
}

// ============================================================================
// 4.2 Researcher Tools (12 tools)
// 市場情報を収集・保存・検索するためのツール群
// ============================================================================

/** #1 — トレンドトピック保存 */
export interface SaveTrendingTopicInput {
  topic: string;
  volume: number;
  growth_rate: number;
  platform: Platform;
  niche: string;
}
export interface SaveTrendingTopicOutput {
  id: number;
}

/** #2 — 競合投稿保存 */
export interface SaveCompetitorPostInput {
  post_url: string;
  views: number;
  format: string;
  hook_technique: string;
  platform: Platform;
}
export interface SaveCompetitorPostOutput {
  id: number;
}

/** #3 — 競合アカウント保存 */
export interface SaveCompetitorAccountInput {
  username: string;
  followers: number;
  posting_frequency: string;
  platform: Platform;
}
export interface SaveCompetitorAccountOutput {
  id: number;
}

/** #4 — オーディエンスシグナル保存 */
export interface SaveAudienceSignalInput {
  signal_type: string;
  topic: string;
  sentiment: string;
  sample_data: Record<string, unknown>;
}
export interface SaveAudienceSignalOutput {
  id: number;
}

/** #5 — プラットフォーム更新保存 */
export interface SavePlatformUpdateInput {
  platform: Platform;
  update_type: string;
  description: string;
  effective_date: string; // ISO 8601
}
export interface SavePlatformUpdateOutput {
  id: number;
}

/** #6 — 最近の市場情報取得 */
export interface GetRecentIntelInput {
  intel_type?: IntelType;
  platform?: Platform;
  limit: number; // default: 20
}
export interface GetRecentIntelOutput {
  intel: Array<{
    id: number;
    data: Record<string, unknown>;
    relevance_score: number;
    collected_at: string;
  }>;
}

/** #7 — 類似情報のベクトル検索 */
export interface SearchSimilarIntelInput {
  query_text: string;
  limit: number; // default: 10
}
export interface SearchSimilarIntelOutput {
  results: Array<{
    id: number;
    data: Record<string, unknown>;
    similarity: number;
  }>;
}

/** #8 — ニッチ別トレンド取得 */
export interface GetNicheTrendsInput {
  niche: string;
  period: '7d' | '30d';
}
export interface GetNicheTrendsOutput {
  trends: Array<{
    topic: string;
    volume: number;
    trend_direction: 'rising' | 'stable' | 'declining';
  }>;
}

/** #9 — 競合分析データ取得 */
export interface GetCompetitorAnalysisInput {
  platform: Platform;
  niche: string;
}
export interface GetCompetitorAnalysisOutput {
  competitors: Array<{
    username: string;
    followers: number;
    avg_views: number;
    content_strategy: string;
  }>;
}

/** #10 — プラットフォーム変更履歴 */
export interface GetPlatformChangesInput {
  platform: Platform;
  since: '30d' | '90d';
}
export interface GetPlatformChangesOutput {
  changes: Array<{
    update_type: string;
    description: string;
    effective_date: string;
  }>;
}

/** #11 — 情報の期限切れマーク */
export interface MarkIntelExpiredInput {
  intel_id: number;
}
export interface MarkIntelExpiredOutput {
  success: boolean;
}

/** #12 — 情報収集の空白領域検出 */
export interface GetIntelGapsInput {
  niche: string;
}
export interface GetIntelGapsOutput {
  gaps: Array<{
    intel_type: IntelType;
    last_collected: string | null;
    gap_hours: number;
  }>;
}

// ============================================================================
// 4.3 Analyst Tools (14 tools)
// パフォーマンス分析・仮説検証・知見管理のためのツール群
// ============================================================================

/** #1 — 分析対象メトリクス取得 */
export interface GetMetricsForAnalysisInput {
  since: '24h' | '48h' | '7d';
  status: 'measured';
}
export interface GetMetricsForAnalysisOutput {
  metrics: Array<{
    publication_id: number;
    content_id: string;
    views: number;
    engagement_rate: number;
    likes: number;
    comments: number;
    shares: number;
    platform: Platform;
    posted_at: string;
  }>;
}

/** #2 — 仮説の実測結果 */
export interface GetHypothesisResultsInput {
  hypothesis_id: number;
}
export interface GetHypothesisResultsOutput {
  predicted_kpis: Record<string, number>;
  actual_kpis: Record<string, number>;
  content_count: number;
  raw_metrics: Array<Record<string, unknown>>;
}

/** #3 — 仮説の検証実行 (verdict設定) */
export interface VerifyHypothesisInput {
  hypothesis_id: number;
  verdict: HypothesisVerdict;
  confidence: number;
  evidence_summary: string;
}
export interface VerifyHypothesisOutput {
  success: boolean;
}

/** #4 — 分析レポート作成 */
export interface CreateAnalysisInput {
  cycle_id: number;
  analysis_type: string;
  findings: string;
  recommendations: string;
}
export interface CreateAnalysisOutput {
  id: number;
}

/** #5 — 知見の抽出・保存 */
export interface ExtractLearningInput {
  insight: string;
  category: string;
  confidence: number;
  source_analyses: number[];
  applicable_niches: string[];
}
export interface ExtractLearningOutput {
  id: number;
}

/** #6 — 知見の確信度更新 */
export interface UpdateLearningConfidenceInput {
  learning_id: number;
  new_confidence: number;
  additional_evidence: string;
}
export interface UpdateLearningConfidenceOutput {
  success: boolean;
}

/** #7 — 類似知見のベクトル検索 */
export interface SearchSimilarLearningsInput {
  query_text: string;
  limit: number; // default: 10
  min_confidence: number; // default: 0.5
}
export interface SearchSimilarLearningsOutput {
  results: Array<{
    id: number;
    insight: string;
    confidence: number;
    similarity: number;
  }>;
}

/** #8 — 異常値検知 (ANOMALY_DETECTION_SIGMA × 標準偏差ベース) */
export interface DetectAnomaliesInput {
  period: '7d' | '30d';
  threshold: number; // default: 2.0 (system_settings ANOMALY_DETECTION_SIGMA)
}
export interface DetectAnomaliesOutput {
  anomalies: Array<{
    account_id: string;
    metric: string;
    expected: number;
    actual: number;
    deviation: number;
  }>;
}

/** #9 — コンポーネント別スコア取得 */
export interface GetComponentScoresInput {
  type: ComponentType;
  subtype: ComponentSubtype;
  limit: number; // default: 20
}
export interface GetComponentScoresOutput {
  components: Array<{
    component_id: string;
    name: string;
    score: number;
    usage_count: number;
  }>;
}

/** #10 — スコア更新 */
export interface UpdateComponentScoreInput {
  component_id: string;
  new_score: number;
}
export interface UpdateComponentScoreOutput {
  success: boolean;
}

/** #11 — アルゴリズム精度計算 */
export interface CalculateAlgorithmPerformanceInput {
  period: 'weekly' | 'daily';
}
export interface CalculateAlgorithmPerformanceOutput {
  hypothesis_accuracy: number;
  prediction_error: number;
  learning_count: number;
  improvement_rate: number;
}

/** #12 — ニッチ別パフォーマンス推移 */
export interface GetNichePerformanceTrendsInput {
  niche: string;
  period: '7d' | '30d' | '90d';
}
export interface GetNichePerformanceTrendsOutput {
  data: Array<{
    date: string;
    avg_views: number;
    avg_engagement: number;
    content_count: number;
  }>;
}

/** #13 — 予測vs実測の比較 */
export interface CompareHypothesisPredictionsInput {
  hypothesis_ids: number[];
}
export interface CompareHypothesisPredictionsOutput {
  comparisons: Array<{
    hypothesis_id: number;
    predicted: Record<string, number>;
    actual: Record<string, number>;
    error_rate: number;
  }>;
}

/** #14 — 改善提案の生成 */
export interface GenerateImprovementSuggestionsInput {
  niche: string;
  account_id?: string;
}
export interface GenerateImprovementSuggestionsOutput {
  suggestions: Array<{
    suggestion: string;
    rationale: string;
    expected_impact: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

// ============================================================================
// 4.4 Planner Tools (9 tools)
// コンテンツ計画の策定に必要なツール群
// ============================================================================

/** #1 — 担当アカウント一覧 */
export interface GetAssignedAccountsInput {
  cluster: string;
}
export interface GetAssignedAccountsOutput {
  accounts: Array<{
    account_id: string;
    platform: Platform;
    niche: string;
    follower_count: number;
    status: string;
  }>;
}

/** #2 — アカウント別パフォーマンス */
export interface GetAccountPerformanceInput {
  account_id: string;
  period: '7d' | '30d';
}
export interface GetAccountPerformanceOutput {
  avg_views: number;
  avg_engagement: number;
  top_content: string;
  trend: 'improving' | 'stable' | 'declining';
}

/** #3 — 利用可能コンポーネント */
export interface GetAvailableComponentsInput {
  type: ComponentType;
  niche: string;
  subtype?: ComponentSubtype;
}
export interface GetAvailableComponentsOutput {
  components: Array<{
    component_id: string;
    name: string;
    score: number;
    usage_count: number;
    data: Record<string, unknown>;
  }>;
}

/** #4 — 仮説の作成 */
export interface CreateHypothesisInput {
  category: string;
  statement: string;
  rationale: string;
  target_accounts: string[];
  predicted_kpis: Record<string, number>;
}
export interface CreateHypothesisOutput {
  id: number;
}

/** #5 — コンテンツ計画の作成 */
export interface PlanContentInput {
  hypothesis_id: number;
  character_id: string;
  script_language: 'en' | 'jp';
  content_format: ContentFormat;
  sections: Array<{
    component_id: string;
    section_label: string;
  }>;
}
export interface PlanContentOutput {
  content_id: string;
}

/** #6 — 投稿スケジュール設定 */
export interface ScheduleContentInput {
  content_id: string;
  planned_post_date: string; // YYYY-MM-DD
}
export interface ScheduleContentOutput {
  success: boolean;
}

/** #7 — ニッチ関連の知見取得 */
export interface GetNicheLearningsInput {
  niche: string;
  min_confidence: number; // default: 0.5
  limit: number; // default: 10
}
export interface GetNicheLearningsOutput {
  learnings: Array<{
    insight: string;
    confidence: number;
    category: string;
  }>;
}

/** #8 — コンテンツプールの状況 */
export interface GetContentPoolStatusInput {
  cluster: string;
}
export interface GetContentPoolStatusOutput {
  content: {
    pending_approval: number;
    planned: number;
    producing: number;
    ready: number;
    analyzed: number;
  };
  publications: {
    scheduled: number;
    posted: number;
    measured: number;
  };
}

/** #9 — 制作タスクの発行 (task_queueにINSERT) */
export interface RequestProductionInput {
  content_id: string;
  priority: number; // default: 0
}
export interface RequestProductionOutput {
  task_id: number;
}

// ============================================================================
// 4.5 Tool Specialist Tools (5 tools)
// AIツール知識の管理・検索・制作レシピ設計のためのツール群
// ============================================================================

/** #1 — ツール特性知識の取得 */
export interface GetToolKnowledgeInput {
  tool_name?: string;
  category?: 'video_gen' | 'tts' | 'lipsync' | 'image_gen';
}
export interface GetToolKnowledgeOutput {
  tools: Array<{
    tool_name: string;
    capabilities: string[];
    limitations: string[];
    best_for: string[];
    parameters: Record<string, unknown>;
    updated_at: string;
  }>;
}

/** #2 — ツール使用経験の記録 */
export interface SaveToolExperienceInput {
  tool_combination: string[];
  content_id: string;
  quality_score: number;
  notes: string;
  character_type?: string;
  niche?: string;
}
export interface SaveToolExperienceOutput {
  id: number;
}

/** #3 — 類似要件でのツール使用実績検索 */
export interface SearchSimilarToolUsageInput {
  requirements: {
    character_type?: string;
    niche?: string;
    content_type?: string;
    quality_priority?: string;
  };
  limit: number; // default: 5
}
export interface SearchSimilarToolUsageOutput {
  results: Array<{
    tool_combination: string[];
    avg_quality_score: number;
    usage_count: number;
    notes: string;
  }>;
}

/** #4 — 最適ツール組み合わせ（制作レシピ）の推奨 */
export interface GetToolRecommendationsInput {
  content_requirements: {
    character_id: string;
    niche: string;
    platform: Platform;
    quality_target: number;
  };
}
export interface GetToolRecommendationsOutput {
  recipe: {
    video_gen: string;
    tts: string;
    lipsync: string;
    concat: string;
  };
  rationale: string;
  confidence: number;
  alternatives: Array<{
    recipe: {
      video_gen: string;
      tts: string;
      lipsync: string;
      concat: string;
    };
    rationale: string;
    confidence: number;
  }>;
}

/** #5 — 外部情報からのツール知識更新 */
export interface UpdateToolKnowledgeFromExternalInput {
  tool_name: string;
  update_type: 'capability' | 'pricing' | 'api_change' | 'bug';
  description: string;
  source_url?: string;
}
export interface UpdateToolKnowledgeFromExternalOutput {
  id: number;
}

// ============================================================================
// 4.6 Production Worker Tools (12 tools)
// 動画制作パイプラインの各段階で使用するツール群
// ============================================================================

/** #1 — 制作タスクの取得 (キューから1件) */
export interface GetProductionTaskInput {
  // no parameters
}
export interface GetProductionTaskOutput {
  task_id: number;
  content_id: string;
  payload: Record<string, unknown>;
} // returns null if queue is empty

/** #2 — スクリプト生成 */
export interface GenerateScriptInput {
  content_id: string;
  scenario_data: Record<string, unknown>;
  script_language: 'en' | 'jp';
}
export interface GenerateScriptOutput {
  hook_script: string;
  body_script: string;
  cta_script: string;
}

/** #3 — キャラクター情報取得 */
export interface GetCharacterInfoInput {
  character_id: string;
}
export interface GetCharacterInfoOutput {
  name: string;
  voice_id: string;
  image_drive_id: string;
  appearance: string;
}

/** #4 — コンポーネントデータ取得 */
export interface GetComponentDataInput {
  component_id: string;
}
export interface GetComponentDataOutput {
  type: ComponentType;
  subtype: ComponentSubtype;
  data: Record<string, unknown>;
  drive_file_id: string | null;
}

/** #5 — Kling動画生成開始 */
export interface StartVideoGenerationInput {
  image_url: string;
  motion_data: Record<string, unknown>;
  section: string;
}
export interface StartVideoGenerationOutput {
  request_id: string;
}

/** #6 — 動画生成状況確認 */
export interface CheckVideoStatusInput {
  request_id: string;
}
export interface CheckVideoStatusOutput {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
}

/** #7 — Fish Audio TTS開始 */
export interface StartTtsInput {
  text: string;
  voice_id: string; // 32-char hex (Fish Audio reference_id)
  language: 'en' | 'jp';
}
export interface StartTtsOutput {
  audio_url: string;
}

/** #8 — fal.ai Lipsync開始 */
export interface StartLipsyncInput {
  video_url: string;
  audio_url: string;
}
export interface StartLipsyncOutput {
  request_id: string;
}

/** #9 — Google Driveアップロード */
export interface UploadToDriveInput {
  file_url: string;
  folder_id: string;
  filename: string;
}
export interface UploadToDriveOutput {
  drive_file_id: string;
  drive_url: string;
}

/** #10 — コンテンツステータス更新 */
export interface UpdateContentStatusInput {
  content_id: string;
  status: ContentStatus;
  metadata?: Record<string, unknown>;
}
export interface UpdateContentStatusOutput {
  success: boolean;
}

/** #11 — 品質チェック実行 */
export interface RunQualityCheckInput {
  content_id: string;
  video_url: string;
}
export interface RunQualityCheckOutput {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    details?: string;
  }>;
}

/** #12 — 制作完了報告 */
export interface ReportProductionCompleteInput {
  task_id: number;
  content_id: string;
  drive_folder_id: string;
  video_drive_id: string;
}
export interface ReportProductionCompleteOutput {
  success: boolean;
}

// ============================================================================
// 4.7 Publishing Worker Tools (6 tools)
// プラットフォーム別の投稿実行ツール群
// ============================================================================

/** #1 — 投稿タスクの取得 */
export interface GetPublishTaskInput {
  // no parameters
}
export interface GetPublishTaskOutput {
  task_id: number;
  content_id: string;
  platform: Platform;
  payload: Record<string, unknown>;
} // returns null if queue is empty

/** #2 — YouTube投稿 */
export interface PublishToYoutubeInput {
  content_id: string;
  title: string;
  description: string;
  tags: string[];
  video_drive_id: string;
}
export interface PublishToYoutubeOutput {
  platform_post_id: string;
  post_url: string;
}

/** #3 — TikTok投稿 */
export interface PublishToTiktokInput {
  content_id: string;
  description: string;
  tags: string[];
  video_drive_id: string;
}
export interface PublishToTiktokOutput {
  platform_post_id: string;
  post_url: string;
}

/** #4 — Instagram投稿 */
export interface PublishToInstagramInput {
  content_id: string;
  caption: string;
  tags: string[];
  video_drive_id: string;
}
export interface PublishToInstagramOutput {
  platform_post_id: string;
  post_url: string;
}

/** #5 — X/Twitter投稿 */
export interface PublishToXInput {
  content_id: string;
  text: string;
  video_drive_id: string;
}
export interface PublishToXOutput {
  platform_post_id: string;
  post_url: string;
}

/** #6 — 投稿結果報告 */
export interface ReportPublishResultInput {
  task_id: number;
  content_id: string;
  platform_post_id: string;
  post_url: string;
  posted_at: string; // ISO 8601
}
export interface ReportPublishResultOutput {
  success: boolean;
}

// ============================================================================
// 4.8 Measurement Worker Tools (7 tools)
// プラットフォーム別のメトリクス収集ツール群
// ============================================================================

/** #1 — 計測対象取得 */
export interface GetMeasurementTasksInput {
  limit: number; // default: 10
}
export interface GetMeasurementTasksOutput {
  tasks: Array<{
    task_id: number;
    publication_id: number;
    platform: Platform;
    platform_post_id: string;
  }>;
}

/** #2 — YouTube計測 */
export interface CollectYoutubeMetricsInput {
  platform_post_id: string;
}
export interface CollectYoutubeMetricsOutput {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  watch_time: number;
  completion_rate: number;
}

/** #3 — TikTok計測 */
export interface CollectTiktokMetricsInput {
  platform_post_id: string;
}
export interface CollectTiktokMetricsOutput {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  completion_rate: number;
}

/** #4 — Instagram計測 */
export interface CollectInstagramMetricsInput {
  platform_post_id: string;
}
export interface CollectInstagramMetricsOutput {
  views: number;
  likes: number;
  comments: number;
  saves: number;
  reach: number;
  impressions: number;
}

/** #5 — X計測 */
export interface CollectXMetricsInput {
  platform_post_id: string;
}
export interface CollectXMetricsOutput {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
}

/** #6 — アカウント全体メトリクス */
export interface CollectAccountMetricsInput {
  account_id: string;
}
export interface CollectAccountMetricsOutput {
  follower_count: number;
  follower_delta: number;
}

/** #7 — 計測完了報告 */
export interface ReportMeasurementCompleteInput {
  task_id: number;
  publication_id: number;
  metrics_data: Record<string, number>;
}
export interface ReportMeasurementCompleteOutput {
  success: boolean;
}

// ============================================================================
// 4.9 Dashboard Tools (10 tools)
// 人間がダッシュボードから操作する際に使用するツール群
// (REST API として実装、MCPツールと同等ロジック)
// ============================================================================

/** #1 — ダッシュボード用サマリー */
export interface GetDashboardSummaryInput {
  // no parameters
}
export interface GetDashboardSummaryOutput {
  kpi: GetPortfolioKpiSummaryOutput;
  algorithm_accuracy: number;
  active_cycles: number;
  pending_tasks: number;
}

/** #2 — 設定変更 (計測タイミング等) */
export interface UpdateSystemConfigInput {
  key: string;
  value: unknown;
}
export interface UpdateSystemConfigOutput {
  success: boolean;
}

/** #3 — 人間介入の送信 */
export interface SubmitHumanDirectiveInput {
  directive_type: string;
  content: string;
  target_accounts?: string[];
  target_agents?: AgentType[];
  priority: number;
}
export interface SubmitHumanDirectiveOutput {
  id: number;
}

/** #4 — 承認待ちコンテンツ計画一覧 */
export interface GetPendingApprovalsInput {
  // no parameters
}
export interface GetPendingApprovalsOutput {
  approvals: Array<{
    content_id: string;
    hypothesis: string;
    plan_summary: string;
    cost_estimate: number;
    created_at: string;
  }>;
}

/** #5 — コンテンツ計画の人間承認/差戻 */
export interface ApproveOrRejectPlanInput {
  content_id: string;
  decision: 'approve' | 'reject';
  feedback?: string;
  rejection_category?: 'plan_revision' | 'data_insufficient' | 'hypothesis_weak';
}
export interface ApproveOrRejectPlanOutput {
  success: boolean;
}

/** #6 — 学習方法の指導送信 */
export interface SubmitLearningGuidanceInput {
  target_agent_type: AgentType;
  guidance: string;
  category: string;
}
export interface SubmitLearningGuidanceOutput {
  id: number;
}

/** #7 — 学習方法指導の取得 */
export interface GetLearningDirectivesInput {
  agent_type: AgentType;
}
export interface GetLearningDirectivesOutput {
  directives: Array<{
    guidance: string;
    category: string;
    created_at: string;
  }>;
}

/** #8 — エージェントプロンプト更新 */
export interface UpdateAgentPromptInput {
  agent_type: AgentType;
  prompt_content: string;
  change_reason: string;
}
export interface UpdateAgentPromptOutput {
  version_id: number;
}

/** #9 — エージェントプロンプトロールバック */
export interface RollbackAgentPromptInput {
  agent_type: AgentType;
  version: number;
}
export interface RollbackAgentPromptOutput {
  success: boolean;
}

/** #10 — プロンプト改善提案の状態更新 */
export interface UpdatePromptSuggestionStatusInput {
  suggestion_id: number;
  status: 'accepted' | 'rejected' | 'on_hold';
}
export interface UpdatePromptSuggestionStatusOutput {
  success: boolean;
}

// ============================================================================
// 4.10 Data Curator Tools (9 tools)
// 生データの取得・構造化・コンポーネント生成・重複チェック・キャラクター自動生成のためのツール群
// ============================================================================

/** #1 — キュレーション待ちデータ取得 */
export interface GetCurationQueueInput {
  limit: number; // default: 10
}
export interface GetCurationQueueOutput {
  items: Array<{
    id: number;
    source: string;
    raw_data: Record<string, unknown>;
    data_type: string;
  }>;
}

/** #2 — 構造化コンポーネントの作成 */
export interface CreateComponentInput {
  type: ComponentType;
  subtype: ComponentSubtype;
  name: string;
  data: Record<string, unknown>;
  tags: string[];
  drive_file_id?: string;
}
export interface CreateComponentOutput {
  component_id: string;
}

/** #3 — 既存コンポーネントの更新 */
export interface UpdateComponentDataInput {
  component_id: string;
  data: Record<string, unknown>;
  tags?: string[];
}
export interface UpdateComponentDataOutput {
  success: boolean;
}

/** #4 — キュレーション完了マーク */
export interface MarkCurationCompleteInput {
  queue_id: number;
  result_component_ids: string[];
}
export interface MarkCurationCompleteOutput {
  success: boolean;
}

/** #5 — 重複チェック用の類似検索 */
export interface GetSimilarComponentsInput {
  type: ComponentType;
  query_text: string;
  limit: number; // default: 5
}
export interface GetSimilarComponentsOutput {
  results: Array<{
    component_id: string;
    similarity: number;
  }>;
}

/** #6 — 人間レビュー用に送信 */
export interface SubmitForHumanReviewInput {
  component_ids: string[];
  summary: string;
}
export interface SubmitForHumanReviewOutput {
  success: boolean;
}

/** #7 — キャラクタープロフィール自動生成 */
export interface CreateCharacterProfileInput {
  niche: string;
  target_market: string;
  personality_traits?: string[];
  name_suggestion?: string;
}
export interface CreateCharacterProfileOutput {
  character_id: string;
  name: string;
  personality: Record<string, unknown>;
  status: 'draft';
}

/** #8 — キャラクター画像自動生成 */
export interface GenerateCharacterImageInput {
  character_id: string;
  appearance_description: string;
  style?: 'anime' | 'realistic' | '3d';
}
export interface GenerateCharacterImageOutput {
  image_drive_id: string;
  image_url: string;
}

/** #9 — 音声プロフィール自動選定 */
export interface SelectVoiceProfileInput {
  character_id: string;
  personality: Record<string, unknown>;
  gender?: string;
  age_range?: string;
  language: string;
}
export interface SelectVoiceProfileOutput {
  voice_id: string;
  voice_name: string;
  sample_url: string;
}

// ============================================================================
// 4.11 Dashboard Curation Tools (3 tools)
// 人間がダッシュボードからキュレーション結果をレビューするためのツール群
// (REST API として実装)
// ============================================================================

/** #1 — レビュー待ちコンポーネント一覧 */
export interface GetCuratedComponentsForReviewInput {
  // no parameters
}
export interface GetCuratedComponentsForReviewOutput {
  components: Array<{
    component_id: string;
    type: ComponentType;
    data: Record<string, unknown>;
    curator_confidence: number;
  }>;
}

/** #2 — キュレーション結果の承認/修正 */
export interface ApproveCuratedComponentInput {
  component_id: string;
  modifications?: Record<string, unknown>;
}
export interface ApproveCuratedComponentOutput {
  success: boolean;
}

/** #3 — 参考コンテンツの提出 */
export interface SubmitReferenceContentInput {
  url?: string;
  file_id?: string;
  description: string;
  target_type: string;
}
export interface SubmitReferenceContentOutput {
  queue_id: number;
}

// ============================================================================
// 4.12 Agent Self-Learning & Communication Tools (8 tools)
// 全LLMエージェント共通 — セルフリフレクション、個別学習、人間への通信
// ============================================================================

/** #1 — セルフリフレクション結果の保存 */
export interface SaveReflectionInput {
  agent_type: AgentType;
  cycle_id: number;
  task_description: string;
  self_score: number; // 1-10
  score_reasoning: string;
  what_went_well: string;
  what_to_improve: string;
  next_actions: string[];
  metrics_snapshot?: Record<string, unknown>;
}
export interface SaveReflectionOutput {
  id: number;
}

/** #2 — 直近の自己振り返り取得 */
export interface GetRecentReflectionsInput {
  agent_type: AgentType;
  limit: number; // default: 5
}
export interface GetRecentReflectionsOutput {
  reflections: Array<{
    self_score: number;
    score_reasoning: string;
    next_actions: string[];
    created_at: string;
  }>;
}

/** #3 — 個別学習メモリへの知見保存 */
export interface SaveIndividualLearningInput {
  agent_type: AgentType;
  content: string;
  category: string;
  context?: string;
  confidence?: number;
}
export interface SaveIndividualLearningOutput {
  id: number;
}

/** #4 — 自分の個別学習メモリ取得 */
export interface GetIndividualLearningsInput {
  agent_type: AgentType;
  category?: string;
  limit: number; // default: 20
}
export interface GetIndividualLearningsOutput {
  learnings: Array<{
    content: string;
    category: string;
    times_applied: number;
    last_applied_at: string | null;
  }>;
}

/** #5 — 他エージェントの個別学習メモリ参照 */
export interface PeekOtherAgentLearningsInput {
  target_agent_type: AgentType;
  category?: string;
  limit: number; // default: 10
}
export interface PeekOtherAgentLearningsOutput {
  learnings: Array<{
    content: string;
    category: string;
    agent_type: AgentType;
  }>;
}

/** #6 — 人間への自発的メッセージ送信 */
export interface SubmitAgentMessageInput {
  agent_type: AgentType;
  message_type: string;
  content: string;
  priority?: number;
}
export interface SubmitAgentMessageOutput {
  id: number;
}

/** #7 — 人間からの返信確認 */
export interface GetHumanResponsesInput {
  agent_type: AgentType;
}
export interface GetHumanResponsesOutput {
  responses: Array<{
    message_id: number;
    response_content: string;
    responded_at: string;
  }>;
}

/** #8 — 個別学習メモリの知見を使用した記録 */
export interface MarkLearningAppliedInput {
  learning_id: number;
}
export interface MarkLearningAppliedOutput {
  success: boolean;
}

// ============================================================================
// 4.13 Micro-Cycle Learning Tools (per-content) — 6 tools
// ============================================================================

/** #1 — content_learningsベクトル検索 + nicheフィルタ */
export interface SearchContentLearningsInput {
  query_embedding: number[];
  niche?: string;
  limit?: number; // default: 10
  min_confidence?: number; // default: 0.5
}
export interface SearchContentLearningsOutput {
  learnings: Array<{
    id: string;
    content_id: string;
    micro_verdict: 'confirmed' | 'inconclusive' | 'rejected';
    key_insight: string | null;
    confidence: number;
    similarity: number;
    niche: string | null;
    created_at: string;
  }>;
}

/** #2 — per-contentマイクロ分析結果の保存 */
export interface CreateMicroAnalysisInput {
  content_id: string;
  hypothesis_id?: number | null;
  predicted_kpis: Record<string, number>;
  actual_kpis: Record<string, number>;
  micro_verdict: 'confirmed' | 'inconclusive' | 'rejected';
  contributing_factors?: string[];
  detractors?: string[];
  niche?: string;
}
export interface CreateMicroAnalysisOutput {
  id: string;
  content_id: string;
  prediction_error: number;
  micro_verdict: 'confirmed' | 'inconclusive' | 'rejected';
}

/** #3 — マイクロ反省の保存 */
export interface SaveMicroReflectionInput {
  content_learning_id: string;
  what_worked: string[];
  what_didnt_work: string[];
  key_insight: string;
  applicable_to?: string[];
  confidence?: number;
  embedding?: number[];
}
export interface SaveMicroReflectionOutput {
  success: boolean;
  promoted_to_learning_id: string | null; // NULL if not promoted yet
}

/** #4 — publications→metrics経由で実測KPI取得 */
export interface GetContentMetricsInput {
  content_id: string;
}
export interface GetContentMetricsOutput {
  content_id: string;
  publications: Array<{
    publication_id: number;
    platform: string;
    metrics: Record<string, number> | null; // null if not yet measured
    measured_at: string | null;
  }>;
  aggregated_kpis: Record<string, number>; // avg across platforms
}

/** #5 — 仮説のpredicted_kpis取得 */
export interface GetContentPredictionInput {
  content_id: string;
}
export interface GetContentPredictionOutput {
  content_id: string;
  hypothesis_id: number | null;
  predicted_kpis: Record<string, number> | null; // null if no hypothesis
  hypothesis_category: string | null;
  /** Baseline impressions used (from prediction_snapshots) */
  baseline_used: number | null;
  /** Baseline source: own_history / cohort / default */
  baseline_source: string | null;
  /** Per-factor adjustment details */
  adjustments_applied: Record<string, { value: string; adjustment: number; weight: number }> | null;
  /** Sum of all weighted adjustments */
  total_adjustment: number | null;
  /** Predicted impressions from algorithm */
  predicted_impressions: number | null;
}

/** #6 — 日次マイクロ分析サマリー */
export interface GetDailyMicroAnalysesSummaryInput {
  date?: string; // ISO date, default: today
  niche?: string;
}
export interface GetDailyMicroAnalysesSummaryOutput {
  date: string;
  total_analyses: number;
  confirmed: number;
  inconclusive: number;
  rejected: number;
  avg_prediction_error: number;
  top_insights: string[];
  promoted_count: number; // how many were promoted to learnings
}

// ============================================================================
// Tool Registry — maps tool names to their Input/Output types
// ============================================================================

export interface McpToolMap {
  // 4.1 Strategic Agent (10)
  get_portfolio_kpi_summary: { input: GetPortfolioKpiSummaryInput; output: GetPortfolioKpiSummaryOutput };
  get_cluster_performance: { input: GetClusterPerformanceInput; output: GetClusterPerformanceOutput };
  get_top_learnings: { input: GetTopLearningsInput; output: GetTopLearningsOutput };
  get_active_hypotheses: { input: GetActiveHypothesesInput; output: GetActiveHypothesesOutput };
  get_algorithm_performance: { input: GetAlgorithmPerformanceInput; output: GetAlgorithmPerformanceOutput };
  get_pending_directives: { input: GetPendingDirectivesInput; output: GetPendingDirectivesOutput };
  create_cycle: { input: CreateCycleInput; output: CreateCycleOutput };
  set_cycle_plan: { input: SetCyclePlanInput; output: SetCyclePlanOutput };
  allocate_resources: { input: AllocateResourcesInput; output: AllocateResourcesOutput };
  send_planner_directive: { input: SendPlannerDirectiveInput; output: SendPlannerDirectiveOutput };

  // 4.2 Researcher (12)
  save_trending_topic: { input: SaveTrendingTopicInput; output: SaveTrendingTopicOutput };
  save_competitor_post: { input: SaveCompetitorPostInput; output: SaveCompetitorPostOutput };
  save_competitor_account: { input: SaveCompetitorAccountInput; output: SaveCompetitorAccountOutput };
  save_audience_signal: { input: SaveAudienceSignalInput; output: SaveAudienceSignalOutput };
  save_platform_update: { input: SavePlatformUpdateInput; output: SavePlatformUpdateOutput };
  get_recent_intel: { input: GetRecentIntelInput; output: GetRecentIntelOutput };
  search_similar_intel: { input: SearchSimilarIntelInput; output: SearchSimilarIntelOutput };
  get_niche_trends: { input: GetNicheTrendsInput; output: GetNicheTrendsOutput };
  get_competitor_analysis: { input: GetCompetitorAnalysisInput; output: GetCompetitorAnalysisOutput };
  get_platform_changes: { input: GetPlatformChangesInput; output: GetPlatformChangesOutput };
  mark_intel_expired: { input: MarkIntelExpiredInput; output: MarkIntelExpiredOutput };
  get_intel_gaps: { input: GetIntelGapsInput; output: GetIntelGapsOutput };

  // 4.3 Analyst (14)
  get_metrics_for_analysis: { input: GetMetricsForAnalysisInput; output: GetMetricsForAnalysisOutput };
  get_hypothesis_results: { input: GetHypothesisResultsInput; output: GetHypothesisResultsOutput };
  verify_hypothesis: { input: VerifyHypothesisInput; output: VerifyHypothesisOutput };
  create_analysis: { input: CreateAnalysisInput; output: CreateAnalysisOutput };
  extract_learning: { input: ExtractLearningInput; output: ExtractLearningOutput };
  update_learning_confidence: { input: UpdateLearningConfidenceInput; output: UpdateLearningConfidenceOutput };
  search_similar_learnings: { input: SearchSimilarLearningsInput; output: SearchSimilarLearningsOutput };
  detect_anomalies: { input: DetectAnomaliesInput; output: DetectAnomaliesOutput };
  get_component_scores: { input: GetComponentScoresInput; output: GetComponentScoresOutput };
  update_component_score: { input: UpdateComponentScoreInput; output: UpdateComponentScoreOutput };
  calculate_algorithm_performance: { input: CalculateAlgorithmPerformanceInput; output: CalculateAlgorithmPerformanceOutput };
  get_niche_performance_trends: { input: GetNichePerformanceTrendsInput; output: GetNichePerformanceTrendsOutput };
  compare_hypothesis_predictions: { input: CompareHypothesisPredictionsInput; output: CompareHypothesisPredictionsOutput };
  generate_improvement_suggestions: { input: GenerateImprovementSuggestionsInput; output: GenerateImprovementSuggestionsOutput };

  // 4.4 Planner (9)
  get_assigned_accounts: { input: GetAssignedAccountsInput; output: GetAssignedAccountsOutput };
  get_account_performance: { input: GetAccountPerformanceInput; output: GetAccountPerformanceOutput };
  get_available_components: { input: GetAvailableComponentsInput; output: GetAvailableComponentsOutput };
  create_hypothesis: { input: CreateHypothesisInput; output: CreateHypothesisOutput };
  plan_content: { input: PlanContentInput; output: PlanContentOutput };
  schedule_content: { input: ScheduleContentInput; output: ScheduleContentOutput };
  get_niche_learnings: { input: GetNicheLearningsInput; output: GetNicheLearningsOutput };
  get_content_pool_status: { input: GetContentPoolStatusInput; output: GetContentPoolStatusOutput };
  request_production: { input: RequestProductionInput; output: RequestProductionOutput };

  // 4.5 Tool Specialist (5)
  get_tool_knowledge: { input: GetToolKnowledgeInput; output: GetToolKnowledgeOutput };
  save_tool_experience: { input: SaveToolExperienceInput; output: SaveToolExperienceOutput };
  search_similar_tool_usage: { input: SearchSimilarToolUsageInput; output: SearchSimilarToolUsageOutput };
  get_tool_recommendations: { input: GetToolRecommendationsInput; output: GetToolRecommendationsOutput };
  update_tool_knowledge_from_external: { input: UpdateToolKnowledgeFromExternalInput; output: UpdateToolKnowledgeFromExternalOutput };

  // 4.6 Production Worker (12)
  get_production_task: { input: GetProductionTaskInput; output: GetProductionTaskOutput };
  generate_script: { input: GenerateScriptInput; output: GenerateScriptOutput };
  get_character_info: { input: GetCharacterInfoInput; output: GetCharacterInfoOutput };
  get_component_data: { input: GetComponentDataInput; output: GetComponentDataOutput };
  start_video_generation: { input: StartVideoGenerationInput; output: StartVideoGenerationOutput };
  check_video_status: { input: CheckVideoStatusInput; output: CheckVideoStatusOutput };
  start_tts: { input: StartTtsInput; output: StartTtsOutput };
  start_lipsync: { input: StartLipsyncInput; output: StartLipsyncOutput };
  upload_to_drive: { input: UploadToDriveInput; output: UploadToDriveOutput };
  update_content_status: { input: UpdateContentStatusInput; output: UpdateContentStatusOutput };
  run_quality_check: { input: RunQualityCheckInput; output: RunQualityCheckOutput };
  report_production_complete: { input: ReportProductionCompleteInput; output: ReportProductionCompleteOutput };

  // 4.7 Publishing Worker (6)
  get_publish_task: { input: GetPublishTaskInput; output: GetPublishTaskOutput };
  publish_to_youtube: { input: PublishToYoutubeInput; output: PublishToYoutubeOutput };
  publish_to_tiktok: { input: PublishToTiktokInput; output: PublishToTiktokOutput };
  publish_to_instagram: { input: PublishToInstagramInput; output: PublishToInstagramOutput };
  publish_to_x: { input: PublishToXInput; output: PublishToXOutput };
  report_publish_result: { input: ReportPublishResultInput; output: ReportPublishResultOutput };

  // 4.8 Measurement Worker (7)
  get_measurement_tasks: { input: GetMeasurementTasksInput; output: GetMeasurementTasksOutput };
  collect_youtube_metrics: { input: CollectYoutubeMetricsInput; output: CollectYoutubeMetricsOutput };
  collect_tiktok_metrics: { input: CollectTiktokMetricsInput; output: CollectTiktokMetricsOutput };
  collect_instagram_metrics: { input: CollectInstagramMetricsInput; output: CollectInstagramMetricsOutput };
  collect_x_metrics: { input: CollectXMetricsInput; output: CollectXMetricsOutput };
  collect_account_metrics: { input: CollectAccountMetricsInput; output: CollectAccountMetricsOutput };
  report_measurement_complete: { input: ReportMeasurementCompleteInput; output: ReportMeasurementCompleteOutput };

  // 4.9 Dashboard (10)
  get_dashboard_summary: { input: GetDashboardSummaryInput; output: GetDashboardSummaryOutput };
  update_system_config: { input: UpdateSystemConfigInput; output: UpdateSystemConfigOutput };
  submit_human_directive: { input: SubmitHumanDirectiveInput; output: SubmitHumanDirectiveOutput };
  get_pending_approvals: { input: GetPendingApprovalsInput; output: GetPendingApprovalsOutput };
  approve_or_reject_plan: { input: ApproveOrRejectPlanInput; output: ApproveOrRejectPlanOutput };
  submit_learning_guidance: { input: SubmitLearningGuidanceInput; output: SubmitLearningGuidanceOutput };
  get_learning_directives: { input: GetLearningDirectivesInput; output: GetLearningDirectivesOutput };
  update_agent_prompt: { input: UpdateAgentPromptInput; output: UpdateAgentPromptOutput };
  rollback_agent_prompt: { input: RollbackAgentPromptInput; output: RollbackAgentPromptOutput };
  update_prompt_suggestion_status: { input: UpdatePromptSuggestionStatusInput; output: UpdatePromptSuggestionStatusOutput };

  // 4.10 Data Curator (9)
  get_curation_queue: { input: GetCurationQueueInput; output: GetCurationQueueOutput };
  create_component: { input: CreateComponentInput; output: CreateComponentOutput };
  update_component_data: { input: UpdateComponentDataInput; output: UpdateComponentDataOutput };
  mark_curation_complete: { input: MarkCurationCompleteInput; output: MarkCurationCompleteOutput };
  get_similar_components: { input: GetSimilarComponentsInput; output: GetSimilarComponentsOutput };
  submit_for_human_review: { input: SubmitForHumanReviewInput; output: SubmitForHumanReviewOutput };
  create_character_profile: { input: CreateCharacterProfileInput; output: CreateCharacterProfileOutput };
  generate_character_image: { input: GenerateCharacterImageInput; output: GenerateCharacterImageOutput };
  select_voice_profile: { input: SelectVoiceProfileInput; output: SelectVoiceProfileOutput };

  // 4.11 Dashboard Curation (3)
  get_curated_components_for_review: { input: GetCuratedComponentsForReviewInput; output: GetCuratedComponentsForReviewOutput };
  approve_curated_component: { input: ApproveCuratedComponentInput; output: ApproveCuratedComponentOutput };
  submit_reference_content: { input: SubmitReferenceContentInput; output: SubmitReferenceContentOutput };

  // 4.12 Self-Learning & Communication (8)
  save_reflection: { input: SaveReflectionInput; output: SaveReflectionOutput };
  get_recent_reflections: { input: GetRecentReflectionsInput; output: GetRecentReflectionsOutput };
  save_individual_learning: { input: SaveIndividualLearningInput; output: SaveIndividualLearningOutput };
  get_individual_learnings: { input: GetIndividualLearningsInput; output: GetIndividualLearningsOutput };
  peek_other_agent_learnings: { input: PeekOtherAgentLearningsInput; output: PeekOtherAgentLearningsOutput };
  submit_agent_message: { input: SubmitAgentMessageInput; output: SubmitAgentMessageOutput };
  get_human_responses: { input: GetHumanResponsesInput; output: GetHumanResponsesOutput };
  mark_learning_applied: { input: MarkLearningAppliedInput; output: MarkLearningAppliedOutput };

  // 4.13 Micro-Cycle Learning (6)
  search_content_learnings: { input: SearchContentLearningsInput; output: SearchContentLearningsOutput };
  create_micro_analysis: { input: CreateMicroAnalysisInput; output: CreateMicroAnalysisOutput };
  save_micro_reflection: { input: SaveMicroReflectionInput; output: SaveMicroReflectionOutput };
  get_content_metrics: { input: GetContentMetricsInput; output: GetContentMetricsOutput };
  get_content_prediction: { input: GetContentPredictionInput; output: GetContentPredictionOutput };
  get_daily_micro_analyses_summary: { input: GetDailyMicroAnalysesSummaryInput; output: GetDailyMicroAnalysesSummaryOutput };
}

/** Union type of all MCP tool names */
export type McpToolName = keyof McpToolMap;

/** Get the input type for a given tool name */
export type McpToolInput<T extends McpToolName> = McpToolMap[T]['input'];

/** Get the output type for a given tool name */
export type McpToolOutput<T extends McpToolName> = McpToolMap[T]['output'];

// ============================================================================
// Agent-to-Tool Access Matrix
// Which agents can access which tools (for System Prompt restrictions)
// ============================================================================

export interface AgentToolAccess {
  strategist: [
    'get_portfolio_kpi_summary', 'get_cluster_performance', 'get_top_learnings',
    'get_active_hypotheses', 'get_algorithm_performance', 'get_pending_directives',
    'create_cycle', 'set_cycle_plan', 'allocate_resources', 'send_planner_directive',
    // + self-learning tools
    'save_reflection', 'get_recent_reflections', 'save_individual_learning',
    'get_individual_learnings', 'peek_other_agent_learnings',
    'submit_agent_message', 'get_human_responses', 'mark_learning_applied',
  ];
  researcher: [
    'save_trending_topic', 'save_competitor_post', 'save_competitor_account',
    'save_audience_signal', 'save_platform_update', 'get_recent_intel',
    'search_similar_intel', 'get_niche_trends', 'get_competitor_analysis',
    'get_platform_changes', 'mark_intel_expired', 'get_intel_gaps',
    // + self-learning tools
    'save_reflection', 'get_recent_reflections', 'save_individual_learning',
    'get_individual_learnings', 'peek_other_agent_learnings',
    'submit_agent_message', 'get_human_responses', 'mark_learning_applied',
  ];
  analyst: [
    'get_metrics_for_analysis', 'get_hypothesis_results', 'verify_hypothesis',
    'create_analysis', 'extract_learning', 'update_learning_confidence',
    'search_similar_learnings', 'detect_anomalies', 'get_component_scores',
    'update_component_score', 'calculate_algorithm_performance',
    'get_niche_performance_trends', 'compare_hypothesis_predictions',
    'generate_improvement_suggestions',
    // + self-learning tools
    'save_reflection', 'get_recent_reflections', 'save_individual_learning',
    'get_individual_learnings', 'peek_other_agent_learnings',
    'submit_agent_message', 'get_human_responses', 'mark_learning_applied',
  ];
  planner: [
    'get_assigned_accounts', 'get_account_performance', 'get_available_components',
    'create_hypothesis', 'plan_content', 'schedule_content',
    'get_niche_learnings', 'get_content_pool_status', 'request_production',
    // + self-learning tools
    'save_reflection', 'get_recent_reflections', 'save_individual_learning',
    'get_individual_learnings', 'peek_other_agent_learnings',
    'submit_agent_message', 'get_human_responses', 'mark_learning_applied',
  ];
  tool_specialist: [
    'get_tool_knowledge', 'save_tool_experience', 'search_similar_tool_usage',
    'get_tool_recommendations', 'update_tool_knowledge_from_external',
    // + self-learning tools
    'save_reflection', 'get_recent_reflections', 'save_individual_learning',
    'get_individual_learnings', 'peek_other_agent_learnings',
    'submit_agent_message', 'get_human_responses', 'mark_learning_applied',
  ];
  data_curator: [
    'get_curation_queue', 'create_component', 'update_component_data',
    'mark_curation_complete', 'get_similar_components', 'submit_for_human_review',
    'create_character_profile', 'generate_character_image', 'select_voice_profile',
    // + self-learning tools
    'save_reflection', 'get_recent_reflections', 'save_individual_learning',
    'get_individual_learnings', 'peek_other_agent_learnings',
    'submit_agent_message', 'get_human_responses', 'mark_learning_applied',
  ];
  production_worker: [
    'get_production_task', 'generate_script', 'get_character_info',
    'get_component_data', 'start_video_generation', 'check_video_status',
    'start_tts', 'start_lipsync', 'upload_to_drive',
    'update_content_status', 'run_quality_check', 'report_production_complete',
  ];
  publishing_worker: [
    'get_publish_task', 'publish_to_youtube', 'publish_to_tiktok',
    'publish_to_instagram', 'publish_to_x', 'report_publish_result',
  ];
  measurement_worker: [
    'get_measurement_tasks', 'collect_youtube_metrics', 'collect_tiktok_metrics',
    'collect_instagram_metrics', 'collect_x_metrics', 'collect_account_metrics',
    'report_measurement_complete',
  ];
}
