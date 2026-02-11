# AI-Influencer

AIインフルエンサーによるショート動画の自動制作・投稿・分析パイプライン。

YouTube Shorts / TikTok / Instagram Reels / X に対応。Node.js パイプラインで動画生成から投稿まで自動化し、GAS アナリティクスでパフォーマンス分析・改善提案を行う。


## ドキュメント一覧

このプロジェクトのドキュメントは以下のファイルに分かれています。目的に応じて参照してください。

| ドキュメント | 概要 | 対象読者 |
|---|---|---|
| **[README.md](README.md)**（本ファイル） | システム仕様・スキーマ・セットアップ手順・コスト構造の技術リファレンス | エンジニア |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | システム全体図・データフロー・API統合を図解で説明 | エンジニア / PM |
| **[docs/STRATEGY.md](docs/STRATEGY.md)** | KPI計画・収益モデル・フェーズ計画・会議メモ・TODO・意思決定ログ | PM / ビジネス |
| **[docs/manuals/OPERATIONS.md](docs/manuals/OPERATIONS.md)** | インベントリ管理・動画制作ワークフロー・トラブルシューティングの運用手順書 | オペレーター |
| **[docs/manuals/GAS_MANUAL.md](docs/manuals/GAS_MANUAL.md)** | GASアナリティクス（CSV取込・KPI分析・AI推奨）の操作マニュアル | オペレーター |
| **[docs/manuals/USER_GUIDE.md](docs/manuals/USER_GUIDE.md)** | 制作ループ全体の概要ガイド | 全チーム |
| **[docs/manuals/account-design-guide.md](docs/manuals/account-design-guide.md)** | 50アカウント運用に向けたペルソナ設計・インベントリ登録の完全ガイド | オペレーター / PM |
| **[docs/n8n-integration.md](docs/n8n-integration.md)** | GAS Web App との n8n ワークフロー連携ガイド | エンジニア |
| **[docs/cost-analysis/per-video-cost.md](docs/cost-analysis/per-video-cost.md)** | 1動画あたりのAPIコスト詳細分析（パイプライン実設定ベース） | PM / ビジネス |
| **[docs/cost-analysis/per-minute-cost.md](docs/cost-analysis/per-minute-cost.md)** | 1分あたりのAPIコスト分析（動画長に依存しない基本単価） | PM / ビジネス |


## 目次

