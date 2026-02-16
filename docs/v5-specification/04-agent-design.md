# AIエージェント設計

> v5.0のAIエージェント階層構造、MCP Serverツール一覧、LangGraphグラフ設計、データフロー、仮説駆動サイクルを詳細に定義する
>
> **エージェント総数**: 社長1 + 専門職2〜3 + 部長N + ワーカープール = 可変
>
> **MCPツール数**: ~60ツール (7カテゴリ)
>
> **LangGraphグラフ数**: 4グラフ (戦略サイクル / 制作パイプライン / 投稿スケジューラー / 計測ジョブ)
>
> **関連ドキュメント**: [02-architecture.md](02-architecture.md) (システムアーキテクチャ), [03-database-schema.md](03-database-schema.md) (DBスキーマ), [01-tech-stack.md](01-tech-stack.md) (技術スタック)

## 1. エージェント階層設計

v5.0のエージェントは **4層階層型** で構成される。上位層が方針を決定し、下位層が実行する。各層は責任範囲が明確に分離されており、スケール時はLayer 3 (プランナー) とLayer 4 (ワーカー) を水平に増やすだけで対応できる。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Layer 1: 戦略エージェント (社長) × 1体                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Claude Opus 4.6                                                  │  │
│  │  全アカウントのKPI監視 / 大方針決定 / リソース配分                   │  │
│  │  トリガー: 日次 (毎朝)                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│           │ 方針指示                  ▲ 分析報告・市場動向                │
│           ▼                          │                                  │
│  Layer 2: 専門職エージェント × 2〜3体                                    │
│  ┌─────────────────────────┐  ┌─────────────────────────┐            │
│  │  リサーチャー (Researcher) │  │  アナリスト (Analyst)     │            │
│  │  Claude Sonnet 4.5       │  │  Claude Sonnet 4.5       │            │
│  │  市場調査・トレンド収集    │  │  パフォーマンス分析       │            │
│  │  トリガー: 数時間ごと     │  │  仮説検証・知見蓄積       │            │
│  │  × 1〜数体              │  │  トリガー: 計測完了後     │            │
│  └─────────────────────────┘  │  × 1体                  │            │
│           │ 判断材料                  └─────────────────────────┘        │
│           ▼                          │ 判断材料                         │
│  Layer 3: プランナーエージェント (部長) × N体                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Claude Sonnet 4.5                                                │  │
│  │  ニッチ/クラスター別に20〜50アカウント担当                           │  │
│  │  コンテンツ計画・仮説立案・数日先の投稿計画                          │  │
│  │  トリガー: 日次                                                    │  │
│  │  スケール方針: プランナーを増やすだけで水平スケール                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│           │ 制作指示・投稿指示                ▲ 完了報告                  │
│           ▼                                 │                          │
│  Layer 4: ワーカーエージェント (作業員) — ステートレス・プール              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ 制作ワーカー   │  │ 投稿ワーカー   │  │ 計測ワーカー   │                │
│  │ (コード)      │  │ (コード)      │  │ (コード)      │                │
│  │ 動画生成      │  │ 各プラット     │  │ メトリクス     │                │
│  │ v4.0 PL活用   │  │ フォームへ投稿 │  │ 収集          │                │
│  │ 負荷で増減    │  │ 負荷で増減    │  │ 負荷で増減    │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Layer 1: 社長 — 戦略エージェント (Strategic Agent) x 1体

システム全体の「経営者」として機能する唯一の最上位エージェント。全アカウントのKPIを俯瞰し、ポートフォリオレベルの意思決定を行う。

| 項目 | 詳細 |
|------|------|
| **LLM** | Claude Opus 4.6 |
| **体数** | 1体 (シングルトン) |
| **トリガー** | 日次 (毎朝1回、cronスケジュール) |
| **入力** | アナリストからの分析報告、リサーチャーからの市場動向、人間からの未処理指示 |
| **出力** | サイクル方針、プランナーへの指示、リソース配分決定 |
| **System Prompt概要** | 「あなたはAI-Influencerシステムの戦略責任者です。全アカウントのKPIを監視し、各サイクルの方針を決定します。データに基づいた意思決定を行い、仮説駆動サイクルの品質を維持してください。」 |

**Opus 4.6を使用する理由**:
- 複数ニッチにまたがるポートフォリオレベルの判断には高い推論能力が必要
- 日次1回の実行なのでコストは許容範囲 (1日1回 x ~$0.30〜0.50 = 月$10〜15)
- 仮説の承認/却下、リソースの再配分など「判断の質」がシステム全体の性能を左右する

**具体的な責務**:

1. **サイクル開始**: 新しいサイクルを開始し、前サイクルの結果を確認する
2. **方針決定**: アナリスト報告 + リサーチャーデータに基づき、今サイクルの注力領域を決定する
3. **リソース配分**: クラスター間 (ニッチ間) のコンテンツ制作量を配分する
4. **計画承認**: プランナーが策定したコンテンツ計画を承認/差戻しする
5. **人間指示の処理**: ダッシュボードからの `human_directives` を読み取り、計画に反映する
6. **KPI監視**: 全アカウントの目標進捗を確認し、異常があれば方針を修正する

### 1.2 Layer 2: 専門職 — リサーチャー (Researcher) x 1〜数体

市場情報を継続的に収集し、構造化して蓄積する「情報収集の専門家」。社長とプランナーに判断材料を提供する。

| 項目 | 詳細 |
|------|------|
| **LLM** | Claude Sonnet 4.5 |
| **体数** | 1〜数体 (情報源の数に応じてスケール) |
| **トリガー** | 連続実行 (数時間ごとのcronスケジュール) |
| **入力** | Web上の市場情報 (トレンド, 競合, プラットフォーム動向) |
| **出力** | `market_intel` テーブルに構造化データを蓄積 |
| **System Prompt概要** | 「あなたは市場調査の専門家です。各ニッチのトレンド、競合アカウントの動向、プラットフォームのアルゴリズム変更を調査し、構造化されたインテリジェンスとしてデータベースに保存してください。」 |

**ツール (LLM内蔵 + MCP)**:
- `WebSearch` — Webを検索してトレンド・競合情報を取得
- `WebFetch` — 特定URLのコンテンツを取得・分析
- MCP DB保存ツール群 — 収集した情報を `market_intel` テーブルに構造化保存

**収集する情報の5カテゴリ**:

| カテゴリ | intel_type | 収集頻度 | 有効期限 | 例 |
|---------|-----------|---------|---------|-----|
| トレンドトピック | `trending_topic` | 6時間ごと | 7日 | 「glass skin」トレンドの急上昇 |
| 競合投稿 | `competitor_post` | 12時間ごと | 30日 | 競合の100万再生動画のフォーマット分析 |
| 競合アカウント | `competitor_account` | 24時間ごと | 30日 | 競合アカウントのフォロワー数推移 |
| オーディエンスシグナル | `audience_signal` | 12時間ごと | 14日 | コメント欄のセンチメント変化 |
| プラットフォーム更新 | `platform_update` | 24時間ごと | 恒久 | TikTokのアルゴリズム変更発表 |

### 1.3 Layer 2: 専門職 — アナリスト (Analyst) x 1体

パフォーマンスデータを分析し、仮説の検証と知見の蓄積を担う「分析の専門家」。戦略エージェントとプランナーに分析結果を還元する。

| 項目 | 詳細 |
|------|------|
| **LLM** | Claude Sonnet 4.5 |
| **体数** | 1体 |
| **トリガー** | 計測完了後 (48h後にmetricsテーブルに新規データが入った時点) |
| **入力** | `metrics` テーブルの新規データ、`hypotheses` テーブルの検証待ち仮説 |
| **出力** | `analyses` テーブルの分析結果、`learnings` テーブルの知見、`hypotheses` テーブルのverdict更新、`algorithm_performance` テーブルの精度記録 |
| **System Prompt概要** | 「あなたはデータ分析の専門家です。投稿のパフォーマンスデータを分析し、仮説を検証し、再利用可能な知見を抽出してください。統計的に有意な結論のみを導き、データ不足の場合は正直に 'inconclusive' と判定してください。」 |

**分析の4タイプ**:

| analysis_type | トリガー | 目的 | 出力先 |
|--------------|---------|------|--------|
| `cycle_review` | サイクル終了時 | サイクル全体の振り返り | analyses + algorithm_performance |
| `hypothesis_verification` | 計測データ到着時 | 個別仮説のpredicted vs actual比較 | hypotheses.verdict + analyses |
| `anomaly_detection` | 計測データ到着時 | 異常値 (急落/急伸) の検出 | analyses |
| `trend_analysis` | 随時 | 中長期トレンドの分析 | analyses + learnings |

### 1.4 Layer 3: 部長 — プランナーエージェント (Planner) x N体

ニッチ/クラスター別に20〜50アカウントを担当し、具体的なコンテンツ計画を策定する「中間管理職」。v5.0のスケーラビリティの鍵を握るエージェント。

