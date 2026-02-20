// AUTO-GENERATED from 02-architecture.md Section 6.13 — DO NOT EDIT MANUALLY
//
// Dashboard REST API route interfaces (19 endpoints: 13 base + 6 algorithm/KPI)
// Next.js API Routes, Prisma/Drizzle ORM → PostgreSQL direct

import type {
  AccountRow,
  CharacterRow,
  ContentRow,
  PublicationRow,
  HypothesisRow,
  LearningRow,
  SystemSettingRow,
  ContentStatus,
  PublicationStatus,
  HypothesisVerdict,
  Platform,
} from './database';

// ============================================================================
// #1 — GET /api/accounts
// アカウント一覧（プラットフォーム/ステータスでフィルター可）
// ============================================================================

export interface ListAccountsRequest {
  platform?: Platform;
  status?: 'active' | 'paused' | 'suspended';
  page?: number;
  limit?: number;
}

export interface ListAccountsResponse {
  accounts: AccountRow[];
  total: number;
}

// ============================================================================
// #2 — GET /api/accounts/:id
// アカウント詳細（関連characters, publications含む）
// ============================================================================

export interface GetAccountRequest {
  id: string; // ACC_XXXX
}

export interface GetAccountResponse {
  account: AccountRow & {
    character?: CharacterRow;
    recent_publications?: PublicationRow[];
  };
}

// ============================================================================
// #3 — POST /api/accounts
// アカウント新規作成
// ============================================================================

export interface CreateAccountRequest {
  platform: Platform;
  handle: string;
  character_id: string;
  niche?: string;
  cluster?: string;
  auth_credentials?: Record<string, unknown>;
}

export interface CreateAccountResponse {
  account: AccountRow;
}

// ============================================================================
// #4 — PUT /api/accounts/:id
// アカウント更新
// ============================================================================

export interface UpdateAccountRequest {
  id: string; // ACC_XXXX (path param)
  handle?: string;
  status?: 'active' | 'paused' | 'suspended';
  niche?: string;
  cluster?: string;
  character_id?: string;
  auth_credentials?: Record<string, unknown>;
}

export interface UpdateAccountResponse {
  account: AccountRow;
}

// ============================================================================
// #5 — GET /api/content
// コンテンツ一覧（statusフィルター, ページネーション）
// ============================================================================

export interface ListContentRequest {
  status?: ContentStatus;
  content_format?: 'short_video' | 'text_post' | 'image_post';
  character_id?: string;
  page?: number;
  limit?: number;
}

export interface ListContentResponse {
  content: ContentRow[];
  total: number;
}

// ============================================================================
// #6 — POST /api/content/:id/approve
// コンテンツ承認（pending_approval → approved）
// ============================================================================

export interface ApproveContentRequest {
  id: string; // CNT_XXXXXX_XXXX (path param)
  comment?: string;
}

export interface ApproveContentResponse {
  content: ContentRow;
}

// ============================================================================
// #7 — POST /api/content/:id/reject
// コンテンツ差し戻し（pending_approval → rejected）
// ============================================================================

export interface RejectContentRequest {
  id: string; // CNT_XXXXXX_XXXX (path param)
  comment: string;
  rejection_category: 'plan_revision' | 'data_insufficient' | 'hypothesis_weak';
}

export interface RejectContentResponse {
  content: ContentRow;
}

// ============================================================================
// #8 — GET /api/kpi/summary
// KPIダッシュボードデータ（目標vs実績, 期間別）
// ============================================================================

export interface GetKpiSummaryRequest {
  period?: '7d' | '30d' | '90d';
}

