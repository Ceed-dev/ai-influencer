-- ============================================================
-- AI-Influencer v5.0 — Database Schema (26 tables)
-- Generated from docs/v5-specification/03-database-schema.md
-- ============================================================
-- Execution order respects FK dependencies:
--   Layer 0 (no deps): characters, cycles, tool_catalog, system_settings
--   Layer 1: accounts, hypotheses, production_recipes, agent_prompt_versions, agent_reflections
--   Layer 2: components, content, market_intel, learnings, human_directives, task_queue, algorithm_performance
--   Layer 3: content_sections, publications, agent_thought_logs, agent_individual_learnings, agent_communications
--   Layer 4: metrics, analyses, tool_experiences, tool_external_sources, prompt_suggestions
-- ============================================================

-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Timezone (UTC recommended; app-layer converts to JST for display)
SET timezone = 'UTC';

-- ========================================
-- Layer 0: No dependencies
-- ========================================

-- 1.2 characters
CREATE TABLE characters (
    id              SERIAL PRIMARY KEY,
    character_id    VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    appearance      JSONB,
    personality     JSONB,
    voice_id        VARCHAR(32) NOT NULL,
    image_drive_id  VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE characters IS 'AIキャラクター定義。外見・性格・声の設定を一元管理';
COMMENT ON COLUMN characters.voice_id IS 'Fish Audio 32-char hex reference_id。TTS生成時に必須';
COMMENT ON COLUMN characters.image_drive_id IS 'Google DriveファイルID。制作パイプラインが参照';

-- 4.1 cycles
CREATE TABLE cycles (
    id              SERIAL PRIMARY KEY,
    cycle_number    INTEGER NOT NULL UNIQUE,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'planning',
    summary         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_cycles_status
        CHECK (status IN ('planning', 'executing', 'measuring', 'analyzing', 'completed'))
);

COMMENT ON TABLE cycles IS '仮説駆動サイクルの実行履歴。日次で1サイクル実行';
COMMENT ON COLUMN cycles.cycle_number IS '連番。仮説・分析がどの世代に属するかを追跡';

-- 6.1 tool_catalog
CREATE TABLE tool_catalog (
    id              SERIAL PRIMARY KEY,
    tool_name       VARCHAR(100) NOT NULL,
    tool_type       VARCHAR(50) NOT NULL,
    provider        VARCHAR(100),
    api_endpoint    TEXT,
    cost_per_use    DECIMAL(10,4),
    strengths       JSONB,
    weaknesses      JSONB,
    quirks          JSONB,
    supported_formats JSONB,
    max_resolution  VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    external_docs_url TEXT,
    last_knowledge_update TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tool_catalog_tool_type
        CHECK (tool_type IN (
            'video_generation', 'tts', 'lipsync', 'image_generation',
            'embedding', 'llm', 'search', 'social_api', 'analytics_api',
            'storage', 'other'
        ))
);

COMMENT ON TABLE tool_catalog IS 'AIツールのマスターデータ。特性・コスト・クセを管理し、レシピ選定の根拠';
COMMENT ON COLUMN tool_catalog.tool_name IS 'バージョン付きツール名。バージョンアップ時は新レコード作成';
COMMENT ON COLUMN tool_catalog.quirks IS 'ツール固有のクセ。v4.0の422エラー知見等を構造化';
COMMENT ON COLUMN tool_catalog.cost_per_use IS '1回あたりの概算コスト(USD)。パラメータにより変動';

-- 7.1 system_settings
CREATE TABLE system_settings (
    setting_key   VARCHAR(100) PRIMARY KEY,
    setting_value JSONB        NOT NULL,
    category      VARCHAR(50)  NOT NULL CHECK (category IN (
                    'production', 'posting', 'agent', 'measurement',
                    'dashboard', 'credentials', 'cost_control', 'review'
                  )),
    description   TEXT         NOT NULL,
    default_value JSONB        NOT NULL,
    value_type    VARCHAR(20)  NOT NULL CHECK (value_type IN (
                    'integer', 'float', 'boolean', 'string', 'json', 'enum'
                  )),
    constraints   JSONB,
    updated_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_by    VARCHAR(100) DEFAULT 'system'
);

COMMENT ON TABLE system_settings IS '全システム設定値を一元管理。ダッシュボードから動的変更可能。ハードコーディング禁止の原則を支えるテーブル';
COMMENT ON COLUMN system_settings.setting_key IS '設定キー名（例: MAX_CONCURRENT_PRODUCTIONS）。アプリケーションコードではこのキーで参照';
COMMENT ON COLUMN system_settings.setting_value IS '現在の設定値（JSONB）。value_typeに基づいてアプリ側で型変換';
COMMENT ON COLUMN system_settings.category IS '設定カテゴリ。ダッシュボードでのグループ表示に使用';
COMMENT ON COLUMN system_settings.default_value IS 'デフォルト値。リセット機能で使用';
COMMENT ON COLUMN system_settings.constraints IS '値の制約条件。integer/float: {"min","max"}, enum: {"options":[...]}';
COMMENT ON COLUMN system_settings.updated_by IS '最終更新者。"system"=初期値, "human"=ダッシュボード, エージェント名=自動調整';

-- ========================================
-- Layer 1: Depends on Layer 0 only
-- ========================================

-- 1.1 accounts (→ characters)
CREATE TABLE accounts (
    id              SERIAL PRIMARY KEY,
    account_id      VARCHAR(20) NOT NULL UNIQUE,
    platform            VARCHAR(20) NOT NULL,
    platform_username   VARCHAR(100),
    platform_account_id VARCHAR(100),
    character_id    VARCHAR(20) REFERENCES characters(character_id),
    niche           VARCHAR(50),
    cluster         VARCHAR(50),
    persona_description TEXT,
    auth_credentials JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'setup',
    follower_count  INTEGER DEFAULT 0,
    monetization_status VARCHAR(20) DEFAULT 'none',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_accounts_platform
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'x')),
    CONSTRAINT chk_accounts_status
        CHECK (status IN ('active', 'suspended', 'setup')),
    CONSTRAINT chk_accounts_monetization
        CHECK (monetization_status IN ('none', 'eligible', 'active'))
);