| 項目 | 詳細 |
|------|------|
| **LLM** | Claude Sonnet 4.5 |
| **体数** | N体 (ニッチ/クラスター別。初期2〜3体、スケール時に増設) |
| **トリガー** | 日次 (戦略エージェントからの方針指示を受けて) |
| **入力** | 戦略エージェントからのサイクル方針、アナリストからの知見、リサーチャーからのトレンド |
| **出力** | `content` テーブルに `planned` ステータスのレコード、`hypotheses` テーブルに新仮説 |
| **System Prompt概要** | 「あなたはbeautyニッチ担当のコンテンツプランナーです。担当アカウント群に対して、仮説に基づいたコンテンツ計画を策定してください。過去の知見とトレンドを活用し、数日先の投稿を前もって計画してください。」 |

**スケール方針**:

```
初期 (50アカウント):
  プランナーA: beauty (20アカウント)
  プランナーB: tech + fitness (30アカウント)

中期 (500アカウント):
  プランナーA: beauty-skincare (50)
  プランナーB: beauty-makeup (50)
  プランナーC: tech-gadget (50)
  プランナーD: tech-ai (50)
  ...

大規模 (3,500アカウント):
  70体のプランナー (各50アカウント担当)
```

**具体的な責務**:

1. **担当アカウントの確認**: 自分のクラスターに属するアカウント一覧と現在のパフォーマンスを把握
2. **仮説の立案**: 過去の知見 + トレンド + 戦略方針に基づき、検証可能な仮説を生成
3. **コンテンツ計画**: 仮説を検証するためのコンテンツを計画 (シナリオ選択、キャラクター割当、投稿日設定)
4. **コンポーネント選択**: 利用可能なシナリオ・モーションの中から最適なものを選択
5. **スケジュール設定**: `planned_post_date` を設定し、投稿タイミングを決定

### 1.5 Layer 4: 作業員 — ワーカーエージェント (ステートレス・プール)

指示通りに実行する「手足」。LLMではなくコードで実装され、判断を行わない。タスクキューからタスクを取得し、処理し、結果を報告する。

| ワーカー種別 | 実装方式 | 役割 | スケール |
|------------|---------|------|---------|
| **制作ワーカー** | Node.js (v4.0パイプライン) | 動画/コンテンツ生成 | 同時制作数に応じて (fal.aiの同時実行上限に依存) |
| **投稿ワーカー** | Node.js (投稿アダプター) | プラットフォーム別に投稿実行 | 投稿量に応じて |
| **計測ワーカー** | Node.js (計測コード) | 投稿48h後にメトリクス収集 | 計測対象数に応じて |

**ワーカーの共通特性**:
- **ステートレス**: 状態を持たない。タスクキューからタスクを取得し、完了したら結果を書き戻す
- **冪等**: 同じタスクを複数回実行しても副作用がない
- **考えない**: LLMを使わない。入力→処理→出力のパイプライン
- **スケーラブル**: 負荷に応じてワーカー数を増減

## 2. エージェント間の情報の流れ

### 2.1 方向別データフロー

エージェント間の情報は **4つの方向** で流れる。全ての情報はPostgreSQLを経由する (直接通信しない)。

```
                    ┌──────────────────────────────────┐
                    │         社長 (戦略Agent)           │
                    │         Claude Opus 4.6           │
                    └──┬──────────────┬─────────────┬───┘
              (1)下向き│              │             │(2)上向き
              方針指示 │              │             │分析報告
                       │     (3)横方向│             │
                       │     判断材料 │             │
          ┌────────────▼───┐    ┌────▼────────────▼──┐
          │ プランナー (部長) │◄───│ 専門職             │
          │ Sonnet x N     │(3) │ リサーチャー Sonnet │
          │                │    │ アナリスト   Sonnet │
          └───────┬────────┘    └────────────────────┘
             (1)下向き│                  ▲(2)上向き
             制作指示 │                  │完了報告
                     │                  │
          ┌──────────▼──────────────────┴──┐
          │ ワーカー (作業員) — コード       │
          │ 制作 / 投稿 / 計測              │
          └────────────────────────────────┘
                         │
                         ▼
          ┌────────────────────────────────┐
          │ PostgreSQL (全データの最終保存先) │
          └────────────────────────────────┘
```

### 2.2 4つの方向の詳細

| 方向 | 流れ | 具体的なデータ | DBテーブル |
|------|------|---------------|----------|
| **(1) 上→下** | 社長→プランナー→ワーカー | サイクル方針、制作指示、投稿指示 | `cycles`, `content`, `task_queue` |
| **(2) 下→上** | ワーカー→アナリスト→社長 | 完了報告、パフォーマンスデータ、分析結果 | `metrics`, `analyses`, `algorithm_performance` |
| **(3) 横** | リサーチャー・アナリスト→社長・プランナー | 市場動向、トレンド、知見、仮説検証結果 | `market_intel`, `learnings`, `hypotheses` |
| **(4) 外→内** | 人間→社長 | 仮説投入、参考コンテンツ指定、設定変更 | `human_directives` |

### 2.3 具体的な情報フローの例

**例: 「朝7時投稿はエンゲージメントが高い」仮説の検証フロー**

```
[Day 1 - 朝]
  リサーチャー: 競合分析で「朝投稿の成功事例」を発見
    → market_intel (INSERT, intel_type='competitor_post')

  アナリスト: 過去データで「朝投稿のengagement_rate +30%」の傾向を検出
    → learnings (INSERT, category='timing')

  社長: アナリスト報告を確認、今サイクルの方針に「朝投稿テスト」を含める
    → cycles (INSERT, status='planning')

  プランナー: 仮説「ペットニッチで朝7時投稿はengagement_rate 0.05」を立案
    → hypotheses (INSERT, verdict='pending', predicted_kpis={...})
    → content (INSERT x 5, status='planned', planned_post_date=Day+2)

[Day 1 - 昼〜]
  制作ワーカー: planned状態の5コンテンツを検出し、動画生成
    → content (UPDATE, status='producing' → 'ready')
    → task_queue (UPDATE, status='completed')

[Day 2 - 朝7時]
  投稿ワーカー: ready状態 + planned_post_date到来のコンテンツを投稿
    → publications (INSERT, posted_at=NOW())
    → content (UPDATE, status='posted')

[Day 4 - 朝7時]
  計測ワーカー: posted_at + 48hを過ぎた投稿のメトリクスを収集
    → metrics (INSERT, views=..., engagement_rate=...)
    → content (UPDATE, status='measured')

[Day 5 - 朝]
  アナリスト: predicted_kpis vs actual_kpis を比較
    → hypotheses (UPDATE, verdict='confirmed', confidence=0.82)
    → analyses (INSERT, analysis_type='hypothesis_verification')
    → learnings (UPDATE, confidence += 0.1)
    → algorithm_performance (INSERT)

  社長: 「朝投稿が有効」と確認。次サイクルで朝投稿の比率を増やす方針を決定
    → cycles (INSERT, 次サイクル)
```

## 3. エージェント通信パターン

### 3.1 上位層 (社長・部長・専門職): LLM対話

判断・推論が必要な連携はLLM同士の対話で行う。

```
┌─────────────────────────────────────────────────────┐
│ LLM対話による連携                                     │
│                                                      │
│  社長 (Opus)                                         │
│    │                                                 │
│    │  「今サイクルの方針: beautyニッチに注力、         │
│    │    朝投稿を全アカウントの50%に適用」              │
│    │                                                 │
│    ├──→ プランナーA (Sonnet)                         │
│    │      「方針を受領。beauty 20アカウントの           │
│    │       コンテンツ計画を策定します」                 │
│    │                                                 │
│    ├──→ プランナーB (Sonnet)                         │
│    │      「方針を受領。tech 30アカウントの            │
│    │       計画を策定します」                          │
│    │                                                 │
│    └──← アナリスト (Sonnet)                          │
│           「前サイクルの分析報告: 仮説的中率62%、       │
│            朝投稿テスト群のengagement +35%」           │
│                                                      │
│  通信媒体: DBのステータス変更 + MCPツール経由のデータ     │
│  頻度: 低い (サイクル単位 = 日次)                      │
│  各エージェント = System Prompt + MCP Tools + Schedule  │
└─────────────────────────────────────────────────────┘
```

**実装方式**:
- 各エージェントはLangGraphのノードとして定義される
- エージェント間の「対話」は実際にはDBを介した間接通信
- 社長がDBに方針を書き込み → プランナーがDBから方針を読み取る
- プランナーが計画をDBに書き込み → 社長がDBから計画を読み取って承認/却下

### 3.2 下位層 (部長→ワーカー): DBタスクキュー

大量・高速・ステートレスな連携はDBのタスクキューで行う。

