# AI-Influencer 技術アーキテクチャ

> **バージョン**: 3.0
> **最終更新**: 2026-02-09

---

## システム全体図

```mermaid
graph TB
    subgraph Pipeline["Pipeline (Node.js)"]
        ORC[orchestrator.js]
        MEDIA[media/]
        STORE[storage/]
        POST[posting/]
    end

    subgraph External["外部API"]
        FAL[fal.ai<br/>Kling / ElevenLabs / Lipsync]
        CREATIFY[Creatify<br/>動画合成]
        YT_API[YouTube Data API]
        IG_API[Instagram Graph API]
        TT_API[TikTok Content API]
        X_API[X/Twitter v2 API]
    end

    subgraph Analytics["Analytics (GAS)"]
        CODE[Code.gs<br/>Web App]
        CSV[CSVParser.gs]
        NORM[Normalizer.gs]
        LINK[Linker.gs]
        KPI[KPIEngine.gs]
        LLM[LLMAnalyzer.gs]
        SW[SheetWriter.gs]
        CM[ComponentManager.gs]
        MM[MasterManager.gs]
        SU[ScoreUpdater.gs]
    end

    subgraph Data["データ層 (Google)"]
        SHEETS[(Google Sheets<br/>Master + Inventories)]
        DRIVE[(Google Drive<br/>動画 / アセット)]
        OPENAI[OpenAI GPT-4o]
    end

    ORC --> MEDIA
    ORC --> STORE
    ORC --> POST
    MEDIA --> FAL
    MEDIA --> CREATIFY
    STORE --> DRIVE
    POST --> YT_API
    POST --> IG_API
    POST --> TT_API
    POST --> X_API
    ORC --> SHEETS

    CODE --> CSV --> NORM --> LINK
    LINK --> KPI --> LLM --> SW
    LLM --> OPENAI
    CM --> SHEETS
    MM --> SHEETS
    SU --> SHEETS
    SW --> SHEETS
```

### テキスト版

```
┌──────────────────────────────────────────────────────────────────┐
│                    Pipeline (Node.js)                             │
│                                                                  │
│  orchestrator.js ──► media/ ──► fal.ai (Kling/ElevenLabs/Sync)  │
│       │              │                                           │
│       │              └──► Creatify (合成)                        │
│       │                                                          │
│       ├──► storage/ ──► Google Drive                             │
│       │                                                          │
│       └──► posting/ ──► YouTube / Instagram / TikTok / X        │
│                                                                  │
│  sheets/ ◄──► Google Sheets (accounts, content_pipeline)         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Analytics (GAS v2.0) ※変更なし                  │
│                                                                  │
│  Code.gs ──► CSVParser ──► Normalizer ──► Linker                │
│                                              │                   │
│                                              ▼                   │
│  SheetWriter ◄── LLMAnalyzer ◄── KPIEngine                      │
│       │              │                                           │
│       ▼              ▼                                           │
│  ComponentManager  ScoreUpdater  MasterManager                   │
│       │              │              │                             │
│       ▼              ▼              ▼                             │
│              Google Sheets (Master + Inventories)                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## データフロー

### 動画制作フロー（Pipeline）

```
1. シナリオ選択
   Google Sheets (scenarios) → orchestrator.js

2. メディア生成
   画像アップロード → fal.ai Kling (動画生成)
   → fal.ai ElevenLabs (TTS) → fal.ai Lipsync
   → Creatify (最終合成)

3. 保存
   完成動画 → Google Drive (アカウント別フォルダ)

4. 投稿
   Google Drive → YouTube / Instagram / TikTok / X
   プラットフォームID → Google Sheets (master) に記録
```

### 分析フロー（GAS）※既存

```
1. CSV取込
   プラットフォームCSV → CSVParser → Normalizer → 統一スキーマ

2. リンク
   Linker: プラットフォームID ↔ video_uid マッチング