COMMENT ON TABLE accounts IS 'プラットフォーム別アカウント管理。1キャラクター=複数アカウント（platform別）';
COMMENT ON COLUMN accounts.account_id IS 'ACC_0001形式の一意ID。v4.0からの継続体系';
COMMENT ON COLUMN accounts.auth_credentials IS 'OAuth tokens等。本番では暗号化推奨';
COMMENT ON COLUMN accounts.cluster IS 'A/Bテスト用グルーピング。プランナーエージェントが使用';

-- 3.1 hypotheses (→ cycles)
CREATE TABLE hypotheses (
    id              SERIAL PRIMARY KEY,
    cycle_id        INTEGER REFERENCES cycles(id),
    source          VARCHAR(10) NOT NULL DEFAULT 'ai',
    category        VARCHAR(30) NOT NULL,
    statement       TEXT NOT NULL,
    rationale       TEXT,
    target_accounts VARCHAR(20)[],
    predicted_kpis  JSONB,
    actual_kpis     JSONB,
    verdict         VARCHAR(20) NOT NULL DEFAULT 'pending',
    confidence      NUMERIC(3,2) DEFAULT 0.00,
    evidence_count  INTEGER NOT NULL DEFAULT 0,
    embedding       vector(1536),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_hypotheses_source
        CHECK (source IN ('ai', 'human')),
    CONSTRAINT chk_hypotheses_category
        CHECK (category IN (
            'content_format', 'timing', 'niche',
            'audience', 'platform_specific'
        )),
    CONSTRAINT chk_hypotheses_verdict
        CHECK (verdict IN ('pending', 'confirmed', 'rejected', 'inconclusive')),
    CONSTRAINT chk_hypotheses_confidence
        CHECK (confidence >= 0.00 AND confidence <= 1.00)
);

COMMENT ON TABLE hypotheses IS '仮説駆動サイクルの中核。生成→検証→verdict判定で学習を回す';
COMMENT ON COLUMN hypotheses.embedding IS 'pgvectorによる類似仮説検索用。1536次元';
COMMENT ON COLUMN hypotheses.verdict IS 'pending→confirmed/rejected/inconclusive。アナリストが判定';

-- 6.4 production_recipes
CREATE TABLE production_recipes (
    id              SERIAL PRIMARY KEY,
    recipe_name     VARCHAR(200) NOT NULL,
    content_format  VARCHAR(20) NOT NULL,
    target_platform VARCHAR(50),
    steps           JSONB NOT NULL,
    recommended_for JSONB,
    avg_quality_score DECIMAL(3,2),
    times_used      INTEGER DEFAULT 0,
    success_rate    DECIMAL(3,2),
    created_by      VARCHAR(50),
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_recipes_content_format
        CHECK (content_format IN ('short_video', 'text_post', 'image_post'))
);

COMMENT ON TABLE production_recipes IS 'ツール組み合わせパターン。v4.0パイプラインをデフォルトレシピとして保持';
COMMENT ON COLUMN production_recipes.steps IS '制作ステップ配列。各ステップにtool_id, params, orderを定義';
COMMENT ON COLUMN production_recipes.is_default IS 'v4.0パイプライン=デフォルト。content_format+target_platformごとに1つ';
COMMENT ON COLUMN production_recipes.recommended_for IS '推奨条件。niche, character_ethnicity, budget等で絞り込み';