```
┌─────────────────────────────────────────────────────┐
│ DBタスクキューによる連携                               │
│                                                      │
│  プランナー (LLM)                                    │
│    │                                                 │
│    │  content (INSERT, status='planned')              │
│    │  task_queue (INSERT, type='produce')             │
│    │                                                 │
│    ▼                                                 │
│  ┌───────────────────────────────────────────┐       │
│  │         task_queue テーブル                  │       │
│  │                                            │       │
│  │  id=1  type=produce  status=queued  pri=0  │       │
│  │  id=2  type=produce  status=queued  pri=0  │       │
│  │  id=3  type=produce  status=queued  pri=10 │       │
│  │  id=4  type=publish  status=queued  pri=0  │       │
│  │  id=5  type=measure  status=queued  pri=0  │       │
│  └───────┬───────────────────────┬────────────┘       │
│          │                       │                    │
│    ┌─────▼─────┐          ┌─────▼─────┐              │
│    │ 制作ワーカー │          │ 投稿ワーカー │              │
│    │ (ポーリング) │          │ (ポーリング) │              │
│    │            │          │            │              │
│    │ SELECT ..  │          │ SELECT ..  │              │
│    │ WHERE type │          │ WHERE type │              │
│    │ ='produce' │          │ ='publish' │              │
│    │ AND status │          │ AND status │              │
│    │ ='queued'  │          │ ='queued'  │              │
│    │ ORDER BY   │          │ LIMIT 1    │              │
│    │ pri DESC   │          │ FOR UPDATE │              │
│    │ LIMIT 1    │          │ SKIP LOCKED│              │
│    │ FOR UPDATE │          └────────────┘              │
│    │ SKIP LOCKED│                                     │
│    └────────────┘                                     │
│                                                      │
│  通信媒体: task_queue テーブル (PostgreSQL)             │
│  頻度: 高い (30秒ポーリング)                           │
│  並行制御: SELECT FOR UPDATE SKIP LOCKED               │
└─────────────────────────────────────────────────────┘
```

**並行制御の仕組み**:

```sql
-- ワーカーがタスクを取得する排他ロック付きクエリ
-- SKIP LOCKED により、他ワーカーが処理中のタスクをスキップ
BEGIN;
SELECT id, payload FROM task_queue
WHERE task_type = 'produce'
  AND status = 'queued'
ORDER BY priority DESC, created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- 取得したタスクを processing に更新
UPDATE task_queue
SET status = 'processing',
    assigned_worker = 'production-worker-1',
    started_at = NOW()
WHERE id = $1;
COMMIT;
```

## 4. MCP Server ツール一覧 (~60ツール)

全エージェントはMCP Server経由でPostgreSQLにアクセスする。ツールはエージェントの役割ごとにグループ化されており、各エージェントのSystem Promptで使用可能なツール群を制限する。

### 4.1 戦略エージェント用 (10ツール)

社長が全体状況を把握し、方針を決定するためのツール群。読み取り系が多く、書き込みはサイクル管理とリソース配分に限定される。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_portfolio_kpi_summary` | `{ period: "7d" \| "30d" }` | `{ total_accounts, active_accounts, total_views, avg_engagement_rate, follower_growth, monetized_count }` | 全アカウントのKPIサマリー取得 |
| 2 | `get_cluster_performance` | `{ period: "7d" }` | `[{ cluster, account_count, avg_views, avg_engagement }]` | クラスター別パフォーマンス比較 |
| 3 | `get_top_learnings` | `{ limit: 10, min_confidence: 0.7 }` | `[{ insight, confidence, evidence_count, category }]` | 最新の高信頼知見一覧 |
| 4 | `get_active_hypotheses` | `{ verdict: "pending" }` | `[{ id, statement, category, predicted_kpis, evidence_count }]` | 実行中/検証待ち仮説一覧 |
| 5 | `get_algorithm_performance` | `{ period: "weekly", limit: 12 }` | `[{ measured_at, hypothesis_accuracy, prediction_error, improvement_rate }]` | アルゴリズム精度推移 |
| 6 | `get_pending_directives` | `{}` | `[{ id, directive_type, content, priority, created_at }]` | 人間からの未処理指示 |
| 7 | `create_cycle` | `{ cycle_number }` | `{ id, cycle_number, status }` | 新サイクル開始 |
| 8 | `set_cycle_plan` | `{ cycle_id, summary: {...} }` | `{ success }` | サイクルの方針設定 |
| 9 | `allocate_resources` | `{ cycle_id, allocations: [{ cluster, content_count, budget }] }` | `{ success }` | クラスター間リソース配分 |
| 10 | `send_planner_directive` | `{ cluster, directive_text }` | `{ success }` | プランナーへの個別指示 |

### 4.2 リサーチャー用 (12ツール)

市場情報を収集・保存・検索するためのツール群。WebSearch/WebFetchはLLM内蔵ツール、それ以外はMCPツール。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `save_trending_topic` | `{ topic, volume, growth_rate, platform, niche }` | `{ id }` | トレンドトピック保存 |
| 2 | `save_competitor_post` | `{ post_url, views, format, hook_technique, platform }` | `{ id }` | 競合投稿保存 |
| 3 | `save_competitor_account` | `{ username, followers, posting_frequency, platform }` | `{ id }` | 競合アカウント保存 |
| 4 | `save_audience_signal` | `{ signal_type, topic, sentiment, sample_data }` | `{ id }` | オーディエンスシグナル保存 |
| 5 | `save_platform_update` | `{ platform, update_type, description, effective_date }` | `{ id }` | プラットフォーム更新保存 |
| 6 | `get_recent_intel` | `{ intel_type, platform, limit: 20 }` | `[{ id, data, relevance_score, collected_at }]` | 最近の市場情報取得 |
| 7 | `search_similar_intel` | `{ query_text, limit: 10 }` | `[{ id, data, similarity }]` | 類似情報のベクトル検索 |
| 8 | `get_niche_trends` | `{ niche, period: "7d" }` | `[{ topic, volume, trend_direction }]` | ニッチ別トレンド取得 |
| 9 | `get_competitor_analysis` | `{ platform, niche }` | `[{ username, followers, avg_views, content_strategy }]` | 競合分析データ取得 |
| 10 | `get_platform_changes` | `{ platform, since: "30d" }` | `[{ update_type, description, effective_date }]` | プラットフォーム変更履歴 |
| 11 | `mark_intel_expired` | `{ intel_id }` | `{ success }` | 情報の期限切れマーク |
| 12 | `get_intel_gaps` | `{ niche }` | `[{ intel_type, last_collected, gap_hours }]` | 情報収集の空白領域検出 |

### 4.3 アナリスト用 (14ツール)

パフォーマンス分析・仮説検証・知見管理のためのツール群。読み書き両方が多い。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_metrics_for_analysis` | `{ since: "48h", status: "measured" }` | `[{ publication_id, content_id, views, engagement_rate, ... }]` | 分析対象メトリクス取得 |
| 2 | `get_hypothesis_results` | `{ hypothesis_id }` | `{ predicted_kpis, actual_kpis, content_count, raw_metrics[] }` | 仮説の実測結果 |
| 3 | `verify_hypothesis` | `{ hypothesis_id, verdict, confidence, evidence_summary }` | `{ success }` | 仮説の検証実行 (verdict設定) |
| 4 | `create_analysis` | `{ cycle_id, analysis_type, findings, recommendations }` | `{ id }` | 分析レポート作成 |
| 5 | `extract_learning` | `{ insight, category, confidence, source_analyses[], applicable_niches[] }` | `{ id }` | 知見の抽出・保存 |
| 6 | `update_learning_confidence` | `{ learning_id, new_confidence, additional_evidence }` | `{ success }` | 知見の確信度更新 |
| 7 | `search_similar_learnings` | `{ query_text, limit: 10, min_confidence: 0.5 }` | `[{ id, insight, confidence, similarity }]` | 類似知見のベクトル検索 |
| 8 | `detect_anomalies` | `{ period: "7d", threshold: 2.0 }` | `[{ account_id, metric, expected, actual, deviation }]` | 異常値検知 (標準偏差ベース) |
| 9 | `get_component_scores` | `{ type: "scenario", subtype: "hook", limit: 20 }` | `[{ component_id, name, score, usage_count }]` | コンポーネント別スコア取得 |
| 10 | `update_component_score` | `{ component_id, new_score }` | `{ success }` | スコア更新 |
| 11 | `calculate_algorithm_performance` | `{ period: "weekly" }` | `{ hypothesis_accuracy, prediction_error, learning_count, improvement_rate }` | アルゴリズム精度計算 |
| 12 | `get_niche_performance_trends` | `{ niche, period: "30d" }` | `[{ date, avg_views, avg_engagement, content_count }]` | ニッチ別パフォーマンス推移 |
| 13 | `compare_hypothesis_predictions` | `{ hypothesis_ids: [] }` | `[{ hypothesis_id, predicted, actual, error_rate }]` | 予測vs実測の比較 |
| 14 | `generate_improvement_suggestions` | `{ niche, account_id? }` | `[{ suggestion, rationale, expected_impact, priority }]` | 改善提案の生成 |

### 4.4 プランナー用 (9ツール)

