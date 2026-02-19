// AUTO-GENERATED from 03-database-schema.md — DO NOT EDIT MANUALLY
// Frozen at Week 0-1. Changes require leader approval + team notification.

// ============================================================================
// Shared Enum / Union Types
// ============================================================================

/** Platform identifiers used across accounts, publications, market_intel */
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'x';

/** Agent types used across observability & tool management tables */
export type AgentType =
  | 'strategist'
  | 'researcher'
  | 'analyst'
  | 'planner'
  | 'tool_specialist'
  | 'data_curator';

/** Priority levels used in human_directives, agent_communications, task_queue */
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

// ============================================================================
// 1. Entity Layer — accounts, characters, components
// ============================================================================

// --- accounts ---

export type AccountStatus = 'active' | 'suspended' | 'setup';
export type MonetizationStatus = 'none' | 'eligible' | 'active';

/** YouTube OAuth credentials stored in accounts.auth_credentials */
export interface YouTubeOAuthCredentials {
  channel_id: string;
  oauth: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
    access_token: string;
    token_expiry: string;
  };
}

/** TikTok OAuth credentials stored in accounts.auth_credentials */
export interface TikTokOAuthCredentials {
  open_id: string;
  oauth: {
    client_key: string;
    client_secret: string;
    access_token: string;
    refresh_token: string;
    token_expiry: string;
  };
}

/** Instagram OAuth credentials stored in accounts.auth_credentials */
export interface InstagramOAuthCredentials {
  ig_user_id: string;
  page_id: string;
  oauth: {
    app_id: string;
    app_secret: string;
    long_lived_token: string;
    token_expiry: string;
  };
}

/** X (Twitter) OAuth credentials stored in accounts.auth_credentials */
export interface XOAuthCredentials {
  user_id: string;
  oauth: {
    api_key: string;
    api_secret: string;
    access_token: string;
    access_token_secret: string;
  };
}

/** Union of all platform-specific auth credential shapes */
export type AuthCredentials =
  | YouTubeOAuthCredentials
  | TikTokOAuthCredentials
  | InstagramOAuthCredentials
  | XOAuthCredentials;

/** Row type for the `accounts` table */
export interface AccountRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** ACC_0001 format unique ID (VARCHAR(20)) */
  account_id: string;
  /** Platform: youtube / tiktok / instagram / x */
  platform: Platform;
  /** Platform display name, e.g. @hana_beauty_jp */
  platform_username: string | null;
  /** Platform internal ID (e.g. YouTube channel ID, X user ID) */
  platform_account_id: string | null;
  /** FK to characters.character_id */
  character_id: string | null;
  /** Niche: beauty / tech / fitness / pet / cooking / gaming etc. */
  niche: string | null;
  /** A/B test cluster grouping */
  cluster: string | null;
  /** Account persona description (free text) */
  persona_description: string | null;
  /** OAuth tokens (JSONB). Encrypt in production */
  auth_credentials: AuthCredentials | null;
  /** active / suspended / setup (default: 'setup') */
  status: AccountStatus;
  /** Latest follower count (default: 0) */
  follower_count: number;
  /** none / eligible / active (default: 'none') */
  monetization_status: MonetizationStatus;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface AccountCreateInput {
  account_id: string;
  platform: Platform;
  platform_username?: string | null;
  platform_account_id?: string | null;
  character_id?: string | null;
  niche?: string | null;
  cluster?: string | null;
  persona_description?: string | null;
  auth_credentials?: AuthCredentials | null;
  status?: AccountStatus;
  follower_count?: number;
  monetization_status?: MonetizationStatus;
}

export interface AccountUpdateInput {
  id: number;
  account_id?: string;
  platform?: Platform;
  platform_username?: string | null;
  platform_account_id?: string | null;
  character_id?: string | null;
  niche?: string | null;
  cluster?: string | null;
  persona_description?: string | null;
  auth_credentials?: AuthCredentials | null;
  status?: AccountStatus;
  follower_count?: number;
  monetization_status?: MonetizationStatus;
}

// --- characters ---

/** JSONB shape for characters.appearance */
export interface CharacterAppearance {
  gender?: string;
  age_range?: string;
  hair_color?: string;
  hair_style?: string;
  eye_color?: string;
  skin_tone?: string;
  style?: string;
  [key: string]: unknown;
}

/** JSONB shape for characters.personality */
export interface CharacterPersonality {
  traits?: string[];
  speaking_style?: string;
  language_preference?: string;
  emoji_usage?: string;
  catchphrase?: string;
  [key: string]: unknown;
}

/** Row type for the `characters` table */
export interface CharacterRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** CHR_0001 format unique ID (VARCHAR(20)) */
  character_id: string;
  /** Character name (VARCHAR(100)) */
  name: string;
  /** Character description (free text) */
  description: string | null;
  /** Appearance settings (JSONB) */
  appearance: CharacterAppearance | null;
  /** Personality settings (JSONB) */
  personality: CharacterPersonality | null;
  /** Fish Audio 32-char hex reference_id. Required */
  voice_id: string;
  /** Google Drive file ID for character image (PNG) */
  image_drive_id: string | null;
  /** draft / pending_review / active / archived (default: 'draft') */
  status: 'draft' | 'pending_review' | 'active' | 'archived';
  /** human / curator (default: 'human') */
  created_by: 'human' | 'curator';
  /** Curator generation metadata (JSONB, null for human-created) */
  generation_metadata: Record<string, unknown> | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface CharacterCreateInput {
  character_id: string;
  name: string;
  description?: string | null;
  appearance?: CharacterAppearance | null;
  personality?: CharacterPersonality | null;
  voice_id: string;
  image_drive_id?: string | null;
  status?: 'draft' | 'pending_review' | 'active' | 'archived';
  created_by?: 'human' | 'curator';
  generation_metadata?: Record<string, unknown> | null;
}

export interface CharacterUpdateInput {
  id: number;
  character_id?: string;
  name?: string;
  description?: string | null;
  appearance?: CharacterAppearance | null;
  personality?: CharacterPersonality | null;
  voice_id?: string;
  image_drive_id?: string | null;
  status?: 'draft' | 'pending_review' | 'active' | 'archived';
  created_by?: 'human' | 'curator';
  generation_metadata?: Record<string, unknown> | null;
}

// --- components ---

export type ComponentType = 'scenario' | 'motion' | 'audio' | 'image';
export type CuratedBy = 'auto' | 'human';
export type ComponentReviewStatus = 'auto_approved' | 'pending_review' | 'human_approved';

/** JSONB shape for components.data when type='scenario' */
export interface ComponentScenarioData {
  script_en?: string;
  script_jp?: string;
  scenario_prompt?: string;
  duration_seconds?: number;
  emotion?: string;
  camera_angle?: string;
  [key: string]: unknown;
}

/** JSONB shape for components.data when type='motion' */
export interface ComponentMotionData {
  duration_seconds?: number;
  motion_type?: string;
  character_orientation?: string;
  movement?: string;
  [key: string]: unknown;
}

/** JSONB shape for components.data when type='audio' */
export interface ComponentAudioData {
  duration_seconds?: number;
  genre?: string;
  bpm?: number;
  license?: string;
  [key: string]: unknown;
}

/** Union of typed component data shapes */
export type ComponentData =
  | ComponentScenarioData
  | ComponentMotionData
  | ComponentAudioData
  | Record<string, unknown>;