-- 5.1 agent_prompt_versions
CREATE TABLE agent_prompt_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type      TEXT NOT NULL CHECK (agent_type IN (
        'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator'
    )),
    version         INTEGER NOT NULL,
    prompt_content  TEXT NOT NULL,
    change_summary  TEXT,
    changed_by      TEXT NOT NULL DEFAULT 'human',
    performance_before JSONB,
    performance_after JSONB,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_agent_prompt_versions_agent_version
        UNIQUE (agent_type, version)
);

COMMENT ON TABLE agent_prompt_versions IS 'エージェントプロンプトの変更履歴。変更前後のパフォーマンス比較を可能にする';
COMMENT ON COLUMN agent_prompt_versions.agent_type IS 'strategist/researcher/analyst/planner/tool_specialist/data_curator';
COMMENT ON COLUMN agent_prompt_versions.active IS 'agent_typeごとに1つだけtrue。新バージョン作成時に旧版をfalseに更新';
COMMENT ON COLUMN agent_prompt_versions.performance_after IS '変更後のメトリクス。一定期間後にアナリストが計測して更新';

-- 5.3 agent_reflections (→ cycles)
CREATE TABLE agent_reflections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type      TEXT NOT NULL CHECK (agent_type IN (
        'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator'
    )),
    cycle_id        INTEGER REFERENCES cycles(id),
    task_description TEXT NOT NULL,
    self_score      INTEGER NOT NULL CHECK (self_score BETWEEN 1 AND 10),
    score_reasoning TEXT NOT NULL,
    what_went_well  TEXT[],
    what_to_improve TEXT[],
    next_actions    TEXT[],
    metrics_snapshot JSONB,
    applied_in_next_cycle BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_reflections IS 'エージェントの自己評価記録。サイクル終了時に各エージェントが生成し、次サイクルで参照';
COMMENT ON COLUMN agent_reflections.agent_type IS 'strategist/researcher/analyst/planner/tool_specialist/data_curator';
COMMENT ON COLUMN agent_reflections.cycle_id IS '属するサイクル。NULLはサイクル外タスクの振り返り';
COMMENT ON COLUMN agent_reflections.self_score IS '1-10の自己評価。8以上で優秀、4以下で要改善';
COMMENT ON COLUMN agent_reflections.score_reasoning IS 'スコアの根拠。なぜこのスコアにしたかの説明';
COMMENT ON COLUMN agent_reflections.what_went_well IS '良かった点のリスト（TEXT配列）';
COMMENT ON COLUMN agent_reflections.what_to_improve IS '改善すべき点のリスト（TEXT配列）';
COMMENT ON COLUMN agent_reflections.next_actions IS '次サイクルでの具体的アクション（TEXT配列）。agent_individual_learningsの生成元';
COMMENT ON COLUMN agent_reflections.metrics_snapshot IS '振り返り時点の関連メトリクスのJSONBスナップショット';
COMMENT ON COLUMN agent_reflections.applied_in_next_cycle IS '次サイクルで振り返りが活用されたか。活用率の追跡指標';

-- ========================================
-- Layer 2: Depends on Layer 0-1
-- ========================================

-- 1.3 components
CREATE TABLE components (
    id              SERIAL PRIMARY KEY,
    component_id    VARCHAR(30) NOT NULL UNIQUE,
    type            VARCHAR(20) NOT NULL,
    subtype         VARCHAR(30),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    data            JSONB,
    drive_file_id   VARCHAR(100),
    niche           VARCHAR(50),
    tags            TEXT[],
    score           NUMERIC(5,2)
        CHECK (score IS NULL OR (score >= 0.00 AND score <= 100.00)),
    usage_count     INTEGER NOT NULL DEFAULT 0,
    curated_by      VARCHAR(20) NOT NULL DEFAULT 'human',
    curation_confidence DECIMAL(3,2),
    review_status   VARCHAR(20) NOT NULL DEFAULT 'auto_approved',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_components_type
        CHECK (type IN ('scenario', 'motion', 'audio', 'image')),
    CONSTRAINT chk_components_curated_by
        CHECK (curated_by IN ('auto', 'human')),
    CONSTRAINT chk_components_review_status
        CHECK (review_status IN ('auto_approved', 'pending_review', 'human_approved')),
    CONSTRAINT chk_components_curation_confidence
        CHECK (curation_confidence IS NULL OR (curation_confidence >= 0.00 AND curation_confidence <= 1.00))
);