コンテンツ計画の策定に必要なツール群。担当アカウントの情報取得と、コンテンツ計画の作成・スケジューリングに特化。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_assigned_accounts` | `{ cluster }` | `[{ account_id, platform, niche, follower_count, status }]` | 担当アカウント一覧 |
| 2 | `get_account_performance` | `{ account_id, period: "7d" }` | `{ avg_views, avg_engagement, top_content, trend }` | アカウント別パフォーマンス |
| 3 | `get_available_components` | `{ type: "scenario", niche, subtype }` | `[{ component_id, name, score, usage_count, data }]` | 利用可能コンポーネント |
| 4 | `create_hypothesis` | `{ category, statement, rationale, target_accounts[], predicted_kpis }` | `{ id }` | 仮説の作成 |
| 5 | `plan_content` | `{ account_id, hypothesis_id, hook/body/cta_component_id, character_id, script_language }` | `{ content_id }` | コンテンツ計画の作成 |
| 6 | `schedule_content` | `{ content_id, planned_post_date }` | `{ success }` | 投稿スケジュール設定 |
| 7 | `get_niche_learnings` | `{ niche, min_confidence: 0.5, limit: 10 }` | `[{ insight, confidence, category }]` | ニッチ関連の知見取得 |
| 8 | `get_content_pool_status` | `{ cluster }` | `{ planned, producing, ready, scheduled, posted }` | コンテンツプールの状況 |
| 9 | `request_production` | `{ content_id, priority: 0 }` | `{ task_id }` | 制作タスクの発行 (task_queueにINSERT) |

### 4.5 制作ワーカー用 (12ツール)

動画制作パイプラインの各段階で使用するツール群。v4.0パイプラインのNode.js関数をMCPツールとしてラップ。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_production_task` | `{}` | `{ task_id, content_id, payload }` or `null` | 制作タスクの取得 (キューから1件) |
| 2 | `generate_script` | `{ content_id, scenario_data, script_language }` | `{ hook_script, body_script, cta_script }` | スクリプト生成 |
| 3 | `get_character_info` | `{ character_id }` | `{ name, voice_id, image_drive_id, appearance }` | キャラクター情報取得 |
| 4 | `get_component_data` | `{ component_id }` | `{ type, subtype, data, drive_file_id }` | コンポーネントデータ取得 |
| 5 | `start_video_generation` | `{ image_url, motion_data, section }` | `{ request_id }` | Kling動画生成開始 |
| 6 | `check_video_status` | `{ request_id }` | `{ status, video_url? }` | 動画生成状況確認 |
| 7 | `start_tts` | `{ text, voice_id, language }` | `{ audio_url }` | Fish Audio TTS開始 |
| 8 | `start_lipsync` | `{ video_url, audio_url }` | `{ request_id }` | fal.ai Lipsync開始 |
| 9 | `upload_to_drive` | `{ file_url, folder_id, filename }` | `{ drive_file_id, drive_url }` | Google Driveアップロード |
| 10 | `update_content_status` | `{ content_id, status, metadata? }` | `{ success }` | コンテンツステータス更新 |
| 11 | `run_quality_check` | `{ content_id, video_url }` | `{ passed, checks: [...] }` | 品質チェック実行 |
| 12 | `report_production_complete` | `{ task_id, content_id, drive_folder_id, video_drive_id }` | `{ success }` | 制作完了報告 |

### 4.6 投稿ワーカー用 (6ツール)

プラットフォーム別の投稿実行ツール群。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_publish_task` | `{}` | `{ task_id, content_id, platform, payload }` or `null` | 投稿タスクの取得 |
| 2 | `publish_to_youtube` | `{ content_id, title, description, tags, video_drive_id }` | `{ platform_post_id, post_url }` | YouTube投稿 |
| 3 | `publish_to_tiktok` | `{ content_id, description, tags, video_drive_id }` | `{ platform_post_id, post_url }` | TikTok投稿 |
| 4 | `publish_to_instagram` | `{ content_id, caption, tags, video_drive_id }` | `{ platform_post_id, post_url }` | Instagram投稿 |
| 5 | `publish_to_x` | `{ content_id, text, video_drive_id }` | `{ platform_post_id, post_url }` | X/Twitter投稿 |
| 6 | `report_publish_result` | `{ task_id, content_id, platform_post_id, post_url, posted_at }` | `{ success }` | 投稿結果報告 |

### 4.7 計測ワーカー用 (7ツール)

プラットフォーム別のメトリクス収集ツール群。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_measurement_tasks` | `{ limit: 10 }` | `[{ task_id, publication_id, platform, platform_post_id }]` | 計測対象取得 |
| 2 | `collect_youtube_metrics` | `{ platform_post_id }` | `{ views, likes, comments, shares, watch_time, completion_rate }` | YouTube計測 |
| 3 | `collect_tiktok_metrics` | `{ platform_post_id }` | `{ views, likes, comments, shares, saves, completion_rate }` | TikTok計測 |
| 4 | `collect_instagram_metrics` | `{ platform_post_id }` | `{ views, likes, comments, saves, reach, impressions }` | Instagram計測 |
| 5 | `collect_x_metrics` | `{ platform_post_id }` | `{ impressions, likes, retweets, replies, quotes }` | X計測 |
| 6 | `collect_account_metrics` | `{ account_id }` | `{ follower_count, follower_delta }` | アカウント全体メトリクス |
| 7 | `report_measurement_complete` | `{ task_id, publication_id, metrics_data }` | `{ success }` | 計測完了報告 |

### 4.8 ダッシュボード用 (3ツール)

人間がダッシュボードから操作する際に使用するツール群。ダッシュボードはLLMではないため、これらはREST API (Next.js API Routes) として実装し、内部でMCPツールと同等のロジックを呼び出す。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_dashboard_summary` | `{}` | `{ kpi, algorithm_accuracy, active_cycles, pending_tasks }` | ダッシュボード用サマリー |
| 2 | `update_system_config` | `{ key, value }` | `{ success }` | 設定変更 (計測タイミング等) |
| 3 | `submit_human_directive` | `{ directive_type, content, target_accounts?, priority }` | `{ id }` | 人間介入の送信 |

## 5. LangGraphグラフ設計詳細

v5.0は **4つの独立したLangGraphグラフ** で構成される。各グラフは独立したプロセスとして実行され、PostgreSQLを通じてのみ連携する。

### 5.1 グラフ1: 戦略サイクルグラフ (Strategy Cycle Graph)

**実行頻度**: 日次 (毎朝1回、cronトリガー)
**参加エージェント**: 社長 (Opus) + リサーチャー (Sonnet) + アナリスト (Sonnet) + プランナー (Sonnet x N)
**目的**: 市場データの確認→仮説生成→コンテンツ計画→承認のサイクルを1日1回回す

#### ノード定義

```
┌──────────────────┐
│     START         │
│ (cronトリガー)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ collect_intel     │     get_recent_intel
│                  │     get_niche_trends
│ リサーチャー       │     get_platform_changes
│ (Sonnet)         │     get_competitor_analysis
│                  │     search_similar_intel
│ 最新の市場データ   │
│ を収集・整理      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ analyze_cycle     │     get_metrics_for_analysis
│                  │     get_hypothesis_results
│ アナリスト        │     verify_hypothesis
│ (Sonnet)         │     detect_anomalies
│                  │     extract_learning
│ 前サイクルの分析   │     calculate_algorithm_performance
│ 仮説検証・知見抽出 │     create_analysis
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ set_strategy      │     get_portfolio_kpi_summary
│                  │     get_top_learnings
│ 社長 (Opus)      │     get_pending_directives
│                  │     create_cycle
│ サイクル方針決定   │     set_cycle_plan
│ リソース配分      │     allocate_resources
│ 人間指示の処理    │     send_planner_directive
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ plan_content      │     get_assigned_accounts
│                  │     get_account_performance
│ プランナー x N    │     get_available_components
│ (Sonnet)         │     create_hypothesis
│                  │     plan_content
│ 仮説立案          │     schedule_content
│ コンテンツ計画    │     get_niche_learnings
│ スケジュール設定   │     get_content_pool_status
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ approve_plan      │     get_portfolio_kpi_summary (再確認)
│                  │     get_active_hypotheses
│ 社長 (Opus)      │     get_content_pool_status
│                  │
│ 計画の承認/差戻し  │
│ コスト上限確認    │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
  承認      差戻し
    │         │
    ▼         ▼
┌────────┐  plan_content
│  END   │  ノードに戻る
│        │  (ループ)
└────────┘
```

#### ステート構造 (TypeScript型定義)

```typescript
interface StrategyCycleState {
  // サイクル情報
  cycle_id: number;
  cycle_number: number;
  started_at: string; // ISO 8601

  // 市場データ (collect_intelノード出力)
  market_intel: {
    trending_topics: TrendingTopic[];
    competitor_insights: CompetitorInsight[];
    platform_updates: PlatformUpdate[];
    audience_signals: AudienceSignal[];
  };

  // 分析結果 (analyze_cycleノード出力)
  analysis: {
    previous_cycle_review: CycleReview | null;
    hypothesis_verifications: HypothesisVerification[];
    anomalies: Anomaly[];
    new_learnings: Learning[];
    algorithm_accuracy: number; // 0.00〜1.00
  };

  // 戦略方針 (set_strategyノード出力)
  strategy: {
    focus_niches: string[];
    resource_allocation: ResourceAllocation[];
    human_directives_processed: number[];
    key_decisions: string[];
  };

  // コンテンツ計画 (plan_contentノード出力)
  content_plans: ContentPlan[];

  // 承認結果 (approve_planノード出力)
  approval: {
    status: 'approved' | 'rejected';
    feedback?: string;
    revision_count: number; // 差戻し回数 (最大3回)
  };

  // エラー情報
  errors: AgentError[];
}

interface ContentPlan {
  content_id: string;
  account_id: string;
  hypothesis_id: number;
  hook_component_id: string;
  body_component_id: string;
  cta_component_id: string;
  character_id: string;
  script_language: 'en' | 'jp';
  planned_post_date: string; // YYYY-MM-DD
}