export interface GetKpiSummaryResponse {
  accounts: number;
  followers: {
    current: number;
    target: number;
    growth_rate: number;
  };
  engagement: {
    avg_rate: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  content: {
    total_produced: number;
    total_posted: number;
    total_measured: number;
  };
  monetization: {
    monetized_count: number;
    revenue_estimate: number;
  };
  /** Overall prediction accuracy (weighted average across platforms) */
  prediction_accuracy: number | null;
}

// ============================================================================
// #9 — GET /api/hypotheses
// 仮説一覧（ステータス/カテゴリでフィルター可）
// ============================================================================

export interface ListHypothesesRequest {
  verdict?: HypothesisVerdict;
  category?: string;
  page?: number;
  limit?: number;
}

export interface ListHypothesesResponse {
  hypotheses: HypothesisRow[];
  total: number;
}

// ============================================================================
// #10 — GET /api/learnings
// 知見一覧（信頼度/カテゴリでフィルター可）
// ============================================================================

export interface ListLearningsRequest {
  min_confidence?: number;
  category?: string;
  page?: number;
  limit?: number;
}

export interface ListLearningsResponse {
  learnings: LearningRow[];
  total: number;
}

// ============================================================================
// #11 — GET /api/settings
// 全system_settingsの取得（カテゴリ別グルーピング）
// ============================================================================

export interface ListSettingsRequest {
  category?: string;
}

export interface ListSettingsResponse {
  settings: SystemSettingRow[];
}

// ============================================================================
// #12 — PUT /api/settings/:key
// system_setting値の更新
// ============================================================================

export interface UpdateSettingRequest {
  key: string; // path param
  value: unknown;
}

export interface UpdateSettingResponse {
  setting: SystemSettingRow;
}

// ============================================================================
// #13 — GET /api/errors
// エラーログ一覧（期間/タスクタイプでフィルター可）
// ============================================================================

export interface ListErrorsRequest {
  period?: '24h' | '7d' | '30d';
  task_type?: 'production' | 'publishing' | 'measurement' | 'curation';
  page?: number;
  limit?: number;
}

export interface ErrorLogEntry {
  id: number;
  task_type: string;
  task_id: number;
  error_message: string;
  error_stack?: string;
  retry_count: number;
  status: 'retrying' | 'failed' | 'resolved';
  created_at: string;
  resolved_at?: string;
}

export interface ListErrorsResponse {
  errors: ErrorLogEntry[];
  total: number;
}

// ============================================================================
// #14 — GET /api/predictions/:publication_id
// 投稿単位の予測スナップショット取得
// ============================================================================

export interface GetPredictionRequest {
  publication_id: number; // path param
}

export interface GetPredictionResponse {
  prediction: {
    id: number;
    publication_id: number;
    content_id: string;
    account_id: string;
    hypothesis_id: number | null;
    baseline_used: number;
    baseline_source: 'own_history' | 'cohort' | 'default';
    adjustments_applied: Record<string, { value: string; adjustment: number; weight: number }>;
    total_adjustment: number;
    predicted_impressions: number;
    actual_impressions_48h: number | null;
    actual_impressions_7d: number | null;
    actual_impressions_30d: number | null;
    prediction_error_7d: number | null;
    prediction_error_30d: number | null;
    created_at: string;
    updated_at: string;
  } | null;
}

// ============================================================================
// #15 — GET /api/algorithm/performance
// アルゴリズムパフォーマンス（prediction accuracy + weight audit）
// ============================================================================

export interface GetAlgorithmPerformanceRequest {
  platform?: Platform;
  period?: '7d' | '30d' | '90d';
}

export interface GetAlgorithmPerformanceResponse {
  overall_prediction_accuracy: number | null;
  platform_breakdown: Array<{
    platform: string;
    prediction_accuracy: number | null;
    publication_count: number;
    avg_error_7d: number | null;
  }>;
  weight_history: Array<{
    platform: string;
    factor_name: string;
    current_weight: number;
    updated_at: string;
  }>;
}

// ============================================================================
// #16 — GET /api/baselines/:account_id
// アカウント別ベースラインデータ取得
// ============================================================================

export interface GetBaselineRequest {
  account_id: string; // path param
}

export interface GetBaselineResponse {
  baseline: {
    account_id: string;
    baseline_impressions: number;
    source: 'own_history' | 'cohort' | 'default';
    sample_count: number;
    window_start: string;
    window_end: string;
    calculated_at: string;
  } | null;
}

// ============================================================================
// #17 — GET /api/weights/audit
// Weight変更監査ログ取得
// ============================================================================

export interface GetWeightAuditRequest {
  platform?: Platform;
  limit?: number;
}

export interface GetWeightAuditResponse {
  audit_logs: Array<{
    id: number;
    platform: string;
    factor_name: string;
    old_weight: number;
    new_weight: number;
    data_count: number;
    metrics_count: number;
    calculated_at: string;
  }>;
  total: number;
}

// ============================================================================
// #18 — GET /api/kpi/snapshots
// KPIスナップショット一覧（プラットフォーム/月別）
// ============================================================================

export interface ListKpiSnapshotsRequest {
  platform?: Platform;
  year_month?: string; // YYYY-MM
}

export interface ListKpiSnapshotsResponse {
  snapshots: Array<{
    id: number;
    platform: string;
    year_month: string;
    kpi_target: number;
    avg_impressions: number;
    achievement_rate: number;
    account_count: number;
    publication_count: number;
    prediction_accuracy: number | null;
    is_reliable: boolean;
    calculated_at: string;
  }>;
}

// ============================================================================
// #19 — POST /api/kpi/snapshots
// KPIスナップショット手動生成（通常は月次バッチ自動実行）
// ============================================================================

export interface CreateKpiSnapshotRequest {
  platform: Platform;
  year_month: string; // YYYY-MM
}

export interface CreateKpiSnapshotResponse {
  snapshot: {
    id: number;
    platform: string;
    year_month: string;
    kpi_target: number;
    avg_impressions: number;
    achievement_rate: number;
    account_count: number;
    publication_count: number;
    prediction_accuracy: number | null;
    is_reliable: boolean;
    calculated_at: string;
  };
}

// ============================================================================
// API Route Registry — maps routes to request/response types
// ============================================================================

export interface ApiRouteMap {
  /** GET /api/accounts */
  'GET /api/accounts': { request: ListAccountsRequest; response: ListAccountsResponse };
  /** GET /api/accounts/:id */
  'GET /api/accounts/:id': { request: GetAccountRequest; response: GetAccountResponse };
  /** POST /api/accounts */
  'POST /api/accounts': { request: CreateAccountRequest; response: CreateAccountResponse };
  /** PUT /api/accounts/:id */
  'PUT /api/accounts/:id': { request: UpdateAccountRequest; response: UpdateAccountResponse };
  /** GET /api/content */
  'GET /api/content': { request: ListContentRequest; response: ListContentResponse };
  /** POST /api/content/:id/approve */
  'POST /api/content/:id/approve': { request: ApproveContentRequest; response: ApproveContentResponse };
  /** POST /api/content/:id/reject */
  'POST /api/content/:id/reject': { request: RejectContentRequest; response: RejectContentResponse };
  /** GET /api/kpi/summary */
  'GET /api/kpi/summary': { request: GetKpiSummaryRequest; response: GetKpiSummaryResponse };
  /** GET /api/hypotheses */
  'GET /api/hypotheses': { request: ListHypothesesRequest; response: ListHypothesesResponse };
  /** GET /api/learnings */
  'GET /api/learnings': { request: ListLearningsRequest; response: ListLearningsResponse };
  /** GET /api/settings */
  'GET /api/settings': { request: ListSettingsRequest; response: ListSettingsResponse };
  /** PUT /api/settings/:key */
  'PUT /api/settings/:key': { request: UpdateSettingRequest; response: UpdateSettingResponse };
  /** GET /api/errors */
  'GET /api/errors': { request: ListErrorsRequest; response: ListErrorsResponse };
  /** GET /api/predictions/:publication_id */
  'GET /api/predictions/:publication_id': { request: GetPredictionRequest; response: GetPredictionResponse };
  /** GET /api/algorithm/performance */
  'GET /api/algorithm/performance': { request: GetAlgorithmPerformanceRequest; response: GetAlgorithmPerformanceResponse };
  /** GET /api/baselines/:account_id */
  'GET /api/baselines/:account_id': { request: GetBaselineRequest; response: GetBaselineResponse };
  /** GET /api/weights/audit */
  'GET /api/weights/audit': { request: GetWeightAuditRequest; response: GetWeightAuditResponse };
  /** GET /api/kpi/snapshots */
  'GET /api/kpi/snapshots': { request: ListKpiSnapshotsRequest; response: ListKpiSnapshotsResponse };
  /** POST /api/kpi/snapshots */
  'POST /api/kpi/snapshots': { request: CreateKpiSnapshotRequest; response: CreateKpiSnapshotResponse };
}

/** Union type of all API route keys */
export type ApiRoute = keyof ApiRouteMap;

/** Get the request type for a given route */
export type ApiRequest<T extends ApiRoute> = ApiRouteMap[T]['request'];

/** Get the response type for a given route */
export type ApiResponse<T extends ApiRoute> = ApiRouteMap[T]['response'];
