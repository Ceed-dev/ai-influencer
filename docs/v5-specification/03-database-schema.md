# PostgreSQLスキーマ完全定義

> v5.0の全テーブル・カラム・リレーション・インデックスを定義する
>
> **データベース**: PostgreSQL 16+ with pgvector extension
>
> **テーブル数**: 15テーブル (Entity 3 / Production 2 / Intelligence 5 / Operations 5)
>
> **関連ドキュメント**: [02-architecture.md](02-architecture.md) (データ基盤層の設計思想), [01-tech-stack.md](01-tech-stack.md) (pgvector・ORM選定)

## 概要

v5.0のPostgreSQLスキーマは、AI-Influencerシステムの全構造化データを一元管理する。v4.0で5つのGoogle Spreadsheet + 33列productionタブに散在していたデータを、リレーショナルDBの正規化された15テーブルに集約する。

### テーブルカテゴリ

| カテゴリ | テーブル数 | 役割 | 主要テーブル |
|---------|----------|------|------------|
| **Entity** | 3 | システムの基本エンティティ定義 | accounts, characters, components |
| **Production** | 2 | コンテンツ制作から投稿までのライフサイクル | content, publications |
| **Intelligence** | 5 | 仮説駆動サイクルの知的資産 | hypotheses, market_intel, metrics, analyses, learnings |
| **Operations** | 5 | システム運用・タスク管理 | cycles, human_directives, task_queue, algorithm_performance |

### ER図

```
┌─────────────┐       ┌─────────────┐       ┌─────────────────┐
│  characters │       │  accounts   │       │   components    │
│             │◄──────│             │       │                 │
│ character_id│  uses │ account_id  │       │ component_id    │
│ name        │       │ platform    │       │ type            │
│ voice_id    │       │ niche       │       │ subtype         │
│ appearance  │       │ status      │       │ data (JSONB)    │
└──────┬──────┘       └──────┬──────┘       └──┬──┬──┬───────┘
       │                     │                 │  │  │
       │  character_id       │  account_id     │  │  │ hook/body/cta
       │                     │                 │  │  │ _component_id
       │              ┌──────▼──────┐          │  │  │
       └─────────────►│   content   │◄─────────┘──┘──┘
                      │             │
                      │ content_id  │
                      │ status      │───────────────────┐
                      │ hypothesis_id                   │
                      └──────┬──────┘                   │
                             │                          │
                hypothesis_id│  content_id              │
                             │                          │
                ┌────────────▼──┐    ┌──────────────┐   │
                │  hypotheses   │    │ publications │◄──┘
                │               │    │              │
                │ statement     │    │ platform     │
                │ verdict       │    │ posted_at    │
                │ embedding     │    │ post_url     │
                │ (vector)      │    └──────┬───────┘
                └───────┬───────┘           │
                        │                   │ publication_id
                  cycle_id                  │
                        │           ┌───────▼──────┐
                ┌───────▼───────┐   │   metrics    │
                │    cycles     │   │              │
                │               │   │ views        │
                │ cycle_number  │   │ likes        │
                │ status        │   │ engagement   │
                └───────┬───────┘   │ raw_data     │
                        │           └──────────────┘
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
    subtype         VARCHAR(20),
        -- hook / body / cta
        -- 動画の3セクション構成に対応
        -- scenario・motionでは必須、audio・imageでは任意

    -- 基本情報
    name            VARCHAR(200) NOT NULL,
        -- コンポーネント名
        -- 例: "朝のスキンケアルーティン - Hook"
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

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_components_type
        CHECK (type IN ('scenario', 'motion', 'audio', 'image')),
    CONSTRAINT chk_components_subtype
        CHECK (subtype IS NULL OR subtype IN ('hook', 'body', 'cta'))
);

COMMENT ON TABLE components IS 'シナリオ・モーション・オーディオ・画像の統合コンポーネント管理';
COMMENT ON COLUMN components.data IS '種別(type)に応じた構造化データ。scenarioならscript_en/jp等';
COMMENT ON COLUMN components.score IS 'アナリストが算出するパフォーマンススコア (0-100)';
COMMENT ON COLUMN components.tags IS '自由タグ配列。GINインデックスで高速検索';
```

## 2. Production Tables (制作テーブル)

コンテンツの制作から投稿までのライフサイクルを管理する。`content` テーブルがv4.0の production タブ (33カラム) の後継、`publications` テーブルが投稿記録を分離して保持する。