interface ResourceAllocation {
  cluster: string;
  content_count: number;
  budget_usd: number;
}
```

#### エッジ定義

```typescript
const strategyCycleGraph = new StateGraph<StrategyCycleState>()
  .addNode("collect_intel", collectIntelNode)
  .addNode("analyze_cycle", analyzeCycleNode)
  .addNode("set_strategy", setStrategyNode)
  .addNode("plan_content", planContentNode)
  .addNode("approve_plan", approvePlanNode)

  // エッジ定義
  .addEdge(START, "collect_intel")
  .addEdge("collect_intel", "analyze_cycle")
  .addEdge("analyze_cycle", "set_strategy")
  .addEdge("set_strategy", "plan_content")
  .addEdge("plan_content", "approve_plan")

  // 条件分岐: 承認 or 差戻し
  .addConditionalEdges("approve_plan", (state) => {
    if (state.approval.status === 'approved') {
      return END;
    }
    if (state.approval.revision_count >= 3) {
      // 3回差戻しでも解決しない場合は強制承認
      return END;
    }
    return "plan_content"; // 差戻し → 再計画
  });
```

#### チェックポイント戦略

```typescript
// PostgreSQLベースのチェックポインター
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = new PostgresSaver({
  connectionString: process.env.DATABASE_URL,
});

// 各ノード完了時に自動チェックポイント
// → プロセスが落ちても最後に完了したノードから再開可能
const app = strategyCycleGraph.compile({ checkpointer });
```

#### エラーハンドリング

| エラー種別 | 発生ノード | 対処 |
|-----------|----------|------|
| LLM API タイムアウト | 全ノード | 3回リトライ (exponential backoff) |
| MCP ツール失敗 | 全ノード | エラーログ記録 + 該当処理スキップ |
| 市場データ取得失敗 | collect_intel | 前回データで続行 (stale data警告付き) |
| 仮説生成失敗 | plan_content | 既存仮説の再利用で代替 |
| 承認ループ (3回超) | approve_plan | 強制承認 + 人間通知 |

### 5.2 グラフ2: 制作パイプライングラフ (Production Pipeline Graph)

**実行頻度**: 連続 (30秒ポーリング)
**参加エージェント**: 制作ワーカー (コード、LLMなし)
**目的**: `planned` ステータスのコンテンツを検出し、v4.0パイプラインで動画を生成する

#### ノード定義

```
┌──────────────────┐
│     START         │
│ (PM2常駐プロセス)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ poll_tasks        │     get_production_task
│                  │
│ タスクキューから   │     タスクなし → 30秒sleep → 自身に戻る
│ 制作タスクを取得   │     タスクあり → fetch_dataへ
└────────┬─────────┘
    ┌────┴────┐
  あり      なし
    │         │
    │    ┌────▼────┐
    │    │ sleep   │──→ poll_tasks
    │    │ (30sec) │
    │    └─────────┘
    ▼
┌──────────────────┐     MCPツール:
│ fetch_data        │     get_character_info
│                  │     get_component_data (x3)
│ キャラクター情報   │     update_content_status
│ コンポーネントデータ│       → status='producing'
│ を取得            │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│ generate_video                                        │
│                                                      │
│ v4.0パイプライン (orchestrator.js) を直接呼び出し       │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ Promise.all (3セクション並列)                  │    │
│  │                                              │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐│    │
│  │  │   Hook     │ │   Body     │ │   CTA      ││    │
│  │  │            │ │            │ │            ││    │
│  │  │ Kling ─┐   │ │ Kling ─┐   │ │ Kling ─┐   ││    │
│  │  │ TTS ───┤   │ │ TTS ───┤   │ │ TTS ───┤   ││    │
│  │  │        ▼   │ │        ▼   │ │        ▼   ││    │
│  │  │ Lipsync    │ │ Lipsync    │ │ Lipsync    ││    │
│  │  └────────────┘ └────────────┘ └────────────┘│    │
│  └──────────────────────────────────────────────┘    │
│                       │                              │
│                       ▼                              │
│              ffmpeg concat + blackdetect              │
│                       │                              │
│                       ▼                              │
│              Google Drive保存                         │
└────────────────────────┬─────────────────────────────┘
                         │
                    ┌────┴────┐
                  成功      失敗
                    │         │
                    ▼         ▼
┌──────────────────┐  ┌──────────────────┐
│ quality_check     │  │ handle_error      │
│                  │  │                  │
│ ファイルサイズ検証 │  │ error_message記録 │
│ 黒フレーム検出    │  │ retry_count確認  │
│ Drive保存確認    │  │                  │
│                  │  │ リトライ可能 →    │
│ 合格: ready      │  │   task再キュー    │
│ 不合格: failed   │  │ 不可 → failed    │
└────────┬─────────┘  └────────┬─────────┘
         │                     │
         └──────┬──────────────┘
                │
                ▼
         poll_tasks に戻る
```

#### ステート構造

```typescript
interface ProductionPipelineState {
  // 現在処理中のタスク
  current_task: {
    task_id: number;
    content_id: string;
    account_id: string;
    character_id: string;
    script_language: 'en' | 'jp';
    components: {
      hook: ComponentData;
      body: ComponentData;
      cta: ComponentData;
    };
  } | null;

  // キャラクター情報
  character: {
    name: string;
    voice_id: string;        // Fish Audio 32-char hex
    image_drive_id: string;  // Google Drive file ID
    image_fal_url?: string;  // fal.storageにアップロード後のURL
  } | null;

  // 制作進捗
  production: {
    status: 'idle' | 'fetching' | 'generating' | 'quality_check' | 'error';
    sections: {
      hook: SectionResult | null;
      body: SectionResult | null;
      cta: SectionResult | null;
    };
    final_video_url?: string;
    drive_folder_id?: string;
    video_drive_id?: string;
    processing_time_seconds?: number;
  };

  // エラー情報
  errors: ProductionError[];
}

interface SectionResult {
  kling_request_id: string;
  video_url: string;
  tts_audio_url: string;
  lipsync_video_url: string;
  processing_seconds: number;
}
```

#### チェックポイント戦略

制作パイプラインは **動画生成に12分以上** かかるため、チェックポイントが重要。

```
チェックポイント配置:
  [1] fetch_data完了後 — キャラ情報・コンポーネント取得済み
  [2] 各セクション完了後 — Kling/TTS/Lipsync結果を個別保存
  [3] ffmpeg concat完了後 — 最終動画URL
  [4] Drive保存完了後 — Drive file ID

リカバリー:
  プロセス再起動時、最後のチェックポイントから再開
  例: Body完了後にプロセスが落ちた場合
      → Hook, Body の結果はチェックポイントに保存済み
      → CTAのみ再生成してconcat
```

### 5.3 グラフ3: 投稿スケジューラーグラフ (Publishing Scheduler Graph)

**実行頻度**: 連続 (30秒ポーリング)
**参加エージェント**: 投稿ワーカー (コード)
**目的**: `ready` ステータスのコンテンツを適切なタイミングで投稿する

#### ノード定義

```
┌──────────────────┐
│     START         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ check_schedule    │     get_publish_task
│                  │
│ 投稿対象の検出    │     条件:
│ ・status='ready' │       planned_post_date <= TODAY
│ ・投稿時間到来   │       最適投稿時間帯に該当
│ ・レート制限確認  │       プラットフォーム投稿制限内
└────────┬─────────┘
    ┌────┴────┐
  あり      なし
    │         │
    ▼         ▼
┌────────────┐  ┌────────┐
│ publish     │  │ sleep  │──→ check_schedule
│             │  │(30sec) │
│ プラット    │  └────────┘
│ フォーム別  │
│ 投稿実行   │     MCPツール:
│             │     publish_to_youtube
│             │     publish_to_tiktok
│             │     publish_to_instagram
│             │     publish_to_x
└──────┬─────┘
       │
  ┌────┴────┐
成功      失敗
  │         │
  ▼         ▼
┌────────────┐  ┌────────────────┐
│ record      │  │ handle_error    │
│             │  │                │
│ posted_at   │  │ retry or fail  │
│ post_url    │  │                │
│ measure_    │  │                │
│ after設定   │  │                │
│             │  │                │
│ MCPツール:  │  │                │
│ report_     │  │                │
│ publish_    │  │                │
│ result      │  │                │
└──────┬─────┘  └──────┬─────────┘
       │               │
       └───────┬───────┘
               ▼
        check_schedule に戻る
```

#### ステート構造

```typescript
interface PublishingSchedulerState {
  // 現在処理中のタスク
  current_task: {
    task_id: number;
    content_id: string;
    account_id: string;
    platform: 'youtube' | 'tiktok' | 'instagram' | 'x';
    video_drive_id: string;
    metadata: PublishMetadata;
  } | null;

  // 投稿結果
  publish_result: {
    status: 'success' | 'failed';
    platform_post_id?: string;
    post_url?: string;
    posted_at?: string;
    measure_after?: string; // posted_at + 48h
    error?: string;
  } | null;

  // レート制限トラッキング
  rate_limits: {
    [platform: string]: {
      remaining: number;
      reset_at: string;
    };
  };
}