/** Row type for the `components` table */
export interface ComponentRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** SCN_0001 / MOT_0001 / AUD_0001 / IMG_0001 format (VARCHAR(30)) */
  component_id: string;
  /** scenario / motion / audio / image */
  type: ComponentType;
  /** Usage subtype: hook / body / cta / intro etc. (nullable free tag) */
  subtype: string | null;
  /** Component name (VARCHAR(200)) */
  name: string;
  /** Component description */
  description: string | null;
  /** Type-dependent structured data (JSONB) */
  data: ComponentData | null;
  /** Google Drive file ID */
  drive_file_id: string | null;
  /** Niche: beauty / tech / fitness etc. */
  niche: string | null;
  /** Free-form tag array */
  tags: string[] | null;
  /** Performance score 0.00–100.00 (NUMERIC(5,2)) */
  score: number | null;
  /** Usage count (default: 0) */
  usage_count: number;
  /** auto / human (default: 'human') */
  curated_by: CuratedBy;
  /** Curation confidence 0.00–1.00 (DECIMAL(3,2)) */
  curation_confidence: number | null;
  /** auto_approved / pending_review / human_approved (default: 'auto_approved') */
  review_status: ComponentReviewStatus;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface ComponentCreateInput {
  component_id: string;
  type: ComponentType;
  subtype?: string | null;
  name: string;
  description?: string | null;
  data?: ComponentData | null;
  drive_file_id?: string | null;
  niche?: string | null;
  tags?: string[] | null;
  score?: number | null;
  usage_count?: number;
  curated_by?: CuratedBy;
  curation_confidence?: number | null;
  review_status?: ComponentReviewStatus;
}

export interface ComponentUpdateInput {
  id: number;
  component_id?: string;
  type?: ComponentType;
  subtype?: string | null;
  name?: string;
  description?: string | null;
  data?: ComponentData | null;
  drive_file_id?: string | null;
  niche?: string | null;
  tags?: string[] | null;
  score?: number | null;
  usage_count?: number;
  curated_by?: CuratedBy;
  curation_confidence?: number | null;
  review_status?: ComponentReviewStatus;
}

// ============================================================================
// 2. Production Layer — content, content_sections, publications
// ============================================================================

// --- content ---

export type ContentStatus =
  | 'planned'
  | 'producing'
  | 'ready'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'revision_needed'
  | 'posted'
  | 'measured'
  | 'cancelled'
  | 'analyzed';

export type ContentFormat = 'short_video' | 'text_post' | 'image_post';
export type ContentReviewStatus = 'not_required' | 'pending_review' | 'approved' | 'rejected';
export type ScriptLanguage = 'en' | 'jp';
export type RejectionCategory = 'plan_revision' | 'data_insufficient' | 'hypothesis_weak';

/** JSONB shape for a single section within content.production_metadata */
export interface ProductionMetadataSection {
  order: number;
  label: string;
  fal_request_ids?: Record<string, string>;
  processing_time_seconds?: number;
  file_size_bytes?: number;
}

/** JSONB shape for content.production_metadata */
export interface ProductionMetadata {
  sections?: ProductionMetadataSection[];
  total_seconds?: number;
  concat_seconds?: number;
  final_file_size_bytes?: number;
  pipeline_version?: string;
  dry_run?: boolean;
  [key: string]: unknown;
}

/** Row type for the `content` table */
export interface ContentRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** CNT_YYYYMM_NNNN format (VARCHAR(20)) */
  content_id: string;
  /** FK to hypotheses.id (nullable — null means human-directed) */
  hypothesis_id: number | null;
  /** short_video / text_post / image_post (default: 'short_video') */
  content_format: ContentFormat;
  /** FK to production_recipes.id (nullable for text_post) */
  recipe_id: number | null;
  /** Content lifecycle status (default: 'planned') */
  status: ContentStatus;
  /** Planned posting date */
  planned_post_date: string | null;
  /** FK to characters.character_id */
  character_id: string | null;
  /** en / jp — determines which script variant to use */
  script_language: ScriptLanguage | null;
  /** Google Drive file ID for final video */
  video_drive_id: string | null;
  /** Google Drive URL for final video */
  video_drive_url: string | null;
  /** Google Drive folder ID for production output */
  drive_folder_id: string | null;
  /** Production pipeline execution metadata (JSONB) */
  production_metadata: ProductionMetadata | null;
  /** Approver name (null = unapproved or auto-approved) */
  approved_by: string | null;
  /** Approval timestamp (ISO 8601) */
  approved_at: string | null;
  /** Feedback on rejection */
  approval_feedback: string | null;
  /** Rejection routing category */
  rejection_category: RejectionCategory | null;
  /** Error message from pipeline failures */
  error_message: string | null;
  /** Review status (default: 'not_required') */
  review_status: ContentReviewStatus;
  /** Reviewer comment for rejection reason */
  reviewer_comment: string | null;
  /** Review timestamp (ISO 8601) */
  reviewed_at: string | null;
  /** Number of revision cycles (default: 0) */
  revision_count: number;
  /** AI quality self-assessment score 0–10 (NUMERIC(3,1)) */
  quality_score: number | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface ContentCreateInput {
  content_id: string;
  hypothesis_id?: number | null;
  content_format?: ContentFormat;
  recipe_id?: number | null;
  status?: ContentStatus;
  planned_post_date?: string | null;
  character_id?: string | null;
  script_language?: ScriptLanguage | null;
  video_drive_id?: string | null;
  video_drive_url?: string | null;
  drive_folder_id?: string | null;
  production_metadata?: ProductionMetadata | null;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_feedback?: string | null;
  rejection_category?: RejectionCategory | null;
  error_message?: string | null;
  review_status?: ContentReviewStatus;
  reviewer_comment?: string | null;
  reviewed_at?: string | null;
  revision_count?: number;
  quality_score?: number | null;
}

export interface ContentUpdateInput {
  id: number;
  content_id?: string;
  hypothesis_id?: number | null;
  content_format?: ContentFormat;
  recipe_id?: number | null;
  status?: ContentStatus;
  planned_post_date?: string | null;
  character_id?: string | null;
  script_language?: ScriptLanguage | null;
  video_drive_id?: string | null;
  video_drive_url?: string | null;
  drive_folder_id?: string | null;
  production_metadata?: ProductionMetadata | null;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_feedback?: string | null;
  rejection_category?: RejectionCategory | null;
  error_message?: string | null;
  review_status?: ContentReviewStatus;
  reviewer_comment?: string | null;
  reviewed_at?: string | null;
  revision_count?: number;
  quality_score?: number | null;
}

// --- content_sections ---

/** Row type for the `content_sections` table */
export interface ContentSectionRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** FK to content.content_id (VARCHAR(20)) */
  content_id: string;
  /** FK to components.component_id (VARCHAR(30)) */
  component_id: string;
  /** Section display order (1, 2, 3, ...) */
  section_order: number;
  /** Section label: hook / body / cta / intro etc. (VARCHAR(30)) */
  section_label: string;
  /** Actual script used (LLM-adjusted version or final text) */
  script: string | null;
  /** Google Drive file ID for completed section video */
  drive_file_id: string | null;
  /** Section duration in seconds (NUMERIC(8,2)) */
  duration_seconds: number | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface ContentSectionCreateInput {
  content_id: string;
  component_id: string;
  section_order: number;
  section_label: string;
  script?: string | null;
  drive_file_id?: string | null;
  duration_seconds?: number | null;
}