### 2.1 content — コンテンツ管理

コンテンツの全ライフサイクルを管理する中核テーブル。ステータス遷移 (`planned` → `producing` → `ready` → `scheduled` → `posted` → `measured` → `analyzed`) を追跡し、4つのLangGraphグラフ間の間接連携ポイントとなる。

v4.0の production タブ (33カラム) からの移行先。

```sql
CREATE TABLE content (
    -- 主キー
    id              SERIAL PRIMARY KEY,
    content_id      VARCHAR(20) NOT NULL UNIQUE,
        -- CNT_YYYYMM_NNNN形式
        -- 例: CNT_202602_2916 (v4.0の初回E2E成功コンテンツ)

    -- 紐付け
    account_id      VARCHAR(20) NOT NULL REFERENCES accounts(account_id),
        -- このコンテンツを投稿するアカウント
    hypothesis_id   INTEGER REFERENCES hypotheses(id),
        -- この制作の根拠となった仮説
        -- NULLの場合: 人間が直接指示したコンテンツ（仮説駆動でない）
        -- 戦略サイクルグラフが仮説に基づいてコンテンツ計画を作成する際に設定

    -- ステータス管理
    status          VARCHAR(20) NOT NULL DEFAULT 'planned',
        -- planned:    戦略サイクルが計画承認済み。制作待ち
        -- producing:  制作パイプラインが動画生成中
        -- ready:      動画完成。投稿待ちプール内
        -- scheduled:  投稿スケジュール確定
        -- posted:     投稿完了
        -- measured:   パフォーマンス計測完了
        -- analyzed:   分析結果が知見として保存済み
        -- error:      制作or投稿で回復不能エラー発生
        -- cancelled:  人間orエージェントが取消
    planned_post_date DATE,
        -- 投稿予定日。戦略サイクルが設定
        -- 投稿スケジューラーがこの日付+最適時間帯で投稿

    -- コンポーネント紐付け (3セクション構成)
    hook_component_id VARCHAR(30) REFERENCES components(component_id),
        -- Hook部分のシナリオ or モーションID
    body_component_id VARCHAR(30) REFERENCES components(component_id),
        -- Body部分のシナリオ or モーションID
    cta_component_id  VARCHAR(30) REFERENCES components(component_id),
        -- CTA部分のシナリオ or モーションID

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
    script_hook     TEXT,
        -- 実際に使用されたHookスクリプト
        -- componentsのscript_en/jpをコピー or LLMが調整した版
    script_body     TEXT,
        -- 実際に使用されたBodyスクリプト
    script_cta      TEXT,
        -- 実際に使用されたCTAスクリプト

    -- 完成動画情報
    video_drive_id  VARCHAR(100),
        -- 完成動画 (final.mp4) のGoogle DriveファイルID
    video_drive_url TEXT,
        -- Google Drive上のURL (human-readable)
        -- 例: https://drive.google.com/file/d/{id}/view
    drive_folder_id VARCHAR(100),
        -- 動画保存先フォルダのDrive ID
        -- Productions/YYYY-MM-DD/VID_YYYYMM_XXXX/ のフォルダID

    -- 制作メタデータ
    production_metadata JSONB,
        -- 制作パイプラインの実行情報
        -- 構造例:
        -- {
        --   "fal_request_ids": {
        --     "hook_kling": "req_abc123",
        --     "body_kling": "req_def456",
        --     "cta_kling": "req_ghi789",
        --     "hook_tts": "req_jkl012",
        --     "hook_lipsync": "req_mno345"
        --   },
        --   "processing_times": {
        --     "total_seconds": 720,
        --     "hook_seconds": 240,
        --     "body_seconds": 230,
        --     "cta_seconds": 250,
        --     "concat_seconds": 15
        --   },
        --   "file_sizes": {
        --     "hook_mp4": 18000000,
        --     "body_mp4": 20000000,
        --     "cta_mp4": 16000000,
        --     "final_mp4": 54000000
        --   },
        --   "pipeline_version": "4.0",
        --   "dry_run": false
        -- }

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
            'planned', 'producing', 'ready', 'scheduled',
            'posted', 'measured', 'analyzed',
            'error', 'cancelled'
        )),
    CONSTRAINT chk_content_script_language
        CHECK (script_language IS NULL OR script_language IN ('en', 'jp'))
);

COMMENT ON TABLE content IS 'コンテンツのライフサイクル管理。4つのLangGraphグラフ間の間接連携ポイント';
COMMENT ON COLUMN content.status IS 'planned→producing→ready→scheduled→posted→measured→analyzed のステータス遷移';
COMMENT ON COLUMN content.hypothesis_id IS '仮説駆動サイクルの根拠。NULLは人間の直接指示';
COMMENT ON COLUMN content.production_metadata IS 'fal.ai request ID, 処理時間, ファイルサイズ等';
```

