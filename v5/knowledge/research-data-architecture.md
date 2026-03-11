# v5.0 リサーチ・分析・学習データ アーキテクチャ

このドキュメントは、v5.0 AI-Influencer システムにおける「市場調査・リサーチ・分析・コンテンツ計画」に関連する全 DB テーブルの設計・仕様をまとめたものです。

各エージェント（リサーチャー・アナリスト・データキュレーター・プランナー）がどのようにデータを収集・分解・ベクトル化・保存し、次の仮説立案やコンテンツ制作に活用するかを網羅しています。

**仕様書参照元**
- `docs/v5-specification/03-database-schema.md`
- `docs/v5-specification/04-agent-design.md`

## 目次

1. [全体像とデータフロー](#全体像とデータフロー)
2. [担当エージェント一覧](#担当エージェント一覧)
3. [テーブル詳細](#テーブル詳細)
   - [market_intel — 市場情報統合](#market_intel--市場情報統合)
   - [hypotheses — 仮説管理](#hypotheses--仮説管理)
   - [analyses — 分析結果](#analyses--分析結果)
   - [learnings — 蓄積知見（共有）](#learnings--蓄積知見共有)
   - [content_learnings — コンテンツ単位学習](#content_learnings--コンテンツ単位学習)
   - [agent_individual_learnings — エージェント個別学習](#agent_individual_learnings--エージェント個別学習)
   - [components — 制作コンポーネント管理](#components--制作コンポーネント管理)
   - [content_playbooks — 制作 Playbook](#content_playbooks--制作-playbook)
   - [algorithm_performance — アルゴリズム精度追跡](#algorithm_performance--アルゴリズム精度追跡)
   - [prediction_snapshots — 予測スナップショット](#prediction_snapshots--予測スナップショット)
   - [account_baselines — ベースラインキャッシュ](#account_baselines--ベースラインキャッシュ)
   - [adjustment_factor_cache — 補正係数キャッシュ](#adjustment_factor_cache--補正係数キャッシュ)
4. [ベクトル化（Embedding）設計](#ベクトル化embedding設計)
5. [エージェント別データフロー詳細](#エージェント別データフロー詳細)
6. [JSONB 内部スキーマリファレンス](#jsonb-内部スキーマリファレンス)

## 全体像とデータフロー

```
【データ収集フェーズ】
  外部 Web / プラットフォーム API
        ↓ WebSearch / WebFetch
  Researcher エージェント
        ↓ save_trending_topic / save_competitor_post / ...
  ┌─────────────────┐
  │   market_intel   │  ← 市場情報（5種類）
  └─────────────────┘

【分析・学習フェーズ】
  計測完了（投稿後 48h / 7d / 30d）
        ↓
  Analyst エージェント
        ↓ create_micro_analysis / extract_learning / verify_hypothesis
  ┌──────────────────────┬──────────────────────┬───────────────────┐
  │  content_learnings   │      learnings        │    hypotheses     │
  │（コンテンツ単位学習）│（共有知見ライブラリ）│（仮説管理・検証） │
  └──────────────────────┴──────────────────────┴───────────────────┘
        ↓
  ┌──────────────────────┬──────────────────────┐
  │  algorithm_performance│  prediction_snapshots │
  │（精度追跡）          │（予測 vs 実績）       │
  └──────────────────────┴──────────────────────┘

【コンポーネント管理フェーズ】
  Data Curator エージェント
        ↓ save_curated_component / create_component
  ┌──────────────┬──────────────────────┐
  │  components  │   content_playbooks  │
  │（制作素材）  │（制作ノウハウ集）    │
  └──────────────┴──────────────────────┘

【仮説立案・コンテンツ計画フェーズ】
  Planner エージェント
        ↓ search_content_learnings / search_similar_learnings / search_playbooks
        ↓ get_niche_trends / get_competitor_analysis
  → 仮説生成 → コンテンツ計画
```

## 担当エージェント一覧

| エージェント | 役割 | 主な書き込み先テーブル | 主な読み取り元テーブル |
|------------|------|----------------------|----------------------|
| **Researcher** | 市場情報収集・トレンド監視 | market_intel | — |
| **Analyst** | 分析・仮説検証・知見抽出 | content_learnings, learnings, analyses, hypotheses, algorithm_performance, prediction_snapshots, account_baselines, adjustment_factor_cache | market_intel, metrics, hypotheses |
| **Data Curator** | 生データ構造化・コンポーネント生成 | components, content_playbooks | market_intel, components |
| **Planner** | コンテンツ計画・仮説立案 | hypotheses | market_intel, learnings, content_learnings, content_playbooks, components |
| **全エージェント** | 個別学習メモ | agent_individual_learnings | agent_individual_learnings |

## テーブル詳細

### market_intel — 市場情報統合

**概要**: リサーチャーエージェントが外部 Web・各プラットフォーム API から収集した生の市場情報を統合管理するテーブル。5 種類の情報タイプに分類され、それぞれ有効期限が設定されている。アナリスト・プランナー・ストラテジストが参照して意思決定の材料とする。

**データ取得元**: WebSearch（Brave Search）、WebFetch、各プラットフォームの公開 API・Web データ

**使われ方**: Strategist がサイクル開始時に市場動向を把握 → Planner が仮説立案時にトレンド・競合情報を参照 → Analyst が累積分析で類似市場状況を pgvector 検索

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| intel_type | VARCHAR(30) | NOT NULL | 情報タイプ（5種、下記参照） |
| platform | VARCHAR(20) | NULL可 | youtube / tiktok / instagram / x / NULL（全プラットフォーム共通） |
| niche | VARCHAR(50) | NULL可 | beauty / tech / fitness 等 / NULL（全ニッチ共通） |
| data | JSONB | NOT NULL | intel_type に応じた構造化データ（下記参照） |
| source_url | TEXT | NULL可 | 情報のソース URL |
| relevance_score | NUMERIC(3,2) | NULL可 | 関連性スコア 0.00〜1.00（Researcher が評価） |
| collected_at | TIMESTAMPTZ | NOT NULL | 情報収集日時（デフォルト NOW()） |
| expires_at | TIMESTAMPTZ | NULL可 | 有効期限（platform_update のみ NULL = 恒久） |
| embedding | vector(1536) | NULL可 | data 内容のベクトル埋め込み（pgvector HNSW） |

#### intel_type の 5 分類

**1. trending_topic — トレンドトピック**

有効期限：7 日（トレンドは短命）　収集頻度：6 時間ごと

要素分解：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| topic | string | トレンドキーワード（例："glass skin"） |
| volume | number | 検索・言及量（絶対数） |
| growth_rate | number | 前日比成長率（例：2.5 = 250%増） |

データ例：
```json
{
  "topic": "glass skin",
  "volume": 50000,
  "growth_rate": 2.5
}
```

**2. competitor_post — 競合の注目投稿**

有効期限：30 日　収集頻度：12 時間ごと

要素分解：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| post_url | string | 競合投稿の URL |
| views | number | 再生数 |
| format | string | コンテンツフォーマット（例：reaction / tutorial / vlog） |
| hook_technique | string | 冒頭フック手法（例：question / shock / story） |
| competitor_account | string | 競合アカウント識別子（例："ACC_C001"） |

データ例：
```json
{
  "post_url": "https://www.tiktok.com/@beauty_guru/video/123456",
  "views": 1000000,
  "format": "reaction",
  "hook_technique": "question",
  "competitor_account": "ACC_C001"
}
```

**3. competitor_account — 競合アカウント情報**

有効期限：30 日　収集頻度：24 時間ごと

要素分解：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| username | string | アカウントのユーザー名（例："@beauty_guru"） |
| followers | number | フォロワー数 |
| posting_frequency | string | 投稿頻度（daily / weekly 等） |
| avg_views | number | 直近投稿の平均再生数 |

データ例：
```json
{
  "username": "@beauty_guru",
  "followers": 500000,
  "posting_frequency": "daily",
  "avg_views": 50000
}
```

**4. audience_signal — オーディエンスの反応シグナル**

有効期限：14 日　収集頻度：12 時間ごと

要素分解：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| signal_type | string | シグナル種別（comment_sentiment / search_query / hashtag_usage 等） |
| topic | string | 対象トピック（例："skincare"） |
| sentiment | string | センチメント方向（positive / negative / neutral） |
| sample_comments | array | 代表的なコメント例の配列 |

データ例：
```json
{
  "signal_type": "comment_sentiment",
  "topic": "skincare",
  "sentiment": "positive",
  "sample_comments": ["これ試してみたい！", "効果あった人いる？"]
}
```

**5. platform_update — プラットフォームのアルゴリズム変更情報**

有効期限：恒久（NULL）　収集頻度：24 時間ごと

要素分解：

| フィールド | 型 | 説明 |
|-----------|-----|------|
| platform | string | 対象プラットフォーム（youtube / tiktok / instagram / x） |
| update_type | string | 変更種別（algorithm_change / policy_update / feature_release 等） |
| description | string | 変更内容の説明 |
| effective_date | string | 変更が有効になった日付（ISO 8601） |

データ例：
```json
{
  "platform": "tiktok",
  "update_type": "algorithm_change",
  "description": "Longer videos (>60s) now get more reach in FYP",
  "effective_date": "2026-03-01"
}
```

#### Embedding 設計

ベクトル化ソース：`title + summary`（intel_type 別のタイトルと要約を結合）

pgvector インデックス：HNSW（件数 5,000 件規模、中速 INSERT 優先）

検索ツール：`search_similar_intel`（Researcher が類似情報を検索）

### hypotheses — 仮説管理

**概要**: v5.0 の「仮説駆動サイクル」の核心テーブル。Planner が立案した仮説を格納し、Analyst が計測後に verdict（confirmed / rejected / inconclusive）を判定する。仮説が繰り返し confirmed になると `learnings` テーブルへ昇格される。

**データ取得元**:
- `source='ai'`：Planner エージェントが market_intel・learnings・content_playbooks を参照して自動生成
- `source='human'`：ダッシュボードからオーナーが手動投入

**使われ方**: Planner が次サイクルのコンテンツ計画時に参照 → Analyst が計測後に verdict 更新 → 複数回 confirmed → learnings へ昇格

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| cycle_id | INTEGER | FK→cycles.id, NULL可 | 生成されたサイクル |
| source | VARCHAR(10) | NOT NULL | 'ai'（エージェント生成）/ 'human'（ダッシュボード投入） |
| category | VARCHAR(30) | NOT NULL | 仮説カテゴリ（5種、下記参照） |
| statement | TEXT | NOT NULL | 検証可能な仮説文（具体的な数値目標を含む） |
| rationale | TEXT | NULL可 | 仮説の根拠（データ的根拠の説明） |
| target_accounts | VARCHAR(20)[] | NULL可 | 検証対象アカウント群（例：{'ACC_0013', 'ACC_0015'}） |
| predicted_kpis | JSONB | NULL可 | 予測 KPI（例：{"views": 5000, "engagement_rate": 0.05}） |
| actual_kpis | JSONB | NULL可 | 実測 KPI（計測完了後に Analyst が更新） |
| verdict | VARCHAR(20) | NOT NULL | pending / confirmed / rejected / inconclusive |
| confidence | NUMERIC(3,2) | NOT NULL | 確信度 0.00〜1.00（デフォルト 0.00） |
| evidence_count | INTEGER | NOT NULL | 検証に使われたコンテンツ数（デフォルト 0） |
| embedding | vector(1536) | NULL可 | statement のベクトル埋め込み（類似仮説検索・重複防止用） |
| created_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### category の 5 分類と仮説例

| category | 意味 | 仮説例 |
|---------|------|--------|
| content_format | コンテンツ形式に関する仮説 | 「リアクション動画は vlog 形式より完視聴率が 20% 高い」 |
| timing | 投稿タイミングに関する仮説 | 「ペットニッチで朝 7 時投稿は夜投稿より 30% 高いエンゲージメント」 |
| niche | ジャンルに関する仮説 | 「tech×美容クロスオーバーコンテンツは単独ニッチより反応が良い」 |
| audience | オーディエンスに関する仮説 | 「Z 世代向けでは CTA の直接的な呼びかけが効果的」 |
| platform_specific | プラットフォーム固有の仮説 | 「TikTok では最初の 1 秒にテキストオーバーレイがあると離脱率が下がる」 |

#### verdict 遷移フロー

```
新規立案 → verdict = 'pending'
    ↓ 計測後（Analyst が verify_hypothesis を実行）
    ├── predicted vs actual の誤差が閾値内 → 'confirmed'（confidence 上昇）
    ├── 仮説が明確に棄却 → 'rejected'
    └── データ不足で判定不能 → 'inconclusive'
```

#### Embedding 設計

ベクトル化ソース：`statement` フィールド

用途：類似仮説の検索・重複仮説の防止（Planner が新仮説生成前に既存仮説と類似度チェック）

### analyses — 分析結果

**概要**: Analyst エージェントがサイクル終了時・計測完了時に生成する分析レポートのテーブル。4 種類の分析タイプがあり、それぞれ `findings` の構造が異なる。ダッシュボードの分析パネルに表示され、Strategist の次サイクル方針にも影響する。

**データ取得元**: metrics テーブル・hypotheses テーブル・market_intel テーブルをもとに Analyst が生成

**使われ方**: Strategist がサイクルレビュー時に参照 → ダッシュボードでオーナーが確認 → Planner が次サイクルの方針決定に活用

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| cycle_id | INTEGER | FK→cycles.id, NULL可 | 分析実行サイクル |
| analysis_type | VARCHAR(30) | NOT NULL | 分析タイプ（4種、下記参照） |
| findings | JSONB | NOT NULL | 発見事項（analysis_type 別の構造） |
| recommendations | JSONB | NULL可 | 推奨アクション配列 |
| affected_hypotheses | INTEGER[] | NULL可 | 影響を受けた仮説の ID 配列 |
| created_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### analysis_type の 4 分類

**1. cycle_review — サイクル全体のレビュー**

発生タイミング：サイクル終了時（全計測完了後）

findings 構造：

| フィールド | 説明 |
|-----------|------|
| total_contents_produced | 生産コンテンツ数 |
| total_contents_posted | 投稿完了コンテンツ数 |
| hypotheses_tested | 検証した仮説数 |
| hypotheses_confirmed | confirmed 数 |
| hypotheses_rejected | rejected 数 |
| hypotheses_inconclusive | inconclusive 数 |
| accuracy_rate | 仮説的中率（confirmed / (confirmed + rejected)） |
| top_performing_niche | 最もパフォーマンスの良いニッチ |
| worst_performing_niche | 最もパフォーマンスの悪いニッチ |
| avg_engagement_rate | 全投稿の平均エンゲージメント率 |
| notable_anomalies | 注目すべき異常値の配列 |

**2. hypothesis_verification — 個別仮説の検証**

発生タイミング：48h 計測完了後（Analyst の verify_hypothesis 実行時）

findings 構造：

| フィールド | 説明 |
|-----------|------|
| hypothesis_id | 検証した仮説の ID |
| verdict | confirmed / rejected / inconclusive |
| confidence | 判定の確信度 |
| comparison | 予測 vs 実測の比較説明（自然言語） |
| evidence_count | 検証に使ったコンテンツ数 |

**3. anomaly_detection — 異常値の検出**

発生タイミング：計測完了時（統計的に 2σ 以上の逸脱を検出）

findings 構造：

| フィールド | 説明 |
|-----------|------|
| account_id | 異常が検出されたアカウント |
| metric | 異常が発生したメトリクス（views / engagement_rate 等） |
| anomaly_type | sudden_drop / sudden_spike / persistent_decline 等 |
| percent_change | 変化率（マイナス = 減少） |
| likely_cause | 推定原因（自然言語） |

**4. trend_analysis — トレンド分析**

発生タイミング：オンデマンド（Strategist または Planner からのリクエスト）

findings 構造：

| フィールド | 説明 |
|-----------|------|
| trend_name | 分析対象トレンド名 |
| phase | emerging / peak / peak_passed / declining / dead |
| related_content_views_trend | 関連コンテンツの再生数推移方向 |

### learnings — 蓄積知見（共有）

**概要**: 複数の analyses・content_learnings から抽出された、再利用可能な「チーム共有知見ライブラリ」。Analyst が extract_learning で登録し、Planner が仮説立案時に search_similar_learnings で参照する。仮説が繰り返し confirmed になると confidence が上昇し、システム全体の判断精度が高まる。

**データ取得元**: Analyst が content_learnings・analyses を基に知見を抽出・昇格して INSERT

**使われ方**: Planner が新仮説立案前に `search_similar_learnings`（pgvector 検索）で類似知見を検索 → 過去の成功・失敗パターンを仮説に組み込む

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| category | VARCHAR(20) | NOT NULL | 知見カテゴリ（5種、下記参照） |
| insight | TEXT | NOT NULL | 学習内容（具体的な数値を含む自然言語） |
| confidence | NUMERIC(3,2) | NOT NULL | 信頼度 0.00〜1.00（デフォルト 0.50） |
| evidence_count | INTEGER | NOT NULL | 根拠データポイント数（デフォルト 0） |
| source_analyses | INTEGER[] | NULL可 | 根拠となった analyses.id の配列 |
| applicable_niches | VARCHAR(50)[] | NULL可 | 適用可能なニッチ配列（NULL = 全ニッチ共通） |
| applicable_platforms | VARCHAR(20)[] | NULL可 | 適用可能なプラットフォーム配列（NULL = 全プラ共通） |
| embedding | vector(1536) | NULL可 | insight のベクトル埋め込み（類似知見検索用） |
| created_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### category の 5 分類と知見例

| category | 意味 | 知見例 |
|---------|------|--------|
| content | コンテンツ制作に関する知見 | 「リアクション形式の Hook は静的な自己紹介より完視聴率が 1.8 倍」 |
| timing | 投稿タイミングに関する知見 | 「ペットニッチでは朝 7 時投稿がエンゲージメント率 1.5 倍」 |
| audience | オーディエンスに関する知見 | 「Z 世代向けでは 3 秒以内にインパクトがないと 80% が離脱」 |
| platform | プラットフォーム固有の知見 | 「TikTok では縦テキストオーバーレイが views 1.2 倍」 |
| niche | ジャンル固有の知見 | 「beauty×tech クロスオーバーは単独 niche より反応が 30% 良い」 |

#### 信頼度ガイドライン

| 信頼度範囲 | 扱い |
|-----------|------|
| 0.80 以上 | 高信頼。Planner が積極的に適用 |
| 0.50〜0.79 | 中信頼。参考情報として使用 |
| 0.50 未満 | 低信頼。追加検証が必要 |

#### Embedding 設計

ベクトル化ソース：`insight` フィールドのみ

pgvector インデックス：IVFFlat（lists=100、〜15,000 件規模、INSERT 頻度を重視）

検索ツール：`search_similar_learnings`（min_confidence フィルタ付き）

### content_learnings — コンテンツ単位学習

**概要**: 1 投稿ごとに生成されるマイクロサイクル学習レコード。投稿後 48h の計測完了時に Analyst が生成し、7d 計測後に累積分析結果（5 テーブルの pgvector 検索結果 + AI 解釈）が追記される。スケール時は 1 日 3,000+ 件が生成されるため、pgvector HNSW で高速検索に対応している。

**データ取得元**: metrics テーブル（計測値）・hypotheses テーブル（予測値）・Analyst による要因分析

**使われ方**: Planner が次のコンテンツ計画時に `search_content_learnings`（pgvector 検索）で「同じニッチの過去コンテンツの成功・失敗パターン」を検索して仮説立案に活用

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | gen_random_uuid() |
| content_id | VARCHAR(20) | NOT NULL, FK→content | 対象コンテンツ |
| hypothesis_id | INTEGER | NULL可, FK→hypotheses | 紐づく仮説 |
| predicted_kpis | JSONB | NOT NULL | 予測 KPI（{"views": 5000, "engagement_rate": 0.05}） |
| actual_kpis | JSONB | NOT NULL | 実測 KPI（{"views": 4800, "engagement_rate": 0.0598, ...}） |
| prediction_error | FLOAT | NOT NULL | \|predicted - actual\| / actual（主要 KPI 平均） |
| micro_verdict | VARCHAR(20) | NOT NULL | confirmed / inconclusive / rejected |
| contributing_factors | TEXT[] | NULL可 | 成功に寄与した要因（例：{'朝 7 時投稿タイミング', 'question 型 Hook'}） |
| detractors | TEXT[] | NULL可 | マイナス要因（例：{'BGM 音量バランスが大きすぎる'}） |
| what_worked | TEXT[] | NULL可 | 効果があった点（定量データ付き） |
| what_didnt_work | TEXT[] | NULL可 | 効果がなかった点（定量データ付き） |
| key_insight | TEXT | NULL可 | このコンテンツから得られた最重要知見（1 文） |
| applicable_to | TEXT[] | NULL可 | クロスニッチ適用可能性（ニッチ名の配列） |
| confidence | FLOAT | NOT NULL | 学習の信頼度 0.0〜1.0（デフォルト 0.5） |
| cumulative_context | JSONB | NULL可 | 7d 計測後の累積分析結果（下記参照） |
| promoted_to_learning_id | UUID | NULL可 | learnings テーブルへの昇格先 ID |
| similar_past_learnings_referenced | INTEGER | NOT NULL | マイクロ分析時に参照した過去学習の数 |
| embedding | vector(1536) | NULL可 | key_insight + contributing_factors + what_worked の結合 embedding |
| niche | VARCHAR(50) | NULL可 | このコンテンツのニッチ（検索フィルタ用） |
| created_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### cumulative_context の内部構造（7d 計測後に追記）

```json
{
  "structured": {
    "search_meta": {
      "query_embedding_source": "content_id",
      "total_results": 38,
      "searched_at": "2026-03-11T15:30:00Z"
    },
    "by_source": {
      "hypotheses": {
        "count": 8,
        "confirmed": 5,
        "rejected": 2,
        "inconclusive": 1,
        "avg_similarity": 0.84
      },
      "content_learnings": {
        "count": 10,
        "confirmed": 6,
        "rejected": 3,
        "inconclusive": 1,
        "avg_prediction_error": 0.18,
        "avg_similarity": 0.81
      },
      "learnings": {
        "count": 8,
        "avg_confidence": 0.82,
        "avg_similarity": 0.78
      },
      "research_data": {
        "count": 7,
        "avg_age_days": 12,
        "avg_similarity": 0.76
      },
      "agent_learnings": {
        "count": 5,
        "avg_confidence": 0.75,
        "avg_similarity": 0.73
      }
    },
    "patterns": {
      "similar_content_success_rate": 0.6,
      "similar_hypothesis_success_rate": 0.625,
      "avg_prediction_error_of_similar": 0.18,
      "top_contributing_factors": [
        {"factor": "hook_type:question", "frequency": 7}
      ],
      "top_detractors": [
        {"factor": "content_length:over_60s", "frequency": 4}
      ]
    }
  },
  "ai_interpretation": "このコンテンツは同ニッチ類似投稿の平均より 18% 高い予測精度で...",
  "recommendations": [
    "question 型 Hook を継続採用",
    "BGM 音量は -3dB に調整"
  ],
  "analyzed_at": "2026-03-11T16:00:00Z"
}
```

#### Embedding 設計

ベクトル化ソース：`key_insight + contributing_factors + what_worked` を結合

ベクトル化タイミング：7d 計測後の累積分析（cumulative-analysis.ts）時に生成

pgvector インデックス：HNSW（10,000 件超で IVFFlat への移行を検討）

#### インデックス

| インデックス | 用途 |
|------------|------|
| (niche) | ニッチ別フィルタ |
| (micro_verdict) | verdict 別集計 |
| (created_at) | 日次集計 |
| HNSW (embedding) | pgvector ベクトル検索 |

### agent_individual_learnings — エージェント個別学習

**概要**: 各エージェント専用の個人的な学習メモリ。社員が自分専用のノートに業務で学んだことを記録するように、各エージェントが経験から得た知見を自律的に蓄積する。`learnings` テーブル（チーム共有）とは異なり、エージェント固有の作業ノウハウ（ツールの癖・データソースの特性・失敗パターン等）が保存される。

**データ取得元**: 各エージェントが自身の実行プロセス中に `save_individual_learning` MCP ツールで自律的に記録

**使われ方**: 各エージェントが次回実行時に `search_agent_learnings`（pgvector）で過去の類似学習を検索し、同じ失敗を繰り返さないようにする

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | gen_random_uuid() |
| agent_type | TEXT | NOT NULL | エージェント種別（6 種） |
| category | TEXT | NOT NULL | 学びカテゴリ（17 分類） |
| content | TEXT | NOT NULL | 学んだ内容の本文（具体的・再利用可能な形式） |
| context | TEXT | NULL可 | この学びが得られた状況の説明 |
| confidence | FLOAT | NOT NULL | 確信度 0.0〜1.0（デフォルト 0.5） |
| times_applied | INTEGER | NOT NULL | 参照・適用された回数（デフォルト 0） |
| times_successful | INTEGER | NOT NULL | 適用して成功した回数（デフォルト 0） |
| success_rate | FLOAT | GENERATED STORED | times_successful / times_applied（自動計算） |
| is_active | BOOLEAN | NOT NULL | 有効フラグ（confidence < 0.2 で自動 false） |
| source_reflection_id | UUID | NULL可 | 生成元の agent_reflections.id |
| embedding | vector(1536) | NULL可 | content のベクトル埋め込み |
| created_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |
| last_applied_at | TIMESTAMPTZ | NULL可 | 最後に参照・適用された日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### agent_type の 6 分類

| agent_type | 対応エージェント |
|-----------|----------------|
| strategist | 戦略エージェント（社長） |
| researcher | リサーチャー |
| analyst | アナリスト |
| planner | プランナー |
| tool_specialist | ツールスペシャリスト |
| data_curator | データキュレーター |

#### category の 17 分類

**市場・リサーチ系（Researcher・Analyst 主）**

| category | 意味 | 学習例 |
|---------|------|--------|
| data_source | データソースの特性・信頼性 | 「TikTok Creative Center のトレンドデータは 24h 遅延がある」 |
| pattern | 発見したパターン | 「beauty ニッチでは月曜の engagement が他曜日より 15% 低い傾向」 |
| insight | その他の気づき | 「人間の hypothesis 指示は表面的な記述が多いので背景を推測して補完すべき」 |
| source_reliability | 情報源の信頼性 | 「Brave Search は JP 地域のニッチトレンドに弱い、X の検索も合わせて使う」 |

**分析・仮説系（Analyst・Planner 主）**

| category | 意味 | 学習例 |
|---------|------|--------|
| technique | 実践テクニック | 「仮説生成時に pgvector 類似度 0.85 以上の既存仮説があれば重複を避ける」 |
| mistake | 失敗から学んだこと | 「サンプル数 3 件で仮説を confirmed にしたが、追加データで覆った」 |
| data_classification | データ分類に関する知見 | 「comment_sentiment は直近 7 日以内のみ有効、古いデータは歪む」 |

**ツール制作系（Tool Specialist 主）**

| category | 意味 | 学習例 |
|---------|------|--------|
| tool_characteristics | ツール固有の特性・挙動 | 「Kling v2.6 はアジア人の顔が最も自然、西洋人顔は時々不自然」 |
| tool_combination | ツール組み合わせの知見 | 「Fish Audio TTS → fal lipsync の組み合わせで口の動きの自然さが最高」 |
| tool_failure_pattern | ツール障害パターン | 「fal.ai 403 は残高不足、422 はパラメータ不正（prompt 空文字等）」 |
| tool_update | ツール更新・変更に関する知見 | 「Kling v2.6→v2.7 で character_orientation パラメータが必須に」 |

**キュレーター系（Data Curator 主）**

| category | 意味 | 学習例 |
|---------|------|--------|
| curation_quality | キュレーション品質に関する知見 | 「scenario_prompt が 50 文字以下だと映像のディテールが不足する」 |

**汎用（全エージェント）**

| category | 意味 |
|---------|------|
| content | コンテンツ制作全般の学び |
| timing | 投稿タイミングの学び |
| audience | オーディエンスの学び |
| platform | プラットフォーム固有の学び |
| niche | ジャンル固有の学び |

#### Embedding 設計

ベクトル化ソース：`content` フィールドのみ

pgvector インデックス：HNSW（〜2,000 件規模）

### components — 制作コンポーネント管理

**概要**: AI 動画制作に使用する全素材（シナリオ・モーション・オーディオ・画像）を統合管理するテーブル。Data Curator エージェントが市場情報・競合分析を基に自動生成し、必要に応じて人間がレビュー・承認する。Planner が `search_components` で素材を検索し、コンテンツ制作計画に組み込む。

**データ取得元**:
- `curated_by='auto'`：Data Curator エージェントが market_intel を基に自動生成
- `curated_by='human'`：オーナーがダッシュボードから手動登録

**使われ方**: Planner が `search_components` でニッチ・タイプ・タグを条件に素材を検索 → content テーブルの `component_ids` に格納 → Production Worker が参照して動画生成

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| component_id | VARCHAR(30) | NOT NULL | SCN_0001 / MOT_0001 等（種別ごとの体系） |
| type | VARCHAR(20) | NOT NULL | scenario / motion / audio / image |
| subtype | VARCHAR(30) | NULL可 | hook / body / cta 等の用途分類（自由タグ） |
| name | VARCHAR(200) | NOT NULL | コンポーネント名 |
| description | TEXT | NULL可 | コンポーネントの説明 |
| data | JSONB | NULL可 | 種別固有データ（下記参照） |
| drive_file_id | VARCHAR(100) | NULL可 | Google Drive ファイル ID（音声・画像ファイル） |
| niche | VARCHAR(50) | NULL可 | beauty / tech / fitness 等 |
| tags | TEXT[] | NULL可 | 自由タグ配列（例：{'skincare', 'morning_routine'}） |
| score | NUMERIC(5,2) | NULL可 | パフォーマンススコア 0.00〜100.00 |
| usage_count | INTEGER | NOT NULL | 使用回数（デフォルト 0） |
| curated_by | VARCHAR(20) | NOT NULL | auto / human（デフォルト 'human'） |
| curation_confidence | DECIMAL(3,2) | NULL可 | キュレーターの自信度 0.00〜1.00（auto 時のみ） |
| review_status | VARCHAR(20) | NOT NULL | auto_approved / pending_review / human_approved |
| created_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### type 別の data 内部構造

**scenario（シナリオ）**

| フィールド | 説明 |
|-----------|------|
| script_en | 英語台本（TTS 用） |
| script_jp | 日本語台本 |
| scenario_prompt | 映像生成 AI へのプロンプト（Kling 等） |
| duration_seconds | 想定尺（秒） |
| emotion | 感情トーン（excited / calm / serious 等） |
| camera_angle | カメラアングル（close-up / wide / medium 等） |

**motion（モーション）**

| フィールド | 説明 |
|-----------|------|
| duration_seconds | 尺（秒） |
| motion_type | talking_head / b_roll / reaction 等 |
| character_orientation | front / side / 45deg 等 |
| movement | subtle_nod / hand_gesture 等 |

**audio（オーディオ）**

| フィールド | 説明 |
|-----------|------|
| duration_seconds | 尺（秒） |
| genre | upbeat_pop / lo_fi / dramatic / ambient 等 |
| bpm | テンポ（BPM） |
| license | royalty_free / cc0 等 |

**image（画像）**

| フィールド | 説明 |
|-----------|------|
| dimensions | 解像度（例：1920x1080） |
| background_type | gradient / solid / transparent 等 |
| color_scheme | pastel / vibrant / dark 等 |

#### インデックス

| インデックス | 用途 |
|------------|------|
| (niche) | ニッチ別フィルタ |
| (type) | 種別別フィルタ |
| GIN(tags) | タグ検索（全文一致） |

### content_playbooks — 制作 Playbook

**概要**: コンテンツ制作のノウハウを Markdown 形式でまとめた再利用可能な Playbook のテーブル。Planner エージェントが `search_playbooks`（pgvector セマンティック検索）でニッチ・フォーマット・プラットフォームに合った Playbook を検索し、コンテンツ計画に組み込む。初期シードとして人間（`created_by='human'`）が手動登録した Playbook が投入される。

**データ取得元**:
- `created_by='human'`：オーナー・チームメンバーが手動作成（ダッシュボードまたは直接 INSERT）
- `created_by='agent'`：Analyst または Tool Specialist が `save_playbook` MCP ツールで自動生成

**使われ方**:
1. Planner が `search_playbooks` で「beauty × short_video × tiktok」等でセマンティック検索
2. 検索結果の `markdown_content` をコンテキストとして参照
3. 仮説立案・Hook 設計・シナリオ構成に活用
4. Analyst が `update_playbook_effectiveness` で実績スコアを更新

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| playbook_name | TEXT | NOT NULL, UNIQUE | Playbook 名（一意） |
| content_type | TEXT | NOT NULL | コンテンツ種別（例：short_video_ai_influencer, product_review） |
| content_format | TEXT | NOT NULL | short_video / text_post / image_post |
| niche | TEXT | NULL可 | ニッチカテゴリ（例：beauty, tech, fitness） |
| platform | TEXT | NULL可 | 対象プラットフォーム（NULL = 全プラットフォーム共通） |
| markdown_content | TEXT | NULL可 | Playbook の全文（Markdown 形式） |
| embedding | vector(1536) | NULL可 | markdown_content のベクトル埋め込み |
| avg_effectiveness_score | NUMERIC(4,2) | NULL可 | 有効性スコア（平均）0.00〜100.00 |
| times_used | INTEGER | NULL可 | 使用回数 |
| created_by | TEXT | NULL可 | 'human' / 'agent' |
| created_at | TIMESTAMPTZ | NULL可 | デフォルト NOW() |
| updated_at | TIMESTAMPTZ | NULL可 | デフォルト NOW() |

#### Embedding 設計

ベクトル化ソース：`markdown_content` 全文

ベクトル化タイミング：`save_playbook` MCP ツール実行時（保存と同時に即時生成）

pgvector インデックス：HNSW

### algorithm_performance — アルゴリズム精度追跡

**概要**: システム全体の「学習能力」を定量的に追跡するテーブル。仮説的中率・予測誤差・知見蓄積数・改善率を日次 / 週次 / 月次で記録し、ダッシュボードの精度パネルに表示する。システムが「自律的に賢くなっているか」を可視化する KPI テーブル。

**データ取得元**: Analyst がサイクルレビュー時に metrics / hypotheses / learnings テーブルを集計して INSERT

**使われ方**: ダッシュボードの精度パネル・Strategist の長期戦略判断・オーナーへの進捗報告

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| measured_at | TIMESTAMPTZ | NOT NULL | 精度データが記録された日時（デフォルト NOW()） |
| period | VARCHAR(10) | NOT NULL | daily / weekly / monthly |
| hypothesis_accuracy | NUMERIC(5,4) | NULL可 | 仮説的中率 0.0000〜1.0000（confirmed÷(confirmed+rejected)） |
| prediction_error | NUMERIC(8,4) | NULL可 | 予測と実測の平均誤差（RMSE） |
| learning_count | INTEGER | NULL可 | 累計蓄積知見数（learnings テーブルの COUNT） |
| improvement_rate | NUMERIC(5,4) | NULL可 | 前期比改善率（正 = 改善、負 = 悪化） |
| top_performing_niches | JSONB | NULL可 | ニッチ別パフォーマンスランキング |
| metadata | JSONB | NULL可 | その他メタデータ |

#### top_performing_niches の構造

```json
[
  {"niche": "beauty", "avg_engagement_rate": 0.052, "rank": 1},
  {"niche": "pet",    "avg_engagement_rate": 0.048, "rank": 2},
  {"niche": "tech",   "avg_engagement_rate": 0.031, "rank": 3}
]
```

#### metadata の構造

```json
{
  "total_hypotheses_tested": 120,
  "total_contents_produced": 850,
  "total_accounts_active": 45,
  "avg_production_time_seconds": 680,
  "cost_per_content_usd": 1.15
}
```

#### 精度成長目標

| 時期 | hypothesis_accuracy 目標 |
|-----|-------------------------|
| 初期（0〜1 ヶ月） | 0.25〜0.30 |
| 3 ヶ月後 | 0.45〜0.50 |
| 6 ヶ月後 | 0.60〜0.65 |

### prediction_snapshots — 予測スナップショット

**概要**: 投稿単位の「予測 vs 実績」比較レコード。投稿時点でのベースライン・9 補正係数・予測値を全てスナップショットとして固定保存し、事後検証を可能にする。「なぜこの投稿の予測が外れたか」の原因分析に使用。

**データ取得元**: 投稿完了時に Analyst（G5 ワークフロー）が prediction_snapshots に INSERT → 計測完了後に actual_impressions_XXh を UPDATE

**使われ方**: Analyst が `get_content_prediction` で予測詳細を取得 → 誤差原因分析 → `run_weight_recalculation` でウェイト再計算の入力データ

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| publication_id | INTEGER | NOT NULL, UNIQUE, FK→publications | 対象投稿（1 対 1） |
| content_id | VARCHAR(20) | NOT NULL, FK→content | 対象コンテンツ |
| account_id | VARCHAR(20) | NOT NULL, FK→accounts | 投稿先アカウント |
| hypothesis_id | INTEGER | NULL可, FK→hypotheses | 関連仮説 |
| baseline_used | FLOAT | NOT NULL | 予測時に使用したベースライン値（固定・不変） |
| baseline_source | VARCHAR(20) | NOT NULL | own_history / cohort / default |
| adjustments_applied | JSONB | NOT NULL | 9 要素の補正係数詳細（下記参照） |
| total_adjustment | FLOAT | NOT NULL | Σ(weight_i × adjustment_i) の合計値 |
| predicted_impressions | FLOAT | NOT NULL | baseline_used × (1 + total_adjustment) |
| actual_impressions_48h | INTEGER | NULL可 | 48h 計測の実績 |
| actual_impressions_7d | INTEGER | NULL可 | 7d 計測の実績（主要比較対象） |
| actual_impressions_30d | INTEGER | NULL可 | 30d 計測の最終確定値 |
| prediction_error_7d | FLOAT | NULL可 | \|predicted - actual_7d\| / actual_7d |
| prediction_error_30d | FLOAT | NULL可 | \|predicted - actual_30d\| / actual_30d |
| created_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### adjustments_applied の内部構造

9 要素それぞれの `value`（具体値）・`adjustment`（補正係数）・`weight`（重み）を保存：

```json
{
  "hook_type":              {"value": "question",      "adjustment": 0.12, "weight": 0.15},
  "content_length":         {"value": "30s",           "adjustment": -0.05, "weight": 0.08},
  "post_hour":              {"value": "07",            "adjustment": 0.08, "weight": 0.12},
  "post_weekday":           {"value": "1",             "adjustment": 0.03, "weight": 0.10},
  "niche":                  {"value": "beauty",        "adjustment": 0.15, "weight": 0.13},
  "narrative_structure":    {"value": "climactic",     "adjustment": 0.05, "weight": 0.11},
  "sound_bgm":              {"value": "trending_pop",  "adjustment": 0.10, "weight": 0.09},
  "hashtag_keyword":        {"value": "#skincare",     "adjustment": 0.07, "weight": 0.11},
  "cross_account_performance": {"value": "same_content", "adjustment": 0.20, "weight": 0.11}
}
```

補正係数のクリップ：個別 ±0.5 / 合計 −0.7〜+1.0 / 最終予測 baseline×0.3〜2.0

### account_baselines — ベースラインキャッシュ

**概要**: アカウント別の「期待インプレッション数（ベースライン）」をキャッシュするテーブル。日次バッチ（UTC 01:00）で全アクティブアカウントの値を UPSERT 更新する。予測生成時に毎回 SQL を実行せずこのキャッシュを参照することで高速化している。

**データ取得元**: Analyst の日次バッチ（`run_baseline_update`）が metrics テーブルを集計して算出

**使われ方**: Analyst が prediction_snapshots 生成時に `baseline_used` の値として使用

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| account_id | VARCHAR(20) | NOT NULL, UNIQUE, FK→accounts | アカウント（1 対 1） |
| baseline_impressions | FLOAT | NOT NULL | ベースライン値（期待インプレッション数） |
| source | VARCHAR(20) | NOT NULL | own_history / cohort / default |
| sample_count | INTEGER | NOT NULL | 算出に使用したサンプル数 |
| window_start | DATE | NOT NULL | 使用したデータの開始日 |
| window_end | DATE | NOT NULL | 使用したデータの終了日 |
| calculated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### source の算出ロジック（フォールバックチェーン）

```
1. own_history（直近 14 日）
   条件：自アカウントの 7d 計測データが 3 件以上
   計算：7d メトリクスの平均インプレッション数
        ↓ 不足の場合
2. cohort（同条件コホート）
   フォールバック順序：
     platform × niche × age_bucket（0-30d / 31-60d / 61-90d / 91-180d / 181-365d / 366d+）
       → COUNT < 3 なら platform × niche
       → COUNT < 3 なら platform 全体
        ↓ 全て不足の場合
3. default
   system_settings の BASELINE_DEFAULT_IMPRESSIONS（デフォルト: 500）
```

### adjustment_factor_cache — 補正係数キャッシュ

**概要**: 予測精度向上のための 8 要素補正係数をキャッシュするテーブル。「朝 7 時投稿は平均より何% 高いか」「question 型 Hook は何% 高いか」を実績データから算出してキャッシュし、予測計算を高速化する。tier 別バッチ（UTC 02:00）で更新。

**データ取得元**: Analyst の tier 別バッチ（`run_adjustment_cache_update`）が metrics × prediction_snapshots を JOIN して算出

**使われ方**: Analyst が prediction_snapshots 生成時に `adjustments_applied` の `adjustment` 値として使用

#### カラム定義

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 主キー |
| platform | VARCHAR(20) | NOT NULL | 対象プラットフォーム |
| factor_name | VARCHAR(50) | NOT NULL | 補正係数要素名（8 種） |
| factor_value | VARCHAR(100) | NOT NULL | 要素の具体値 |
| adjustment | FLOAT | NOT NULL | 補正係数値 = AVG(actual / baseline_used − 1.0) |
| sample_count | INTEGER | NOT NULL | 算出に使用したサンプル数 |
| is_active | BOOLEAN | NOT NULL | sample_count < 5 で FALSE（予測に使用しない） |
| calculated_at | TIMESTAMPTZ | NOT NULL | デフォルト NOW() |

#### factor_name の 8 分類と factor_value の具体値

| factor_name | factor_value の選択肢 | 意味 |
|------------|---------------------|------|
| hook_type | question / reaction / statement / story / demonstration / shock / mystery | 冒頭フック手法 |
| content_length | 0-15s / 16-30s / 31-60s / 60s+ | 動画尺 |
| post_hour | 00-05 / 06-08 / 09-11 / 12-14 / 15-17 / 18-20 / 21-23 | 投稿時間帯 |
| post_weekday | 0〜6（Sunday=0） | 投稿曜日 |
| niche | beauty / fitness / cooking / tech 等 | ジャンル |
| narrative_structure | linear / parallel / climactic / circular / listicle | ナラティブ構成 |
| sound_bgm | trending_pop / lo_fi / dramatic / ambient / none / original | BGM・音楽 |
| hashtag_keyword | 個別タグ文字列（例："#skincare"） | ハッシュタグ |

#### 補正係数の計算式

```sql
-- 基本計算
SELECT
  factor_name,
  factor_value,
  AVG(m.value / ps.baseline_used - 1.0) AS adjustment,
  COUNT(*) AS sample_count
FROM metrics m
JOIN prediction_snapshots ps ON m.publication_id = ps.publication_id
WHERE platform = $platform
  AND m.created_at > NOW() - INTERVAL '90 days'
  AND ps.baseline_used > 0
GROUP BY factor_name, factor_value
HAVING COUNT(*) >= 5

-- 個別クリップ
adjustment = GREATEST(-0.5, LEAST(0.5, adjustment))
```

#### バッチ更新スケジュール（tier 別）

| tier | metrics 件数 | 実行頻度 | 実行時刻（UTC） |
|-----|------------|---------|---------------|
| tier1 | 0〜500 | 週次（月曜） | 02:00 |
| tier2 | 500〜5K | 3 日ごと（月・木） | 02:00 |
| tier3 | 5K〜50K | 日次 | 02:00 |
| tier4 | 50K+ | 12 時間ごと | 02:00 + 14:00 |

## ベクトル化（Embedding）設計

### 使用モデル

`text-embedding-3-small`（OpenAI、1536 次元）

コスト：約 $0.02 / 1M トークン（Claude API コストに対して無視できるレベル）

代替候補：Voyage-3（Anthropic）

### テーブル別 Embedding 設計一覧

| テーブル | ベクトル化するフィールド | 生成タイミング | pgvector インデックス | 検索用途 |
|---------|----------------------|-------------|---------------------|---------|
| market_intel | title + summary（data 内容を結合） | 保存時（save_* MCP ツール内） | HNSW | 類似トレンド・競合情報の発見 |
| hypotheses | statement | 保存時（create_hypothesis 内） | — | 類似仮説検索・重複防止 |
| learnings | insight | 保存時（extract_learning 内） | IVFFlat（lists=100） | 類似知見検索・クラスタリング |
| content_learnings | key_insight + contributing_factors + what_worked を結合 | 7d 計測後の累積分析時（cumulative-analysis.ts） | HNSW（将来 IVFFlat へ） | 類似コンテンツ学習の検索 |
| components | metadata->>'description' + tags を結合 | 保存時（create_component 内） | IVFFlat（lists=100） | 素材の意味検索 |
| agent_individual_learnings | content | 保存時（save_individual_learning 内） | HNSW | エージェント個別学習の検索 |
| content_playbooks | markdown_content 全文 | 保存時（save_playbook 内） | HNSW | 制作ノウハウのセマンティック検索 |

### Embedding 生成の実装

全テーブルで共通の `generateEmbedding()` ユーティリティ関数を使用：

```typescript
// v5/src/mcp-server/utils/embedding.ts
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191), // モデルの max token 制限
    dimensions: 1536
  });
  return response.data[0].embedding;
}
```

生成タイミング：**Pre-insert**（書き込みと同時に即時生成。遅延生成なし）

### pgvector インデックス戦略

| テーブル | 件数規模 | インデックスタイプ | 理由 |
|---------|---------|----------------|------|
| learnings | 〜15,000 件 | IVFFlat（lists=100） | 大規模化見込み。INSERT 頻度を重視 |
| content_learnings | 最大 450,000 件（3,000/日 × 150 日） | HNSW → 将来 IVFFlat（lists=500） | 最大テーブル。INSERT + 検索の両立 |
| market_intel | 〜5,000 件 | HNSW | 中規模。10K 未満では IVFFlat は不適切 |
| agent_individual_learnings | 〜2,000 件 | HNSW | 中規模 |
| components | 〜10,000 件+ | IVFFlat（lists=100） | INSERT 頻度優先 |
| content_playbooks | 〜500 件 | HNSW | 小規模。高精度優先 |

## エージェント別データフロー詳細

### Researcher（リサーチャー）— 市場情報収集フロー

**トリガー**：6 時間ごと（system_settings: RESEARCHER_POLL_INTERVAL_HOURS）

**実行ステップ**：

```
1. WebSearch（Brave Search）/ WebFetch で外部情報取得
   ├── トレンドトピック収集：TikTok Creative Center, Google Trends, SNS 検索
   ├── 競合投稿収集：各プラットフォームの注目投稿
   ├── 競合アカウント情報収集：フォロワー数・投稿頻度・平均再生数
   ├── オーディエンスシグナル収集：コメント感情分析・検索クエリ
   └── プラットフォームアップデート収集：公式ブログ・SNS 告知

2. relevance_score を評価（0.00〜1.00）

3. generateEmbedding() でベクトル生成

4. market_intel テーブルに INSERT
   ├── intel_type で 5 分類
   ├── platform / niche でフィルタリング属性設定
   └── expires_at で有効期限設定

5. search_similar_intel で類似情報を確認（重複・更新チェック）

6. agent_individual_learnings に学んだこと（データソースの特性等）を記録
```

**参照 MCP ツール**（12 本）：save_trending_topic / save_competitor_post / save_competitor_account / save_audience_signal / save_platform_update / get_recent_intel / search_similar_intel / get_niche_trends / get_competitor_analysis / get_platform_changes / mark_intel_expired / get_intel_gaps

### Analyst（アナリスト）— 分析・学習抽出フロー

**トリガー**：計測完了後（METRICS_COLLECTION_DELAY_HOURS、デフォルト 48h）

**処理 1：単発分析（48h 計測後）**

```
1. get_metrics_for_analysis で計測値取得

2. 予測（prediction_snapshots）vs 実測（metrics）を比較

3. pgvector で過去の類似コンテンツ学習を検索
   → search_content_learnings（niche フィルタ付き）
   → search_similar_learnings（min_confidence=0.5）

4. create_micro_analysis で content_learnings に INSERT
   ├── micro_verdict（confirmed / inconclusive / rejected）
   ├── contributing_factors（成功要因の配列）
   ├── detractors（失敗要因の配列）
   ├── what_worked / what_didnt_work
   └── key_insight（最重要知見 1 文）

5. verify_hypothesis で hypothesis.verdict を更新
   → confirmed / rejected / inconclusive

6. confidence が高い場合 → extract_learning で learnings テーブルへ昇格
```

**処理 2：累積分析（7d 計測後）**

```
1. key_insight から embedding を生成

2. pgvector で 5 テーブルを同時検索
   ├── hypotheses（類似仮説）
   ├── content_learnings（類似コンテンツ学習）
   ├── learnings（共有知見）
   ├── market_intel（関連市場情報）
   └── agent_individual_learnings（エージェント学習）

3. 検索結果を構造化集計（by_source）

4. Claude Haiku で AI 解釈層を生成

5. content_learnings.cumulative_context に UPDATE

6. embedding を content_learnings に UPDATE
```

**処理 3：バッチジョブ（定期実行）**

| バッチ | 実行時刻（UTC） | 処理内容 |
|-------|--------------|---------|
| run_baseline_update | 毎日 01:00 | account_baselines の UPSERT |
| run_adjustment_cache_update | tier 別 02:00 | adjustment_factor_cache の UPSERT |
| run_weight_recalculation | tier 別 03:00 | 9 要素の prediction_weights 再計算（EMA α=0.3） |
| run_kpi_snapshot | 月末+1 日 04:00 | kpi_snapshots の INSERT |

### Data Curator（データキュレーター）— キュレーション・自動生成フロー

**トリガー**：task_queue（type='curate'）のポーリング

**処理ステップ**：

```
1. get_pending_curation_tasks でタスク取得

2. タスク種別に応じて処理：
   ├── trending_topic → シナリオコンポーネント自動生成
   ├── competitor_post → Hook テクニックを抽出してシナリオに転用
   ├── reference_content → 参考コンテンツ分析
   └── improvement → 既存コンポーネントの改善提案

3. search_similar_components で重複チェック（pgvector）

4. save_curated_component で components テーブルに INSERT
   ├── curated_by='auto'
   ├── curation_confidence 設定（0.00〜1.00）
   └── review_status：confidence > 0.8 なら 'auto_approved'、それ以外 'pending_review'

5. complete_curation_task でタスク完了マーク

6. キャラクター生成の場合：
   ├── create_character_profile で accounts テーブルの profile を UPDATE
   └── 画像生成 → drive_file_id を components テーブルに保存
```

### Planner（プランナー）— コンテンツ計画・仮説立案フロー

**トリガー**：Strategist からの plan_content 指示

**処理ステップ**：

```
1. 市場情報収集
   ├── get_niche_trends で担当ニッチのトレンド確認
   └── get_competitor_analysis で競合動向確認

2. 過去学習の参照
   ├── search_similar_learnings で共有知見を検索（confidence >= 0.5）
   ├── search_content_learnings で同ニッチの過去コンテンツ学習を検索
   └── search_playbooks で制作 Playbook をセマンティック検索

3. 仮説立案
   ├── create_hypothesis で新仮説を INSERT
   └── （事前に search_similar_hypotheses で重複確認）

4. コンテンツ計画
   ├── search_components で素材を検索
   ├── create_content で content テーブルに INSERT
   └── schedule_for_publishing で publication をスケジュール
```

## JSONB 内部スキーマリファレンス

### predicted_kpis / actual_kpis（hypotheses・content_learnings 共通）

```json
{
  "views": 5000,
  "likes": 250,
  "comments": 30,
  "shares": 50,
  "engagement_rate": 0.05,
  "completion_rate": 0.65
}
```

### analyses.recommendations

```json
[
  {
    "action": "increase_morning_posts",
    "rationale": "朝投稿の仮説が 3 回連続 confirmed",
    "priority": "high",
    "target_accounts": ["ACC_0013", "ACC_0015"]
  },
  {
    "action": "reduce_tech_content",
    "rationale": "tech ニッチの engagement_rate が全体平均の 60%",
    "priority": "medium"
  }
]
```

### algorithm_performance.top_performing_niches

```json
[
  {"niche": "beauty", "avg_engagement_rate": 0.052, "rank": 1},
  {"niche": "pet",    "avg_engagement_rate": 0.048, "rank": 2},
  {"niche": "tech",   "avg_engagement_rate": 0.031, "rank": 3}
]
```

### algorithm_performance.metadata

```json
{
  "total_hypotheses_tested": 120,
  "total_contents_produced": 850,
  "total_accounts_active": 45,
  "avg_production_time_seconds": 680,
  "cost_per_content_usd": 1.15
}
```