export interface ContentSectionUpdateInput {
  id: number;
  content_id?: string;
  component_id?: string;
  section_order?: number;
  section_label?: string;
  script?: string | null;
  drive_file_id?: string | null;
  duration_seconds?: number | null;
}

// --- publications ---

export type PublicationStatus = 'scheduled' | 'posted' | 'measured' | 'failed';

/** JSONB shape for publications.metadata */
export interface PublicationMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  thumbnail_drive_id?: string;
  visibility?: string;
  api_response?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Row type for the `publications` table */
export interface PublicationRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** FK to content.content_id (VARCHAR(20)) */
  content_id: string;
  /** FK to accounts.account_id (VARCHAR(20)) */
  account_id: string;
  /** youtube / tiktok / instagram / x */
  platform: Platform;
  /** Platform-returned post ID (e.g. YouTube video ID) */
  platform_post_id: string | null;
  /** Actual posting timestamp (ISO 8601) */
  posted_at: string | null;
  /** Post URL */
  post_url: string | null;
  /** Measurement-eligible timestamp (default: posted_at + 48h) */
  measure_after: string | null;
  /** scheduled / posted / measured / failed (default: 'scheduled') */
  status: PublicationStatus;
  /** Additional posting metadata (JSONB) */
  metadata: PublicationMetadata | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface PublicationCreateInput {
  content_id: string;
  account_id: string;
  platform: Platform;
  platform_post_id?: string | null;
  posted_at?: string | null;
  post_url?: string | null;
  measure_after?: string | null;
  status?: PublicationStatus;
  metadata?: PublicationMetadata | null;
}

export interface PublicationUpdateInput {
  id: number;
  content_id?: string;
  account_id?: string;
  platform?: Platform;
  platform_post_id?: string | null;
  posted_at?: string | null;
  post_url?: string | null;
  measure_after?: string | null;
  status?: PublicationStatus;
  metadata?: PublicationMetadata | null;
}

// ============================================================================
// 3. Intelligence Layer — hypotheses, market_intel, metrics, analyses, learnings
// ============================================================================

// --- hypotheses ---

export type HypothesisSource = 'ai' | 'human';
export type HypothesisCategory =
  | 'content_format'
  | 'timing'
  | 'niche'
  | 'audience'
  | 'platform_specific';
export type HypothesisVerdict = 'pending' | 'confirmed' | 'rejected' | 'inconclusive';

/** JSONB shape for hypotheses.predicted_kpis / actual_kpis */
export interface HypothesisKpis {
  views?: number;
  engagement_rate?: number;
  completion_rate?: number;
  follower_delta?: number;
  [key: string]: unknown;
}

/** Row type for the `hypotheses` table */
export interface HypothesisRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** FK to cycles.id */
  cycle_id: number | null;
  /** ai / human (default: 'ai') */
  source: HypothesisSource;
  /** content_format / timing / niche / audience / platform_specific */
  category: HypothesisCategory;
  /** Hypothesis statement in testable form */
  statement: string;
  /** Hypothesis rationale / evidence basis */
  rationale: string | null;
  /** Account IDs to test against (TEXT[]) */
  target_accounts: string[] | null;
  /** Expected KPIs if hypothesis is correct (JSONB) */
  predicted_kpis: HypothesisKpis | null;
  /** Measured KPIs after testing (JSONB) */
  actual_kpis: HypothesisKpis | null;
  /** pending / confirmed / rejected / inconclusive (default: 'pending') */
  verdict: HypothesisVerdict;
  /** Confidence 0.00–1.00 (NUMERIC(3,2), default: 0.00) */
  confidence: number;
  /** Number of content pieces used to verify (default: 0) */
  evidence_count: number;
  /** 1536-dimension embedding vector for similarity search */
  embedding: number[] | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface HypothesisCreateInput {
  cycle_id?: number | null;
  source?: HypothesisSource;
  category: HypothesisCategory;
  statement: string;
  rationale?: string | null;
  target_accounts?: string[] | null;
  predicted_kpis?: HypothesisKpis | null;
  actual_kpis?: HypothesisKpis | null;
  verdict?: HypothesisVerdict;
  confidence?: number;
  evidence_count?: number;
  embedding?: number[] | null;
}

export interface HypothesisUpdateInput {
  id: number;
  cycle_id?: number | null;
  source?: HypothesisSource;
  category?: HypothesisCategory;
  statement?: string;
  rationale?: string | null;
  target_accounts?: string[] | null;
  predicted_kpis?: HypothesisKpis | null;
  actual_kpis?: HypothesisKpis | null;
  verdict?: HypothesisVerdict;
  confidence?: number;
  evidence_count?: number;
  embedding?: number[] | null;
}

// --- market_intel ---

export type MarketIntelType =
  | 'trending_topic'
  | 'competitor_post'
  | 'competitor_account'
  | 'audience_signal'
  | 'platform_update';

/** Row type for the `market_intel` table */
export interface MarketIntelRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** trending_topic / competitor_post / competitor_account / audience_signal / platform_update */
  intel_type: MarketIntelType;
  /** Platform scope (null = all platforms) */
  platform: Platform | null;
  /** Niche scope (null = all niches) */
  niche: string | null;
  /** Type-dependent structured data (JSONB) */
  data: Record<string, unknown>;
  /** Source URL */
  source_url: string | null;
  /** Relevance score 0.00–1.00 (NUMERIC(3,2)) */
  relevance_score: number | null;
  /** Collection timestamp (ISO 8601) */
  collected_at: string;
  /** Expiry timestamp (ISO 8601, null = permanent) */
  expires_at: string | null;
  /** 1536-dimension embedding vector */
  embedding: number[] | null;
}

export interface MarketIntelCreateInput {
  intel_type: MarketIntelType;
  platform?: Platform | null;
  niche?: string | null;
  data: Record<string, unknown>;
  source_url?: string | null;
  relevance_score?: number | null;
  collected_at?: string;
  expires_at?: string | null;
  embedding?: number[] | null;
}

export interface MarketIntelUpdateInput {
  id: number;
  intel_type?: MarketIntelType;
  platform?: Platform | null;
  niche?: string | null;
  data?: Record<string, unknown>;
  source_url?: string | null;
  relevance_score?: number | null;
  collected_at?: string;
  expires_at?: string | null;
  embedding?: number[] | null;
}

// --- metrics ---

export type MeasurementPoint = '48h' | '7d' | '30d';

/** JSONB: YouTube-specific metrics within metrics.platform_data */
export interface YouTubePlatformData {
  estimated_minutes_watched?: number;
  average_view_duration?: number;
  average_view_percentage?: number;
  /** Per-second audience retention curve */
  audience_watch_ratio?: number[];
  impressions?: number;
  impression_click_through_rate?: number;
  traffic_source_type?: Record<string, number>;
  subscribers_gained?: number;
  subscribers_lost?: number;
  demographics?: Record<string, Record<string, number>>;
  estimated_revenue?: number;
  [key: string]: unknown;
}

/** JSONB: Instagram-specific metrics within metrics.platform_data */
export interface InstagramPlatformData {
  avg_watch_time_ms?: number;
  completion_rate?: number;
  forward_taps?: number;
  backward_taps?: number;
  drop_off?: number;
  skip_rate?: number;
  repost_count?: number;
  crossposted_views?: number;
  facebook_views?: number;
  [key: string]: unknown;
}