COMMENT ON TABLE components IS 'シナリオ・モーション・オーディオ・画像の統合コンポーネント管理';
COMMENT ON COLUMN components.data IS '種別(type)に応じた構造化データ。scenarioならscript_en/jp等';
COMMENT ON COLUMN components.score IS 'アナリストが算出するパフォーマンススコア (0-100)';
COMMENT ON COLUMN components.tags IS '自由タグ配列。GINインデックスで高速検索';
COMMENT ON COLUMN components.curated_by IS 'auto=データキュレーター自動生成, human=人間手動作成';
COMMENT ON COLUMN components.curation_confidence IS 'データキュレーターの自信度 (0.00-1.00)。auto時のみ';
COMMENT ON COLUMN components.review_status IS 'キュレーション結果のレビュー状態。pending_reviewは人間確認待ち';

-- 2.1 content (→ hypotheses, characters, production_recipes)
CREATE TABLE content (
    id              SERIAL PRIMARY KEY,
    content_id      VARCHAR(20) NOT NULL UNIQUE,
    hypothesis_id   INTEGER REFERENCES hypotheses(id),
    content_format  VARCHAR(20) NOT NULL DEFAULT 'short_video',
    recipe_id       INTEGER REFERENCES production_recipes(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'planned',
    planned_post_date DATE,
    character_id    VARCHAR(20) REFERENCES characters(character_id),
    script_language VARCHAR(5),
    video_drive_id  VARCHAR(100),
    video_drive_url TEXT,
    drive_folder_id VARCHAR(100),
    production_metadata JSONB,
    approved_by         VARCHAR(100),
    approved_at         TIMESTAMPTZ,
    approval_feedback   TEXT,
    rejection_category  VARCHAR(30),
    error_message   TEXT,
    review_status     VARCHAR(20)  DEFAULT 'not_required',
    reviewer_comment  TEXT,
    reviewed_at       TIMESTAMPTZ,
    revision_count    INTEGER      DEFAULT 0,
    quality_score     NUMERIC(3,1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_content_status
        CHECK (status IN (
            'planned', 'producing', 'ready', 'pending_review', 'pending_approval',
            'approved', 'rejected', 'revision_needed', 'posted', 'measured',
            'cancelled', 'analyzed'
        )),
    CONSTRAINT chk_content_review_status
        CHECK (review_status IN ('not_required', 'pending_review', 'approved', 'rejected')),
    CONSTRAINT chk_content_quality_score
        CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 10)),
    CONSTRAINT chk_content_format
        CHECK (content_format IN ('short_video', 'text_post', 'image_post')),
    CONSTRAINT chk_content_script_language
        CHECK (script_language IS NULL OR script_language IN ('en', 'jp')),
    CONSTRAINT chk_content_rejection_category
        CHECK (rejection_category IS NULL OR rejection_category IN (
            'plan_revision', 'data_insufficient', 'hypothesis_weak'
        ))
);

COMMENT ON TABLE content IS 'コンテンツのライフサイクル管理。4つのLangGraphグラフ間の間接連携ポイント';
COMMENT ON COLUMN content.status IS 'コンテンツライフサイクル: [pending_approval→]planned→producing→ready→[pending_review→approved/rejected→revision_needed]→posted→measured→analyzed。cancelled=中止';
COMMENT ON COLUMN content.hypothesis_id IS '仮説駆動サイクルの根拠。NULLは人間の直接指示';
COMMENT ON COLUMN content.content_format IS 'コンテンツ形式。short_video/text_post/image_post。使用するワーカータイプを決定';
COMMENT ON COLUMN content.recipe_id IS 'Tool Specialistが選択した制作レシピ。text_postではNULL可';
COMMENT ON COLUMN content.production_metadata IS 'fal.ai request ID, 処理時間, ファイルサイズ等';
COMMENT ON COLUMN content.rejection_category IS '差戻しカテゴリ。plan_revision/data_insufficient/hypothesis_weak';
COMMENT ON COLUMN content.review_status IS 'レビュー状態。HUMAN_REVIEW_ENABLED=false時はnot_required固定';
COMMENT ON COLUMN content.quality_score IS 'AI生成時の品質自己評価スコア（0-10）。AUTO_APPROVE_SCORE_THRESHOLD以上で自動承認';

-- 3.2 market_intel
CREATE TABLE market_intel (
    id              SERIAL PRIMARY KEY,
    intel_type      VARCHAR(30) NOT NULL,
    platform        VARCHAR(20),
    niche           VARCHAR(50),
    data            JSONB NOT NULL,
    source_url      TEXT,
    relevance_score NUMERIC(3,2),
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    embedding       vector(1536),

    CONSTRAINT chk_market_intel_type
        CHECK (intel_type IN ('trending_topic', 'competitor_post', 'competitor_account', 'audience_signal', 'platform_update')),
    CONSTRAINT chk_market_intel_platform
        CHECK (platform IS NULL OR platform IN ('youtube', 'tiktok', 'instagram', 'x')),
    CONSTRAINT chk_market_intel_relevance
        CHECK (relevance_score IS NULL OR (relevance_score >= 0.00 AND relevance_score <= 1.00))
);

