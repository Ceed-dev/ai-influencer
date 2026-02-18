# 10. 実装ガイド: Claude Code Agent Team 並列実装

> v5.0仕様書（01-09）に基づいてClaude Code Agent Teamが並列実装を行うための指示書。
> 人間（Shungo）はコードを一切書かず、指示・レビュー・承認のみを行う。
>
> **最大同時エージェント**: リーダー1 + チームメイト10
>
> **関連ドキュメント**: [06-development-roadmap.md](06-development-roadmap.md) (ロードマップ), [04-agent-design.md](04-agent-design.md) (エージェント設計), [03-database-schema.md](03-database-schema.md) (DBスキーマ), [11-pre-implementation-checklist.md](11-pre-implementation-checklist.md) (実装前チェックリスト)

## 目次

- [1. 概要](#1-概要)
  - [1.1 前提条件](#11-前提条件)
- [2. チーム構成](#2-チーム構成)
  - [2.1 リーダーAgent（1名）](#21-リーダーagent1名)
  - [2.2 チームメイト（10名）](#22-チームメイト10名)
- [3. ディレクトリ構造](#3-ディレクトリ構造)
- [4. モジュール間インターフェース](#4-モジュール間インターフェース)
  - [4.1 全モジュール共通: types/ ディレクトリ](#41-全モジュール共通-types-ディレクトリ)
  - [4.2 MCP Server ↔ エージェント/ワーカー](#42-mcp-server--エージェントワーカー)
  - [4.3 ダッシュボード ↔ MCP Server](#43-ダッシュボード--mcp-server)
  - [4.4 エージェント ↔ DB](#44-エージェント--db)
- [5. 実装プロトコル](#5-実装プロトコル)
  - [5.1 コーディング規約](#51-コーディング規約)
  - [5.2 ブランチ戦略](#52-ブランチ戦略)
  - [5.3 コンフリクト回避](#53-コンフリクト回避)
  - [5.4 日次プロトコル](#54-日次プロトコル)
- [6. 各エージェントの詳細タスク](#6-各エージェントの詳細タスク)
  - [6.1 infra-agent](#61-infra-agentweek-1-2-集中week-3以降はサポート)
  - [6.2 mcp-core-agent](#62-mcp-core-agentweek-1-4)
  - [6.3 mcp-intel-agent](#63-mcp-intel-agentweek-1-4)
  - [6.4 video-worker-agent](#64-video-worker-agentweek-1-4)
  - [6.5 text-post-agent](#65-text-post-agentweek-1-4)
  - [6.6 measure-agent](#66-measure-agentweek-1-4)
  - [6.7 intelligence-agent](#67-intelligence-agentweek-1-5)
  - [6.8 strategy-agent](#68-strategy-agentweek-1-5)
  - [6.9 dashboard-agent](#69-dashboard-agentweek-1-5)
  - [6.10 test-agent](#610-test-agentweek-1-7)
- [7. 人間（Shungo）の作業](#7-人間shungoの作業)

---

## 1. 概要

本ドキュメントは、v5.0仕様書（01-09）に基づいてClaude Code Agent Teamが並列実装を行うための指示書である。
人間（Shungo）はコードを一切書かず、指示・レビュー・承認のみを行う。

### 1.1 前提条件

| 項目 | 要件 |
|------|------|
| 仕様書 | 全仕様書（01-11）が最終承認済み |
| 型定義 | TypeScript型定義ファイルが生成・凍結済み |
| プロンプト | 全プロンプトファイル（prompts/*.md）が作成済み |
| VM環境 | GCE 16GB RAM, 4vCPU |
| 同時エージェント上限 | リーダー1 + チームメイト10 |

---

## 2. チーム構成

### 2.1 リーダーAgent（1名）

| 項目 | 内容 |
|------|------|
| 役割 | タスク割り振り、進捗管理、コードレビュー、統合テスト指揮 |
| ツール | 全ツール利用可能 |

**責務**:

1. `TeamCreate` → `TaskCreate` → `Task`（チームメイト起動）→ `TaskUpdate`
2. コンフリクト検出・解決
3. モジュール間インターフェースの整合性確認
4. 統合テストの実行・管理

### 2.2 チームメイト（10名）

| # | エージェント名 | subagent_type | 担当モジュール |
|---|-------------|--------------|-------------|
| 1 | infra-agent | general-purpose | Docker + PostgreSQL + DDL + マイグレーション |
| 2 | mcp-core-agent | general-purpose | MCP Server コアCRUDツール（~50ツール） |
| 3 | mcp-intel-agent | general-purpose | MCP Server インテリジェンスツール（~52ツール） |
| 4 | video-worker-agent | general-purpose | 動画制作ワーカー + fal.ai連携 |
| 5 | text-post-agent | general-purpose | テキスト制作 + 4PF投稿アダプター |
| 6 | measure-agent | general-purpose | 計測ワーカー + 4PF APIアダプター |
| 7 | intelligence-agent | general-purpose | LangGraph + Researcher/Analyst/ToolSP/DataCurator |
| 8 | strategy-agent | general-purpose | Strategy Cycle Graph + Planner |
| 9 | dashboard-agent | general-purpose | Next.js ダッシュボード全15画面 |
| 10 | test-agent | general-purpose | Jest + E2E + CI |

---

## 3. ディレクトリ構造

```
ai-influencer-v5/
├── docker-compose.yml          # infra-agent
├── docker-compose.dev.yml      # infra-agent (dev overrides)
├── Dockerfile                  # infra-agent
├── .env.example               # infra-agent
├── package.json               # リーダーが初期生成
├── tsconfig.json              # リーダーが初期生成
│
├── types/                     # リーダーがWeek 0-1で生成（凍結）
│   ├── database.ts            # 全26テーブルのRow型
│   ├── mcp-tools.ts           # 全MCPツールの入出力型
│   ├── langgraph-state.ts     # 全4グラフのステート型
│   └── api-schemas.ts         # ダッシュボードAPI型
│
├── sql/                       # infra-agent
│   ├── 001_create_tables.sql  # DDL（26テーブル）
│   ├── 002_create_indexes.sql # インデックス
│   ├── 003_create_triggers.sql # トリガー
│   ├── 004_seed_settings.sql  # system_settings初期データ
│   └── 005_seed_prompts.sql   # agent_prompt_versions初期データ
│
├── src/
│   ├── mcp-server/            # mcp-core-agent + mcp-intel-agent
│   │   ├── index.ts           # MCP Server エントリポイント
│   │   ├── tools/
│   │   │   ├── entity/        # accounts, characters, components CRUD
│   │   │   ├── production/    # content, sections, publications CRUD
│   │   │   ├── intelligence/  # hypotheses, market_intel, metrics, analyses, learnings
│   │   │   ├── operations/    # cycles, human_directives, task_queue
│   │   │   ├── observability/ # thought_logs, reflections, individual_learnings, communications
│   │   │   ├── tool-mgmt/     # tool_catalog, tool_experiences, production_recipes
│   │   │   ├── system/        # system_settings CRUD
│   │   │   └── dashboard/     # KPI集計, アルゴリズム精度, コスト集計
│   │   └── db.ts              # PostgreSQL接続管理
│   │
│   ├── workers/               # video-worker-agent, text-post-agent, measure-agent
│   │   ├── video-production/
│   │   │   ├── orchestrator.ts
│   │   │   ├── fal-client.ts
│   │   │   ├── fish-audio.ts
│   │   │   └── ffmpeg.ts
│   │   ├── text-production/
│   │   │   └── text-generator.ts
│   │   ├── posting/
│   │   │   ├── scheduler.ts
│   │   │   ├── adapters/
│   │   │   │   ├── youtube.ts
│   │   │   │   ├── tiktok.ts
│   │   │   │   ├── instagram.ts
│   │   │   │   └── x.ts
│   │   │   └── token-refresher.ts
│   │   └── measurement/
│   │       ├── collector.ts
│   │       └── adapters/
│   │           ├── youtube-analytics.ts
│   │           ├── tiktok-analytics.ts
│   │           ├── instagram-insights.ts
│   │           └── x-analytics.ts
│   │
│   ├── agents/                # intelligence-agent, strategy-agent
│   │   ├── graphs/
│   │   │   ├── strategy-cycle.ts    # 戦略サイクルグラフ
│   │   │   ├── production-pipeline.ts # 制作パイプライングラフ
│   │   │   ├── publishing-scheduler.ts # 投稿スケジューラーグラフ
│   │   │   └── measurement-jobs.ts   # 計測ジョブグラフ
│   │   ├── nodes/
│   │   │   ├── strategist.ts
│   │   │   ├── researcher.ts
│   │   │   ├── analyst.ts
│   │   │   ├── planner.ts
│   │   │   ├── tool-specialist.ts
│   │   │   └── data-curator.ts
│   │   └── prompts/
│   │       ├── shared-principles.md
│   │       ├── strategist.md
│   │       ├── researcher.md
│   │       ├── analyst.md
│   │       ├── planner.md
│   │       ├── tool-specialist.md
│   │       └── data-curator.md
│   │
│   └── lib/                   # 共通ライブラリ
│       ├── settings.ts        # system_settings読み込み
│       ├── retry.ts           # リトライロジック
│       ├── embedding.ts       # pgvector embedding生成
│       └── logger.ts          # agent_thought_logs書き込み
│
├── dashboard/                 # dashboard-agent (Next.js)
│   ├── app/
│   │   ├── layout.tsx         # Solarizedテーマ、Nunitoフォント
│   │   ├── page.tsx           # ホーム
│   │   ├── kpi/
│   │   ├── production/
│   │   ├── review/
│   │   ├── content/
│   │   ├── accounts/
│   │   ├── characters/
│   │   ├── agents/
│   │   ├── hypotheses/
│   │   ├── learnings/
│   │   ├── tools/
│   │   ├── errors/
│   │   ├── costs/
│   │   ├── settings/
│   │   └── directives/
│   ├── components/
│   │   ├── ui/               # Shadcn/ui components
│   │   ├── charts/           # Recharts wrappers
│   │   └── layout/           # Sidebar, Header, etc.
│   ├── lib/
│   │   ├── api.ts            # API client
│   │   └── theme.ts          # Solarized color tokens
│   └── tailwind.config.ts    # Solarized + Nunito
│
└── tests/                     # test-agent
    ├── unit/
    │   ├── mcp-server/
    │   ├── workers/
    │   └── agents/
    ├── integration/
    │   ├── mcp-db.test.ts
    │   ├── worker-mcp.test.ts
    │   └── agent-mcp.test.ts
    └── e2e/
        └── full-cycle.test.ts
```

---

## 4. モジュール間インターフェース

### 4.1 全モジュール共通: types/ ディレクトリ

Week 0-1でリーダーが生成し凍結。全エージェントはこの型定義に従って実装する。

| ファイル | 内容 | 利用者 |
|---------|------|-------|
| `types/database.ts` | 全26テーブルのRow型 | 全エージェント |
| `types/mcp-tools.ts` | 全MCPツールの入出力型 | mcp-core-agent, mcp-intel-agent |
| `types/langgraph-state.ts` | 全4グラフのステート型 | intelligence-agent, strategy-agent |
| `types/api-schemas.ts` | ダッシュボードAPI型 | dashboard-agent |

### 4.2 MCP Server ↔ エージェント/ワーカー

| 項目 | 内容 |
|------|------|
| 通信方式 | langchain-mcp-adapters経由 |
| 契約 | `types/mcp-tools.ts` の入出力型 |

### 4.3 ダッシュボード ↔ MCP Server

| 項目 | 内容 |
|------|------|
| 通信方式 | Next.js API Routes → PostgreSQL直接（ダッシュボードはMCP経由ではなくDB直結） |
| 契約 | `types/api-schemas.ts` |

### 4.4 エージェント ↔ DB

| 項目 | 内容 |
|------|------|
| 通信方式 | MCP Serverツール経由（エージェントはDBに直接アクセスしない） |
| 契約 | `types/database.ts` + `types/mcp-tools.ts` |

---

## 5. 実装プロトコル

### 5.1 コーディング規約

| 項目 | 設定 |
|------|------|
| 言語 | TypeScript (strict mode) |
| ランタイム | Node.js 20+ |
| パッケージマネージャ | npm |
| フォーマッタ | Prettier (default config) |
| リンター | ESLint (recommended config) |
| テスト | Jest |
| コミットメッセージ | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) |

### 5.2 ブランチ戦略

```
main ── 本番ブランチ（直接コミット禁止）
  └── develop ── 開発統合ブランチ
       ├── feat/infra ── infra-agent
       ├── feat/mcp-core ── mcp-core-agent
       ├── feat/mcp-intel ── mcp-intel-agent
       ├── feat/video-worker ── video-worker-agent
       ├── feat/text-post ── text-post-agent
       ├── feat/measure ── measure-agent
       ├── feat/intelligence ── intelligence-agent
       ├── feat/strategy ── strategy-agent
       ├── feat/dashboard ── dashboard-agent
       └── feat/tests ── test-agent
```

**マージフロー**: 各エージェントが担当ブランチで作業 → リーダーがdevelopにマージ → テスト通過後mainにマージ

### 5.3 コンフリクト回避

| ルール | 内容 |
|--------|------|
| ディレクトリ分離 | 各エージェントは担当ディレクトリ以外のファイルを変更しない |
| 共有ファイル管理 | 共通ファイル（`package.json`, `docker-compose.yml`, `types/`）はリーダーのみが変更 |
| 型定義変更 | `types/` の変更は「変更申請→リーダー承認→全チーム通知」 |

### 5.4 日次プロトコル

1. **朝**: リーダーがタスク割り振り確認
2. **日中**: 各エージェントが担当タスク実行 → テスト実行 → コミット
3. **夕方**: リーダーがプルリクエストレビュー → developマージ
4. **夜**: 人間がダッシュボードで進捗確認 → 翌日の方針指示

---

## 6. 各エージェントの詳細タスク

### 6.1 infra-agent（Week 1-2 集中、Week 3以降はサポート）

**Week 1:**
- Docker Compose作成 (PostgreSQL 16 + pgvector, Node.js app)
- Cloud SQL接続設定
- DDL適用スクリプト（`001_create_tables.sql` 〜 `003_create_triggers.sql`）
- system_settings初期データ投入 (`004_seed_settings.sql`)

**Week 2:**
- agent_prompt_versions初期データ投入 (`005_seed_prompts.sql`)
- v4.0 → v5.0 マイグレーションスクリプト
- バックアップ/リストアスクリプト
- 環境変数テンプレート (`.env.example`)

**Week 3+:**
- 他エージェントのDB関連サポート
- パフォーマンスチューニング

### 6.2 mcp-core-agent（Week 1-4）

**担当**: 約50ツール

- Entity系: accounts, characters, components CRUD
- Production系: content, content_sections, publications CRUD
- Operations系: cycles, human_directives, task_queue CRUD
- System系: system_settings CRUD
- Dashboard系: KPI集計, コスト集計

**各ツールの実装パターン**:

```typescript
// types/mcp-tools.ts の型定義に従う
export const getAccountsTool = {
  name: 'get_accounts',
  description: 'アカウント一覧取得',
  input_schema: GetAccountsInput,
  handler: async (input: GetAccountsInput): Promise<GetAccountsOutput> => {
    // PostgreSQL クエリ実行
  }
};
```

### 6.3 mcp-intel-agent（Week 1-4）

**担当**: 約52ツール

- Intelligence系: hypotheses, market_intel, metrics, analyses, learnings CRUD + 検索
- Observability系: thought_logs, reflections, individual_learnings, communications
- Tool Management系: tool_catalog, tool_experiences, production_recipes
- 学習系: get_relevant_learnings, save_reflection, promote_learning

**pgvector関連ツール**:
- `similar_hypotheses_search` (cosine similarity)
- `similar_learnings_search`
- `similar_components_search`
- `duplicate_detection`

### 6.4 video-worker-agent（Week 1-4）

**参照仕様**: [04-agent-design.md](04-agent-design.md) のVideo Production Worker + README.md のv4.0パイプライン

**実装内容**:
- fal.ai Kling v2.6 連携 (motion-control, image-to-video)
- Fish Audio TTS 連携 (REST API直接)
- Sync Lipsync v2/pro 連携 (fal.ai経由)
- ffmpeg concat (filter_complex, CRF18)
- fal.storage アップロード
- Google Drive 保存
- エラーリカバリー（3段階）
- `production_recipes.steps` の実行エンジン

### 6.5 text-post-agent（Week 1-4）

**実装内容**:
- テキスト生成（Claude Sonnet, キャラクターpersonality反映）
- 4プラットフォーム投稿アダプター (YouTube, TikTok, Instagram, X)
- OAuth トークンリフレッシュ
- 投稿スケジューラー (`POSTING_POLL_INTERVAL_SEC`, `POSTING_TIME_JITTER_MIN`)
- Rate Limit対応

### 6.6 measure-agent（Week 1-4）

**実装内容**:
- YouTube Analytics API v2
- TikTok Analytics API
- Instagram Insights API
- X Analytics API
- メトリクス収集スケジューラー (`METRICS_COLLECTION_DELAY_HOURS`)
- 異常検知ワーカー (`ANOMALY_DETECTION_SIGMA`)

### 6.7 intelligence-agent（Week 1-5）

**最も複雑なモジュール**:
- LangGraph.js v1.0 セットアップ
- 4つの独立グラフ定義
- langchain-mcp-adapters 連携
- Researcher Agent実装
- Analyst Agent実装
- Tool Specialist Agent実装
- Data Curator Agent実装
- チェックポイント設定（PostgreSQL保存）
- プロンプト読み込み（`prompts/*.md`）

### 6.8 strategy-agent（Week 1-5）

**実装内容**:
- Strategy Cycle Graph (日次実行)
- Planner実装（水平スケーリング対応）
- 人間承認ゲート（`STRATEGY_APPROVAL_REQUIRED`）
- `human_directives` 処理
- リソース配分ロジック
- KPI監視 + エスカレーション

### 6.9 dashboard-agent（Week 1-5）

**実装内容**:
- Next.js 14+ App Router スキャフォールド
- Solarized Dark/Light テーマ（Tailwind CSS）
- Nunito フォント（Google Fonts）
- レスポンシブデザイン（Mobile-first）

**15画面の実装（優先度順）**:

| Week | 画面 |
|------|------|
| Week 1 | ホーム, KPI, 設定 |
| Week 2 | 制作キュー, アカウント管理, エラーログ |
| Week 3 | コンテンツレビュー, コンテンツ一覧, エージェント |
| Week 4 | 仮説ブラウザ, 知見ブラウザ, ツール管理 |
| Week 5 | コスト管理, 人間指示, キャラクター管理 |

### 6.10 test-agent（Week 1-7）

**実装内容**:
- Jest設定（TypeScript対応）
- ユニットテスト（各モジュール）
- 統合テスト（MCP Server ↔ DB, Worker ↔ MCP）
- E2Eテスト（全サイクルフロー）
- GitHub Actions CI設定
- テストカバレッジ目標: 80%+

---

## 7. 人間（Shungo）の作業

開発期間中の人間の作業。詳細は [11-pre-implementation-checklist.md](11-pre-implementation-checklist.md) を参照。

### 日次（〜30分）

- Agent Teamの進捗確認（TaskList, メッセージ確認）
- ブロッカーの解消（判断が必要な質問への回答）
- コードレビュー承認（リーダーが準備したPR）

### 週次（〜2時間）

- 主要マイルストーンの確認
- 方針変更の判断（必要に応じて）
- 人間作業の実施（アカウント作成、OAuth設定等）

### 並行作業（開発と同時進行）

- プラットフォームアカウント作成
- OAuth認証フロー完了
- APIキー取得・設定
- キャラクターアセット準備