/** JSONB: X-specific metrics within metrics.platform_data */
export interface XPlatformData {
  url_link_clicks?: number;
  user_profile_clicks?: number;
  video_view_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  [key: string]: unknown;
}

/** Union of platform-specific metric data */
export type PlatformData =
  | YouTubePlatformData
  | InstagramPlatformData
  | XPlatformData
  | Record<string, unknown>;

/** Row type for the `metrics` table */
export interface MetricRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** FK to publications.id */
  publication_id: number;
  /** Measurement timestamp (ISO 8601) */
  measured_at: string;
  /** Views / impressions */
  views: number | null;
  /** Like count */
  likes: number | null;
  /** Comment count */
  comments: number | null;
  /** Share / repost count */
  shares: number | null;
  /** Save count (Instagram, TikTok only) */
  saves: number | null;
  /** Total watch time in seconds (NUMERIC(12,2)) */
  watch_time_seconds: number | null;
  /** Completion rate 0.0000–1.0000 (NUMERIC(5,4)) */
  completion_rate: number | null;
  /** Engagement rate (NUMERIC(5,4)): (likes+comments+shares+saves)/views */
  engagement_rate: number | null;
  /** Follower delta from this post */
  follower_delta: number | null;
  /** Impression count */
  impressions: number | null;
  /** Unique user reach */
  reach: number | null;
  /** Platform-specific detailed metrics (JSONB) */
  platform_data: PlatformData | null;
  /** 48h / 7d / 30d */
  measurement_point: MeasurementPoint | null;
  /** Raw API response for debugging (JSONB) */
  raw_data: Record<string, unknown> | null;
}

export interface MetricCreateInput {
  publication_id: number;
  measured_at?: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  watch_time_seconds?: number | null;
  completion_rate?: number | null;
  engagement_rate?: number | null;
  follower_delta?: number | null;
  impressions?: number | null;
  reach?: number | null;
  platform_data?: PlatformData | null;
  measurement_point?: MeasurementPoint | null;
  raw_data?: Record<string, unknown> | null;
}

export interface MetricUpdateInput {
  id: number;
  publication_id?: number;
  measured_at?: string;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  watch_time_seconds?: number | null;
  completion_rate?: number | null;
  engagement_rate?: number | null;
  follower_delta?: number | null;
  impressions?: number | null;
  reach?: number | null;
  platform_data?: PlatformData | null;
  measurement_point?: MeasurementPoint | null;
  raw_data?: Record<string, unknown> | null;
}

// --- analyses ---

export type AnalysisType =
  | 'cycle_review'
  | 'hypothesis_verification'
  | 'anomaly_detection'
  | 'trend_analysis';

/** JSONB shape for analyses.recommendations array elements */
export interface AnalysisRecommendation {
  action: string;
  rationale: string;
  priority?: string;
  target_accounts?: string[];
  [key: string]: unknown;
}

/** Row type for the `analyses` table */
export interface AnalysisRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** FK to cycles.id */
  cycle_id: number | null;
  /** cycle_review / hypothesis_verification / anomaly_detection / trend_analysis */
  analysis_type: AnalysisType;
  /** Analysis findings (JSONB, structure depends on analysis_type) */
  findings: Record<string, unknown>;
  /** Recommended actions (JSONB array) */
  recommendations: AnalysisRecommendation[] | null;
  /** IDs of affected hypotheses (INTEGER[]) */
  affected_hypotheses: number[] | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface AnalysisCreateInput {
  cycle_id?: number | null;
  analysis_type: AnalysisType;
  findings: Record<string, unknown>;
  recommendations?: AnalysisRecommendation[] | null;
  affected_hypotheses?: number[] | null;
}

export interface AnalysisUpdateInput {
  id: number;
  cycle_id?: number | null;
  analysis_type?: AnalysisType;
  findings?: Record<string, unknown>;
  recommendations?: AnalysisRecommendation[] | null;
  affected_hypotheses?: number[] | null;
}

// --- learnings ---

export type LearningCategory = 'content' | 'timing' | 'audience' | 'platform' | 'niche';

/** Row type for the `learnings` table */
export interface LearningRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** content / timing / audience / platform / niche */
  category: LearningCategory;
  /** Learning insight text (must include specific numbers) */
  insight: string;
  /** Confidence 0.00–1.00 (NUMERIC(3,2), default: 0.50) */
  confidence: number;
  /** Number of supporting data points (default: 0) */
  evidence_count: number;
  /** Source analysis IDs (INTEGER[]) */
  source_analyses: number[] | null;
  /** Applicable niches (VARCHAR(50)[]) */
  applicable_niches: string[] | null;
  /** Applicable platforms (VARCHAR(20)[]) */
  applicable_platforms: string[] | null;
  /** 1536-dimension embedding vector */
  embedding: number[] | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface LearningCreateInput {
  category: LearningCategory;
  insight: string;
  confidence?: number;
  evidence_count?: number;
  source_analyses?: number[] | null;
  applicable_niches?: string[] | null;
  applicable_platforms?: string[] | null;
  embedding?: number[] | null;
}

export interface LearningUpdateInput {
  id: number;
  category?: LearningCategory;
  insight?: string;
  confidence?: number;
  evidence_count?: number;
  source_analyses?: number[] | null;
  applicable_niches?: string[] | null;
  applicable_platforms?: string[] | null;
  embedding?: number[] | null;
}

// ============================================================================
// 4. Operations Layer — cycles, human_directives, task_queue,
//                        algorithm_performance
// ============================================================================

// --- cycles ---

export type CycleStatus = 'planning' | 'executing' | 'measuring' | 'analyzing' | 'completed';

/** JSONB shape for cycles.summary */
export interface CycleSummary {
  contents_planned?: number;
  hypotheses_generated?: number;
  hypotheses_from_human?: number;
  insights_applied?: number;
  estimated_cost?: number;
  key_decisions?: string[];
  [key: string]: unknown;
}

/** Row type for the `cycles` table */
export interface CycleRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** Sequential cycle number (unique, starts at 1) */
  cycle_number: number;
  /** Cycle start timestamp (ISO 8601) */
  started_at: string | null;
  /** Cycle end timestamp (ISO 8601, null = in progress) */
  ended_at: string | null;
  /** planning / executing / measuring / analyzing / completed (default: 'planning') */
  status: CycleStatus;
  /** Cycle completion summary (JSONB) */
  summary: CycleSummary | null;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface CycleCreateInput {
  cycle_number: number;
  started_at?: string | null;
  ended_at?: string | null;
  status?: CycleStatus;
  summary?: CycleSummary | null;
}

export interface CycleUpdateInput {
  id: number;
  cycle_number?: number;
  started_at?: string | null;
  ended_at?: string | null;
  status?: CycleStatus;
  summary?: CycleSummary | null;
}

// --- human_directives ---

export type DirectiveType =
  | 'hypothesis'
  | 'reference_content'
  | 'instruction'
  | 'learning_guidance'
  | 'agent_response';
export type DirectiveStatus = 'pending' | 'acknowledged' | 'applied' | 'expired';