3. 分析
   KPIEngine: 目標値との比較・スコア算出
   LLMAnalyzer: OpenAI GPT-4o でコンポーネント別分析

4. 更新
   ScoreUpdater: コンポーネントスコア更新
   MasterManager: マスターシートの分析結果更新
   SheetWriter: 分析レポート・推奨事項を書き込み
```

---

## API統合

### fal.ai（メディア生成ハブ）

| サービス | 用途 | コスト/本 |
|---|---|---|
| Kling | AI動画生成 | $0.70 |
| ElevenLabs | テキスト音声合成 (TTS) | $0.04 |
| Lipsync | リップシンク | $0.83 |

### Creatify

| 用途 | コスト/本 |
|---|---|
| 最終動画合成 | $1.20 |

**合計: ~$2.77/本**

### Google APIs

| API | 用途 |
|---|---|
| Google Sheets API v4 | データ読み書き（パイプライン側） |
| Google Drive API v3 | 動画・アセット保存 |
| YouTube Data API v3 | 動画アップロード |

### プラットフォーム投稿API

| プラットフォーム | API | 制限 |
|---|---|---|
| YouTube | Data API v3 | 最も安定 |
| Instagram | Graph API (Business) | URL-basedのみ |
| TikTok | Content Posting API | 15投稿/日、審査必要 |
| X/Twitter | v2 API | レート制限厳しい |

### OpenAI（分析）

| 用途 | モデル |
|---|---|
| コンポーネント別パフォーマンス分析 | GPT-4o |
| 改善提案・次回コンポーネント推奨 | GPT-4o |

---

## Google Sheetsスキーマ

### 既存タブ（GAS管理、変更なし）

| タブ名 | 用途 | 管理 |
|---|---|---|
| master | 動画制作マスター (1行=1動画) | GAS |
| metrics_youtube | YouTube メトリクス | GAS |
| metrics_tiktok | TikTok メトリクス | GAS |
| metrics_instagram | Instagram メトリクス | GAS |
| kpi_targets | KPI目標値 | GAS |
| analysis_reports | 分析レポート | GAS |
| recommendations | AI推奨事項 | GAS |
| video_analysis | 動画分析結果 | GAS |
| unlinked_imports | 未リンクインポート | GAS |
| _config | 設定値 (APIキー等) | GAS |

### 新規タブ（Pipeline管理）

#### accounts

アカウント管理。1行=1プラットフォームアカウント。

| カラム | 型 | 説明 |
|---|---|---|
| account_id | String | 一意ID (ACC_0001) |
| platform | String | youtube / tiktok / instagram / x |
| account_name | String | アカウント名 |
| credentials_ref | String | 認証情報への参照 |
| status | String | active / paused / banned |
| daily_post_limit | Number | 1日あたりの投稿上限 |
| posts_today | Number | 本日の投稿数 |
| last_posted | DateTime | 最終投稿日時 |
| notes | String | メモ |

#### content_pipeline

パイプライン実行ログ。1行=1動画生成タスク。

| カラム | 型 | 説明 |
|---|---|---|
| pipeline_id | String | 一意ID (PIPE_0001) |
| video_uid | String | masterへのFK |
| account_id | String | 投稿先アカウント |
| status | String | queued / generating / uploading / posted / failed |
| scenario_id | String | 使用シナリオ |
| kling_job_id | String | fal.ai Kling ジョブID |
| tts_job_id | String | fal.ai TTS ジョブID |
| lipsync_job_id | String | fal.ai Lipsync ジョブID |
| creatify_job_id | String | Creatify ジョブID |
| drive_url | String | Google Drive URL |
| platform_post_id | String | プラットフォーム側の投稿ID |
| cost_usd | Number | 生成コスト (USD) |
| error_message | String | エラーメッセージ |
| created_at | DateTime | 作成日時 |
| completed_at | DateTime | 完了日時 |

### インベントリスプレッドシート（4つ、既存）

各コンポーネントタイプに1つずつ独立したスプレッドシート:

- **Scenarios Inventory** (`13Meu7cniKUr1JiEyKla0qhfiV9Az1IFuzIedzDxjpiY`)
- **Motions Inventory** (`1ycnmfpL8OgAI7WvlPTr3Z9p1H8UTmCNMV7ahunMlsEw`)
- **Characters Inventory** (`1-m4f5LgNmArtpECZqqxFL-6P4eabBmPkOYX2VkFHCHA`)
- **Audio Inventory** (`1Dw_atybwdGpi1Q0jh6CsuUSwzqVw1ZXB6jQT_-VDVak`)

共通カラム: component_id, type, name, description, file_link, tags, times_used, avg_performance_score, created_date, status

---

## GASモジュール一覧（変更なし）

| モジュール | 行数 | 役割 |
|---|---|---|
| Code.gs | 1157 | Web App エンドポイント + UIメニュー |
| Config.gs | 389 | 設定値、スキーマ、定数 |
| Setup.gs | 762 | ワンクリックセットアップ |
| Migration.gs | 224 | v1→v2 マイグレーション |
| CSVParser.gs | 190 | プラットフォーム別CSVパーサー |
| Normalizer.gs | 208 | 統一スキーマ変換 |
| Linker.gs | 238 | video_uid マッチング |
| KPIEngine.gs | 249 | KPI比較・スコア算出 |
| LLMAnalyzer.gs | 665 | OpenAI連携分析 |
| SheetWriter.gs | 275 | シート書き込み |
| ComponentManager.gs | 283 | コンポーネントCRUD |
| MasterManager.gs | 255 | マスターシート操作 |
| ScoreUpdater.gs | 212 | コンポーネントスコア |
| Utils.gs | 544 | ユーティリティ・ID生成 |

GAS API エンドポイント詳細は [MANUAL.md](MANUAL.md) を参照。

---

## n8n → Node.js コードマッピング

| n8n ノード | Node.js モジュール | 説明 |
|---|---|---|
| Google Sheets Read | pipeline/sheets/reader.js | シナリオ・アカウント情報の読み込み |
| HTTP Request (fal.ai) | pipeline/media/kling.js | Kling動画生成 |
| HTTP Request (ElevenLabs) | pipeline/media/tts.js | TTS音声生成 |
| HTTP Request (Lipsync) | pipeline/media/lipsync.js | リップシンク処理 |
| HTTP Request (Creatify) | pipeline/media/creatify.js | 最終合成 |
| Google Drive Upload | pipeline/storage/drive.js | Drive保存 |
| YouTube Upload | pipeline/posting/youtube.js | YouTube投稿 |
| Instagram Publish | pipeline/posting/instagram.js | Instagram投稿 |
| TikTok Publish | pipeline/posting/tiktok.js | TikTok投稿 |
| X Post | pipeline/posting/x.js | X投稿 |
| Google Sheets Write | pipeline/sheets/writer.js | 結果のシート書き込み |
| Schedule Trigger | scripts/run-daily.js | 日次バッチ (cron) |

---

## コスト見積もり

### 動画生成コスト（1本あたり）

| サービス | コスト |
|---|---|
| Kling (fal.ai) | $0.70 |
| TTS (ElevenLabs via fal.ai) | $0.04 |
| Lipsync (fal.ai) | $0.83 |
| Creatify | $1.20 |
| **合計** | **$2.77** |

### 月次コスト見積もり（動画生成のみ）

| 月 | アカウント数 | 推定動画本数/日 | 月間本数 | 月間コスト |
|---|---|---|---|---|
| 2月 | 50 | 50 | 1,500 | $4,155 |
| 3月 | 160 | 160 | 4,800 | $13,296 |
| 4月 | 340 | 340 | 10,200 | $28,254 |
| 5月 | 520 | 520 | 15,600 | $43,212 |
| 6月 | 700 | 700 | 21,000 | $58,170 |
