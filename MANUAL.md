# AI-Influencer GASアナリティクス ユーザーマニュアル

> **バージョン**: 2.0.0
> **最終更新**: 2026-02-09
> **対象**: AI インフルエンサー動画制作チーム

---

## 目次

- [A. システム概要](#a-システム概要)
- [B. Google Drive データ構造](#b-google-drive-データ構造)
- [C. スプレッドシート詳細](#c-スプレッドシート詳細)
- [D. コンポーネント管理](#d-コンポーネント管理)
- [E. 動画制作ワークフロー](#e-動画制作ワークフロー)
- [F. CSV インポート](#f-csv-インポート)
- [G. 分析・KPI](#g-分析kpi)
- [H. AI推奨・承認フロー](#h-ai推奨承認フロー)
- [I. n8n/API連携](#i-n8napi連携)
- [J. GASメニュー操作](#j-gasメニュー操作)
- [K. トラブルシューティング](#k-トラブルシューティング)
- [L. 初期セットアップ](#l-初期セットアップ)

---

## A. システム概要

### AI-Influencer GASアナリティクス とは

AI-Influencer GASアナリティクスは、AI インフルエンサーの動画制作から分析・改善提案までの完全なライフサイクルを管理するシステムです。YouTube Shorts、TikTok、Instagram Reels の3プラットフォームに対応し、以下の機能を統合的に提供します。

- **コンポーネント管理**: 動画を構成する要素（シナリオ、モーション、キャラクター、オーディオ）をインベントリとして管理
- **動画制作ワークフロー**: 企画からプラットフォーム公開まで、ステータスベースの制作管理
- **マルチプラットフォーム分析**: 3プラットフォームのCSVデータを統一スキーマに正規化し、KPI比較と分析を実行
- **AI改善提案**: OpenAI (GPT-4o) を活用し、コンポーネント単位の改善提案と次回動画のコンポーネント推奨を自動生成
- **n8n連携**: Web APIを通じたワークフロー自動化

### 全体アーキテクチャ

```
+============================================================================+
|                              運用ループ全体像                                  |
+============================================================================+
|                                                                            |
|    1. PLAN:  インベントリからコンポーネントを選択 --> draft                      |
|    2. APPROVE: AIの推奨を確認し、人間が承認 --> approved                        |
|    3. CREATE: n8nがmaster+インベントリを読み取り動画生成 --> in_production       |
|    4. PUBLISH: 3プラットフォームにアップロード --> published                     |
|    5. IMPORT:  CSVエクスポート --> Google Drive --> GASが自動処理               |
|    6. ANALYZE: KPI比較 + OpenAI分析（コンポーネント情報付き） --> analyzed       |
|    7. SCORE:  コンポーネントのパフォーマンススコアを更新                          |
|    8. SUGGEST: AIが次の動画に最適なコンポーネントを推奨                          |
|           +----------> ステップ1に戻る                                        |
|                                                                            |
+============================================================================+
```

```
+-------------------------------------------------------------------+
|                         ユーザー操作                                  |
+-------------------------------------------------------------------+
|                                                                    |
|  [YouTube Studio]   [TikTok Analytics]   [IG Professional]        |
|       |                    |                    |                   |
|       v                    v                    v                   |
|  [CSV エクスポート]   [CSV エクスポート]   [CSV エクスポート]          |
|       |                    |                    |                   |
|       +--------------------+--------------------+                  |
|                            |                                       |
|                            v                                       |
|              [Google Drive CSV_Imports/ にアップロード]              |
|                                                                    |
|  [AI推奨を確認] --> [承認/却下] --> [n8nが動画生成を実行]            |
|                                                                    |
+-------------------------------------------------------------------+
                             |
                             v
+-------------------------------------------------------------------+
|                        n8n ワークフロー                               |
+-------------------------------------------------------------------+
|                                                                    |
|  [Drive Trigger] --> [Read CSV] --> [POST: import_csv]            |
|                                                                    |
|  [Schedule] --> [GET: get_approved] --> [GET: get_production]      |
|       |              |                       |                     |
|       |              v                       v                     |
|       |       [コンポーネント読取]      [動画生成 API]               |
|       |                                      |                     |
|       +--> [POST: analyze_all] --> [POST: update_scores]          |
|                                                                    |
+-------------------------------------------------------------------+
                             |
                             v
+-------------------------------------------------------------------+
|                Google Apps Script (GAS) v2.0                        |
+-------------------------------------------------------------------+
|                                                                    |
|  +----------+   +-----------+   +------------+                    |
|  | Code.gs  |   |CSVParser  |   | Normalizer |                    |
|  |(API端点) |-->|  .gs      |-->|    .gs      |                    |
|  +----------+   +-----------+   +------------+                    |
|       |                               |                            |
|       |  +----------------------------+                            |
|       |  v                                                         |
|  +----------+   +-----------+   +----------+                      |
|  |SheetWriter|<-|LLMAnalyzer|<--| Linker   |                      |
|  |    .gs   |   |   .gs     |   |   .gs    |                      |
|  +----------+   +-----------+   +----------+                      |
|       |               |               |                            |
|       |          +----+               |                            |
|       v          v                    v                            |
|  +----------+  +----------+  +--------------+                     |
|  |Component |  |  Score   |  |MasterManager |                     |
|  |Manager.gs|  |Updater.gs|  |     .gs      |                     |
|  +----------+  +----------+  +--------------+                     |
|       |              |              |                               |
|       v              v              v                               |
|  [インベントリ]  [マスター]   [Google Sheets]   [OpenAI API]       |
|  [スプレッドシート] [スプレッドシート]                                |
|                                                                    |
+-------------------------------------------------------------------+
```

### GAS ファイル構成

| ファイル | 役割 |
|---------|------|
| `Code.gs` | Web App エンドポイント (doGet/doPost) + UIメニュー定義 |
| `Config.gs` | 全設定値、シート名、列定義、コンポーネントID規則 |
| `Setup.gs` | ワンクリックセットアップ (Drive + Sheets + デモデータ) |
| `Migration.gs` | v1.0 から v2.0 へのマイグレーション |
| `CSVParser.gs` | プラットフォーム別CSVパーサー（列名エイリアス対応） |
| `Normalizer.gs` | 統一スキーマへの正規化変換 |
| `Linker.gs` | video_uid マッチング（完全一致 + ファジーマッチ） |
| `KPIEngine.gs` | KPI目標値との比較・スコア算出 |
| `LLMAnalyzer.gs` | OpenAI連携分析（コンポーネント情報付き） |
| `SheetWriter.gs` | Google Sheets 書き込み操作 |
| `ComponentManager.gs` | コンポーネントCRUD・コンテキスト構築 |
| `MasterManager.gs` | マスターシート操作・承認ワークフロー |
| `ScoreUpdater.gs` | コンポーネントパフォーマンススコア計算 |
| `Utils.gs` | ユーティリティ関数・ID生成 |

---

## B. Google Drive データ構造

### AI-Influencer フォルダの構造

システムセットアップ時に、以下のフォルダ構造が Google Drive 上に自動作成されます。ルートフォルダ `AI-Influencer` の下に、動画制作に必要な全てのアセットとデータが整理されます。

```
AI-Influencer/ (ルートフォルダ)
|
+-- [Spreadsheet] Master Spreadsheet  <-- GAS Bound Script がバインドされている
|     |-- [tab] master                <-- 1行 = 1動画制作
|     |-- [tab] metrics_youtube
|     |-- [tab] metrics_tiktok
|     |-- [tab] metrics_instagram
|     |-- [tab] kpi_targets
|     |-- [tab] analysis_reports
|     |-- [tab] recommendations
|     |-- [tab] video_analysis
|     +-- [tab] unlinked_imports
|
+-- Scenarios/
|   |-- [Spreadsheet] Scenarios Inventory  <-- 独立スプレッドシート
|   |-- Hooks/      <-- フックシナリオのアセットファイル
|   |-- Bodies/     <-- ボディシナリオのアセットファイル
|   +-- CTAs/       <-- CTAシナリオのアセットファイル
|
+-- Motions/
|   |-- [Spreadsheet] Motions Inventory  <-- 独立スプレッドシート
|   |-- Hooks/      <-- フックモーションのアセットファイル
|   |-- Bodies/     <-- ボディモーションのアセットファイル
|   +-- CTAs/       <-- CTAモーションのアセットファイル
|
+-- Characters/
|   |-- [Spreadsheet] Characters Inventory  <-- 独立スプレッドシート
|   +-- Images/     <-- キャラクター画像ファイル
|
+-- Audio/
|   |-- [Spreadsheet] Audio Inventory  <-- 独立スプレッドシート
|   |-- Voice/      <-- ボイスファイル
|   +-- BGM/        <-- BGMファイル
|
+-- Analytics/
    +-- CSV_Imports/
        |-- YouTube/    <-- YouTube CSV をここに配置
        |-- TikTok/     <-- TikTok CSV をここに配置
        +-- Instagram/  <-- Instagram CSV をここに配置
```

### 各フォルダの役割

| フォルダ | 役割 | 配置するファイル |
|---------|------|----------------|
| `Scenarios/` | シナリオ台本の管理 | テキストファイル、台本ドキュメント |
| `Scenarios/Hooks/` | フック（冒頭）部分の台本 | フック用台本ファイル |
| `Scenarios/Bodies/` | ボディ（本編）部分の台本 | ボディ用台本ファイル |
| `Scenarios/CTAs/` | CTA（行動喚起）部分の台本 | CTA用台本ファイル |
| `Motions/` | モーション（映像パターン）の管理 | モーションテンプレートファイル |
| `Motions/Hooks/` | フック用モーション | フック用映像パターンファイル |
| `Motions/Bodies/` | ボディ用モーション | ボディ用映像パターンファイル |
| `Motions/CTAs/` | CTA用モーション | CTA用映像パターンファイル |
| `Characters/` | キャラクターアセットの管理 | キャラクター設定ファイル |
| `Characters/Images/` | キャラクター画像 | PNG、JPG等の画像ファイル |
| `Audio/Voice/` | ボイスファイル | 音声ファイル（wav、mp3等） |
| `Audio/BGM/` | BGMファイル | BGM音楽ファイル |
| `Analytics/CSV_Imports/` | 各プラットフォームからエクスポートしたCSV | CSV ファイル |

### ファイルの配置規則

- **インベントリスプレッドシート**: 各コンポーネントフォルダ直下に1つ。`setupCompleteSystem()` 実行時に自動作成される
- **アセットファイル**: 対応するサブフォルダに配置し、インベントリの `file_link` 列にURLを記録
- **CSVファイル**: `Analytics/CSV_Imports/` 配下のプラットフォーム別フォルダに配置。ファイル名は自由だが、プラットフォーム名を含めると n8n の自動検出が容易になる（例: `youtube_20260209.csv`）

---

## C. スプレッドシート詳細

### master シート: 全42列の意味と使い方

master シートはシステムの中核であり、1行が1つの動画制作に対応します。全42列は以下のグループに分類されます。

#### Identity グループ (列1-4)

| # | 列名 | 型 | 説明 | 入力方法 |
|---|------|-----|------|---------|
| 1 | `video_uid` | String | 動画の一意識別子 | 自動生成 (`VID_YYYYMM_XXXX`) |
| 2 | `title` | String | 動画タイトル | 手動入力 |
| 3 | `status` | String | 制作ステータス | ドロップダウン選択 |
| 4 | `created_date` | DateTime | 作成日時 | 自動設定 (Asia/Tokyo) |

**status の選択肢と意味**:

| ステータス | 意味 | 背景色 |
|-----------|------|--------|
| `draft` | 企画中。コンポーネント選択中 | グレー (#E2E3E5) |
| `approved` | 人間が承認済み。制作待ち | 緑 (#D4EDDA) |
| `in_production` | n8n/外部ツールで動画生成中 | 青 (#CCE5FF) |
| `published` | 3プラットフォームに公開済み | 水色 (#D1ECF1) |
| `analyzed` | 分析完了 | 濃い緑 (#C3E6CB) |

#### Hook コンポーネント (列5-7)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 5 | `hook_scenario_id` | String | フック部分のシナリオID (例: `SCN_H_0001`) |
| 6 | `hook_motion_id` | String | フック部分のモーションID (例: `MOT_0001`) |
| 7 | `hook_audio_id` | String | フック部分のオーディオID (例: `AUD_0001`) |

#### Body コンポーネント (列8-10)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 8 | `body_scenario_id` | String | ボディ部分のシナリオID (例: `SCN_B_0001`) |
| 9 | `body_motion_id` | String | ボディ部分のモーションID (例: `MOT_0003`) |
| 10 | `body_audio_id` | String | ボディ部分のオーディオID (例: `AUD_0003`) |

#### CTA コンポーネント (列11-13)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 11 | `cta_scenario_id` | String | CTA部分のシナリオID (例: `SCN_C_0001`) |
| 12 | `cta_motion_id` | String | CTA部分のモーションID (例: `MOT_0005`) |
| 13 | `cta_audio_id` | String | CTA部分のオーディオID (例: `AUD_0001`) |

#### Character (列14)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 14 | `character_id` | String | キャラクターID (例: `CHR_0001`) |

#### Output (列15)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 15 | `completed_video_url` | String | 完成動画のURL（Drive/外部リンク） |

#### Platforms (列16-18)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 16 | `youtube_id` | String | YouTube上の動画ID |
| 17 | `tiktok_id` | String | TikTok上の動画ID |
| 18 | `instagram_id` | String | Instagram上のリールID |

これらのIDは、CSVインポート時の自動リンクに使用されます。

#### YouTube メトリクス (列19-21)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 19 | `yt_views` | Number | YouTube 総再生回数 |
| 20 | `yt_engagement` | Number | YouTube エンゲージメント率 (%) |
| 21 | `yt_completion` | Number | YouTube 完走率 (%) |

#### TikTok メトリクス (列22-24)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 22 | `tt_views` | Number | TikTok 総再生回数 |
| 23 | `tt_engagement` | Number | TikTok エンゲージメント率 (%) |
| 24 | `tt_completion` | Number | TikTok 完走率 (%) |

#### Instagram メトリクス (列25-27)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 25 | `ig_views` | Number | Instagram 総再生回数 |
| 26 | `ig_engagement` | Number | Instagram エンゲージメント率 (%) |
| 27 | `ig_reach` | Number | Instagram リーチ数 |

**注意**: 列19-27のメトリクスは、CSVインポート時に自動更新される「スナップショット」です。詳細なメトリクスデータは個別の `metrics_*` シートに保存されます。

#### Analysis (列28-30)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 28 | `overall_score` | Number | 総合KPIスコア (0-100) |
| 29 | `analysis_date` | DateTime | 最終分析日時 |
| 30 | `top_recommendations` | String | 上位3つの改善提案サマリー |

#### AI Next (列31-40) - AI推奨コンポーネント

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 31 | `ai_next_hook_scenario` | String | AI推奨: 次のフックシナリオID |
| 32 | `ai_next_hook_motion` | String | AI推奨: 次のフックモーションID |
| 33 | `ai_next_hook_audio` | String | AI推奨: 次のフックオーディオID |
| 34 | `ai_next_body_scenario` | String | AI推奨: 次のボディシナリオID |
| 35 | `ai_next_body_motion` | String | AI推奨: 次のボディモーションID |
| 36 | `ai_next_body_audio` | String | AI推奨: 次のボディオーディオID |
| 37 | `ai_next_cta_scenario` | String | AI推奨: 次のCTAシナリオID |
| 38 | `ai_next_cta_motion` | String | AI推奨: 次のCTAモーションID |
| 39 | `ai_next_cta_audio` | String | AI推奨: 次のCTAオーディオID |
| 40 | `ai_next_character` | String | AI推奨: 次のキャラクターID |

これらの列は、分析実行時にAIが過去のパフォーマンスデータを元に自動で書き込みます。

#### Approval (列41-42)

| # | 列名 | 型 | 説明 |
|---|------|-----|------|
| 41 | `human_approved` | Boolean | チェックボックス。人間による承認 |
| 42 | `approval_notes` | String | 承認時のメモ（任意） |

---

### metrics_youtube シート

YouTube のCSVインポートデータを蓄積するシートです。同じ動画の複数回インポートが可能で、時系列データが蓄積されます。

| 列名 | 型 | 説明 |
|------|-----|------|
| `video_uid` | String | master シートへの外部キー |
| `import_date` | DateTime | インポート日時 |
| `views` | Number | 総再生回数 |
| `likes` | Number | 高評価数 |
| `comments` | Number | コメント数 |
| `shares` | Number | 共有数 |
| `engagement_rate` | Number | エンゲージメント率 (小数: 0.043 = 4.3%) |
| `watch_time_hours` | Number | 総再生時間（時間） |
| `avg_watch_time_sec` | Number | 平均視聴時間（秒） |
| `completion_rate` | Number | 完走率 (小数: 0.45 = 45%) |
| `ctr` | Number | インプレッション クリック率 (小数) |
| `subscribers_gained` | Number | 獲得チャンネル登録者数 |

### metrics_tiktok シート

| 列名 | 型 | 説明 |
|------|-----|------|
| `video_uid` | String | master シートへの外部キー |
| `import_date` | DateTime | インポート日時 |
| `views` | Number | 総再生回数 |
| `likes` | Number | いいね数 |
| `comments` | Number | コメント数 |
| `shares` | Number | シェア数 |
| `engagement_rate` | Number | エンゲージメント率 (小数) |
| `saves` | Number | 保存数 |
| `avg_watch_time_sec` | Number | 平均視聴時間（秒） |
| `completion_rate` | Number | 完走率 (小数) |

### metrics_instagram シート

| 列名 | 型 | 説明 |
|------|-----|------|
| `video_uid` | String | master シートへの外部キー |
| `import_date` | DateTime | インポート日時 |
| `views` | Number | 総再生回数（Plays） |
| `likes` | Number | いいね数 |
| `comments` | Number | コメント数 |
| `shares` | Number | シェア数 |
| `engagement_rate` | Number | エンゲージメント率 (小数) |
| `saves` | Number | 保存数 |
| `avg_watch_time_sec` | Number | 平均視聴時間（秒） |
| `reach` | Number | リーチ数（ユニーク視聴者数） |

### kpi_targets シート

KPI目標値を管理するシートです。分析時にこの目標値と実績を比較してスコアが算出されます。

| 列名 | 型 | 説明 |
|------|-----|------|
| `platform` | String | プラットフォーム名 (`youtube`, `tiktok`, `instagram`) |
| `metric` | String | メトリクス名 (`completion_rate`, `engagement_rate`, `ctr` 等) |
| `target_value` | Number | 目標値 (小数: 0.5 = 50%) |
| `description` | String | 目標の説明文 |

**デフォルト値の例**:

| platform | metric | target_value | description |
|----------|--------|--------------|-------------|
| youtube | completion_rate | 0.5 | 50%の視聴者が最後まで見る |
| youtube | ctr | 0.05 | 5%のクリック率 |
| youtube | engagement_rate | 0.03 | 3%のエンゲージメント |
| tiktok | completion_rate | 0.4 | 40%が最後まで視聴 |
| tiktok | engagement_rate | 0.08 | 8%のエンゲージメント |
| tiktok | avg_watch_time_sec | 10 | 平均10秒視聴 |
| instagram | reach_rate | 0.3 | フォロワーの30%にリーチ |
| instagram | avg_watch_time_sec | 15 | 平均15秒視聴 |
| instagram | engagement_rate | 0.05 | 5%のエンゲージメント |

### analysis_reports シート

全体分析レポートが蓄積されるシートです。分析実行ごとに1行が追加されます。

| 列名 | 型 | 説明 |
|------|-----|------|
| `report_id` | String | レポートの一意ID (例: `RPT_20260209_153000_042`) |
| `generated_at` | DateTime | レポート生成日時 |
| `video_count` | Number | 分析対象の動画数 |
| `insights_json` | String | 分析結果のJSON文字列 |

**insights_json の読み方**:
insights_json には、AIが生成した分析インサイトの配列が含まれます。各インサイトには以下のフィールドがあります。

```json
{
  "insights": [
    {
      "category": "trend",
      "insight": "TikTokでのエンゲージメントが継続的に上昇している",
      "confidence": "high",
      "impact": "high"
    },
    {
      "category": "component_insight",
      "insight": "SCN_H_0001のフックが他のフックより20%高いCTRを記録",
      "confidence": "medium",
      "impact": "high"
    }
  ]
}
```

**category の種類**: `trend`(トレンド), `pattern`(パターン), `strength`(強み), `weakness`(弱み), `opportunity`(機会), `component_insight`(コンポーネント分析), `improvement_from_previous`(前回比改善)

### recommendations シート

AIが生成した改善提案が蓄積されるシートです。

| 列名 | 型 | 説明 | 選択肢 |
|------|-----|------|--------|
| `video_uid` | String | 対象動画 (`all` = 全体向け) | - |
| `created_at` | DateTime | 作成日時 | - |
| `priority` | String | 優先度 (1が最高) | `1`, `2`, `3`, `4`, `5` |
| `category` | String | カテゴリ | `hook`, `pacing`, `content`, `format`, `platform`, `thumbnail`, `audio`, `other` |
| `recommendation` | String | 改善提案の本文 | - |
| `platform` | String | 対象プラットフォーム | `youtube`, `tiktok`, `instagram`, `all` |
| `expected_impact` | String | 期待される効果 | - |
| `status` | String | 実施状態 | `pending`, `approved`, `rejected`, `in_progress` |
| `compared_to_previous` | String | 前回の提案との関係 | `NEW`(新規), `CONTINUATION`(継続), `IMPROVED`(改善) |

**使い方のヒント**:
- priority が `1` や `2` の提案を優先的に検討する
- status を `pending` から `approved` や `in_progress` に変更して、提案の追跡が可能
- `compared_to_previous` が `CONTINUATION` の場合、前回から引き続き注力すべき領域

### video_analysis シート

個別動画のクロスプラットフォーム分析結果が蓄積されるシートです。

| 列名 | 型 | 説明 |
|------|-----|------|
| `video_uid` | String | 動画ID |
| `analyzed_at` | DateTime | 分析日時 |
| `youtube_performance` | String | YouTubeパフォーマンスの評価文 |
| `tiktok_performance` | String | TikTokパフォーマンスの評価文 |
| `instagram_performance` | String | Instagramパフォーマンスの評価文 |
| `cross_platform_insights` | String | プラットフォーム横断の知見 |
| `kpi_achievement` | String | KPI達成度 (`exceeded`, `met`, `partially_met`, `not_met`) |
| `improvements_from_previous` | String | 前回分析からの改善点 |
| `prompt_effectiveness` | String | コンポーネント（プロンプト）の効果分析 |
| `recommendations` | String | 2-3個の具体的な改善提案 |

### unlinked_imports シート

CSVインポート時に master シートの動画と紐づけられなかったデータが格納されるシートです。

| 列名 | 型 | 説明 |
|------|-----|------|
| `platform` | String | プラットフォーム名 |
| `platform_id` | String | プラットフォーム上の動画ID |
| `title` | String | 動画タイトル |
| `views` | Number | 再生回数 |
| `import_date` | DateTime | インポート日時 |
| `raw_csv_row` | String | 元のCSVの行データ |

このシートのデータは、手動でリンクするか、master シートにプラットフォームIDを登録後に再インポートすることで解消できます。

### _config シート

Script Properties のフォールバックとして使用されるシステム設定シートです。

| 列名 | 説明 |
|------|------|
| `key` | 設定キー名 |
| `value` | 設定値 |
| `description` | 設定の説明 |

**主な設定キー**:

| key | 説明 | 例 |
|-----|------|-----|
| `OPENAI_API_KEY` | OpenAI APIキー | `sk-...` |
| `SPREADSHEET_ID` | マスタースプレッドシートID | `1ABC...xyz` |

**注意**: `_config` シートに設定した値は、アクセス時に自動で Script Properties にマイグレーションされます。通常は Script Properties に直接設定することを推奨します。

---

## D. コンポーネント管理

### コンポーネントとは

v2.0 では、動画を構成する個別要素を「コンポーネント」として管理します。動画は以下の3セクション x 3要素 + キャラクターで構成されます。

```
1つの動画の構成:

[Hook (冒頭 1-3秒)]
  +-- Hook Scenario (台本)    : SCN_H_XXXX
  +-- Hook Motion (映像パターン) : MOT_XXXX
  +-- Hook Audio (音声)       : AUD_XXXX

[Body (本編)]
  +-- Body Scenario (台本)    : SCN_B_XXXX
  +-- Body Motion (映像パターン) : MOT_XXXX
  +-- Body Audio (音声)       : AUD_XXXX

[CTA (行動喚起 - 最後)]
  +-- CTA Scenario (台本)     : SCN_C_XXXX
  +-- CTA Motion (映像パターン) : MOT_XXXX
  +-- CTA Audio (音声)        : AUD_XXXX

[Character (キャラクター)]   : CHR_XXXX
```

### コンポーネントの4カテゴリ

| カテゴリ | 説明 | サブタイプ | IDプレフィックス |
|---------|------|-----------|----------------|
| **Scenarios (シナリオ)** | 台本・スクリプト | `hook`, `body`, `cta` | `SCN_H_`, `SCN_B_`, `SCN_C_` |
| **Motions (モーション)** | 映像パターン・トランジション | `hook`, `body`, `cta` | `MOT_` |
| **Characters (キャラクター)** | AIキャラクターの外見設定 | `character` | `CHR_` |
| **Audio (オーディオ)** | 音声・BGM | `voice`, `bgm` | `AUD_` |

### IDの命名規則

コンポーネントIDは、プレフィックスと4桁の連番で構成されます。

| プレフィックス | コンポーネントタイプ | 例 |
|--------------|-------------------|-----|
| `SCN_H_` | シナリオ - フック | `SCN_H_0001`, `SCN_H_0002` |
| `SCN_B_` | シナリオ - ボディ | `SCN_B_0001`, `SCN_B_0002` |
| `SCN_C_` | シナリオ - CTA | `SCN_C_0001`, `SCN_C_0002` |
| `MOT_` | モーション（全セクション共通） | `MOT_0001`, `MOT_0002` |
| `CHR_` | キャラクター | `CHR_0001`, `CHR_0002` |
| `AUD_` | オーディオ（Voice/BGM共通） | `AUD_0001`, `AUD_0002` |
| `VID_` | 動画UID（参考） | `VID_202602_0001` |

IDは自動生成されます。手動で設定する必要はありません。

### インベントリスプレッドシートの使い方

各コンポーネントカテゴリには、独立したスプレッドシート（インベントリ）があります。全てのインベントリは `inventory` というタブ名を共有しています。

**共通列** (全インベントリ共通):

| 列名 | 型 | 説明 |
|------|-----|------|
| `component_id` | String | 一意ID（自動生成） |
| `type` | String | サブタイプ (hook/body/cta/voice/bgm/character) |
| `name` | String | コンポーネント名 |
| `description` | String | 説明文 |
| `file_link` | String | アセットファイルへのリンクURL |
| `tags` | String | タグ（カンマ区切り: `question,shock,opener`） |
| `times_used` | Number | 使用回数（自動計算） |
| `avg_performance_score` | Number | 平均パフォーマンススコア 0-100（自動計算） |
| `created_date` | DateTime | 作成日時 |
| `status` | String | `active` または `archived` |

**Scenarios インベントリの追加列**:

| 列名 | 型 | 説明 |
|------|-----|------|
| `script_en` | String | 英語版スクリプト |
| `script_jp` | String | 日本語版スクリプト |

### 新しいコンポーネントの追加方法

#### 方法1: GASメニューから追加

1. メニュー「Video Analytics v2」→「Components」→「Add Component...」を選択
2. インベントリタイプを入力（`scenarios`, `motions`, `characters`, `audio`）
3. コンポーネント名を入力
4. サブタイプを入力（例: `hook`, `body`, `cta`, `voice`, `bgm`, `character`）
5. IDが自動生成され、インベントリに追加される
6. 詳細（description, tags, script_en/jp, file_link 等）はインベントリスプレッドシートで直接編集

#### 方法2: API経由で追加

```json
{
  "action": "add_component",
  "inventory_type": "scenarios",
  "type": "hook",
  "name": "Provocative Question Opener",
  "description": "Opens with a thought-provoking question",
  "script_en": "Did you know 90% of people get this wrong?",
  "script_jp": "90%の人がこれを間違えているって知ってた？"
}
```

#### 方法3: インベントリスプレッドシートに直接記入

1. 該当のインベントリスプレッドシートを開く
2. `inventory` タブの最終行の下に新しい行を追加
3. `component_id` は命名規則に従って手動入力（例: 既存の最大番号 + 1）
4. 最低限 `component_id`, `type`, `name`, `status` を入力

### コンポーネントのパフォーマンススコア

各コンポーネントには `avg_performance_score` (0-100) が自動的に算出されます。

**計算ロジック**:
1. そのコンポーネントを使用した全動画の `overall_score` を収集
2. 有効なスコア（0より大きい値）の平均を計算
3. 結果を整数に丸めてインベントリに書き戻す

**更新タイミング**:
- 分析実行時に、対象動画で使用されているコンポーネントのスコアが自動更新される
- メニュー「Components」→「Update All Scores」で全コンポーネントの再計算が可能

**活用例**:
- 「Score Summary」で各カテゴリのトップパフォーマーを確認
- スコアが高いコンポーネントを次の動画で優先的に使用
- スコアが低いコンポーネントは改善または `archived` に変更

---

## E. 動画制作ワークフロー

以下は、1本の動画が企画から分析完了までに辿る完全なワークフローです。

### Step 1: Master Sheet に新行作成 (draft)

**操作**: メニュー「Video Analytics v2」→「Production」→「Create New Video...」

1. 動画タイトルを入力する
2. `video_uid` が自動生成される（例: `VID_202602_0004`）
3. master シートに新しい行が追加される
   - `status` = `draft`
   - `created_date` = 現在日時
   - `human_approved` = `FALSE`

**この段階で master シートに入るデータ**:
```
video_uid: VID_202602_0004
title: "Spring Fashion with AI Mika"
status: draft
created_date: 2026/02/09 15:30
human_approved: FALSE
(他の列はすべて空)
```

### Step 2: コンポーネントID選択

master シート上で、直接セルを編集して各コンポーネントIDを入力します。

**記入すべき列**:
- `hook_scenario_id`: 例 `SCN_H_0001`
- `hook_motion_id`: 例 `MOT_0001`
- `hook_audio_id`: 例 `AUD_0002`
- `body_scenario_id`: 例 `SCN_B_0002`
- `body_motion_id`: 例 `MOT_0003`
- `body_audio_id`: 例 `AUD_0003`
- `cta_scenario_id`: 例 `SCN_C_0001`
- `cta_motion_id`: 例 `MOT_0005`
- `cta_audio_id`: 例 `AUD_0001`
- `character_id`: 例 `CHR_0001`

**コンポーネントの選び方**:
- メニュー「Components」→「Browse Scenarios/Motions/Characters/Audio」で一覧を確認
- `avg_performance_score` が高いコンポーネントを優先的に検討
- AI推奨がある場合は `ai_next_*` 列の値を参考にする

### Step 3: AI推奨の確認

前回の分析で AI が推奨したコンポーネント（`ai_next_*` 列）がある場合、それを参考にします。

- `ai_next_hook_scenario` に `SCN_H_0002` と入っていれば、そのフックが前回の分析で推奨されたことを意味する
- 推奨を採用する場合は、対応する実際の列（`hook_scenario_id`）にそのIDをコピー
- 推奨に同意しない場合は、別のコンポーネントIDを選択

### Step 4: human_approved チェック (approved)

**操作**: 以下のいずれか
- master シートの `human_approved` チェックボックスを直接チェックし、`status` を手動で `approved` に変更
- メニュー「Video Analytics v2」→「Production」→「Approve Video...」でダイアログから実行

**承認操作で起きること**:
1. `human_approved` が `TRUE` に設定される
2. `status` が `approved` に変更される
3. `approval_notes` にメモが記録される（任意）

### Step 5: n8n/外部ツールで動画生成 (in_production)

n8n ワークフロー（または手動操作）により、承認済み動画の制作が開始されます。

**n8n の処理内容**:
1. `GET ?action=get_approved` で承認済み動画リストを取得
2. `GET ?action=get_production&video_uid=VID_...` で各動画の全コンポーネントデータを取得
3. 各コンポーネントのインベントリデータ（台本テキスト、モーション指示等）を読み取り
4. 動画生成APIに渡して動画を生成
5. `POST update_status` で `status` を `in_production` に変更

**in_production への変更時の副作用**:
- 使用されている全コンポーネントの `times_used` が +1 される（自動）

### Step 6: プラットフォームにアップロード (published)

生成された動画を YouTube Shorts、TikTok、Instagram Reels にアップロードし、各プラットフォームの動画IDを master シートに記録します。

**記録するID**:
- `youtube_id`: YouTube の動画ID（URL中の `v=` 以降の部分）
- `tiktok_id`: TikTok の動画ID
- `instagram_id`: Instagram のリールID

ステータスを `published` に更新:
```json
{
  "action": "update_status",
  "video_uid": "VID_202602_0004",
  "status": "published"
}
```

### Step 7: CSV エクスポート & インポート

各プラットフォームの管理画面からCSVをエクスポートし、システムにインポートします。

**エクスポート手順** (詳細は [F. CSV インポート](#f-csv-インポート) を参照):
1. YouTube Studio / TikTok Analytics / Instagram プロフェッショナルダッシュボードからCSVをダウンロード
2. Google Drive の `Analytics/CSV_Imports/YouTube/` (等) にアップロード

**インポート手順**:
- n8n 連携時: Drive へのアップロードで自動インポートが実行される
- 手動: メニュー「Video Analytics v2」→「Import CSV」→ プラットフォームを選択

### Step 8: 分析実行 (analyzed)

**操作**: メニュー「Video Analytics v2」→「Analyze」→「All Videos (Enhanced)」

**分析で実行される処理**:
1. 全動画のメトリクスを `metrics_*` シートから収集
2. `kpi_targets` シートの目標値と比較し、KPIスコアを算出
3. コンポーネント情報（使用コンポーネント、スコア、トップパフォーマー）をAIプロンプトに含める
4. OpenAI (GPT-4o) にプロンプトを送信
5. 分析インサイトを `analysis_reports` シートに書き込み
6. 改善提案を `recommendations` シートに書き込み
7. 各動画の `overall_score` を master シートに更新
8. 使用コンポーネントの `avg_performance_score` を更新
9. 動画のステータスを `analyzed` に変更
10. AIが次の動画に推奨するコンポーネントを `ai_next_*` 列に書き込み

### 次のサイクルへ

分析完了後、master シートの `ai_next_*` 列にAIの推奨コンポーネントが格納されます。これを参考に Step 1 に戻り、次の動画を企画します。

**サイクルの理想的な頻度**: 週1回のCSVインポートと分析実行を推奨

---

## F. CSV インポート

### 各プラットフォームのCSVフォーマット

システムは、各プラットフォームのCSV列名のバリエーション（英語・日本語）を自動的に認識します。

#### YouTube CSV

**サポートされる列名** (いずれか1つが存在すればOK):

| 正規化名 | 認識される列名 |
|---------|--------------|
| `video_id` | `Video ID`, `Content`, `コンテンツ` |
| `title` | `Video title`, `Title`, `動画タイトル`, `タイトル` |
| `views` | `Views`, `View count`, `視聴回数` |
| `watch_time_hours` | `Watch time (hours)`, `総再生時間（時間）`, `Watch time` |
| `avg_view_duration` | `Average view duration`, `平均視聴時間`, `Avg. duration` |
| `ctr` | `Impressions click-through rate (%)`, `CTR`, `インプレッションのクリック率（%）` |
| `likes` | `Likes`, `Like count`, `高評価` |
| `comments` | `Comments`, `Comment count`, `コメント` |
| `shares` | `Shares`, `Share count`, `共有` |
| `subscribers_gained` | `Subscribers`, `Subscribers gained`, `チャンネル登録者` |

**サンプルCSV**:
```csv
Video ID,Video title,Views,Watch time (hours),Average view duration,Impressions click-through rate (%),Likes,Comments,Shares,Subscribers
ABC123xyz,"Morning Routine with AI Mika | Day 1",125000,2500.5,0:01:12,8.5,4200,350,180,450
DEF456uvw,"AI Mika tries Japanese convenience store food!",98000,1850.2,0:01:08,7.2,3100,280,95,320
```

#### TikTok CSV

| 正規化名 | 認識される列名 |
|---------|--------------|
| `video_id` | `Video ID`, `video_id`, `ID` |
| `title` | `Title`, `Video Title`, `Description` |
| `views` | `Video views`, `Views`, `Total views` |
| `avg_watch_time` | `Average watch time`, `Avg. watch time`, `Avg watch time (s)` |
| `completion_rate` | `Watched full video (%)`, `Completion rate`, `Full video views (%)` |
| `likes` | `Likes`, `Like count`, `Total likes` |
| `comments` | `Comments`, `Comment count`, `Total comments` |
| `shares` | `Shares`, `Share count`, `Total shares` |
| `saves` | `Saves`, `Save count`, `Total saves` |
| `engagement_rate` | `Engagement rate`, `Engagement rate (%)` |

**サンプルCSV**:
```csv
Video ID,Title,Video views,Average watch time,Watched full video (%),Likes,Comments,Shares,Saves,Engagement rate
7123456789012345,"POV: AI girlfriend wakes you up #ai #vtuber",450000,12.5,45.2,38000,2100,5600,8900,10.2
```

#### Instagram CSV

| 正規化名 | 認識される列名 |
|---------|--------------|
| `reel_id` | `Reel ID`, `Media ID`, `ID` |
| `title` | `Caption`, `Title`, `Description` |
| `views` | `Plays`, `Views`, `Video Views`, `Total plays` |
| `reach` | `Reach`, `Accounts reached`, `Unique views` |
| `avg_watch_time` | `Average watch time`, `Avg. watch time`, `Avg time watched` |
| `likes` | `Likes`, `Like count`, `Total likes` |
| `comments` | `Comments`, `Comment count`, `Total comments` |
| `shares` | `Shares`, `Share count`, `Total shares` |
| `saves` | `Saves`, `Save count`, `Total saves` |

**サンプルCSV**:
```csv
Reel ID,Caption,Plays,Reach,Average watch time,Likes,Comments,Shares,Saves
18234567890123456,"Morning coffee routine #aiinfluencer #reels",85000,72000,18.5,6200,340,890,1200
```

### インポート手順

#### 方法1: GASメニューからの手動インポート

1. メニュー「Video Analytics v2」→「Import CSV」→ プラットフォームを選択
2. ダイアログにCSVの内容を貼り付ける
   **または** Google Drive 上のCSVファイルのURLを貼り付ける
3. 「OK」をクリック
4. インポート結果のサマリーが表示される

#### 方法2: API経由のインポート

CSVデータをBase64エンコードして POST リクエストを送信します。

```json
{
  "action": "import_csv",
  "platform": "youtube",
  "csv_data": "VmlkZW8gSUQsVmlkZW8gdGl0bGUsVmlld3MsLi4u..."
}
```

#### 方法3: n8n自動インポート

Google Drive の `Analytics/CSV_Imports/` フォルダにCSVを配置すると、n8n がファイル名からプラットフォームを自動検出してインポートします。

ファイル名の検出ロジック:
- `youtube` または `yt_` を含む → YouTube
- `tiktok` または `tt_` を含む → TikTok
- `instagram` または `ig_` を含む → Instagram

### リンク成功/失敗の確認方法

CSVインポート時に、各データ行は master シートの動画とリンクが試行されます。

**リンクのマッチングロジック** (優先順):
1. **プラットフォームIDの完全一致**: CSVの `video_id` / `reel_id` と master の `youtube_id` / `tiktok_id` / `instagram_id` が一致
2. **タイトルのファジーマッチ**: 上記が一致しない場合、タイトルの類似度(Levenshtein距離)で判定（85%以上の類似度で一致と判定）
3. **いずれも不一致**: `unlinked_imports` シートに格納

**インポート結果の確認**:
- インポート完了ダイアログに `Linked: X` / `Unlinked: Y` が表示される
- `unlinked_imports` シートで未リンクデータを確認

### 未リンクデータの手動処理

`unlinked_imports` シートにデータがある場合:

**方法1: master にプラットフォームIDを追加して再インポート**
1. `unlinked_imports` のプラットフォームIDを確認
2. master シートの該当動画行に、プラットフォームIDを記入（例: `youtube_id` にIDを入力）
3. 同じCSVを再インポートすると、今度はリンクが成功する

**方法2: API経由でリンクを作成**
```json
{
  "action": "link_videos",
  "links": [
    {
      "video_uid": "VID_202602_0001",
      "platform_id": "dQw4w9WgXcQ",
      "platform": "youtube"
    }
  ]
}
```

**方法3: master に新規行を作成してリンク**
プラットフォーム上にあるが master に登録されていない動画の場合:
1. メニュー → 「Production」→「Create New Video...」で新規行を作成
2. プラットフォームIDを記入
3. CSVを再インポート

---

## G. 分析・KPI

### KPI目標の設定方法

`kpi_targets` シートで各プラットフォームのメトリクス目標を設定します。

**設定手順**:
1. `kpi_targets` シートを開く
2. 行を追加して以下の4列を入力:

| platform | metric | target_value | description |
|----------|--------|--------------|-------------|
| youtube | completion_rate | 0.5 | 50%完走 |
| youtube | ctr | 0.05 | 5%クリック率 |
| youtube | engagement_rate | 0.03 | 3%エンゲージメント |
| tiktok | completion_rate | 0.4 | 40%完走 |
| tiktok | engagement_rate | 0.08 | 8%エンゲージメント |
| tiktok | avg_watch_time_sec | 10 | 平均10秒視聴 |
| instagram | reach_rate | 0.3 | 30%リーチ |
| instagram | avg_watch_time_sec | 15 | 平均15秒視聴 |
| instagram | engagement_rate | 0.05 | 5%エンゲージメント |

**注意事項**:
- `target_value` は小数で入力（50%なら `0.5`）。ただし `avg_watch_time_sec` は秒数で入力
- 設定がない場合はシステム内蔵のデフォルト値が使用される
- 行を削除・変更すればいつでも目標を更新可能

### 分析の実行方法

#### 全動画分析（推奨）

**操作**: メニュー「Video Analytics v2」→「Analyze」→「All Videos (Enhanced)」

全動画を一括分析します。v2.0 の Enhanced 分析では以下の追加情報がAIに渡されます:
- 各動画で使用されたコンポーネント（シナリオ台本テキスト含む）
- コンポーネントのパフォーマンス履歴とスコア
- トップパフォーマーのコンポーネントプール
- 前回の改善提案

#### 個別動画分析

**操作**: メニュー「Video Analytics v2」→「Analyze」→「Single Video...」

1. 登録済み動画の video_uid リストが表示される
2. 分析したい動画の video_uid を入力
3. クロスプラットフォーム分析が実行される (YouTube + TikTok + Instagram)

結果は `video_analysis` シートに書き込まれます。

### 分析レポートの読み方

#### overall_score (0-100)

各プラットフォームのKPI達成度から算出される総合スコアです。

**計算方法**:
1. 各プラットフォームについて、設定されたKPI目標に対する達成率を算出
2. 目標以上 = 100%, 95%以上 = 50%, それ以下 = 0%
3. 達成したメトリクスの割合を百分率に変換
4. 全プラットフォームの平均を取ったものが overall_score

**スコアの目安**:

| スコア範囲 | 評価 | アクション |
|-----------|------|-----------|
| 80-100 | 優秀 | 同様のコンポーネント構成を維持 |
| 60-79 | 良好 | 弱点プラットフォームの改善に注力 |
| 40-59 | 改善必要 | recommendations の優先度1-2の提案を実施 |
| 0-39 | 大幅改善必要 | コンポーネント構成を見直し、高スコアコンポーネントに変更 |

#### kpi_achievement (video_analysis シート)

個別動画のKPI達成状態を示す4段階評価です。

| 値 | 意味 |
|----|------|
| `exceeded` | 全てのKPI目標を上回った |
| `met` | 大半のKPI目標を達成した |
| `partially_met` | 一部のKPI目標のみ達成 |
| `not_met` | KPI目標に到達していない |

### パフォーマンススコアの意味

パフォーマンススコアは、システム内で2つのレベルで使用されます。

**1. 動画レベル (`overall_score`)**:
- master シートの各動画行に記録
- その動画の全プラットフォームでのKPI達成度を示す

**2. コンポーネントレベル (`avg_performance_score`)**:
- 各インベントリスプレッドシートの各コンポーネントに記録
- そのコンポーネントを使用した全動画の overall_score の平均値
- 「このコンポーネントを使うと、平均的にどの程度のスコアになるか」を示す

---

## H. AI推奨・承認フロー

### AI推奨の仕組み (OpenAI連携)

分析実行時に、以下の情報がOpenAI (GPT-4o) に送信されます:

1. **メトリクスデータ**: 各動画の全プラットフォームメトリクス
2. **KPI比較結果**: 目標値との差分、達成/未達成の状況
3. **コンポーネントコンテキスト**:
   - 各動画で使用されたコンポーネントの一覧（ID、名前、スコア）
   - シナリオの台本テキスト（`script_en`）
   - 各コンポーネントの過去のパフォーマンス履歴
4. **コンポーネントプール**:
   - 各カテゴリのトップパフォーマー（上位5件）
   - スコア、使用回数を含む
5. **前回の改善提案**: 過去の recommendations（最新20件）

AIはこれらの情報を総合的に分析し、以下を出力します:
- **分析インサイト**: トレンド、パターン、強み、弱み、コンポーネント別の知見
- **改善提案**: 優先度付きの具体的なアクションアイテム
- **次回推奨コンポーネント**: 次の動画に使用すべきコンポーネントのID

### 推奨コンポーネントの確認方法

AI推奨コンポーネントは、master シートの `ai_next_*` 列に書き込まれます。

**確認手順**:
1. master シートを開く
2. 右にスクロールして `ai_next_*` 列グループを確認
3. 各列に推奨されたコンポーネントIDが入っている

| 列名 | 推奨内容 |
|------|---------|
| `ai_next_hook_scenario` | 次のフック台本 (例: `SCN_H_0002`) |
| `ai_next_hook_motion` | 次のフックモーション (例: `MOT_0002`) |
| `ai_next_hook_audio` | 次のフックオーディオ (例: `AUD_0002`) |
| `ai_next_body_scenario` | 次のボディ台本 |
| `ai_next_body_motion` | 次のボディモーション |
| `ai_next_body_audio` | 次のボディオーディオ |
| `ai_next_cta_scenario` | 次のCTA台本 |
| `ai_next_cta_motion` | 次のCTAモーション |
| `ai_next_cta_audio` | 次のCTAオーディオ |
| `ai_next_character` | 次のキャラクター |

### human_approved チェックボックスの使い方

`human_approved` 列は、AIの推奨を人間がレビューした証として機能します。

**チェックの意味**:
- `TRUE` (チェック済み): 人間がコンポーネント選択を確認し、制作を承認した
- `FALSE` (未チェック): まだレビューされていない、またはドラフト段階

**チェックの方法**:
1. **直接チェック**: master シートで `human_approved` 列のチェックボックスをクリック（status は別途手動変更が必要）
2. **メニューから承認**: 「Production」→「Approve Video...」を使用すると、`human_approved` と `status` が同時に更新される

### 承認後に裏側で何が起こるか

`approveVideo()` 関数が実行されると:

1. `human_approved` が `TRUE` に設定される
2. `status` が `approved` に変更される
3. `approval_notes` にメモが記録される（入力された場合）

`status` が `in_production` に変更されると（通常は n8n から）:

4. `incrementComponentUsage()` が実行される
5. 使用されている全コンポーネントの `times_used` が +1 される
6. 同じオーディオが複数セクションで使われている場合は重複カウントされない

---

## I. n8n/API連携

### 利用可能なAPIエンドポイント

GAS Web App は以下のベースURLでアクセスします:

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

#### GET エンドポイント

| Action | パラメータ | 説明 |
|--------|----------|------|
| (なし) | - | ヘルスチェック + エンドポイント一覧 |
| `get_status` | - | システム状態（レコード数、動画ステータス内訳） |
| `get_approved` | - | 承認済み動画リスト |
| `get_production` | `video_uid` | 動画の全制作データ（コンポーネント詳細含む） |
| `get_components` | `inventory_type`, `type`(任意), `status`(任意) | コンポーネント一覧 |
| `get_score_summary` | - | 全コンポーネントのスコアサマリー |

**GETリクエストの例**:
```
# ヘルスチェック
GET https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec

# システムステータス
GET ...?action=get_status

# 承認済み動画
GET ...?action=get_approved

# 特定動画の制作データ
GET ...?action=get_production&video_uid=VID_202602_0001

# シナリオ一覧（フックのみ、アクティブのみ）
GET ...?action=get_components&inventory_type=scenarios&type=hook&status=active

# スコアサマリー
GET ...?action=get_score_summary
```

#### POST エンドポイント

| Action | 主要フィールド | 説明 |
|--------|-------------|------|
| `import_csv` | `platform`, `csv_data` | CSVインポート |
| `analyze` | `video_uids[]` | 指定動画を分析 |
| `analyze_single` | `video_uid` | 1動画を分析 |
| `analyze_all` | (なし) | 全動画を分析（Enhanced） |
| `link_videos` | `links[]` | プラットフォームIDの手動リンク |
| `create_production` | `title`, コンポーネントID各種 | 新規動画制作作成 |
| `approve_video` | `video_uid`, `notes`(任意) | 動画承認 |
| `update_status` | `video_uid`, `status` | ステータス更新 |
| `add_component` | `inventory_type`, `type`, `name` | コンポーネント追加 |
| `update_component` | `component_id`, 更新フィールド | コンポーネント更新 |
| `update_scores` | `video_uid`(任意) | スコア再計算 |

### doPost リクエスト形式

全てのPOSTリクエストはJSON形式で、`action` フィールドが必須です。

```json
{
  "action": "アクション名",
  ...アクション固有のフィールド
}
```

#### import_csv

```json
{
  "action": "import_csv",
  "platform": "youtube",
  "csv_data": "QmFzZTY0IGVuY29kZWQgQ1NW..."
}
```
- `platform`: `"youtube"` | `"tiktok"` | `"instagram"`
- `csv_data`: CSVコンテンツをBase64エンコードした文字列

#### analyze

```json
{
  "action": "analyze",
  "video_uids": ["VID_202602_0001", "VID_202602_0002"]
}
```

#### analyze_single

```json
{
  "action": "analyze_single",
  "video_uid": "VID_202602_0001"
}
```

#### analyze_all

```json
{
  "action": "analyze_all"
}
```

#### create_production

```json
{
  "action": "create_production",
  "title": "Morning Routine with AI Mika",
  "hook_scenario_id": "SCN_H_0001",
  "hook_motion_id": "MOT_0001",
  "hook_audio_id": "AUD_0001",
  "body_scenario_id": "SCN_B_0002",
  "body_motion_id": "MOT_0003",
  "body_audio_id": "AUD_0003",
  "cta_scenario_id": "SCN_C_0001",
  "cta_motion_id": "MOT_0005",
  "cta_audio_id": "AUD_0001",
  "character_id": "CHR_0001"
}
```

#### approve_video

```json
{
  "action": "approve_video",
  "video_uid": "VID_202602_0001",
  "notes": "構成確認済み、制作開始OK"
}
```

#### update_status

```json
{
  "action": "update_status",
  "video_uid": "VID_202602_0001",
  "status": "in_production"
}
```
有効なステータス: `draft`, `approved`, `in_production`, `published`, `analyzed`

#### link_videos

```json
{
  "action": "link_videos",
  "links": [
    {
      "video_uid": "VID_202602_0001",
      "platform_id": "dQw4w9WgXcQ",
      "platform": "youtube"
    },
    {
      "video_uid": "VID_202602_0001",
      "platform_id": "7123456789012345678",
      "platform": "tiktok"
    }
  ]
}
```

#### add_component

```json
{
  "action": "add_component",
  "inventory_type": "scenarios",
  "type": "hook",
  "name": "Shocking Question Opener",
  "description": "Opens with a provocative question",
  "tags": "question,shock,opener",
  "script_en": "Why are you still wasting your mornings?",
  "script_jp": "まだ朝の時間を無駄にしてるの？"
}
```

#### update_component

```json
{
  "action": "update_component",
  "component_id": "SCN_H_0001",
  "description": "Updated description text",
  "tags": "provocative,question,morning"
}
```

#### update_scores

```json
{
  "action": "update_scores"
}
```
特定動画のみ:
```json
{
  "action": "update_scores",
  "video_uid": "VID_202602_0001"
}
```

### レスポンス形式

全てのレスポンスは以下の共通形式です。

**成功時**:
```json
{
  "status": "success",
  "data": {
    ...アクション固有のデータ
  },
  "timestamp": "2026-02-09T11:30:00.000Z"
}
```

**エラー時**:
```json
{
  "status": "error",
  "error": "エラーメッセージ",
  "timestamp": "2026-02-09T11:30:00.000Z"
}
```

**主要アクションのレスポンス例**:

`import_csv` の成功レスポンス:
```json
{
  "status": "success",
  "data": {
    "platform": "youtube",
    "total_rows": 50,
    "linked": 45,
    "unlinked": 5
  }
}
```

`get_status` のレスポンス:
```json
{
  "status": "success",
  "data": {
    "version": "2.0.0",
    "record_counts": {
      "MASTER": 150,
      "METRICS_YOUTUBE": 500,
      "METRICS_TIKTOK": 300,
      "METRICS_INSTAGRAM": 200,
      "RECOMMENDATIONS": 45
    },
    "video_statuses": {
      "draft": 3,
      "approved": 2,
      "in_production": 1,
      "published": 12,
      "analyzed": 8
    },
    "last_updated": "2026/02/09 21:00"
  }
}
```

### n8n ワークフローとの統合方法

#### ワークフロー1: CSV自動インポート

```
[Google Drive Trigger] --> [Read File] --> [Code: Base64変換] --> [POST: import_csv]
  (CSV_Imports/          (ファイル内容     (Base64エンコード)     (GAS Web App)
   フォルダ監視)          読み取り)
                                                                      |
                                                                      v
                                                              [POST: analyze_all]
                                                                      |
                                                                      v
                                                              [POST: update_scores]
```

**プラットフォーム検出ロジック** (n8n Code ノード):
```javascript
const filename = $json.name.toLowerCase();
if (filename.includes('youtube') || filename.includes('yt_')) return 'youtube';
if (filename.includes('tiktok') || filename.includes('tt_')) return 'tiktok';
if (filename.includes('instagram') || filename.includes('ig_')) return 'instagram';
```

#### ワークフロー2: 動画制作自動化

```
[Schedule: Daily] --> [GET: get_approved] --> [For Each Video]
                                                      |
                                                      v
                                              [GET: get_production]
                                                      |
                                                      v
                                              [GET: get_components]
                                                      |
                                                      v
                                              [Video Creation API]
                                                      |
                                                      v
                                              [POST: update_status]
                                              (status: in_production)
                                                      |
                                                      v
                                              [Upload to Platforms]
                                                      |
                                                      v
                                              [POST: update_status]
                                              (status: published)
```

#### ワークフロー3: 週次分析 + レポート

```
[Schedule: 毎週月曜 9:00] --> [POST: analyze_all] --> [POST: update_scores]
                                                              |
                                                              v
                                                      [GET: get_score_summary]
                                                              |
                                                              v
                                                      [レポート整形]
                                                              |
                                                              v
                                                      [メール送信]
```

#### n8n HTTP Request ノードの推奨設定

```yaml
Method: POST (or GET)
URL: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
Authentication: None
Headers:
  Content-Type: application/json
Continue On Fail: true
Retry On Fail: true
Max Tries: 3
Wait Between Tries: 5000  # 5秒
```

---

## J. GASメニュー操作

スプレッドシートを開くと、メニューバーに「Video Analytics v2」が表示されます。

### メニュー構造

```
Video Analytics v2
|-- Initial Setup (v2.0)       ... 初回セットアップ
|-- Upgrade from v1.0          ... v1からのアップグレード
|-- ----
|-- Import CSV
|   |-- YouTube CSV            ... YouTube CSVインポート
|   |-- TikTok CSV             ... TikTok CSVインポート
|   +-- Instagram CSV          ... Instagram CSVインポート
|-- ----
|-- Analyze
|   |-- Single Video...        ... 個別動画分析
|   +-- All Videos (Enhanced)  ... 全動画一括分析
|-- ----
|-- Production
|   |-- Create New Video...    ... 新規動画作成
|   |-- View Approved Videos   ... 承認済み動画一覧
|   |-- Approve Video...       ... 動画承認
|   +-- Update Video Status... ... ステータス変更
|-- Components
|   |-- Add Component...       ... コンポーネント追加
|   |-- Browse Scenarios       ... シナリオ一覧表示
|   |-- Browse Motions         ... モーション一覧表示
|   |-- Browse Characters      ... キャラクター一覧表示
|   |-- Browse Audio           ... オーディオ一覧表示
|   |-- Update All Scores      ... 全スコア再計算
|   +-- Score Summary          ... スコアサマリー表示
|-- ----
|-- Status Dashboard           ... システム状態ダッシュボード
|-- Insert Demo Data           ... デモデータ挿入
+-- Clear All Data             ... 全データ削除
```

### 各メニュー操作の説明

#### Initial Setup (v2.0)
- **用途**: システムの初回セットアップ。1回だけ実行
- **実行内容**: Drive フォルダ作成、全シートタブ初期化、インベントリスプレッドシート作成、デフォルトKPI設定、デモコンポーネントデータ挿入
- **所要時間**: 1-3分

#### Upgrade from v1.0
- **用途**: v1.0 からの移行
- **実行内容**: `videos_master` を `master` にリネーム、新列追加、`recommendations` スキーマ更新、`video_analysis` シート作成

#### Import CSV (YouTube / TikTok / Instagram)
- **用途**: 各プラットフォームのCSVをインポート
- **操作**: CSVの中身を貼り付けるか、Drive上のCSVファイルURLを入力
- **結果表示**: インポート行数、リンク成功数、未リンク数

#### Single Video...
- **用途**: 1つの動画を3プラットフォーム横断で分析
- **操作**: 登録済み動画UIDの一覧から選択
- **結果**: `video_analysis` シートに記録

#### All Videos (Enhanced)
- **用途**: 全動画の一括分析（コンポーネント情報付き）
- **操作**: 確認ダイアログで「OK」
- **結果**: `analysis_reports`, `recommendations` に記録、各動画のスコアとコンポーネントスコアが更新

#### Create New Video...
- **用途**: master シートに新しい動画行を追加
- **操作**: タイトルを入力
- **結果**: `video_uid` が自動生成され、`status=draft` で追加

#### View Approved Videos
- **用途**: 承認済みで制作待ちの動画リストを確認
- **表示**: `video_uid` と `title` の一覧

#### Approve Video...
- **用途**: draft 状態の動画を承認
- **操作**: draft 動画一覧から video_uid を入力、任意のメモを入力
- **結果**: `status=approved`, `human_approved=TRUE`

#### Update Video Status...
- **用途**: 動画のステータスを手動変更
- **操作**: video_uid とステータス (`draft`, `approved`, `in_production`, `published`, `analyzed`) を入力

#### Add Component...
- **用途**: インベントリに新しいコンポーネントを追加
- **操作**: インベントリタイプ、名前、サブタイプを入力
- **結果**: IDが自動生成され、インベントリスプレッドシートに追加

#### Browse Scenarios / Motions / Characters / Audio
- **用途**: 各カテゴリのアクティブなコンポーネント一覧を表示
- **表示**: component_id, type, name, avg_performance_score（上位20件）

#### Update All Scores
- **用途**: 全コンポーネントの `avg_performance_score` を再計算
- **タイミング**: 分析実行後にスコアが反映されていない場合に使用

#### Score Summary
- **用途**: 各カテゴリのスコアサマリーを表示
- **表示**: 総数、スコア付き数、平均スコア、トップ3パフォーマー

#### Status Dashboard
- **用途**: システム全体の状態を確認
- **表示**: バージョン、各シートのレコード数、動画ステータス内訳、OpenAI APIキー設定状態、インベントリ接続状態

#### Insert Demo Data
- **用途**: デモ用のサンプルデータを master と metrics シートに挿入
- **内容**: 3動画（2つは分析済み、1つはドラフト）+ 各プラットフォームのメトリクスデータ

#### Clear All Data
- **用途**: 全シートのデータを削除（ヘッダー行は残る）
- **注意**: 確認ダイアログが表示される。元に戻せないので慎重に実行

---

## K. トラブルシューティング

### よくあるエラーと対処法

#### セットアップ関連

| 症状 | 原因 | 対処法 |
|------|------|--------|
| `Root folder not found` | CONFIG.ROOT_FOLDER_ID が不正 | Script Properties の `ROOT_FOLDER_ID` を確認 |
| `Missing required Script Properties: SPREADSHEET_ID` | 初期設定が未完了 | Script Properties に `SPREADSHEET_ID` を設定 |
| `Missing required Script Properties: OPENAI_API_KEY` | APIキー未設定 | Script Properties に `OPENAI_API_KEY` を設定 |
| セットアップが途中で止まる | GAS の6分タイムアウト | 再度 `setupCompleteSystem()` を実行（既存のフォルダ・シートはスキップされる） |

#### CSVインポート関連

| 症状 | 原因 | 対処法 |
|------|------|--------|
| `CSV has no data rows` | CSVが空またはヘッダーのみ | データ行があるCSVを使用 |
| `Unknown platform` | プラットフォーム名が不正 | `youtube`, `tiktok`, `instagram` のいずれかを指定 |
| 全てが unlinked になる | master にプラットフォームIDが未設定 | master シートに `youtube_id`, `tiktok_id`, `instagram_id` を記入 |
| 文字化け | CSVの文字コードが UTF-8 でない | UTF-8 で保存し直す |
| 日本語ヘッダーが認識されない | 未知の列名パターン | CONFIG.COLUMN_ALIASES に追加が必要 |

#### 分析関連

| 症状 | 原因 | 対処法 |
|------|------|--------|
| `OpenAI API key not configured` | APIキー未設定 | Script Properties に `OPENAI_API_KEY` を設定 |
| `OpenAI API error: 429` | レート制限 | 自動リトライが実行される。頻発する場合は時間を空けて再実行 |
| `OpenAI API error: 401` | APIキーが無効 | 有効なAPIキーに更新 |
| `master sheet has no videos registered` | master シートが空 | `Insert Demo Data` でデモデータを挿入するか、動画を追加 |
| 分析結果がおかしい | AI の出力パースに失敗 | GAS の実行ログを確認。再実行で改善することが多い |
| スコアが更新されない | 分析後のスコア伝搬が未完了 | メニュー「Components」→「Update All Scores」を実行 |

#### コンポーネント関連

| 症状 | 原因 | 対処法 |
|------|------|--------|
| `Inventory spreadsheet ID not set` | インベントリ未作成 | `setupCompleteSystem()` を実行 |
| `Inventory tab not found` | スプレッドシート内の `inventory` タブが無い | インベントリスプレッドシートに `inventory` タブを作成 |
| `Unknown component type for ID` | IDプレフィックスが不正 | `SCN_`, `MOT_`, `CHR_`, `AUD_` で始まるIDを使用 |
| コンポーネントが Browse で表示されない | status が `archived` | インベントリスプレッドシートで status を `active` に変更 |

#### API/n8n 関連

| 症状 | 原因 | 対処法 |
|------|------|--------|
| `Unknown action: xxx` | 無効なアクション名 | 有効なアクション名を使用（上記エンドポイント一覧参照） |
| `Missing required fields: platform, csv_data` | リクエストフィールド不足 | 必須フィールドを全て含める |
| `Missing video_uid` | video_uid が未指定 | video_uid をペイロードに含める |
| `Video not found: VID_...` | 存在しない video_uid | master シートを確認 |
| GAS がタイムアウト (6分) | 処理データ量が多すぎる | バッチを小さく分割するか、`analyze` で対象を限定 |
| レスポンスが返らない | Web App デプロイが未完了 | GAS エディタ → デプロイ → 新しいデプロイメントを作成 |

### ログの確認方法

#### GAS 実行ログ

1. Google Sheets → 拡張機能 → Apps Script を開く
2. 左サイドバーの「実行数」（時計アイコン）をクリック
3. 実行履歴が表示される。各実行をクリックして詳細ログを確認

#### Logger.log の確認

GAS コード内の `Logger.log()` 出力は、実行後に以下で確認できます:
1. GAS エディタで関数を実行
2. 「実行ログ」パネルに出力が表示される

#### API エラーレスポンス

APIからのエラーは JSON レスポンスの `error` フィールドに含まれます:
```json
{
  "status": "error",
  "error": "エラーの詳細メッセージ",
  "timestamp": "2026-02-09T11:30:00.000Z"
}
```

### GAS の制限事項

| 制限 | 値 |
|------|-----|
| 実行時間上限 | 6分（360秒） |
| Web App リクエスト数/日 | 20,000 |
| URL Fetch コール数/日 | 20,000 |
| Properties Service 合計容量 | 500KB |
| Properties Service 1プロパティ | 9KB |
| トリガー数上限 | 100（ユーザーあたり） |

**タイムアウト対策**: システムには、処理状態を保存して後続のトリガーで再開する仕組みが組み込まれています（`checkExecutionTime()`, `saveProcessingState()`, `createContinuationTrigger()`）。

---

## L. 初期セットアップ

### 前提条件

- Google アカウント
- OpenAI API キー（分析機能に必要）
- Google Drive に AI-Influencer ルートフォルダが存在すること

### Step 1: スプレッドシートの準備

1. Google Drive で新しい Google Sheets を作成する
2. 「拡張機能」→「Apps Script」を開く
3. `gas/` ディレクトリ内の全 `.gs` ファイルの内容を、Apps Script エディタにコピーする
   - `Code.gs`, `Config.gs`, `Setup.gs`, `Migration.gs`, `CSVParser.gs`, `Normalizer.gs`, `Linker.gs`, `KPIEngine.gs`, `LLMAnalyzer.gs`, `SheetWriter.gs`, `ComponentManager.gs`, `MasterManager.gs`, `ScoreUpdater.gs`, `Utils.gs`
4. `appsscript.json` の内容も反映する

### Step 2: Script Properties の設定

1. Apps Script エディタ → 左サイドバー「プロジェクトの設定」（歯車アイコン）
2. 「スクリプトプロパティ」セクションで以下を追加:

| プロパティ名 | 値 | 説明 |
|-------------|-----|------|
| `SPREADSHEET_ID` | スプレッドシートのID (URLの `/d/` と `/edit` の間の文字列) | マスタースプレッドシートの識別子 |
| `OPENAI_API_KEY` | `sk-...` で始まるAPIキー | OpenAI API認証用（分析機能に必須） |

### Step 3: setupCompleteSystem() の実行

1. スプレッドシートに戻る
2. ページをリロードする（メニューが表示されるまで数秒待つ）
3. メニュー「Video Analytics v2」→「Initial Setup (v2.0)」を選択
4. 確認ダイアログで「OK」をクリック
5. セットアップが完了するまで待つ（1-3分）

**セットアップで自動作成されるもの**:
- Google Drive フォルダ構造（Scenarios, Motions, Characters, Audio, Analytics + 全サブフォルダ）
- マスタースプレッドシートの全タブ（master, metrics_youtube, metrics_tiktok, metrics_instagram, kpi_targets, analysis_reports, recommendations, video_analysis, unlinked_imports）
- 4つのインベントリスプレッドシート（Scenarios Inventory, Motions Inventory, Characters Inventory, Audio Inventory）
- デフォルトKPI設定（9行）
- デモコンポーネントデータ（シナリオ7件、モーション5件、キャラクター3件、オーディオ4件）

### Step 4: insertDemoData() の実行

初期セットアップ後、分析機能を試したい場合:

1. メニュー「Video Analytics v2」→「Insert Demo Data」を選択
2. 以下のデモデータが挿入される:
   - master シート: 3動画（2件は analyzed、1件は draft）
   - metrics_youtube: 2レコード
   - metrics_tiktok: 2レコード
   - metrics_instagram: 2レコード

**デモ動画の内容**:

| video_uid | title | status | overall_score |
|-----------|-------|--------|---------------|
| VID_202602_0001 | AI Mika Day in Tokyo | analyzed | 72 |
| VID_202602_0002 | Cooking with AI Mika | analyzed | 65 |
| VID_202602_0003 | Morning Routine with AI Mika | draft | - |

### Step 5: Web App のデプロイ（API連携が必要な場合）

1. Apps Script エディタ → 「デプロイ」→「新しいデプロイメント」
2. タイプ: 「ウェブアプリ」を選択
3. 設定:
   - **実行するユーザー**: 自分
   - **アクセスできるユーザー**: 全員（リンクを知っている人のみ）
4. 「デプロイ」をクリック
5. 表示されるURLをコピー（n8n 連携で使用）

### Step 6: 動作確認

1. メニュー「Video Analytics v2」→「Status Dashboard」を実行
2. 以下を確認:
   - バージョンが `2.0.0` と表示される
   - 各シートのレコード数が表示される
   - OpenAI API Key が「Set」と表示される
   - 4つのインベントリが全て「Connected」と表示される

**全てが正常であれば、セットアップは完了です。**

---

## 付録: 用語集

| 用語 | 説明 |
|------|------|
| `video_uid` | システム内で動画を識別するユニークID。形式: `VID_YYYYMM_XXXX` |
| `component_id` | コンポーネントの固有ID。プレフィックスでタイプを識別 |
| `inventory` | コンポーネントの一覧を管理するスプレッドシート |
| `overall_score` | 全プラットフォーム総合のKPI達成スコア (0-100) |
| `avg_performance_score` | コンポーネントの平均パフォーマンススコア (0-100) |
| `completion_rate` | 動画を最後まで見た視聴者の割合 (0-1) |
| `engagement_rate` | (いいね + コメント + シェア) / 再生回数 |
| `ctr` | Click-Through Rate。インプレッションに対するクリック率 |
| `hook` | 動画冒頭の引き。最初の1-3秒で視聴者の注意を引く部分 |
| `body` | 動画の本編部分。メインコンテンツ |
| `CTA` | Call To Action。動画最後のアクション促進部分（フォロー、コメント等） |
| `GAS` | Google Apps Script。本システムのバックエンド |
| `n8n` | ワークフロー自動化ツール。APIを通じてGASと連携 |
| `KPI` | Key Performance Indicator。目標とする重要指標 |
| `LLM` | Large Language Model。OpenAI GPT-4o を使用 |
| `Draft` | 企画段階。コンポーネントを選択中 |
| `Approved` | 人間が承認済み。制作待ち |
| `In Production` | 動画生成中 |
| `Published` | 各プラットフォームに公開済み |
| `Analyzed` | 分析完了。スコアと改善提案が生成済み |

---

## 付録: リトライ設定

OpenAI API へのリクエストは、以下のエクスポネンシャルバックオフ戦略で自動リトライされます。

| 試行回数 | 待ち時間 |
|---------|---------|
| 1回目 | 即時実行 |
| 2回目 | 1秒後 |
| 3回目 | 2秒後 |
| 4回目 | 4秒後 |
| 5回目（最後） | 8秒後 |

リトライ上限に達しても失敗した場合は、エラーメッセージが表示されます。

---

## 付録: データフロー図

### CSVインポートからスコア更新までの流れ

```
[プラットフォーム CSV]
       |
       v
[CSVParser.gs] --- 列名エイリアスで自動マッピング
       |
       v
[Normalizer.gs] --- 統一スキーマに正規化
       |
       v
[Linker.gs] --- video_uid マッチング
       |                |
       v                v
  [linked]        [unlinked]
       |                |
       v                v
[metrics_* シート]  [unlinked_imports シート]
       |
       v
[master シートのメトリクス列を更新] (yt_views, tt_views, ig_views 等)
       |
       v
[KPIEngine.gs] --- kpi_targets と比較
       |
       v
[LLMAnalyzer.gs] --- OpenAI にプロンプト送信（コンポーネント情報付き）
       |
       +---> [analysis_reports シート] (全体レポート)
       +---> [recommendations シート] (改善提案)
       +---> [video_analysis シート] (個別分析)
       +---> [master シート] (overall_score, ai_next_* 更新)
       |
       v
[ScoreUpdater.gs] --- コンポーネントスコア再計算
       |
       v
[各インベントリスプレッドシート] (avg_performance_score, times_used 更新)
```

---

*このマニュアルは AI-Influencer GASアナリティクス v2.0 に基づいて作成されています。*
