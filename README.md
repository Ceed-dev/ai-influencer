# AI-Influencer

AIインフルエンサーによるショート動画の自動制作・投稿・分析パイプライン。

YouTube Shorts / TikTok / Instagram Reels / X に対応。Node.js パイプラインで動画生成から投稿まで自動化し、GAS アナリティクスでパフォーマンス分析・改善提案を行う。

---

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

---

## システム概要

```
シナリオ選択 → 動画生成(fal.ai) → プラットフォーム投稿 → メトリクス収集 → GAS分析 → 改善提案 → ループ
```

2つのサブシステムで構成される:

- **Pipeline (Node.js)**: キャラクター画像を入力 → 3セクション(hook/body/cta)の動画を自動生成 → Google Driveに保存
- **Analytics (GAS)**: 各プラットフォームからメトリクスCSVを取込 → KPI比較 → OpenAI分析 → コンポーネントスコア更新 → 次回動画推奨

現在 Phase 0（コンテンツ生成パイプライン）が完成しており、入力を与えれば動画が自動生成されてDriveに溜まる状態。投稿は手動で行う。

---

## パイプラインフロー詳細

### 概要図

```
入力（キャラクター画像フォルダ@Drive）
  → [自動] fal.storage に画像アップロード（一時URL生成）
  → [自動] 3セクション（hook/body/cta）ループ:
      → 2a. Drive → fal.storage にモーション動画アップロード
      → 2b. Kling motion-control で動画生成（キャラ画像 + モーション参照）
      → 2c. ElevenLabs eleven-v3 で音声生成（スクリプト → 音声）
      → 2d. Sync Lipsync v2/pro で口パク同期（動画 + 音声 → リップシンク動画）
  → [自動] ffmpeg で3セクション結合 → final.mp4
  → [自動] Google Drive に4ファイル保存（3セクション + final）
  → [自動] content_pipeline シートに記録
  → [手動] 人間が各プラットフォームに投稿
```

### 各ステップの詳細

#### Step 1: キャラクター画像の準備

パイプラインは最初に、指定されたDriveフォルダからキャラクター画像を取得する。Google Drive APIでファイルをバイナリとしてダウンロードし、fal.storageにアップロードする。fal.storageは一時的な公開URLを返す。この一時URLは、後続のfal.ai APIコール（Kling, ElevenLabs, Lipsync）がファイルを読み取るために必要。

- **入力**: Drive フォルダID（`--character-folder` 引数）
- **出力**: fal.storage の一時公開URL

#### Step 2: 3セクション処理ループ

