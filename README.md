# AI-Influencer

AIインフルエンサーによるショート動画の自動制作・投稿・分析パイプライン。

YouTube Shorts / TikTok / Instagram Reels / X に対応。Node.js パイプラインで動画生成から投稿まで自動化し、GAS アナリティクスでパフォーマンス分析・改善提案を行う。

## システム概要

```
シナリオ選択 → 動画生成(fal.ai) → プラットフォーム投稿 → メトリクス収集 → GAS分析 → 改善提案 → ループ
```

- **Pipeline (Node.js)**: シナリオ読み込み → 画像/動画生成(Kling) → TTS(ElevenLabs) → リップシンク(Lipsync) → 3セクション結合(ffmpeg) → Drive保存 → 投稿
- **Analytics (GAS)**: CSV取込 → KPI比較 → OpenAI分析 → コンポーネントスコア更新 → 次回動画推奨

## ディレクトリ構造

```
├── gas/                    # GAS アナリティクス（既存、変更なし）
│   ├── *.gs               # 14 GAS files
│   └── tests/             # 330 tests, 9 suites
├── pipeline/              # Node.js コンテンツパイプライン
│   ├── config.js          # 環境設定・API キー管理
│   ├── orchestrator.js    # 3セクション(hook/body/cta)パイプライン制御
│   ├── data/              # 静的データ
│   │   └── scenario.json  # シナリオテンプレート(3セクション)
│   ├── sheets/            # Google Sheets/Drive API 連携
│   ├── media/             # fal.ai メディア生成 + ffmpeg結合
│   │   ├── fal-client.js  # fal.ai SDK + fal.storage アップロード
│   │   ├── video-generator.js  # Kling v2.6 motion-control
│   │   ├── tts-generator.js    # ElevenLabs eleven-v3
│   │   ├── lipsync.js     # Sync Lipsync v2/pro
│   │   └── concat.js      # ffmpeg concat demuxer
│   ├── storage/           # Google Drive ストレージ
│   └── posting/           # プラットフォーム投稿アダプター（後続フェーズ）
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

## クイックスタート

### 前提条件

- Node.js 18+
- Google Cloud プロジェクト（video-analytics-hub）※GCP側の名前は変更不要
- fal.ai アカウント

### セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .env に以下を設定:
#   FAL_KEY=your-fal-api-key
#   GOOGLE_SHEETS_ID=1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg
#   GOOGLE_CREDENTIALS_PATH=./credentials.json
#   OPENAI_API_KEY=your-openai-api-key
```

### 主要コマンド

```bash
# 単一動画のパイプライン実行
node scripts/run-pipeline.js --character-folder <DRIVE_FOLDER_ID> [--dry-run]

# 日次バッチ（全アカウント）
node scripts/run-daily.js

# メトリクス収集
node scripts/collect-metrics.js

# GAS テスト実行
npm test
```

## 技術スタック

### 動画制作パイプライン（Node.js）

1本の動画は以下の3ステップ × 3セクション(hook/body/cta)で自動生成される:

| ステップ | サービス | 何をするか | コスト(10秒) |
|---|---|---|---|
| 1. 動画生成 | Kling 2.6 (motion-control) | キャラクター画像 + モーション参照動画 → 動画を生成 | $0.70 |
| 2. 音声生成 | ElevenLabs eleven-v3 | スクリプトテキスト → 音声を生成 (voice: Aria) | ~$0.04 |
| 3. リップシンク | Sync Lipsync v2/pro | 動画 + 音声 → 口同期動画 (sync_mode: bounce) | $0.50 |
| | | **セクション単価** | **$1.24** |
| | | **合計 (3セクション + ffmpeg結合)** | **~$3.72** |

### その他の技術

| レイヤー | 技術 | 用途 |
|---|---|---|
| アナリティクス | Google Apps Script | KPI分析・AI改善提案 |
| AI分析 | OpenAI GPT-4o | コンポーネント別パフォーマンス分析 |
| データベース | Google Sheets | マスター + 4インベントリ |
| ストレージ | Google Drive | 動画・アセット保存 |
| 投稿先 | YouTube / TikTok / Instagram / X | 4プラットフォーム |

## データ管理

**Google Drive（ファイル実体）+ Google Sheets（メタデータ管理）** の二層構造で全データを管理する。

- **Drive**: 動画、画像、音声などのファイル実体を保存
- **Sheets**: ID、プロパティ、ファイルリンクなどのメタデータを管理

この構造により、APIやAIからの一括アクセス、非エンジニアによるブラウザ操作、外部DB不要のシンプルな運用を実現する。

**起点フォルダ**: Shared Drives > Product > AI-Influencer

詳細は [ARCHITECTURE.md](ARCHITECTURE.md) の「データ管理方針」セクションを参照。

## GAS アナリティクス

既存の GAS アナリティクスシステム（v2.0）は変更なしで動作。詳細は [MANUAL.md](MANUAL.md) を参照。

- **14 GAS ファイル**: Code, Config, Setup, Migration, CSVParser, Normalizer, Linker, KPIEngine, LLMAnalyzer, SheetWriter, ComponentManager, MasterManager, ScoreUpdater, Utils
- **330 テスト / 9 スイート**: 全テストパス（+ パイプライン 21 テスト、計 351 tests across 10 suites）
- **Web App**: [デプロイ URL](https://script.google.com/macros/s/AKfycbzBcjrOBC1lIEJZFMl4D6Dz1TJQCjq8h5JaaapQ_qA4ZJIYs83iGNDN2oPj4OAR5GaK/exec)
- **API エンドポイント**: GET 5種 + POST 12種（詳細は [ARCHITECTURE.md](ARCHITECTURE.md)）

## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [STRATEGY.md](STRATEGY.md) | 戦略・KPI・収益モデル・会議メモ |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 技術アーキテクチャ・データフロー |
| [MANUAL.md](MANUAL.md) | GAS操作マニュアル（日本語） |
| [CONTEXT.md](CONTEXT.md) | プロジェクト履歴（英語） |

## ライセンス

Private - Internal Use Only