interface PublishMetadata {
  title?: string;          // YouTube
  description?: string;    // YouTube, TikTok
  caption?: string;        // Instagram
  text?: string;           // X
  tags?: string[];
  thumbnail_drive_id?: string;
}
```

### 5.4 グラフ4: 計測ジョブグラフ (Measurement Jobs Graph)

**実行頻度**: 連続 (5分ポーリング)
**参加エージェント**: 計測ワーカー (コード)
**目的**: 投稿後48h経過したコンテンツのパフォーマンスを計測する

#### ノード定義

```
┌──────────────────┐
│     START         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ detect_targets    │     get_measurement_tasks
│                  │
│ 計測対象の検出    │     条件:
│ ・status='posted'│       NOW() > measure_after
│ ・48h経過       │       まだ計測されていない
└────────┬─────────┘
    ┌────┴────┐
  あり      なし
    │         │
    ▼         ▼
┌────────────┐  ┌─────────┐
│ collect     │  │ sleep   │──→ detect_targets
│             │  │ (5min)  │
│ プラット    │  └─────────┘
│ フォームAPI │
│ からメトリ  │     MCPツール:
│ クス取得   │     collect_youtube_metrics
│             │     collect_tiktok_metrics
│             │     collect_instagram_metrics
│             │     collect_x_metrics
│             │     collect_account_metrics
└──────┬─────┘
       │
       ▼
┌──────────────────┐     MCPツール:
│ save_metrics      │     report_measurement_complete
│                  │
│ metricsテーブル   │     更新内容:
│ に保存           │       metrics INSERT
│                  │       content.status → 'measured'
│ engagement_rate  │       publications.status確認
│ を計算して保存    │
│                  │
│ 次回計測の判定:   │
│ 追加計測が必要か  │
│ (7日後, 30日後)  │
└──────┬───────────┘
       │
       ▼
  detect_targets に戻る
```

#### ステート構造

```typescript
interface MeasurementJobState {
  // 計測対象リスト
  targets: MeasurementTarget[];

  // 現在処理中
  current_target: MeasurementTarget | null;

  // 収集結果
  collected_metrics: CollectedMetrics | null;

  // 処理済みカウント (バッチ内)
  processed_count: number;
  error_count: number;
}

interface MeasurementTarget {
  task_id: number;
  publication_id: number;
  content_id: string;
  account_id: string;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'x';
  platform_post_id: string;
  posted_at: string;
  measurement_type: '48h' | '7d' | '30d';
}

interface CollectedMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  watch_time_seconds?: number;
  completion_rate?: number;
  engagement_rate: number; // 計算値
  follower_delta: number;
  impressions?: number;
  reach?: number;
  raw_data: Record<string, unknown>;
}
```

### 5.5 グラフ間の連携サマリー

4つのグラフは直接通信しない。全てPostgreSQLの `content.status` と `task_queue` テーブルを介した間接連携。

```
                    戦略サイクル
                    グラフ (日次)
                        │
                        │ content INSERT (status='planned')
                        │ task_queue INSERT (type='produce')
                        ▼
            ┌───────────────────────┐
            │    PostgreSQL          │
            │                       │
            │  content.status:      │
            │  planned → producing  │──→ 制作パイプライン
            │  → ready              │    グラフ (連続)
            │  → scheduled          │
            │  → posted ────────────│──→ 投稿スケジューラー
            │  → measured           │    グラフ (連続)
            │  → analyzed           │
            │                       │──→ 計測ジョブ
            │  task_queue:          │    グラフ (連続)
            │  produce / publish    │
            │  / measure            │
            └───────────────────────┘
                        │
                        │ metrics, analyses, learnings
                        │ → 次の戦略サイクルで読み取り
                        ▼
                    戦略サイクル
                    グラフ (次の日次)
```

## 6. データがアルゴリズムに寄与する仕組み

v5.0の核心は「AIが自分自身の精度を向上させる仕組み」にある。データの蓄積がアルゴリズムの改善にどう繋がるかを詳細に説明する。

### 6.1 仮説精度の向上

**メカニズム**: 過去の仮説結果 + 蓄積知見 → より精度の高い次の仮説

```
サイクル1:                    サイクル10:                  サイクル50:
  仮説的中率: 30%              仮説的中率: 45%              仮説的中率: 65%
  データポイント: 0            データポイント: 200           データポイント: 2,000
  蓄積知見: 0件                蓄積知見: 30件               蓄積知見: 150件

  ┌────────────────┐         ┌────────────────┐          ┌────────────────┐
  │ 仮説生成        │         │ 仮説生成        │          │ 仮説生成        │
  │                │         │                │          │                │
  │ 入力:          │         │ 入力:          │          │ 入力:          │
  │ ・トレンドのみ  │         │ ・トレンド     │          │ ・トレンド     │
  │ ・経験なし     │         │ ・30件の知見   │          │ ・150件の知見  │
  │               │         │ ・類似仮説の    │          │ ・類似仮説の    │
  │               │         │   過去結果     │          │   過去結果     │
  │               │         │ ・異常値パター │          │ ・季節性パター │
  │               │         │   ンの蓄積    │          │   ンの蓄積    │
  │               │         │               │          │ ・ニッチ間の   │
  │               │         │               │          │   相関関係    │
  └────────────────┘         └────────────────┘          └────────────────┘
```

**具体的なフロー**:

1. プランナーが `create_hypothesis` を呼ぶ
2. MCP Server内部で `search_similar_learnings` を自動実行 → 関連知見を添付
3. MCP Server内部で `search_similar_hypotheses` を自動実行 → 過去の類似仮説の結果を添付
4. プランナーは過去の結果を考慮してより精度の高い `predicted_kpis` を設定
5. 的中率がサイクルごとに改善 → `algorithm_performance.hypothesis_accuracy` が上昇

### 6.2 分析精度の向上

**メカニズム**: データポイントの増加 → 統計的有意性の向上 → より正確な分析

```
            データポイント数
            │
    2,000   │                                    ╱──── 高信頼分析
            │                                 ╱       (p < 0.01)
    1,500   │                              ╱
            │                           ╱
    1,000   │                        ╱
            │                     ╱
      500   │                  ╱────────────── 中信頼分析
            │               ╱                  (p < 0.05)
      200   │            ╱
            │         ╱
      50    │      ╱──────────────────────── 低信頼分析
            │   ╱                             (p < 0.1)
      10    │╱
            └──────────────────────────────────→ サイクル数
              1    5   10   20   30   50
```

**分析精度が向上する具体例**:

| サイクル | データ数 | 分析の質 | 例 |
|---------|---------|---------|-----|
| 1〜5 | 10〜50 | 傾向の検出のみ (低信頼) | 「朝投稿のengagementが高い傾向がある」 |
| 10〜20 | 200〜500 | 統計的有意な差の検出 | 「朝7時投稿は夜投稿より35% +-8% 高い (p=0.03)」 |
| 30〜50 | 1,000〜2,000 | 多変量分析・交互作用の検出 | 「朝7時 x ペットニッチ x リアクション形式の組合せが最適」 |

### 6.3 改善スピードの向上

**メカニズム**: 知見のembedding検索で類似事例を即座に発見 → 試行錯誤の短縮

```
従来 (知見蓄積なし):
  新ニッチ参入 → 手探りで仮説生成 → 10サイクルで最適化
  所要時間: 10日 x 1サイクル/日 = 10日

v5.0 (知見蓄積あり):
  新ニッチ参入
    → search_similar_learnings("fitness niche best practices")
    → 類似ニッチ (beauty) の知見50件がヒット
      ・「朝投稿が効果的」(confidence: 0.85)
      ・「リアクション形式のHookが完視聴率1.8倍」(confidence: 0.82)
      ・「3秒ルール: 最初の3秒にインパクト必要」(confidence: 0.90)
    → 知見を初期仮説に適用
    → 3サイクルで最適化
  所要時間: 3日
```

**pgvectorによる類似検索の仕組み**:

```sql
-- 新しいニッチ "fitness" に参入する際、関連知見を検索
-- $1 = "fitness niche content strategy" のembedding
SELECT insight, confidence, applicable_niches,
       1 - (embedding <=> $1) AS similarity
FROM learnings
WHERE confidence >= 0.5
  AND (applicable_niches IS NULL
       OR applicable_niches && ARRAY['fitness', 'health', 'wellness'])
ORDER BY embedding <=> $1
LIMIT 20;
```

### 6.4 algorithm_performanceテーブルによるメタ計測

**メカニズム**: AI自身の精度をトラッキングし、「学習しているか」を客観的に評価する

```
algorithm_performance テーブル:

  measured_at     | period  | hypothesis_accuracy | prediction_error | learning_count | improvement_rate
  ────────────────┼─────────┼─────────────────────┼──────────────────┼────────────────┼─────────────────
  2026-03-01      | weekly  | 0.3200              | 0.4500           | 12             | NULL
  2026-03-08      | weekly  | 0.3500              | 0.4200           | 25             | +0.0937
  2026-03-15      | weekly  | 0.4100              | 0.3800           | 42             | +0.1714
  2026-03-22      | weekly  | 0.4300              | 0.3600           | 58             | +0.0487
  2026-03-29      | weekly  | 0.4800              | 0.3200           | 71             | +0.1163
  ...
  2026-08-01      | weekly  | 0.6500              | 0.1800           | 280            | +0.0154

  改善トレンド:
    hypothesis_accuracy: 0.32 → 0.65 (5ヶ月で2倍)
    prediction_error:    0.45 → 0.18 (5ヶ月で60%減)
    learning_count:      12 → 280 (23倍)