COMMENT ON TABLE market_intel IS '5種の市場情報を統合管理。リサーチャーが収集、アナリスト・プランナーが参照';
COMMENT ON COLUMN market_intel.intel_type IS 'trending_topic/competitor_post/competitor_account/audience_signal/platform_update';
COMMENT ON COLUMN market_intel.expires_at IS 'トレンドは7日、アカウント情報は30日。NULLは恒久';

-- 3.5 learnings
CREATE TABLE learnings (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(20) NOT NULL,
    insight         TEXT NOT NULL,
    confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.50,
    evidence_count  INTEGER NOT NULL DEFAULT 0,
    source_analyses INTEGER[],
    applicable_niches VARCHAR(50)[],
    applicable_platforms VARCHAR(20)[],
    embedding       vector(1536),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_learnings_category
        CHECK (category IN ('content', 'timing', 'audience', 'platform', 'niche')),
    CONSTRAINT chk_learnings_confidence
        CHECK (confidence >= 0.00 AND confidence <= 1.00)
);

COMMENT ON TABLE learnings IS '繰り返し確認された知見の蓄積。仮説から昇格した再利用可能なインサイト';
COMMENT ON COLUMN learnings.embedding IS '類似知見検索・クラスタリング用。1536次元';
COMMENT ON COLUMN learnings.confidence IS '信頼度。evidence_count増加に伴い上昇。0.80以上で高信頼';
COMMENT ON COLUMN learnings.evidence_count IS 'この知見を裏付けるデータポイント数。10以上で高信頼知見';
COMMENT ON COLUMN learnings.source_analyses IS '根拠となった分析のID配列 (analyses.id)';
COMMENT ON COLUMN learnings.applicable_niches IS '適用可能なジャンル配列。NULL/空=全ジャンル共通';
COMMENT ON COLUMN learnings.applicable_platforms IS '適用可能なプラットフォーム配列。NULL/空=全プラットフォーム共通';

