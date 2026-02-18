# 技術スタック一覧

> v5.0で使用する全てのサービス・ライブラリ・インフラストラクチャ

## 目次

- [サーバー・インフラ](#サーバーインフラ)
- [AIエージェント層](#aiエージェント層)
  - [フレームワーク選定の比較結果](#フレームワーク選定の比較結果)
- [コンテンツ生成層](#コンテンツ生成層) — content_format 別の制作方法概要
  - [動画制作 — デフォルトレシピ（v4.0互換）](#動画制作--デフォルトレシピv40互換)
  - [代替ツール候補](#代替ツール候補)
  - [テキストコンテンツ制作](#テキストコンテンツ制作)
- [ダッシュボードUI技術スタック](#ダッシュボードui技術スタック)
  - [デザインシステム](#デザインシステム)
  - [認証・通知](#認証通知)
  - [ダッシュボード画面一覧](#ダッシュボード画面一覧)
- [投稿・計測プラットフォームAPI](#投稿計測プラットフォームapi)
- [開発・運用ツール](#開発運用ツール)
- [埋め込みモデル (pgvector用)](#埋め込みモデル-pgvector用)

## サーバー・インフラ

| コンポーネント | サービス | 用途 | 備考 |
|---|---|---|---|
| アプリケーションサーバー | Google Compute Engine (GCE) | 全Node.jsプロセスの実行環境 | 既存VM継続利用 |
| データベース | PostgreSQL 16+ (Cloud SQL) | 全構造化データの一元管理 | Cloud SQL (PostgreSQL) を Phase 1 から使用 |
| ベクトル拡張 | pgvector | 類似仮説・知見・トレンドのベクトル検索 | PostgreSQL拡張として追加 |
| ファイルストレージ | Google Drive (Shared Drive) | 動画・画像・音声ファイル保存 | 既存構造を継続 |
| プロセス管理 | PM2 | Node.jsプロセスの常駐管理・自動再起動 | 既存設定を拡張 |
| コンテナ化 | Docker + docker-compose | コンテナ化基盤 | 段階的導入（Phase 1からPostgreSQLを開始） |
| Docker: App | node:20-slim | アプリケーションコンテナのベースイメージ | 軽量Node.js 20 LTS |
| Docker: DB | pgvector/pgvector:pg16 | PostgreSQL + pgvectorコンテナ | dev環境用（本番はCloud SQL） |
| Docker: Pool | edoburu/pgbouncer:1.22 | コネクションプールコンテナ | Phase 5で導入 |
| 環境分離 | docker-compose.dev.yml / docker-compose.prod.yml | 開発/本番環境の分離 | 設定・シークレット・ポートを環境別に管理 |
| GCP Project | `video-analytics-hub` | GCE, Cloud SQL, Cloud API等 | 既存プロジェクト再利用 |
| コネクションプール | pgBouncer | Dashboard + MCP Serverの接続共有 | Phase 5で導入 |

## AIエージェント層

| コンポーネント | 技術 | バージョン | 用途 |
|---|---|---|---|
| オーケストレーション | LangGraph.js (@langchain/langgraph) | 0.2.19 | エージェントのグラフ定義・ステート管理・チェックポイント |
| LLM (戦略) | Claude Opus 4.6 | via @langchain/anthropic 0.3.x | 戦略エージェントの高度な推論 |
| LLM (計画・実行) | Claude Sonnet 4.5 | via @langchain/anthropic 0.3.x | アナリスト・プランナー・リサーチャー・データキュレーター・ワーカーのコスト効率実行 |
| ツールスペシャリスト | Claude Sonnet 4.5 | via @langchain/anthropic 0.3.x | AIツール特性の学習・最適ツール選択の推奨 |
| AI-DB接続 | MCP Server (自作) | Node.js | エージェントがPostgreSQLにアクセスするインターフェース (89 MCPツール + 13 REST API) |
| MCP Adapters | langchain-mcp-adapters | npm | LangGraphからMCPサーバーを呼び出すアダプター |

### フレームワーク選定の比較結果

9つのフレームワークを網羅的に調査し、LangGraph v1.0を選定。

| フレームワーク | JS/TS | MCP | マルチエージェント | 本番実績 | 判定 |
|---|---|---|---|---|---|
| **LangGraph v1.0** | ✅ 公式 | ✅ | ✅ Supervisor/階層型 | ✅ Uber,LinkedIn | **採用** |
| Claude Agent SDK | ✅ 公式 | ✅ ネイティブ | △ Teams実験的 | △ | v0.2.x |
| Mastra | ✅ TS専用 | ✅ 双方向 | ✅ Agent Network | △ 新しい | v1.3.0 |
| OpenAI Agents SDK | ✅ 公式 | ✅ 5種transport | ✅ Handoff | △ | v0.4.6 |
| CrewAI | ❌ Python | ✅ | ✅ Crew+Flow | ✅ Fortune500 | 言語不適合 |
| AutoGen | ❌ Python | ✅ | ✅ | △ | メンテモード |
| OpenClaw | ✅ TS | ❌ | △ ルーティングのみ | △ | 用途不適合 |
| Dify | △ ビジュアル | ✅ | △ | ✅ | プラットフォーム型 |
| n8n | △ ビジュアル | ✅ | △ | ✅ | プラットフォーム型 |

**LangGraph選定理由**:
1. 唯一のv1.0 GA安定版
2. Supervisorパターン + 階層Supervisorが公式サポート → 社長→部長→作業員の設計に直接マッピング
3. 耐久実行 (Durable Execution) → 12分の動画生成でもチェックポイントから再開可能
4. ステート管理が最成熟 → チェックポイント、タイムトラベル、クロスセッション記憶
5. JS/TS公式サポート (LangGraph.js)
6. MCP対応 (langchain-mcp-adapters)
7. 本番実績 (Uber, LinkedIn, Klarna)

## コンテンツ生成層

content_format に応じて制作方法とワーカーが異なる。

| content_format | 制作方法 | ワーカー種別 | レシピ必要 |
|---|---|---|---|
| `short_video` | AIツール組み合わせ（レシピ駆動） | Video Production Worker | ✅ ツールスペシャリストが選択 |
| `text_post` | LLMテキスト生成 | Text Production Worker | ❌ LLM直接生成 |
| `image_post` | AI画像生成 | （将来実装） | ✅ |

### 動画制作 — デフォルトレシピ（v4.0互換）

| コンポーネント | サービス | 用途 | コスト |
|---|---|---|---|
| 動画生成 | fal.ai (Kling v2.6) | Motion-control動画生成 | ~$0.35/セクション |
| TTS | Fish Audio (Direct REST API) | テキスト→音声変換 | ~$0.001/セクション |
| リップシンク | fal.ai (Sync Lipsync v2/pro) | 音声+動画の口パク同期 | ~$0.42/セクション |
| 動画結合 | ffmpeg | 3セクション結合 + 黒フレーム除去 | 無料 (ローカル) |
| 画像リサイズ | Sharp (Node.js) | Kling制限(3850px)対応 | 無料 |
| ファイルアップロード | fal.storage | 一時ファイルホスティング | fal.aiに含む |

制作ワーカー自体はLLMなし（実行のみ）だが、使用するツールと手順はツールスペシャリストAgentが決定。v4.0パイプラインはデフォルトレシピとして継続利用。

> **注**: これはv4.0互換のデフォルトレシピ。ツールスペシャリストが content_format、キャラクター特性、ニッチに応じて最適なレシピを選択する。全レシピ定義 → `production_recipes` テーブル（[03-database-schema.md](03-database-schema.md) 参照）

### 代替ツール候補

ツールスペシャリストが経験（`tool_experiences` テーブル）に基づき、品質・コスト・速度を考慮して最適なツールを選択する。コンテンツ要件に応じた使い分け例:

| カテゴリ | ツール | 特徴 | 主な使い分け |
|---|---|---|---|
| 動画生成 | Runway Gen-3 | 高品質、スタイル制御に強い | 高品質実写、西洋キャラクター |
| 動画生成 | Sora (OpenAI) | 長尺・物理シミュレーションに強い | 長尺、物理シミュレーション |
| 動画生成 | Pika | 高速・低コスト、短尺向き | アニメーション風、スタイライズド |
| TTS | ElevenLabs | 多言語・感情表現に強い | 多言語・感情表現 |
| リップシンク | Hedra | キャラクターアニメーション特化 | キャラクターアニメーション特化 |

### テキストコンテンツ制作

X投稿などのテキストコンテンツ生成。動画制作ワーカー（コード実行のみ）とは異なり、テキスト制作ワーカーはLLMベースで動作する。

| コンポーネント | 技術 | 用途 |
|---|---|---|
| テキスト生成LLM | Claude Sonnet 4.5 (LangGraph内で実行) | キャラ設定 + シナリオ → 投稿文生成 |
| フロー | キャラ設定読み込み → シナリオ適用 → 投稿文生成 → レビュー | テキストワーカーが実行 |

**入出力**:
- 入力: キャラクター設定（`personality` JSONB）+ シナリオ（`components.data`）+ プラットフォームルール
- 出力: 投稿テキスト（`content_sections.script`）

**プラットフォーム別フォーマット**:
| プラットフォーム | 制約 | 備考 |
|---|---|---|
| X | 280文字制限、ハッシュタグ | 短文特化、スレッド分割も対応 |
| Instagram | キャプション（2,200文字） | ハッシュタグ重要 |
| TikTok | キャプション（4,000文字） | トレンドタグ |
| YouTube | タイトル（100文字）+ 説明文（5,000文字） | SEOキーワード |

## ダッシュボードUI技術スタック

### フレームワーク

| コンポーネント | 技術 | バージョン | 用途 |
|---|---|---|---|
| フレームワーク | Next.js | 14.2.18 (App Router) | フルスタックReactフレームワーク |
| UIライブラリ | Shadcn/ui | latest (CLI生成) | UIコンポーネントライブラリ（Tailwind CSS ベース） |
| CSS | Tailwind CSS | 3.4.17 | ユーティリティファーストCSS |
| グラフ描画 | Recharts | 2.12.7 | KPIグラフ・チャート描画 |
| ダッシュボードUI | Tremor | 3.17.4 | ダッシュボード特化UIコンポーネント |
| DB接続 | Drizzle ORM | 0.36.x | PostgreSQLへの型安全クエリ。SQL-first、軽量ランタイム、TypeScript型推論に優れ、バイナリエンジン不要 |
| コードエディタ | Monaco Editor (@monaco-editor/react) | 4.x | プロンプト・設定値の編集UI。フルコード編集・シンタックスハイライト対応 |

### デザインシステム

#### カラーテーマ: Solarized

ダッシュボードのカラーテーマはSolarized（Ethan Schoonover設計）を採用。
Dark/Lightの切り替えは `system_settings.DASHBOARD_THEME` で制御（デフォルト: `dark`）。

| 役割 | Dark Mode | Light Mode | CSS Variable |
|------|-----------|------------|--------------|
| Background | `#002b36` (base03) | `#fdf6e3` (base3) | `--bg-primary` |
| Surface | `#073642` (base02) | `#eee8d5` (base2) | `--bg-surface` |
| Foreground | `#839496` (base0) | `#657b83` (base00) | `--fg-primary` |
| Secondary Text | `#586e75` (base01) | `#93a1a1` (base1) | `--fg-secondary` |
| Accent Blue | `#268bd2` | `#268bd2` | `--accent-blue` |
| Accent Cyan | `#2aa198` | `#2aa198` | `--accent-cyan` |
| Success | `#859900` (green) | `#859900` | `--status-success` |
| Warning | `#b58900` (yellow) | `#b58900` | `--status-warning` |
| Error | `#dc322f` (red) | `#dc322f` | `--status-error` |
| Info | `#268bd2` (blue) | `#268bd2` | `--status-info` |
| Border | `#586e75` | `#93a1a1` | `--border` |
| Border Subtle | `#073642` | `#eee8d5` | `--border-subtle` |
| Hover | `#073642` | `#eee8d5` | `--hover` |
| Focus Ring | `#268bd2` | `#268bd2` | `--focus-ring` |
| Chart 1 | `#268bd2` | `#268bd2` | `--chart-1` |
| Chart 2 | `#2aa198` | `#2aa198` | `--chart-2` |
| Chart 3 | `#859900` | `#859900` | `--chart-3` |
| Chart 4 | `#b58900` | `#b58900` | `--chart-4` |
| Chart 5 | `#d33682` | `#d33682` | `--chart-5` |

Shadow トークン:
| トークン | 値 |
|---------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.2)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.3)` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.3)` |

#### フォント: Nunito

| 用途 | フォント | サイズ | ウェイト |
|------|---------|-------|---------|
| 見出し (h1) | Nunito | 32px | 700 (Bold) |
| 見出し (h2) | Nunito | 24px | 600 (SemiBold) |
| 見出し (h3) | Nunito | 20px | 600 (SemiBold) |
| 本文 | Nunito | 14px | 400 (Regular) |
| ラベル | Nunito | 12px | 500 (Medium) |
| コード・ログ | JetBrains Mono | 13px | 400 (Regular) |

**タイポグラフィ詳細**:

| 要素 | line-height | letter-spacing |
|------|-------------|----------------|
| h1 | 1.2 | -0.02em |
| h2 | 1.3 | 0 |
| h3 | 1.4 | 0 |
| body | 1.6 | 0 |
| label | 1.4 | 0 |
| code | 1.5 | 0.05em |

**font-family フォールバック**: `'Nunito', 'Segoe UI', system-ui, -apple-system, sans-serif`

選定理由: 丸みを帯びたグリフデザインで親しみやすいUI。Google Fonts提供で無料。

#### レスポンシブデザイン

| ブレイクポイント | 幅 | レイアウト |
|---------------|-----|----------|
| Mobile | < 640px | 1カラム、ハンバーガーメニュー、カード縦積み |
| Tablet (sm) | 640-767px | 1カラム、コンパクトサイドバー |
| Tablet (md) | 768-1023px | 2カラム、折りたたみサイドバー |
| Desktop (lg) | 1024-1279px | マルチカラム、固定サイドバー |
| Wide (xl) | >= 1280px | マルチカラム、フルサイドバー |

モバイル対応方針:
- タッチターゲット: 最低44px × 44px
- カード型レイアウト: テーブルはモバイルでカード表示に変換
- プルダウンリフレッシュ: モバイルで下スワイプでデータ更新
- ボトムナビゲーション: モバイルではフッターにメインナビ配置

### 認証・通知

| 機能 | 初期実装 | 将来拡張 |
|------|---------|---------|
| 認証 | なし（localhost単一ユーザー） | NextAuth.js (OAuth) |
| 通知 | なし（ダッシュボード上のアラートのみ） | Slack webhook, Email |
| アクセス制御 | なし | RBAC (admin/viewer) |

### ダッシュボード画面一覧

| # | 画面名 | URL Path | 主要機能 |
|---|-------|----------|---------|
| 1 | ホーム | `/` | KPI概要、本日の制作状況、直近アラート |
| 2 | KPI | `/kpi` | アカウント別/期間別KPI進捗グラフ |
| 3 | 制作キュー | `/production` | task_queue一覧、優先度管理 |
| 4 | コンテンツレビュー | `/review` | pending_review一覧、承認/差戻し |
| 5 | コンテンツ一覧 | `/content` | 全content検索、フィルター |
| 6 | アカウント管理 | `/accounts` | CRUD、OAuth設定、認証情報 |
| 7 | キャラクター管理 | `/characters` | CRUD、アセットアップロード |
| 8 | エージェント | `/agents` | 状態、思考ログ、反省、学習 |
| 9 | 仮説ブラウザ | `/hypotheses` | 一覧、的中率推移、カテゴリ分析 |
| 10 | 知見ブラウザ | `/learnings` | 一覧、信頼度フィルター、類似検索 |
| 11 | ツール管理 | `/tools` | tool_catalog、レシピ、経験一覧 |
| 12 | エラーログ | `/errors` | failed/retryingタスク、操作 |
| 13 | コスト管理 | `/costs` | API支出、予算消化率 |
| 14 | 設定 | `/settings` | system_settings全項目編集 |
| 15 | 人間指示 | `/directives` | human_directives作成・履歴 |

## 投稿・計測プラットフォームAPI

| プラットフォーム | 投稿API | 計測API | 備考 |
|---|---|---|---|
| YouTube | YouTube Data API v3 | YouTube Analytics API | OAuth2必須。Shorts投稿対応 |
| TikTok | Content Posting API | TikTok API | 審査必要。申請に2-4週間 |
| Instagram | Instagram Graph API | Instagram Insights API | Metaビジネスアカウント必須 |
| X/Twitter | X API v2 | X API v2 | Premium必須 ($8/月/アカウント) |

## 開発・運用ツール

| ツール | 用途 |
|---|---|
| Node.js 20.11.1 LTS | ランタイム |
| TypeScript | 型安全な開発 (v5.0から導入) |
| Jest | テストフレームワーク |
| dotenv | 環境変数管理 |
| PM2 | プロセス管理・ログ管理 |
| clasp | GASデプロイ (レガシー、段階的廃止) |
| Docker + docker-compose | コンテナ化・環境統一 |
| Git + GitHub | バージョン管理 |

## 埋め込みモデル (pgvector用)

| 用途 | モデル | 次元数 | 備考 |
|---|---|---|---|
| 仮説の類似検索 | text-embedding-3-small (OpenAI) | 1536 | $0.02/MTok。広く利用され、十分なドキュメントが存在 |
| 市場調査の類似検索 | text-embedding-3-small (OpenAI) | 1536 | 同上 |
| 知見の類似検索 | text-embedding-3-small (OpenAI) | 1536 | 同上 |