```

**ダッシュボードでの表示**:

```
┌─────────────────────────────────────────────────────────┐
│  アルゴリズム精度ダッシュボード                             │
│                                                          │
│  仮説的中率 (hypothesis_accuracy)                         │
│  0.70 ┤                                           ╱     │
│  0.60 ┤                                      ╱──╱      │
│  0.50 ┤                                ╱──╱             │
│  0.40 ┤                          ╱──╱                   │
│  0.30 ┤                    ╱──╱                         │
│  0.20 ┤──────────────╱──╱                               │
│  0.10 ┤                                                  │
│       └──────┬──────┬──────┬──────┬──────┬──────┬──────  │
│              Mar    Apr    May    Jun    Jul    Aug       │
│                                                          │
│  予測誤差 (prediction_error) — 低いほど良い               │
│  0.50 ┤╲                                                 │
│  0.40 ┤  ╲──╲                                            │
│  0.30 ┤       ╲──╲                                       │
│  0.20 ┤            ╲──╲──╲                               │
│  0.10 ┤                    ╲──╲──╲──╲──╲                 │
│       └──────┬──────┬──────┬──────┬──────┬──────┬──────  │
│              Mar    Apr    May    Jun    Jul    Aug       │
└─────────────────────────────────────────────────────────┘
```

## 7. 仮説駆動サイクルの詳細フロー

v5.0の全動作を支配する「仮説駆動サイクル」の各ステップを、使用するMCPツールとデータフロー込みで詳細に記述する。

### 7.1 全体フロー図

```
┌───────────────────────────────────────────────────────────────────────┐
│                      仮説駆動サイクル (1日1回)                          │
│                                                                       │
│  [Step 1] ──→ [Step 2] ──→ [Step 3] ──→ [Step 4] ──→ [Step 5]      │
│  戦略Agent     戦略Agent     プランナー     プランナー     制作ワーカー   │
│  データ確認    方針決定      仮説立案      コンテンツ計画  コンテンツ生成 │
│                                                              │        │
│  [Step 11] ←── [Step 10] ←── [Step 9] ←── [Step 8] ←── [Step 7] ←── [Step 6]
│  次サイクルへ   知見抽出      検証実行      アナリスト      計測ワーカー   投稿ワーカー
│                                            分析開始       メトリクス収集 投稿実行
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Step 1: 戦略Agent — データ確認

**実行者**: 社長 (Claude Opus 4.6)
**タイミング**: サイクル開始時 (毎朝)

```
MCPツール呼び出し:
  1. get_portfolio_kpi_summary({ period: "7d" })
     → 全アカウントのKPIサマリーを取得

  2. get_top_learnings({ limit: 10, min_confidence: 0.7 })
     → 高信頼知見を確認

  3. get_active_hypotheses({ verdict: "pending" })
     → 検証中の仮説を確認

  4. get_algorithm_performance({ period: "weekly", limit: 4 })
     → 直近4週のアルゴリズム精度推移を確認

  5. get_pending_directives()
     → 人間からの未処理指示を確認

データフロー:
  [読み取り] algorithm_performance → 精度推移
  [読み取り] learnings → 高信頼知見
  [読み取り] hypotheses → 検証待ち仮説
  [読み取り] human_directives → 人間の指示
  [読み取り] metrics (集計) → KPIサマリー
```

### Step 2: 戦略Agent — 方針決定

**実行者**: 社長 (Claude Opus 4.6)
**タイミング**: Step 1の直後

```
MCPツール呼び出し:
  1. create_cycle({ cycle_number: N })
     → cycles INSERT (status='planning')

  2. set_cycle_plan({ cycle_id, summary: {
       focus_niches: ["beauty", "pet"],
       morning_post_ratio: 0.5,
       key_decisions: ["朝投稿テスト拡大", "techニッチ縮小"],
       budget_limit_usd: 100
     }})
     → cycles UPDATE (summary設定)

  3. allocate_resources({ cycle_id, allocations: [
       { cluster: "beauty", content_count: 20, budget: 50 },
       { cluster: "pet", content_count: 15, budget: 35 },
       { cluster: "tech", content_count: 5, budget: 15 }
     ]})
     → リソース配分記録

  4. send_planner_directive({
       cluster: "beauty",
       directive_text: "朝7時投稿の比率を50%に。リアクション形式のHookを優先"
     })

データフロー:
  [書き込み] cycles INSERT → 新サイクル作成
  [書き込み] cycles UPDATE → 方針設定
```

### Step 3: プランナー — 仮説立案

**実行者**: プランナー (Claude Sonnet 4.5) x N体
**タイミング**: 方針受領後

```
MCPツール呼び出し:
  1. get_assigned_accounts({ cluster: "beauty" })
     → 担当アカウント20件を取得

  2. get_niche_learnings({ niche: "beauty", min_confidence: 0.5, limit: 10 })
     → beautyニッチの知見を取得

  3. get_account_performance({ account_id: "ACC_0013", period: "7d" })
     → 各アカウントの直近パフォーマンスを確認 (x 20)

  4. create_hypothesis({
       category: "timing",
       statement: "beautyニッチで朝7時投稿はengagement_rate 0.05を達成する",
       rationale: "過去の知見 + 競合分析からの根拠...",
       target_accounts: ["ACC_0013", "ACC_0015", "ACC_0018"],
       predicted_kpis: { views: 5000, engagement_rate: 0.05, completion_rate: 0.7 }
     })
     → hypotheses INSERT (verdict='pending')

データフロー:
  [読み取り] accounts → 担当アカウント
  [読み取り] learnings → ニッチ関連知見
  [読み取り] metrics (集計) → パフォーマンス
  [書き込み] hypotheses INSERT → 新仮説 (predicted_kpis設定)
```

### Step 4: プランナー — コンテンツ計画

**実行者**: プランナー (Claude Sonnet 4.5) x N体
**タイミング**: Step 3の直後

```
MCPツール呼び出し:
  1. get_available_components({ type: "scenario", niche: "beauty", subtype: "hook" })
     → Hookシナリオ候補を取得 (scoreの高い順)

  2. plan_content({
       account_id: "ACC_0013",
       hypothesis_id: 42,
       hook_component_id: "SCN_0101",
       body_component_id: "SCN_0102",
       cta_component_id: "SCN_0103",
       character_id: "CHR_0001",
       script_language: "jp"
     })
     → content INSERT (status='planned', hypothesis_id=42)

  3. schedule_content({
       content_id: "CNT_202603_0001",
       planned_post_date: "2026-03-05"
     })
     → content UPDATE (planned_post_date設定)

  4. request_production({ content_id: "CNT_202603_0001", priority: 0 })
     → task_queue INSERT (type='produce', status='queued')

データフロー:
  [読み取り] components → 利用可能コンポーネント
  [書き込み] content INSERT → コンテンツ計画 (hypothesis_id紐付け)
  [書き込み] task_queue INSERT → 制作タスク発行
```

### Step 5: 制作ワーカー — コンテンツ生成

**実行者**: 制作ワーカー (Node.jsコード、LLMなし)
**タイミング**: タスクキューに制作タスクが入った時点 (30秒ポーリング)

```
MCPツール呼び出し:
  1. get_production_task()
     → task_queue SELECT (type='produce', status='queued' → 'processing')

  2. get_character_info({ character_id: "CHR_0001" })
     → characters SELECT

  3. get_component_data({ component_id: "SCN_0101" })  (x3: hook/body/cta)
     → components SELECT

  4. update_content_status({ content_id: "CNT_202603_0001", status: "producing" })
     → content UPDATE

  --- v4.0パイプライン実行 (orchestrator.js) ---
  --- 12分程度 ---

  5. upload_to_drive({ file_url, folder_id, filename: "final.mp4" })
     → Google Drive API

  6. run_quality_check({ content_id: "CNT_202603_0001", video_url: "..." })
     → ファイルサイズ・黒フレーム検証

  7. report_production_complete({
       task_id: 1,
       content_id: "CNT_202603_0001",
       drive_folder_id: "1abc...",
       video_drive_id: "2def..."
     })
     → content UPDATE (status='ready', drive_folder_id, video_drive_id)
     → task_queue UPDATE (status='completed')

データフロー:
  [読み取り] task_queue → 制作タスク取得
  [読み取り] characters → キャラクター情報
  [読み取り] components → シナリオ・モーション
  [書き込み] content UPDATE → status: planned → producing → ready
  [書き込み] Google Drive → 動画ファイル保存
```

### Step 6: 投稿ワーカー — 投稿実行

**実行者**: 投稿ワーカー (Node.jsコード)
**タイミング**: planned_post_date到来 + 最適投稿時間帯

```
MCPツール呼び出し:
  1. get_publish_task()
     → task_queue SELECT (type='publish')

  2. publish_to_youtube({
       content_id: "CNT_202603_0001",
       title: "朝のスキンケアルーティン",
       description: "...",
       tags: ["skincare", "beauty", "morning"],
       video_drive_id: "2def..."
     })
     → YouTube Data API v3

  3. report_publish_result({
       task_id: 4,
       content_id: "CNT_202603_0001",
       platform_post_id: "dQw4w9WgXcQ",
       post_url: "https://youtube.com/shorts/dQw4w9WgXcQ",
       posted_at: "2026-03-05T07:00:00Z"
     })
     → publications INSERT (posted_at, measure_after=posted_at+48h)
     → content UPDATE (status='posted')
     → task_queue INSERT (type='measure', payload に measure_after を含める)

データフロー:
  [読み取り] task_queue → 投稿タスク取得
  [外部API] YouTube/TikTok/Instagram/X → 投稿実行
  [書き込み] publications INSERT → 投稿記録
  [書き込み] content UPDATE → status: ready → posted
  [書き込み] task_queue INSERT → 計測タスク発行 (measure_after設定)
```