-- 4.2 human_directives
CREATE TABLE human_directives (
    id              SERIAL PRIMARY KEY,
    directive_type  VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    target_accounts VARCHAR(20)[],
    target_niches   VARCHAR(50)[],
    target_agents   TEXT[],
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority        VARCHAR(10) NOT NULL DEFAULT 'normal',
    created_by      VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_directives_type
        CHECK (directive_type IN ('hypothesis', 'reference_content', 'instruction', 'learning_guidance', 'agent_response')),
    CONSTRAINT chk_directives_status
        CHECK (status IN ('pending', 'acknowledged', 'applied', 'expired')),
    CONSTRAINT chk_directives_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

COMMENT ON TABLE human_directives IS 'ダッシュボードからの人間の指示。戦略エージェントがサイクル開始時に読み取り';
COMMENT ON COLUMN human_directives.directive_type IS 'hypothesis/reference_content/instruction/learning_guidance/agent_response';
COMMENT ON COLUMN human_directives.target_agents IS '対象エージェント種別配列。NULLは全エージェントへのブロードキャスト';
COMMENT ON COLUMN human_directives.priority IS 'urgentは進行中サイクルに割り込み';

-- 4.3 task_queue
CREATE TABLE task_queue (
    id              SERIAL PRIMARY KEY,
    task_type       VARCHAR(20) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority        INTEGER NOT NULL DEFAULT 0,
    assigned_worker VARCHAR(50),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    error_message   TEXT,
    last_error_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    CONSTRAINT chk_task_type
        CHECK (task_type IN ('produce', 'publish', 'measure', 'curate')),
    CONSTRAINT chk_task_status
        CHECK (status IN ('pending', 'queued', 'waiting', 'processing', 'retrying', 'completed', 'failed', 'failed_permanent'))
);

COMMENT ON TABLE task_queue IS '制作・投稿・計測・キュレーションのタスクキュー。各LangGraphグラフがポーリングで取得';
COMMENT ON COLUMN task_queue.priority IS '大きいほど高優先。ORDER BY priority DESC, created_at ASC';
COMMENT ON COLUMN task_queue.max_retries IS 'デフォルト3。retry_count >= max_retries で failed_permanent確定';
COMMENT ON COLUMN task_queue.status IS 'pending→queued→[waiting→]processing→[retrying→processing]→completed/failed_permanent';

-- 4.4 algorithm_performance
CREATE TABLE algorithm_performance (
    id              SERIAL PRIMARY KEY,
    measured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period          VARCHAR(10) NOT NULL,
    hypothesis_accuracy NUMERIC(5,4),
    prediction_error NUMERIC(8,4),
    learning_count  INTEGER,
    top_performing_niches JSONB,
    improvement_rate NUMERIC(5,4),
    metadata        JSONB,

    CONSTRAINT chk_algorithm_period
        CHECK (period IN ('daily', 'weekly', 'monthly')),
    CONSTRAINT chk_algorithm_hypothesis_accuracy
        CHECK (hypothesis_accuracy IS NULL OR (hypothesis_accuracy >= 0.0000 AND hypothesis_accuracy <= 1.0000))
);

COMMENT ON TABLE algorithm_performance IS 'システムの学習能力を定量追跡。ダッシュボードの精度パネル用';
COMMENT ON COLUMN algorithm_performance.period IS '集計期間。daily/weekly/monthly。同一日に3行存在する場合あり';
COMMENT ON COLUMN algorithm_performance.hypothesis_accuracy IS '仮説的中率。目標: 初期0.30→6ヶ月後0.65';
COMMENT ON COLUMN algorithm_performance.improvement_rate IS '前期比改善率。正=改善、負=悪化';

-- ========================================
-- Layer 3: Depends on Layer 0-2
-- ========================================

-- 2.2 content_sections (→ content, components)
CREATE TABLE content_sections (
    id              SERIAL PRIMARY KEY,
    content_id      VARCHAR(20) NOT NULL REFERENCES content(content_id),
    component_id    VARCHAR(30) NOT NULL REFERENCES components(component_id),
    section_order   INTEGER NOT NULL,
    section_label   VARCHAR(30) NOT NULL,
    script          TEXT,
    drive_file_id   VARCHAR(100),
    duration_seconds NUMERIC(8,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_content_section_order
        UNIQUE (content_id, section_order)
);

COMMENT ON TABLE content_sections IS 'コンテンツのセクション構成。1コンテンツに対して動的にN件のセクションを定義';
COMMENT ON COLUMN content_sections.component_id IS 'このセクションで使用するコンポーネント（シナリオ or モーション）';
COMMENT ON COLUMN content_sections.section_order IS 'セクションの結合順序。ffmpeg concatの順序を決定';
COMMENT ON COLUMN content_sections.section_label IS 'セクション名。hook/body/cta等の自由タグ';
COMMENT ON COLUMN content_sections.script IS '実際に使用されたスクリプト。LLMが調整した最終版';

-- 2.3 publications (→ content, accounts)
CREATE TABLE publications (
    id              SERIAL PRIMARY KEY,
    content_id      VARCHAR(20) NOT NULL REFERENCES content(content_id),
    account_id      VARCHAR(20) NOT NULL REFERENCES accounts(account_id),
    platform        VARCHAR(20) NOT NULL,
    platform_post_id VARCHAR(100),
    posted_at       TIMESTAMPTZ,
    post_url        TEXT,
    measure_after   TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_publications_platform
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'x')),
    CONSTRAINT chk_publications_status
        CHECK (status IN ('scheduled', 'posted', 'measured', 'failed'))
);

COMMENT ON TABLE publications IS '投稿記録。1コンテンツが複数プラットフォームに投稿される可能性に対応';
COMMENT ON COLUMN publications.measure_after IS 'posted_at + 48h。計測ジョブのトリガー条件';
COMMENT ON COLUMN publications.platform_post_id IS 'プラットフォームが返す投稿ID。計測APIで使用';

-- 5.2 agent_thought_logs (→ cycles)
CREATE TABLE agent_thought_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type      TEXT NOT NULL CHECK (agent_type IN (
        'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator'
    )),
    cycle_id        INTEGER REFERENCES cycles(id),
    graph_name      TEXT NOT NULL,
    node_name       TEXT NOT NULL,
    input_summary   JSONB,
    reasoning       TEXT NOT NULL,
    decision        TEXT NOT NULL,
    output_summary  JSONB,
    tools_used      TEXT[],
    llm_model       TEXT,
    token_usage     JSONB,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_thought_logs IS 'エージェントの推論プロセスを完全記録。デバッグ・プロンプト改善の根拠';
COMMENT ON COLUMN agent_thought_logs.graph_name IS 'LangGraphのグラフ名。strategy_cycle/production_pipeline等';
COMMENT ON COLUMN agent_thought_logs.node_name IS 'グラフ内のノード名。問題ステップの特定に使用';
COMMENT ON COLUMN agent_thought_logs.reasoning IS 'エージェントの思考全文。人間がレビューして改善点を発見';