/** Row type for the `human_directives` table */
export interface HumanDirectiveRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** hypothesis / reference_content / instruction / learning_guidance / agent_response */
  directive_type: DirectiveType;
  /** Directive body text */
  content: string;
  /** Target account IDs (VARCHAR(20)[]) */
  target_accounts: string[] | null;
  /** Target niches (VARCHAR(50)[]) */
  target_niches: string[] | null;
  /** Target agent types (TEXT[]) */
  target_agents: string[] | null;
  /** pending / acknowledged / applied / expired (default: 'pending') */
  status: DirectiveStatus;
  /** low / normal / high / urgent (default: 'normal') */
  priority: Priority;
  /** Dashboard user ID or name */
  created_by: string | null;
  /** Timestamp when strategist acknowledged (ISO 8601) */
  acknowledged_at: string | null;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface HumanDirectiveCreateInput {
  directive_type: DirectiveType;
  content: string;
  target_accounts?: string[] | null;
  target_niches?: string[] | null;
  target_agents?: string[] | null;
  status?: DirectiveStatus;
  priority?: Priority;
  created_by?: string | null;
  acknowledged_at?: string | null;
}

export interface HumanDirectiveUpdateInput {
  id: number;
  directive_type?: DirectiveType;
  content?: string;
  target_accounts?: string[] | null;
  target_niches?: string[] | null;
  target_agents?: string[] | null;
  status?: DirectiveStatus;
  priority?: Priority;
  created_by?: string | null;
  acknowledged_at?: string | null;
}

// --- task_queue ---

export type TaskType = 'produce' | 'publish' | 'measure' | 'curate';
export type TaskQueueStatus =
  | 'pending'
  | 'queued'
  | 'waiting'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'failed_permanent';

/** Row type for the `task_queue` table */
export interface TaskQueueRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** produce / publish / measure / curate */
  task_type: TaskType;
  /** Task-specific payload (JSONB, structure depends on task_type) */
  payload: Record<string, unknown>;
  /** Status (default: 'pending') */
  status: TaskQueueStatus;
  /** Priority (higher = more urgent, default: 0) */
  priority: number;
  /** Worker identifier currently processing this task */
  assigned_worker: string | null;
  /** Current retry count (default: 0) */
  retry_count: number;
  /** Maximum retries before failed_permanent (default: 3) */
  max_retries: number;
  /** Latest error message */
  error_message: string | null;
  /** Last error timestamp (ISO 8601) */
  last_error_at: string | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** Processing start timestamp (ISO 8601) */
  started_at: string | null;
  /** Processing completion timestamp (ISO 8601) */
  completed_at: string | null;
}