### Step 7: 計測ワーカー — メトリクス収集

**実行者**: 計測ワーカー (Node.jsコード)
**タイミング**: posted_at + 48h経過後

```
MCPツール呼び出し:
  1. get_measurement_tasks({ limit: 10 })
     → task_queue SELECT (type='measure', NOW() > measure_after)

  2. collect_youtube_metrics({ platform_post_id: "dQw4w9WgXcQ" })
     → YouTube Analytics API
     → { views: 4800, likes: 240, comments: 35, shares: 12,
          watch_time_seconds: 14400, completion_rate: 0.72 }

  3. collect_account_metrics({ account_id: "ACC_0013" })
     → { follower_count: 1250, follower_delta: +48 }

  4. report_measurement_complete({
       task_id: 7,
       publication_id: 42,
       metrics_data: {
         views: 4800, likes: 240, comments: 35, shares: 12,
         watch_time_seconds: 14400, completion_rate: 0.72,
         engagement_rate: 0.0598, follower_delta: 48,
         raw_data: { ... }
       }
     })
     → metrics INSERT
     → content UPDATE (status='measured')
     → accounts UPDATE (follower_count=1250)

データフロー:
  [読み取り] task_queue → 計測タスク取得
  [外部API] YouTube/TikTok/Instagram/X Analytics API → メトリクス取得
  [書き込み] metrics INSERT → パフォーマンスデータ
  [書き込み] content UPDATE → status: posted → measured
  [書き込み] accounts UPDATE → follower_count更新
```

### Step 8: アナリスト — 分析開始

**実行者**: アナリスト (Claude Sonnet 4.5)
**タイミング**: metricsテーブルに新規データが入った時点

```
MCPツール呼び出し:
  1. get_metrics_for_analysis({ since: "48h", status: "measured" })
     → 新しく計測された投稿のメトリクス一覧

  2. get_hypothesis_results({ hypothesis_id: 42 })
     → {
          predicted_kpis: { views: 5000, engagement_rate: 0.05, completion_rate: 0.7 },
          actual_kpis: { views: 4800, engagement_rate: 0.0598, completion_rate: 0.72 },
          content_count: 5,
          raw_metrics: [...]
        }

  3. detect_anomalies({ period: "7d", threshold: 2.0 })
     → 異常値の検出

データフロー:
  [読み取り] metrics → 新規計測データ
  [読み取り] hypotheses → predicted_kpis
  [読み取り] content → 仮説に紐づくコンテンツ群
```

### Step 9: アナリスト — 仮説検証実行

**実行者**: アナリスト (Claude Sonnet 4.5)
**タイミング**: Step 8の直後

```
MCPツール呼び出し:
  1. compare_hypothesis_predictions({ hypothesis_ids: [42] })
     → predicted vs actual の詳細比較

  2. verify_hypothesis({
       hypothesis_id: 42,
       verdict: "confirmed",
       confidence: 0.82,
       evidence_summary: "5件のコンテンツで検証。engagement_rate予測0.05に対し
                          実測平均0.0598 (+19.6%)。completion_rateも予測0.70に対し
                          実測0.72 (+2.9%)。いずれも予測を上回り、仮説を支持。"
     })
     → hypotheses UPDATE (verdict='confirmed', confidence=0.82)

  3. create_analysis({
       cycle_id: 5,
       analysis_type: "hypothesis_verification",
       findings: {
         hypothesis_id: 42,
         verdict: "confirmed",
         predicted_vs_actual: { ... },
         statistical_significance: 0.03,
         sample_size: 5
       },
       recommendations: [{
         action: "expand_morning_posts",
         rationale: "朝投稿の仮説が高い確信度で確認された",
         priority: "high"
       }]
     })
     → analyses INSERT

データフロー:
  [読み取り] hypotheses → predicted_kpis
  [読み取り] metrics → actual_kpis (集計)
  [書き込み] hypotheses UPDATE → verdict='confirmed', confidence=0.82
  [書き込み] analyses INSERT → 検証結果レポート
```

### Step 10: アナリスト — 知見抽出

**実行者**: アナリスト (Claude Sonnet 4.5)
**タイミング**: Step 9の直後

```
MCPツール呼び出し:
  1. search_similar_learnings({
       query_text: "朝投稿 エンゲージメント beauty",
       limit: 5,
       min_confidence: 0.3
     })
     → 既存の類似知見を検索
     → 既存知見あり → update_learning_confidence
     → 既存知見なし → extract_learning

  2a. (既存知見がある場合)
     update_learning_confidence({
       learning_id: 15,
       new_confidence: 0.85,   // 0.75 → 0.85 に上昇
       additional_evidence: "サイクル5の仮説H-042でも確認 (confidence=0.82)"
     })
     → learnings UPDATE (confidence=0.85, evidence_count++)

  2b. (新規知見の場合)
     extract_learning({
       insight: "beautyニッチで朝7時投稿はengagement_rate +20%を実現する
                (5件, p=0.03, confidence=0.82)",
       category: "timing",
       confidence: 0.82,
       source_analyses: [23],
       applicable_niches: ["beauty", "skincare"]
     })
     → learnings INSERT (embedding自動生成)

  3. calculate_algorithm_performance({ period: "daily" })
     → algorithm_performance INSERT

データフロー:
  [読み取り] learnings (ベクトル検索) → 類似知見
  [書き込み] learnings INSERT or UPDATE → 知見の蓄積/強化
  [書き込み] algorithm_performance INSERT → アルゴリズム精度記録
```

### Step 11: 次サイクルへ

**実行者**: 社長 (Claude Opus 4.6)
**タイミング**: 翌日の朝

```
→ Step 1 に戻る

次のサイクルで改善される点:
  ・蓄積知見が1件以上増えている
  ・仮説の検証結果が1件以上記録されている
  ・algorithm_performanceに新しいデータポイント
  ・プランナーは新しい知見を参照してより精度の高い仮説を生成

サイクルを重ねるごとに:
  ・hypothesis_accuracy が向上 (目標: 0.30 → 0.65 in 6ヶ月)
  ・prediction_error が減少
  ・learning_count が増加
  ・新ニッチへの展開速度が向上 (類似知見の転用)
```

### 7.2 仮説駆動サイクルのタイムライン

```
時間軸 ──────────────────────────────────────────────────────────────→

Day 0 (朝)          Day 0 (昼)        Day 2 (朝)         Day 4 (朝)         Day 5 (朝)
│                    │                  │                  │                  │
│ Step 1-4:          │ Step 5:          │ Step 6:          │ Step 7:          │ Step 8-11:
│ データ確認          │ 制作ワーカー       │ 投稿ワーカー       │ 計測ワーカー       │ アナリスト
│ 方針決定           │ 動画生成          │ 投稿実行          │ メトリクス収集     │ 分析・検証
│ 仮説立案           │ (~12分/件)        │                  │                  │ 知見抽出
│ コンテンツ計画       │                  │                  │                  │
│                    │                  │                  │                  │
│ 所要: ~30分         │ 所要: ~2時間      │ 所要: ~5分        │ 所要: ~10分       │ 所要: ~15分
│ (LLM処理)          │ (fal.ai待ち)      │ (API呼び出し)     │ (API呼び出し)     │ (LLM処理)
│                    │                  │                  │                  │
▼                    ▼                  ▼                  ▼                  ▼
cycles INSERT        content UPDATE     publications       metrics INSERT     hypotheses UPDATE
hypotheses INSERT    status='ready'     INSERT             content UPDATE     analyses INSERT
content INSERT       Drive保存          posted_at記録      status='measured'  learnings INSERT
status='planned'                        measure_after設定                    algo_perf INSERT
                                                                            ↓
                                                                         Day 5 = 次サイクルの
                                                                         Step 1 開始
```

### 7.3 データテーブルの遷移サマリー

| Step | 実行者 | 書き込みテーブル | 主要なカラム変更 |
|------|--------|----------------|----------------|
| 1 | 社長 | (読み取りのみ) | - |
| 2 | 社長 | `cycles` | INSERT (status='planning') |
| 3 | プランナー | `hypotheses` | INSERT (verdict='pending', predicted_kpis) |
| 4 | プランナー | `content`, `task_queue` | INSERT (status='planned'), INSERT (type='produce') |
| 5 | 制作ワーカー | `content` | UPDATE (planned→producing→ready) |
| 6 | 投稿ワーカー | `publications`, `content`, `task_queue` | INSERT, UPDATE (status='posted'), INSERT (type='measure') |
| 7 | 計測ワーカー | `metrics`, `content`, `accounts` | INSERT, UPDATE (status='measured'), UPDATE (follower_count) |
| 8 | アナリスト | (読み取りのみ) | - |
| 9 | アナリスト | `hypotheses`, `analyses` | UPDATE (verdict, confidence), INSERT |
| 10 | アナリスト | `learnings`, `algorithm_performance` | INSERT or UPDATE, INSERT |
| 11 | 社長 | → Step 1に戻る | - |