-- 5.4 agent_individual_learnings (→ agent_reflections)
CREATE TABLE agent_individual_learnings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type      TEXT NOT NULL CHECK (agent_type IN (
        'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator'
    )),
    category        TEXT NOT NULL CHECK (category IN (
        'data_source', 'technique', 'pattern', 'mistake', 'insight',
        'tool_characteristics', 'tool_combination', 'tool_failure_pattern', 'tool_update',
        'data_classification', 'curation_quality', 'source_reliability',
        'content', 'timing', 'audience', 'platform', 'niche'
    )),
    content         TEXT NOT NULL,
    context         TEXT,
    confidence      FLOAT NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0.0 AND 1.0),
    times_applied   INTEGER NOT NULL DEFAULT 0,
    times_successful INTEGER NOT NULL DEFAULT 0,
    success_rate    FLOAT GENERATED ALWAYS AS (
        CASE WHEN times_applied > 0 THEN times_successful::FLOAT / times_applied ELSE 0.0 END
    ) STORED,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    source_reflection_id UUID REFERENCES agent_reflections(id),
    embedding       vector(1536),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_applied_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_individual_learnings IS 'エージェント個別の学習メモリ。各エージェント固有の経験知を蓄積';
COMMENT ON COLUMN agent_individual_learnings.agent_type IS 'この学びを所有するエージェント。各エージェントは自分の学びのみ参照';
COMMENT ON COLUMN agent_individual_learnings.category IS 'data_source/technique/pattern/mistake/insight/tool_*/data_*/source_*/content/timing/audience/platform/niche';
COMMENT ON COLUMN agent_individual_learnings.success_rate IS '自動計算。times_successful / times_applied。効果的な学びのソート用';
COMMENT ON COLUMN agent_individual_learnings.embedding IS '関連する学びの検索用。agent_type + is_activeでフィルタ後にベクトル検索';