`scenario.json` に定義された3セクション（hook, body, cta）を順番に処理する。各セクションごとに以下のサブステップを実行:

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
Productions/YYYY-MM-DD/CNT_XXXX/
├── 01_hook.mp4      # hookセクション単体
├── 02_body.mp4      # bodyセクション単体
├── 03_cta.mp4       # ctaセクション単体
└── final.mp4        # 3セクション結合版
```

#### Step 5: Sheets 記録

Master Spreadsheet の `content_pipeline` タブに1行追加。コンテンツID、ステータス、各動画のDriveリンク、DriveフォルダIDなどを記録する。処理中はステータスが段階的に更新される（processing → generating_video_hook → ... → completed）。

---

## 使用サービス詳細

### fal.ai（AIモデルホスティング）

[fal.ai](https://fal.ai) はAIモデルをAPI経由で実行できるプラットフォーム。個別のAIサービス（Kling, ElevenLabs, Lipsync）のAPIを統一的なインターフェースで利用できる。キュー管理、自動ポーリング、一時ファイルストレージ（fal.storage）も提供。

**なぜ fal.ai を使うのか**: 各AIサービスと個別にAPI契約するのではなく、fal.ai 1箇所で全てのモデルを従量課金で利用できる。SDKが統一されているためコードが簡潔。

- `fal-client.js`: fal.ai Node.js SDK のラッパー。リトライ処理、タイムアウト管理、fal.storage アップロード機能を提供。

### Kling v2.6 motion-control（AI動画生成）

[Kling](https://klingai.com) は画像からAI動画を生成するモデル。motion-control モードでは、キャラクター画像と参照モーション動画を入力として、キャラクターがモーションと同じ動きをする動画を出力する。

**なぜ Kling を使うのか**: 画像1枚から自然な動画を生成でき、モーション参照で動きを指定できる。fal.ai 経由で $0.70/10秒 と比較的安価。

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

---

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
│       └── CNT_XXXXXX_XXXX/            # コンテンツIDフォルダ（自動作成）
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
| コンテンツID | `CNT_YYYYMM_XXXX` | `CNT_202602_2916` |
| セクション動画 | `NN_セクション名.mp4` | `01_hook.mp4`, `02_body.mp4`, `03_cta.mp4` |
| 結合動画 | `final.mp4` | `final.mp4` |

---

## Google Sheets データスキーマ

全てのメタデータは Google Sheets で管理する（DBの代替）。

### Master Spreadsheet

**ID**: `1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg`

12タブで構成:

| タブ名 | 用途 | カテゴリ |
|---|---|---|
| `accounts` | アカウント管理 | パイプライン |
| `content_pipeline` | パイプライン実行ログ | パイプライン |
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

### `content_pipeline` タブ

パイプラインの1回の実行 = 1行。全ての生成物のURLとステータスが記録される。

| カラム | 型 | 説明 | なぜ必要か |
|---|---|---|---|
| `content_id` | string | 一意ID（例: `CNT_202602_2916`） | コンテンツを一意に識別。年月+連番で時系列順を保つ |
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

### インベントリスプレッドシート（4つ）

パイプラインの素材管理用。Master Spreadsheet とは別のスプレッドシート。

| スプレッドシート | ID | 用途 |
|---|---|---|
| Scenarios | `13Meu7c...` | シナリオ（スクリプト、テーマ、ターゲット層等） |
| Motions | `1ycnmfp...` | モーション動画のメタデータ（Drive ID、カテゴリ等） |
| Characters | `1-m4f5L...` | キャラクター定義（名前、特徴、画像フォルダID等） |
| Audio | `1Dw_aty...` | BGM/ボイス素材のメタデータ |

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

---

## ディレクトリ構造（コード）

```
├── gas/                    # GAS アナリティクス（既存、変更なし）
│   ├── *.gs               # 14 GAS files
│   └── tests/             # 330 tests, 9 suites
├── pipeline/              # Node.js コンテンツパイプライン
│   ├── config.js          # 環境設定・API キー管理
│   ├── orchestrator.js    # 3セクション(hook/body/cta)パイプライン制御
│   ├── data/              # 静的データ
│   │   └── scenario.json  # シナリオ定義(3セクション、スクリプト、モーションDrive ID)
│   ├── sheets/            # Google Sheets/Drive API 連携
│   │   ├── client.js      # OAuth2認証、Sheets/Drive API クライアント
│   │   ├── account-manager.js  # accounts タブ CRUD
│   │   └── content-manager.js  # content_pipeline タブ CRUD
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
│   ├── run-pipeline.js    # パイプライン実行 (--character-folder)
│   ├── run-daily.js       # 日次バッチ実行（後続フェーズ）
│   └── collect-metrics.js # メトリクス収集（後続フェーズ）
├── tests/                 # パイプラインテスト
│   └── pipeline.test.js   # 21 tests
├── docs/                  # 追加ドキュメント
├── STRATEGY.md            # 戦略・KPI・会議メモ
├── ARCHITECTURE.md        # 技術アーキテクチャ
├── CONTEXT.md             # プロジェクト履歴（英語）
└── MANUAL.md              # GAS操作マニュアル
```

---

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
YOUTUBE_CLIENT_ID=                 # YouTube投稿用（後続フェーズ）
YOUTUBE_CLIENT_SECRET=             # YouTube投稿用（後続フェーズ）
YOUTUBE_REFRESH_TOKEN=             # YouTube投稿用（後続フェーズ）
```