### 2.2 publications — 投稿記録

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
        CHECK (status IN ('scheduled', 'posted', 'failed'))
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

    -- 生データ
    raw_data        JSONB
        -- プラットフォームAPIから取得した生レスポンス
        -- デバッグ・将来の再分析用に全データを保持
        -- 構造はプラットフォームごとに異なる
);

COMMENT ON TABLE metrics IS '投稿パフォーマンスの時系列記録。1投稿に対して複数回計測可能';
COMMENT ON COLUMN metrics.completion_rate IS '完視聴率。Shorts/Reelsの最重要KPI';
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
        CHECK (directive_type IN ('hypothesis', 'reference_content', 'instruction')),
    CONSTRAINT chk_directives_status
        CHECK (status IN ('pending', 'acknowledged', 'applied', 'expired')),
    CONSTRAINT chk_directives_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

COMMENT ON TABLE human_directives IS 'ダッシュボードからの人間の指示。戦略エージェントがサイクル開始時に読み取り';
COMMENT ON COLUMN human_directives.directive_type IS 'hypothesis/reference_content/instruction';
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
    payload         JSONB NOT NULL,
        -- タスク固有のデータ
        --
        -- [produce の場合]
        -- {
        --   "content_id": "CNT_202603_0001",
        --   "account_id": "ACC_0013",
        --   "character_id": "CHR_0001",
        --   "hook_component_id": "SCN_0042",
        --   "body_component_id": "SCN_0043",
        --   "cta_component_id": "SCN_0044",
        --   "script_language": "jp",
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
        CHECK (task_type IN ('produce', 'publish', 'measure')),
    CONSTRAINT chk_task_status
        CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
);

COMMENT ON TABLE task_queue IS '制作・投稿・計測のタスクキュー。各LangGraphグラフがポーリングで取得';
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

## 5. インデックス定義

パフォーマンスを確保するためのインデックス。主にステータスフィルタリング、時系列クエリ、JSONB検索、ベクトル検索に対応する。

### 5.1 Entity Tables のインデックス

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
```

### 5.2 Production Tables のインデックス

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

### 5.3 Intelligence Tables のインデックス

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

### 5.4 Operations Tables のインデックス

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

## 6. updated_at 自動更新トリガー

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
```

## 7. テーブル間リレーション詳細

### 7.1 外部キー一覧

| From テーブル | From カラム | To テーブル | To カラム | 関係 | 説明 |
|---|---|---|---|---|---|
| accounts | character_id | characters | character_id | N:1 | 複数アカウントが1キャラクターを共有 |
| content | account_id | accounts | account_id | N:1 | 1アカウントに複数コンテンツ |
| content | hypothesis_id | hypotheses | id | N:1 | 1仮説に基づく複数コンテンツ |
| content | character_id | characters | character_id | N:1 | コンテンツに使用するキャラクター |
| content | hook_component_id | components | component_id | N:1 | Hookセクションのコンポーネント |
| content | body_component_id | components | component_id | N:1 | Bodyセクションのコンポーネント |
| content | cta_component_id | components | component_id | N:1 | CTAセクションのコンポーネント |
| publications | content_id | content | content_id | N:1 | 1コンテンツの複数プラットフォーム投稿 |
| publications | account_id | accounts | account_id | N:1 | 投稿先アカウント |
| metrics | publication_id | publications | id | N:1 | 1投稿の複数回計測 |
| hypotheses | cycle_id | cycles | id | N:1 | サイクルに属する仮説 |
| analyses | cycle_id | cycles | id | N:1 | サイクルに属する分析 |

### 7.2 データフロー上の間接参照

外部キーでは表現されないが、アプリケーションレベルで重要な参照関係。

