// AUTO-GENERATED from 02-architecture.md Section 6.13 — DO NOT EDIT MANUALLY
//
// Dashboard REST API route interfaces (13 endpoints)
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
}

/** Union type of all API route keys */
export type ApiRoute = keyof ApiRouteMap;

/** Get the request type for a given route */
export type ApiRequest<T extends ApiRoute> = ApiRouteMap[T]['request'];

/** Get the response type for a given route */
export type ApiResponse<T extends ApiRoute> = ApiRouteMap[T]['response'];