export interface TaskQueueCreateInput {
  task_type: TaskType;
  payload: Record<string, unknown>;
  status?: TaskQueueStatus;
  priority?: number;
  assigned_worker?: string | null;
  retry_count?: number;
  max_retries?: number;
  error_message?: string | null;
  last_error_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface TaskQueueUpdateInput {
  id: number;
  task_type?: TaskType;
  payload?: Record<string, unknown>;
  status?: TaskQueueStatus;
  priority?: number;
  assigned_worker?: string | null;
  retry_count?: number;
  max_retries?: number;
  error_message?: string | null;
  last_error_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

// --- algorithm_performance ---

export type AlgorithmPeriod = 'daily' | 'weekly' | 'monthly';

/** JSONB shape for algorithm_performance.top_performing_niches elements */
export interface NichePerformance {
  niche: string;
  avg_engagement_rate: number;
  rank: number;
  [key: string]: unknown;
}

/** Row type for the `algorithm_performance` table */
export interface AlgorithmPerformanceRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** Measurement timestamp (ISO 8601) */
  measured_at: string;
  /** daily / weekly / monthly */
  period: AlgorithmPeriod;
  /** Hypothesis accuracy 0.0000–1.0000 (NUMERIC(5,4)) */
  hypothesis_accuracy: number | null;
  /** Prediction error RMSE (NUMERIC(8,4)) */
  prediction_error: number | null;
  /** Cumulative learning count */
  learning_count: number | null;
  /** Niche performance ranking (JSONB array) */
  top_performing_niches: NichePerformance[] | null;
  /** Period-over-period improvement rate (NUMERIC(5,4)) */
  improvement_rate: number | null;
  /** Additional metadata (JSONB) */
  metadata: Record<string, unknown> | null;
}

export interface AlgorithmPerformanceCreateInput {
  measured_at?: string;
  period: AlgorithmPeriod;
  hypothesis_accuracy?: number | null;
  prediction_error?: number | null;
  learning_count?: number | null;
  top_performing_niches?: NichePerformance[] | null;
  improvement_rate?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface AlgorithmPerformanceUpdateInput {
  id: number;
  measured_at?: string;
  period?: AlgorithmPeriod;
  hypothesis_accuracy?: number | null;
  prediction_error?: number | null;
  learning_count?: number | null;
  top_performing_niches?: NichePerformance[] | null;
  improvement_rate?: number | null;
  metadata?: Record<string, unknown> | null;
}

// ============================================================================
// 5. Observability Layer — agent_prompt_versions, agent_thought_logs,
//    agent_reflections, agent_individual_learnings, agent_communications
// ============================================================================

// --- agent_prompt_versions ---

export type PromptChangedBy = 'human' | 'system';

/** JSONB shape for agent_prompt_versions.performance_before / performance_after */
export interface PromptPerformanceSnapshot {
  hypothesis_accuracy?: number;
  avg_engagement_rate?: number;
  cycles_measured?: number;
  snapshot_date?: string;
  [key: string]: unknown;
}

/** Row type for the `agent_prompt_versions` table */
export interface AgentPromptVersionRow {
  /** UUID primary key */
  id: string;
  /** Agent type */
  agent_type: AgentType;
  /** Version number (auto-increment per agent_type) */
  version: number;
  /** Full prompt text */
  prompt_content: string;
  /** Human-readable change summary */
  change_summary: string | null;
  /** human / system (default: 'human') */
  changed_by: PromptChangedBy;
  /** Performance metrics before this change (JSONB) */
  performance_before: PromptPerformanceSnapshot | null;
  /** Performance metrics after this change (JSONB, updated later) */
  performance_after: PromptPerformanceSnapshot | null;
  /** Whether this is the active version (1 per agent_type) */
  active: boolean;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface AgentPromptVersionCreateInput {
  id?: string;
  agent_type: AgentType;
  version: number;
  prompt_content: string;
  change_summary?: string | null;
  changed_by?: PromptChangedBy;
  performance_before?: PromptPerformanceSnapshot | null;
  performance_after?: PromptPerformanceSnapshot | null;
  active?: boolean;
}

export interface AgentPromptVersionUpdateInput {
  id: string;
  agent_type?: AgentType;
  version?: number;
  prompt_content?: string;
  change_summary?: string | null;
  changed_by?: PromptChangedBy;
  performance_before?: PromptPerformanceSnapshot | null;
  performance_after?: PromptPerformanceSnapshot | null;
  active?: boolean;
}

// --- agent_thought_logs ---

/** JSONB shape for agent_thought_logs.token_usage */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

/** Row type for the `agent_thought_logs` table */
export interface AgentThoughtLogRow {
  /** UUID primary key */
  id: string;
  /** Agent type */
  agent_type: AgentType;
  /** FK to cycles.id (null = non-cycle processing) */
  cycle_id: number | null;
  /** LangGraph graph name (e.g. "strategy_cycle") */
  graph_name: string;
  /** Node name within the graph */
  node_name: string;
  /** Input data summary (JSONB) */
  input_summary: Record<string, unknown> | null;
  /** Full reasoning text */
  reasoning: string;
  /** Decision summary */
  decision: string;
  /** Output data summary (JSONB) */
  output_summary: Record<string, unknown> | null;
  /** MCP tools called in this step (TEXT[]) */
  tools_used: string[] | null;
  /** LLM model used: 'opus' or 'sonnet' */
  llm_model: string | null;
  /** Token usage and cost (JSONB) */
  token_usage: TokenUsage | null;
  /** Processing duration in milliseconds */
  duration_ms: number | null;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface AgentThoughtLogCreateInput {
  id?: string;
  agent_type: AgentType;
  cycle_id?: number | null;
  graph_name: string;
  node_name: string;
  input_summary?: Record<string, unknown> | null;
  reasoning: string;
  decision: string;
  output_summary?: Record<string, unknown> | null;
  tools_used?: string[] | null;
  llm_model?: string | null;
  token_usage?: TokenUsage | null;
  duration_ms?: number | null;
}

export interface AgentThoughtLogUpdateInput {
  id: string;
  agent_type?: AgentType;
  cycle_id?: number | null;
  graph_name?: string;
  node_name?: string;
  input_summary?: Record<string, unknown> | null;
  reasoning?: string;
  decision?: string;
  output_summary?: Record<string, unknown> | null;
  tools_used?: string[] | null;
  llm_model?: string | null;
  token_usage?: TokenUsage | null;
  duration_ms?: number | null;
}

// --- agent_reflections ---

/** Row type for the `agent_reflections` table */
export interface AgentReflectionRow {
  /** UUID primary key */
  id: string;
  /** Agent type */
  agent_type: AgentType;
  /** FK to cycles.id (null = non-cycle reflection) */
  cycle_id: number | null;
  /** Task description for this cycle */
  task_description: string;
  /** Self-assessment score 1–10 */
  self_score: number;
  /** Score reasoning */
  score_reasoning: string;
  /** Things that went well (TEXT[]) */
  what_went_well: string[] | null;
  /** Things to improve (TEXT[]) */
  what_to_improve: string[] | null;
  /** Concrete next actions (TEXT[]) */
  next_actions: string[] | null;
  /** Metrics snapshot at reflection time (JSONB) */
  metrics_snapshot: Record<string, unknown> | null;
  /** Whether this reflection was applied in next cycle (default: false) */
  applied_in_next_cycle: boolean;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface AgentReflectionCreateInput {
  id?: string;
  agent_type: AgentType;
  cycle_id?: number | null;
  task_description: string;
  self_score: number;
  score_reasoning: string;
  what_went_well?: string[] | null;
  what_to_improve?: string[] | null;
  next_actions?: string[] | null;
  metrics_snapshot?: Record<string, unknown> | null;
  applied_in_next_cycle?: boolean;
}

export interface AgentReflectionUpdateInput {
  id: string;
  agent_type?: AgentType;
  cycle_id?: number | null;
  task_description?: string;
  self_score?: number;
  score_reasoning?: string;
  what_went_well?: string[] | null;
  what_to_improve?: string[] | null;
  next_actions?: string[] | null;
  metrics_snapshot?: Record<string, unknown> | null;
  applied_in_next_cycle?: boolean;
}

// --- agent_individual_learnings ---

export type AgentLearningCategory =
  | 'data_source'
  | 'technique'
  | 'pattern'
  | 'mistake'
  | 'insight'
  | 'tool_characteristics'
  | 'tool_combination'
  | 'tool_failure_pattern'
  | 'tool_update'
  | 'data_classification'
  | 'curation_quality'
  | 'source_reliability'
  | 'content'
  | 'timing'
  | 'audience'
  | 'platform'
  | 'niche';

/** Row type for the `agent_individual_learnings` table */
export interface AgentIndividualLearningRow {
  /** UUID primary key */
  id: string;
  /** Owning agent type (each agent sees only their own learnings) */
  agent_type: AgentType;
  /** Learning category */
  category: AgentLearningCategory;
  /** Learning content text */
  content: string;
  /** Context in which this learning was acquired */
  context: string | null;
  /** Confidence 0.0–1.0 (FLOAT, default: 0.5) */
  confidence: number;
  /** Times this learning was referenced/applied (default: 0) */
  times_applied: number;
  /** Times application led to good outcomes (default: 0) */
  times_successful: number;
  /** Auto-computed: times_successful / times_applied (GENERATED STORED) */
  success_rate: number;
  /** Whether this learning is still valid (default: true) */
  is_active: boolean;
  /** FK to agent_reflections.id (null = discovered during task execution) */
  source_reflection_id: string | null;
  /** 1536-dimension embedding vector */
  embedding: number[] | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** Last time this learning was applied (ISO 8601) */
  last_applied_at: string | null;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface AgentIndividualLearningCreateInput {
  id?: string;
  agent_type: AgentType;
  category: AgentLearningCategory;
  content: string;
  context?: string | null;
  confidence?: number;
  times_applied?: number;
  times_successful?: number;
  is_active?: boolean;
  source_reflection_id?: string | null;
  embedding?: number[] | null;
  last_applied_at?: string | null;
}

export interface AgentIndividualLearningUpdateInput {
  id: string;
  agent_type?: AgentType;
  category?: AgentLearningCategory;
  content?: string;
  context?: string | null;
  confidence?: number;
  times_applied?: number;
  times_successful?: number;
  is_active?: boolean;
  source_reflection_id?: string | null;
  embedding?: number[] | null;
  last_applied_at?: string | null;
}

// --- agent_communications ---

export type CommunicationMessageType =
  | 'struggle'
  | 'proposal'
  | 'question'
  | 'status_report'
  | 'anomaly_alert'
  | 'milestone';
export type CommunicationStatus = 'unread' | 'read' | 'responded' | 'archived';

/** Row type for the `agent_communications` table */
export interface AgentCommunicationRow {
  /** UUID primary key */
  id: string;
  /** Sending agent type */
  agent_type: AgentType;
  /** struggle / proposal / question / status_report / anomaly_alert / milestone */
  message_type: CommunicationMessageType;
  /** low / normal / high / urgent (default: 'normal') */
  priority: Priority;
  /** Message body text */
  content: string;
  /** Context data / supporting metrics (JSONB) */
  context: Record<string, unknown> | null;
  /** Human's reply text (null = not yet responded) */
  human_response: string | null;
  /** Human response timestamp (ISO 8601) */
  human_responded_at: string | null;
  /** unread / read / responded / archived (default: 'unread') */
  status: CommunicationStatus;
  /** FK to cycles.id (null = non-cycle message) */
  cycle_id: number | null;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface AgentCommunicationCreateInput {
  id?: string;
  agent_type: AgentType;
  message_type: CommunicationMessageType;
  priority?: Priority;
  content: string;
  context?: Record<string, unknown> | null;
  human_response?: string | null;
  human_responded_at?: string | null;
  status?: CommunicationStatus;
  cycle_id?: number | null;
}

export interface AgentCommunicationUpdateInput {
  id: string;
  agent_type?: AgentType;
  message_type?: CommunicationMessageType;
  priority?: Priority;
  content?: string;
  context?: Record<string, unknown> | null;
  human_response?: string | null;
  human_responded_at?: string | null;
  status?: CommunicationStatus;
  cycle_id?: number | null;
}

// ============================================================================
// 6. Tool Management Layer — tool_catalog, tool_experiences,
//    tool_external_sources, production_recipes, prompt_suggestions
// ============================================================================

// --- tool_catalog ---

export type ToolType =
  | 'video_generation'
  | 'tts'
  | 'lipsync'
  | 'image_generation'
  | 'embedding'
  | 'llm'
  | 'search'
  | 'social_api'
  | 'analytics_api'
  | 'storage'
  | 'other';

/** JSONB shape for tool_catalog.supported_formats */
export interface ToolSupportedFormats {
  input?: string[];
  output?: string[];
  max_input_size_mb?: number;
  [key: string]: unknown;
}

/** Row type for the `tool_catalog` table */
export interface ToolCatalogRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** Tool name with version (e.g. "kling_v2.6") */
  tool_name: string;
  /** Functional category */
  tool_type: ToolType;
  /** Service provider (e.g. "fal.ai") */
  provider: string | null;
  /** API endpoint URL */
  api_endpoint: string | null;
  /** Estimated cost per use in USD (DECIMAL(10,4)) */
  cost_per_use: number | null;
  /** Tool strengths (JSONB, typically string[]) */
  strengths: string[] | null;
  /** Tool weaknesses (JSONB, typically string[]) */
  weaknesses: string[] | null;
  /** Tool quirks and gotchas (JSONB) */
  quirks: Record<string, unknown> | null;
  /** Supported input/output formats (JSONB) */
  supported_formats: ToolSupportedFormats | null;
  /** Maximum supported resolution (e.g. "3850x3850") */
  max_resolution: string | null;
  /** Whether this tool is currently available (default: true) */
  is_active: boolean;
  /** Official documentation URL */
  external_docs_url: string | null;
  /** Last knowledge update timestamp (ISO 8601) */
  last_knowledge_update: string | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface ToolCatalogCreateInput {
  tool_name: string;
  tool_type: ToolType;
  provider?: string | null;
  api_endpoint?: string | null;
  cost_per_use?: number | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  quirks?: Record<string, unknown> | null;
  supported_formats?: ToolSupportedFormats | null;
  max_resolution?: string | null;
  is_active?: boolean;
  external_docs_url?: string | null;
  last_knowledge_update?: string | null;
}

export interface ToolCatalogUpdateInput {
  id: number;
  tool_name?: string;
  tool_type?: ToolType;
  provider?: string | null;
  api_endpoint?: string | null;
  cost_per_use?: number | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  quirks?: Record<string, unknown> | null;
  supported_formats?: ToolSupportedFormats | null;
  max_resolution?: string | null;
  is_active?: boolean;
  external_docs_url?: string | null;
  last_knowledge_update?: string | null;
}

// --- tool_experiences ---

/** Row type for the `tool_experiences` table */
export interface ToolExperienceRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** FK to tool_catalog.id */
  tool_id: number;
  /** FK to content.content_id (null = test run) */
  content_id: string | null;
  /** Agent that recommended/executed this tool usage */
  agent_id: string;
  /** Full recipe used (JSONB) */
  recipe_used: Record<string, unknown> | null;
  /** Actual input parameters (JSONB) */
  input_params: Record<string, unknown> | null;
  /** Quality score 0.00–1.00 (DECIMAL(3,2)) */
  quality_score: number | null;
  /** Quality assessment notes */
  quality_notes: string | null;
  /** Processing time in milliseconds */
  processing_time_ms: number | null;
  /** Actual cost in USD (DECIMAL(10,4)) */
  cost_actual: number | null;
  /** Whether the tool call succeeded */
  success: boolean;
  /** Failure reason text */
  failure_reason: string | null;
  /** Content type classification (e.g. "asian_female_beauty") */
  content_type: string | null;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface ToolExperienceCreateInput {
  tool_id: number;
  content_id?: string | null;
  agent_id: string;
  recipe_used?: Record<string, unknown> | null;
  input_params?: Record<string, unknown> | null;
  quality_score?: number | null;
  quality_notes?: string | null;
  processing_time_ms?: number | null;
  cost_actual?: number | null;
  success: boolean;
  failure_reason?: string | null;
  content_type?: string | null;
}

export interface ToolExperienceUpdateInput {
  id: number;
  tool_id?: number;
  content_id?: string | null;
  agent_id?: string;
  recipe_used?: Record<string, unknown> | null;
  input_params?: Record<string, unknown> | null;
  quality_score?: number | null;
  quality_notes?: string | null;
  processing_time_ms?: number | null;
  cost_actual?: number | null;
  success?: boolean;
  failure_reason?: string | null;
  content_type?: string | null;
}

// --- tool_external_sources ---

export type ToolSourceType =
  | 'x_post'
  | 'official_doc'
  | 'press_release'
  | 'blog'
  | 'forum'
  | 'research_paper'
  | 'changelog'
  | 'other';

/** Row type for the `tool_external_sources` table */
export interface ToolExternalSourceRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** Source type */
  source_type: ToolSourceType;
  /** Source URL */
  source_url: string;
  /** Source account name or identifier */
  source_account: string | null;
  /** FK to tool_catalog.id (nullable — null means general AI tool info) */
  tool_id: number | null;
  /** Content summary */
  content_summary: string;
  /** Extracted key insights (JSONB, typically string[]) */
  key_insights: string[] | null;
  /** 1536-dimension embedding vector */
  embedding: number[] | null;
  /** Relevance score 0.00–1.00 (DECIMAL(3,2)) */
  relevance_score: number | null;
  /** Fetch timestamp (ISO 8601) */
  fetched_at: string;
  /** Processing timestamp (ISO 8601, null = not yet processed) */
  processed_at: string | null;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface ToolExternalSourceCreateInput {
  source_type: ToolSourceType;
  source_url: string;
  source_account?: string | null;
  tool_id?: number | null;
  content_summary: string;
  key_insights?: string[] | null;
  embedding?: number[] | null;
  relevance_score?: number | null;
  fetched_at: string;
  processed_at?: string | null;
}

export interface ToolExternalSourceUpdateInput {
  id: number;
  source_type?: ToolSourceType;
  source_url?: string;
  source_account?: string | null;
  tool_id?: number | null;
  content_summary?: string;
  key_insights?: string[] | null;
  embedding?: number[] | null;
  relevance_score?: number | null;
  fetched_at?: string;
  processed_at?: string | null;
}

// --- production_recipes ---

/** JSONB shape for a single step in production_recipes.steps */
export interface RecipeStep {
  order: number;
  step_name: string;
  tool_id: number;
  tool_name: string;
  params?: Record<string, unknown>;
  parallel_group?: string;
  depends_on?: number[];
  [key: string]: unknown;
}

/** Row type for the `production_recipes` table */
export interface ProductionRecipeRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** Recipe name (e.g. "asian_beauty_short") */
  recipe_name: string;
  /** short_video / text_post / image_post */
  content_format: ContentFormat;
  /** Target platform (null = all platforms) */
  target_platform: string | null;
  /** Ordered production steps (JSONB array) */
  steps: RecipeStep[];
  /** Conditions for recommending this recipe (JSONB) */
  recommended_for: Record<string, unknown> | null;
  /** Average quality score 0.00–1.00 (DECIMAL(3,2)) */
  avg_quality_score: number | null;
  /** Total usage count (default: 0) */
  times_used: number;
  /** Success rate 0.00–1.00 (DECIMAL(3,2)) */
  success_rate: number | null;
  /** Recipe creator: 'tool_specialist' or 'human' */
  created_by: string | null;
  /** Whether this is the default recipe (default: false) */
  is_default: boolean;
  /** Whether this recipe is currently active (default: true) */
  is_active: boolean;
  /** ISO 8601 timestamp */
  created_at: string;
  /** ISO 8601 timestamp */
  updated_at: string;
}

export interface ProductionRecipeCreateInput {
  recipe_name: string;
  content_format: ContentFormat;
  target_platform?: string | null;
  steps: RecipeStep[];
  recommended_for?: Record<string, unknown> | null;
  avg_quality_score?: number | null;
  times_used?: number;
  success_rate?: number | null;
  created_by?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

export interface ProductionRecipeUpdateInput {
  id: number;
  recipe_name?: string;
  content_format?: ContentFormat;
  target_platform?: string | null;
  steps?: RecipeStep[];
  recommended_for?: Record<string, unknown> | null;
  avg_quality_score?: number | null;
  times_used?: number;
  success_rate?: number | null;
  created_by?: string | null;
  is_default?: boolean;
  is_active?: boolean;
}

// --- prompt_suggestions ---

export type PromptSuggestionTriggerType =
  | 'score_decline'
  | 'repeated_issue'
  | 'new_pattern'
  | 'tool_update'
  | 'manual'
  | 'other';
export type PromptSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/** Row type for the `prompt_suggestions` table */
export interface PromptSuggestionRow {
  /** SERIAL auto-increment primary key */
  id: number;
  /** Target agent type */
  agent_type: AgentType;
  /** Trigger that caused this suggestion */
  trigger_type: PromptSuggestionTriggerType;
  /** Trigger details (JSONB) */
  trigger_details: Record<string, unknown>;
  /** Suggestion text */
  suggestion: string;
  /** Target prompt section (null = whole prompt) */
  target_prompt_section: string | null;
  /** Suggestion confidence 0.00–1.00 (DECIMAL(3,2)) */
  confidence: number | null;
  /** pending / accepted / rejected / expired (default: 'pending') */
  status: PromptSuggestionStatus;
  /** Human feedback text */
  human_feedback: string | null;
  /** ISO 8601 timestamp */
  created_at: string;
  /** Resolution timestamp (ISO 8601, null = still pending) */
  resolved_at: string | null;
}

export interface PromptSuggestionCreateInput {
  agent_type: AgentType;
  trigger_type: PromptSuggestionTriggerType;
  trigger_details: Record<string, unknown>;
  suggestion: string;
  target_prompt_section?: string | null;
  confidence?: number | null;
  status?: PromptSuggestionStatus;
  human_feedback?: string | null;
  resolved_at?: string | null;
}

export interface PromptSuggestionUpdateInput {
  id: number;
  agent_type?: AgentType;
  trigger_type?: PromptSuggestionTriggerType;
  trigger_details?: Record<string, unknown>;
  suggestion?: string;
  target_prompt_section?: string | null;
  confidence?: number | null;
  status?: PromptSuggestionStatus;
  human_feedback?: string | null;
  resolved_at?: string | null;
}

// ============================================================================
// 7. System Layer — system_settings
// ============================================================================

export type SystemSettingCategory =
  | 'production'
  | 'posting'
  | 'agent'
  | 'measurement'
  | 'dashboard'
  | 'credentials'
  | 'cost_control'
  | 'review';

export type SystemSettingValueType =
  | 'integer'
  | 'float'
  | 'boolean'
  | 'string'
  | 'json'
  | 'enum';

/** JSONB shape for system_settings.constraints */
export interface SystemSettingConstraints {
  /** Minimum value (for integer/float) */
  min?: number;
  /** Maximum value (for integer/float) */
  max?: number;
  /** Allowed values (for enum) */
  options?: string[];
}

/** Row type for the `system_settings` table (PK = setting_key, no serial id) */
export interface SystemSettingRow {
  /** Setting key name, e.g. "MAX_CONCURRENT_PRODUCTIONS" (VARCHAR(100), PK) */
  setting_key: string;
  /** Current value (JSONB — app-layer casts per value_type) */
  setting_value: unknown;
  /** production / posting / agent / measurement / dashboard / credentials / cost_control / review */
  category: SystemSettingCategory;
  /** Human-readable description */
  description: string;
  /** Default value (JSONB — used for reset) */
  default_value: unknown;
  /** integer / float / boolean / string / json / enum */
  value_type: SystemSettingValueType;
  /** Value constraints (JSONB, nullable) */
  constraints: SystemSettingConstraints | null;
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
  /** Last updater: "system" / "human" / agent name */
  updated_by: string;
}

export interface SystemSettingCreateInput {
  setting_key: string;
  setting_value: unknown;
  category: SystemSettingCategory;
  description: string;
  default_value: unknown;
  value_type: SystemSettingValueType;
  constraints?: SystemSettingConstraints | null;
  updated_by?: string;
}

export interface SystemSettingUpdateInput {
  setting_key: string;
  setting_value?: unknown;
  category?: SystemSettingCategory;
  description?: string;
  default_value?: unknown;
  value_type?: SystemSettingValueType;
  constraints?: SystemSettingConstraints | null;
  updated_by?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** All database table names */
export type TableName =
  // Entity Layer
  | 'accounts'
  | 'characters'
  | 'components'
  // Production Layer
  | 'content'
  | 'content_sections'
  | 'publications'
  // Intelligence Layer
  | 'hypotheses'
  | 'market_intel'
  | 'metrics'
  | 'analyses'
  | 'learnings'
  // Operations Layer
  | 'cycles'
  | 'human_directives'
  | 'task_queue'
  | 'algorithm_performance'
  // Observability Layer
  | 'agent_prompt_versions'
  | 'agent_thought_logs'
  | 'agent_reflections'
  | 'agent_individual_learnings'
  | 'agent_communications'
  // Tool Management Layer
  | 'tool_catalog'
  | 'tool_experiences'
  | 'tool_external_sources'
  | 'production_recipes'
  | 'prompt_suggestions'
  // System Layer
  | 'system_settings';

/** Map from table name to its Row type */
export interface AllRowTypes {
  accounts: AccountRow;
  characters: CharacterRow;
  components: ComponentRow;
  content: ContentRow;
  content_sections: ContentSectionRow;
  publications: PublicationRow;
  hypotheses: HypothesisRow;
  market_intel: MarketIntelRow;
  metrics: MetricRow;
  analyses: AnalysisRow;
  learnings: LearningRow;
  cycles: CycleRow;
  human_directives: HumanDirectiveRow;
  task_queue: TaskQueueRow;
  algorithm_performance: AlgorithmPerformanceRow;
  agent_prompt_versions: AgentPromptVersionRow;
  agent_thought_logs: AgentThoughtLogRow;
  agent_reflections: AgentReflectionRow;
  agent_individual_learnings: AgentIndividualLearningRow;
  agent_communications: AgentCommunicationRow;
  tool_catalog: ToolCatalogRow;
  tool_experiences: ToolExperienceRow;
  tool_external_sources: ToolExternalSourceRow;
  production_recipes: ProductionRecipeRow;
  prompt_suggestions: PromptSuggestionRow;
  system_settings: SystemSettingRow;
}
