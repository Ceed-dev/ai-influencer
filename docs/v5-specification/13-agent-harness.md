# 13. エージェントハーネス仕様書 v5.0

> Anthropic "Effective Harnesses for Long-Running Agents" に基づく、
> Claude Code Agent Teamによるほぼ全自動実装のためのワークフロー仕様。
> 人間の介入を最小化（7週間で合計2.5時間以下）し、品質を自動的に保証する。
>
> **関連ドキュメント**: [06-development-roadmap.md](06-development-roadmap.md) (ロードマップ), [10-implementation-guide.md](10-implementation-guide.md) (実装ガイド), [12-test-specifications.md](12-test-specifications.md) (テスト仕様)

## 目次

- [1. ハーネスアーキテクチャ](#1-ハーネスアーキテクチャ)
- [2. feature_list.json 設計](#2-feature_listjson-設計)
- [3. init.sh 仕様](#3-initsh-仕様)
- [4. progress.txt プロトコル](#4-progresstxt-プロトコル)
- [5. セッション起動チェックリスト](#5-セッション起動チェックリスト)
- [6. 単一機能ワークフロー](#6-単一機能ワークフロー)
- [7. Git戦略](#7-git戦略)
- [8. 品質ゲート（全自動、人間判断不要）](#8-品質ゲート全自動人間判断不要)
- [9. リカバリー手順](#9-リカバリー手順)
- [10. 人間介入ポイント（最小化）](#10-人間介入ポイント最小化)
- [11. モニタリング](#11-モニタリング)
- [12. アンチパターン防止](#12-アンチパターン防止)

## 1. ハーネスアーキテクチャ

### 1.1 設計思想

Anthropicの"Effective Harnesses for Long-Running Agents"の核心は、**エージェントを「one-shotで全部やらせる」のではなく、小さな単位に分割して段階的に実行させる**ことにある。

v5.0の実装は250以上の機能から構成される。これを1つのエージェントに一括で依頼すると：
- コンテキストウィンドウが枯渇する
- エラーが蓄積して後半の品質が壊滅的に低下する
- 進捗の追跡が不可能になる
- 障害時の復旧ポイントが存在しない

ハーネスはこれを防ぐために、**1機能=1サイクル**のワークフローを強制する。

### 1.2 Two-Phase モデル

```
Phase A: Initializer (リーダーAgent)
  ├── feature_list.json を生成（全機能の定義）
  ├── init.sh を生成（環境セットアップ）
  ├── progress.txt を初期化
  ├── types/ を生成・凍結（TypeScript型定義）
  └── 10エージェントを起動・タスク割り当て（→ 付録B のテンプレートを使用）

Phase B: Coding Agents (10チームメイト)
  ├── セッション起動チェックリストを毎回実行
  ├── feature_list.json から次の機能を1つ選択
  ├── 単一機能ワークフローを実行
  ├── 品質ゲートを全て通過
  ├── progress.txt に記録
  └── 次の機能へ（ループ）
```

### 1.3 10エージェントへのマッピング

| # | エージェント名 | 担当カテゴリ | feature_list.json のカテゴリ |
|---|-------------|------------|---------------------------|
| 1 | infra-agent | Docker + PostgreSQL + DDL | `database`, `infra` |
| 2 | mcp-core-agent | MCP Server コアCRUD (~50ツール) | `mcp-core` |
| 3 | mcp-intel-agent | MCP Server インテリジェンス (~52ツール) | `mcp-intel` |
| 4 | video-worker-agent | 動画制作ワーカー | `video-worker` |
| 5 | text-post-agent | テキスト制作 + 投稿 | `text-post` |
| 6 | measure-agent | 計測ワーカー | `measure` |
| 7 | intelligence-agent | LangGraph + 4エージェント | `intelligence` |
| 8 | strategy-agent | 戦略Agent + プランナー | `strategy` |
| 9 | dashboard-agent | Next.js ダッシュボード全15画面 | `dashboard` |
| 10 | test-agent | テストスイート + CI | `test` |

### 1.4 コンテキストウィンドウ管理

各エージェントのコンテキストウィンドウは有限である。以下の戦略でコンテキスト枯渇を防ぐ：

| 戦略 | 詳細 |
|------|------|
| **progress.txt** | 全作業履歴を外部ファイルに記録。新セッション開始時に `tail -50` で最新状態を把握 |
| **feature_list.json** | 残作業を外部JSONで管理。コンテキストに全機能を載せる必要がない |
| **1機能=1サイクル** | 1機能の完了後にコミット・記録。コンテキストが切れても復旧可能 |
| **git log** | コードの変更履歴はgitに蓄積。コンテキストに保持する必要がない |
| **仕様書参照** | 各機能の詳細は仕様書ファイルに記載。必要時にReadツールで参照 |

### 1.5 なぜこのアプローチが有効か

| 問題 | One-Shot方式 | ハーネス方式 |
|------|-------------|-------------|
| コンテキスト枯渇 | 250機能で確実に枯渇 | 1機能ずつで枯渇しない |
| エラー蓄積 | 後半は破綻 | 毎機能でテスト→修復 |
| 進捗追跡 | 不可能 | progress.txt + feature_list.json |
| 障害復旧 | 最初からやり直し | 最後のCOMPLETEから再開 |
| 品質保証 | 最後にまとめてテスト→大量失敗 | 毎機能でテスト→小さな修正 |
| 並列実行 | 不可能 | 10エージェントが独立して実行 |

## 2. feature_list.json 設計

### 2.1 JSONスキーマ定義

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "version": { "type": "string", "const": "5.0.0" },
    "generated_at": { "type": "string", "format": "date-time" },
    "total_features": { "type": "integer" },
    "features": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^FEAT-[A-Z]+-[0-9]{3}$",
            "description": "一意の機能ID。カテゴリプレフィックス + 3桁連番"
          },
          "category": {
            "type": "string",
            "enum": ["database", "infra", "mcp-core", "mcp-intel", "video-worker", "text-post", "measure", "intelligence", "strategy", "dashboard", "test"]
          },
          "module": {
            "type": "string",
            "description": "ディレクトリパスに対応するモジュール名"
          },
          "agent": {
            "type": "string",
            "enum": ["infra-agent", "mcp-core-agent", "mcp-intel-agent", "video-worker-agent", "text-post-agent", "measure-agent", "intelligence-agent", "strategy-agent", "dashboard-agent", "test-agent"]
          },
          "priority": {
            "type": "string",
            "enum": ["P0", "P1", "P2"],
            "description": "P0=Week1-2必須, P1=Week3-4必須, P2=Week5以降"
          },
          "description": {
            "type": "string",
            "description": "何を実装するかの明確な説明"
          },
          "spec_refs": {
            "type": "array",
            "items": { "type": "string" },
            "description": "参照すべき仕様書セクション（例: '03-database-schema.md §1.1'）"
          },
          "test_ids": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^TEST-[A-Z]+-[0-9]{3}$"
            },
            "description": "12-test-specifications.md のテストID"
          },
          "dependencies": {
            "type": "array",
            "items": {
              "type": "string",
              "pattern": "^FEAT-[A-Z]+-[0-9]{3}$"
            },
            "description": "先に完了していなければならない機能ID"
          },
          "steps": {
            "type": "array",
            "items": { "type": "string" },
            "description": "実装手順（順序付き）"
          },
          "passes": {
            "type": "boolean",
            "default": false,
            "description": "全テストが通過したらtrue。唯一の変更可能フィールド"
          }
        },
        "required": ["id", "category", "module", "agent", "priority", "description", "spec_refs", "test_ids", "dependencies", "steps", "passes"]
      }
    }
  },
  "required": ["version", "generated_at", "total_features", "features"]
}
```

### 2.2 不変性ルール

| フィールド | 変更可否 | 変更者 |
|-----------|---------|-------|
| `id` | **不可** | - |
| `category` | **不可** | - |
| `module` | **不可** | - |
| `agent` | **不可** | - |
| `priority` | **不可** | - |
| `description` | **不可** | - |
| `spec_refs` | **不可** | - |
| `test_ids` | **不可** | - |
| `dependencies` | **不可** | - |
| `steps` | **不可** | - |
| `passes` | **変更可** | 担当エージェントのみ。`false` → `true` の一方向のみ |

**理由**: JSON形式を採用することで、Markdown形式よりもエージェントが「内容を改変して楽をする」リスクを低減する。`passes` 以外のフィールドが変更されていた場合、`git diff` で即座に検出可能。

**初期生成時の検証**: リーダーは feature_list.json の初期生成後、**付録C** のチェックリストで全項目を検証すること。

### 2.3 機能IDの命名規則

```
FEAT-{CATEGORY}-{NUMBER}

CATEGORY:
  DB    = database (DDL, テーブル, インデックス, トリガー)
  INF   = infra (Docker, 環境設定, マイグレーション)
  MCC   = mcp-core (Entity/Production/Operations/System/Dashboard CRUD)
  MCI   = mcp-intel (Intelligence/Observability/ToolMgmt/Learning ツール)
  VW    = video-worker (動画制作ワーカー)
  TP    = text-post (テキスト制作 + 投稿)
  MS    = measure (計測ワーカー)
  INT   = intelligence (LangGraph, Researcher, Analyst, ToolSP, DataCurator)
  STR   = strategy (Strategy Cycle, Planner)
  DSH   = dashboard (Next.js 15画面)
  TST   = test (テストスイート, CI)

NUMBER: 001〜999
```

**テストID体系の対応表**: 各機能の `test_ids` は本ファイル内ではFEATカテゴリに準じた命名（TEST-{CATEGORY}-NNN）を使用する。12-test-specifications.md のレイヤーベースIDとの対応は以下の通り:

| 13 (FEAT/TESTカテゴリ) | 12 (テストレイヤー) | 備考 |
|---|---|---|
| DB | TEST-DB | 同一 |
| INF | (12に未定義) | Docker/環境設定テスト。実装時にTEST-DB or TEST-INT枠で追加 |
| MCC, MCI | TEST-MCP | 12ではCore/Intelを区別せず統一 |
| VW, TP, MS | TEST-WKR | 12ではワーカー層として統一 |
| INT, STR | TEST-AGT | 12ではエージェント層として統一 |
| DSH | TEST-DSH | 同一 |
| TST | TEST-INT / TEST-E2E | CI・統合テスト |

### 2.4 機能一覧（抜粋: 各カテゴリ3件以上、計35件）

```json
{
  "version": "5.0.0",
  "generated_at": "2026-03-01T00:00:00Z",
  "total_features": 291,
  "features": [
    {
      "id": "FEAT-DB-001",
      "category": "database",
      "module": "sql",
      "agent": "infra-agent",
      "priority": "P0",
      "description": "accountsテーブルの作成。03-database-schema.md §1.1に定義された全カラム・制約・コメントを完全に再現する",
      "spec_refs": ["03-database-schema.md §1.1"],
      "test_ids": ["TEST-DB-001", "TEST-DB-002"],
      "dependencies": ["FEAT-DB-000"],
      "steps": [
        "03-database-schema.md §1.1 を読み、accountsテーブルのCREATE TABLE文を確認",
        "sql/001_create_tables.sql に accounts テーブルのDDLを追記",
        "psql で DDL を実行",
        "TEST-DB-001（テーブル存在確認 + カラム型チェック）を実行",
        "TEST-DB-002（CHECK制約テスト: 不正値の INSERT が拒否されること）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-DB-000",
      "category": "database",
      "module": "sql",
      "agent": "infra-agent",
      "priority": "P0",
      "description": "PostgreSQL 16 + pgvector拡張の初期セットアップ。CREATE EXTENSION vector の実行確認",
      "spec_refs": ["03-database-schema.md §初期セットアップ", "01-tech-stack.md §サーバー・インフラ"],
      "test_ids": ["TEST-DB-000"],
      "dependencies": [],
      "steps": [
        "Docker Compose でPostgreSQL 16コンテナを起動",
        "CREATE EXTENSION IF NOT EXISTS vector を実行",
        "SELECT extversion FROM pg_extension WHERE extname = 'vector' で確認",
        "TEST-DB-000 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-DB-002",
      "category": "database",
      "module": "sql",
      "agent": "infra-agent",
      "priority": "P0",
      "description": "charactersテーブルの作成。03-database-schema.md §1.2の全カラム・制約・コメントを完全に再現する",
      "spec_refs": ["03-database-schema.md §1.2"],
      "test_ids": ["TEST-DB-003", "TEST-DB-004"],
      "dependencies": ["FEAT-DB-000"],
      "steps": [
        "03-database-schema.md §1.2 を読み、charactersテーブルのDDLを確認",
        "sql/001_create_tables.sql に characters テーブルのDDLを追記",
        "psql で DDL を実行",
        "TEST-DB-003, TEST-DB-004 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-DB-003",
      "category": "database",
      "module": "sql",
      "agent": "infra-agent",
      "priority": "P0",
      "description": "componentsテーブル + GINインデックス（tags）の作成。03-database-schema.md §1.3",
      "spec_refs": ["03-database-schema.md §1.3", "03-database-schema.md §8.1"],
      "test_ids": ["TEST-DB-005", "TEST-DB-006"],
      "dependencies": ["FEAT-DB-000"],
      "steps": [
        "03-database-schema.md §1.3 を読み、componentsテーブルのDDLを確認",
        "sql/001_create_tables.sql にDDL追記",
        "sql/002_create_indexes.sql にGINインデックス追記",
        "psql で実行",
        "TEST-DB-005, TEST-DB-006 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-INF-001",
      "category": "infra",
      "module": "infra",
      "agent": "infra-agent",
      "priority": "P0",
      "description": "docker-compose.yml + docker-compose.dev.yml の作成。PostgreSQL + pgvector + Node.jsアプリコンテナの定義",
      "spec_refs": ["01-tech-stack.md §サーバー・インフラ", "10-implementation-guide.md §3"],
      "test_ids": ["TEST-INF-001"],
      "dependencies": [],
      "steps": [
        "docker-compose.yml を作成（PostgreSQL 16 + pgvector, Node.js app, volumes, networks）",
        "docker-compose.dev.yml を作成（dev用ポートマッピング、ホットリロード）",
        "docker compose up -d で起動確認",
        "TEST-INF-001（全コンテナが healthy であること）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-INF-002",
      "category": "infra",
      "module": "infra",
      "agent": "infra-agent",
      "priority": "P0",
      "description": ".env.example の作成。全環境変数のテンプレート",
      "spec_refs": ["10-implementation-guide.md §3"],
      "test_ids": ["TEST-INF-002"],
      "dependencies": [],
      "steps": [
        ".env.example を作成（DATABASE_URL, ANTHROPIC_API_KEY, FAL_KEY, FISH_AUDIO_API_KEY 等）",
        "各変数にコメントで説明を付与",
        "TEST-INF-002（.env.example に必須変数が全て含まれること）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-INF-003",
      "category": "infra",
      "module": "infra",
      "agent": "infra-agent",
      "priority": "P0",
      "description": "TypeScriptプロジェクト初期化。tsconfig.json, package.json, ESLint, Prettier設定",
      "spec_refs": ["10-implementation-guide.md §5.1"],
      "test_ids": ["TEST-INF-003"],
      "dependencies": [],
      "steps": [
        "package.json を作成（name, scripts: build/test/lint/format）",
        "tsconfig.json を作成（strict: true, target: ES2022, module: Node16）",
        ".eslintrc.json を作成（recommended config）",
        ".prettierrc を作成（default config）",
        "npm install で依存関係インストール",
        "TEST-INF-003（npx tsc --noEmit が成功すること）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MCC-001",
      "category": "mcp-core",
      "module": "src/mcp-server",
      "agent": "mcp-core-agent",
      "priority": "P0",
      "description": "MCP Serverエントリポイント + PostgreSQL接続管理の実装",
      "spec_refs": ["02-architecture.md §4.1", "04-agent-design.md §4"],
      "test_ids": ["TEST-MCC-001"],
      "dependencies": ["FEAT-INF-001", "FEAT-INF-003"],
      "steps": [
        "src/mcp-server/index.ts を作成（MCP Server初期化 + ツール登録）",
        "src/mcp-server/db.ts を作成（PostgreSQL接続プール管理）",
        "types/mcp-tools.ts の型を参照してツール登録構造を確認",
        "TEST-MCC-001（MCP Server起動 + DB接続確認）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MCC-002",
      "category": "mcp-core",
      "module": "src/mcp-server/tools/entity",
      "agent": "mcp-core-agent",
      "priority": "P0",
      "description": "accounts CRUD ツール実装（6ツール: create/get/list/update/search/count）",
      "spec_refs": ["04-agent-design.md §4.1", "03-database-schema.md §1.1"],
      "test_ids": ["TEST-MCC-002", "TEST-MCC-003"],
      "dependencies": ["FEAT-MCC-001", "FEAT-DB-001"],
      "steps": [
        "src/mcp-server/tools/entity/accounts.ts を作成",
        "create_account, get_account, list_accounts, update_account, search_accounts, count_accounts を実装",
        "types/mcp-tools.ts の入出力型に準拠",
        "TEST-MCC-002（CRUD正常系）, TEST-MCC-003（バリデーションエラー）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MCC-003",
      "category": "mcp-core",
      "module": "src/mcp-server/tools/entity",
      "agent": "mcp-core-agent",
      "priority": "P0",
      "description": "characters CRUD ツール実装（4ツール: create/get/list/update）",
      "spec_refs": ["04-agent-design.md §4.1", "03-database-schema.md §1.2"],
      "test_ids": ["TEST-MCC-004"],
      "dependencies": ["FEAT-MCC-001", "FEAT-DB-002"],
      "steps": [
        "src/mcp-server/tools/entity/characters.ts を作成",
        "create_character, get_character, list_characters, update_character を実装",
        "TEST-MCC-004 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MCC-004",
      "category": "mcp-core",
      "module": "src/mcp-server/tools/entity",
      "agent": "mcp-core-agent",
      "priority": "P0",
      "description": "components CRUD + 検索ツール実装（5ツール: create/get/list/search/update）",
      "spec_refs": ["04-agent-design.md §4.1", "03-database-schema.md §1.3"],
      "test_ids": ["TEST-MCC-005"],
      "dependencies": ["FEAT-MCC-001", "FEAT-DB-003"],
      "steps": [
        "src/mcp-server/tools/entity/components.ts を作成",
        "GINインデックスを活用したtags検索を含む5ツール実装",
        "TEST-MCC-005 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MCI-001",
      "category": "mcp-intel",
      "module": "src/mcp-server/tools/intelligence",
      "agent": "mcp-intel-agent",
      "priority": "P1",
      "description": "hypotheses CRUD + pgvector類似検索ツール実装",
      "spec_refs": ["04-agent-design.md §4.3", "03-database-schema.md §3.1"],
      "test_ids": ["TEST-MCI-001", "TEST-MCI-002"],
      "dependencies": ["FEAT-MCC-001"],
      "steps": [
        "src/mcp-server/tools/intelligence/hypotheses.ts を作成",
        "CRUD + similar_hypotheses_search（cosine similarity）を実装",
        "pgvectorのHNSWインデックスを活用",
        "TEST-MCI-001（CRUD正常系）, TEST-MCI-002（ベクトル検索精度）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MCI-002",
      "category": "mcp-intel",
      "module": "src/mcp-server/tools/intelligence",
      "agent": "mcp-intel-agent",
      "priority": "P1",
      "description": "learnings CRUD + pgvector類似検索ツール実装",
      "spec_refs": ["04-agent-design.md §4.3", "03-database-schema.md §3.5"],
      "test_ids": ["TEST-MCI-003"],
      "dependencies": ["FEAT-MCC-001"],
      "steps": [
        "src/mcp-server/tools/intelligence/learnings.ts を作成",
        "CRUD + get_relevant_learnings + similar_learnings_search を実装",
        "TEST-MCI-003 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MCI-003",
      "category": "mcp-intel",
      "module": "src/mcp-server/tools/observability",
      "agent": "mcp-intel-agent",
      "priority": "P1",
      "description": "agent_thought_logs + agent_reflections ツール実装",
      "spec_refs": ["04-agent-design.md §4.12", "03-database-schema.md §5.2", "03-database-schema.md §5.3"],
      "test_ids": ["TEST-MCI-004"],
      "dependencies": ["FEAT-MCC-001"],
      "steps": [
        "src/mcp-server/tools/observability/thought-logs.ts を作成",
        "src/mcp-server/tools/observability/reflections.ts を作成",
        "save_thought_log, get_thought_logs, save_reflection, get_reflections を実装",
        "TEST-MCI-004 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-VW-001",
      "category": "video-worker",
      "module": "src/workers/video-production",
      "agent": "video-worker-agent",
      "priority": "P0",
      "description": "fal.aiクライアント実装。Kling v2.6 image-to-video + motion-control API連携",
      "spec_refs": ["02-architecture.md §5.2", "04-agent-design.md §4.6"],
      "test_ids": ["TEST-VW-001"],
      "dependencies": ["FEAT-INF-003"],
      "steps": [
        "src/workers/video-production/fal-client.ts を作成",
        "fal.ai SDK初期化 + image-to-video API呼び出し実装",
        "motion-control パラメータ（character_orientation 必須）を設定",
        "fal.storage アップロード機能を実装",
        "TEST-VW-001（モック環境でのAPI呼び出しテスト）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-VW-002",
      "category": "video-worker",
      "module": "src/workers/video-production",
      "agent": "video-worker-agent",
      "priority": "P0",
      "description": "Fish Audio TTS連携実装。REST API直接呼び出し + MP3バイナリ取得",
      "spec_refs": ["02-architecture.md §5.2"],
      "test_ids": ["TEST-VW-002"],
      "dependencies": ["FEAT-INF-003"],
      "steps": [
        "src/workers/video-production/fish-audio.ts を作成",
        "Fish Audio REST API (https://api.fish.audio/v1/tts) 呼び出し実装",
        "referenceId（32文字hex、必須）パラメータの設定",
        "バイナリMP3レスポンスの処理",
        "TEST-VW-002 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-VW-003",
      "category": "video-worker",
      "module": "src/workers/video-production",
      "agent": "video-worker-agent",
      "priority": "P1",
      "description": "ffmpeg concat実装。filter_complex再エンコード（H.264 CRF18）+ blackdetect + auto-trim",
      "spec_refs": ["02-architecture.md §5.2"],
      "test_ids": ["TEST-VW-003"],
      "dependencies": ["FEAT-VW-001", "FEAT-VW-002"],
      "steps": [
        "src/workers/video-production/ffmpeg.ts を作成",
        "filter_complex re-encode（H.264 CRF18）パイプラインを実装",
        "blackdetect バリデーション + auto-trim機能を実装",
        "TEST-VW-003 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-TP-001",
      "category": "text-post",
      "module": "src/workers/text-production",
      "agent": "text-post-agent",
      "priority": "P0",
      "description": "テキストコンテンツ生成エンジン実装。Claude Sonnet + キャラクターpersonality反映",
      "spec_refs": ["02-architecture.md §5.3", "04-agent-design.md §4.6"],
      "test_ids": ["TEST-TP-001"],
      "dependencies": ["FEAT-INF-003"],
      "steps": [
        "src/workers/text-production/text-generator.ts を作成",
        "Claude Sonnet API呼び出し + キャラクター設定の反映ロジック実装",
        "プラットフォーム別テキスト最適化（文字数制限、ハッシュタグ等）",
        "TEST-TP-001 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-TP-002",
      "category": "text-post",
      "module": "src/workers/posting/adapters",
      "agent": "text-post-agent",
      "priority": "P0",
      "description": "YouTube投稿アダプター実装。Shorts動画アップロード + メタデータ設定",
      "spec_refs": ["02-architecture.md §5.1"],
      "test_ids": ["TEST-TP-002"],
      "dependencies": ["FEAT-INF-003"],
      "steps": [
        "src/workers/posting/adapters/youtube.ts を作成",
        "YouTube Data API v3 アップロードフロー実装",
        "OAuth2 トークンリフレッシュ機能実装",
        "TEST-TP-002 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-TP-003",
      "category": "text-post",
      "module": "src/workers/posting",
      "agent": "text-post-agent",
      "priority": "P1",
      "description": "投稿スケジューラー実装。時刻ジッター + レート制限対応",
      "spec_refs": ["02-architecture.md §5.1", "04-agent-design.md §4.7"],
      "test_ids": ["TEST-TP-003"],
      "dependencies": ["FEAT-TP-002"],
      "steps": [
        "src/workers/posting/scheduler.ts を作成",
        "POSTING_POLL_INTERVAL_SEC, POSTING_TIME_JITTER_MIN をsystem_settingsから読み込み",
        "レート制限追跡 + バックオフ実装",
        "TEST-TP-003 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MS-001",
      "category": "measure",
      "module": "src/workers/measurement/adapters",
      "agent": "measure-agent",
      "priority": "P1",
      "description": "YouTube Analytics APIアダプター実装。メトリクス取得 + DB保存",
      "spec_refs": ["04-agent-design.md §4.8"],
      "test_ids": ["TEST-MS-001"],
      "dependencies": ["FEAT-INF-003"],
      "steps": [
        "src/workers/measurement/adapters/youtube-analytics.ts を作成",
        "YouTube Analytics API v2 呼び出し実装",
        "views, likes, comments, shares 等のメトリクス取得",
        "TEST-MS-001 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MS-002",
      "category": "measure",
      "module": "src/workers/measurement",
      "agent": "measure-agent",
      "priority": "P1",
      "description": "メトリクス収集スケジューラー実装。METRICS_COLLECTION_DELAY_HOURS後に自動収集",
      "spec_refs": ["04-agent-design.md §4.8"],
      "test_ids": ["TEST-MS-002"],
      "dependencies": ["FEAT-MS-001"],
      "steps": [
        "src/workers/measurement/collector.ts を作成",
        "publicationsテーブルから measure_after 到来の投稿を検出",
        "4PFアダプターを呼び出してメトリクス取得 → metricsテーブルに保存",
        "TEST-MS-002 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-MS-003",
      "category": "measure",
      "module": "src/workers/measurement",
      "agent": "measure-agent",
      "priority": "P2",
      "description": "異常検知ワーカー実装。ANOMALY_DETECTION_SIGMAを超える偏差を検出・アラート",
      "spec_refs": ["04-agent-design.md §4.8", "08-algorithm-analysis.md"],
      "test_ids": ["TEST-MS-003"],
      "dependencies": ["FEAT-MS-002"],
      "steps": [
        "異常検知ロジックをcollector.tsに追加",
        "engagement_rate の標準偏差計算 + ANOMALY_DETECTION_SIGMA 閾値判定",
        "異常検知時に agent_communications テーブルに通知記録",
        "TEST-MS-003 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-INT-001",
      "category": "intelligence",
      "module": "src/agents",
      "agent": "intelligence-agent",
      "priority": "P0",
      "description": "LangGraph.js基盤セットアップ。チェックポイント + MCPアダプター + プロンプトローダー",
      "spec_refs": ["02-architecture.md §3.1", "04-agent-design.md §5"],
      "test_ids": ["TEST-INT-001"],
      "dependencies": ["FEAT-INF-003"],
      "steps": [
        "src/agents/graphs/ ディレクトリ構造を作成",
        "@langchain/langgraph パッケージのセットアップ",
        "PostgreSQLチェックポイント設定",
        "langchain-mcp-adapters 接続設定",
        "prompts/*.md からのプロンプト読み込みユーティリティ作成",
        "TEST-INT-001 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-INT-002",
      "category": "intelligence",
      "module": "src/agents/nodes",
      "agent": "intelligence-agent",
      "priority": "P1",
      "description": "Researcher Agentノード実装。市場調査 + トレンド収集 + market_intel保存",
      "spec_refs": ["04-agent-design.md §1.2", "04-agent-design.md §4.2"],
      "test_ids": ["TEST-INT-002"],
      "dependencies": ["FEAT-INT-001"],
      "steps": [
        "src/agents/nodes/researcher.ts を作成",
        "prompts/researcher.md を読み込み",
        "MCP経由でmarket_intel CRUD呼び出し",
        "TEST-INT-002 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-INT-003",
      "category": "intelligence",
      "module": "src/agents/nodes",
      "agent": "intelligence-agent",
      "priority": "P1",
      "description": "Analyst Agentノード実装。仮説検証 + 知見抽出 + learnings保存",
      "spec_refs": ["04-agent-design.md §1.3", "04-agent-design.md §4.3"],
      "test_ids": ["TEST-INT-003"],
      "dependencies": ["FEAT-INT-001"],
      "steps": [
        "src/agents/nodes/analyst.ts を作成",
        "prompts/analyst.md を読み込み",
        "MCP経由でanalyses, learnings CRUD呼び出し",
        "pgvectorによる類似仮説検索の呼び出し",
        "TEST-INT-003 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-STR-001",
      "category": "strategy",
      "module": "src/agents/graphs",
      "agent": "strategy-agent",
      "priority": "P1",
      "description": "Strategy Cycle Graph定義。日次戦略サイクルのLangGraphグラフ構造",
      "spec_refs": ["02-architecture.md §3.3", "04-agent-design.md §5.1"],
      "test_ids": ["TEST-STR-001"],
      "dependencies": ["FEAT-INT-001"],
      "steps": [
        "src/agents/graphs/strategy-cycle.ts を作成",
        "types/langgraph-state.ts のステート型に準拠",
        "ノード定義: analyze → plan → [human_review] → execute → measure → learn",
        "条件分岐: STRATEGY_APPROVAL_REQUIRED に基づく人間承認ゲート",
        "TEST-STR-001 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-STR-002",
      "category": "strategy",
      "module": "src/agents/nodes",
      "agent": "strategy-agent",
      "priority": "P1",
      "description": "Planner Agentノード実装。コンテンツ計画作成 + スケジュール最適化",
      "spec_refs": ["04-agent-design.md §1.6", "04-agent-design.md §4.4"],
      "test_ids": ["TEST-STR-002"],
      "dependencies": ["FEAT-STR-001"],
      "steps": [
        "src/agents/nodes/planner.ts を作成",
        "prompts/planner.md を読み込み",
        "MCP経由でtask_queue, content CRUD呼び出し",
        "TEST-STR-002 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-STR-003",
      "category": "strategy",
      "module": "src/agents/nodes",
      "agent": "strategy-agent",
      "priority": "P1",
      "description": "人間承認ゲート実装。LangGraph interrupt + human_directives処理",
      "spec_refs": ["04-agent-design.md §9", "02-architecture.md §13.2"],
      "test_ids": ["TEST-STR-003"],
      "dependencies": ["FEAT-STR-001"],
      "steps": [
        "LangGraph interrupt() を使った承認待ちノードを実装",
        "STRATEGY_APPROVAL_REQUIRED 設定値でゲートのON/OFF切り替え",
        "human_directives テーブルからの指示読み込み",
        "TEST-STR-003 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-DSH-001",
      "category": "dashboard",
      "module": "dashboard",
      "agent": "dashboard-agent",
      "priority": "P0",
      "description": "Next.jsスキャフォールド + Solarizedテーマ + Nunitoフォント + 共通レイアウト",
      "spec_refs": ["02-architecture.md §6.1", "01-tech-stack.md §ダッシュボードUI技術スタック"],
      "test_ids": ["TEST-DSH-001"],
      "dependencies": [],
      "steps": [
        "npx create-next-app@14.2 dashboard --typescript --tailwind --app",
        "Solarized Dark/Light テーマカラートークンをtailwind.config.tsに定義",
        "Nunito フォントをGoogle Fontsから読み込み",
        "dashboard/app/layout.tsx にサイドバー + ヘッダーの共通レイアウト作成",
        "TEST-DSH-001（ビルド成功 + ページレンダリング）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-DSH-002",
      "category": "dashboard",
      "module": "dashboard/app/kpi",
      "agent": "dashboard-agent",
      "priority": "P0",
      "description": "KPIダッシュボード画面実装。アカウント数推移 + 投稿数 + エンゲージメント率",
      "spec_refs": ["02-architecture.md §6.10"],
      "test_ids": ["TEST-DSH-002"],
      "dependencies": ["FEAT-DSH-001"],
      "steps": [
        "dashboard/app/kpi/page.tsx を作成",
        "Rechartsでアカウント数推移グラフ、投稿数グラフ、エンゲージメント率グラフを実装",
        "PostgreSQL直結でデータ取得（API Routes経由）",
        "TEST-DSH-002 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-DSH-003",
      "category": "dashboard",
      "module": "dashboard/app/production",
      "agent": "dashboard-agent",
      "priority": "P0",
      "description": "制作キュー画面実装。ステータス別タスク一覧 + 進捗表示",
      "spec_refs": ["02-architecture.md §6.10"],
      "test_ids": ["TEST-DSH-003"],
      "dependencies": ["FEAT-DSH-001"],
      "steps": [
        "dashboard/app/production/page.tsx を作成",
        "task_queue + contentテーブルからステータス別タスク取得",
        "カンバンボード風のUI実装",
        "TEST-DSH-003 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-TST-001",
      "category": "test",
      "module": "tests",
      "agent": "test-agent",
      "priority": "P0",
      "description": "Jest + TypeScript テスト基盤セットアップ。設定ファイル + ヘルパー + モック基盤",
      "spec_refs": ["10-implementation-guide.md §5.1"],
      "test_ids": ["TEST-TST-001"],
      "dependencies": ["FEAT-INF-003"],
      "steps": [
        "jest.config.ts を作成（ts-jest, testMatch, coverage設定）",
        "tests/helpers/ ディレクトリにテストユーティリティ作成",
        "tests/mocks/ ディレクトリにDB/MCP/API共通モック作成",
        "TEST-TST-001（Jestが正常に実行されること）を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-TST-002",
      "category": "test",
      "module": "tests/unit/mcp-server",
      "agent": "test-agent",
      "priority": "P0",
      "description": "MCP Server ユニットテスト作成。accounts/characters/components CRUD",
      "spec_refs": ["12-test-specifications.md"],
      "test_ids": ["TEST-TST-002"],
      "dependencies": ["FEAT-TST-001", "FEAT-MCC-002"],
      "steps": [
        "tests/unit/mcp-server/accounts.test.ts を作成",
        "tests/unit/mcp-server/characters.test.ts を作成",
        "tests/unit/mcp-server/components.test.ts を作成",
        "DB接続モック + 正常系/異常系テストケース",
        "TEST-TST-002 を実行"
      ],
      "passes": false
    },
    {
      "id": "FEAT-TST-003",
      "category": "test",
      "module": "tests/e2e",
      "agent": "test-agent",
      "priority": "P2",
      "description": "E2Eフルサイクルテスト作成。仮説→計画→制作→投稿→計測→分析→学習",
      "spec_refs": ["12-test-specifications.md", "04-agent-design.md §7"],
      "test_ids": ["TEST-TST-003"],
      "dependencies": ["FEAT-TST-001"],
      "steps": [
        "tests/e2e/full-cycle.test.ts を作成",
        "テスト用のseedデータ生成ヘルパー",
        "全ステータス遷移の検証（planned → producing → produced → ready → posted → measured → analyzed → learned）",
        "TEST-TST-003 を実行"
      ],
      "passes": false
    }
  ]
}
```

### 2.5 機能選択アルゴリズム

エージェントが次に取り組む機能を選択するアルゴリズム：

```
function selectNextFeature(agentName, featureList):
    // Step 1: 自分の担当カテゴリの未完了機能を抽出
    candidates = featureList.features.filter(f =>
        f.agent === agentName &&
        f.passes === false
    )

    // Step 2: 依存関係が全て満たされている機能のみ残す
    ready = candidates.filter(f =>
        f.dependencies.every(depId =>
            featureList.features.find(d => d.id === depId).passes === true
        )
    )

    // Step 3: 優先度でソート（P0 > P1 > P2）
    ready.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))

    // Step 4: 同じ優先度内ではID順（若番優先）
    // ready は既にID順で安定ソートされる

    // Step 5: 先頭の1件を返す
    return ready[0] || null  // null = 全機能完了 or 全てブロック中
```

## 3. init.sh 仕様

### 3.1 スクリプト全文

```bash
#!/bin/bash
set -euo pipefail

# =============================================================================
# v5.0 Development Environment Setup (idempotent)
# =============================================================================
# 用途: 開発環境の初期セットアップおよび検証
# 実行: bash init.sh [--check-only]
# 冪等: 何度実行しても安全。既に存在するリソースはスキップする
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}"
LOG_FILE="${PROJECT_DIR}/init.log"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CHECK_ONLY=false
if [[ "${1:-}" == "--check-only" ]]; then
    CHECK_ONLY=true
fi

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }
ok()  { log "${GREEN}[OK]${NC} $1"; }
warn(){ log "${YELLOW}[WARN]${NC} $1"; }
fail(){ log "${RED}[FAIL]${NC} $1"; EXIT_CODE=1; }

EXIT_CODE=0

# -----------------------------------------------------------------------------
# 1. Node.js バージョン確認
# -----------------------------------------------------------------------------
log "=== 1. Node.js Version Check ==="
REQUIRED_NODE_MAJOR=20
NODE_VERSION=$(node --version 2>/dev/null || echo "not_found")
if [[ "$NODE_VERSION" == "not_found" ]]; then
    fail "Node.js が見つかりません。Node.js ${REQUIRED_NODE_MAJOR}+ をインストールしてください"
else
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [[ "$NODE_MAJOR" -ge "$REQUIRED_NODE_MAJOR" ]]; then
        ok "Node.js ${NODE_VERSION}"
    else
        fail "Node.js ${NODE_VERSION} は古いです。${REQUIRED_NODE_MAJOR}+ が必要です"
    fi
fi

# -----------------------------------------------------------------------------
# 2. Docker 確認
# -----------------------------------------------------------------------------
log "=== 2. Docker Check ==="
if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version)
    ok "Docker: ${DOCKER_VERSION}"
else
    fail "Docker が見つかりません"
fi

if command -v docker compose &>/dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    ok "Docker Compose: ${COMPOSE_VERSION}"
else
    fail "Docker Compose が見つかりません"
fi

# -----------------------------------------------------------------------------
# 3. 環境変数確認
# -----------------------------------------------------------------------------
log "=== 3. Environment Variables Check ==="
REQUIRED_VARS=(
    "DATABASE_URL"
    "ANTHROPIC_API_KEY"
    "FAL_KEY"
    "FISH_AUDIO_API_KEY"
)

if [[ -f "${PROJECT_DIR}/.env" ]]; then
    source "${PROJECT_DIR}/.env"
    ok ".env ファイルが存在"
else
    warn ".env ファイルが見つかりません。.env.example をコピーして設定してください"
fi

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -n "${!var:-}" ]]; then
        ok "${var} が設定済み"
    else
        warn "${var} が未設定"
    fi
done

# -----------------------------------------------------------------------------
# 4. Docker コンテナ起動
# -----------------------------------------------------------------------------
log "=== 4. Docker Containers ==="
if [[ "$CHECK_ONLY" == false ]]; then
    if [[ -f "${PROJECT_DIR}/docker-compose.yml" ]]; then
        cd "$PROJECT_DIR"
        docker compose up -d 2>&1 | tee -a "$LOG_FILE"
        ok "Docker コンテナ起動完了"
    else
        warn "docker-compose.yml が見つかりません（infra-agentが作成予定）"
    fi
else
    # check-only モード: コンテナ状態確認のみ
    if docker compose ps --format json 2>/dev/null | head -1 | grep -q "running"; then
        ok "Docker コンテナが稼働中"
    else
        warn "Docker コンテナが停止中"
    fi
fi

# -----------------------------------------------------------------------------
# 5. PostgreSQL 接続確認
# -----------------------------------------------------------------------------
log "=== 5. PostgreSQL Connection Check ==="
if [[ -n "${DATABASE_URL:-}" ]]; then
    if psql "${DATABASE_URL}" -c "SELECT 1" &>/dev/null; then
        ok "PostgreSQL 接続成功"

        # pgvector 確認
        PGVECTOR=$(psql "${DATABASE_URL}" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'vector'" 2>/dev/null | tr -d ' ')
        if [[ -n "$PGVECTOR" ]]; then
            ok "pgvector ${PGVECTOR} がインストール済み"
        else
            if [[ "$CHECK_ONLY" == false ]]; then
                psql "${DATABASE_URL}" -c "CREATE EXTENSION IF NOT EXISTS vector" 2>&1 | tee -a "$LOG_FILE"
                ok "pgvector をインストールしました"
            else
                warn "pgvector がインストールされていません"
            fi
        fi

        # テーブル数確認
        TABLE_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
        if [[ "$TABLE_COUNT" -ge 33 ]]; then
            ok "テーブル数: ${TABLE_COUNT} (33テーブル以上)"
        else
            warn "テーブル数: ${TABLE_COUNT} (目標: 33テーブル)"
        fi
    else
        fail "PostgreSQL 接続失敗: ${DATABASE_URL}"
    fi
else
    warn "DATABASE_URL が未設定のためスキップ"
fi

# -----------------------------------------------------------------------------
# 6. DDL 適用（check-only でなければ）
# -----------------------------------------------------------------------------
log "=== 6. DDL Application ==="
if [[ "$CHECK_ONLY" == false ]] && [[ -n "${DATABASE_URL:-}" ]]; then
    DDL_FILES=(
        "sql/001_create_tables.sql"
        "sql/002_create_indexes.sql"
        "sql/003_create_triggers.sql"
        "sql/004_seed_settings.sql"
        "sql/005_seed_prompts.sql"
    )
    for ddl in "${DDL_FILES[@]}"; do
        if [[ -f "${PROJECT_DIR}/${ddl}" ]]; then
            psql "${DATABASE_URL}" -f "${PROJECT_DIR}/${ddl}" 2>&1 | tee -a "$LOG_FILE"
            ok "${ddl} 適用完了"
        else
            warn "${ddl} が見つかりません（infra-agentが作成予定）"
        fi
    done
else
    log "DDL適用スキップ（check-only モードまたはDATABASE_URL未設定）"
fi

# -----------------------------------------------------------------------------
# 7. npm 依存関係インストール
# -----------------------------------------------------------------------------
log "=== 7. npm Dependencies ==="
if [[ "$CHECK_ONLY" == false ]]; then
    if [[ -f "${PROJECT_DIR}/package.json" ]]; then
        cd "$PROJECT_DIR"
        npm install 2>&1 | tee -a "$LOG_FILE"
        ok "npm install 完了"
    else
        warn "package.json が見つかりません"
    fi
else
    if [[ -d "${PROJECT_DIR}/node_modules" ]]; then
        ok "node_modules が存在"
    else
        warn "node_modules が見つかりません"
    fi
fi

# -----------------------------------------------------------------------------
# 8. TypeScript ビルド確認
# -----------------------------------------------------------------------------
log "=== 8. TypeScript Build Check ==="
if [[ -f "${PROJECT_DIR}/tsconfig.json" ]]; then
    if npx tsc --noEmit 2>&1 | tee -a "$LOG_FILE"; then
        ok "TypeScript ビルド成功"
    else
        warn "TypeScript ビルドエラー（型エラーあり）"
    fi
else
    warn "tsconfig.json が見つかりません"
fi

# -----------------------------------------------------------------------------
# 9. ファイル存在確認
# -----------------------------------------------------------------------------
log "=== 9. Critical Files Check ==="
CRITICAL_FILES=(
    "feature_list.json"
    "progress.txt"
    "types/database.ts"
    "types/mcp-tools.ts"
    "types/langgraph-state.ts"
    "types/api-schemas.ts"
)
for f in "${CRITICAL_FILES[@]}"; do
    if [[ -f "${PROJECT_DIR}/${f}" ]]; then
        ok "${f} が存在"
    else
        warn "${f} が見つかりません"
    fi
done

# -----------------------------------------------------------------------------
# 10. サマリー
# -----------------------------------------------------------------------------
log "=== Summary ==="
if [[ "$EXIT_CODE" -eq 0 ]]; then
    ok "全チェック通過。開発環境は正常です"
else
    fail "一部チェックが失敗しました。上記のログを確認してください"
fi

exit "$EXIT_CODE"
```

### 3.2 実行モード

| モード | コマンド | 動作 |
|--------|---------|------|
| フルセットアップ | `bash init.sh` | Docker起動 + DDL適用 + npm install + 全チェック |
| チェックのみ | `bash init.sh --check-only` | 状態確認のみ。環境を変更しない |

### 3.3 冪等性保証

| 操作 | 冪等性の仕組み |
|------|-------------|
| Docker起動 | `docker compose up -d` は既に起動中のコンテナをスキップ |
| pgvector | `CREATE EXTENSION IF NOT EXISTS` で既存をスキップ |
| DDL | `CREATE TABLE IF NOT EXISTS` を各DDLファイル内で使用 |
| npm install | package-lock.json が変わらなければ高速スキップ |

## 4. progress.txt プロトコル

### 4.1 フォーマット定義

```
{TIMESTAMP} | {AGENT} | {EVENT} | {FEATURE_ID} | {STATUS} | {DETAILS}
```

| フィールド | 型 | 説明 | 例 |
|-----------|---|------|-----|
| TIMESTAMP | ISO 8601 | UTC タイムスタンプ | `2026-03-01T09:00:00Z` |
| AGENT | string | エージェント名 | `infra-agent` |
| EVENT | enum | イベント種別 | `START`, `COMPLETE`, `COMMIT`, `FAIL`, `SKIP`, `SMOKE`, `BLOCKED` |
| FEATURE_ID | string | 機能ID（または `-`） | `FEAT-DB-001` |
| STATUS | string | ステータス | `in_progress`, `passed`, `failed`, `blocked` |
| DETAILS | string | 自由テキストの詳細 | `TEST-DB-001,TEST-DB-002 green` |

### 4.2 イベント種別

| EVENT | 意味 | 使用タイミング |
|-------|------|-------------|
| `START` | 機能の実装を開始 | 機能に着手する直前 |
| `COMPLETE` | 機能の全テストが通過 | 全test_idsがgreenになった時 |
| `COMMIT` | gitコミットを作成 | `git commit` 直後 |
| `FAIL` | テストが失敗 | テスト失敗時。DETAILSに失敗内容 |
| `SKIP` | 機能をスキップ | 依存関係未解決等でスキップ時 |
| `SMOKE` | スモークテスト実行 | `npm run test:smoke` 実行時 |
| `BLOCKED` | ブロッカー発生 | 30分以上解決できない問題が発生 |
| `SESSION` | セッション開始/終了 | コンテキストウィンドウの開始/終了 |
| `RECOVERY` | リカバリー実行 | エラーからの回復処理時 |

### 4.3 サンプルログ

```
2026-03-01T09:00:00Z | infra-agent | SESSION | - | started | New context window. Last COMPLETE: none
2026-03-01T09:01:00Z | infra-agent | START | FEAT-DB-000 | in_progress | PostgreSQL + pgvector setup
2026-03-01T09:10:00Z | infra-agent | COMPLETE | FEAT-DB-000 | passed | TEST-DB-000 green
2026-03-01T09:11:00Z | infra-agent | COMMIT | - | - | feat(db): setup PostgreSQL 16 + pgvector (FEAT-DB-000, tests: TEST-DB-000)
2026-03-01T09:11:30Z | infra-agent | START | FEAT-DB-001 | in_progress | accounts table DDL
2026-03-01T09:20:00Z | infra-agent | FAIL | FEAT-DB-001 | failed | TEST-DB-002 failed: CHECK constraint on platform not applied
2026-03-01T09:25:00Z | infra-agent | COMPLETE | FEAT-DB-001 | passed | TEST-DB-001,TEST-DB-002 green (fixed CHECK constraint)
2026-03-01T09:26:00Z | infra-agent | COMMIT | - | - | feat(db): create accounts table (FEAT-DB-001, tests: TEST-DB-001,TEST-DB-002)
2026-03-01T09:27:00Z | infra-agent | SMOKE | - | passed | npm run test:smoke exit 0
2026-03-01T09:28:00Z | infra-agent | START | FEAT-DB-002 | in_progress | characters table DDL
2026-03-01T09:35:00Z | infra-agent | COMPLETE | FEAT-DB-002 | passed | TEST-DB-003,TEST-DB-004 green
2026-03-01T09:36:00Z | infra-agent | COMMIT | - | - | feat(db): create characters table (FEAT-DB-002, tests: TEST-DB-003,TEST-DB-004)
```

### 4.4 ルール

| ルール | 説明 |
|--------|------|
| **Append-Only** | progress.txt は追記のみ。既存行の編集・削除は禁止 |
| **毎セッション開始時に読む** | `cat progress.txt \| tail -50` でコンテキストを復元 |
| **全イベントを記録** | START, FAIL, COMPLETE 等、全てのイベントを記録する |
| **SMOKE は必須** | 各COMPLETE後、次のSTART前にSMOKEを記録する |
| **SESSION を記録** | 新しいコンテキストウィンドウ開始時にSESSIONを記録 |

### 4.5 progress.txt の書き込み方法

エージェントは以下のパターンで progress.txt に追記する：

```bash
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') | {agent-name} | {EVENT} | {FEATURE_ID} | {STATUS} | {DETAILS}" >> progress.txt
```

## 5. セッション起動チェックリスト

### 5.1 全エージェント共通の起動手順

**全エージェントは、全てのコンテキストウィンドウの開始時に以下の8ステップを必ず実行する。**
省略は禁止。1ステップでも飛ばすと、古い情報に基づいた実装や、リグレッションの見逃しが発生する。

```
┌─────────────────────────────────────────────────────────────────┐
│  セッション起動チェックリスト（毎回必須）                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: 環境確認                                               │
│    $ pwd                                                        │
│    $ git status                                                 │
│    $ git pull origin develop                                    │
│                                                                 │
│  Step 2: 進捗確認                                               │
│    $ cat progress.txt | tail -50                                │
│    → 自分の最後の COMPLETE/FAIL/BLOCKED を確認                   │
│                                                                 │
│  Step 3: 次の機能を特定                                         │
│    → feature_list.json を読む                                   │
│    → 自分の担当で passes=false かつ依存解決済みの最高優先度を選択  │
│                                                                 │
│  Step 4: コード履歴確認                                         │
│    $ git log --oneline -20                                      │
│    → 他エージェントの最近のコミットを把握                        │
│                                                                 │
│  Step 5: 環境ヘルスチェック                                     │
│    $ bash init.sh --check-only                                  │
│    → FAIL がある場合は bash init.sh（フルセットアップ）を実行    │
│                                                                 │
│  Step 6: スモークテスト                                         │
│    $ npm run test:smoke                                         │
│    → 失敗した場合: 新機能着手前にスモーク修復を最優先            │
│                                                                 │
│  Step 7: セッション記録                                         │
│    → progress.txt に SESSION 行を追記                           │
│                                                                 │
│  Step 8: 作業開始                                               │
│    → Step 3 で特定した1機能に着手                               │
│    → 6. 単一機能ワークフロー に従う                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 各ステップの詳細

#### Step 1: 環境確認

```bash
pwd
# → /home/pochi/workspaces/work/ai-influencer/v5 であること

git status
# → ワーキングツリーがクリーンであること
# → 未コミットの変更がある場合は git stash で退避

git pull origin develop
# → 他エージェントの最新変更を取得
# → コンフリクトが発生した場合はリーダーに報告
```

#### Step 2: 進捗確認

```bash
cat progress.txt | tail -50
```

確認ポイント：
- 自分の最後のイベントが `COMPLETE` → 通常通り次の機能へ
- 自分の最後のイベントが `START` → 前セッションで中断。その機能を再開
- 自分の最後のイベントが `FAIL` → デバッグを再開
- 自分の最後のイベントが `BLOCKED` → ブロッカーが解消されたか確認

#### Step 3: 次の機能を特定

```bash
# feature_list.json を読み、次の機能を特定する
# Read ツールを使って feature_list.json を読む
# selectNextFeature アルゴリズムに従う（§2.5 参照）
```

#### Step 4: コード履歴確認

```bash
git log --oneline -20
```

他エージェントのコミットを確認し、自分の作業に影響する変更がないかチェック。
特に `types/` への変更がある場合は内容を確認する。

#### Step 5: 環境ヘルスチェック

```bash
bash init.sh --check-only
```

FAIL が出力された場合のみ `bash init.sh` を実行。

#### Step 6: スモークテスト

```bash
npm run test:smoke
```

**失敗時の対応**:
- 自分のコードが原因 → 修復を最優先（新機能着手禁止）
- 他エージェントのコードが原因 → リーダーに報告 + 別の依存しない機能に着手

#### Step 7: セッション記録

```bash
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') | {agent-name} | SESSION | - | started | New context window. Last COMPLETE: {last-feature-id}" >> progress.txt
```

#### Step 8: 作業開始

Step 3 で特定した1つの機能について、次章「6. 単一機能ワークフロー」に従って実装を開始する。

## 6. 単一機能ワークフロー

### 6.1 ワークフロー全体像

```
┌─────────────────────────────────────────────────────────────────┐
│  単一機能ワークフロー（1機能 = 1サイクル）                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 機能選択                                                    │
│     feature_list.json → passes=false + 依存解決済み + 最高優先度 │
│     ↓                                                           │
│  2. 仕様書読み込み                                              │
│     spec_refs の仕様書セクションを Read ツールで読む              │
│     ↓                                                           │
│  3. テスト仕様読み込み                                          │
│     test_ids で 12-test-specifications.md の該当テストを読む     │
│     ↓                                                           │
│  4. 実装                                                        │
│     steps に従って1ステップずつ実装                              │
│     ↓                                                           │
│  5. テスト実行                                                  │
│     test_ids に紐づくテストを全て実行                            │
│     ↓                                                           │
│  ┌─ 6a. テスト失敗                                              │
│  │   → progress.txt に FAIL 記録                                │
│  │   → デバッグ → 修正 → Step 5 に戻る                          │
│  │   → 3回失敗 → BLOCKED 記録 → 次の機能へ                     │
│  └─ 6b. テスト全通過                                            │
│     ↓                                                           │
│  7. git add + commit                                            │
│     → コミットメッセージ規則に従う（§7参照）                     │
│     ↓                                                           │
│  8. progress.txt 更新                                           │
│     → COMPLETE 行を追記                                         │
│     ↓                                                           │
│  9. feature_list.json 更新                                      │
│     → passes: false → passes: true                              │
│     ↓                                                           │
│ 10. スモークテスト                                              │
│     $ npm run test:smoke                                        │
│     ↓                                                           │
│  ┌─ 11a. スモーク失敗（リグレッション）                         │
│  │   → git revert で直前コミットを取り消し                      │
│  │   → passes を false に戻す                                   │
│  │   → 原因調査 → 修正 → Step 4 に戻る                         │
│  └─ 11b. スモーク通過                                           │
│     ↓                                                           │
│ 12. 次の機能へ                                                  │
│     → Step 1 に戻る                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 各ステップの詳細

#### Step 1: 機能選択

```
→ §2.5 の selectNextFeature アルゴリズムを実行
→ progress.txt に START 行を追記
```

#### Step 2: 仕様書読み込み

```
→ 機能の spec_refs に記載された仕様書セクションを Read ツールで読む
→ 仕様書の内容に基づいて実装方針を確認
→ 不明点がある場合はリーダーに質問（SendMessage）
```

#### Step 3: テスト仕様読み込み

```
→ 機能の test_ids に対応するテストを 12-test-specifications.md から読む
→ テストの期待結果を把握してから実装に入る（TDD的アプローチ）
```

#### Step 4: 実装

```
→ 機能の steps に従って1ステップずつ実装
→ 各ステップで Write/Edit ツールを使用
→ 型定義（types/）に厳密に準拠
→ system_settings からの設定値読み込みを忘れない
```

#### Step 5: テスト実行

```bash
# 機能の test_ids に対応するテストを実行
npx jest --testPathPattern="TEST-DB-001" --verbose
```

#### Step 6: テスト結果の処理

**6a. テスト失敗時:**
```bash
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') | {agent} | FAIL | {feature-id} | failed | {test-id} failed: {error-summary}" >> progress.txt
```
- エラーメッセージを読み、原因を特定
- 修正して再テスト
- **3回連続失敗した場合**: BLOCKED として記録し、次の機能に移る

**6b. テスト全通過時:**
```
→ Step 7 へ進む
```

#### Step 7: git add + commit

```bash
git add {changed-files}
git commit -m "$(cat <<'EOF'
feat({module}): {description} ({feature-id}, tests: {test-ids})

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

#### Step 8: progress.txt 更新

```bash
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') | {agent} | COMPLETE | {feature-id} | passed | {test-ids} green" >> progress.txt
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') | {agent} | COMMIT | - | - | feat({module}): {description} ({feature-id}, tests: {test-ids})" >> progress.txt
```

#### Step 9: feature_list.json 更新

```
→ feature_list.json の該当機能の passes を false → true に変更
→ 他のフィールドは一切変更しない
```

#### Step 10: スモークテスト

```bash
npm run test:smoke
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') | {agent} | SMOKE | - | {passed|failed} | npm run test:smoke exit {code}" >> progress.txt
```

#### Step 11: スモーク結果の処理

**11a. スモーク失敗（リグレッション）:**
```bash
# 直前のコミットを取り消し
git revert HEAD --no-edit

# feature_list.json の passes を false に戻す
# progress.txt にリグレッション記録
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') | {agent} | RECOVERY | {feature-id} | reverted | Regression detected. Reverted commit." >> progress.txt
```
- 原因を調査
- 修正して Step 4 に戻る

**11b. スモーク通過:**
```
→ Step 12 (次の機能) へ
```

#### Step 12: 次の機能へ

Step 1 に戻り、次の機能を選択する。

## 7. Git戦略

### 7.1 ブランチ構成

```
main ── 本番ブランチ（直接コミット禁止）
  └── develop ── 開発統合ブランチ
       ├── feat/infra-agent/FEAT-DB-001
       ├── feat/infra-agent/FEAT-DB-002
       ├── feat/mcp-core-agent/FEAT-MCC-001
       ├── feat/mcp-core-agent/FEAT-MCC-002
       ├── feat/video-worker-agent/FEAT-VW-001
       └── ...
```

### 7.2 ブランチ命名規則

```
feat/{agent-name}/{feature-id}

例:
  feat/infra-agent/FEAT-DB-001
  feat/mcp-core-agent/FEAT-MCC-002
  feat/dashboard-agent/FEAT-DSH-001
```

### 7.3 コミットメッセージ規則

```
{type}({module}): {description} ({feature-id}, tests: {test-ids})

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

| フィールド | 説明 | 例 |
|-----------|------|-----|
| type | Conventional Commits タイプ | `feat`, `fix`, `test`, `docs`, `chore` |
| module | モジュール名 | `db`, `mcp-core`, `mcp-intel`, `video-worker`, `text-post`, `measure`, `intelligence`, `strategy`, `dashboard`, `test` |
| description | 変更の簡潔な説明 | `create accounts table` |
| feature-id | 機能ID | `FEAT-DB-001` |
| test-ids | 通過したテストID | `TEST-DB-001,TEST-DB-002` |

**コミットメッセージ例:**

```
feat(db): create accounts table with all constraints (FEAT-DB-001, tests: TEST-DB-001,TEST-DB-002)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

```
feat(mcp-core): implement accounts CRUD tools (FEAT-MCC-002, tests: TEST-MCC-002,TEST-MCC-003)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### 7.4 マージフロー

```
1. エージェントが feat/{agent}/{feature} ブランチで作業
2. 機能完了 → テスト全通過 → コミット
3. git push origin feat/{agent}/{feature}
4. リーダーが develop にマージ（自動: CI全通過時）
5. 全機能完了後、develop → main にマージ（人間承認）
```

### 7.5 禁止事項

| 禁止 | 理由 |
|------|------|
| `git push --force` | 他エージェントの作業を破壊する |
| `git commit --amend` (pushした後) | 共有ブランチの履歴改変 |
| `git rebase -i` (共有ブランチ) | 履歴の改変 |
| `main` への直接コミット | 品質ゲート未通過のコードが本番に入る |
| 1コミットに複数機能 | 進捗追跡が不可能になる |

## 8. 品質ゲート（全自動、人間判断不要）

### 8.1 6つの品質ゲート

全てのゲートは自動実行され、人間の判断を必要としない。

| ゲート | チェック内容 | コマンド | 通過条件 |
|--------|------------|---------|---------|
| **G1** | ユニットテスト | `npm run test:unit` | Exit code 0, 0 failures |
| **G2** | 型チェック | `npx tsc --noEmit` | Exit code 0, 0 errors |
| **G3** | Lint | `npx eslint . --max-warnings 0` | Exit code 0, 0 warnings |
| **G4** | 統合テスト | `npm run test:integration` | Exit code 0, 0 failures |
| **G5** | E2Eスモーク | `npm run test:smoke` | Exit code 0, 0 failures |
| **G6** | リグレッション | 以前通過した全機能のテストが引き続き通過 | 新規 failures = 0 |

### 8.2 ゲートの適用タイミング

| タイミング | 適用ゲート | 実行者 |
|-----------|-----------|-------|
| 各機能完了時 | G1 (該当テストのみ) | 担当エージェント |
| スモークテスト時 | G5 | 担当エージェント |
| ブランチマージ前 | G1 + G2 + G3 | リーダー (or CI) |
| develop マージ後 | G1 + G2 + G3 + G4 | リーダー |
| E2Eテスト時 (Week 5-7) | G1 + G2 + G3 + G4 + G5 + G6 | test-agent + リーダー |

### 8.3 npm scripts 定義

テスト・品質ゲートで使用する主要コマンド（完全な定義は **付録A** を参照）：

```json
{
  "scripts": {
    "test:unit": "jest --testPathPattern='tests/unit' --passWithNoTests",
    "test:integration": "jest --testPathPattern='tests/integration' --passWithNoTests",
    "test:smoke": "jest --testPathPattern='tests/smoke' --passWithNoTests",
    "test:e2e": "jest --testPathPattern='tests/e2e' --passWithNoTests --runInBand",
    "test:all": "jest --passWithNoTests",
    "test:coverage": "jest --coverage --passWithNoTests",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "quality": "npm run typecheck && npm run lint && npm run test:all"
  }
}
```

### 8.4 ゲート失敗時のフロー

```
G1 失敗 → 実装を修正 → 再テスト → 3回失敗で BLOCKED
G2 失敗 → 型エラーを修正 → 再チェック
G3 失敗 → lint ルールに従って修正 → 再チェック
G4 失敗 → 結合部分を修正 → 再テスト
G5 失敗 → リグレッション。git revert → 原因調査 → 修正
G6 失敗 → 以前の機能が壊れた。最優先で修復
```

## 9. リカバリー手順

### 9.1 テスト失敗

```
状況: テスト実行で失敗が発生
手順:
  1. エラーメッセージを読み、原因を特定
  2. progress.txt に FAIL を記録
  3. コードを修正
  4. テストを再実行
  5. 通過 → COMPLETE を記録
  6. 3回連続失敗 → BLOCKED を記録 → リーダーに報告 → 次の機能へ
```

### 9.2 30分以上スタック

```
状況: 1つの問題に30分以上費やしている
手順:
  1. progress.txt に BLOCKED を記録
     "... | BLOCKED | {feature-id} | blocked | Stuck >30min: {problem description}"
  2. リーダーにメッセージ送信（SendMessage）
     内容: 機能ID、問題の説明、試したアプローチ
  3. 別の依存しない機能に移行
  4. リーダーからの指示を待つ
```

### 9.3 スモークテスト失敗（リグレッション）

```
状況: npm run test:smoke が失敗。直前のコミットがリグレッションを導入
手順:
  1. 全エージェントに STOP を通知（リーダー経由のbroadcast）
  2. git revert HEAD --no-edit で直前コミットを取り消し
  3. feature_list.json の passes を false に戻す
  4. progress.txt に RECOVERY を記録
  5. リグレッションの原因を調査
  6. 修正して再テスト → 全ゲート通過 → 再コミット
  7. スモークテスト通過を確認してから次の機能に進む
```

### 9.4 コンテキストウィンドウ枯渇

```
状況: エージェントのコンテキストウィンドウが限界に達する
手順:
  1. 現在の作業状態を progress.txt に記録
     - 作業中の機能ID
     - 現在のステップ
     - 残りの作業内容
  2. git add + commit で途中状態を保存（WIPコミット可）
  3. 新しいコンテキストウィンドウで §5 のチェックリストを実行
  4. progress.txt の最後のエントリから状態を復元
  5. 中断したステップから再開
```

### 9.5 エージェントクラッシュ

```
状況: エージェントプロセスが予期せず終了
手順（リーダーが実行）:
  1. progress.txt を確認 → 最後の COMPLETE を特定
  2. git log で最後のコミットを確認
  3. feature_list.json で現在の進捗を確認
  4. 新しいエージェントを起動
  5. §5 のチェックリストが自動的にリカバリーを実行
  → progress.txt + git log = 完全な復旧情報
```

### 9.6 gitコンフリクト

```
状況: git pull 時にコンフリクトが発生
手順:
  1. コンフリクトファイルを確認
  2. 自分の担当ディレクトリ内 → 自分で解決
  3. 共有ファイル（types/, package.json 等）→ リーダーに報告
  4. コンフリクト解決後、テストを再実行して品質を確認
```

### 9.7 DB接続エラー

```
状況: PostgreSQL への接続が失敗
手順:
  1. bash init.sh --check-only で環境を確認
  2. Docker コンテナの状態確認: docker compose ps
  3. コンテナが停止 → docker compose up -d
  4. 接続情報（DATABASE_URL）が正しいか確認
  5. 復旧しない場合 → リーダーに報告
```

## 10. 人間介入ポイント（最小化）

### 10.1 介入スケジュール

| タイミング | 作業内容 | 所要時間 |
|-----------|---------|---------|
| Week 0 | 仕様承認 + feature_list.json レビュー + init.sh レビュー | 30 min |
| Week 1 | インフラ検証（Docker + DB稼働確認）| 15 min |
| Week 1 | 週次レビュー（progress.txt + feature_list.json 確認）| 15 min |
| Week 2 | 週次レビュー | 15 min |
| Week 3 | 週次レビュー | 15 min |
| Week 4 | 週次レビュー | 15 min |
| Week 5 | 週次レビュー + 統合テスト結果確認 | 15 min |
| Week 6 | 週次レビュー + E2Eテスト結果確認 | 15 min |
| Week 7 | 本番デプロイ承認 | 15 min |
| オンデマンド | ブロッカー解消（progress.txt でBLOCKEDを検出した場合）| 0-30 min |
| **合計** | | **< 2.5 時間** |

### 10.2 週次レビューの手順

```bash
# 1. 進捗確認（1分）
jq '[.features[] | select(.passes==true)] | length' feature_list.json
# → "85 / 291 features passed" のように表示

# 2. 最近の活動確認（2分）
tail -30 progress.txt
# → 各エージェントの最近の活動を確認

# 3. ブロッカー確認（2分）
grep "BLOCKED" progress.txt | tail -10
# → 未解決のブロッカーがあれば対応

# 4. コード変更量確認（1分）
git log --oneline --since="1 week ago" | wc -l
# → 週あたりのコミット数

# 5. テストカバレッジ確認（2分）
npx jest --coverage --passWithNoTests 2>/dev/null | tail -20
```

### 10.3 ブロッカー解消の判断基準

| ブロッカー種別 | 人間の対応 |
|-------------|-----------|
| 仕様の曖昧さ | 仕様書の該当セクションを明確化 |
| 外部API障害 | 代替手段の指示 or 一時スキップの承認 |
| 環境問題 | infra-agentに修復指示 |
| エージェント間の依存 | タスク優先度の調整 |
| 技術的判断 | 方針の決定と指示 |

## 11. モニタリング

### 11.1 進捗モニタリング

```bash
# 全体進捗率
jq '[.features[] | select(.passes==true)] | length' feature_list.json
# 出力例: 85
# → 85 / 291 = 29.2%

# カテゴリ別進捗
jq -r '
  .features
  | group_by(.category)
  | map({
      category: .[0].category,
      total: length,
      passed: [.[] | select(.passes==true)] | length
    })
  | .[]
  | "\(.category): \(.passed)/\(.total)"
' feature_list.json

# 出力例:
# database: 26/26
# infra: 5/7
# mcp-core: 35/50
# mcp-intel: 20/52
# ...

# エージェント別進捗
jq -r '
  .features
  | group_by(.agent)
  | map({
      agent: .[0].agent,
      total: length,
      passed: [.[] | select(.passes==true)] | length
    })
  | .[]
  | "\(.agent): \(.passed)/\(.total)"
' feature_list.json
```

### 11.2 直近の活動

```bash
# 最新20行
tail -20 progress.txt

# 特定エージェントの活動
grep "infra-agent" progress.txt | tail -10

# ブロッカー一覧
grep "BLOCKED" progress.txt

# 今日のCOMPLETE数
grep "$(date -u '+%Y-%m-%d')" progress.txt | grep "COMPLETE" | wc -l
```

### 11.3 コード品質

```bash
# テストカバレッジ
npx jest --coverage --passWithNoTests

# lint エラー数
npx eslint . 2>/dev/null | tail -5

# 型エラー数
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

### 11.4 Git統計

```bash
# 今週のコミット数
git log --oneline --since="1 week ago" | wc -l

# エージェント別コミット数（Co-Authored-Byから）
git log --since="1 week ago" --format="%s" | grep -oP 'FEAT-[A-Z]+-[0-9]+' | sort | uniq -c | sort -rn

# ファイル変更量
git diff --stat develop...HEAD
```

### 11.5 環境ヘルスチェック

```bash
# クイックヘルスチェック
bash init.sh --check-only

# Docker コンテナ状態
docker compose ps

# DB接続確認
psql "${DATABASE_URL}" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"

# ディスク使用量
df -h /home/pochi
```

## 12. アンチパターン防止

### 12.1 アンチパターン一覧

| # | アンチパターン | 説明 | 防止策 | 検出方法 |
|---|-------------|------|-------|---------|
| 1 | **One-shotting** | 複数機能を一度に実装しようとする | 単一機能ワークフローの強制 | progress.txt で1つの COMMIT に複数 FEAT-ID が含まれる |
| 2 | **Premature Completion** | テスト未通過で完了とマーク | test_ids 全通過が COMPLETE の前提条件 | feature_list.json の passes=true だが、テスト出力に該当test_idがない |
| 3 | **Test Modification** | テスト内容を改変して通過させる | test_ids は不変フィールド。テストコードの変更は test-agent のみ許可 | git diff で tests/ ディレクトリへの変更を test-agent 以外が行っている |
| 4 | **E2E Skip** | スモークテストを省略して次の機能に進む | ワークフローで SMOKE が必須 | progress.txt で COMPLETE → START の間に SMOKE がない |
| 5 | **Batch Commits** | 複数機能を1コミットにまとめる | 1コミット = 1機能の原則 | git log で大きな diff のコミットを検出 |
| 6 | **Spec Drift** | 仕様書と異なる実装をする | spec_refs の参照を強制 | コードレビュー時にリーダーが仕様書と照合 |
| 7 | **Dependency Skip** | 依存関係を無視して実装 | selectNextFeature で依存チェック | feature_list.json で依存先が passes=false なのに自身が passes=true |
| 8 | **Silent Failure** | テスト失敗を記録せず次に進む | FAIL イベントの記録を強制 | progress.txt で START → COMPLETE の間に FAIL/テスト実行の記録がない |
| 9 | **Config Hardcoding** | 設定値をコードにハードコーディング | system_settings からの読み込みを強制 | grep でマジックナンバーや定数を検出 |
| 10 | **Type Bypass** | any 型やas キャストで型チェックを回避 | ESLint の `@typescript-eslint/no-explicit-any` ルール | npx eslint でany使用を検出 |

### 12.2 自動検出スクリプト

リーダーが週次で実行する自動検出：

```bash
#!/bin/bash
# anti-pattern-check.sh — アンチパターン検出スクリプト

echo "=== Anti-Pattern Detection ==="

# AP1: One-shotting (1コミットに複数FEAT)
echo "--- AP1: One-shotting ---"
git log --format="%s" --since="1 week ago" | while read msg; do
    FEAT_COUNT=$(echo "$msg" | grep -oP 'FEAT-[A-Z]+-[0-9]+' | wc -l)
    if [[ "$FEAT_COUNT" -gt 1 ]]; then
        echo "WARN: Multiple features in one commit: $msg"
    fi
done

# AP4: E2E Skip (COMPLETE without SMOKE)
echo "--- AP4: E2E Skip ---"
LAST_EVENT=""
while IFS='|' read -r ts agent event feat status details; do
    event=$(echo "$event" | tr -d ' ')
    if [[ "$LAST_EVENT" == "COMPLETE" && "$event" == "START" ]]; then
        echo "WARN: COMPLETE → START without SMOKE"
    fi
    LAST_EVENT="$event"
done < progress.txt

# AP9: Config Hardcoding
echo "--- AP9: Config Hardcoding ---"
grep -rn "MAX_CONCURRENT\|POLL_INTERVAL\|RETRY_MAX\|ANOMALY_DETECTION" src/ \
    --include="*.ts" \
    | grep -v "system_settings\|getSetting\|import" \
    | head -20

# AP10: Type Bypass
echo "--- AP10: Type Bypass ---"
grep -rn ": any\|as any\|<any>" src/ --include="*.ts" | head -20

echo "=== Detection Complete ==="
```

### 12.3 リーダーによるレビュー観点

リーダーが各エージェントのコードをレビューする際のチェックリスト：

| # | 観点 | 確認方法 |
|---|------|---------|
| 1 | 仕様書との整合性 | spec_refs のセクションとコードを照合 |
| 2 | 型定義との整合性 | types/ の型と実装の一致 |
| 3 | テストの十分性 | test_ids の全テストが実装されているか |
| 4 | system_settings の使用 | 設定値がハードコーディングされていないか |
| 5 | エラーハンドリング | 02-architecture.md §9 のパターンに従っているか |
| 6 | コミット粒度 | 1コミット = 1機能か |
| 7 | progress.txt の記録 | 全イベントが正しく記録されているか |

## 付録A: npm scripts 完全定義

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "jest --passWithNoTests",
    "test:unit": "jest --testPathPattern='tests/unit' --passWithNoTests",
    "test:integration": "jest --testPathPattern='tests/integration' --passWithNoTests",
    "test:smoke": "jest --testPathPattern='tests/smoke' --passWithNoTests",
    "test:e2e": "jest --testPathPattern='tests/e2e' --passWithNoTests --runInBand",
    "test:all": "jest --passWithNoTests",
    "test:coverage": "jest --coverage --passWithNoTests",
    "lint": "eslint . --max-warnings 0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write 'src/**/*.ts' 'tests/**/*.ts' 'dashboard/**/*.{ts,tsx}'",
    "format:check": "prettier --check 'src/**/*.ts' 'tests/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "quality": "npm run typecheck && npm run lint && npm run test:all",
    "quality:full": "npm run typecheck && npm run lint && npm run test:coverage",
    "db:setup": "psql $DATABASE_URL -f sql/001_create_tables.sql -f sql/002_create_indexes.sql -f sql/003_create_triggers.sql",
    "db:seed": "psql $DATABASE_URL -f sql/004_seed_settings.sql -f sql/005_seed_prompts.sql",
    "db:reset": "psql $DATABASE_URL -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' && npm run db:setup && npm run db:seed",
    "init": "bash init.sh",
    "init:check": "bash init.sh --check-only",
    "progress": "tail -30 progress.txt",
    "progress:stats": "jq '[.features[] | select(.passes==true)] | length' feature_list.json"
  }
}
```

## 付録B: エージェント起動テンプレート

リーダーが各エージェントを起動する際のプロンプトテンプレート：

```
あなたは {agent-name} です。v5.0 の {module-description} を担当します。

## 作業ルール

1. 毎セッション開始時に §5 のセッション起動チェックリストを実行してください
2. §6 の単一機能ワークフローに従って、1機能ずつ実装してください
3. feature_list.json から自分の担当（agent: "{agent-name}"）で
   passes=false かつ依存解決済みの最高優先度の機能を選択してください
4. 各機能の仕様は spec_refs に記載された仕様書を参照してください
5. テストは test_ids に対応するテストを全て通過させてください
6. 全ての作業を progress.txt に記録してください
7. 1機能 = 1コミット を厳守してください
8. 30分以上スタックした場合はリーダーに報告して次の機能に移ってください

## 担当ファイル

{list of directories/files this agent owns}

## 参照仕様書

{list of spec files to reference}
```

## 付録C: feature_list.json 生成チェックリスト

リーダーが feature_list.json を初期生成する際の確認項目：

| # | 確認項目 | 完了 |
|---|---------|------|
| 1 | 全33テーブルに対応する FEAT-DB-xxx が存在 | ☐ |
| 2 | 全103 MCPツール + 13 Dashboard REST API に対応する FEAT-MCC-xxx / FEAT-MCI-xxx が存在 | ☐ |
| 3 | 全4 LangGraphグラフに対応する FEAT-INT-xxx / FEAT-STR-xxx が存在 | ☐ |
| 4 | 全15 ダッシュボード画面に対応する FEAT-DSH-xxx が存在 | ☐ |
| 5 | 全機能に test_ids が設定されている | ☐ |
| 6 | 全機能に spec_refs が設定されている | ☐ |
| 7 | 依存関係が循環していない | ☐ |
| 8 | P0 機能が Week 1-2 に必要なものを網羅 | ☐ |
| 9 | 全エージェントに最低10機能が割り当てられている | ☐ |
| 10 | JSON が valid である (`jq . feature_list.json` が成功) | ☐ |