| From テーブル | From カラム | To テーブル | To カラム | 説明 |
|---|---|---|---|---|
| analyses | affected_hypotheses (INTEGER[]) | hypotheses | id | 分析で影響を受けた仮説群 |
| learnings | source_analyses (INTEGER[]) | analyses | id | 知見の根拠となった分析群 |
| human_directives | target_accounts (VARCHAR[]) | accounts | account_id | 指示の対象アカウント群 |
| hypotheses | target_accounts (VARCHAR[]) | accounts | account_id | 仮説の検証対象アカウント群 |

これらは配列型で格納されるため、外部キー制約は設定しない。アプリケーション層（MCP Server）でバリデーションを行う。

### 7.3 コンテンツのライフサイクルとテーブル遷移

```
1. 戦略サイクルグラフ
   cycles (INSERT) → hypotheses (INSERT) → content (INSERT, status='planned')
                                                │
2. 制作パイプライングラフ                         │
   task_queue (INSERT, type='produce') ←─────────┘
   content (UPDATE, status='producing' → 'ready')
                                                │
3. 投稿スケジューラーグラフ                       │
   task_queue (INSERT, type='publish') ←─────────┘
   publications (INSERT) → content (UPDATE, status='posted')
                                                │
4. 計測ジョブグラフ                              │
   task_queue (INSERT, type='measure') ←─────────┘
   metrics (INSERT) → content (UPDATE, status='measured')
                                                │
5. 戦略サイクルグラフ (次サイクル)                │
   analyses (INSERT) ←──────────────────────────┘
   learnings (INSERT or UPDATE)
   hypotheses (UPDATE, verdict判定)
   content (UPDATE, status='analyzed')
   algorithm_performance (INSERT)
```

## 8. v4.0からのデータ移行マッピング

### 8.1 Spreadsheet → PostgreSQL マッピング

| v4.0 データソース | v5.0 テーブル | 移行方法 |
|---|---|---|
| Accounts Inventory (`1CmT6C3qCW3md6lJ9Rvc2WNQkWa5zcvlq6Zp_enJHoUE`) | accounts | 全行をINSERT。auth_credentialsは別途設定 |
| Characters Inventory | characters | 全行をINSERT。appearanceとpersonalityはJSONBに構造化 |
| Scenarios Inventory | components (type='scenario') | script_en/jp等をdata JSONBに格納 |
| Motions Inventory | components (type='motion') | drive_file_idを移行 |
| Audio Inventory | components (type='audio') | drive_file_idを移行 |
| Master Spreadsheet production タブ | content | 33カラムを正規化して移行 |

### 8.2 カラムマッピング例 (production タブ → content)

| v4.0 production カラム | v5.0 content カラム | 変換 |
|---|---|---|
| content_id | content_id | そのまま |
| account_id | account_id | そのまま |
| status | status | 値のマッピング (queued → planned 等) |
| planned_date | planned_post_date | DATE型に変換 |
| hook_scenario_id | hook_component_id | ID体系の変換 |
| script_language | script_language | そのまま |
| video_drive_id | video_drive_id | そのまま |
| file_link | video_drive_url | そのまま |
| drive_folder_id | drive_folder_id | そのまま |
| error | error_message | そのまま |

## 9. 想定クエリパターン

MCP Serverが構築する主要なクエリパターンを示す。エージェントはこれらのクエリをMCPツール名で呼び出し、SQLを直接書くことはない。

### 9.1 制作パイプライングラフ: タスク取得

```sql
-- MCPツール: get_pending_tasks
SELECT c.content_id, c.account_id, c.script_language,
       c.hook_component_id, c.body_component_id, c.cta_component_id,
       ch.character_id, ch.voice_id, ch.image_drive_id
FROM content c
JOIN characters ch ON c.character_id = ch.character_id
WHERE c.status = 'planned'
  AND c.planned_post_date <= CURRENT_DATE + INTERVAL '3 days'
ORDER BY c.planned_post_date ASC
LIMIT 5;
```

### 9.2 計測ジョブグラフ: 計測対象検出

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

### 9.3 アナリスト: 類似仮説検索 (pgvector)

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

### 9.4 プランナー: アカウント別パフォーマンスサマリー

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

### 9.5 ダッシュボード: アルゴリズム精度推移

```sql
-- ORM (Prisma/Drizzle) で直接発行
SELECT measured_at, hypothesis_accuracy, prediction_error,
       learning_count, improvement_rate
FROM algorithm_performance
WHERE period = 'weekly'
  AND measured_at >= NOW() - INTERVAL '90 days'
ORDER BY measured_at ASC;
```