---

## 使い方

### 単一動画の生成

```bash
# 本番実行: キャラクターフォルダIDを指定して動画を生成
node scripts/run-pipeline.js --character-folder <DRIVE_FOLDER_ID>

# ドライラン: APIを呼ばずにフローを確認
node scripts/run-pipeline.js --character-folder <DRIVE_FOLDER_ID> --dry-run
```

**例（初回E2Eテスト時）**:
```bash
node scripts/run-pipeline.js --character-folder 1zAZj-Cm3rLZ2oJHZDPUwvDfxL_ufS8g0
```

出力:
```
[pipeline:init] Content ID: CNT_202602_2916, sections: 3
[pipeline:image] fal.storage URL: https://v3b.fal.media/files/...
[pipeline:hook] --- Processing section 1: hook ---
[pipeline:hook] Kling done: https://...
[pipeline:hook] TTS done: https://...
[pipeline:hook] Lipsync done: https://...
[pipeline:hook] Section hook complete (7748776 bytes)
[pipeline:body] --- Processing section 2: body ---
...
[pipeline:cta] Section cta complete (20768547 bytes)
[pipeline:concat] Final video: 54010069 bytes
[pipeline:drive] All files uploaded to Drive folder: ...
[pipeline:done] Pipeline complete! Content ID: CNT_202602_2916
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

---

## コスト構造

### 1セクション（約10秒）あたり

| ステップ | サービス | コスト |
|---|---|---|
| 動画生成 | Kling 2.6 (motion-control) | $0.70 |
| 音声生成 | ElevenLabs eleven-v3 | ~$0.04 |
| 口パク同期 | Sync Lipsync v2/pro | $0.50 |
| **セクション計** | | **$1.24** |

### 1動画（3セクション）あたり: ~$3.72

ffmpeg結合は無料（ローカル処理）。

### 月間コスト見積もり

| 時期 | アカウント数 | 動画/日 | 月間動画 | 月間コスト |
|---|---|---|---|---|
| 2月 | 50 | 50 | 1,500 | $5,580 |
| 3月 | 160 | 160 | 4,800 | $17,856 |
| 6月 | 700 | 700 | 21,000 | $78,120 |

---

## GAS アナリティクス

既存の GAS アナリティクスシステム（v2.0）は変更なしで動作。詳細は [MANUAL.md](MANUAL.md) を参照。

- **14 GAS ファイル**: Code, Config, Setup, Migration, CSVParser, Normalizer, Linker, KPIEngine, LLMAnalyzer, SheetWriter, ComponentManager, MasterManager, ScoreUpdater, Utils
- **Web App**: [デプロイ URL](https://script.google.com/macros/s/AKfycbzBcjrOBC1lIEJZFMl4D6Dz1TJQCjq8h5JaaapQ_qA4ZJIYs83iGNDN2oPj4OAR5GaK/exec)
- **API エンドポイント**: GET 5種 + POST 12種（詳細は [ARCHITECTURE.md](ARCHITECTURE.md)）

---

## テスト

| スイート | テスト数 | 対象 |
|---|---|---|
| GAS テスト（9スイート） | 330 | GAS全モジュール |
| パイプラインテスト（1スイート） | 21 | メディア生成、CLI、スキーマ、ffmpeg結合 |
| **合計** | **351** | |

```bash
# 全テスト実行
npx jest

# GASテストのみ
npx jest gas/tests/

# パイプラインテストのみ
npx jest tests/pipeline.test.js
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [STRATEGY.md](STRATEGY.md) | 戦略・KPI・収益モデル・フェーズ計画・会議メモ |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 技術アーキテクチャ・データフロー・API仕様 |
| [MANUAL.md](MANUAL.md) | GAS操作マニュアル（日本語） |
| [CONTEXT.md](CONTEXT.md) | プロジェクト履歴（英語） |

---

## ライセンス

Private - Internal Use Only
