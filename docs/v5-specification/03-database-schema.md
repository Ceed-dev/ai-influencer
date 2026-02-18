# PostgreSQLスキーマ完全定義

> v5.0の全テーブル・カラム・リレーション・インデックスを定義する
>
> **データベース**: PostgreSQL 16+ with pgvector extension
>
> **テーブル数**: 26テーブル (Entity 3 / Production 3 / Intelligence 5 / Operations 5 / Observability 5 / Tool Management 5)
>
> **関連ドキュメント**: [02-architecture.md](02-architecture.md) (データ基盤層の設計思想), [01-tech-stack.md](01-tech-stack.md) (pgvector・ORM選定)

## 目次

- [概要](#概要)
  - [テーブルカテゴリ](#テーブルカテゴリ)
  - [ER図](#er図)
- [初期セットアップ](#初期セットアップ)
- [1. Entity Tables (エンティティテーブル)](#1-entity-tables-エンティティテーブル)
  - [1.1 accounts — アカウント管理](#11-accounts--アカウント管理)
  - [1.2 characters — キャラクター管理](#12-characters--キャラクター管理)
  - [1.3 components — コンポーネント管理](#13-components--コンポーネント管理)
- [2. Production Tables (制作テーブル)](#2-production-tables-制作テーブル)
  - [2.1 content — コンテンツ管理](#21-content--コンテンツ管理)
  - [2.2 content_sections — セクション構成](#22-content_sections--セクション構成)
  - [2.3 publications — 投稿記録](#23-publications--投稿記録)
- [3. Intelligence Tables (インテリジェンステーブル)](#3-intelligence-tables-インテリジェンステーブル)
  - [3.1 hypotheses — 仮説管理](#31-hypotheses--仮説管理)
  - [3.2 market_intel — 市場情報統合](#32-market_intel--市場情報統合)
  - [3.3 metrics — パフォーマンス計測値](#33-metrics--パフォーマンス計測値)
  - [3.4 analyses — 分析結果](#34-analyses--分析結果)
  - [3.5 learnings — 蓄積知見](#35-learnings--蓄積知見)
- [4. Operations Tables (運用テーブル)](#4-operations-tables-運用テーブル)
  - [4.1 cycles — サイクル管理](#41-cycles--サイクル管理)
  - [4.2 human_directives — 人間の指示](#42-human_directives--人間の指示)
  - [4.3 task_queue — タスクキュー](#43-task_queue--タスクキュー)
  - [4.4 algorithm_performance — アルゴリズム精度追跡](#44-algorithm_performance--アルゴリズム精度追跡)
- [5. Observability Tables (運用・可視化テーブル)](#5-observability-tables-運用可視化テーブル)
  - [5.1 agent_prompt_versions — エージェントプロンプト履歴](#51-agent_prompt_versions--エージェントプロンプト履歴)
  - [5.2 agent_thought_logs — エージェント思考ログ](#52-agent_thought_logs--エージェント思考ログ)
  - [5.3 agent_reflections — エージェント個別振り返り](#53-agent_reflections--エージェント個別振り返り)
  - [5.4 agent_individual_learnings — エージェント個別学習メモリ](#54-agent_individual_learnings--エージェント個別学習メモリ)
  - [5.5 agent_communications — エージェント→人間コミュニケーション](#55-agent_communications--エージェント人間コミュニケーション)
- [6. Tool Management Tables (ツール管理テーブル)](#6-tool-management-tables-ツール管理テーブル)
  - [6.1 tool_catalog — ツールカタログ](#61-tool_catalog--ツールカタログ)
  - [6.2 tool_experiences — ツール使用経験](#62-tool_experiences--ツール使用経験)
  - [6.3 tool_external_sources — ツール外部情報源](#63-tool_external_sources--ツール外部情報源)
  - [6.4 production_recipes — 制作レシピ](#64-production_recipes--制作レシピ)
  - [6.5 prompt_suggestions — プロンプト改善提案](#65-prompt_suggestions--プロンプト改善提案)
- [7. インデックス定義](#7-インデックス定義)
  - [7.1 Entity Tables のインデックス](#71-entity-tables-のインデックス)
  - [7.2 Production Tables のインデックス](#72-production-tables-のインデックス)
  - [7.3 Intelligence Tables のインデックス](#73-intelligence-tables-のインデックス)
  - [7.4 Operations Tables のインデックス](#74-operations-tables-のインデックス)
  - [7.5 Observability Tables のインデックス](#75-observability-tables-のインデックス)
  - [7.6 Tool Management Tables のインデックス](#76-tool-management-tables-のインデックス)
- [8. updated_at 自動更新トリガー](#8-updated_at-自動更新トリガー)
- [9. テーブル間リレーション詳細](#9-テーブル間リレーション詳細)
  - [9.1 外部キー一覧](#91-外部キー一覧)
  - [9.2 データフロー上の間接参照](#92-データフロー上の間接参照)
  - [9.3 コンテンツのライフサイクルとテーブル遷移](#93-コンテンツのライフサイクルとテーブル遷移)
- [10. v4.0からのデータ移行マッピング](#10-v40からのデータ移行マッピング)
  - [10.1 Spreadsheet → PostgreSQL マッピング](#101-spreadsheet--postgresql-マッピング)
  - [10.2 カラムマッピング例 (production タブ → content)](#102-カラムマッピング例-production-タブ--content)
- [11. 想定クエリパターン](#11-想定クエリパターン)
  - [11.1 制作パイプライングラフ: タスク取得](#111-制作パイプライングラフ-タスク取得)
  - [11.2 計測ジョブグラフ: 計測対象検出](#112-計測ジョブグラフ-計測対象検出)
  - [11.3 アナリスト: 類似仮説検索 (pgvector)](#113-アナリスト-類似仮説検索-pgvector)
  - [11.4 プランナー: アカウント別パフォーマンスサマリー](#114-プランナー-アカウント別パフォーマンスサマリー)
  - [11.5 ダッシュボード: アルゴリズム精度推移](#115-ダッシュボード-アルゴリズム精度推移)

## 概要

v5.0のPostgreSQLスキーマは、AI-Influencerシステムの全構造化データを一元管理する。v4.0で5つのGoogle Spreadsheet + 33列productionタブに散在していたデータを、リレーショナルDBの正規化された25テーブルに集約する。

### テーブルカテゴリ

| カテゴリ | テーブル数 | 役割 | 主要テーブル |
|---------|----------|------|------------|
| **Entity** | 3 | システムの基本エンティティ定義 | accounts, characters, components |
| **Production** | 3 | コンテンツ制作から投稿までのライフサイクル | content, content_sections, publications |
| **Intelligence** | 5 | 仮説駆動サイクルの知的資産 | hypotheses, market_intel, metrics, analyses, learnings |
| **Operations** | 5 | システム運用・タスク管理 | cycles, human_directives, task_queue, algorithm_performance |
| **Observability** | 5 | エージェントの運用可視化・自己学習・デバッグ | agent_prompt_versions, agent_thought_logs, agent_reflections, agent_individual_learnings, agent_communications |
| **Tool Management** | 5 | AIツールの知識管理・制作レシピ・プロンプト改善 | tool_catalog, tool_experiences, tool_external_sources, production_recipes, prompt_suggestions |

### ER図

```
┌─────────────┐       ┌─────────────┐       ┌─────────────────┐
│  characters │       │  accounts   │       │   components    │
│             │◄──────│             │       │                 │
│ character_id│  uses │ account_id  │       │ component_id    │
│ name        │       │ platform    │       │ type            │
│ voice_id    │       │ niche       │       │ subtype         │
│ appearance  │       │ status      │       │ data (JSONB)    │
└──────┬──────┘       └─────────────┘       └────────┬────────┘
       │                                             │
       │  character_id                               │ component_id
       │                                             │
       │              ┌──────────────┐     ┌─────────▼─────────┐
       └─────────────►│   content    │     │ content_sections  │
                      │              │◄────│                   │
                      │ content_id   │     │ content_id (FK)   │
                      │ status       │     │ component_id (FK) │
                      │ hypothesis_id│     │ section_order     │
                      └──────┬──────┘      │ section_label     │
                             │             └───────────────────┘
                hypothesis_id│  content_id
                             │         │
                ┌────────────▼──┐      │    ┌──────────────┐
                │  hypotheses   │      └───►│ publications │
                │               │           │              │
                │ statement     │           │ content_id   │
                │ verdict       │           │ account_id   │
                │ embedding     │           │ platform     │
                │ (vector)      │           │ posted_at    │
                └───────┬───────┘           └──────┬───────┘
                        │                          │
                  cycle_id                         │ publication_id
                        │                          │
                ┌───────▼───────┐   ┌──────────────▼───┐
                │    cycles     │   │     metrics       │
                │               │   │                   │
                │ cycle_number  │   │ views, likes      │
                │ status        │   │ platform_data     │
                └───────┬───────┘   │ raw_data (JSONB)  │
                        │           └──────────────────┘
                  cycle_id
                        │
                ┌───────▼───────┐   ┌──────────────────┐
                │   analyses    │   │  market_intel     │
                │               │   │                  │
                │ findings      │   │ intel_type       │
                │ recommendations   │ data (JSONB)     │
                └───────────────┘   │ embedding        │
                                    │ (vector)         │
                ┌───────────────┐   └──────────────────┘
                │   learnings   │
                │               │   ┌──────────────────┐
                │ insight       │   │ human_directives │
                │ confidence    │   │                  │
                │ embedding     │   │ directive_type   │
                │ (vector)      │   │ content          │
                └───────────────┘   │ priority         │
                                    └──────────────────┘
                ┌───────────────┐
                │  task_queue   │   ┌──────────────────────┐
                │               │   │ algorithm_performance│
                │ task_type     │   │                      │
                │ payload       │   │ hypothesis_accuracy  │
                │ status        │   │ prediction_error     │
                │ priority      │   │ improvement_rate     │
                └───────────────┘   └──────────────────────┘

                ┌─────────────────────┐   ┌──────────────────────┐
                │agent_prompt_versions│   │  agent_thought_logs  │
                │                     │   │                      │
                │ agent_type          │   │ agent_type           │
                │ version             │   │ cycle_id ────────────┼──► cycles
                │ prompt_content      │   │ graph_name           │
                │ active              │   │ node_name            │
                │ performance_before  │   │ reasoning            │
                │ performance_after   │   │ decision             │
                └─────────────────────┘   └──────────────────────┘

                ┌─────────────────────┐   ┌────────────────────────────┐
                │ agent_reflections   │   │agent_individual_learnings  │
                │                     │   │                            │
                │ agent_type          │   │ agent_type                 │
                │ cycle_id ───────────┼─► │ category                   │
                │ task_description    │   │ content                    │
                │ self_score          │   │ confidence                 │
                │ what_went_well      │   │ success_rate (generated)   │
                │ what_to_improve     │   │ source_reflection_id ──────┼──► agent_reflections
                │ next_actions        │   │ embedding (vector)         │
                └──────────┬──────────┘   └────────────────────────────┘
                           │
                           │ cycle_id
                           ▼
                       cycles

                ┌─────────────────────────────┐
                │   agent_communications      │
                │                             │
                │ agent_type                  │
                │ message_type                │
                │ priority                    │
                │ content                     │
                │ human_response              │
                │ status                      │
                │ cycle_id ───────────────────┼──► cycles
                └─────────────────────────────┘

                ┌─────────────────────┐   ┌──────────────────────┐
                │   tool_catalog      │   │  tool_experiences    │
                │                     │   │                      │
                │ tool_name           │◄──│ tool_id ─────────────┤
                │ tool_type           │   │ content_id ──────────┼──► content
                │ provider            │   │ agent_id             │
                │ cost_per_use        │   │ quality_score        │
                │ strengths (JSONB)   │   │ success              │
                │ quirks (JSONB)      │   │ content_type         │
                │ is_active           │   └──────────────────────┘
                └──────────┬──────────┘
                           │
                           │ tool_id (nullable)
                           │
                ┌──────────▼──────────┐   ┌──────────────────────┐
                │tool_external_sources│   │ production_recipes   │
                │                     │   │                      │
                │ source_type         │   │ recipe_name          │
                │ source_url          │   │ content_format       │
                │ content_summary     │   │ target_platform      │
                │ key_insights (JSONB)│   │ steps (JSONB)        │
                │ embedding (vector)  │   │ avg_quality_score    │
                └─────────────────────┘   │ success_rate         │
                                          │ is_default           │
                ┌─────────────────────┐   └──────────────────────┘
                │ prompt_suggestions  │
                │                     │
                │ agent_type          │
                │ trigger_type        │
                │ suggestion          │
                │ confidence          │
                │ status              │
                └─────────────────────┘
```

## 初期セットアップ

```sql
-- pgvector拡張のインストール
CREATE EXTENSION IF NOT EXISTS vector;

-- タイムゾーン設定 (UTC推奨。表示時にアプリ側でJST変換)
SET timezone = 'UTC';
```

## 1. Entity Tables (エンティティテーブル)

システムの基本構成要素を定義するテーブル群。アカウント・キャラクター・コンポーネント(シナリオ・モーション等)の3テーブルで構成される。

### 1.1 accounts — アカウント管理

各プラットフォーム上のアカウントを管理する。1つのキャラクターが複数プラットフォームのアカウントを持つ（例: CHR_0001が YouTube + TikTok + X の3アカウント）。

v4.0の Accounts Inventory (`1CmT6C3qCW3md6lJ9Rvc2WNQkWa5zcvlq6Zp_enJHoUE`) からの移行先。

```sql
CREATE TABLE accounts (
    -- 主キー
    id              SERIAL PRIMARY KEY,
    account_id      VARCHAR(20) NOT NULL UNIQUE,
        -- ACC_0001形式。v4.0からの継続ID体系
        -- 例: ACC_0013〜ACC_0025 (X accounts: 3 US + 10 JP)

    -- プラットフォーム情報
    platform            VARCHAR(20) NOT NULL,
        -- youtube / tiktok / instagram / x
        -- CHECK制約で許可値を制限
    platform_username   VARCHAR(100),
        -- プラットフォーム上の表示名
        -- 例: @hana_beauty_jp
    platform_account_id VARCHAR(100),
        -- プラットフォーム側の内部ID
        -- YouTube: チャンネルID (UC...)、X: ユーザーID (数値)
        -- 投稿API・計測APIで使用

    -- キャラクター紐付け
    character_id    VARCHAR(20) REFERENCES characters(character_id),
        -- このアカウントが使用するキャラクター
        -- 1キャラクターが複数アカウントを持てる (platform別)

    -- カテゴリ・戦略情報
    niche           VARCHAR(50),
        -- beauty / tech / fitness / pet / cooking / gaming 等
        -- プランナーがコンテンツ企画時にフィルタリングに使用
    cluster         VARCHAR(50),
        -- プランナーエージェントのクラスタ分け用
        -- 例: cluster_a (朝投稿テスト群), cluster_b (夜投稿テスト群)
        -- A/Bテストのグルーピングに利用
    persona_description TEXT,
        -- アカウントのペルソナ設定（自由記述）
        -- 例: "20代女性、韓国コスメ好き、関西弁で親しみやすい口調"
        -- 戦略エージェントが投稿のトーン調整に参照

    -- 認証情報
    auth_credentials JSONB,
        -- OAuth tokens等の認証情報
        -- 構造例:
        -- {
        --   "access_token": "ya29...",
        --   "refresh_token": "1//0...",
        --   "token_type": "Bearer",
        --   "expiry": "2026-03-15T00:00:00Z"
        -- }
        -- 注意: 本番環境では暗号化推奨 (pgcrypto or アプリ層で暗号化)

    -- ステータス・メトリクス
    status          VARCHAR(20) NOT NULL DEFAULT 'setup',
        -- active: 稼働中（投稿・計測対象）
        -- suspended: 一時停止（BANリスク等で自主停止）
        -- setup: 初期設定中（OAuth未完了等）
    follower_count  INTEGER DEFAULT 0,
        -- 最新のフォロワー数（計測ジョブが定期更新）
    monetization_status VARCHAR(20) DEFAULT 'none',
        -- none: 収益化未達
        -- eligible: 収益化条件達成（申請可能）
        -- active: 収益化有効

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
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
```

### 1.2 characters — キャラクター管理

AI-Influencerのキャラクター（外見・性格・声）を管理する。キャラクター画像はGoogle Driveに保存し、`image_drive_id` で紐付ける。

v4.0の Characters Inventory からの移行先。

```sql
CREATE TABLE characters (
    -- 主キー
    id              SERIAL PRIMARY KEY,
    character_id    VARCHAR(20) NOT NULL UNIQUE,
        -- CHR_0001形式
        -- 例: CHR_0001 (folder: 1zAZj-Cm3rLZ2oJHZDPUwvDfxL_ufS8g0)

    -- 基本情報
    name            VARCHAR(100) NOT NULL,
        -- キャラクター名
        -- 例: "Hana", "Yuki", "Ken"
    description     TEXT,
        -- キャラクターの概要説明
        -- 例: "明るく元気な20代女性。美容系コンテンツに特化"

    -- 外見設定
    appearance      JSONB,
        -- キャラクターの外見をJSON構造で定義
        -- 構造例:
        -- {
        --   "gender": "female",
        --   "age_range": "20s",
        --   "hair_color": "dark_brown",
        --   "hair_style": "long_straight",
        --   "eye_color": "brown",
        --   "skin_tone": "fair",
        --   "style": "casual_modern"
        -- }

    -- 性格設定
    personality     JSONB,
        -- キャラクターの性格・口調をJSON構造で定義
        -- 構造例:
        -- {
        --   "traits": ["friendly", "energetic", "curious"],
        --   "speaking_style": "casual",
        --   "language_preference": "jp",
        --   "emoji_usage": "moderate",
        --   "catchphrase": "みんな〜！今日も一緒にキレイになろう！"
        -- }

    -- 音声設定
    voice_id        VARCHAR(32),
        -- Fish Audio 32-char hex reference_id
        -- 例: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
        -- v4.0制約: 空の場合はエラー（必須フィールド）
        -- TTS生成時にFish Audio APIのreferenceIdパラメータとして使用

    -- Google Drive連携
    image_drive_id  VARCHAR(100),
        -- Google DriveのファイルID（キャラクター画像 PNG）
        -- 例: "1abc2def3ghi4jkl5mno6pqr"
        -- 制作パイプラインがfal.storageにアップロードする際の元画像
        -- Kling制限: 3850x3850px以下（超過時はorchestrator.jsが自動リサイズ）

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE characters IS 'AIキャラクター定義。外見・性格・声の設定を一元管理';
COMMENT ON COLUMN characters.voice_id IS 'Fish Audio 32-char hex reference_id。TTS生成時に必須';
COMMENT ON COLUMN characters.image_drive_id IS 'Google DriveファイルID。制作パイプラインが参照';
```

### 1.3 components — コンポーネント管理

シナリオ・モーション・オーディオ・画像などの制作素材を統合管理する。v4.0では Scenarios Inventory / Motions Inventory / Audio Inventory に分散していたデータを `type` カラムで区別して1テーブルに集約する。

```sql
CREATE TABLE components (
    -- 主キー
    id              SERIAL PRIMARY KEY,
    component_id    VARCHAR(30) NOT NULL UNIQUE,
        -- 種別ごとのID体系
        -- シナリオ: SCN_0001
        -- モーション: MOT_0001
        -- オーディオ: AUD_0001
        -- 画像: IMG_0001

    -- 種別分類
    type            VARCHAR(20) NOT NULL,
        -- scenario: シナリオ（スクリプト + プロンプト）
        -- motion: モーション参照動画（Kling入力用）
        -- audio: BGM・効果音
        -- image: 背景画像・オーバーレイ素材
    subtype         VARCHAR(30),
        -- コンポーネントの用途分類（自由タグ）
        -- 例: hook / body / cta / intro / main / transition / summary 等
        -- v4.0ではhook/body/ctaの3分類だったが、v5.0ではセクション構成が
        -- コンテンツごとに動的に決まるため、制約を緩和
        -- 任意フィールド (NULLも可)

    -- 基本情報
    name            VARCHAR(200) NOT NULL,
        -- コンポーネント名
        -- 例: "朝のスキンケアルーティン - イントロ"
    description     TEXT,
        -- コンポーネントの説明
        -- 例: "視聴者の注意を引く冒頭5秒。驚きの表情から始まる"

    -- 種別固有データ (JSONB)
    data            JSONB,
        -- 種別に応じた構造化データ
        --
        -- [scenario の場合]
        -- {
        --   "script_en": "Hey everyone! Today I'm going to show you...",
        --   "script_jp": "みんな〜！今日は最強のスキンケアを紹介するよ！",
        --   "scenario_prompt": "Young woman excitedly showing skincare products",
        --   "duration_seconds": 5,
        --   "emotion": "excited",
        --   "camera_angle": "close-up"
        -- }
        --
        -- [motion の場合]
        -- {
        --   "duration_seconds": 5,
        --   "motion_type": "talking_head",
        --   "character_orientation": "front",
        --   "movement": "subtle_nod"
        -- }
        --
        -- [audio の場合]
        -- {
        --   "duration_seconds": 30,
        --   "genre": "upbeat_pop",
        --   "bpm": 120,
        --   "license": "royalty_free"
        -- }

    -- Google Drive連携
    drive_file_id   VARCHAR(100),
        -- Google DriveのファイルID
        -- motion: 参照動画のDrive ID
        -- audio: 音声ファイルのDrive ID
        -- scenario: 通常はNULL（テキストデータのためDrive不要）

    -- カテゴリ・タグ
    niche           VARCHAR(50),
        -- beauty / tech / fitness 等
        -- アカウントのnicheとマッチングして使用
    tags            TEXT[],
        -- 自由タグ配列
        -- 例: {'skincare', 'morning_routine', 'korean_beauty'}
        -- 検索・フィルタリングに使用

    -- パフォーマンス指標
    score           NUMERIC(5,2),
        -- コンポーネントスコア（0.00〜100.00）
        -- アナリストエージェントが分析結果に基づいて更新
        -- このコンポーネントを使ったコンテンツの平均パフォーマンス
    usage_count     INTEGER NOT NULL DEFAULT 0,
        -- 使用回数。制作パイプラインが制作完了時にインクリメント
        -- プランナーが「使い古されたシナリオ」を避ける判断材料

    -- キュレーション管理
    curated_by      VARCHAR(20) NOT NULL DEFAULT 'human',
        -- auto: データキュレーターが自動生成
        -- human: 人間が手動作成
    curation_confidence DECIMAL(3,2),
        -- キュレーターの自信度 (0.00〜1.00)
        -- curated_by='auto' の場合のみ設定
        -- 閾値以上なら自動承認、未満なら人間レビュー要
    review_status   VARCHAR(20) NOT NULL DEFAULT 'auto_approved',
        -- auto_approved: 自動承認済み (人間作成 or 高自信度の自動生成)
        -- pending_review: 人間レビュー待ち (低自信度の自動生成)
        -- human_approved: 人間がレビューして承認済み

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_components_type
        CHECK (type IN ('scenario', 'motion', 'audio', 'image')),
    -- subtype は自由タグのため CHECK 制約なし (任意の文字列を許可)
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
```

## 2. Production Tables (制作テーブル)

コンテンツの制作から投稿までのライフサイクルを管理する。`content` テーブルがv4.0の production タブ (33カラム) の後継、`content_sections` テーブルが動的セクション構成を管理し、`publications` テーブルが投稿記録を分離して保持する。

### 2.1 content — コンテンツ管理

コンテンツの制作ライフサイクルを管理する中核テーブル。`content_format` でコンテンツ形式 (`short_video` / `text_post` / `image_post`) を区別し、使用するワーカータイプを決定する。`recipe_id` で Tool Specialist が選択した制作レシピ (`production_recipes`) を参照する。制作ステータス (`pending_approval` → `planned` → `producing` → `ready` → `analyzed`) を追跡し、LangGraphグラフ間の間接連携ポイントとなる。`REQUIRE_HUMAN_APPROVAL=true` 時はAI承認後に `pending_approval` で人間の承認を待ち、`false` 時は直接 `planned` に遷移する。投稿以降のライフサイクル (`scheduled` → `posted` → `measured`) は `publications` テーブルで管理する（1コンテンツ→N投稿の1:Nモデル）。

v4.0の production タブ (33カラム) からの移行先。

```sql
CREATE TABLE content (
    -- 主キー
    id              SERIAL PRIMARY KEY,
    content_id      VARCHAR(20) NOT NULL UNIQUE,
        -- CNT_YYYYMM_NNNN形式
        -- 例: CNT_202602_2916 (v4.0の初回E2E成功コンテンツ)

    -- 紐付け
    hypothesis_id   INTEGER REFERENCES hypotheses(id),
        -- この制作の根拠となった仮説
        -- NULLの場合: 人間が直接指示したコンテンツ（仮説駆動でない）
        -- 戦略サイクルグラフが仮説に基づいてコンテンツ計画を作成する際に設定

    -- コンテンツフォーマット
    content_format  VARCHAR(20) NOT NULL DEFAULT 'short_video',
        -- コンテンツの形式。使用するワーカータイプを決定する
        -- short_video: 短尺動画 (YouTube Shorts, TikTok, IG Reels)
        -- text_post: テキスト投稿 (X/Twitter)
        -- image_post: 画像投稿 (将来拡張)

    -- 制作レシピ
    recipe_id       INTEGER REFERENCES production_recipes(id),
        -- Tool Specialistが選択した制作レシピ
        -- content_format='short_video'時: 動画制作のツール組み合わせ (Kling + Fish Audio + lipsync等)
        -- content_format='text_post'時: NULL (Text WorkerがLLMで直接生成、レシピ不要)
        -- プランナーがコンテンツ計画作成後、Tool Specialistが設定

    -- ステータス管理 (制作ライフサイクルのみ)
    status          VARCHAR(20) NOT NULL DEFAULT 'planned',
        -- pending_approval: AI承認済み、人間の承認待ち (REQUIRE_HUMAN_APPROVAL=true時のみ)
        -- planned:    人間 or AI が計画承認済み。制作待ち
        -- producing:  制作パイプラインが動画生成中
        -- ready:      動画完成。投稿待ちプール内
        --             ※ readyの後はpublicationsテーブルで各投稿先を管理
        -- analyzed:   全publicationsの計測完了後、分析結果が知見として保存済み
        -- error:      制作で回復不能エラー発生
        -- cancelled:  人間orエージェントが取消
    planned_post_date DATE,
        -- 投稿予定日。戦略サイクルが設定
        -- 投稿スケジューラーがこの日付+最適時間帯で投稿

    -- セクション構成は content_sections テーブルで管理
    -- (動的N分割: コンテンツごとにセクション数・種類が異なる)

    -- キャラクター
    character_id    VARCHAR(20) REFERENCES characters(character_id),
        -- 使用するキャラクター
        -- 通常はaccount_idから辿れるが、明示的に保持
        -- （アカウントのキャラクターが変更された場合の履歴保持）

    -- スクリプト
    script_language VARCHAR(5),
        -- en / jp
        -- components.data.script_en or script_jp のどちらを使用するかを決定
        -- v4.0の script_language カラムからの継続
    -- セクション別スクリプトは content_sections テーブルで管理
    -- (各セクションに script カラムがあり、LLM調整版を保持)

    -- 完成動画情報
    video_drive_id  VARCHAR(100),
        -- 完成動画 (final.mp4) のGoogle DriveファイルID
    video_drive_url TEXT,
        -- Google Drive上のURL (human-readable)
        -- 例: https://drive.google.com/file/d/{id}/view
    drive_folder_id VARCHAR(100),
        -- 動画保存先フォルダのDrive ID
        -- Productions/YYYY-MM-DD/CNT_YYYYMM_XXXX/ のフォルダID

    -- 制作メタデータ
    production_metadata JSONB,
        -- 制作パイプラインの実行情報
        -- 構造例:
        -- {
        --   "sections": [
        --     {
        --       "order": 1, "label": "hook",
        --       "fal_request_ids": {"kling": "req_abc123", "tts": "req_jkl012", "lipsync": "req_mno345"},
        --       "processing_time_seconds": 240,
        --       "file_size_bytes": 18000000
        --     },
        --     {
        --       "order": 2, "label": "body",
        --       "fal_request_ids": {"kling": "req_def456", "tts": "req_pqr678", "lipsync": "req_stu901"},
        --       "processing_time_seconds": 230,
        --       "file_size_bytes": 20000000
        --     },
        --     {
        --       "order": 3, "label": "cta",
        --       "fal_request_ids": {"kling": "req_ghi789", "tts": "req_vwx234", "lipsync": "req_yza567"},
        --       "processing_time_seconds": 250,
        --       "file_size_bytes": 16000000
        --     }
        --   ],
        --   "total_seconds": 720,
        --   "concat_seconds": 15,
        --   "final_file_size_bytes": 54000000,
        --   "pipeline_version": "5.0",
        --   "recipe_id": "RCP_0001",
        --   "dry_run": false
        -- }

    -- 人間承認
    approved_by         VARCHAR(100),           -- 承認者 (NULL = 未承認 or 自動承認)
    approved_at         TIMESTAMPTZ,            -- 承認日時
    approval_feedback   TEXT,                   -- 差戻時のフィードバック
    rejection_category  VARCHAR(30),            -- 差戻しカテゴリ (戻り先を決定)
        -- plan_revision: 計画修正 → プランナーに戻る (デフォルト)
        -- data_insufficient: データ不足 → リサーチャーに戻る
        -- hypothesis_weak: 仮説が弱い → アナリストに戻る
        -- AI (Opus) も人間も差戻し時にカテゴリを指定可能

    -- エラー情報
    error_message   TEXT,
        -- エラー発生時の詳細メッセージ
        -- fal.ai 403 "Forbidden" = 残高不足
        -- fal.ai 422 = パラメータ不正 (prompt空文字, keep_original_sound等)

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_content_status
        CHECK (status IN (
            'pending_approval', 'planned', 'producing', 'ready', 'analyzed',
            'error', 'cancelled'
        )),
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
COMMENT ON COLUMN content.status IS 'pending_approval→planned→producing→ready→analyzed の制作ステータス遷移。pending_approvalはREQUIRE_HUMAN_APPROVAL=true時のみ使用。投稿以降はpublicationsテーブルで管理';
COMMENT ON COLUMN content.hypothesis_id IS '仮説駆動サイクルの根拠。NULLは人間の直接指示';
COMMENT ON COLUMN content.content_format IS 'コンテンツ形式。short_video/text_post/image_post。使用するワーカータイプを決定';
COMMENT ON COLUMN content.recipe_id IS 'Tool Specialistが選択した制作レシピ。text_postではNULL可 (LLM直接生成)';
COMMENT ON COLUMN content.production_metadata IS 'fal.ai request ID, 処理時間, ファイルサイズ等';
COMMENT ON COLUMN content.rejection_category IS '差戻しカテゴリ。plan_revision=プランナーへ, data_insufficient=リサーチャーへ, hypothesis_weak=アナリストへ。AI・人間両方が設定可能';
```

### 2.2 content_sections — セクション構成

コンテンツを構成するセクションの順序と使用コンポーネントを管理するジャンクションテーブル。v4.0では固定3セクション (Hook/Body/CTA) だったが、v5.0ではセクション数・種類をコンテンツごとに動的に決定する。プランナーが `plan_content` MCPツールでコンテンツ計画と同時に作成する。

```sql
CREATE TABLE content_sections (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 紐付け
    content_id      VARCHAR(20) NOT NULL REFERENCES content(content_id),
        -- このセクションが属するコンテンツ
    component_id    VARCHAR(30) NOT NULL REFERENCES components(component_id),
        -- このセクションで使用するコンポーネント (シナリオ or モーション)

    -- セクション情報
    section_order   INTEGER NOT NULL,
        -- セクションの表示順序 (1, 2, 3, ...)
        -- ffmpeg concatの結合順序を決定
    section_label   VARCHAR(30) NOT NULL,
        -- セクションの名前 (自由タグ)
        -- 例: "hook", "body", "cta", "intro", "main", "transition", "summary"
        -- ファイル名にも使用: section_01_{label}.mp4

    -- スクリプト
    script          TEXT,
        -- このセクションで実際に使用されたスクリプト
        -- componentsのscript_en/jpをコピー or LLMが調整した版
        -- テキストコンテンツ (X投稿等) の場合は最終テキスト

    -- 制作結果
    drive_file_id   VARCHAR(100),
        -- 完成したセクション動画のDrive ID
        -- 例: section_01.mp4 のファイルID
    duration_seconds NUMERIC(8,2),
        -- セクションの長さ (秒)

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT uq_content_section_order
        UNIQUE (content_id, section_order)
        -- 同じコンテンツ内でセクション順序は一意
);

COMMENT ON TABLE content_sections IS 'コンテンツのセクション構成。1コンテンツに対して動的にN件のセクションを定義';
COMMENT ON COLUMN content_sections.section_order IS 'セクションの結合順序。ffmpeg concatの順序を決定';
COMMENT ON COLUMN content_sections.section_label IS 'セクション名。hook/body/cta等の自由タグ';
COMMENT ON COLUMN content_sections.script IS '実際に使用されたスクリプト。LLMが調整した最終版';
```

### 2.3 publications — 投稿記録

コンテンツの実際の投稿記録を管理する。1つのコンテンツが複数プラットフォームに投稿される可能性があるため、content テーブルから分離する。投稿スケジューラーグラフが書き込み、計測ジョブグラフが `measure_after` を参照して計測タイミングを判定する。

```sql
CREATE TABLE publications (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 紐付け
    content_id      VARCHAR(20) NOT NULL REFERENCES content(content_id),
        -- 元のコンテンツ
    account_id      VARCHAR(20) NOT NULL REFERENCES accounts(account_id),
        -- 投稿先アカウント

    -- プラットフォーム情報
    platform        VARCHAR(20) NOT NULL,
        -- youtube / tiktok / instagram / x
        -- accounts.platformと同値だが、明示的に保持（JOIN不要で高速参照）
    platform_post_id VARCHAR(100),
        -- 投稿後にプラットフォームが返すID
        -- YouTube: 動画ID (例: "dQw4w9WgXcQ")
        -- TikTok: 投稿ID
        -- X: ツイートID
        -- 計測API呼び出し時に必要

    -- 投稿情報
    posted_at       TIMESTAMPTZ,
        -- 実際の投稿日時
        -- 投稿スケジューラーが投稿成功時に記録
    post_url        TEXT,
        -- 投稿のURL
        -- 例: "https://youtube.com/shorts/dQw4w9WgXcQ"
    measure_after   TIMESTAMPTZ,
        -- 計測開始可能日時
        -- デフォルト: posted_at + INTERVAL '48 hours'
        -- ダッシュボードから変更可能 (24h, 72h等)
        -- 計測ジョブが NOW() > measure_after の行を検出して計測実行

    -- ステータス
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        -- scheduled: 投稿予定
        -- posted: 投稿完了
        -- measured: 計測完了 (最終計測回の完了後)
        -- failed: 投稿失敗 (API エラー, アカウントBAN等)

    -- 追加情報
    metadata        JSONB,
        -- 投稿時の追加情報
        -- 構造例:
        -- {
        --   "title": "朝のスキンケアルーティン🌸",
        --   "description": "今日は...",
        --   "tags": ["skincare", "beauty"],
        --   "thumbnail_drive_id": "1abc...",
        --   "visibility": "public",
        --   "api_response": { ... }
        -- }

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_publications_platform
        CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'x')),
    CONSTRAINT chk_publications_status
        CHECK (status IN ('scheduled', 'posted', 'measured', 'failed'))
);

COMMENT ON TABLE publications IS '投稿記録。1コンテンツが複数プラットフォームに投稿される可能性に対応';
COMMENT ON COLUMN publications.measure_after IS 'posted_at + 48h。計測ジョブのトリガー条件';
COMMENT ON COLUMN publications.platform_post_id IS 'プラットフォームが返す投稿ID。計測APIで使用';
```

## 3. Intelligence Tables (インテリジェンステーブル)

仮説駆動サイクルの知的資産を蓄積するテーブル群。pgvectorによるベクトル検索を活用し、類似仮説・関連知見・トレンドの自動発見を実現する。v5.0の中核となる「学習するAI」を支えるデータ基盤。

### 3.1 hypotheses — 仮説管理

仮説駆動サイクルの中核テーブル。アナリストエージェントが仮説を生成し、制作・投稿・計測を経て、仮説の正否を検証する。pgvectorのembeddingにより、過去の類似仮説を自動検索して重複生成を防止する。

```sql
CREATE TABLE hypotheses (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- サイクル紐付け
    cycle_id        INTEGER REFERENCES cycles(id),
        -- この仮説が生成されたサイクル
        -- サイクル横断で仮説の的中率推移を分析可能

    -- 生成元
    source          VARCHAR(10) NOT NULL DEFAULT 'ai',
        -- ai: AIエージェント（アナリスト）が生成
        -- human: 人間がダッシュボードから投入
        -- human_directivesテーブルとは別管理（仮説は検証対象、指示は命令）

    -- 仮説カテゴリ
    category        VARCHAR(30) NOT NULL,
        -- content_format: コンテンツ形式に関する仮説
        --   例: "リアクション動画はvlog形式より完視聴率が20%高い"
        -- timing: 投稿タイミングに関する仮説
        --   例: "ペットニッチで朝7時投稿は夜投稿より30%高いエンゲージメント"
        -- niche: ジャンルに関する仮説
        --   例: "tech×美容のクロスオーバーコンテンツは単独ニッチより反応が良い"
        -- audience: オーディエンスに関する仮説
        --   例: "Z世代向けアカウントではCTAの直接的な呼びかけが効果的"
        -- platform_specific: プラットフォーム固有の仮説
        --   例: "TikTokでは最初の1秒にテキストオーバーレイがあると離脱率が下がる"

    -- 仮説の内容
    statement       TEXT NOT NULL,
        -- 仮説文（検証可能な形式で記述）
        -- 例: "ペットニッチで朝7時投稿は夜投稿より30%高いエンゲージメントを得る"
        -- 良い仮説: 具体的な数値目標を含む
        -- 悪い仮説: "良いコンテンツは伸びる" （曖昧で検証不能）
    rationale       TEXT,
        -- 仮説の根拠
        -- 例: "過去30日のデータで朝投稿の平均engagement_rate 0.05 vs 夜投稿 0.035。
        --       サンプル数は少ないが傾向が見られる"

    -- 検証対象
    target_accounts VARCHAR(20)[],
        -- 仮説を検証するためにコンテンツを投稿するアカウント群
        -- 例: {'ACC_0013', 'ACC_0015', 'ACC_0018'}
        -- プランナーがこのリストを参照してコンテンツ計画に組み込む

    -- KPI予測と実測
    predicted_kpis  JSONB,
        -- 仮説が正しい場合に期待されるKPI
        -- 構造例:
        -- {
        --   "views": 5000,
        --   "engagement_rate": 0.05,
        --   "completion_rate": 0.7,
        --   "follower_delta": 50
        -- }
    actual_kpis     JSONB,
        -- 計測後の実測値（同構造）
        -- 計測ジョブが計測完了後に集計して更新
        -- NULLの場合: まだ計測されていない

    -- 検証結果
    verdict         VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending: 検証前（コンテンツ制作・投稿待ち）
        -- confirmed: 仮説が確認された（predicted vs actual の誤差が閾値内）
        -- rejected: 仮説が棄却された
        -- inconclusive: データ不足で判定不能（サンプル数不足等）
    confidence      NUMERIC(3,2) DEFAULT 0.00,
        -- 確信度 0.00〜1.00
        -- confirmed: 0.7以上が目安
        -- rejected: 0.3以下が目安
        -- inconclusive: 0.3〜0.7
    evidence_count  INTEGER NOT NULL DEFAULT 0,
        -- この仮説を検証するために使われたコンテンツ数
        -- evidence_count >= 5 で有意な判定が可能

    -- ベクトル検索
    embedding       vector(1536),
        -- 仮説文 (statement) のベクトル埋め込み
        -- text-embedding-3-small (OpenAI) or Voyage-3 (Anthropic) で生成
        -- 用途: 類似仮説の検索、重複仮説の防止
        -- 検索例: ORDER BY embedding <=> $1 LIMIT 10

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
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
```

### 3.2 market_intel — 市場情報統合

トレンド、競合投稿、競合アカウント、オーディエンスシグナル、プラットフォームアップデートの5つのサブタイプを1テーブルに統合する。リサーチャーエージェントが収集し、アナリスト・プランナーが参照する。

```sql
CREATE TABLE market_intel (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 情報タイプ
    intel_type      VARCHAR(30) NOT NULL,
        -- trending_topic: トレンドトピック
        --   data例: {"topic": "glass skin", "volume": 50000, "growth_rate": 2.5}
        --
        -- competitor_post: 競合の注目投稿
        --   data例: {"post_url": "...", "views": 1000000, "format": "reaction",
        --            "hook_technique": "question", "competitor_account": "ACC_C001"}
        --
        -- competitor_account: 競合アカウント情報
        --   data例: {"username": "@beauty_guru", "followers": 500000,
        --            "posting_frequency": "daily", "avg_views": 50000}
        --
        -- audience_signal: オーディエンスの反応シグナル
        --   data例: {"signal_type": "comment_sentiment", "topic": "skincare",
        --            "sentiment": "positive", "sample_comments": [...]}
        --
        -- platform_update: プラットフォームのアルゴリズム変更情報
        --   data例: {"platform": "tiktok", "update_type": "algorithm_change",
        --            "description": "Longer videos (>60s) now get more reach",
        --            "effective_date": "2026-03-01"}

    -- スコープ
    platform        VARCHAR(20),
        -- youtube / tiktok / instagram / x / NULL (全プラットフォーム共通)
    niche           VARCHAR(50),
        -- beauty / tech / fitness / NULL (全ジャンル共通)

    -- データ本体
    data            JSONB NOT NULL,
        -- intel_typeに応じた構造化データ (上記の例を参照)
    source_url      TEXT,
        -- 情報のソースURL
        -- 例: 競合投稿のURL、トレンドレポートのURL

    -- 評価
    relevance_score NUMERIC(3,2),
        -- 関連性スコア 0.00〜1.00
        -- リサーチャーが情報の重要度を評価
        -- アナリストが高スコアの情報を優先的に分析

    -- 有効期間
    collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- 情報の収集日時
    expires_at      TIMESTAMPTZ,
        -- 情報の有効期限
        -- trending_topic: collected_at + 7日 (トレンドは短命)
        -- competitor_account: collected_at + 30日 (アカウント情報は比較的安定)
        -- platform_update: NULL (恒久的に有効)
        -- 期限切れの情報はアナリストが参照しない (WHERE expires_at > NOW())

    -- ベクトル検索
    embedding       vector(1536)
        -- data内容のベクトル埋め込み
        -- 用途: 類似トレンドの発見、過去の類似市場状況との比較
);

COMMENT ON TABLE market_intel IS '5種の市場情報を統合管理。リサーチャーが収集、アナリスト・プランナーが参照';
COMMENT ON COLUMN market_intel.intel_type IS 'trending_topic/competitor_post/competitor_account/audience_signal/platform_update';
COMMENT ON COLUMN market_intel.expires_at IS 'トレンドは7日、アカウント情報は30日。NULLは恒久';
```

### 3.3 metrics — パフォーマンス計測値

投稿のパフォーマンスを時系列で記録する。計測ジョブグラフがプラットフォームAPIから取得したデータを保存し、アナリストエージェントが仮説検証に使用する。

```sql
CREATE TABLE metrics (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 紐付け
    publication_id  INTEGER NOT NULL REFERENCES publications(id),
        -- 計測対象の投稿
        -- 1つのpublicationに対して複数回計測する場合がある
        -- (48h後 + 7日後 + 30日後 等)

    -- 計測日時
    measured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- この計測を実行した日時

    -- エンゲージメント指標
    views           INTEGER,
        -- 再生回数 / インプレッション数
    likes           INTEGER,
        -- いいね数
    comments        INTEGER,
        -- コメント数
    shares          INTEGER,
        -- 共有数 / リポスト数
    saves           INTEGER,
        -- 保存数 (Instagram, TikTok)
        -- YouTube, X: NULL

    -- 視聴行動指標
    watch_time_seconds NUMERIC(12,2),
        -- 総再生時間 (秒)
        -- YouTube: 分析APIから取得
        -- 他プラットフォーム: 推定値 or NULL
    completion_rate NUMERIC(5,4),
        -- 完視聴率 (0.0000〜1.0000)
        -- 動画を最後まで見た視聴者の割合
        -- Shorts/Reelsでは特に重要なKPI

    -- 計算指標
    engagement_rate NUMERIC(5,4),
        -- エンゲージメント率
        -- = (likes + comments + shares + saves) / views
        -- MCP Server側で計算して保存 (エージェントの計算負荷を軽減)

    -- フォロワー影響
    follower_delta  INTEGER,
        -- この投稿前後のフォロワー変化数
        -- 正: フォロワー増加、負: フォロワー減少
        -- 計測ジョブがaccounts.follower_countの前後差分で計算

    -- リーチ指標
    impressions     INTEGER,
        -- インプレッション数 (フィード上で表示された回数)
        -- viewsとは異なる (impressions >= views)
    reach           INTEGER,
        -- リーチ数 (ユニークユーザー数)
        -- Instagram: Insights APIから取得
        -- 他プラットフォーム: NULL or 推定値

    -- プラットフォーム固有メトリクス
    platform_data   JSONB,
        -- プラットフォーム別の詳細メトリクス (02-architecture.md 3.6節参照)
        --
        -- [YouTube の場合]
        -- {
        --   "estimated_minutes_watched": 1250.5,
        --   "average_view_duration": 12.3,
        --   "average_view_percentage": 78.5,
        --   "audience_watch_ratio": [1.0, 0.95, 0.88, ...],  -- 秒単位の視聴維持率カーブ
        --   "impressions": 45000,
        --   "impression_click_through_rate": 0.045,
        --   "traffic_source_type": {"SUGGESTED": 60, "SEARCH": 25, "EXTERNAL": 15},
        --   "subscribers_gained": 12,
        --   "subscribers_lost": 2,
        --   "demographics": {"age_group": {"18-24": 35, "25-34": 40}, "gender": {"male": 45, "female": 55}},
        --   "estimated_revenue": 0.85
        -- }
        --
        -- [Instagram の場合]
        -- {
        --   "avg_watch_time_ms": 4800,
        --   "completion_rate": 0.65,
        --   "forward_taps": 120,
        --   "backward_taps": 45,
        --   "drop_off": 350,
        --   "skip_rate": 0.22,
        --   "repost_count": 8,
        --   "crossposted_views": 500,
        --   "facebook_views": 200
        -- }
        --
        -- [TikTok の場合]
        -- { } -- TikTok APIでは基本指標のみ (views, likes, comments, shares)
        --
        -- [X の場合]
        -- {
        --   "url_link_clicks": 45,
        --   "user_profile_clicks": 120,
        --   "video_view_count": 8500,
        --   "quote_count": 5,
        --   "bookmark_count": 30
        -- }

    -- 計測回次
    measurement_point VARCHAR(10),
        -- 48h: 投稿後48時間の計測
        -- 7d: 投稿後7日の計測
        -- 30d: 投稿後30日の計測
        -- 1つのpublicationに対して最大3回計測する

    -- 生データ
    raw_data        JSONB,
        -- プラットフォームAPIから取得した生レスポンス
        -- デバッグ・将来の再分析用に全データを保持
        -- 構造はプラットフォームごとに異なる

    -- 制約
    CONSTRAINT chk_metrics_measurement_point
        CHECK (measurement_point IS NULL OR measurement_point IN ('48h', '7d', '30d'))
);

COMMENT ON TABLE metrics IS '投稿パフォーマンスの時系列記録。1投稿に対して最大3回計測 (48h, 7d, 30d)';
COMMENT ON COLUMN metrics.completion_rate IS '完視聴率。Shorts/Reelsの最重要KPI';
COMMENT ON COLUMN metrics.platform_data IS 'プラットフォーム固有の詳細メトリクス (視聴維持率カーブ, トラフィックソース等)';
COMMENT ON COLUMN metrics.measurement_point IS '計測回次。48h/7d/30dの最大3回';
COMMENT ON COLUMN metrics.raw_data IS 'プラットフォームAPIの生レスポンス。再分析・デバッグ用';
```

### 3.4 analyses — 分析結果

サイクル終了時のレビュー、仮説検証結果、異常検知、トレンド分析などの分析結果を記録する。アナリストエージェントが生成し、戦略エージェントが次サイクルの方針決定に参照する。

```sql
CREATE TABLE analyses (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- サイクル紐付け
    cycle_id        INTEGER REFERENCES cycles(id),
        -- この分析が実行されたサイクル
        -- cycle_review: サイクル終了時に必ず1件生成
        -- その他: 随時生成

    -- 分析タイプ
    analysis_type   VARCHAR(30) NOT NULL,
        -- cycle_review: サイクル全体のレビュー
        --   「今サイクルの仮説的中率は62%。前サイクル比+8%。
        --    timingカテゴリの仮説精度が最も向上」
        --
        -- hypothesis_verification: 個別仮説の検証
        --   「仮説H-042: confirmed (confidence: 0.82)。
        --    朝7時投稿は夜投稿比1.3倍のengagement」
        --
        -- anomaly_detection: 異常値の検出
        --   「ACC_0015のviews急落 (前週比-60%)。原因推定: アルゴリズム変更」
        --
        -- trend_analysis: トレンド分析
        --   「glass skinトレンドのピークは通過。関連コンテンツのviews減少傾向」

    -- 分析結果
    findings        JSONB NOT NULL,
        -- 分析で発見した事実
        -- 構造例 (cycle_review):
        -- {
        --   "total_contents_produced": 45,
        --   "total_contents_posted": 42,
        --   "hypotheses_tested": 8,
        --   "hypotheses_confirmed": 5,
        --   "hypotheses_rejected": 2,
        --   "hypotheses_inconclusive": 1,
        --   "accuracy_rate": 0.625,
        --   "top_performing_niche": "beauty",
        --   "worst_performing_niche": "tech",
        --   "avg_engagement_rate": 0.042,
        --   "notable_anomalies": [...]
        -- }

    -- 推奨アクション
    recommendations JSONB,
        -- 分析結果に基づく推奨アクション
        -- 構造例:
        -- [
        --   {
        --     "action": "increase_morning_posts",
        --     "rationale": "朝投稿の仮説が3回連続confirmed",
        --     "priority": "high",
        --     "target_accounts": ["ACC_0013", "ACC_0015"]
        --   },
        --   {
        --     "action": "reduce_tech_content",
        --     "rationale": "techニッチのengagement_rateが全体平均の60%",
        --     "priority": "medium"
        --   }
        -- ]

    -- 影響範囲
    affected_hypotheses INTEGER[],
        -- この分析で影響を受けた仮説のID配列
        -- 例: {42, 43, 47}
        -- hypothesis_verification: 検証対象の仮説ID
        -- cycle_review: そのサイクルで検証された全仮説ID

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_analyses_type
        CHECK (analysis_type IN (
            'cycle_review', 'hypothesis_verification',
            'anomaly_detection', 'trend_analysis'
        ))
);

COMMENT ON TABLE analyses IS 'サイクルレビュー・仮説検証・異常検知・トレンド分析の結果を記録';
COMMENT ON COLUMN analyses.findings IS '分析で発見した事実。JSONB構造はanalysis_typeに依存';
COMMENT ON COLUMN analyses.recommendations IS '分析に基づく推奨アクション。戦略エージェントが参照';
```

### 3.5 learnings — 蓄積知見

複数の分析結果から抽出された、再利用可能な知見を蓄積する。仮説が繰り返し確認されると、知見として昇格する。pgvectorにより類似知見の自動クラスタリングと検索が可能。

```sql
CREATE TABLE learnings (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- カテゴリ
    category        VARCHAR(20) NOT NULL,
        -- content: コンテンツ制作に関する知見
        --   例: "リアクション形式のHookは静的な自己紹介より完視聴率が1.8倍"
        -- timing: 投稿タイミングに関する知見
        --   例: "ペットニッチでは朝7時投稿がエンゲージメント率1.5倍"
        -- audience: オーディエンスに関する知見
        --   例: "Z世代向けでは3秒以内にインパクトがないと80%が離脱"
        -- platform: プラットフォーム固有の知見
        --   例: "TikTokでは縦テキストオーバーレイがviews 1.2倍"
        -- niche: ジャンル固有の知見
        --   例: "beauty×techのクロスオーバーは単独nicheより反応が30%良い"

    -- 知見の内容
    insight         TEXT NOT NULL,
        -- 学習内容を自然言語で記述
        -- 要件: 具体的な数値を含むこと
        -- 良い例: "ペットニッチでは朝7時投稿がエンゲージメント率1.5倍"
        -- 悪い例: "朝に投稿すると良い" (曖昧)

    -- 信頼度
    confidence      NUMERIC(3,2) NOT NULL DEFAULT 0.50,
        -- 0.00〜1.00
        -- 知見の信頼度。evidence_countが増えるにつれて上昇
        -- 0.80以上: 高信頼（プランナーが積極的に適用）
        -- 0.50〜0.79: 中信頼（参考情報として使用）
        -- 0.50未満: 低信頼（追加検証が必要）

    -- 根拠
    evidence_count  INTEGER NOT NULL DEFAULT 0,
        -- この知見を裏付けるデータポイント数
        -- 仮説のconfirmed回数 + 追加の統計的裏付け
        -- evidence_count >= 10 で高信頼知見とみなす
    source_analyses INTEGER[],
        -- 根拠となった分析のID配列 (analyses.id)
        -- 例: {12, 15, 23, 31}
        -- どの分析結果からこの知見が導出されたかを追跡

    -- 適用範囲
    applicable_niches VARCHAR(50)[],
        -- この知見が適用可能なジャンル
        -- 例: {'beauty', 'skincare'}
        -- 空配列 or NULL: 全ジャンル共通
    applicable_platforms VARCHAR(20)[],
        -- この知見が適用可能なプラットフォーム
        -- 例: {'youtube', 'tiktok'}
        -- 空配列 or NULL: 全プラットフォーム共通

    -- ベクトル検索
    embedding       vector(1536),
        -- 知見 (insight) のベクトル埋め込み
        -- 用途: 類似知見の検索、知見の自動クラスタリング
        -- プランナーが「このnicheに関連する知見」を検索する際に使用

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_learnings_category
        CHECK (category IN ('content', 'timing', 'audience', 'platform', 'niche')),
    CONSTRAINT chk_learnings_confidence
        CHECK (confidence >= 0.00 AND confidence <= 1.00)
);

COMMENT ON TABLE learnings IS '繰り返し確認された知見の蓄積。仮説から昇格した再利用可能なインサイト';
COMMENT ON COLUMN learnings.embedding IS '類似知見検索・クラスタリング用。1536次元';
COMMENT ON COLUMN learnings.confidence IS '信頼度。evidence_count増加に伴い上昇。0.80以上で高信頼';
```

## 4. Operations Tables (運用テーブル)

システム運用に必要なサイクル管理、人間の指示、タスクキュー、アルゴリズム性能追跡を管理する。

### 4.1 cycles — サイクル管理

仮説駆動サイクルの実行履歴を管理する。戦略サイクルグラフが日次で1サイクルを実行し、サイクル番号で世代管理する。

```sql
CREATE TABLE cycles (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- サイクル情報
    cycle_number    INTEGER NOT NULL,
        -- サイクル番号（連番）
        -- 1から開始、日次で+1
        -- 仮説・分析・知見がどの世代に属するかを追跡

    -- 時間情報
    started_at      TIMESTAMPTZ,
        -- サイクル開始日時
        -- 戦略サイクルグラフがSTARTノードを通過した時刻
    ended_at        TIMESTAMPTZ,
        -- サイクル終了日時
        -- 戦略エージェントが計画を承認（or 差戻し後再承認）した時刻
        -- NULLの場合: サイクル実行中

    -- ステータス
    status          VARCHAR(20) NOT NULL DEFAULT 'planning',
        -- planning: 市場データ収集・仮説生成・計画策定中
        -- executing: 計画承認済み。制作パイプラインがコンテンツ制作中
        -- measuring: 投稿完了。計測ジョブがメトリクス収集中
        -- analyzing: 計測完了。アナリストが分析・知見抽出中
        -- completed: サイクル完了。全分析結果が保存済み

    -- サイクルサマリー
    summary         JSONB,
        -- サイクル完了時に戦略エージェントが生成するサマリー
        -- 構造例:
        -- {
        --   "contents_planned": 15,
        --   "hypotheses_generated": 3,
        --   "hypotheses_from_human": 1,
        --   "insights_applied": 5,
        --   "estimated_cost": 52.50,
        --   "key_decisions": [
        --     "beautyニッチの朝投稿を強化",
        --     "techニッチの投稿頻度を削減"
        --   ]
        -- }

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_cycles_status
        CHECK (status IN ('planning', 'executing', 'measuring', 'analyzing', 'completed'))
);

COMMENT ON TABLE cycles IS '仮説駆動サイクルの実行履歴。日次で1サイクル実行';
COMMENT ON COLUMN cycles.cycle_number IS '連番。仮説・分析がどの世代に属するかを追跡';
```

### 4.2 human_directives — 人間の指示

ダッシュボードから人間が投入する指示・仮説・参考コンテンツを管理する。戦略エージェントが次のサイクル開始時に `pending` の指示を読み取り、計画に反映する。

```sql
CREATE TABLE human_directives (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 指示タイプ
    directive_type  VARCHAR(20) NOT NULL,
        -- hypothesis: 仮説の投入
        --   人間が「この仮説を検証してほしい」と投入
        --   content例: "朝5時投稿は朝7時より早すぎてengagement下がるはず"
        --   → hypothesesテーブルに source='human' で登録される
        --
        -- reference_content: 参考コンテンツの指定
        --   人間が「このコンテンツを参考にしてほしい」と指定
        --   content例: "https://youtube.com/watch?v=xxx このフォーマットを模倣して"
        --
        -- instruction: 一般的な指示
        --   人間がシステムの挙動を調整
        --   content例: "今週はbeautyニッチに集中して、techは停止"
        --
        -- learning_guidance: 学習方法の指導
        --   人間がエージェントの「学習方法そのもの」を軌道修正
        --   content例: "サンプル数3で仮説確認しているが最低10必要。n<10はinconclusive必須"
        --   → 各エージェントがget_learning_directivesで読み取り、リフレクション方法に反映

    -- 指示内容
    content         TEXT NOT NULL,
        -- 指示の本文（自由記述）

    -- 適用対象
    target_accounts VARCHAR(20)[],
        -- 指示を適用するアカウント
        -- NULL: 全アカウントが対象
        -- 例: {'ACC_0013', 'ACC_0015'}
    target_niches   VARCHAR(50)[],
        -- 指示を適用するジャンル
        -- NULL: 全ジャンルが対象
        -- 例: {'beauty', 'skincare'}

    -- ステータス管理
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- pending: 未処理。次サイクルで戦略エージェントが読み取る
        -- acknowledged: 戦略エージェントが認識済み
        -- applied: 計画に反映済み
        -- expired: 有効期限切れ or 手動取消
    priority        VARCHAR(10) NOT NULL DEFAULT 'normal',
        -- low: 余裕があれば反映
        -- normal: 通常の優先度
        -- high: 優先的に反映
        -- urgent: 即座に反映（進行中のサイクルに割り込み）

    -- 操作者・監査
    created_by      VARCHAR(100),
        -- ダッシュボードのユーザーID or 名前
        -- 例: "admin", "pochi@0xqube.xyz"
    acknowledged_at TIMESTAMPTZ,
        -- 戦略エージェントが認識した日時
        -- pending → acknowledged への遷移時刻

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_directives_type
        CHECK (directive_type IN ('hypothesis', 'reference_content', 'instruction', 'learning_guidance')),
    CONSTRAINT chk_directives_status
        CHECK (status IN ('pending', 'acknowledged', 'applied', 'expired')),
    CONSTRAINT chk_directives_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

COMMENT ON TABLE human_directives IS 'ダッシュボードからの人間の指示。戦略エージェントがサイクル開始時に読み取り';
COMMENT ON COLUMN human_directives.directive_type IS 'hypothesis/reference_content/instruction/learning_guidance。learning_guidanceは各エージェントがget_learning_directivesで読み取り';
COMMENT ON COLUMN human_directives.priority IS 'urgentは進行中サイクルに割り込み';
```

### 4.3 task_queue — タスクキュー

制作・投稿・計測の3種類のタスクを管理するキューテーブル。v4.0の `watch-pipeline.js` (30秒ポーリング) の後継。各LangGraphグラフがこのテーブルをポーリングしてタスクを取得する。

```sql
CREATE TABLE task_queue (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- タスク情報
    task_type       VARCHAR(20) NOT NULL,
        -- produce: 動画制作タスク (制作パイプライングラフが処理)
        -- publish: 投稿タスク (投稿スケジューラーグラフが処理)
        -- measure: 計測タスク (計測ジョブグラフが処理)
        -- curate: データキュレーションタスク (データキュレーターが処理)
    payload         JSONB NOT NULL,
        -- タスク固有のデータ
        --
        -- [produce の場合]
        -- {
        --   "content_id": "CNT_202603_0001",
        --   "character_id": "CHR_0001",
        --   "script_language": "jp",
        --   "recipe_id": "RCP_0001",
        --   "sections": [
        --     {"order": 1, "label": "hook", "component_id": "SCN_0042"},
        --     {"order": 2, "label": "body", "component_id": "SCN_0043"},
        --     {"order": 3, "label": "cta", "component_id": "SCN_0044"}
        --   ],
        --   "dry_run": false
        -- }
        --
        -- [publish の場合]
        -- {
        --   "content_id": "CNT_202603_0001",
        --   "account_id": "ACC_0013",
        --   "platform": "youtube",
        --   "title": "朝のスキンケアルーティン",
        --   "description": "...",
        --   "tags": ["skincare", "beauty"]
        -- }
        --
        -- [measure の場合]
        -- {
        --   "publication_id": 42,
        --   "platform": "youtube",
        --   "platform_post_id": "dQw4w9WgXcQ",
        --   "measurement_type": "48h"
        -- }
        --
        -- [curate の場合]
        -- {
        --   "source": "researcher" | "human" | "analyst",
        --   "data_type": "trending_topic" | "competitor_post" | "reference_content" | "improvement",
        --   "raw_data": { ... },
        --   "target_component_type": "scenario" | "motion" | "audio" | "image" | null,
        --   "source_url": "https://...",
        --   "source_file_id": "1abc...",
        --   "description": "トレンドのglass skinに基づくシナリオ素案"
        -- }

    -- ステータス管理
    status          VARCHAR(20) NOT NULL DEFAULT 'queued',
        -- queued: キュー投入済み。処理待ち
        -- processing: 処理中。assigned_workerが処理中
        -- completed: 処理完了
        -- failed: 処理失敗（リトライ可能な場合は再キューイング）
    priority        INTEGER NOT NULL DEFAULT 0,
        -- 優先度（大きいほど高優先）
        -- 0: 通常
        -- 10: 高優先（human_directives のurgent由来等）
        -- -10: 低優先（バックグラウンドタスク）
    assigned_worker VARCHAR(50),
        -- 処理中のワーカー識別子
        -- 例: "production-worker-1", "publish-worker-2"
        -- NULLの場合: 未アサイン

    -- リトライ管理
    retry_count     INTEGER NOT NULL DEFAULT 0,
        -- 現在のリトライ回数
    max_retries     INTEGER NOT NULL DEFAULT 3,
        -- 最大リトライ回数
        -- retry_count >= max_retries で failed に確定
    error_message   TEXT,
        -- 最新のエラーメッセージ
        -- リトライ時に上書きされる

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
        -- 処理開始日時 (queued → processing)
    completed_at    TIMESTAMPTZ,
        -- 処理完了日時 (processing → completed or failed)

    -- 制約
    CONSTRAINT chk_task_type
        CHECK (task_type IN ('produce', 'publish', 'measure', 'curate')),
    CONSTRAINT chk_task_status
        CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
);

COMMENT ON TABLE task_queue IS '制作・投稿・計測・キュレーションのタスクキュー。各LangGraphグラフがポーリングで取得';
COMMENT ON COLUMN task_queue.priority IS '大きいほど高優先。ORDER BY priority DESC, created_at ASC';
COMMENT ON COLUMN task_queue.max_retries IS 'デフォルト3。retry_count >= max_retries で failed確定';
```

### 4.4 algorithm_performance — アルゴリズム精度追跡

システム全体の「学習能力」を定量的に追跡するテーブル。仮説的中率、予測精度、知見蓄積量の推移を記録し、ダッシュボードのアルゴリズム精度パネルに表示する。

```sql
CREATE TABLE algorithm_performance (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 計測日時
    measured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- この精度データが記録された日時

    -- 期間
    period          VARCHAR(10) NOT NULL,
        -- daily: 日次集計
        -- weekly: 週次集計
        -- monthly: 月次集計
        -- 同一日に daily + weekly + monthly の3行が存在する場合がある

    -- 精度指標
    hypothesis_accuracy NUMERIC(5,4),
        -- 仮説的中率 (0.0000〜1.0000)
        -- = confirmed / (confirmed + rejected)
        -- inconclusiveは分母に含めない
        -- 目標: 初期0.30 → 6ヶ月後0.65
    prediction_error NUMERIC(8,4),
        -- 予測と実測の平均誤差 (RMSE)
        -- predicted_kpis vs actual_kpis の各指標のRMSE
        -- 小さいほど良い。改善トレンドを追跡

    -- 蓄積量
    learning_count  INTEGER,
        -- 累計蓄積知見数 (learningsテーブルのCOUNT)
        -- 増加トレンド = システムが学習している証拠

    -- ジャンル別パフォーマンス
    top_performing_niches JSONB,
        -- ジャンル別のパフォーマンスランキング
        -- 構造例:
        -- [
        --   {"niche": "beauty", "avg_engagement_rate": 0.052, "rank": 1},
        --   {"niche": "pet", "avg_engagement_rate": 0.048, "rank": 2},
        --   {"niche": "tech", "avg_engagement_rate": 0.031, "rank": 3}
        -- ]

    -- 改善率
    improvement_rate NUMERIC(5,4),
        -- 前期比改善率
        -- = (current_accuracy - previous_accuracy) / previous_accuracy
        -- 正: 改善、負: 悪化、0: 横ばい

    -- 追加情報
    metadata        JSONB,
        -- その他のメタデータ
        -- 構造例:
        -- {
        --   "total_hypotheses_tested": 120,
        --   "total_contents_produced": 850,
        --   "total_accounts_active": 45,
        --   "avg_production_time_seconds": 680,
        --   "cost_per_content_usd": 1.15
        -- }

    -- 制約
    CONSTRAINT chk_algorithm_period
        CHECK (period IN ('daily', 'weekly', 'monthly'))
);

COMMENT ON TABLE algorithm_performance IS 'システムの学習能力を定量追跡。ダッシュボードの精度パネル用';
COMMENT ON COLUMN algorithm_performance.hypothesis_accuracy IS '仮説的中率。目標: 初期0.30→6ヶ月後0.65';
COMMENT ON COLUMN algorithm_performance.improvement_rate IS '前期比改善率。正=改善、負=悪化';
```

## 5. Observability Tables (運用・可視化テーブル)

エージェントの内部動作を可視化し、プロンプト改善やデバッグを支援するテーブル群。人間がエージェントの思考プロセスを理解し、プロンプト変更の効果を定量的に評価するための基盤。

### 5.1 agent_prompt_versions — エージェントプロンプト履歴

エージェントのプロンプトファイルの変更履歴を追跡する。プロンプト変更前後のパフォーマンスを比較し、「どの変更が効果的だったか」を定量的に評価する。

```sql
CREATE TABLE agent_prompt_versions (
    -- 主キー
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- UUIDで一意に識別

    -- エージェント情報
    agent_type      TEXT NOT NULL,
        -- strategist: 戦略エージェント（サイクル全体の方針決定）
        -- researcher: リサーチャーエージェント（市場情報収集）
        -- analyst: アナリストエージェント（仮説生成・検証・分析）
        -- planner: プランナーエージェント（コンテンツ計画・スケジューリング）
    version         INTEGER NOT NULL,
        -- エージェントタイプごとの自動採番バージョン
        -- 例: strategist v1, strategist v2, ...
        -- アプリケーション層で MAX(version) + 1 を計算して設定

    -- プロンプト内容
    prompt_content  TEXT NOT NULL,
        -- プロンプトの全文テキスト
        -- 変更履歴を完全に保持するため、差分ではなく全文を保存
    change_summary  TEXT,
        -- 人間が記述する変更内容の要約
        -- 例: "仮説生成時に過去の類似仮説を5件→10件参照するよう変更"
        -- NULLの場合: 初回バージョン or 変更内容未記述

    -- 変更者
    changed_by      TEXT NOT NULL DEFAULT 'human',
        -- human: 人間がダッシュボードから変更
        -- system: システムが自動最適化で変更（将来の拡張用）

    -- パフォーマンス比較
    performance_before JSONB,
        -- この変更前のメトリクスのスナップショット
        -- 構造例:
        -- {
        --   "hypothesis_accuracy": 0.52,
        --   "avg_engagement_rate": 0.038,
        --   "cycles_measured": 10,
        --   "snapshot_date": "2026-03-01"
        -- }
        -- NULLの場合: 初回バージョン（比較対象なし）
    performance_after JSONB,
        -- この変更後のメトリクスのスナップショット（後から更新）
        -- 同構造。一定期間経過後にアナリストが計測して更新
        -- NULLの場合: まだ計測されていない

    -- 有効フラグ
    active          BOOLEAN NOT NULL DEFAULT true,
        -- 現在有効なバージョンかどうか
        -- agent_typeごとに1つだけ active=true
        -- 新バージョン作成時に旧バージョンを active=false に更新

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_prompt_versions IS 'エージェントプロンプトの変更履歴。変更前後のパフォーマンス比較を可能にする';
COMMENT ON COLUMN agent_prompt_versions.agent_type IS 'strategist/researcher/analyst/planner';
COMMENT ON COLUMN agent_prompt_versions.active IS 'agent_typeごとに1つだけtrue。新バージョン作成時に旧版をfalseに更新';
COMMENT ON COLUMN agent_prompt_versions.performance_after IS '変更後のメトリクス。一定期間後にアナリストが計測して更新';
```

### 5.2 agent_thought_logs — エージェント思考ログ

各エージェントの推論プロセスを記録する。LangGraphのどのグラフ・どのノードで、何を入力として受け取り、どう考え、何を決定し、何を出力したかを完全に追跡する。人間がエージェントの意思決定を検証し、問題のあるノードを特定するために使用する。

```sql
CREATE TABLE agent_thought_logs (
    -- 主キー
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- UUIDで一意に識別

    -- エージェント情報
    agent_type      TEXT NOT NULL,
        -- strategist / researcher / analyst / planner
        -- どのエージェントがこの思考を実行したか

    -- サイクル紐付け
    cycle_id        INTEGER REFERENCES cycles(id),
        -- この思考が属するサイクル
        -- NULLの場合: サイクル外の処理（計測ジョブ等）

    -- LangGraph位置情報
    graph_name      TEXT NOT NULL,
        -- この思考が属するLangGraphグラフ名
        -- 例: "strategy_cycle", "production_pipeline",
        --      "posting_scheduler", "measurement_job"
    node_name       TEXT NOT NULL,
        -- グラフ内のノード名
        -- 例: "collect_market_data", "generate_hypotheses",
        --      "create_content_plan", "review_and_approve"
        -- デバッグ時にどのステップで問題が起きたかを特定する

    -- 入力・推論・決定・出力
    input_summary   JSONB,
        -- このノードが受け取ったデータの要約
        -- 構造例:
        -- {
        --   "market_intel_count": 15,
        --   "active_hypotheses": 8,
        --   "pending_directives": 2,
        --   "accounts_in_scope": ["ACC_0013", "ACC_0015"]
        -- }
    reasoning       TEXT NOT NULL,
        -- エージェントの推論プロセス（思考の全文）
        -- 例: "過去7日のbeautyニッチのengagement_rateが0.052と高水準。
        --       一方でtechニッチは0.031と低迷。beautyに投稿リソースを集中すべき。
        --       ただし、techの低迷はサンプル数不足(n=3)の可能性もあるため、
        --       最低限の投稿(週2回)は維持して追加データを収集する。"
    decision        TEXT NOT NULL,
        -- エージェントが下した決定の要約
        -- 例: "beautyニッチの投稿頻度を日3回→日4回に増加。
        --       techニッチは日2回を維持。新仮説H-055を生成。"
    output_summary  JSONB,
        -- このノードが出力したデータの要約
        -- 構造例:
        -- {
        --   "contents_planned": 12,
        --   "hypotheses_generated": 2,
        --   "directives_applied": 1,
        --   "next_node": "review_and_approve"
        -- }

    -- ツール使用状況
    tools_used      TEXT[],
        -- このステップで呼び出したMCPツールの一覧
        -- 例: {'search_similar_hypotheses', 'get_performance_summary',
        --       'get_market_intel'}
        -- デバッグ時にどのツールが使われたかを追跡

    -- LLM情報
    llm_model       TEXT,
        -- 使用したLLMモデル
        -- 'opus': Claude Opus（高精度が必要なノード用）
        -- 'sonnet': Claude Sonnet（コスト効率重視のノード用）
    token_usage     JSONB,
        -- トークン使用量とコスト
        -- 構造例:
        -- {
        --   "input_tokens": 15000,
        --   "output_tokens": 2500,
        --   "cost_usd": 0.085
        -- }
        -- コスト最適化の分析に使用

    -- パフォーマンス
    duration_ms     INTEGER,
        -- このノードの処理時間（ミリ秒）
        -- ボトルネックの特定に使用
        -- 例: 3500 (= 3.5秒)

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_thought_logs IS 'エージェントの推論プロセスを完全記録。デバッグ・プロンプト改善の根拠';
COMMENT ON COLUMN agent_thought_logs.graph_name IS 'LangGraphのグラフ名。strategy_cycle/production_pipeline等';
COMMENT ON COLUMN agent_thought_logs.node_name IS 'グラフ内のノード名。問題ステップの特定に使用';
COMMENT ON COLUMN agent_thought_logs.reasoning IS 'エージェントの思考全文。人間がレビューして改善点を発見';
COMMENT ON COLUMN agent_thought_logs.token_usage IS 'トークン使用量・コスト。コスト最適化の分析に使用';
```

### 5.3 agent_reflections — エージェント個別振り返り

各エージェントがタスク・サイクル完了時に実行する自己評価を記録する。会社の社員が振り返りを行うように、各エージェントが自分のパフォーマンスを評価し、改善点を特定する。戦略サイクルグラフの終了フェーズで各エージェントが自動的に振り返りを生成し、次サイクルの冒頭でこの記録を参照して行動を改善する。

```sql
CREATE TABLE agent_reflections (
    -- 主キー
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- UUIDで一意に識別

    -- エージェント情報
    agent_type      TEXT NOT NULL,
        -- strategist: 戦略エージェント（サイクル全体の方針決定）
        -- researcher: リサーチャーエージェント（市場情報収集）
        -- analyst: アナリストエージェント（仮説生成・検証・分析）
        -- planner: プランナーエージェント（コンテンツ計画・スケジューリング）

    -- サイクル紐付け
    cycle_id        INTEGER REFERENCES cycles(id),
        -- この振り返りが属するサイクル
        -- サイクル完了時に各エージェントが1件ずつ生成
        -- NULLの場合: サイクル外のタスク（例: 計測ジョブ完了後の振り返り）

    -- タスク情報
    task_description TEXT NOT NULL,
        -- エージェントがこのサイクルで担当したタスクの概要
        -- 例: "サイクル#42の市場データ収集。beautyニッチのトレンド15件、
        --       競合投稿8件、オーディエンスシグナル3件を収集"

    -- 自己評価
    self_score      INTEGER NOT NULL CHECK (self_score BETWEEN 1 AND 10),
        -- 1-10の自己評価スコア
        -- 1-3: 不十分（重大な見落としや失敗があった）
        -- 4-5: 改善の余地あり（基本的なタスクは完了したが質に課題）
        -- 6-7: 良好（期待通りのアウトプット）
        -- 8-9: 優秀（期待以上の成果）
        -- 10: 卓越（画期的な発見や大幅な改善を達成）
    score_reasoning TEXT NOT NULL,
        -- スコアの根拠（なぜこのスコアにしたか）
        -- 例: "収集したトレンド15件中、実際にコンテンツに活用されたのは3件(20%)。
        --       関連性の高い情報を選別する精度が低かった。
        --       ただし、glass skinトレンドの早期発見はengagement向上に貢献した。"

    -- 振り返り詳細
    what_went_well  TEXT[],
        -- 良かった点のリスト
        -- 例: {'glass skinトレンドを競合より2日早く検出',
        --       'オーディエンスのセンチメント分析の精度が向上'}
    what_to_improve TEXT[],
        -- 改善すべき点のリスト
        -- 例: {'トレンド情報の関連性フィルタリングが甘い',
        --       '競合分析の深さが不足（表面的な数値比較のみ）'}
    next_actions    TEXT[],
        -- 次サイクルでの具体的アクション
        -- 例: {'トレンド収集時にrelevance_score 0.6以上のみ報告する',
        --       '競合分析にフック手法の分類を追加する'}

    -- メトリクススナップショット
    metrics_snapshot JSONB,
        -- 振り返り時点での関連メトリクス
        -- 構造例:
        -- {
        --   "hypotheses_generated": 3,
        --   "hypotheses_accuracy": 0.67,
        --   "intel_collected": 26,
        --   "intel_used_rate": 0.20,
        --   "avg_engagement_rate": 0.042,
        --   "cycle_duration_hours": 24.5
        -- }

    -- 反映状況
    applied_in_next_cycle BOOLEAN DEFAULT false,
        -- この振り返りの内容が次サイクルで実際に反映されたか
        -- 次サイクルのエージェントが冒頭で前回の振り返りを読み込み、
        -- next_actionsを実行した場合にtrueに更新
        -- ダッシュボードで「振り返りの活用率」を追跡するための指標

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_reflections IS 'エージェントの自己評価記録。サイクル終了時に各エージェントが生成し、次サイクルで参照';
COMMENT ON COLUMN agent_reflections.agent_type IS 'strategist/researcher/analyst/planner';
COMMENT ON COLUMN agent_reflections.self_score IS '1-10の自己評価。8以上で優秀、4以下で要改善';
COMMENT ON COLUMN agent_reflections.applied_in_next_cycle IS '次サイクルで振り返りが活用されたか。活用率の追跡指標';
```

### 5.4 agent_individual_learnings — エージェント個別学習メモリ

各エージェントの個人的なノートブック。会社の社員が自分専用のメモに業務で学んだことを記録するように、各エージェントが自身の経験から得た知見を蓄積する。learningsテーブル（システム全体の共有知見）とは異なり、各エージェント固有の実践的なテクニック・パターン・失敗事例を保持する。pgvectorのembeddingにより、タスク実行時に関連する過去の学びを自動検索できる。

```sql
CREATE TABLE agent_individual_learnings (
    -- 主キー
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- UUIDで一意に識別

    -- エージェント情報
    agent_type      TEXT NOT NULL,
        -- この学びを所有するエージェント
        -- strategist / researcher / analyst / planner
        -- 各エージェントは自分の学びのみを参照する（他エージェントの学びは見えない）

    -- カテゴリ
    category        TEXT NOT NULL,
        -- data_source: データソースに関する学び
        --   例: "TikTok Creative Centerのトレンドデータは24時間遅延がある"
        -- technique: 実践テクニック
        --   例: "仮説生成時にpgvectorで類似度0.85以上の既存仮説があれば重複を避ける"
        -- pattern: 発見したパターン
        --   例: "beautyニッチでは月曜のengagementが他曜日より15%低い傾向"
        -- mistake: 失敗から学んだこと
        --   例: "サンプル数3件で仮説をconfirmedにしたが、追加データで覆った"
        -- insight: その他の気づき
        --   例: "人間のhypothesis指示は表面的な記述が多いので、背景を推測して補完すべき"

    -- 学びの内容
    content         TEXT NOT NULL,
        -- 学んだ内容の本文
        -- 具体的で再利用可能な形式で記述
        -- 良い例: "relevance_score 0.6未満のトレンド情報はコンテンツ計画に採用されない。
        --          収集時に0.6以上にフィルタリングすることで効率が3倍になった"
        -- 悪い例: "フィルタリングは大事" (曖昧で再利用不能)
    context         TEXT,
        -- この学びが得られた状況の説明
        -- 例: "サイクル#38でbeautyニッチのトレンド収集時。
        --       30件収集して報告したが、プランナーが使ったのは4件だけだった"
        -- NULLの場合: 文脈が不明 or 一般的な知識

    -- 信頼度・有効性
    confidence      FLOAT NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0.0 AND 1.0),
        -- この学びへの確信度 0.0〜1.0
        -- 初期値0.5、適用して成功するたびに上昇、失敗するたびに下降
        -- 0.8以上: 高確信（積極的に適用）
        -- 0.3未満: 低確信（再検証が必要）
    times_applied   INTEGER NOT NULL DEFAULT 0,
        -- この学びが参照・適用された回数
        -- エージェントがタスク実行時にこの学びを使った場合にインクリメント
    times_successful INTEGER NOT NULL DEFAULT 0,
        -- 適用して良い結果につながった回数
        -- 例: この学びを適用したサイクルのself_scoreが7以上だった場合にインクリメント
    success_rate    FLOAT GENERATED ALWAYS AS (
        CASE WHEN times_applied > 0 THEN times_successful::FLOAT / times_applied ELSE 0.0 END
    ) STORED,
        -- 自動計算される成功率
        -- times_applied > 0 の場合: times_successful / times_applied
        -- times_applied = 0 の場合: 0.0
        -- ダッシュボードで「効果的な学び」をソートする際に使用

    -- 有効フラグ
    is_active       BOOLEAN NOT NULL DEFAULT true,
        -- この学びがまだ有効かどうか
        -- false: 学びが古くなった、または誤りだと判明した場合
        -- confidenceが0.2未満に下がった場合に自動的にfalseに更新する運用を想定

    -- 生成元
    source_reflection_id UUID REFERENCES agent_reflections(id),
        -- この学びを生成した振り返りのID
        -- agent_reflectionsのnext_actionsから抽出された学びの場合に設定
        -- NULLの場合: タスク実行中に直接発見された学び

    -- ベクトル検索
    embedding       vector(1536),
        -- 学び内容 (content) のベクトル埋め込み
        -- text-embedding-3-small (OpenAI) or Voyage-3 (Anthropic) で生成
        -- 用途: タスク実行時に関連する過去の学びを検索
        -- クエリ例: WHERE agent_type = $1 AND is_active = true
        --           ORDER BY embedding <=> $2 LIMIT 5

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_applied_at TIMESTAMPTZ,
        -- この学びが最後に参照・適用された日時
        -- エージェントがタスク実行時にこの学びを使った場合に更新
        -- NULLの場合: まだ一度も適用されていない
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_individual_learnings IS 'エージェント個別の学習メモリ。各エージェント固有の経験知を蓄積';
COMMENT ON COLUMN agent_individual_learnings.agent_type IS 'この学びを所有するエージェント。各エージェントは自分の学びのみ参照';
COMMENT ON COLUMN agent_individual_learnings.category IS 'data_source/technique/pattern/mistake/insight';
COMMENT ON COLUMN agent_individual_learnings.success_rate IS '自動計算。times_successful / times_applied。効果的な学びのソート用';
COMMENT ON COLUMN agent_individual_learnings.embedding IS '関連する学びの検索用。agent_type + is_activeでフィルタ後にベクトル検索';
```

### 5.5 agent_communications — エージェント→人間コミュニケーション

エージェントから人間への逆方向コミュニケーションを記録する。human_directivesが「人間→エージェント」であるのに対し、このテーブルは「エージェント→人間」の発信を管理する。エージェントが困っていること、提案、質問、状況報告を人間に伝え、ダッシュボードで確認・返信できるようにする。

```sql
CREATE TABLE agent_communications (
    -- 主キー
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        -- UUIDで一意に識別

    -- エージェント情報
    agent_type      TEXT NOT NULL,
        -- strategist / researcher / analyst / planner
        -- どのエージェントがこのメッセージを発信したか

    -- メッセージ種別
    message_type    TEXT NOT NULL CHECK (message_type IN (
        'struggle', 'proposal', 'question', 'status_report'
    )),
        -- struggle: エージェントが困っていること
        --   例: "beautyニッチのトレンド収集でrelevance_score 0.6以上のデータが
        --        過去3サイクル連続で5件未満。データソースの追加を検討してほしい"
        --
        -- proposal: エージェントからの提案
        --   例: "petニッチの仮説的中率が過去10サイクルで0.75。
        --        petニッチのアカウント数を3→5に増やすことを提案します"
        --
        -- question: エージェントからの質問
        --   例: "human_directive #15で'techは停止'と指示がありましたが、
        --        既にplanedのtechコンテンツ3件はキャンセルすべきですか？"
        --
        -- status_report: 定期的な状況報告
        --   例: "サイクル#42完了。仮説的中率0.68(前回比+0.05)。
        --        beauty強化施策が奏功し、engagement_rate 0.055達成"

    -- 優先度
    priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
        'low', 'normal', 'high', 'urgent'
    )),
        -- low: 余裕がある時に確認してほしい（status_report等）
        -- normal: 通常の優先度
        -- high: 早めの対応が望ましい（proposal等）
        -- urgent: 即座に対応が必要（struggle + 自動処理が停止している場合等）

    -- メッセージ内容
    content         TEXT NOT NULL,
        -- メッセージの本文（自由記述）

    -- コンテキストデータ
    context         JSONB,
        -- メッセージの背景となるデータ・メトリクス
        -- 構造例 (proposal):
        -- {
        --   "niche": "pet",
        --   "hypothesis_accuracy_10cycles": 0.75,
        --   "avg_engagement_rate": 0.058,
        --   "current_account_count": 3,
        --   "proposed_account_count": 5,
        --   "estimated_additional_cost_monthly_usd": 35.00
        -- }

    -- 人間の返信
    human_response  TEXT,
        -- 人間がダッシュボードから入力した返信
        -- NULLの場合: まだ返信されていない
        -- 例: "了解。ACC_0040とACC_0041をpetニッチで追加する。来週から稼働させて"
    human_responded_at TIMESTAMPTZ,
        -- 人間が返信した日時
        -- NULLの場合: 未返信

    -- ステータス
    status          TEXT NOT NULL DEFAULT 'unread' CHECK (status IN (
        'unread', 'read', 'responded', 'archived'
    )),
        -- unread: 未読。ダッシュボードで通知バッジ表示
        -- read: 人間が閲覧済み。まだ返信なし
        -- responded: 人間が返信済み。エージェントが次サイクルで参照可能
        -- archived: 処理完了。アーカイブ済み

    -- サイクル紐付け
    cycle_id        INTEGER REFERENCES cycles(id),
        -- このメッセージが属するサイクル
        -- NULLの場合: サイクル外のメッセージ

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_communications IS 'エージェント→人間の逆方向コミュニケーション。human_directivesの対になるテーブル';
COMMENT ON COLUMN agent_communications.message_type IS 'struggle/proposal/question/status_report';
COMMENT ON COLUMN agent_communications.priority IS 'urgentはダッシュボードで即座に通知。lowは余裕がある時に確認';
COMMENT ON COLUMN agent_communications.human_response IS '人間の返信。エージェントが次サイクルで参照';
```

## 6. Tool Management Tables (ツール管理テーブル)

AIツールの知識管理、使用経験の蓄積、外部情報源の追跡、制作レシピの最適化、プロンプト改善提案を管理するテーブル群。Tool Specialistエージェントが中心となって運用し、制作パイプラインのツール選定・パラメータ最適化を支援する。

### 6.1 tool_catalog — ツールカタログ

AIツール（動画生成・TTS・リップシンク・画像生成等）のマスターデータを管理する。各ツールの特性・コスト・得意不得意を構造化して保持し、制作レシピの選定根拠となる。

```sql
CREATE TABLE tool_catalog (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- ツール基本情報
    tool_name       VARCHAR(100) NOT NULL,
        -- ツール名 (バージョン含む)
        -- 例: 'kling_v2.6', 'runway_gen3', 'sora', 'fish_audio_tts'
        -- バージョンアップ時は新レコードを作成し、旧バージョンを is_active=false に
    tool_type       VARCHAR(50) NOT NULL,
        -- ツールの機能カテゴリ
        -- video_generation: 動画生成 (Kling, Runway, Sora等)
        -- tts: テキスト読み上げ (Fish Audio等)
        -- lipsync: リップシンク (fal.ai lipsync等)
        -- image_generation: 画像生成 (Flux, DALL-E等)
        -- music_generation: 音楽生成
        -- video_editing: 動画編集
    provider        VARCHAR(100),
        -- サービスプロバイダー
        -- 例: 'fal.ai', 'runway', 'openai', 'fish_audio'
    api_endpoint    TEXT,
        -- APIエンドポイントURL
        -- 例: 'https://queue.fal.run/fal-ai/kling-video/v2.6/image-to-video'

    -- コスト情報
    cost_per_use    DECIMAL(10,4),
        -- 1回あたりの概算コスト (USD)
        -- 例: 0.10 (Kling 1回 $0.10)
        -- 実際のコストはパラメータにより変動するため概算値

    -- ツール特性 (JSONB)
    strengths       JSONB,
        -- ツールの得意な点
        -- 例: ["natural_human_motion", "high_resolution", "fast_processing"]
    weaknesses      JSONB,
        -- ツールの苦手な点
        -- 例: ["slow_generation", "expensive", "limited_styles"]
    quirks          JSONB,
        -- ツール固有のクセ・注意点
        -- 例: {
        --   "asian_faces": "natural",
        --   "western_faces": "sometimes_unnatural",
        --   "max_duration_seconds": 10,
        --   "no_prompt_param": true,
        --   "no_keep_original_sound": true
        -- }
        -- v4.0の経験: Klingはprompt空文字やkeep_original_soundで422エラー

    -- フォーマット情報
    supported_formats JSONB,
        -- 入出力フォーマット
        -- 例: {
        --   "input": ["image/png", "image/jpeg"],
        --   "output": ["video/mp4"],
        --   "max_input_size_mb": 10
        -- }
    max_resolution  VARCHAR(20),
        -- 最大対応解像度
        -- 例: '3850x3850' (Klingの制限)
        -- 例: '1920x1080'

    -- ステータス
    is_active       BOOLEAN DEFAULT true,
        -- このツールが現在利用可能か
        -- falseの場合: 非推奨、サービス停止、バージョン更新済み等

    -- 外部情報
    external_docs_url TEXT,
        -- 公式ドキュメントのURL
        -- 例: 'https://fal.ai/models/fal-ai/kling-video'
    last_knowledge_update TIMESTAMPTZ,
        -- ツール情報が最後に更新された日時
        -- Tool Specialistが外部ソースから情報更新した際にセット

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tool_catalog IS 'AIツールのマスターデータ。特性・コスト・クセを管理し、レシピ選定の根拠';
COMMENT ON COLUMN tool_catalog.tool_name IS 'バージョン付きツール名。バージョンアップ時は新レコード作成';
COMMENT ON COLUMN tool_catalog.quirks IS 'ツール固有のクセ。v4.0の422エラー知見等を構造化';
COMMENT ON COLUMN tool_catalog.cost_per_use IS '1回あたりの概算コスト(USD)。パラメータにより変動';
```

### 6.2 tool_experiences — ツール使用経験

各ツール使用の結果を記録する。品質スコア・処理時間・コスト・成功/失敗を蓄積し、Tool Specialistが最適なツール選定・パラメータ調整を行うための実績データとなる。

```sql
CREATE TABLE tool_experiences (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 紐付け
    tool_id         INTEGER NOT NULL REFERENCES tool_catalog(id),
        -- 使用したツール
    content_id      INTEGER REFERENCES content(id),
        -- 使用されたコンテンツ (NULLの場合: テスト実行等)

    -- エージェント情報
    agent_id        VARCHAR(50) NOT NULL,
        -- このツール使用を推奨・実行したエージェント
        -- 例: 'tool_specialist', 'production_worker'
    recipe_used     JSONB,
        -- 使用したツール組み合わせ（レシピ全体）
        -- 例: {
        --   "recipe_id": 5,
        --   "steps": [
        --     {"tool": "kling_v2.6", "role": "video_gen"},
        --     {"tool": "fish_audio_tts", "role": "tts"},
        --     {"tool": "fal_lipsync", "role": "lipsync"}
        --   ]
        -- }

    -- 使用パラメータ
    input_params    JSONB,
        -- ツール呼び出し時の実パラメータ
        -- 例: {
        --   "image_url": "https://fal.storage/...",
        --   "duration": "5",
        --   "aspect_ratio": "9:16"
        -- }

    -- 品質評価
    quality_score   DECIMAL(3,2),
        -- 品質スコア 0.00〜1.00
        -- 0.80以上: 高品質（そのまま使用可能）
        -- 0.50〜0.79: 中品質（軽微な問題あり）
        -- 0.50未満: 低品質（再生成が必要）
        -- NULLの場合: 未評価
    quality_notes   TEXT,
        -- 品質に関する補足メモ
        -- 例: "口の動きが自然。ただし右目の瞬きがやや不自然"

    -- パフォーマンス指標
    processing_time_ms INTEGER,
        -- 処理時間（ミリ秒）
        -- 例: 180000 (= 3分)
    cost_actual     DECIMAL(10,4),
        -- 実際に発生したコスト (USD)
        -- tool_catalog.cost_per_useとの乖離を追跡

    -- 成功/失敗
    success         BOOLEAN NOT NULL,
        -- ツール呼び出しが成功したか
        -- false: API エラー、タイムアウト、品質不合格等
    failure_reason  TEXT,
        -- 失敗時の原因
        -- 例: 'fal.ai 403 Forbidden (残高不足)'
        -- 例: 'fal.ai 422 Unprocessable (prompt空文字)'

    -- コンテンツ分類
    content_type    VARCHAR(50),
        -- 生成対象のコンテンツ特性
        -- 例: 'asian_female_beauty', 'western_male_tech', 'pet_cute'
        -- ツールの得意・不得意をcontent_type別に分析するために使用

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tool_experiences IS 'ツール使用の結果記録。品質・コスト・成功率をcontent_type別に蓄積';
COMMENT ON COLUMN tool_experiences.quality_score IS '0.00-1.00。0.80以上で高品質、0.50未満で要再生成';
COMMENT ON COLUMN tool_experiences.content_type IS 'コンテンツ特性。ツールの得意不得意をタイプ別に分析';
COMMENT ON COLUMN tool_experiences.recipe_used IS '使用したツール組み合わせ全体。production_recipesとの対応追跡';
```

### 6.3 tool_external_sources — ツール外部情報源

ツールに関する外部情報（X投稿、公式ドキュメント、プレスリリース、ブログ記事等）を収集・管理する。Tool Specialistエージェントが情報収集し、ツールカタログの更新や新ツール発見に活用する。pgvectorのembeddingにより類似情報の自動発見が可能。

```sql
CREATE TABLE tool_external_sources (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- ソース情報
    source_type     VARCHAR(50) NOT NULL,
        -- ソースの種類
        -- x_post: X（旧Twitter）の投稿
        -- official_doc: 公式ドキュメント
        -- press_release: プレスリリース
        -- blog: ブログ記事
        -- reddit: Reddit投稿
        -- changelog: チェンジログ・リリースノート
    source_url      TEXT NOT NULL,
        -- ソースのURL
        -- 例: 'https://x.com/kling_ai/status/...'
    source_account  VARCHAR(200),
        -- ソースのアカウント名等
        -- 例: '@kling_ai', 'Runway ML Official Blog'

    -- ツール紐付け
    tool_id         INTEGER REFERENCES tool_catalog(id),
        -- 関連するツール (NULLable)
        -- NULLの場合: 特定ツールに紐付かない一般的なAIツール情報
        -- 例: "AIによる動画生成の市場動向" → tool_id NULL

    -- 情報内容
    content_summary TEXT NOT NULL,
        -- 情報の要約
        -- 例: "Kling v2.7リリース。新機能: 最大30秒動画生成、
        --       3Dカメラコントロール改善、処理速度2倍"
    key_insights    JSONB,
        -- 抽出されたキーインサイトの配列
        -- 例: [
        --   "最大動画長が10秒→30秒に拡張",
        --   "3Dカメラコントロールの精度が向上",
        --   "処理速度が従来比2倍"
        -- ]

    -- ベクトル検索
    embedding       vector(1536),
        -- content_summaryのベクトル埋め込み
        -- 用途: 類似情報の自動発見、重複情報の排除

    -- 評価
    relevance_score DECIMAL(3,2),
        -- 情報の関連性スコア 0.00〜1.00
        -- Tool Specialistが情報の重要度を評価

    -- タイムスタンプ
    fetched_at      TIMESTAMPTZ NOT NULL,
        -- 情報が取得された日時
    processed_at    TIMESTAMPTZ,
        -- 情報がTool Specialistにより処理された日時
        -- NULLの場合: まだ処理されていない
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tool_external_sources IS 'ツール関連の外部情報源。X投稿・公式ドキュメント・ブログ等を収集';
COMMENT ON COLUMN tool_external_sources.source_type IS 'x_post/official_doc/press_release/blog/reddit/changelog';
COMMENT ON COLUMN tool_external_sources.tool_id IS 'NULLable。特定ツールに紐付かない一般情報の場合はNULL';
COMMENT ON COLUMN tool_external_sources.embedding IS '類似情報の自動発見・重複排除用。1536次元';
```

### 6.4 production_recipes — 制作レシピ

コンテンツ制作に使用するツールの組み合わせパターンを管理する。v4.0のパイプライン（Kling + Fish Audio TTS + fal lipsync の固定組み合わせ）をデフォルトレシピとして保持しつつ、新しいツールの組み合わせを柔軟に定義・評価できる。

```sql
CREATE TABLE production_recipes (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- レシピ基本情報
    recipe_name     VARCHAR(200) NOT NULL,
        -- レシピ名
        -- 例: 'asian_beauty_short', 'tech_explainer', 'pet_reaction'
        -- 用途・対象が分かりやすい名前をつける
    content_format  VARCHAR(50) NOT NULL,
        -- コンテンツフォーマット (content.content_format と一致させること)
        -- short_video: 短尺動画 (YouTube Shorts, TikTok, IG Reels)
        -- text_post: テキスト投稿 (X/Twitter)
        -- image_post: 画像投稿 (将来拡張)
    target_platform VARCHAR(50),
        -- 主な対象プラットフォーム
        -- youtube / tiktok / instagram / x / NULL (全プラットフォーム共通)

    -- レシピ定義 (JSONB)
    steps           JSONB NOT NULL,
        -- 制作ステップの配列。各ステップにツール・パラメータ・順序を定義
        -- 構造例:
        -- [
        --   {
        --     "order": 1,
        --     "step_name": "video_generation",
        --     "tool_id": 1,
        --     "tool_name": "kling_v2.6",
        --     "params": {
        --       "duration": "5",
        --       "aspect_ratio": "9:16"
        --     },
        --     "parallel_group": "section"
        --   },
        --   {
        --     "order": 2,
        --     "step_name": "tts",
        --     "tool_id": 3,
        --     "tool_name": "fish_audio_tts",
        --     "params": {
        --       "format": "mp3"
        --     },
        --     "parallel_group": "section"
        --   },
        --   {
        --     "order": 3,
        --     "step_name": "lipsync",
        --     "tool_id": 5,
        --     "tool_name": "fal_lipsync",
        --     "params": {},
        --     "depends_on": [1, 2]
        --   }
        -- ]

    -- 推奨条件
    recommended_for JSONB,
        -- このレシピが推奨される条件
        -- 例: {
        --   "niche": "beauty",
        --   "character_ethnicity": "asian",
        --   "content_style": "talking_head",
        --   "budget_per_content_usd_max": 0.50
        -- }

    -- パフォーマンス実績
    avg_quality_score DECIMAL(3,2),
        -- 過去使用時の平均品質スコア (0.00〜1.00)
        -- tool_experiences.quality_score の平均値
        -- 定期的にTool Specialistが集計・更新
    times_used      INTEGER DEFAULT 0,
        -- このレシピの使用回数
    success_rate    DECIMAL(3,2),
        -- 成功率 (0.00〜1.00)
        -- tool_experiences.success の成功率

    -- メタデータ
    created_by      VARCHAR(50),
        -- レシピ作成者
        -- 'tool_specialist': Tool Specialistエージェントが自動生成
        -- 'human': 人間が手動作成
    is_default      BOOLEAN DEFAULT false,
        -- デフォルトレシピかどうか
        -- true: v4.0パイプラインの組み合わせ（Kling + Fish Audio + fal lipsync）
        -- content_format + target_platform ごとに1つだけ is_default=true
    is_active       BOOLEAN DEFAULT true,
        -- このレシピが現在利用可能か
        -- falseの場合: 非推奨、テスト中、廃止等

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE production_recipes IS 'ツール組み合わせパターン。v4.0パイプラインをデフォルトレシピとして保持';
COMMENT ON COLUMN production_recipes.steps IS '制作ステップ配列。各ステップにtool_id, params, orderを定義';
COMMENT ON COLUMN production_recipes.is_default IS 'v4.0パイプライン=デフォルト。content_format+target_platformごとに1つ';
COMMENT ON COLUMN production_recipes.recommended_for IS '推奨条件。niche, character_ethnicity, budget等で絞り込み';
```

### 6.5 prompt_suggestions — プロンプト改善提案

システムがエージェントのプロンプト改善を自動提案するためのテーブル。パフォーマンス低下、繰り返し発生する問題、成長の停滞等のトリガーを検知し、具体的な改善案を生成する。人間がダッシュボードで確認し、採用/却下を判断する。

```sql
CREATE TABLE prompt_suggestions (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 対象エージェント
    agent_type      VARCHAR(50) NOT NULL,
        -- 改善提案の対象エージェント
        -- strategist / researcher / analyst / planner / tool_specialist

    -- トリガー情報
    trigger_type    VARCHAR(50) NOT NULL,
        -- 提案を生成したトリガーの種類
        -- score_decline: パフォーマンススコアの低下
        --   例: 仮説的中率が過去5サイクルで0.65→0.45に低下
        -- repeated_issue: 同じ問題の繰り返し発生
        --   例: 同じ失敗パターンが3回以上連続
        -- performance_plateau: パフォーマンスの停滞
        --   例: engagement_rateが10サイクル連続で横ばい
        -- new_capability: 新機能・新ツールの活用提案
        --   例: 新ツール追加に伴うプロンプト拡張
        -- human_feedback: 人間のフィードバックに基づく提案
    trigger_details JSONB NOT NULL,
        -- トリガーの詳細データ
        -- 構造例 (score_decline):
        -- {
        --   "metric": "hypothesis_accuracy",
        --   "value_before": 0.65,
        --   "value_after": 0.45,
        --   "period_cycles": 5,
        --   "affected_categories": ["timing", "niche"]
        -- }

    -- 改善提案
    suggestion      TEXT NOT NULL,
        -- 改善提案の内容
        -- 例: "仮説生成時に、過去の棄却済み仮説との類似度チェックを追加してください。
        --       類似度0.8以上の棄却済み仮説がある場合、同じアプローチの仮説生成を
        --       回避するか、異なる検証条件を設定するよう指示を追加してください。"
    target_prompt_section VARCHAR(100),
        -- プロンプト内の改善対象セクション
        -- 例: 'thinking_approach', 'decision_criteria', 'output_format',
        --      'tool_selection', 'quality_evaluation'
        -- NULLの場合: プロンプト全体に関わる提案

    -- 確信度
    confidence      DECIMAL(3,2),
        -- 提案の確信度 0.00〜1.00
        -- 0.80以上: 高確信（データに基づく明確な改善点）
        -- 0.50〜0.79: 中確信（改善が期待されるが確実ではない）
        -- 0.50未満: 低確信（試験的な提案）

    -- ステータス
    status          VARCHAR(20) DEFAULT 'pending',
        -- pending: 人間のレビュー待ち
        -- accepted: 人間が採用。プロンプトに反映予定 or 反映済み
        -- rejected: 人間が却下
        -- expired: 有効期限切れ（長期間pendingのまま放置）
    human_feedback  TEXT,
        -- 人間がダッシュボードから入力したフィードバック
        -- 採用時: "良い提案。次のプロンプト更新で反映する"
        -- 却下時: "この変更は意図的。現状維持"

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
        -- 人間がaccepted/rejected/expiredにした日時
        -- NULLの場合: まだpending

    -- 制約
    CONSTRAINT chk_prompt_suggestions_status
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired'))
);

COMMENT ON TABLE prompt_suggestions IS 'プロンプト改善の自動提案。トリガー検知→提案生成→人間レビューのフロー';
COMMENT ON COLUMN prompt_suggestions.trigger_type IS 'score_decline/repeated_issue/performance_plateau/new_capability/human_feedback';
COMMENT ON COLUMN prompt_suggestions.confidence IS '提案の確信度。0.80以上でデータに基づく明確な改善点';
COMMENT ON COLUMN prompt_suggestions.status IS 'pending→accepted/rejected/expired。人間がダッシュボードで判断';
```

## 7. インデックス定義

パフォーマンスを確保するためのインデックス。主にステータスフィルタリング、時系列クエリ、JSONB検索、ベクトル検索に対応する。

### 7.1 Entity Tables のインデックス

```sql
-- accounts
CREATE INDEX idx_accounts_platform ON accounts(platform);
    -- プラットフォーム別のアカウント一覧取得
CREATE INDEX idx_accounts_status ON accounts(status);
    -- active/suspended/setup でフィルタ
CREATE INDEX idx_accounts_character ON accounts(character_id);
    -- キャラクター別のアカウント一覧
CREATE INDEX idx_accounts_niche ON accounts(niche);
    -- ジャンル別のアカウント一覧
CREATE INDEX idx_accounts_cluster ON accounts(cluster);
    -- A/Bテストクラスタ別
CREATE INDEX idx_accounts_platform_status ON accounts(platform, status);
    -- 複合: "activeなYouTubeアカウント一覧" 等

-- characters
CREATE INDEX idx_characters_character_id ON characters(character_id);
    -- character_idでの検索 (UNIQUEだが明示的に)

-- components
CREATE INDEX idx_components_type ON components(type);
    -- scenario/motion/audio/image でフィルタ
CREATE INDEX idx_components_type_subtype ON components(type, subtype);
    -- 複合: "scenario + hook" 等
CREATE INDEX idx_components_niche ON components(niche);
    -- ジャンル別のコンポーネント検索
CREATE INDEX idx_components_score ON components(score DESC NULLS LAST);
    -- スコア順でのソート（高スコアを優先取得）
CREATE INDEX idx_components_tags ON components USING GIN(tags);
    -- タグ配列の包含検索: WHERE tags @> ARRAY['skincare']
CREATE INDEX idx_components_review_status ON components(review_status);
    -- pending_review のコンポーネント一覧 (ダッシュボードキュレーションレビュー用)
CREATE INDEX idx_components_curated_by ON components(curated_by);
    -- auto/human でフィルタ
```

### 7.2 Production Tables のインデックス

```sql
-- content
CREATE INDEX idx_content_status ON content(status);
    -- ステータスでのフィルタ（最頻出クエリ）
    -- 制作PL: WHERE status = 'planned'
    -- 投稿スケジューラー: WHERE status = 'ready'
CREATE INDEX idx_content_account ON content(account_id);
    -- アカウント別のコンテンツ一覧
CREATE INDEX idx_content_planned_date ON content(planned_post_date);
    -- 投稿予定日順のソート
CREATE INDEX idx_content_status_planned_date ON content(status, planned_post_date);
    -- 複合: "planned状態のコンテンツを予定日順で"
CREATE INDEX idx_content_hypothesis ON content(hypothesis_id);
    -- 仮説別のコンテンツ一覧（仮説検証時に使用）
CREATE INDEX idx_content_character ON content(character_id);
    -- キャラクター別のコンテンツ一覧
CREATE INDEX idx_content_created_at ON content(created_at);
    -- 時系列でのソート
CREATE INDEX idx_content_format ON content(content_format);
    -- フォーマット別のコンテンツ一覧（ワーカータイプ別振り分け）
CREATE INDEX idx_content_format_status ON content(content_format, status);
    -- 複合: "short_videoのplanned状態のコンテンツ" 等のワーカー別タスク取得
CREATE INDEX idx_content_recipe ON content(recipe_id);
    -- レシピ別のコンテンツ一覧（レシピ効果の分析用）
CREATE INDEX idx_content_production_metadata ON content USING GIN(production_metadata);
    -- 制作メタデータのJSONB検索

-- publications
CREATE INDEX idx_publications_content ON publications(content_id);
    -- コンテンツ別の投稿一覧
CREATE INDEX idx_publications_account ON publications(account_id);
    -- アカウント別の投稿一覧
CREATE INDEX idx_publications_platform ON publications(platform);
    -- プラットフォーム別
CREATE INDEX idx_publications_status ON publications(status);
    -- ステータスでのフィルタ
CREATE INDEX idx_publications_posted_at ON publications(posted_at);
    -- 投稿日時順ソート（時系列分析）
CREATE INDEX idx_publications_measure_after ON publications(measure_after);
    -- 計測タイミング判定: WHERE status='posted' AND NOW() > measure_after
CREATE INDEX idx_publications_status_measure ON publications(status, measure_after);
    -- 複合: 計測対象の検出クエリ最適化
```

### 7.3 Intelligence Tables のインデックス

```sql
-- hypotheses
CREATE INDEX idx_hypotheses_cycle ON hypotheses(cycle_id);
    -- サイクル別の仮説一覧
CREATE INDEX idx_hypotheses_verdict ON hypotheses(verdict);
    -- 検証結果でのフィルタ（pending/confirmed/rejected/inconclusive）
CREATE INDEX idx_hypotheses_category ON hypotheses(category);
    -- カテゴリ別フィルタ
CREATE INDEX idx_hypotheses_source ON hypotheses(source);
    -- AI生成 vs 人間投入の区別
CREATE INDEX idx_hypotheses_created_at ON hypotheses(created_at);
    -- 時系列ソート
CREATE INDEX idx_hypotheses_verdict_category ON hypotheses(verdict, category);
    -- 複合: "confirmedなtiming仮説" 等
CREATE INDEX idx_hypotheses_predicted_kpis ON hypotheses USING GIN(predicted_kpis);
    -- JSONB内のKPI値での検索
CREATE INDEX idx_hypotheses_actual_kpis ON hypotheses USING GIN(actual_kpis);
    -- JSONB内の実測KPI検索

-- hypotheses ベクトルインデックス (HNSW推奨)
CREATE INDEX idx_hypotheses_embedding ON hypotheses
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    -- HNSW (Hierarchical Navigable Small World) インデックス
    -- コサイン類似度で類似仮説を高速検索
    -- m=16: 各ノードの接続数 (推奨: 16-64)
    -- ef_construction=64: 構築時の探索幅 (推奨: 64-100)
    -- クエリ例: ORDER BY embedding <=> $1 LIMIT 10

-- market_intel
CREATE INDEX idx_market_intel_type ON market_intel(intel_type);
    -- 情報タイプ別フィルタ
CREATE INDEX idx_market_intel_platform ON market_intel(platform);
    -- プラットフォーム別
CREATE INDEX idx_market_intel_niche ON market_intel(niche);
    -- ジャンル別
CREATE INDEX idx_market_intel_collected_at ON market_intel(collected_at);
    -- 収集日時順
CREATE INDEX idx_market_intel_expires_at ON market_intel(expires_at);
    -- 有効期限チェック: WHERE expires_at > NOW() OR expires_at IS NULL
CREATE INDEX idx_market_intel_relevance ON market_intel(relevance_score DESC NULLS LAST);
    -- 関連性スコア順
CREATE INDEX idx_market_intel_type_platform ON market_intel(intel_type, platform);
    -- 複合: "YouTubeのtrending_topic" 等
CREATE INDEX idx_market_intel_data ON market_intel USING GIN(data);
    -- JSONBデータの検索

-- market_intel ベクトルインデックス
CREATE INDEX idx_market_intel_embedding ON market_intel
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    -- 類似トレンド・類似市場状況の検索

-- metrics
CREATE INDEX idx_metrics_publication ON metrics(publication_id);
    -- 投稿別のメトリクス一覧
CREATE INDEX idx_metrics_measured_at ON metrics(measured_at);
    -- 時系列ソート（パフォーマンス推移分析）
CREATE INDEX idx_metrics_raw_data ON metrics USING GIN(raw_data);
    -- 生データのJSONB検索

-- analyses
CREATE INDEX idx_analyses_cycle ON analyses(cycle_id);
    -- サイクル別の分析一覧
CREATE INDEX idx_analyses_type ON analyses(analysis_type);
    -- 分析タイプ別フィルタ
CREATE INDEX idx_analyses_created_at ON analyses(created_at);
    -- 時系列ソート
CREATE INDEX idx_analyses_affected ON analyses USING GIN(affected_hypotheses);
    -- 影響を受けた仮説IDでの逆引き

-- learnings
CREATE INDEX idx_learnings_category ON learnings(category);
    -- カテゴリ別フィルタ
CREATE INDEX idx_learnings_confidence ON learnings(confidence DESC);
    -- 高信頼知見の優先取得
CREATE INDEX idx_learnings_applicable_niches ON learnings USING GIN(applicable_niches);
    -- ジャンル適用範囲での検索
CREATE INDEX idx_learnings_applicable_platforms ON learnings USING GIN(applicable_platforms);
    -- プラットフォーム適用範囲での検索
CREATE INDEX idx_learnings_created_at ON learnings(created_at);
    -- 時系列ソート

-- learnings ベクトルインデックス
CREATE INDEX idx_learnings_embedding ON learnings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    -- 類似知見の自動発見・クラスタリング
```

### 7.4 Operations Tables のインデックス

```sql
-- cycles
CREATE INDEX idx_cycles_status ON cycles(status);
    -- ステータスでのフィルタ
CREATE INDEX idx_cycles_cycle_number ON cycles(cycle_number);
    -- サイクル番号順
CREATE INDEX idx_cycles_started_at ON cycles(started_at);
    -- 時系列ソート

-- human_directives
CREATE INDEX idx_directives_status ON human_directives(status);
    -- pending指示の検出: WHERE status = 'pending'
CREATE INDEX idx_directives_type ON human_directives(directive_type);
    -- 指示タイプ別
CREATE INDEX idx_directives_priority ON human_directives(priority);
    -- 優先度別ソート
CREATE INDEX idx_directives_status_priority ON human_directives(status, priority);
    -- 複合: "pendingのurgent指示" を最優先で取得
CREATE INDEX idx_directives_target_accounts ON human_directives USING GIN(target_accounts);
    -- 対象アカウントでの検索
CREATE INDEX idx_directives_target_niches ON human_directives USING GIN(target_niches);
    -- 対象ジャンルでの検索
CREATE INDEX idx_directives_created_at ON human_directives(created_at);
    -- 時系列ソート

-- task_queue
CREATE INDEX idx_task_queue_status ON task_queue(status);
    -- ステータスでのフィルタ（最頻出）
CREATE INDEX idx_task_queue_type ON task_queue(task_type);
    -- タスクタイプ別
CREATE INDEX idx_task_queue_type_status ON task_queue(task_type, status);
    -- 複合: "queuedなproduceタスク" 等
CREATE INDEX idx_task_queue_priority ON task_queue(priority DESC, created_at ASC);
    -- 取得順: 高優先度かつ古いものから
CREATE INDEX idx_task_queue_status_priority ON task_queue(status, priority DESC, created_at ASC);
    -- 複合: キューからの取得最適化
    -- WHERE status = 'queued' ORDER BY priority DESC, created_at ASC LIMIT 1
CREATE INDEX idx_task_queue_created_at ON task_queue(created_at);
    -- 時系列ソート
CREATE INDEX idx_task_queue_payload ON task_queue USING GIN(payload);
    -- ペイロード内の検索

-- algorithm_performance
CREATE INDEX idx_algorithm_perf_measured_at ON algorithm_performance(measured_at);
    -- 時系列ソート（ダッシュボードのグラフ描画）
CREATE INDEX idx_algorithm_perf_period ON algorithm_performance(period);
    -- daily/weekly/monthly フィルタ
CREATE INDEX idx_algorithm_perf_period_measured ON algorithm_performance(period, measured_at);
    -- 複合: "weeklyの精度推移" 等
```

### 7.5 Observability Tables のインデックス

```sql
-- agent_prompt_versions
CREATE INDEX idx_prompt_versions_agent_active ON agent_prompt_versions(agent_type, active);
    -- 現在有効なバージョンの取得: WHERE agent_type = $1 AND active = true
CREATE INDEX idx_prompt_versions_agent_version ON agent_prompt_versions(agent_type, version);
    -- エージェントタイプ別のバージョン履歴取得
CREATE INDEX idx_prompt_versions_created_at ON agent_prompt_versions(created_at);
    -- 時系列ソート

-- agent_thought_logs
CREATE INDEX idx_thought_logs_agent_created ON agent_thought_logs(agent_type, created_at);
    -- エージェント別の思考ログを時系列で取得
CREATE INDEX idx_thought_logs_cycle ON agent_thought_logs(cycle_id);
    -- サイクル別の全エージェント思考ログ
CREATE INDEX idx_thought_logs_graph_node ON agent_thought_logs(graph_name, node_name);
    -- グラフ・ノード別の思考ログ（特定ノードのデバッグ用）
CREATE INDEX idx_thought_logs_created_at ON agent_thought_logs(created_at);
    -- 時系列ソート
CREATE INDEX idx_thought_logs_tools_used ON agent_thought_logs USING GIN(tools_used);
    -- 使用ツール別の逆引き検索
CREATE INDEX idx_thought_logs_token_usage ON agent_thought_logs USING GIN(token_usage);
    -- トークン使用量・コストのJSONB検索

-- agent_reflections
CREATE INDEX idx_reflections_agent_created ON agent_reflections(agent_type, created_at);
    -- エージェント別の振り返りを時系列で取得
    -- 次サイクル開始時に最新の振り返りを参照: WHERE agent_type = $1 ORDER BY created_at DESC LIMIT 1
CREATE INDEX idx_reflections_cycle ON agent_reflections(cycle_id);
    -- サイクル別の全エージェント振り返り一覧
CREATE INDEX idx_reflections_self_score ON agent_reflections(self_score);
    -- スコア別のフィルタ（低スコアの振り返りを重点レビュー）

-- agent_individual_learnings
CREATE INDEX idx_individual_learnings_agent_active ON agent_individual_learnings(agent_type, is_active);
    -- エージェント別のアクティブな学び一覧
    -- タスク実行時に WHERE agent_type = $1 AND is_active = true で検索
CREATE INDEX idx_individual_learnings_agent_category ON agent_individual_learnings(agent_type, category);
    -- エージェント別・カテゴリ別のフィルタ
    -- 例: "researcherのmistakeカテゴリの学び" を取得
CREATE INDEX idx_individual_learnings_source_reflection ON agent_individual_learnings(source_reflection_id);
    -- 振り返りから生成された学びの逆引き

-- agent_individual_learnings ベクトルインデックス (HNSW推奨)
CREATE INDEX idx_individual_learnings_embedding ON agent_individual_learnings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    -- HNSW (Hierarchical Navigable Small World) インデックス
    -- タスク実行時に関連する過去の学びを高速検索
    -- クエリ例: WHERE agent_type = $1 AND is_active = true
    --           ORDER BY embedding <=> $2 LIMIT 5

-- agent_communications
CREATE INDEX idx_communications_status_created ON agent_communications(status, created_at);
    -- 未読メッセージの取得: WHERE status = 'unread' ORDER BY created_at DESC
    -- ダッシュボードの通知バッジ表示に使用
CREATE INDEX idx_communications_agent_type ON agent_communications(agent_type, message_type);
    -- エージェント別・種別別のフィルタ
    -- 例: "researcherのstruggle一覧" を取得
CREATE INDEX idx_communications_priority_status ON agent_communications(priority, status);
    -- 優先度とステータスの複合: "urgentかつunreadのメッセージ" を最優先で表示
```

### 7.6 Tool Management Tables のインデックス

```sql
-- tool_catalog
CREATE INDEX idx_tool_catalog_type ON tool_catalog(tool_type);
    -- ツールタイプ別フィルタ: video_generation/tts/lipsync等
CREATE INDEX idx_tool_catalog_provider ON tool_catalog(provider);
    -- プロバイダー別フィルタ
CREATE INDEX idx_tool_catalog_active ON tool_catalog(is_active);
    -- アクティブなツール一覧の取得
CREATE INDEX idx_tool_catalog_type_active ON tool_catalog(tool_type, is_active);
    -- 複合: "アクティブな動画生成ツール" 等
CREATE INDEX idx_tool_catalog_strengths ON tool_catalog USING GIN(strengths);
    -- JSONB内の強み検索
CREATE INDEX idx_tool_catalog_quirks ON tool_catalog USING GIN(quirks);
    -- JSONB内のクセ・注意点検索

-- tool_experiences
CREATE INDEX idx_tool_experiences_tool ON tool_experiences(tool_id);
    -- ツール別の使用実績一覧
CREATE INDEX idx_tool_experiences_content ON tool_experiences(content_id);
    -- コンテンツ別の使用ツール一覧
CREATE INDEX idx_tool_experiences_content_type_quality ON tool_experiences(content_type, quality_score);
    -- 複合: コンテンツタイプ別の品質分析
    -- 例: "asian_female_beautyでの品質スコア分布" を取得
CREATE INDEX idx_tool_experiences_success ON tool_experiences(success);
    -- 成功/失敗フィルタ
CREATE INDEX idx_tool_experiences_created_at ON tool_experiences(created_at);
    -- 時系列ソート

-- tool_external_sources
CREATE INDEX idx_tool_external_sources_type ON tool_external_sources(source_type);
    -- ソースタイプ別フィルタ
CREATE INDEX idx_tool_external_sources_tool ON tool_external_sources(tool_id);
    -- ツール別の外部情報一覧
CREATE INDEX idx_tool_external_sources_fetched ON tool_external_sources(fetched_at);
    -- 取得日時順ソート

-- tool_external_sources ベクトルインデックス (HNSW推奨)
CREATE INDEX idx_tool_external_sources_embedding ON tool_external_sources
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    -- HNSW (Hierarchical Navigable Small World) インデックス
    -- 類似情報の自動発見・重複排除に使用

-- production_recipes
CREATE INDEX idx_recipes_format_platform ON production_recipes(content_format, target_platform);
    -- 複合: "short_video + youtube向けレシピ" 等
CREATE INDEX idx_recipes_active ON production_recipes(is_active);
    -- アクティブなレシピ一覧
CREATE INDEX idx_recipes_default ON production_recipes(is_default, content_format);
    -- デフォルトレシピの取得
CREATE INDEX idx_recipes_quality ON production_recipes(avg_quality_score DESC NULLS LAST);
    -- 品質順ソート（高品質レシピを優先取得）
CREATE INDEX idx_recipes_recommended ON production_recipes USING GIN(recommended_for);
    -- 推奨条件でのJSONB検索

-- prompt_suggestions
CREATE INDEX idx_prompt_suggestions_agent_status ON prompt_suggestions(agent_type, status);
    -- エージェント別の提案一覧: WHERE agent_type = $1 AND status = 'pending'
CREATE INDEX idx_prompt_suggestions_status ON prompt_suggestions(status);
    -- ステータスフィルタ: pending/accepted/rejected/expired
CREATE INDEX idx_prompt_suggestions_trigger ON prompt_suggestions(trigger_type);
    -- トリガータイプ別フィルタ
CREATE INDEX idx_prompt_suggestions_created_at ON prompt_suggestions(created_at);
    -- 時系列ソート
```

## 8. updated_at 自動更新トリガー

`updated_at` カラムを持つテーブルに対して、レコード更新時に自動的に現在時刻を設定するトリガーを定義する。

```sql
-- 汎用トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_hypotheses_updated_at
    BEFORE UPDATE ON hypotheses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_learnings_updated_at
    BEFORE UPDATE ON learnings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_agent_individual_learnings_updated_at
    BEFORE UPDATE ON agent_individual_learnings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tool_catalog_updated_at
    BEFORE UPDATE ON tool_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_production_recipes_updated_at
    BEFORE UPDATE ON production_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 9. テーブル間リレーション詳細

### 9.1 外部キー一覧

| From テーブル | From カラム | To テーブル | To カラム | 関係 | 説明 |
|---|---|---|---|---|---|
| accounts | character_id | characters | character_id | N:1 | 複数アカウントが1キャラクターを共有 |
| content | hypothesis_id | hypotheses | id | N:1 | 1仮説に基づく複数コンテンツ |
| content | character_id | characters | character_id | N:1 | コンテンツに使用するキャラクター |
| content | recipe_id | production_recipes | id | N:1 | Tool Specialistが選択した制作レシピ |
| content_sections | content_id | content | content_id | N:1 | コンテンツのセクション構成 |
| content_sections | component_id | components | component_id | N:1 | セクションで使用するコンポーネント |
| publications | content_id | content | content_id | N:1 | 1コンテンツの複数プラットフォーム投稿 |
| publications | account_id | accounts | account_id | N:1 | 投稿先アカウント |
| metrics | publication_id | publications | id | N:1 | 1投稿の複数回計測 |
| hypotheses | cycle_id | cycles | id | N:1 | サイクルに属する仮説 |
| analyses | cycle_id | cycles | id | N:1 | サイクルに属する分析 |
| agent_thought_logs | cycle_id | cycles | id | N:1 | サイクルに属する思考ログ |
| agent_reflections | cycle_id | cycles | id | N:1 | サイクルに属する振り返り |
| agent_individual_learnings | source_reflection_id | agent_reflections | id | N:1 | 学びの生成元となった振り返り |
| agent_communications | cycle_id | cycles | id | N:1 | サイクルに属するメッセージ |
| tool_experiences | tool_id | tool_catalog | id | N:1 | 使用したツール |
| tool_experiences | content_id | content | id | N:1 | 使用されたコンテンツ |
| tool_external_sources | tool_id | tool_catalog | id | N:1 | 関連するツール (NULLable) |

### 9.2 データフロー上の間接参照

外部キーでは表現されないが、アプリケーションレベルで重要な参照関係。

| From テーブル | From カラム | To テーブル | To カラム | 説明 |
|---|---|---|---|---|
| analyses | affected_hypotheses (INTEGER[]) | hypotheses | id | 分析で影響を受けた仮説群 |
| learnings | source_analyses (INTEGER[]) | analyses | id | 知見の根拠となった分析群 |
| human_directives | target_accounts (VARCHAR[]) | accounts | account_id | 指示の対象アカウント群 |
| hypotheses | target_accounts (VARCHAR[]) | accounts | account_id | 仮説の検証対象アカウント群 |
| agent_thought_logs | tools_used (TEXT[]) | - | - | MCPツール名の配列。外部テーブルなし |
| production_recipes | steps (JSONB, tool_id) | tool_catalog | id | レシピの各ステップで使用するツール |
| tool_experiences | recipe_used (JSONB, recipe_id) | production_recipes | id | 使用したレシピの参照 |

これらは配列型で格納されるため、外部キー制約は設定しない。アプリケーション層（MCP Server）でバリデーションを行う。

### 9.3 コンテンツのライフサイクルとテーブル遷移

```
1. 戦略サイクルグラフ
   cycles (INSERT) → hypotheses (INSERT) → content (INSERT, status='pending_approval' or 'planned')
     ※ REQUIRE_HUMAN_APPROVAL=true → status='pending_approval' (人間の承認待ち)
     ※ REQUIRE_HUMAN_APPROVAL=false → status='planned' (直接制作待ち)
                                                │
1.5 人間承認 (REQUIRE_HUMAN_APPROVAL=true時のみ) │
   Dashboard上で人間がレビュー                    │
   → 承認: content (UPDATE, status='planned', approved_by, approved_at)
   → 差戻: content (UPDATE, approval_feedback) ※ステータスはpending_approvalのまま
                                                │
2. 制作パイプライングラフ                         │
   task_queue (INSERT, type='produce') ←─────────┘
   content.content_format でワーカーを振り分け:
     short_video → Video Worker (recipe_idのレシピに従いツール実行)
     text_post   → Text Worker (LLM直接生成、recipe_id不要)
     image_post  → Image Worker (将来拡張)
   content (UPDATE, status='producing' → 'ready')
                                                │
3. 投稿スケジューラーグラフ                       │
   task_queue (INSERT, type='publish') ←─────────┘
   publications (INSERT, status='scheduled' → 'posted')
                                                │
4. 計測ジョブグラフ                              │
   task_queue (INSERT, type='measure') ←─────────┘
   metrics (INSERT) → publications (UPDATE, status='measured')
                                                │
5. 戦略サイクルグラフ (次サイクル)                │
   analyses (INSERT) ←──────────────────────────┘
   learnings (INSERT or UPDATE)
   hypotheses (UPDATE, verdict判定)
   content (UPDATE, status='analyzed')
   algorithm_performance (INSERT)

※ 全ステップで agent_thought_logs (INSERT) が記録される（横断的）
※ プロンプト変更時に agent_prompt_versions (INSERT) が記録される
※ サイクル終了時に agent_reflections (INSERT) が各エージェントから生成される
※ 振り返りから agent_individual_learnings (INSERT or UPDATE) が蓄積される
※ エージェントが人間に伝えたい内容がある場合 agent_communications (INSERT) が生成される

6. ツール管理サイクル（横断的）
   tool_external_sources (INSERT) ← Tool Specialistが外部情報を収集
   tool_catalog (INSERT or UPDATE) ← 新ツール登録・既存ツール情報更新
   production_recipes (INSERT or UPDATE) ← レシピの作成・最適化
   tool_experiences (INSERT) ← 制作パイプライン実行時にツール使用結果を記録
   prompt_suggestions (INSERT) ← パフォーマンス分析に基づくプロンプト改善提案
```

## 10. v4.0からのデータ移行マッピング

### 10.1 Spreadsheet → PostgreSQL マッピング

| v4.0 データソース | v5.0 テーブル | 移行方法 |
|---|---|---|
| Accounts Inventory (`1CmT6C3qCW3md6lJ9Rvc2WNQkWa5zcvlq6Zp_enJHoUE`) | accounts | 全行をINSERT。auth_credentialsは別途設定 |
| Characters Inventory | characters | 全行をINSERT。appearanceとpersonalityはJSONBに構造化 |
| Scenarios Inventory | components (type='scenario') | script_en/jp等をdata JSONBに格納 |
| Motions Inventory | components (type='motion') | drive_file_idを移行 |
| Audio Inventory | components (type='audio') | drive_file_idを移行 |
| Master Spreadsheet production タブ | content | 33カラムを正規化して移行 |

### 10.2 カラムマッピング例 (production タブ → content)

| v4.0 production カラム | v5.0 content カラム | 変換 |
|---|---|---|
| content_id | content_id | そのまま |
| (なし) | content_format | 全レコードに 'short_video' を設定 (v4.0は動画制作のみ) |
| (なし) | recipe_id | v4.0デフォルトレシピ (Kling + Fish Audio + fal lipsync) のIDを設定 |
| account_id | publications.account_id | contentではなくpublicationsに移行 |
| status | status | 値のマッピング (queued → planned 等)。scheduled/posted/measured → publications.status。v4.0にpending_approval相当なし (全コンテンツは直接planned扱い) |
| planned_date | planned_post_date | DATE型に変換 |
| hook_scenario_id | content_sections (section_order=1) | content_sectionsテーブルにINSERT |
| body_scenario_id | content_sections (section_order=2) | content_sectionsテーブルにINSERT |
| cta_scenario_id | content_sections (section_order=3) | content_sectionsテーブルにINSERT |
| script_language | script_language | そのまま |
| video_drive_id | video_drive_id | そのまま |
| file_link | video_drive_url | そのまま |
| drive_folder_id | drive_folder_id | そのまま |
| error | error_message | そのまま |

## 11. 想定クエリパターン

MCP Serverが構築する主要なクエリパターンを示す。エージェントはこれらのクエリをMCPツール名で呼び出し、SQLを直接書くことはない。

### 11.1 制作パイプライングラフ: タスク取得

```sql
-- MCPツール: get_pending_tasks
-- content_formatでワーカータイプ別にフィルタ
SELECT c.content_id, c.content_format, c.script_language,
       c.recipe_id, pr.recipe_name, pr.steps AS recipe_steps,
       ch.character_id, ch.voice_id, ch.image_drive_id,
       json_agg(json_build_object(
         'section_order', cs.section_order,
         'section_label', cs.section_label,
         'component_id', cs.component_id,
         'script', cs.script
       ) ORDER BY cs.section_order) AS sections
FROM content c
JOIN characters ch ON c.character_id = ch.character_id
LEFT JOIN content_sections cs ON c.content_id = cs.content_id
LEFT JOIN production_recipes pr ON c.recipe_id = pr.id
WHERE c.status = 'planned'
  AND c.content_format = $1  -- 'short_video' / 'text_post' / 'image_post'
  AND c.planned_post_date <= CURRENT_DATE + INTERVAL '3 days'
GROUP BY c.content_id, c.content_format, c.script_language,
         c.recipe_id, pr.recipe_name, pr.steps,
         ch.character_id, ch.voice_id, ch.image_drive_id
ORDER BY c.planned_post_date ASC
LIMIT 5;
```

### 11.2 計測ジョブグラフ: 計測対象検出

```sql
-- MCPツール: get_posts_needing_measurement
SELECT p.id, p.platform, p.platform_post_id, p.posted_at,
       c.content_id, a.account_id
FROM publications p
JOIN content c ON p.content_id = c.content_id
JOIN accounts a ON p.account_id = a.account_id
WHERE p.status = 'posted'
  AND p.measure_after <= NOW()
  AND NOT EXISTS (
      SELECT 1 FROM metrics m
      WHERE m.publication_id = p.id
        AND m.measured_at > p.posted_at
  )
ORDER BY p.measure_after ASC;
```

### 11.3 アナリスト: 類似仮説検索 (pgvector)

```sql
-- MCPツール: search_similar_hypotheses
-- $1 = 新しい仮説のembedding (vector(1536))
SELECT id, statement, verdict, confidence, evidence_count,
       1 - (embedding <=> $1) AS similarity
FROM hypotheses
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1
LIMIT 10;
```

### 11.4 プランナー: アカウント別パフォーマンスサマリー

```sql
-- MCPツール: get_performance_summary
SELECT a.account_id, a.platform, a.niche,
       COUNT(m.id) AS total_measurements,
       AVG(m.views) AS avg_views,
       AVG(m.engagement_rate) AS avg_engagement_rate,
       AVG(m.completion_rate) AS avg_completion_rate,
       SUM(m.follower_delta) AS total_follower_growth
FROM accounts a
JOIN publications p ON a.account_id = p.account_id
JOIN metrics m ON p.id = m.publication_id
WHERE a.account_id = $1
  AND m.measured_at >= NOW() - $2::INTERVAL
GROUP BY a.account_id, a.platform, a.niche;
```

### 11.5 ダッシュボード: アルゴリズム精度推移

```sql
-- ORM (Prisma/Drizzle) で直接発行
SELECT measured_at, hypothesis_accuracy, prediction_error,
       learning_count, improvement_rate
FROM algorithm_performance
WHERE period = 'weekly'
  AND measured_at >= NOW() - INTERVAL '90 days'
ORDER BY measured_at ASC;
```