1. [システム概要](#システム概要)
2. [パイプラインフロー詳細](#パイプラインフロー詳細)
3. [使用サービス詳細](#使用サービス詳細)
4. [Google Drive フォルダ構造](#google-drive-フォルダ構造)
5. [Google Sheets データスキーマ](#google-sheets-データスキーマ)
6. [ディレクトリ構造（コード）](#ディレクトリ構造コード)
7. [セットアップ](#セットアップ)
8. [使い方](#使い方)
9. [コスト構造](#コスト構造)
10. [GAS アナリティクス](#gas-アナリティクス)
11. [テスト](#テスト)
12. [関連ドキュメント](#関連ドキュメント)


## システム概要

```
シナリオ選択 → 動画生成(fal.ai) → プラットフォーム投稿 → メトリクス収集 → GAS分析 → 改善提案 → ループ
```

2つのサブシステムで構成される:

- **Pipeline (Node.js)**: キャラクター画像を入力 → 3セクション(hook/body/cta)の動画を自動生成 → Google Driveに保存
- **Analytics (GAS)**: 各プラットフォームからメトリクスCSVを取込 → KPI比較 → OpenAI分析 → コンポーネントスコア更新 → 次回動画推奨

v4.0 ではインベントリ実データ投入・パイプライン並列化が完了。3セクション並列処理により ~12分/本 で動画生成可能。投稿は手動で行う。


## パイプラインフロー詳細

### 概要図

```
入力（インベントリから自動読み取り or --video-id 指定）
  → [自動] inventory-reader.js: シナリオ・キャラ・モーション・音声のID解決
  → [自動] fal.storage に画像アップロード（一時URL生成）
  → [自動] 3セクション（hook/body/cta）並列処理（Promise.all）:
      各セクション内:
      ┌─ Kling motion-control で動画生成 ─┐ 並列
      └─ ElevenLabs eleven-v3 で音声生成 ─┘
      → Sync Lipsync v2/pro で口パク同期
  → [自動] ffmpeg で3セクション結合 → final.mp4
  → [自動] Google Drive に4ファイル保存（3セクション + final）
  → [自動] production タブに記録（production-manager.js）
  → [手動] 人間が各プラットフォームに投稿
```

> **処理時間**: ~12分/本（v3.1の~35分から約3倍高速化）

### 各ステップの詳細

#### Step 1: キャラクター画像の準備

パイプラインは最初に、指定されたDriveフォルダからキャラクター画像を取得する。Google Drive APIでファイルをバイナリとしてダウンロードし、fal.storageにアップロードする。fal.storageは一時的な公開URLを返す。この一時URLは、後続のfal.ai APIコール（Kling, ElevenLabs, Lipsync）がファイルを読み取るために必要。

- **入力**: Drive フォルダID（`--character-folder` 引数）
- **出力**: fal.storage の一時公開URL

#### Step 2: 3セクション並列処理

インベントリシートから読み取った3セクション（hook, body, cta）を **Promise.all で並列処理** する。各セクション内ではKlingとTTSも並列実行:

**Step 2a: モーション動画アップロード**
- セクションごとのモーション参照動画をDriveからダウンロード
- fal.storageにアップロードして一時URLを取得
- モーション動画は「こういう動きをしてほしい」というお手本の動画

**Step 2b: Kling motion-control（動画生成）**
- キャラクター画像 + モーション参照動画 → AI が動画を生成
- キャラクターがモーション動画と同じ動きをする動画が出力される
- 処理時間: 2〜5分/セクション

**Step 2c: ElevenLabs eleven-v3（音声生成）**
- scenario.json のスクリプトテキスト → 自然な音声ファイルを生成
- ボイス: Aria（女性、英語）
- 処理時間: 数秒

**Step 2d: Sync Lipsync v2/pro（口パク同期）**
- Step 2b の動画 + Step 2c の音声 → 口の動きを音声に合わせた動画
- sync_mode: bounce（自然な口パク合成）
- 処理時間: 1〜3分/セクション

#### Step 3: ffmpeg 結合

3セクションのリップシンク済み動画を ffmpeg の concat demuxer で結合して1本の最終動画（final.mp4）を出力する。Node.js の child_process.execFile で ffmpeg コマンドを実行。

#### Step 4: Drive 保存

Productions フォルダ配下に日付 + コンテンツID のフォルダを自動作成し、4ファイルをアップロード:
```
Productions/YYYY-MM-DD/VID_YYYYMM_XXXX/
├── 01_hook.mp4      # hookセクション単体
├── 02_body.mp4      # bodyセクション単体
├── 03_cta.mp4       # ctaセクション単体
└── final.mp4        # 3セクション結合版
```

#### Step 5: Sheets 記録

Master Spreadsheet の `production` タブに1行追加（v4.0、32カラム）。ビデオID、使用したインベントリID、ステータス、各動画のDriveリンク、処理時間、コスト等を記録する。処理中はステータスが段階的に更新される（processing → generating → ... → completed）。

> **Note**: v3.1以前の実行ログは `content_pipeline` タブに残る（後方互換）。新規実行は `production` タブに記録。


## 使用サービス詳細

### fal.ai（AIモデルホスティング）

[fal.ai](https://fal.ai) はAIモデルをAPI経由で実行できるプラットフォーム。個別のAIサービス（Kling, ElevenLabs, Lipsync）のAPIを統一的なインターフェースで利用できる。キュー管理、自動ポーリング、一時ファイルストレージ（fal.storage）も提供。

**なぜ fal.ai を使うのか**: 各AIサービスと個別にAPI契約するのではなく、fal.ai 1箇所で全てのモデルを従量課金で利用できる。SDKが統一されているためコードが簡潔。

- `fal-client.js`: fal.ai Node.js SDK のラッパー。リトライ処理、タイムアウト管理、fal.storage アップロード機能を提供。

### Kling v2.6 motion-control（AI動画生成）

[Kling](https://klingai.com) は画像からAI動画を生成するモデル。motion-control モードでは、キャラクター画像と参照モーション動画を入力として、キャラクターがモーションと同じ動きをする動画を出力する。

**なぜ Kling を使うのか**: 画像1枚から自然な動画を生成でき、モーション参照で動きを指定できる。fal.ai 経由で $0.07/秒（5秒で $0.35）と比較的安価。

- エンドポイント: `fal-ai/kling-video/v2.6/standard/motion-control`
- 入力: `image_url`（キャラ画像）, `video_url`（モーション参照）, `duration`（5秒）, `aspect_ratio`（9:16）, `character_orientation`（video）
- 出力: 動画URL

### ElevenLabs eleven-v3（AI音声合成 / TTS）

[ElevenLabs](https://elevenlabs.io) は高品質な音声合成AI。テキストを入力すると、指定したボイスで自然な音声を生成する。

**なぜ ElevenLabs を使うのか**: 最高品質のTTSモデルの一つ。多言語対応、感情表現、自然なイントネーション。fal.ai 経由で利用可能。

- エンドポイント: `fal-ai/elevenlabs/tts/eleven-v3`
- 入力: `text`（スクリプト）, `voice`（"Aria"）
- 出力: 音声URL（.mp3）

### Sync Lipsync v2/pro（口パク同期）

[Sync Labs](https://synclabs.so) のリップシンクAI。動画と音声を入力として、動画内の人物の口の動きを音声に合わせる。

**なぜ Lipsync を使うのか**: Kling が生成した動画はキャラが動くだけで喋らない。TTS音声と組み合わせて、口が音声に合わせて動く動画にする必要がある。

- エンドポイント: `fal-ai/sync-lipsync/v2/pro`
- 入力: `video_url`（動画）, `audio_url`（音声）, `sync_mode`（"bounce"）
- 出力: リップシンク済み動画URL

### ffmpeg（動画結合）

[ffmpeg](https://ffmpeg.org) はオープンソースの動画処理ツール。concat demuxer を使って複数の動画ファイルをカット無しで結合する。

**なぜ ffmpeg を使うのか**: 3セクションの個別動画を1本の投稿用動画に結合するため。再エンコードなし（コピーモード）で高速、品質劣化なし。Node.js の child_process から直接実行するため追加の npm パッケージ不要。

### fal.storage（一時ファイルストレージ）

fal.ai が提供する一時ファイル保存サービス。バイナリデータをアップロードすると一時的な公開URLを返す。

**なぜ fal.storage を使うのか**: fal.ai の各AIモデルは入力としてURLを要求する。Google Driveのファイルは認証なしではアクセスできないため、一度 fal.storage にアップロードして公開URLに変換する必要がある。以前は Cloudinary を使っていたが、fal.storage なら追加の外部サービス契約が不要。

### Google Drive（ファイルストレージ）

入力素材（キャラクター画像、モーション動画）の保管と、生成された動画の保存先。Google Drive API v3 で操作。

### Google Sheets（メタデータ管理）

全てのメタデータ（アカウント情報、パイプライン実行ログ、KPI等）を管理するデータベース代替。Google Sheets API v4 で操作。


## Google Drive フォルダ構造

```
AI-Influencer Root/ (Shared Drives > Product)
│
├── Characters/                          # キャラクターアセット
│   ├── Characters Inventory (Sheet)     # キャラクターマスタ（スプレッドシート）
│   └── Images/                          # キャラクター画像
│       ├── CHR_0001/                    # キャラクターごとのフォルダ
│       │   └── CHR_0001_v1.jpg          # キャラクター画像（パイプラインの入力）
│       ├── CHR_0002/
│       │   └── CHR_0002_v1.jpg
│       └── ...
│
├── Motions/                             # モーション参照動画（整理先、新規用）
│   ├── Hooks/                           # hookセクション用モーション動画
│   ├── Bodies/                          # bodyセクション用モーション動画
│   └── CTAs/                            # ctaセクション用モーション動画
│
├── Scenarios/                           # シナリオ素材
│   ├── Hooks/
│   ├── Bodies/
│   └── CTAs/
│
├── Audio/                               # 音声アセット
│   ├── BGM/                             # BGMファイル
│   └── Voice/                           # 音声ファイル
│
├── Productions/                         # 【出力】パイプライン生成物
│   └── YYYY-MM-DD/                      # 日付フォルダ（自動作成）
│       └── VID_YYYYMM_XXXX/            # コンテンツIDフォルダ（自動作成）
│           ├── 01_hook.mp4              # hookセクション動画
│           ├── 02_body.mp4              # bodyセクション動画
│           ├── 03_cta.mp4              # ctaセクション動画
│           └── final.mp4               # 3セクション結合版（投稿用）
│
├── Analytics/                           # GAS分析用データ
│   └── CSV_Imports/                     # プラットフォームCSVインポート先
│       ├── YouTube/
│       ├── TikTok/
│       └── Instagram/
│
├── prompts/                             # AI分析プロンプト
│   ├── base/                            # ベースプロンプト
│   └── learned/                         # 学習済みプロンプト
│
├── 動画/                                # レガシー（n8n時代の手動作業フォルダ）
│   ├── モーション/                       # 元のモーション参照動画（3本）
│   ├── 動画素材/
│   ├── 参考元動画/
│   └── 投稿動画/
│
└── runs/                                # レガシー（n8nワークフロー実行結果）
    └── YYYY-MM-DD_HH-MM-SS/            # 22回分の過去実行
```

### 命名規則

| 対象 | パターン | 例 |
|---|---|---|
| キャラクターフォルダ | `CHR_XXXX` | `CHR_0001` |
| キャラクター画像 | `CHR_XXXX_vN.jpg` | `CHR_0001_v1.jpg` |
| 動画ID | `VID_YYYYMM_XXXX` | `VID_202602_0001` |
| セクション動画 | `NN_セクション名.mp4` | `01_hook.mp4`, `02_body.mp4`, `03_cta.mp4` |
| 結合動画 | `final.mp4` | `final.mp4` |


## Google Sheets データスキーマ

全てのメタデータは Google Sheets で管理する（DBの代替）。

### Master Spreadsheet

**ID**: `1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg`

13タブで構成:

| タブ名 | 用途 | カテゴリ |
|---|---|---|
| `accounts` | アカウント管理 | パイプライン |
| `production` | 動画制作管理（v4.0新規、32カラム） | パイプライン |
| `content_pipeline` | パイプライン実行ログ（レガシー） | パイプライン |
| `master` | 動画マスター（既存GAS管理） | アナリティクス |
| `metrics_youtube` | YouTubeメトリクス | アナリティクス |
| `metrics_tiktok` | TikTokメトリクス | アナリティクス |
| `metrics_instagram` | Instagramメトリクス | アナリティクス |
| `kpi_targets` | KPI目標値 | アナリティクス |
| `analysis_reports` | AI分析レポート | アナリティクス |
| `recommendations` | AI改善提案 | アナリティクス |
| `video_analysis` | 動画別分析結果 | アナリティクス |
| `unlinked_imports` | 未リンクインポート | アナリティクス |
| `_config` | GAS設定値 | 設定 |

### `accounts` タブ

アカウント（ペルソナ × プラットフォーム）を管理する。1キャラクター × 1プラットフォーム = 1レコード。

| カラム | 型 | 説明 | なぜ必要か |
|---|---|---|---|
| `account_id` | string | 一意ID（例: `ACC_0001`） | アカウントを一意に識別するため |
| `persona_name` | string | ペルソナ名（例: "Mia Chen"） | キャラクターの人格設定。投稿時のプロフィール名にも使用 |
| `platform` | string | プラットフォーム（`youtube`/`tiktok`/`instagram`/`twitter`） | どのプラットフォームに投稿するかを決定するため |
| `account_handle` | string | アカウントハンドル（例: `@mia_ceo_tips`） | 投稿API呼び出し時にアカウントを特定するため |
| `character_id` | string | キャラクターID（例: `CHR_0001`） | Drive内のキャラクター画像フォルダと紐付けるため |
| `target_region` | string | ターゲット地域（例: `US`, `JP`） | コンテンツの言語やタイミングを地域最適化するため |
| `timezone` | string | タイムゾーン（例: `America/New_York`） | 投稿タイミングを現地時間で管理するため |
| `posting_window` | string | 投稿時間帯（例: `08:00-10:00`） | エンゲージメント最大化のための最適投稿時間 |
| `content_niche` | string | コンテンツジャンル（例: `startup_tips`） | シナリオ選択やAI分析時のカテゴリ分類 |
| `voice_id` | string | ElevenLabs ボイスID（例: `Aria`） | TTS音声生成時にどのボイスを使うかを指定するため |
| `status` | string | ステータス（`active`/`paused`/`banned`） | バッチ実行時にアクティブなアカウントのみ処理するため |
| `api_credential_key` | string | API認証キーの参照名 | プラットフォームAPIの認証情報を安全に参照するため |
| `last_posted_at` | datetime | 最終投稿日時 | 投稿頻度制限の管理とスケジューリングのため |

### `production` タブ（v4.0新規）

動画制作の本番管理タブ。32カラムで制作の全情報を記録。新規パイプライン実行はこのタブに記録される。

| # | カラム | 型 | 説明 |
|---|---|---|---|
| 1 | `video_id` | string | 一意ID（例: `VID_202602_0001`） |
| 2 | `account_id` | string | 紐付くアカウントID |
| 3 | `title` | string | 動画タイトル |
| 4 | `edit_status` | string | 編集ステータス（`draft`/`ready`/`done`） |
| 5 | `character_id` | string | キャラクターID |
| 6 | `hook_scenario_id` | string | hookシナリオID |
| 7 | `body_scenario_id` | string | bodyシナリオID |
| 8 | `cta_scenario_id` | string | ctaシナリオID |
| 9 | `hook_motion_id` | string | hookモーションID |
| 10 | `body_motion_id` | string | bodyモーションID |
| 11 | `cta_motion_id` | string | ctaモーションID |
| 12 | `voice_id` | string | TTS音声ID（例: `Aria`） |
| 13 | `pipeline_status` | string | パイプライン処理ステータス（自動更新） |
| 14 | `current_phase` | string | 現在の処理フェーズ（自動更新） |
| 15 | `hook_video_url` | url | hook動画のDriveリンク（自動記録） |
| 16 | `body_video_url` | url | body動画のDriveリンク（自動記録） |
| 17 | `cta_video_url` | url | cta動画のDriveリンク（自動記録） |
| 18 | `final_video_url` | url | 結合版動画のDriveリンク（自動記録） |
| 19 | `drive_folder_id` | string | 出力先DriveフォルダID（自動記録） |
| 20 | `error_message` | string | エラーメッセージ（自動記録） |
| 21 | `processing_time_sec` | number | 処理時間（秒）（自動記録） |
| 22 | `created_at` | datetime | レコード作成日時 |
| 23 | `updated_at` | datetime | 最終更新日時（自動更新） |
| 24 | `platform_post_ids` | string | プラットフォーム側投稿ID |
| 25 | `yt_views` | number | YouTube視聴数 |
| 26 | `yt_engagement` | number | YouTubeエンゲージメント |
| 27 | `tt_views` | number | TikTok視聴数 |
| 28 | `tt_engagement` | number | TikTokエンゲージメント |
| 29 | `ig_views` | number | Instagram視聴数 |
| 30 | `ig_engagement` | number | Instagramエンゲージメント |
| 31 | `overall_score` | number | 総合スコア |
| 32 | `analysis_date` | datetime | 分析実行日 |

> **ステータス遷移**: `edit_status=ready` かつ `pipeline_status` が空/queued の行がパイプライン処理対象。
> 処理中は `pipeline_status` が `processing` → `completed` / `error` に自動更新される。

### `content_pipeline` タブ（レガシー）

v3.1以前のパイプライン実行ログ。新規実行は `production` タブに記録される。

| カラム | 型 | 説明 | なぜ必要か |
|---|---|---|---|
| `content_id` | string | 一意ID（例: `VID_202602_0001`） | コンテンツを一意に識別。年月+連番で時系列順を保つ |
| `account_id` | string | 紐付くアカウントID | どのアカウントのコンテンツかを紐付けるため |
| `status` | string | 処理ステータス（下記参照） | パイプラインの進行状況を追跡しエラー検知するため |
| `character_folder_id` | string | Drive上のキャラクターフォルダID | どのキャラクター画像を使ったかを記録するため |
| `section_count` | number | セクション数（通常3） | 動画構成を記録。将来的にセクション数が可変になった場合に対応 |
| `hook_video_url` | url | hookセクション動画のDriveリンク | 個別セクション動画へのアクセスリンク |
| `body_video_url` | url | bodyセクション動画のDriveリンク | 個別セクション動画へのアクセスリンク |
| `cta_video_url` | url | ctaセクション動画のDriveリンク | 個別セクション動画へのアクセスリンク |
| `final_video_url` | url | 結合版動画のDriveリンク | 投稿用の最終動画へのアクセスリンク |
| `drive_folder_id` | string | 出力先DriveフォルダID | Driveフォルダへの直接アクセスのため |
| `platform_post_id` | string | 投稿後のプラットフォーム側ID | 投稿後のメトリクス取得時にコンテンツを特定するため |
| `views_48h` | number | 投稿後48時間の再生数 | 初期パフォーマンスの簡易指標 |
| `error_message` | string | エラーメッセージ | 失敗時のデバッグ情報を記録するため |
| `created_at` | datetime | レコード作成日時 | パイプライン開始時刻の記録 |
| `updated_at` | datetime | 最終更新日時 | ステータス変更の時刻追跡 |

**ステータス遷移**:
```
processing → uploading_image → generating_video_hook → generating_audio_hook → lip_syncing_hook
  → generating_video_body → ... → lip_syncing_cta → concatenating → uploading_to_drive → completed
  （エラー時は任意のステップから → error）
```

### インベントリスプレッドシート（5つ）

パイプラインの素材管理用。Master Spreadsheet とは別のスプレッドシート。v4.0で実データ投入済み。

| スプレッドシート | ID | 用途 |
|---|---|---|
| Scenarios | `13Meu7c...` | シナリオ（スクリプト、テーマ、ターゲット層等） |
| Motions | `1ycnmfp...` | モーション動画のメタデータ（Drive ID、カテゴリ等） |
| Characters | `1-m4f5L...` | キャラクター定義（名前、特徴、画像フォルダID等） |
| Audio | `1Dw_aty...` | BGM/ボイス素材のメタデータ |
| Accounts | v4.0新規 | アカウント情報（7アカウント + 12 Gmail認証情報） |

### GAS管理タブ（アナリティクス系）

| タブ名 | 用途 |
|---|---|
| `master` | 動画マスター。各動画のタイトル、投稿日、プラットフォーム、コンポーネント情報を管理 |
| `metrics_youtube` | YouTube Studioからエクスポートしたメトリクス（再生数、いいね、コメント等） |
| `metrics_tiktok` | TikTokアナリティクスからのメトリクス |
| `metrics_instagram` | Instagramインサイトからのメトリクス |
| `kpi_targets` | 月次KPI目標値（再生数、フォロワー増加、収益等） |
| `analysis_reports` | OpenAI GPT-4o による分析レポート出力先 |
| `recommendations` | 次回動画への改善提案（コンポーネント推奨等） |
| `video_analysis` | 動画単位の詳細分析結果 |
| `unlinked_imports` | CSVインポート時にマスターと紐付けできなかったレコード |
| `_config` | GAS設定値（API_KEY、分析パラメータ等） |


## ディレクトリ構造（コード）

```
├── gas/                    # GAS アナリティクス（既存、変更なし）
│   ├── *.gs               # 14 GAS files
│   └── tests/             # 330 tests, 9 suites
├── pipeline/              # Node.js コンテンツパイプライン (v4.0)
│   ├── config.js          # 環境設定・API キー管理（Accounts ID追加）
│   ├── orchestrator.js    # 3セクション並列処理(Promise.all) パイプライン制御
│   ├── data/              # 静的データ
│   │   └── scenario.json  # シナリオ定義（非推奨、インベントリ読み取りに移行）
│   ├── sheets/            # Google Sheets/Drive API 連携
│   │   ├── client.js      # OAuth2認証、Sheets/Drive API クライアント
│   │   ├── inventory-reader.js   # インベントリ読み取り + ID解決（v4.0新規）
│   │   ├── production-manager.js # productionタブ管理（v4.0新規）
│   │   ├── account-manager.js    # accounts タブ CRUD
│   │   └── content-manager.js    # content_pipeline タブ CRUD（レガシー）
│   ├── media/             # fal.ai メディア生成 + ffmpeg結合
│   │   ├── fal-client.js       # fal.ai SDK ラッパー + fal.storage + Drive download
│   │   ├── video-generator.js  # Kling v2.6 motion-control 動画生成
│   │   ├── tts-generator.js    # ElevenLabs eleven-v3 TTS音声生成
│   │   ├── lipsync.js          # Sync Lipsync v2/pro 口パク同期
│   │   └── concat.js           # ffmpeg concat demuxer 動画結合
│   ├── storage/           # Google Drive ストレージ
│   │   └── drive-storage.js    # Drive upload/download
│   └── posting/           # プラットフォーム投稿アダプター
│       ├── poster.js           # 統一投稿インターフェース
│       └── adapters/           # プラットフォーム別（後続フェーズ）
│           ├── youtube.js      # YouTube Data API
│           ├── instagram.js    # Instagram Business API（スタブ）
│           ├── tiktok.js       # TikTok Content Posting API（スタブ）
│           └── twitter.js      # X/Twitter v2 API（スタブ）
├── scripts/               # CLI エントリポイント
│   ├── run-pipeline.js    # パイプライン実行 (--video-id / --limit / --dry-run)
│   ├── run-daily.js       # 日次バッチ実行（後続フェーズ）
│   └── collect-metrics.js # メトリクス収集（後続フェーズ）
├── tests/                 # パイプラインテスト
│   └── pipeline.test.js   # 27 tests
├── docs/                  # ドキュメント
│   ├── STRATEGY.md        # 戦略・KPI・会議メモ
│   ├── ARCHITECTURE.md    # 技術アーキテクチャ
│   ├── n8n-integration.md # n8nワークフロー連携ガイド
│   └── manuals/           # ユーザー向けマニュアル
│       ├── OPERATIONS.md          # 運用マニュアル
│       ├── GAS_MANUAL.md          # GAS操作マニュアル
│       ├── USER_GUIDE.md          # 制作ループ概要ガイド
│       └── account-design-guide.md # アカウント設計ガイド
├── CONTEXT.md             # プロジェクト履歴（AI用）
└── README.md              # 技術リファレンス（本ファイル）
```


## セットアップ

### 前提条件

- Node.js 18+
- ffmpeg（`apt install ffmpeg` or `brew install ffmpeg`）
- Google Cloud プロジェクト（video-analytics-hub）
- fal.ai アカウント（APIキー取得済み）

### インストール

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
```

### .env 設定

```bash
FAL_KEY=your-fal-api-key          # fal.ai APIキー（必須）
GOOGLE_CREDENTIALS_PATH=./video_analytics_hub_claude_code_oauth.json  # Google OAuth認証ファイル
GOOGLE_TOKEN_PATH=./.gsheets_token.json   # Google OAuthトークン
MASTER_SPREADSHEET_ID=1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg  # Master SpreadsheetのID
ACCOUNTS_SPREADSHEET_ID=           # Accounts Inventory ID（v4.0）
YOUTUBE_CLIENT_ID=                 # YouTube投稿用（後続フェーズ）
YOUTUBE_CLIENT_SECRET=             # YouTube投稿用（後続フェーズ）
YOUTUBE_REFRESH_TOKEN=             # YouTube投稿用（後続フェーズ）
```


## 使い方

### CLI フラグ一覧（v4.0）

| フラグ | 説明 | 例 |
|---|---|---|
| `--video-id <ID>` | 特定のビデオIDを指定して生成（v4.0推奨） | `--video-id VID_202602_0001` |
| `--limit <N>` | 生成する動画数を制限（バッチ時） | `--limit 5` |
| `--dry-run` | APIを呼ばずにフローを確認 | `--dry-run` |
| `--character-folder <ID>` | キャラクターフォルダID指定（非推奨、v3.1互換） | `--character-folder 1zAZj...` |

### 動画生成

```bash
# v4.0 推奨: ビデオIDを指定して生成（インベントリから自動読み取り）
node scripts/run-pipeline.js --video-id <VIDEO_ID>

# バッチ実行: 最大N本を生成
node scripts/run-pipeline.js --limit 5

# ドライラン: APIを呼ばずにフローを確認
node scripts/run-pipeline.js --video-id <VIDEO_ID> --dry-run

# v3.1 互換（非推奨）: キャラクターフォルダIDを指定
node scripts/run-pipeline.js --character-folder <DRIVE_FOLDER_ID>
```

**例（v4.0）**:
```bash
node scripts/run-pipeline.js --video-id VID_202602_0001
```

**例（v3.1互換、初回E2Eテスト時）**:
```bash
node scripts/run-pipeline.js --character-folder 1zAZj-Cm3rLZ2oJHZDPUwvDfxL_ufS8g0
```

出力:
```
[pipeline:init] Video: VID_202602_0001, character: CHR_0001, voice: Aria
[pipeline:image] fal.storage URL: https://v3b.fal.media/files/...
[pipeline:parallel] Processing 3 sections in parallel...
[pipeline:hook] Kling done: https://...
[pipeline:body] Kling done: https://...
[pipeline:cta] Kling done: https://...
[pipeline:hook] Lipsync done
[pipeline:body] Lipsync done
[pipeline:cta] Lipsync done
[pipeline:concat] Final video: 54010069 bytes
[pipeline:drive] All files uploaded to Drive folder: ...
[pipeline:done] Pipeline complete! (~12min)
```

### その他のコマンド

```bash
# 日次バッチ（全アクティブアカウント） ※後続フェーズ
node scripts/run-daily.js

# メトリクス収集 ※後続フェーズ
node scripts/collect-metrics.js

# GAS テスト実行
npm test

# パイプラインテストのみ
npx jest tests/pipeline.test.js
```


## 技術スタック・外部API一覧

本プロジェクトが使用する全ての外部サービスとAPIの一覧。

### 動画生成パイプライン（有料API）

全て [fal.ai](https://fal.ai) 経由で利用。**プリペイド課金**（事前にクレジット購入が必要）。

| サービス | fal.ai エンドポイント | 用途 | 入力 → 出力 | 単価 | コスト/セクション(5秒) |
|---|---|---|---|---|---|
| **Kling 2.6** | `fal-ai/kling-video/v2.6/standard/motion-control` | AI動画生成 | キャラクター画像 + モーション参照動画 → 動画 | [$0.07/秒](https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control) | $0.35 |
| **ElevenLabs** | `fal-ai/elevenlabs/tts/eleven-v3` | テキスト音声合成 (TTS) | スクリプトテキスト → 音声ファイル | [$0.10/1K文字](https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3) | ~$0.01 |
| **Sync Lipsync** | `fal-ai/sync-lipsync/v2/pro` | リップシンク（口パク同期） | 動画 + 音声 → 口の動きを同期した動画 | [$5.00/分](https://fal.ai/models/fal-ai/sync-lipsync/v2/pro) | $0.42 |

### Google Cloud（無料枠内）

| サービス | 用途 | API制限 |
|---|---|---|
| **Google Sheets API** | インベントリ・production管理の読み書き | 300 req/min |
| **Google Drive API** | 動画・アセットファイルの保存・取得 | 12,000 req/100s |
| **YouTube Data API** | 動画投稿（Phase 2、未実装） | 10,000 units/day |

### その他

| サービス | 用途 | コスト |
|---|---|---|
| **OpenAI GPT-4o** | GAS分析: KPI分析・改善提案生成 | ~$0.01/分析 |
| **ffmpeg** | 3セクション動画の結合（ローカル実行） | 無料 |
| **TikTok Content API** | 動画投稿（Phase 2、未実装） | 無料 |
| **Instagram Graph API** | 動画投稿（Phase 2、未実装） | 無料 |

## コスト構造

> **料金参照元**: [fal.ai Pricing](https://fal.ai/pricing) — 2026-02-11時点

### 1セクション（5秒）あたり: $0.78

| ステップ | サービス | 単価 | コスト |
|---|---|---|---|
| 動画生成 | Kling 2.6 (motion-control) | $0.07/秒 × 5秒 | $0.35 |
| 音声生成 | ElevenLabs eleven-v3 | $0.10/1K文字 × ~50文字 | ~$0.01 |
| 口パク同期 | Sync Lipsync v2/pro | $5.00/分 × 5秒/60秒 | $0.42 |
| **セクション計** | | | **$0.78** |

### 1動画（3セクション = 15秒）あたり: ~$2.34

ffmpeg結合は無料（ローカル処理）。

> **コスト削減オプション**: Lipsync を Standard版（`v2`、$3.00/分）に変更すると ~$1.83/動画。画質は若干低下するが近接ショットでなければ十分。
>
> **詳細分析**: [1動画あたりのコスト分析](docs/cost-analysis/per-video-cost.md) / [1分あたりのコスト分析](docs/cost-analysis/per-minute-cost.md)

### 月間コスト見積もり

| 時期 | アカウント数 | 動画/日 | 月間動画 | 月間コスト(Pro) | 月間コスト(Std) |
|---|---|---|---|---|---|
| 2月 | 50 | 50 | 1,500 | $3,510 | $2,745 |
| 3月 | 160 | 160 | 4,800 | $11,232 | $8,784 |
| 4月 | 340 | 340 | 10,200 | $23,868 | $18,666 |
| 6月 | 700 | 700 | 21,000 | $49,140 | $38,430 |


## GAS アナリティクス

既存の GAS アナリティクスシステム（v2.0）は変更なしで動作。詳細は [GAS操作マニュアル](docs/manuals/GAS_MANUAL.md) を参照。

- **14 GAS ファイル**: Code, Config, Setup, Migration, CSVParser, Normalizer, Linker, KPIEngine, LLMAnalyzer, SheetWriter, ComponentManager, MasterManager, ScoreUpdater, Utils
- **Web App**: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`
- **API エンドポイント**: GET 5種 + POST 12種（詳細は [ARCHITECTURE.md](docs/ARCHITECTURE.md)）


## テスト

| スイート | テスト数 | 対象 |
|---|---|---|
| GAS テスト（9スイート） | 330 | GAS全モジュール |
| パイプラインテスト（1スイート） | 27 | メディア生成、CLI、スキーマ、ffmpeg結合、v4.0モジュール |
| **合計** | **357** | |

```bash
# 全テスト実行
npx jest

# GASテストのみ
npx jest gas/tests/

# パイプラインテストのみ
npx jest tests/pipeline.test.js
```


## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/STRATEGY.md](docs/STRATEGY.md) | 戦略・KPI・収益モデル・フェーズ計画・会議メモ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技術アーキテクチャ・データフロー・API仕様 |
| [docs/manuals/OPERATIONS.md](docs/manuals/OPERATIONS.md) | 運用マニュアル — インベントリ管理・動画制作ワークフロー |
| [docs/manuals/GAS_MANUAL.md](docs/manuals/GAS_MANUAL.md) | GAS分析操作マニュアル |
| [docs/manuals/USER_GUIDE.md](docs/manuals/USER_GUIDE.md) | 制作ループ全体の概要ガイド |
| [docs/manuals/account-design-guide.md](docs/manuals/account-design-guide.md) | アカウント設計ガイド |
| [docs/n8n-integration.md](docs/n8n-integration.md) | n8n ワークフロー連携ガイド |
| [docs/cost-analysis/per-video-cost.md](docs/cost-analysis/per-video-cost.md) | 1動画あたりのAPIコスト詳細分析 |
| [docs/cost-analysis/per-minute-cost.md](docs/cost-analysis/per-minute-cost.md) | 1分あたりのAPIコスト分析（基本単価） |


## ライセンス

MIT