-- 5.5 agent_communications (→ cycles)
CREATE TABLE agent_communications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type      TEXT NOT NULL CHECK (agent_type IN (
        'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator'
    )),
    message_type    TEXT NOT NULL CHECK (message_type IN (
        'struggle', 'proposal', 'question', 'status_report', 'anomaly_alert', 'milestone'
    )),
    priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
        'low', 'normal', 'high', 'urgent'
    )),
    content         TEXT NOT NULL,
    context         JSONB,
    human_response  TEXT,
    human_responded_at TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'unread' CHECK (status IN (
        'unread', 'read', 'responded', 'archived'
    )),
    cycle_id        INTEGER REFERENCES cycles(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_communications IS 'エージェント→人間の逆方向コミュニケーション。human_directivesの対になるテーブル';
COMMENT ON COLUMN agent_communications.message_type IS 'struggle/proposal/question/status_report/anomaly_alert/milestone';
COMMENT ON COLUMN agent_communications.priority IS 'urgentはダッシュボードで即座に通知。lowは余裕がある時に確認';
COMMENT ON COLUMN agent_communications.human_response IS '人間の返信。エージェントが次サイクルで参照';

-- ========================================
-- Layer 4: Depends on Layer 0-3
-- ========================================

-- 3.3 metrics (→ publications)
CREATE TABLE metrics (
    id              SERIAL PRIMARY KEY,
    publication_id  INTEGER NOT NULL REFERENCES publications(id),
    measured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    views           INTEGER,
    likes           INTEGER,
    comments        INTEGER,
    shares          INTEGER,
    saves           INTEGER,
    watch_time_seconds NUMERIC(12,2),
    completion_rate NUMERIC(5,4),
    engagement_rate NUMERIC(5,4),
    follower_delta  INTEGER,
    impressions     INTEGER,
    reach           INTEGER,
    platform_data   JSONB,
    measurement_point VARCHAR(10),
    raw_data        JSONB,

    CONSTRAINT chk_metrics_measurement_point
        CHECK (measurement_point IS NULL OR measurement_point IN ('48h', '7d', '30d')),
    CONSTRAINT chk_metrics_completion_rate
        CHECK (completion_rate IS NULL OR (completion_rate >= 0.0000 AND completion_rate <= 1.0000)),
    CONSTRAINT chk_metrics_engagement_rate
        CHECK (engagement_rate IS NULL OR (engagement_rate >= 0.0000 AND engagement_rate <= 1.0000))
);

COMMENT ON TABLE metrics IS '投稿パフォーマンスの時系列記録。1投稿に対して最大3回計測 (48h, 7d, 30d)';
COMMENT ON COLUMN metrics.completion_rate IS '完視聴率。Shorts/Reelsの最重要KPI';
COMMENT ON COLUMN metrics.platform_data IS 'プラットフォーム固有の詳細メトリクス';
COMMENT ON COLUMN metrics.measurement_point IS '計測回次。48h/7d/30dの最大3回';
COMMENT ON COLUMN metrics.raw_data IS 'プラットフォームAPIの生レスポンス。再分析・デバッグ用';

-- 3.4 analyses (→ cycles)
CREATE TABLE analyses (
    id              SERIAL PRIMARY KEY,
    cycle_id        INTEGER REFERENCES cycles(id),
    analysis_type   VARCHAR(30) NOT NULL,
    findings        JSONB NOT NULL,
    recommendations JSONB,
    affected_hypotheses INTEGER[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_analyses_type
        CHECK (analysis_type IN (
            'cycle_review', 'hypothesis_verification',
            'anomaly_detection', 'trend_analysis'
        ))
);

COMMENT ON TABLE analyses IS 'サイクルレビュー・仮説検証・異常検知・トレンド分析の結果を記録';
COMMENT ON COLUMN analyses.findings IS '分析で発見した事実。JSONB構造はanalysis_typeに依存';
COMMENT ON COLUMN analyses.recommendations IS '分析に基づく推奨アクション。戦略エージェントが参照';

-- 6.2 tool_experiences (→ tool_catalog, content)
CREATE TABLE tool_experiences (
    id              SERIAL PRIMARY KEY,
    tool_id         INTEGER NOT NULL REFERENCES tool_catalog(id),
    content_id      VARCHAR(20) REFERENCES content(content_id),
    agent_id        VARCHAR(50) NOT NULL,
    recipe_used     JSONB,
    input_params    JSONB,
    quality_score   DECIMAL(3,2),
    quality_notes   TEXT,
    processing_time_ms INTEGER,
    cost_actual     DECIMAL(10,4),
    success         BOOLEAN NOT NULL,
    failure_reason  TEXT,
    content_type    VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tool_experiences IS 'ツール使用の結果記録。品質・コスト・成功率をcontent_type別に蓄積';
COMMENT ON COLUMN tool_experiences.quality_score IS '0.00-1.00。0.80以上で高品質、0.50未満で要再生成';
COMMENT ON COLUMN tool_experiences.content_type IS 'コンテンツ特性。ツールの得意不得意をタイプ別に分析';

-- 6.3 tool_external_sources (→ tool_catalog)
CREATE TABLE tool_external_sources (
    id              SERIAL PRIMARY KEY,
    source_type     VARCHAR(50) NOT NULL,
    source_url      TEXT NOT NULL,
    source_account  VARCHAR(200),
    tool_id         INTEGER REFERENCES tool_catalog(id),
    content_summary TEXT NOT NULL,
    key_insights    JSONB,
    embedding       vector(1536),
    relevance_score DECIMAL(3,2),
    fetched_at      TIMESTAMPTZ NOT NULL,
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tool_external_sources_source_type
        CHECK (source_type IN (
            'x_post', 'official_doc', 'press_release', 'blog',
            'forum', 'research_paper', 'changelog', 'other'
        ))
);

COMMENT ON TABLE tool_external_sources IS 'ツール関連の外部情報源。X投稿・公式ドキュメント・ブログ等を収集';
COMMENT ON COLUMN tool_external_sources.source_type IS 'x_post/official_doc/press_release/blog/forum/research_paper/changelog/other';
COMMENT ON COLUMN tool_external_sources.tool_id IS 'NULLable。特定ツールに紐付かない一般情報の場合はNULL';
COMMENT ON COLUMN tool_external_sources.embedding IS '類似情報の自動発見・重複排除用。1536次元';

-- 6.5 prompt_suggestions
CREATE TABLE prompt_suggestions (
    id              SERIAL PRIMARY KEY,
    agent_type      TEXT NOT NULL CHECK (agent_type IN (
        'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator'
    )),
    trigger_type    VARCHAR(50) NOT NULL,
    trigger_details JSONB NOT NULL,
    suggestion      TEXT NOT NULL,
    target_prompt_section VARCHAR(100),
    confidence      DECIMAL(3,2),
    status          VARCHAR(20) DEFAULT 'pending',
    human_feedback  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,

    CONSTRAINT chk_prompt_suggestions_trigger_type
        CHECK (trigger_type IN (
            'score_decline', 'repeated_issue', 'new_pattern',
            'tool_update', 'manual', 'other'
        )),
    CONSTRAINT chk_prompt_suggestions_status
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

COMMENT ON TABLE prompt_suggestions IS 'プロンプト改善の自動提案。トリガー検知→提案生成→人間レビューのフロー';
COMMENT ON COLUMN prompt_suggestions.trigger_type IS 'score_decline/repeated_issue/new_pattern/tool_update/manual/other';
COMMENT ON COLUMN prompt_suggestions.confidence IS '提案の確信度。0.80以上でデータに基づく明確な改善点';
COMMENT ON COLUMN prompt_suggestions.status IS 'pending→accepted/rejected/expired。人間がダッシュボードで判断';
