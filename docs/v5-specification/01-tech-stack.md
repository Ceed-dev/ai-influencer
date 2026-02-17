# 技術スタック一覧

> v5.0で使用する全てのサービス・ライブラリ・インフラストラクチャ

## サーバー・インフラ

| コンポーネント | サービス | 用途 | 備考 |
|---|---|---|---|
| アプリケーションサーバー | Google Compute Engine (GCE) | 全Node.jsプロセスの実行環境 | 既存VM継続利用 |
| データベース | PostgreSQL 16+ (Cloud SQL) | 全構造化データの一元管理 | Cloud SQL (PostgreSQL) を Phase 1 から使用 |
| ベクトル拡張 | pgvector | 類似仮説・知見・トレンドのベクトル検索 | PostgreSQL拡張として追加 |
| ファイルストレージ | Google Drive (Shared Drive) | 動画・画像・音声ファイル保存 | 既存構造を継続 |
| プロセス管理 | PM2 | Node.jsプロセスの常駐管理・自動再起動 | 既存設定を拡張 |
| コンテナ化 | Docker + docker-compose | コンテナ化基盤 | 段階的導入（Phase 1からPostgreSQLを開始） |
| 環境分離 | docker-compose.dev.yml / docker-compose.prod.yml | 開発/本番環境の分離 | 設定・シークレット・ポートを環境別に管理 |
| GCP Project | `ai-influencer` | GCE, Cloud SQL, Cloud API等 | 新規専用プロジェクト |

## AIエージェント層

| コンポーネント | 技術 | バージョン | 用途 |
|---|---|---|---|
| オーケストレーション | LangGraph.js | v1.0 GA | エージェントのグラフ定義・ステート管理・チェックポイント |
| LLM (戦略・分析) | Claude Opus 4.6 | via Anthropic API | 戦略エージェント・アナリストの高度な推論 |
| LLM (計画・実行) | Claude Sonnet 4.5 | via Anthropic API | プランナー・リサーチャー・ワーカーのコスト効率実行 |
| ツールスペシャリスト | Claude Sonnet 4.5 | via Anthropic API | AIツール特性の学習・最適ツール選択の推奨 |
| AI-DB接続 | MCP Server (自作) | Node.js | エージェントがPostgreSQLにアクセスするインターフェース (~73ツール) |
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

### 代替ツール候補

ツールスペシャリストが経験に基づき、品質・コスト・速度を考慮して最適なツールを選択する。

| カテゴリ | ツール | 特徴 |
|---|---|---|
| 動画生成 | Runway Gen-3 | 高品質、スタイル制御に強い |
| 動画生成 | Sora (OpenAI) | 長尺・物理シミュレーションに強い |
| 動画生成 | Pika | 高速・低コスト、短尺向き |
| TTS | ElevenLabs | 多言語・感情表現に強い |
| リップシンク | Hedra | キャラクターアニメーション特化 |

### テキストコンテンツ制作

X投稿などのテキストコンテンツ生成。

| コンポーネント | 技術 | 用途 |
|---|---|---|
| テキスト生成 | Claude Sonnet (LangGraph内で実行) | キャラ設定 + シナリオ → 投稿文生成 |
| フロー | キャラ設定読み込み → シナリオ適用 → 投稿文生成 → レビュー | テキストワーカーが実行 |

## ダッシュボード

| コンポーネント | 技術 | 用途 |
|---|---|---|
| フレームワーク | Next.js | React SSR/SSGフレームワーク |
| UIライブラリ | Shadcn/ui | コンポーネントライブラリ |
| グラフ描画 | Recharts or Tremor | KPI推移・アルゴリズム精度のグラフ |
| DB接続 | Prisma or Drizzle ORM | PostgreSQLへの型安全クエリ |

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
| Node.js 20+ | ランタイム |
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
| 仮説の類似検索 | text-embedding-3-small (OpenAI) or Voyage-3 (Anthropic) | 1536 | コスト効率重視 |
| 市場調査の類似検索 | 同上 | 1536 | |
| 知見の類似検索 | 同上 | 1536 | |
