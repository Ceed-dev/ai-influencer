# AI-Influencer

AIインフルエンサーによるショート動画の自動制作・投稿・分析パイプライン。

YouTube Shorts / TikTok / Instagram Reels / X に対応。Node.js パイプラインで動画生成から投稿まで自動化し、GAS アナリティクスでパフォーマンス分析・改善提案を行う。

## システム概要

```
シナリオ選択 → 動画生成(fal.ai) → プラットフォーム投稿 → メトリクス収集 → GAS分析 → 改善提案 → ループ
```

- **Pipeline (Node.js)**: シナリオ読み込み → 画像/動画生成 → TTS → リップシンク → 合成 → Drive保存 → 投稿
- **Analytics (GAS)**: CSV取込 → KPI比較 → OpenAI分析 → コンポーネントスコア更新 → 次回動画推奨

## ディレクトリ構造

```
├── gas/                    # GAS アナリティクス（既存、変更なし）
│   ├── *.gs               # 14 GAS files
│   └── tests/             # 330 tests, 9 suites
├── pipeline/              # Node.js コンテンツパイプライン（新規）
│   ├── config.js          # 環境設定・API キー管理
│   ├── orchestrator.js    # パイプライン全体制御
│   ├── sheets/            # Google Sheets API 連携
│   ├── media/             # fal.ai メディア生成
│   ├── storage/           # Google Drive ストレージ
│   └── posting/           # プラットフォーム投稿アダプター
├── scripts/               # CLI エントリポイント
│   ├── run-pipeline.js    # 単一動画パイプライン実行
│   ├── run-daily.js       # 日次バッチ実行
│   ├── collect-metrics.js # メトリクス収集
│   └── gsheet.py          # Sheets CLI ユーティリティ（既存）
├── docs/                  # 追加ドキュメント
├── STRATEGY.md            # 戦略・KPI・会議メモ
├── ARCHITECTURE.md        # 技術アーキテクチャ
├── CONTEXT.md             # プロジェクト履歴（英語）
└── MANUAL.md              # GAS操作マニュアル
```

## クイックスタート

### 前提条件

- Node.js 18+
- Google Cloud プロジェクト（video-analytics-hub）
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
node scripts/run-pipeline.js --scenario SCN_H_0001

# 日次バッチ（全アカウント）
node scripts/run-daily.js

# メトリクス収集
node scripts/collect-metrics.js

# GAS テスト実行
npm test

# Sheets CLI（直接操作）
/tmp/google-auth-venv/bin/python3 scripts/gsheet.py read master
```

## 技術スタック

### 動画制作パイプライン（Node.js）

1本の動画は以下の4ステップで自動生成される（全て [fal.ai](https://fal.ai) 経由）:

| ステップ | サービス | 何をするか | コスト(10秒) |
|---|---|---|---|
| 1. 動画生成 | Kling 2.6 | キャラクター画像から動画を生成 | $0.70 |
| 2. 音声生成 | ElevenLabs v3 | スクリプトテキストから音声を生成 | ~$0.04 |
| 3. リップシンク | Sync Lipsync v2 | 動画と音声の口の動きを同期 | $0.50 |
| 4. 最終合成 | Creatify Aurora | 最終的な動画の仕上げ・合成 | $1.40 |
| | | **合計** | **$2.64** |

### その他の技術

| レイヤー | 技術 | 用途 |
|---|---|---|
| アナリティクス | Google Apps Script | KPI分析・AI改善提案 |
| AI分析 | OpenAI GPT-4o | コンポーネント別パフォーマンス分析 |
| データベース | Google Sheets | マスター + 4インベントリ |
| ストレージ | Google Drive | 動画・アセット保存 |
| 画像ホスティング | Cloudinary | キャラクター画像のアップロード |
| 投稿先 | YouTube / TikTok / Instagram / X | 4プラットフォーム |

## GAS アナリティクス

既存の GAS アナリティクスシステム（v2.0）は変更なしで動作。詳細は [MANUAL.md](MANUAL.md) を参照。

- **14 GAS ファイル**: Code, Config, Setup, Migration, CSVParser, Normalizer, Linker, KPIEngine, LLMAnalyzer, SheetWriter, ComponentManager, MasterManager, ScoreUpdater, Utils
- **330 テスト / 9 スイート**: 全テストパス
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
