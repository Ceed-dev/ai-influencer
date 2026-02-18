# AIエージェント設計

> v5.0のAIエージェント階層構造、MCP Serverツール一覧、LangGraphグラフ設計、データフロー、仮説駆動サイクル、エージェント個別学習・自己改善メカニズムを詳細に定義する
>
> **エージェント総数**: 社長1 + 専門職4〜5 + 部長N + ワーカープール = 可変
>
> **MCPツール数**: 102ツール (89 MCPツール + 13 Dashboard REST API, 12カテゴリ)
>
> **LangGraphグラフ数**: 4グラフ (戦略サイクル / 制作パイプライン / 投稿スケジューラー / 計測ジョブ)
>
> **関連ドキュメント**: [02-architecture.md](02-architecture.md) (システムアーキテクチャ), [03-database-schema.md](03-database-schema.md) (DBスキーマ), [01-tech-stack.md](01-tech-stack.md) (技術スタック)

## 目次

- [1. エージェント階層設計](#1-エージェント階層設計)
  - [1.1 Layer 1: 社長 — 戦略エージェント (Strategic Agent) x 1体](#11-layer-1-社長--戦略エージェント-strategic-agent-x-1体)
  - [1.2 Layer 2: 専門職 — リサーチャー (Researcher) x 1〜数体](#12-layer-2-専門職--リサーチャー-researcher-x-1数体)
  - [1.3 Layer 2: 専門職 — アナリスト (Analyst) x 1体](#13-layer-2-専門職--アナリスト-analyst-x-1体)
  - [1.4 Layer 2: 専門職 — ツールスペシャリスト (Tool Specialist) x 1体](#14-layer-2-専門職--ツールスペシャリスト-tool-specialist-x-1体)
  - [1.5 Layer 2: 専門職 — データキュレーター (Data Curator) x 1体](#15-layer-2-専門職--データキュレーター-data-curator-x-1体)
  - [1.6 Layer 3: 部長 — プランナーエージェント (Planner) x N体](#16-layer-3-部長--プランナーエージェント-planner-x-n体)
  - [1.7 Layer 4: 作業員 — ワーカーエージェント (ステートレス・プール)](#17-layer-4-作業員--ワーカーエージェント-ステートレスプール)
- [2. エージェント間の情報の流れ](#2-エージェント間の情報の流れ)
  - [2.1 方向別データフロー](#21-方向別データフロー)
  - [2.2 4つの方向の詳細](#22-4つの方向の詳細)
  - [2.3 具体的な情報フローの例](#23-具体的な情報フローの例)
- [3. エージェント通信パターン](#3-エージェント通信パターン)
  - [3.1 上位層 (社長・部長・専門職): LLM対話](#31-上位層-社長部長専門職-llm対話)
  - [3.2 下位層 (部長→ワーカー): DBタスクキュー](#32-下位層-部長ワーカー-dbタスクキュー)
- [4. MCP Server ツール一覧 (102ツール)](#4-mcp-server-ツール一覧-102ツール)
  - [4.1 戦略エージェント用 (10ツール)](#41-戦略エージェント用-10ツール)
  - [4.2 リサーチャー用 (12ツール)](#42-リサーチャー用-12ツール)
  - [4.3 アナリスト用 (14ツール)](#43-アナリスト用-14ツール)
  - [4.4 プランナー用 (9ツール)](#44-プランナー用-9ツール)
  - [4.5 ツールスペシャリスト用 (5ツール)](#45-ツールスペシャリスト用-5ツール)
  - [4.6 制作ワーカー用 (12ツール)](#46-制作ワーカー用-12ツール)
  - [4.7 投稿ワーカー用 (6ツール)](#47-投稿ワーカー用-6ツール)
  - [4.8 計測ワーカー用 (7ツール)](#48-計測ワーカー用-7ツール)
  - [4.9 ダッシュボード用 (10ツール)](#49-ダッシュボード用-10ツール)
  - [4.10 データキュレーター用 (6ツール)](#410-データキュレーター用-6ツール)
  - [4.11 ダッシュボード キュレーション用 (3ツール)](#411-ダッシュボード-キュレーション用-3ツール)
  - [4.12 エージェント自己学習・コミュニケーション用 (8ツール)](#412-エージェント自己学習コミュニケーション用-8ツール)
- [5. LangGraphグラフ設計詳細](#5-langgraphグラフ設計詳細)
  - [5.1 グラフ1: 戦略サイクルグラフ (Strategy Cycle Graph)](#51-グラフ1-戦略サイクルグラフ-strategy-cycle-graph)
  - [5.2 グラフ2: 制作パイプライングラフ (Production Pipeline Graph)](#52-グラフ2-制作パイプライングラフ-production-pipeline-graph)
  - [5.3 グラフ3: 投稿スケジューラーグラフ (Publishing Scheduler Graph)](#53-グラフ3-投稿スケジューラーグラフ-publishing-scheduler-graph)
  - [5.4 グラフ4: 計測ジョブグラフ (Measurement Jobs Graph)](#54-グラフ4-計測ジョブグラフ-measurement-jobs-graph)
  - [5.5 グラフ間の連携サマリー](#55-グラフ間の連携サマリー)
- [6. データがアルゴリズムに寄与する仕組み](#6-データがアルゴリズムに寄与する仕組み)
  - [6.1 仮説精度の向上](#61-仮説精度の向上)
  - [6.2 分析精度の向上](#62-分析精度の向上)
  - [6.3 改善スピードの向上](#63-改善スピードの向上)
  - [6.4 algorithm_performanceテーブルによるメタ計測](#64-algorithm_performanceテーブルによるメタ計測)
- [7. 仮説駆動サイクルの詳細フロー](#7-仮説駆動サイクルの詳細フロー)
  - [7.1 全体フロー図](#71-全体フロー図)
  - [7.2 仮説駆動サイクルのタイムライン](#72-仮説駆動サイクルのタイムライン)
  - [7.3 データテーブルの遷移サマリー](#73-データテーブルの遷移サマリー)
- [8. プロンプトDB管理](#8-プロンプトdb管理)
  - [8.1 背景と目的](#81-背景と目的)
  - [8.2 プロンプトの論理構成](#82-プロンプトの論理構成)
  - [8.3 プロンプトの構造](#83-プロンプトの構造)
  - [8.4 具体例: strategist (抜粋)](#84-具体例-strategist-抜粋)
  - [8.5 LangGraphでの読み込み](#85-langgraphでの読み込み)
  - [8.6 バージョン管理とロールバック](#86-バージョン管理とロールバック)
- [9. 人間によるエージェントチューニング](#9-人間によるエージェントチューニング)
  - [9.1 なぜチューニングが不可欠なのか](#91-なぜチューニングが不可欠なのか)
  - [9.2 チューニングワークフロー](#92-チューニングワークフロー)
  - [9.3 チューニング対象と典型的な改善例](#93-チューニング対象と典型的な改善例)
  - [9.4 チューニング頻度の目安](#94-チューニング頻度の目安)
  - [9.5 ダッシュボードからのプロンプト編集](#95-ダッシュボードからのプロンプト編集)
  - [9.6 human_directives (一時的指示) とプロンプトチューニング (永続的変更) の使い分け](#96-human_directives-一時的指示-とプロンプトチューニング-永続的変更-の使い分け)
- [10. エージェント個別振り返り（セルフリフレクション）](#10-エージェント個別振り返りセルフリフレクション)
  - [10.1 設計思想](#101-設計思想)
  - [10.2 リフレクションメカニズム](#102-リフレクションメカニズム)
  - [10.3 `agent_reflections` テーブル設計](#103-agent_reflections-テーブル設計)
  - [10.4 LangGraph `reflect_all` ノードの実装](#104-langgraph-reflect_all-ノードの実装)
  - [10.5 セルフリフレクションの効果測定](#105-セルフリフレクションの効果測定)
- [11. エージェント個別学習メモリ](#11-エージェント個別学習メモリ)
  - [11.1 設計思想](#111-設計思想)
  - [11.2 エージェント別の個別学習メモリ具体例](#112-エージェント別の個別学習メモリ具体例)
  - [11.3 `agent_individual_learnings` テーブル設計](#113-agent_individual_learnings-テーブル設計)
  - [11.4 個別学習メモリのアクセスパターン](#114-個別学習メモリのアクセスパターン)
  - [11.5 個別学習メモリの知見ライフサイクル](#115-個別学習メモリの知見ライフサイクル)
- [12. エージェント→人間コミュニケーション（相談・報告）](#12-エージェント人間コミュニケーション相談報告)
  - [12.1 設計思想](#121-設計思想)
  - [12.2 コミュニケーションの4タイプ](#122-コミュニケーションの4タイプ)
  - [12.3 `agent_communications` テーブル設計](#123-agent_communications-テーブル設計)
  - [12.4 コミュニケーションフローの全体像](#124-コミュニケーションフローの全体像)
  - [12.5 メッセージ送信の判断基準](#125-メッセージ送信の判断基準)
  - [12.6 ダッシュボードの受信トレイUI](#126-ダッシュボードの受信トレイui)
  - [12.7 情報の流れの完全な双方向フロー (更新版)](#127-情報の流れの完全な双方向フロー-更新版)
- [13. ツール知識学習メカニズム](#13-ツール知識学習メカニズム)
  - [13.1 設計思想](#131-設計思想)
  - [13.2 学習サイクルの詳細](#132-学習サイクルの詳細)
  - [13.3 ツール知識の構造化: ツール × コンテンツタイプ × 特性マトリックス](#133-ツール知識の構造化-ツール--コンテンツタイプ--特性マトリックス)
  - [13.4 `tool_knowledge` テーブル設計](#134-tool_knowledge-テーブル設計)
- [14. プロンプト変更の自動提案メカニズム](#14-プロンプト変更の自動提案メカニズム)
  - [14.1 設計思想](#141-設計思想)
  - [14.2 アラートトリガー条件](#142-アラートトリガー条件)
  - [14.3 thought_logs分析による改善セクション提案](#143-thought_logs分析による改善セクション提案)
  - [14.4 ダッシュボードの「推奨改善」セクション](#144-ダッシュボードの推奨改善セクション)
  - [14.5 実装: プロンプト改善チェッカー](#145-実装-プロンプト改善チェッカー)
- [15. WF完成後の知見移植プロセス](#15-wf完成後の知見移植プロセス)
  - [15.1 背景](#151-背景)
  - [15.2 知見移植の6ステップ](#152-知見移植の6ステップ)
  - [15.3 各ステップの詳細](#153-各ステップの詳細)
  - [15.4 知見移植のタイムライン](#154-知見移植のタイムライン)

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
│  Layer 2: 専門職エージェント × 4〜5体                                    │
│  ┌─────────────────────────┐  ┌─────────────────────────┐            │
│  │  リサーチャー (Researcher) │  │  アナリスト (Analyst)     │            │
│  │  Claude Sonnet 4.5       │  │  Claude Sonnet 4.5       │            │
│  │  市場調査・トレンド収集    │  │  パフォーマンス分析       │            │
│  │  トリガー: 数時間ごと     │  │  仮説検証・知見蓄積       │            │
│  │  × 1〜数体              │  │  トリガー: 計測完了後     │            │
│  └─────────────────────────┘  │  × 1体                  │            │
│                                └─────────────────────────┘            │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  ツールスペシャリスト (Tool Specialist)                            │  │
│  │  Claude Sonnet 4.5                                                │  │
│  │  AIツール特性把握 / 最適ツール組み合わせ提案 / 制作レシピ設計        │  │
│  │  トリガー: 制作計画策定時 + 定期知識更新                            │  │
│  │  × 1体                                                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  データキュレーター (Data Curator)                                  │  │
│  │  Claude Sonnet 4.5                                                │  │
│  │  生データの構造化 / コンポーネント自動生成 / 重複チェック・品質判定   │  │
│  │  トリガー: 連続実行 (キューポーリング)                              │  │
│  │  × 1体                                                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│           │ 判断材料・ツール推奨          │ 判断材料                      │
│           ▼                             │                               │
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
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │ 動画制作      │  │ テキスト制作   │  │ 投稿ワーカー   │  │ 計測ワーカー  ││
│  │ ワーカー      │  │ ワーカー      │  │ (コード)      │  │ (コード)     ││
│  │ (コード)      │  │ (コード)      │  │ 各プラット     │  │ メトリクス    ││
│  │ 動画生成      │  │ X投稿文生成   │  │ フォームへ投稿 │  │ 収集         ││
│  │ ツールSP推奨  │  │ キャラ設定    │  │ 負荷で増減    │  │ 負荷で増減   ││
│  │ に従う       │  │ +シナリオ活用 │  │              │  │             ││
│  │ 負荷で増減    │  │ 負荷で増減    │  │              │  │             ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
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

### 1.4 Layer 2: 専門職 — ツールスペシャリスト (Tool Specialist) x 1体

各AIツール（Kling, Runway, Sora, Pika, Fish Audio, ElevenLabs, Sync Lipsync, Hedra等）の特性・クセ・得意不得意を知識として保持する「ツールの専門家」。「こういうアウトプットを作りたい」という要求に対して最適なツール組み合わせと使い方（制作レシピ）を提案する。

| 項目 | 詳細 |
|------|------|
| **LLM** | Claude Sonnet 4.5 |
| **体数** | 1体 |
| **トリガー** | 制作計画策定時（プランナーからの制作レシピ要求）+ 定期知識更新（日次） |
| **入力** | コンテンツ要件（ニッチ、キャラクター特性、目標品質）、ツール経験データベース、外部情報（X投稿、公式ドキュメント、プレスリリース） |
| **出力** | 制作レシピ（使用ツール組み合わせ + パラメータ推奨 + 注意点）、ツール知識更新 |
| **System Prompt概要** | 「あなたはAI動画/音声/画像生成ツールの専門家です。各ツールの特性・制約・得意分野を熟知しています。コンテンツ要件に基づき最適なツール組み合わせ（制作レシピ）を提案してください。」 |
| **プロンプト管理** | `agent_prompt_versions` テーブル (DB管理) — 人間がダッシュボードから経験則をチューニング可能 |

**Sonnet 4.5を使用する理由**:
- ツール知識の検索・照合は推論よりも知識参照が主体。Opusレベルの推論は不要
- 制作計画時に毎回呼ばれるため、コスト効率が重要
- 知識ベースはDB (agent_prompt_versions + tool_experiences) で管理するため、LLM自体の能力よりコンテキスト活用が重要

**具体的な責務**:

1. **制作レシピの設計**: コンテンツ要件に応じた最適なツール組み合わせを提案
   - 例: 「アジア人キャラ + beauty = Kling動画生成 + Fish Audio TTS + Sync Lipsync」
   - 例: 「西洋人キャラ + tech = Runway動画生成 + ElevenLabs TTS + Hedra Lipsync」
2. **ツール知識の維持**: 各ツールの最新情報を定期的に収集・更新
3. **経験の蓄積**: 制作結果の品質評価→どのツール組み合わせが良かったかを記録
4. **代替ツール提案**: 特定ツールがダウン/制限時に代替ツールを即座に推奨
5. **パラメータ最適化**: ツールごとの最適パラメータ（解像度、モデルバージョン等）を知見として保持

**content_formatに基づくレシピ選択**:

`content_format` はレシピ選択の **最上位の分岐条件** である。プランナーが `plan_content` で指定した `content_format` に応じてツールスペシャリストの動作が変わる:

| content_format | ツールスペシャリストの動作 | レシピ |
|---|---|---|
| `short_video` | キャラクター特性・ニッチ・プラットフォームに基づき動画制作レシピを選択 | `production_recipes` に保存 |
| `text_post` | レシピ不要 — テキスト制作ワーカーがLLMで直接生成するため | `recipe_id = NULL` |
| `image_post` | (将来拡張) 画像生成レシピを選択 | `production_recipes` に保存 |

**動画スタイルの学習パターン** (ハードコードされたenumではなく、`tool_experiences` から学習されるパターン):

| パターン名 | 特徴 | 典型的なツール組み合わせ |
|---|---|---|
| 実写風 (live-action) | 実在人物風キャラクター、リアルな表情 | Kling + Fish Audio + Sync Lipsync |
| アニメーション風 | アニメ/カートゥーン風キャラクター | Pika/アニメーション特化ツール + TTS (リップシンク任意) |
| スタイライズド | アート系、スタイリッシュな表現 | Runway + ElevenLabs + Hedra |

これらは固定カテゴリではなく、ツールスペシャリストが `tool_experiences` テーブルから成功/失敗パターンを蓄積し、新たなスタイルパターンを自律的に発見・命名できる。

**個別学習メモリのカテゴリ**:
- `tool_characteristics`: ツール固有の特性・クセ（例: 「Klingはアジア人の顔が自然」）
- `tool_combination`: ツール組み合わせの相性（例: 「Fish Audio + Sync Lipsyncは口パク精度が高い」）
- `tool_failure_pattern`: ツール固有の失敗パターン（例: 「Kling 3850px超は422エラー」）
- `tool_update`: ツールのアップデート情報（例: 「Kling v2.0でモーション精度向上」）

**外部情報の定期収集**:
- AIツール関連のX投稿（開発者・パワーユーザーのアカウント）
- 各ツール公式ドキュメントの変更検知
- プレスリリース・ブログ記事のスキャン
- リサーチャーと連携し、ツール関連の市場情報を共有

### 1.5 Layer 2: 専門職 — データキュレーター (Data Curator) x 1体

リサーチャーや人間から受け取った生データを、適切に分解・構造化・分類して `components` テーブルに保存する「データ整理の専門家」。v4.0では人間が手動でインベントリを作成していたが、KPI 3,500アカウント規模では非現実的であるため、このエージェントが自動化する。

| 項目 | 詳細 |
|------|------|
| **LLM** | Claude Sonnet 4.5 |
| **体数** | 1体 |
| **トリガー** | 連続実行 (`task_queue` の type='curate' をポーリング) |
| **入力** | リサーチャーが収集した市場データ (トレンド、競合投稿、参考コンテンツ)、人間がダッシュボードから提供する参考動画・参考投稿、アナリストのスコア分析に基づく既存コンポーネント改良指示 |
| **出力** | `components` テーブルに構造化データとして保存 (type=scenario/motion/audio/image)、品質スコア初期値設定 |
| **System Prompt概要** | 「あなたはデータキュレーションの専門家です。生の市場データや参考コンテンツを分析し、制作パイプラインで使用できる構造化されたコンポーネント (シナリオ、モーション参照、音声設定、画像素材) に変換してください。既存コンポーネントとの重複を避け、品質スコアの初期値を適切に設定してください。」 |
| **プロンプト管理** | `agent_prompt_versions` テーブル (DB管理) — 人間がダッシュボードからキュレーション基準をチューニング可能 |

**Sonnet 4.5を使用する理由**:
- データ処理・分類がメインであり、高度な推論は不要
- 連続実行のため、コスト効率が重要
- 構造化のルールはDB管理のプロンプトで制御できるため、LLM自体の能力よりコンテキスト活用が重要

**具体的な責務**:

1. **キュレーションキューの処理**: `task_queue` (type='curate') から生データを取得し、順次処理する
2. **生データの分析**: 入力データの種類を判別し、適切なコンポーネント種別 (scenario/motion/audio/image) を決定する
3. **構造化**: 生データを `components.data` (JSONB) の構造に変換する
   - シナリオ: トレンドや競合分析からスクリプト素案を生成 (script_en/jp、scenario_prompt等)
   - モーション: 参考動画をDriveに保存し、motion_type/character_orientation等を設定
   - 音声: BGM・効果音の設定情報を構造化
   - 画像: 背景画像・オーバーレイ素材を分類・登録
4. **重複チェック**: pgvectorを使った類似コンポーネント検索で、既存データとの重複を防止する
5. **品質スコア初期設定**: 元データの品質・完成度に基づいて `score` の初期値を設定する
6. **人間レビュー送信**: 自信度が低い結果を人間レビュー用にマークする (`review_status = 'pending_review'`)

**人間レビューフロー (初期フェーズ)**:
- `REQUIRE_AUTO_CURATION = true` (デフォルト) — キュレーション結果はダッシュボードのレビューパネルに表示
- 人間が結果を確認して、修正・承認・削除が可能
- キュレーター自信度 (`curation_confidence`) が閾値以上の場合は自動承認 (`review_status = 'auto_approved'`)
- 信頼度が十分に高まれば、人間レビューなしでの自動承認に段階的に移行

**個別学習メモリのカテゴリ**:
- `data_classification`: データ種別の判定精度 (例: 「トレンド動画はmotion typeに分類が最適」)
- `curation_quality`: 人間レビューでの承認/却下パターン (例: 「beauty系シナリオの自信度が実際の承認率と乖離」)
- `source_reliability`: データソースの信頼性 (例: 「リサーチャーのtrending_topicは高品質」)

### 1.6 Layer 3: 部長 — プランナーエージェント (Planner) x N体

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

### 1.7 Layer 4: 作業員 — ワーカーエージェント (ステートレス・プール)

指示通りに実行する「手足」。タスクキューからタスクを取得し、処理し、結果を報告する。動画制作ワーカーはコードのみ (LLMなし) で動作するが、テキスト制作ワーカーはLLMベースである (テキスト生成は「判断」が必要なため)。

| ワーカー種別 | 実装方式 | 役割 | スケール |
|------------|---------|------|---------|
| **動画制作ワーカー** | Node.js (コードのみ、LLMなし) | YouTube/TikTok/Instagram向け動画生成。ツールスペシャリストが設計した制作レシピに従い、動画生成→TTS→リップシンク→結合を実行。使用ツールはレシピで指定される（デフォルト: v4.0パイプライン = Kling + Fish Audio + Sync Lipsync） | 同時制作数に応じて (API同時実行上限に依存) |
| **テキスト制作ワーカー** | Node.js + LLM (Sonnet) | X投稿・キャプション等のテキストコンテンツ生成。キャラクター人格 + シナリオテーマ + プラットフォーム制約からLLMが文章を生成 | 投稿量に応じて |
| **投稿ワーカー** | Node.js (投稿アダプター) | プラットフォーム別に投稿実行 | 投稿量に応じて |
| **計測ワーカー** | Node.js (計測コード) | 投稿48h後にメトリクス収集 | 計測対象数に応じて |

**ワーカーの共通特性**:
- **ステートレス**: 状態を持たない。タスクキューからタスクを取得し、完了したら結果を書き戻す
- **冪等**: 同じタスクを複数回実行しても副作用がない
- **スケーラブル**: 負荷に応じてワーカー数を増減

**動画制作ワーカー (コードのみ・レシピ駆動)**:

動画制作ワーカーはLLMを使わず、ツールスペシャリストが設計した **制作レシピ** (`production_recipes.steps` JSONB) を機械的に実行する。

```
実行フロー:
  1. content.recipe_id → production_recipes テーブルからレシピ取得
  2. steps[] を順次実行 (parallel_group / depends_on を尊重)
  3. 各stepは Node.js 関数にマッピング:
     - Kling API呼出 → start_video_generation
     - Fish Audio API呼出 → start_tts
     - fal.ai Lipsync呼出 → start_lipsync
     - ffmpeg concat → ローカル実行
  4. ステップ失敗時 → tool_experiences に failure_reason を記録
     → ツールスペシャリストが次回から代替レシピを推奨可能に
```

```
制作レシピの例:

  レシピ1 (デフォルト — v4.0互換):
    動画生成: Kling
    TTS: Fish Audio
    Lipsync: Sync Lipsync (fal.ai)
    結合: ffmpeg
    適用: アジア人キャラ全般

  レシピ2:
    動画生成: Runway Gen-3
    TTS: ElevenLabs
    Lipsync: Hedra
    結合: ffmpeg
    適用: 西洋人キャラ、リアリスティック表現

  レシピ3:
    動画生成: Pika
    TTS: Fish Audio
    Lipsync: Sync Lipsync (fal.ai)
    結合: ffmpeg
    適用: スタイライズド表現、アート系コンテンツ
```

v4.0パイプラインは「デフォルトレシピ」として残り、ツールスペシャリストが明示的に別のレシピを指定しない限りこのレシピが適用される。

**テキスト制作ワーカー (LLMベース)**:

テキスト生成は単なるデータ変換ではなく「判断」を伴うため、LLM (Sonnet) を使用する。動画制作ワーカーとは異なり、制作レシピは不要。

| 項目 | 詳細 |
|------|------|
| **LLM** | Claude Sonnet 4.5 |
| **入力** | `content` レコード + シナリオ `component` + `characters.personality` JSONB (traits, speaking_style, language_preference, emoji_usage, catchphrase) |
| **処理** | LLMがキャラクターの人格・口調に基づいてテキストを生成。プラットフォーム別フォーマット制約を遵守 |
| **出力** | 生成テキスト → `content_sections.script` に保存 |
| **品質管理** | 自己スコアリング (キャラクター一貫性、エンゲージメント予測) |

**プラットフォーム別制約**:

| プラットフォーム | 制約 |
|---|---|
| X | 280文字以内、ハッシュタグ慣習 (2〜5個)、スレッド形式対応 |
| Instagram キャプション | 2,200文字以内、改行活用、ハッシュタグ (10〜20個) |
| TikTok キャプション | 2,200文字以内、短文推奨、ハッシュタグ (3〜5個) |
| YouTube タイトル/概要 | タイトル100文字以内、概要5,000文字以内、SEOキーワード |

テキスト制作ワーカーは専用MCPツールを持たず、LLMが直接テキストを生成して `update_content_status` (制作ワーカーMCPツール #10) で結果を書き戻す。

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
          ┌────────────▼───┐    ┌────▼────────────▼──────────┐
          │ プランナー (部長) │◄───│ 専門職                      │
          │ Sonnet x N     │(3) │ リサーチャー       Sonnet   │
          │                │    │ アナリスト         Sonnet   │
          │                │    │ ツールスペシャリスト Sonnet   │
          └───────┬────────┘    └──────────────┬─────────────┘
             (1)下向き│                  ▲(2)上向き│ツール推奨
             制作指示 │                  │完了報告  ▼
                     │                  │
          ┌──────────▼──────────────────┴──┐
          │ ワーカー (作業員) — コード       │
          │ 動画制作 / テキスト制作 /       │
          │ 投稿 / 計測                    │
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
| **(1) 上→下** | 社長→プランナー→ツールSP→ワーカー | サイクル方針、制作指示、制作レシピ、投稿指示 | `cycles`, `content`, `task_queue` |
| **(2) 下→上** | ワーカー→アナリスト→社長 | 完了報告、パフォーマンスデータ、分析結果 | `metrics`, `analyses`, `algorithm_performance` |
| **(3) 横** | リサーチャー・アナリスト・ツールSP→社長・プランナー・ワーカー | 市場動向、トレンド、知見、仮説検証結果、制作レシピ | `market_intel`, `learnings`, `hypotheses`, `tool_knowledge` |
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
    → publications (INSERT, status='posted', posted_at=NOW())

[Day 4 - 朝7時]
  計測ワーカー: posted_at + 48hを過ぎた投稿のメトリクスを収集
    → metrics (INSERT, views=..., engagement_rate=...)
    → publications (UPDATE, status='measured')

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
│    ┌──← ツールスペシャリスト (Sonnet)                  │
│           「本日の制作にはKling + Fish Audio + Sync     │
│            Lipsyncのデフォルトレシピを推奨。             │
│            西洋人キャラはRunway + Hedraを推奨」         │
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

## 4. MCP Server ツール一覧 (102ツール)

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
| 6 | `get_pending_directives` | `{}` | `[{ id, directive_type, content, priority, created_at }]` | 人間からの未処理指示 (社長専用 — 他エージェントはget_human_responsesを使用) |
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
| 5 | `plan_content` | `{ hypothesis_id, character_id, script_language, content_format: 'short_video' \| 'text_post' \| 'image_post', sections: [{ component_id, section_label }] }` | `{ content_id }` | コンテンツ計画の作成 (content_formatでワーカー振分決定) |
| 6 | `schedule_content` | `{ content_id, planned_post_date }` | `{ success }` | 投稿スケジュール設定 |
| 7 | `get_niche_learnings` | `{ niche, min_confidence: 0.5, limit: 10 }` | `[{ insight, confidence, category }]` | ニッチ関連の知見取得 |
| 8 | `get_content_pool_status` | `{ cluster }` | `{ content: { pending_approval, planned, producing, ready, analyzed }, publications: { scheduled, posted, measured } }` | コンテンツプールの状況 |
| 9 | `request_production` | `{ content_id, priority: 0 }` | `{ task_id }` | 制作タスクの発行 (task_queueにINSERT) |

### 4.5 ツールスペシャリスト用 (5ツール)

AIツール知識の管理・検索・制作レシピ設計のためのツール群。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_tool_knowledge` | `{ tool_name?, category?: "video_gen" \| "tts" \| "lipsync" \| "image_gen" }` | `[{ tool_name, capabilities, limitations, best_for, parameters, updated_at }]` | ツール特性知識の取得 |
| 2 | `save_tool_experience` | `{ tool_combination: string[], content_id, quality_score: number, notes, character_type?, niche? }` | `{ id }` | ツール使用経験の記録（制作結果の品質評価付き） |
| 3 | `search_similar_tool_usage` | `{ requirements: { character_type?, niche?, content_type?, quality_priority? }, limit: 5 }` | `[{ tool_combination, avg_quality_score, usage_count, notes }]` | 類似要件でのツール使用実績検索 |
| 4 | `get_tool_recommendations` | `{ content_requirements: { character_id, niche, platform, quality_target } }` | `{ recipe: { video_gen, tts, lipsync, concat }, rationale, confidence, alternatives[] }` | コンテンツ要件に対する最適ツール組み合わせ（制作レシピ）の推奨 |
| 5 | `update_tool_knowledge_from_external` | `{ tool_name, update_type: "capability" \| "pricing" \| "api_change" \| "bug", description, source_url? }` | `{ id }` | 外部情報からのツール知識更新 |

### 4.6 制作ワーカー用 (12ツール)

**動画制作ワーカー用**: 動画制作パイプラインの各段階で使用するツール群。v4.0パイプラインのNode.js関数をMCPツールとしてラップ。ツールスペシャリストが設計した制作レシピに基づき、使用するツールを切り替える。

> **注**: 以下12ツールは全て **動画制作ワーカー** 用である。**テキスト制作ワーカー** はLLMでテキストを直接生成するため専用MCPツールは不要。テキスト制作ワーカーが結果を書き戻す際は `update_content_status` (#10) を使用する。

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

### 4.7 投稿ワーカー用 (6ツール)

プラットフォーム別の投稿実行ツール群。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_publish_task` | `{}` | `{ task_id, content_id, platform, payload }` or `null` | 投稿タスクの取得 |
| 2 | `publish_to_youtube` | `{ content_id, title, description, tags, video_drive_id }` | `{ platform_post_id, post_url }` | YouTube投稿 |
| 3 | `publish_to_tiktok` | `{ content_id, description, tags, video_drive_id }` | `{ platform_post_id, post_url }` | TikTok投稿 |
| 4 | `publish_to_instagram` | `{ content_id, caption, tags, video_drive_id }` | `{ platform_post_id, post_url }` | Instagram投稿 |
| 5 | `publish_to_x` | `{ content_id, text, video_drive_id }` | `{ platform_post_id, post_url }` | X/Twitter投稿 |
| 6 | `report_publish_result` | `{ task_id, content_id, platform_post_id, post_url, posted_at }` | `{ success }` | 投稿結果報告 |

### 4.8 計測ワーカー用 (7ツール)

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

### 4.9 ダッシュボード用 (10ツール)

人間がダッシュボードから操作する際に使用するツール群。ダッシュボードはLLMではないため、これらはREST API (Next.js API Routes) として実装し、内部でMCPツールと同等のロジックを呼び出す。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_dashboard_summary` | `{}` | `{ kpi, algorithm_accuracy, active_cycles, pending_tasks }` | ダッシュボード用サマリー |
| 2 | `update_system_config` | `{ key, value }` | `{ success }` | 設定変更 (計測タイミング等) |
| 3 | `submit_human_directive` | `{ directive_type, content, target_accounts?, target_agents?, priority }` | `{ id }` | 人間介入の送信。target_agents — 対象エージェント種別の配列 (例: ['analyst']). NULLで全体ブロードキャスト |
| 4 | `get_pending_approvals` | `{}` | `[{ content_id, hypothesis, plan_summary, cost_estimate, created_at }]` | 承認待ちコンテンツ計画一覧 |
| 5 | `approve_or_reject_plan` | `{ content_id, decision: "approve" \| "reject", feedback?, rejection_category?: "plan_revision" \| "data_insufficient" \| "hypothesis_weak" }` | `{ success }` | コンテンツ計画の人間承認/差戻 (カテゴリ付き) |
| 6 | `submit_learning_guidance` | `{ target_agent_type, guidance, category }` | `{ id }` | 学習方法の指導送信 |
| 7 | `get_learning_directives` | `{ agent_type }` | `[{ guidance, category, created_at }]` | 学習方法指導の取得 |
| 8 | `update_agent_prompt` | `{ agent_type, prompt_content, change_reason }` | `{ version_id }` | agent_prompt_versionsに新バージョンを保存 |
| 9 | `rollback_agent_prompt` | `{ agent_type, version }` | `{ success }` | 指定バージョンをactive化 |
| 10 | `update_prompt_suggestion_status` | `{ suggestion_id, status }` | `{ success }` | prompt_suggestionsの状態更新 (accepted/rejected/on_hold) |

### 4.10 データキュレーター用 (6ツール)

生データの取得・構造化・コンポーネント生成・重複チェックのためのツール群。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_curation_queue` | `{ limit: 10 }` | `[{ id, source, raw_data, data_type }]` | キュレーション待ちデータ取得 |
| 2 | `create_component` | `{ type, subtype, name, data, tags[], drive_file_id? }` | `{ component_id }` | 構造化コンポーネントの作成 |
| 3 | `update_component_data` | `{ component_id, data, tags? }` | `{ success }` | 既存コンポーネントの更新 |
| 4 | `mark_curation_complete` | `{ queue_id, result_component_ids[] }` | `{ success }` | キュレーション完了マーク |
| 5 | `get_similar_components` | `{ type, query_text, limit: 5 }` | `[{ component_id, similarity }]` | 重複チェック用の類似検索 |
| 6 | `submit_for_human_review` | `{ component_ids[], summary }` | `{ success }` | 人間レビュー用に送信 |

### 4.11 ダッシュボード キュレーション用 (3ツール)

人間がダッシュボードからキュレーション結果をレビュー・参考コンテンツを提出するためのツール群。4.9のダッシュボード用ツールと同様、REST API (Next.js API Routes) として実装する。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `get_curated_components_for_review` | `{}` | `[{ component_id, type, data, curator_confidence }]` | レビュー待ちコンポーネント一覧 |
| 2 | `approve_curated_component` | `{ component_id, modifications? }` | `{ success }` | キュレーション結果の承認/修正 |
| 3 | `submit_reference_content` | `{ url?, file_id?, description, target_type }` | `{ queue_id }` | 参考コンテンツの提出 |

### 4.12 エージェント自己学習・コミュニケーション用 (8ツール)

各エージェントがセルフリフレクション、個別学習メモリの管理、人間への自発的コミュニケーションに使用するツール群。全LLMエージェント (社長・リサーチャー・アナリスト・ツールスペシャリスト・データキュレーター・プランナー) が共通で使用する。

| # | ツール名 | 引数 | 戻り値 | 用途 |
|---|---------|------|--------|------|
| 1 | `save_reflection` | `{ agent_type, cycle_id, self_score, reasoning, went_well, to_improve, next_actions[] }` | `{ id }` | セルフリフレクション結果の保存 |
| 2 | `get_recent_reflections` | `{ agent_type, limit: 5 }` | `[{ self_score, reasoning, next_actions, created_at }]` | 直近の自己振り返り取得 (次サイクル開始時に参照) |
| 3 | `save_individual_learning` | `{ agent_type, insight, category, context?, applicable_niches[]? }` | `{ id }` | 個別学習メモリへの知見保存 |
| 4 | `get_individual_learnings` | `{ agent_type, category?, limit: 20 }` | `[{ insight, category, times_applied, last_applied_at }]` | 自分の個別学習メモリ取得 |
| 5 | `peek_other_agent_learnings` | `{ target_agent_type, category?, limit: 10 }` | `[{ insight, category, agent_type }]` | 他エージェントの個別学習メモリ参照 |
| 6 | `submit_agent_message` | `{ agent_type, message_type, content, priority? }` | `{ id }` | 人間への自発的メッセージ送信 |
| 7 | `get_human_responses` | `{ agent_type }` | `[{ message_id, response_content, responded_at }]` | 人間からの返信確認 |
| 8 | `mark_learning_applied` | `{ learning_id }` | `{ success }` | 個別学習メモリの知見を使用した記録 |

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
│ 最新の市場データ   │     get_recent_reflections ← 前回振り返り読込
│ を収集・整理      │     get_individual_learnings ← 個別学習読込
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
│                  │
│ ※差戻し時は       │     state.approval.feedback を参照し
│  同じ問題を繰返さない│     rejection_category で戻り先が決定
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     MCPツール:
│ select_tools      │     get_tool_knowledge
│                  │     search_similar_tool_usage
│ ツールスペシャ    │     get_tool_recommendations
│ リスト (Sonnet)  │     save_tool_experience
│                  │     get_individual_learnings
│ 制作レシピ設計    │     update_tool_knowledge_from_external
│ 各コンテンツに    │
│ 最適ツール割当    │
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
    │         └──→ plan_content
    ▼               ノードに戻る
┌──────────────────┐  (ループ)
│ reflect_all      │
│                  │  MCPツール:
│ 全エージェント    │  save_reflection
│ (各自のLLM)      │  save_individual_learning
│                  │  submit_agent_message
│ セルフリフレク     │  get_recent_reflections
│ ション実行       │
│ 個別学習記録     │
│ 人間への報告     │
└────────┬─────────┘
         │
         ▼
┌────────┐
│  END   │
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

  // 制作レシピ (select_toolsノード出力)
  tool_recipes: ToolRecipe[];

  // 承認結果 (approve_planノード出力)
  approval: {
    status: 'approved' | 'rejected';
    feedback?: string;
    rejection_category?: 'plan_revision' | 'data_insufficient' | 'hypothesis_weak';
        // plan_revision: 計画修正 → プランナーに戻る (デフォルト)
        // data_insufficient: データ不足 → リサーチャーに戻る
        // hypothesis_weak: 仮説が弱い → アナリストに戻る
    revision_count: number; // 差戻し回数 (最大3回)
  };

  // 人間承認結果 (human_approvalノード出力)
  human_approval: {
    status: 'approved' | 'rejected';
    feedback?: string; // 差戻し時のフィードバック
    rejection_category?: 'plan_revision' | 'data_insufficient' | 'hypothesis_weak';
  };

  // システム設定
  config: {
    REQUIRE_HUMAN_APPROVAL: boolean; // true=初期フェーズ (人間承認必須)
  };

  // セルフリフレクション (reflect_allノード出力)
  reflections: AgentReflection[];

  // エラー情報
  errors: AgentError[];
}

interface AgentReflection {
  agent_type: 'strategist' | 'researcher' | 'analyst' | 'tool_specialist' | 'planner';
  self_score: number; // 1-10
  reasoning: string;
  went_well: string[];
  to_improve: string[];
  next_actions: string[];
}

interface ContentPlan {
  content_id: string;
  hypothesis_id: number;
  character_id: string;
  content_format: 'short_video' | 'text_post' | 'image_post'; // ワーカー振分の決定要素
  script_language: 'en' | 'jp';
  planned_post_date: string; // YYYY-MM-DD
  sections: Array<{
    section_order: number;
    section_label: string;
    component_id: string;
    script?: string;
  }>;
}

interface ToolRecipe {
  content_id: string;
  video_gen: string;        // 'kling' | 'runway' | 'pika' | 'sora'
  tts: string;              // 'fish_audio' | 'elevenlabs'
  lipsync: string;          // 'sync_lipsync' | 'hedra'
  concat: string;           // 'ffmpeg' (現時点で固定)
  rationale: string;        // ツールスペシャリストの選定理由
  parameters?: Record<string, unknown>; // ツール固有のパラメータ推奨
}

interface ResourceAllocation {
  cluster: string;
  content_count: number;
  budget_usd: number;
}
```

#### エッジ定義

```typescript
// 人間承認ノード
// content.status = 'pending_approval' に設定し、
// ダッシュボードからの承認を待機する (interrupt)
const humanApprovalNode = async (state) => {
  // LangGraphのinterrupt機能で人間の応答を待つ
  // ダッシュボードから approve/reject + feedback が送られる
  const decision = await interrupt({
    type: "human_approval",
    content_ids: state.planned_content_ids,
    summary: state.plan_summary
  });
  return { human_approval: decision };
};

const strategyCycleGraph = new StateGraph<StrategyCycleState>()
  .addNode("collect_intel", collectIntelNode)
  .addNode("analyze_cycle", analyzeCycleNode)
  .addNode("set_strategy", setStrategyNode)
  .addNode("plan_content", planContentNode)
  .addNode("select_tools", selectToolsNode) // ツールスペシャリストによる制作レシピ設計
  .addNode("approve_plan", approvePlanNode)
  .addNode("human_approval", humanApprovalNode) // 人間承認ノード
  .addNode("reflect_all", reflectAllNode) // セルフリフレクション (セクション10参照)

  // エッジ定義
  .addEdge(START, "collect_intel")
  .addEdge("collect_intel", "analyze_cycle")
  .addEdge("analyze_cycle", "set_strategy")
  .addEdge("set_strategy", "plan_content")
  .addEdge("plan_content", "select_tools")
  .addEdge("select_tools", "approve_plan")

  // 条件分岐: 承認 or 差戻し
  .addConditionalEdges("approve_plan", (state) => {
    if (state.approval.status === 'approved') {
      if (state.config.REQUIRE_HUMAN_APPROVAL) {
        return "human_approval"; // 人間承認ステップへ
      }
      return "reflect_all"; // 人間承認不要 → 直接リフレクション
    }
    if (state.approval.revision_count >= 3) {
      // 3回差戻しでも解決しない場合は強制承認
      return "reflect_all";
    }
    // 差戻しカテゴリに応じたルーティング
    switch (state.approval.rejection_category) {
      case 'data_insufficient':
        return "collect_intel"; // リサーチャーに戻る
      case 'hypothesis_weak':
        return "analyze_cycle"; // アナリストに戻る
      default: // 'plan_revision' or undefined
        return "plan_content"; // プランナーに戻る
    }
  })

  // 人間承認の結果で分岐
  .addConditionalEdges("human_approval", (state) => {
    if (state.human_approval.status === 'approved') {
      return "reflect_all";
    }
    // 人間差戻しもカテゴリに応じたルーティング
    switch (state.human_approval.rejection_category) {
      case 'data_insufficient':
        return "collect_intel"; // リサーチャーに戻る
      case 'hypothesis_weak':
        return "analyze_cycle"; // アナリストに戻る
      default: // 'plan_revision' or undefined
        return "plan_content"; // プランナーに戻る (フィードバック付き)
    }
  })

  // リフレクション完了後にサイクル終了
  .addEdge("reflect_all", END);
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
| 人間承認待ち | human_approval | キューに蓄積。人間が確認可能な時にダッシュボードで承認/差戻 (タイムアウトなし) |

### 5.2 グラフ2: 制作パイプライングラフ (Production Pipeline Graph)

**実行頻度**: 連続 (30秒ポーリング)
**参加エージェント**: 動画制作ワーカー (コード、LLMなし) + テキスト制作ワーカー (LLM)
**目的**: `planned` ステータスのコンテンツを検出し、`content_format` に応じて適切なワーカーにディスパッチする

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
│                  │     get_component_data (xN)
│ キャラクター情報   │     update_content_status
│ コンポーネントデータ│       → status='producing'
│ を取得            │
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│ dispatch              │
│                      │
│ content_format で分岐 │
│ (short_video /       │
│  text_post /          │
│  image_post)          │
└────────┬─────────────┘
         │
    ┌────┴──────────────────┐──────────────┐
    │                       │              │
  short_video            text_post     image_post
    │                       │          (将来拡張)
    ▼                       ▼
┌─────────────────────────────────────────────┐  ┌──────────────────────────┐
│ generate_video (動画制作ワーカー)              │  │ generate_text             │
│                                             │  │ (テキスト制作ワーカー)     │
│ recipe_id → production_recipes.steps 取得    │  │                          │
│ レシピに基づきツールを選択して実行              │  │ LLM (Sonnet) による       │
│                                             │  │ テキスト生成              │
│  ┌────────────────────────────────────────┐ │  │                          │
│  │ Promise.all (Nセクション並列)           │ │  │ 入力:                    │
│  │                                        │ │  │  ・シナリオ component     │
│  │  ┌────────────┐ ┌────────────┐  ...   │ │  │  ・characters.personality │
│  │  │ Section 1  │ │ Section 2  │        │ │  │    (traits, speaking_style│
│  │  │            │ │            │        │ │  │     catchphrase 等)      │
│  │  │ [動画Gen]┐ │ │ [動画Gen]┐ │        │ │  │  ・プラットフォーム制約   │
│  │  │ [TTS] ──┤ │ │ [TTS] ──┤ │        │ │  │                          │
│  │  │         ▼ │ │         ▼ │        │ │  │ 出力:                    │
│  │  │ [Lipsync]  │ │ [Lipsync]  │        │ │  │  → content_sections.script│
│  │  └────────────┘ └────────────┘        │ │  │  → 自己スコアリング       │
│  │  ※ ツール名はレシピで指定               │ │  │    (キャラ一貫性,         │
│  │  ※ セクション数はcontent_sections で定義│ │  │     エンゲージメント予測)  │
│  └────────────────────────────────────────┘ │  │                          │
│                       │                     │  │ MCPツール:               │
│                       ▼                     │  │  update_content_status   │
│              ffmpeg concat + blackdetect     │  │  (#10で結果書戻し)       │
│                       │                     │  └──────────┬───────────────┘
│                       ▼                     │             │
│              Google Drive保存                │             │
└────────────────────────┬────────────────────┘             │
                         │                                  │
                         └──────────────┬───────────────────┘
                                        │
                                   ┌────┴────┐
                                 成功      失敗
                                   │         │
                                   ▼         ▼
                   ┌──────────────────┐  ┌──────────────────┐
                   │ quality_check     │  │ handle_error      │
                   │                  │  │                  │
                   │ 動画: ファイルサイズ│  │ error_message記録 │
                   │   黒フレーム検出  │  │ retry_count確認  │
                   │   Drive保存確認  │  │                  │
                   │ テキスト: 文字数  │  │ リトライ可能 →    │
                   │   キャラ一貫性   │  │   task再キュー    │
                   │                  │  │ 不可 → failed    │
                   │ 合格: ready      │  │                  │
                   │ 不合格: failed   │  │                  │
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
    content_format: 'short_video' | 'text_post' | 'image_post';
    account_id: string;
    character_id: string;
    script_language: 'en' | 'jp';
    recipe_id: number | null;  // text_postの場合はnull
    sections: Array<{
      section_order: number;
      section_label: string;  // 動的 (例: "hook", "body", "cta", "intro", "summary" 等)
      component: ComponentData;
    }>;
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
    status: 'idle' | 'fetching' | 'dispatching' | 'generating' | 'quality_check' | 'error';
    sections: Record<string, SectionResult | null>;  // 動的セクション (content_sectionsテーブルで定義)
    generated_text?: string;     // text_postの場合: 生成テキスト
    final_video_url?: string;    // short_videoの場合: 最終動画URL
    drive_folder_id?: string;
    video_drive_id?: string;
    processing_time_seconds?: number;
  };

  // エラー情報
  errors: ProductionError[];
}

// 動画制作ワーカーのセクション結果
interface SectionResult {
  request_id: string;           // 動画生成APIのリクエストID
  video_url: string;
  tts_audio_url: string;
  lipsync_video_url: string;
  processing_seconds: number;
}
```

#### チェックポイント戦略

動画制作は **12分以上** かかるため、チェックポイントが重要。テキスト制作は高速 (数秒) のためチェックポイント不要。

```
動画制作 (short_video) のチェックポイント配置:
  [1] fetch_data完了後 — キャラ情報・コンポーネント取得済み
  [2] 各セクション完了後 — 動画Gen/TTS/Lipsync結果を個別保存
  [3] ffmpeg concat完了後 — 最終動画URL
  [4] Drive保存完了後 — Drive file ID

リカバリー:
  プロセス再起動時、最後のチェックポイントから再開
  例: Section 2完了後にプロセスが落ちた場合
      → Section 1, 2 の結果はチェックポイントに保存済み
      → 残りセクションのみ再生成してconcat

テキスト制作 (text_post):
  チェックポイント不要 (LLM生成は数秒で完了、失敗時は全体再実行)
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
│                  │       publications.status → 'measured'
│ engagement_rate  │       全pub measured後 → content 'analyzed'
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
                        │ content INSERT (status='pending_approval' or 'planned')
                        │ task_queue INSERT (type='produce')
                        ▼
            ┌───────────────────────┐
            │    PostgreSQL          │
            │                       │
            │  content.status:      │
            │  pending_approval     │
            │  → planned → producing│──→ 制作パイプライン
            │  → ready              │    グラフ (連続)
            │  → analyzed           │
            │                       │
            │  publications.status: │
            │  scheduled → posted   │──→ 投稿スケジューラー
            │  → measured           │    グラフ (連続)
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
│  [Step 1] → [Step 2] → [Step 3] → [Step 4] → [Step 4.5] → [Step 5]  │
│  戦略Agent   戦略Agent   プランナー   プランナー   ツールSP      制作ワーカー │
│  データ確認  方針決定    仮説立案    コンテンツ   ツール選択    コンテンツ生成│
│                                     計画        レシピ設計              │
│                                                                │       │
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
       hypothesis_id: 42,
       character_id: "CHR_0001",
       script_language: "jp",
       content_format: "short_video",
       sections: [
         { section_order: 1, section_label: "hook", component_id: "SCN_0101" },
         { section_order: 2, section_label: "body", component_id: "SCN_0102" },
         { section_order: 3, section_label: "cta",  component_id: "SCN_0103" }
       ]
     })
     → content INSERT (status='planned', hypothesis_id=42, content_format='short_video')
     → content_sections INSERT ×3

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

### Step 4.5: ツールスペシャリスト — ツール選択・制作レシピ設計

**実行者**: ツールスペシャリスト (Claude Sonnet 4.5)
**タイミング**: Step 4でコンテンツ計画が作成された直後

```
MCPツール呼び出し:
  1. get_tool_knowledge({ category: "video_gen" })
     → 利用可能な動画生成ツールの特性一覧

  2. search_similar_tool_usage({
       requirements: {
         character_type: "asian_female",
         niche: "beauty",
         content_type: "short_video",
         quality_priority: "face_natural"
       },
       limit: 5
     })
     → 類似要件での過去のツール使用実績

  3. get_tool_recommendations({
       content_requirements: {
         character_id: "CHR_0001",
         niche: "beauty",
         platform: "youtube",
         quality_target: 0.8
       }
     })
     → {
          recipe: {
            video_gen: "kling",
            tts: "fish_audio",
            lipsync: "sync_lipsync",
            concat: "ffmpeg"
          },
          rationale: "アジア人キャラ + beautyニッチではKlingの顔生成が最も自然。
                      Fish Audio + Sync Lipsyncの組み合わせは口パク精度が高い。
                      過去の成功率: 92% (25件中23件で品質基準クリア)",
          confidence: 0.92,
          alternatives: [
            { video_gen: "runway", rationale: "Klingダウン時の代替" }
          ]
        }

データフロー:
  [読み取り] tool_knowledge → ツール特性
  [読み取り] tool_experiences → 過去の使用実績
  [読み取り] agent_individual_learnings → ツールSPの個人ノート
  [書き込み] content UPDATE → recipe (制作レシピ) 設定
```

### Step 5: 制作ワーカー — コンテンツ生成

**実行者**: `content_format` に応じてディスパッチ — 動画制作ワーカー (Node.jsコード、LLMなし) / テキスト制作ワーカー (LLM)
**タイミング**: タスクキューに制作タスクが入った時点 (30秒ポーリング)

以下は `short_video` の場合の例:

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

  --- 制作レシピに基づきパイプライン実行 ---
  --- (デフォルト: v4.0 orchestrator.js) ---
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
     → publications INSERT (status='posted', posted_at, measure_after=posted_at+48h)
     → task_queue INSERT (type='measure', payload に measure_after を含める)

データフロー:
  [読み取り] task_queue → 投稿タスク取得
  [外部API] YouTube/TikTok/Instagram/X → 投稿実行
  [書き込み] publications INSERT → 投稿記録 (status='posted')
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
     → publications UPDATE (status='measured')
     → accounts UPDATE (follower_count=1250)

データフロー:
  [読み取り] task_queue → 計測タスク取得
  [外部API] YouTube/TikTok/Instagram/X Analytics API → メトリクス取得
  [書き込み] metrics INSERT → パフォーマンスデータ
  [書き込み] publications UPDATE → status: posted → measured
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

### Step 11: エージェント個別振り返り + 次サイクルへ

**実行者**: 各エージェント (自律実行) + 社長 (Claude Opus 4.6)
**タイミング**: サイクル終了直後 (各エージェントが自動実行) → 翌日の朝 (社長が次サイクル開始)

```
サイクル終了直後 — エージェント個別振り返り (セクション10参照):

  各LLMエージェントが自律的にセルフリフレクションを実行:

  [社長] 自己評価: 8/10。リソース配分が的確だった。
         改善点: 人間指示の処理が遅い。次回は最優先で処理する
         → agent_reflections INSERT

  [リサーチャー] 自己評価: 6/10。TikTokトレンドデータを見逃した。
                次回アクション: TikTokの情報ソースを先に確認する
                → agent_reflections INSERT

  [アナリスト] 自己評価: 7/10。相関分析は良かったが因果関係の検証不足。
              次回アクション: 交絡因子の確認ステップを追加する
              → agent_reflections INSERT

  [ツールSP] 自己評価: 7/10。デフォルトレシピは安定。
             改善点: 西洋人キャラでRunwayの代わりにKlingを推奨してしまった
             → agent_reflections INSERT

  [プランナーA] 自己評価: 8/10。過去の知見を適切に活用できた。
               改善点: 競合アカウントの最新投稿を参照できていなかった
               → agent_reflections INSERT

  各エージェントが個別学習メモリにも記録 (セクション11参照):
  → agent_individual_learnings INSERT (再利用可能な個人的知見)

翌朝 — 次サイクル開始:

  → Step 1 に戻る

次のサイクルで改善される点:
  ・蓄積知見が1件以上増えている (共有知見: learningsテーブル)
  ・仮説の検証結果が1件以上記録されている
  ・algorithm_performanceに新しいデータポイント
  ・プランナーは新しい知見を参照してより精度の高い仮説を生成
  ・各エージェントが自分の前回振り返りを読み込み、具体的改善を適用 ← NEW
  ・各エージェントが個別学習メモリの知見を活用 ← NEW

サイクルを重ねるごとに:
  ・hypothesis_accuracy が向上 (目標: 0.30 → 0.65 in 6ヶ月)
  ・prediction_error が減少
  ・learning_count が増加
  ・新ニッチへの展開速度が向上 (類似知見の転用)
  ・各エージェントの自己評価スコアが向上 (個別の継続改善)
  ・エージェントからの提案・報告が蓄積 (人間との協調強化)
```

### 7.2 仮説駆動サイクルのタイムライン

```
時間軸 ──────────────────────────────────────────────────────────────→

Day 0 (朝)          Day 0 (昼)        Day 2 (朝)         Day 4 (朝)         Day 5 (朝)
│                    │                  │                  │                  │
│ Step 1-4.5:        │ Step 5:          │ Step 6:          │ Step 7:          │ Step 8-11:
│ データ確認          │ 制作ワーカー       │ 投稿ワーカー       │ 計測ワーカー       │ アナリスト
│ 方針決定           │ 動画: ~12分/件    │ 投稿実行          │ メトリクス収集     │ 分析・検証
│ 仮説立案           │ テキスト: ~数秒/件 │                  │                  │ 知見抽出
│ コンテンツ計画       │ content_formatで  │                  │                  │
│ ツール選択          │ ワーカー振分      │                  │                  │
│                    │                  │                  │                  │
│ 所要: ~35分         │ 所要: ~2時間      │ 所要: ~5分        │ 所要: ~10分       │ 所要: ~15分
│ (LLM処理)          │ (API待ち)         │ (API呼び出し)     │ (API呼び出し)     │ (LLM処理)
│                    │                  │                  │                  │
▼                    ▼                  ▼                  ▼                  ▼
cycles INSERT        content UPDATE     publications       metrics INSERT     hypotheses UPDATE
hypotheses INSERT    status='ready'     INSERT             publications       analyses INSERT
content INSERT       Drive保存          status='posted'    UPDATE             learnings INSERT
status='planned'                        posted_at記録      status='measured'  algo_perf INSERT
                                        measure_after設定
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
| 4.5 | ツールスペシャリスト | `content` | UPDATE (recipe設定) |
| 5 | 制作ワーカー (動画/テキスト) | `content` | UPDATE (planned→producing→ready) |
| 6 | 投稿ワーカー | `publications`, `task_queue` | INSERT (status='posted'), INSERT (type='measure') |
| 7 | 計測ワーカー | `metrics`, `publications`, `accounts` | INSERT, UPDATE (status='measured'), UPDATE (follower_count) |
| 8 | アナリスト | (読み取りのみ) | - |
| 9 | アナリスト | `hypotheses`, `analyses` | UPDATE (verdict, confidence), INSERT |
| 10 | アナリスト | `learnings`, `algorithm_performance` | INSERT or UPDATE, INSERT |
| 11 | 各エージェント + 社長 | `agent_reflections`, `agent_individual_learnings` → Step 1に戻る | INSERT (各エージェントの振り返り・個別学習) |

## 8. プロンプトDB管理

### 8.1 背景と目的

セクション1の各エージェント定義で「System Prompt概要」として一行サマリーを示したが、実際のSystem Promptは数百行に及ぶ詳細な指示ドキュメントとなる。v5.0ではこのSystem Promptを **`agent_prompt_versions` テーブル** で管理し、以下のメリットを得る:

| 課題 | DB管理による解決 |
|------|------------------------|
| コード内にプロンプトが埋め込まれると変更にデプロイが必要 | DBレコード更新のみで即時反映 (次サイクルから) |
| プロンプトの変更履歴が追えない | DBの行バージョンで全変更を管理 (`changed_by`, `change_reason` カラム) |
| 非エンジニアがプロンプトを編集できない | ダッシュボードUIから誰でも編集可能 |
| エージェントの行動変更にコードレビューが必要 | プロンプト変更はコードとは独立してダッシュボードから管理 |
| A/Bテストが困難 | DBの `active` フラグでバージョン切り替え。ロールバックも容易 |

### 8.2 プロンプトの論理構成

`agent_prompt_versions` テーブルに以下のエージェント種別ごとのプロンプトが保存される:

```
agent_type 一覧:
├── strategist          # 社長 (戦略エージェント) のSystem Prompt
├── researcher          # リサーチャーのSystem Prompt
├── analyst             # アナリストのSystem Prompt
├── tool_specialist     # ツールスペシャリストのSystem Prompt (人間が経験則をチューニング)
├── planner             # プランナーのSystem Prompt (ベーステンプレート)
├── planner-beauty      # beauty ニッチ用プランナーの追加指示 (オプション)
├── planner-tech        # tech ニッチ用プランナーの追加指示 (オプション)
└── shared-principles   # 全エージェント共通の行動原則
```

**ワーカーエージェント (Layer 4) にはプロンプトを持たない**。ワーカーはLLMではなくコードで実装されるため (セクション1.6参照)、行動はコードロジックで決定される。

### 8.3 プロンプトの構造

各プロンプト (`agent_prompt_versions.prompt_text`) は以下の5セクションで構成される。

```markdown
# [エージェント名] System Prompt

## 1. 役割定義 (Role)
あなたは[役割]です。[責務の概要]。

## 2. 思考アプローチ (Thinking Approach)
意思決定の際は以下の順序で考えてください:
1. データに基づく現状把握
2. 過去の知見との照合
3. 仮説の組み立て
4. リスクの評価
5. 最終判断

## 3. 判断基準 (Decision Criteria)
### 優先順位
- 第一: [最重要な判断基準]
- 第二: [次に重要な判断基準]
- ...

### やってはいけないこと
- [禁止事項1]
- [禁止事項2]

## 4. ドメイン知識 (Domain Knowledge)
### [カテゴリ1]
- [知識1]
- [知識2]

### [カテゴリ2]
- [知識3]

## 5. 制約 (Constraints)
- コスト上限: [制約]
- 品質基準: [制約]
- タイミング制約: [制約]
```

### 8.4 具体例: strategist (抜粋)

```markdown
# 戦略エージェント (社長) System Prompt

## 1. 役割定義
あなたはAI-Influencerシステムの戦略責任者です。全アカウントの
KPIを俯瞰し、ポートフォリオレベルの意思決定を行います。

## 2. 思考アプローチ
意思決定の際は以下の順序で考えてください:
1. KPIダッシュボードで全体状況を把握する
2. アルゴリズム精度推移 (algorithm_performance) を確認する
3. アナリストの分析報告を読み、仮説の的中/外れの傾向を理解する
4. リサーチャーの市場動向レポートを確認する
5. 人間からの未処理指示 (human_directives) を確認する
6. 上記を総合して今サイクルの方針を決定する

## 3. 判断基準
### リソース配分の優先順位
- 第一: 仮説的中率が高いニッチに多くのリソースを配分する
- 第二: 成長率が高い (フォロワー増加率) ニッチを優先する
- 第三: 新ニッチ開拓には全体の20%以下のリソースを割り当てる

### やってはいけないこと
- データ不足のままの大規模投資判断
- 1サイクルの結果だけで方針を大きく変更すること
- human_directivesを無視すること

## 4. ドメイン知識
### エンゲージメント率の目安
- 優秀: > 5%
- 良好: 3〜5%
- 平均: 1〜3%
- 要改善: < 1%

### プラットフォーム別の特性
- TikTok: 新規リーチが強い。トレンド依存度高。初速が重要
- YouTube Shorts: 検索流入あり。長期的なview蓄積
- Instagram Reels: フォロワーへのリーチが安定。保存率が重要指標

## 5. 制約
- 1サイクルあたりのfal.ai予算上限: $100 (超過時はプランナーに減産指示)
- 最低3サイクル分のデータがないニッチの仮説は confidence=0.3以下で扱う
- human_directivesのurgent指示は他の判断に優先して即時反映する
```

### 8.5 LangGraphでの読み込み

プロンプトはLangGraphのグラフ初期化時にMCPツール経由でDBから読み込まれ、各エージェントノードのSystem Promptとして設定される。

```typescript
// prompts/loader.ts — プロンプトのDB読み込み

interface AgentPrompt {
  role: string;           // agent_type (例: 'strategist')
  nicheOverride?: string; // プランナーの場合のニッチ名 (例: 'beauty')
}

export async function loadPrompt(agent: AgentPrompt): Promise<string> {
  // 共通原則を読み込み (agent_type = 'shared-principles', active = true)
  const shared = await mcpClient.call('get_active_prompt', {
    agent_type: 'shared-principles'
  });

  // エージェント固有のプロンプトを読み込み (active = true のバージョン)
  const agentPrompt = await mcpClient.call('get_active_prompt', {
    agent_type: agent.role
  });

  // プランナーの場合、ニッチ別追加指示を結合
  let nicheOverride = '';
  if (agent.nicheOverride) {
    try {
      const override = await mcpClient.call('get_active_prompt', {
        agent_type: `planner-${agent.nicheOverride}`
      });
      nicheOverride = override.prompt_content;
    } catch {
      // ニッチ別プロンプトが存在しなければスキップ
    }
  }

  return [shared.prompt_content, agentPrompt.prompt_content, nicheOverride]
    .filter(Boolean).join('\n\n---\n\n');
}

// 使用例: 戦略サイクルグラフでの利用
// const strategistPrompt = await loadPrompt({ role: 'strategist' });
// const researcherPrompt = await loadPrompt({ role: 'researcher' });
// const plannerPrompt = await loadPrompt({
//   role: 'planner', nicheOverride: 'beauty'
// });
```

**重要**: プロンプトはグラフ初期化時 (= サイクル開始時) にDBから読み込まれる。サイクル途中でダッシュボードからプロンプトを編集しても、その変更は **次のサイクルから** 反映される。これにより、サイクル内の一貫性が保たれる。

### 8.6 バージョン管理とロールバック

プロンプトは `agent_prompt_versions` テーブルでバージョン管理される。`active = true` のレコードが現在有効なバージョンとなる。

```
変更フロー:
  1. ダッシュボードのプロンプト編集UIで内容を編集
  2. 差分プレビューでBefore/Afterを確認
  3. 保存 → agent_prompt_versionsに新行INSERT (active=true)
     → 旧バージョンのactive=falseに更新
  4. 次サイクルから反映

ロールバック:
  1. ダッシュボードの変更履歴から対象バージョンを選択
  2. 「このバージョンに戻す」を実行
     → 対象バージョンのactive=trueに更新
     → 現在バージョンのactive=falseに更新
  3. 次サイクルから反映
```

**変更追跡カラム**: 各バージョンには `changed_by` (変更者)、`change_reason` (変更理由)、`performance_snapshot` (変更時点のパフォーマンス指標) が記録される。これにより、どの変更がパフォーマンスに影響したかを後から分析可能。

## 9. 人間によるエージェントチューニング

### 9.1 なぜチューニングが不可欠なのか

LLMエージェントの行動は、大きく3つの要素で決まる:

```
エージェントの行動 = LLMの基盤能力 × System Prompt × 入力データ
                     (固定)           (チューニング対象) (自動収集)
```

LLMのパラメータ自体はファインチューニングしない。つまり、**System Prompt (= `agent_prompt_versions` テーブルで管理) がエージェントの行動を形作る唯一のチューナブルな要素** である。入力データは自動収集されるが、データの解釈方法・判断基準・優先順位はすべてプロンプトで定義される。

特に初期フェーズ (Phase 2〜3) では:

| 課題 | 詳細 |
|------|------|
| データ不足 | 蓄積知見が少ないため、プロンプトで補う必要がある |
| 市場理解の不足 | エージェントはドメイン知識が浅い。人間が教育する必要がある |
| 判断基準の未定義 | 「何をもって良いコンテンツとするか」の基準が曖昧 |
| 予測精度の低さ | 仮説的中率30%前後。プロンプトの改善で50%以上に引き上げる |

### 9.2 チューニングワークフロー

人間がエージェントの行動を観察し、プロンプトを改善する継続的なサイクル。

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ① 観察: ダッシュボードでエージェントの思考ログを確認                   │
│     │                                                               │
│     │  ┌─────────────────────────────────────────┐                  │
│     │  │ 思考ログ例 (戦略サイクルグラフの出力):      │                  │
│     │  │                                          │                  │
│     │  │ [社長] KPI確認完了。全体view数は前週比-5%  │                  │
│     │  │ [社長] beautyニッチが好調 (+12%), tech低迷  │                  │
│     │  │ [社長] 方針: beautyに70%リソース配分         │                  │
│     │  │ [プランナーA] 仮説: 朝投稿でview +20%       │                  │
│     │  │ [プランナーA] 根拠: market_intel #234       │                  │
│     │  │ [リサーチャー] 調査対象: 美容トレンド全般     │                  │
│     │  └─────────────────────────────────────────┘                  │
│     │                                                               │
│     ▼                                                               │
│  ② 問題の特定                                                        │
│     │  「リサーチャーの調査範囲が広すぎる。                              │
│     │   ニッチ別に深く掘るべきなのに、浅く広い情報しか取れていない」      │
│     │                                                               │
│     ▼                                                               │
│  ③ プロンプト編集                                                     │
│     │  researcher.md の「思考アプローチ」セクションを修正:               │
│     │  - Before: 「各ニッチのトレンドを幅広く調査してください」          │
│     │  - After:  「最も注力すべきニッチ (社長の方針を参照) に絞り、       │
│     │             競合アカウント3〜5件の直近10投稿を深掘り分析して        │
│     │             ください。広く浅い調査より、狭く深い調査を優先」        │
│     │                                                               │
│     ▼                                                               │
│  ④ 反映 (次サイクルから自動適用)                                       │
│     │                                                               │
│     ▼                                                               │
│  ⑤ 効果測定: Before/After比較                                        │
│     │  - Before: market_intel のrelevance_score平均 0.45              │
│     │  - After:  market_intel のrelevance_score平均 0.72              │
│     │  - 結論: 調査品質が向上。この変更を維持する                        │
│     │                                                               │
│     ▼                                                               │
│  ① に戻る (継続的改善)                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 チューニング対象と典型的な改善例

| エージェント | よくある問題 | プロンプト改善例 |
|------------|-----------|----------------|
| **社長** | リソース配分が保守的すぎる | 判断基準に「成長率が高いニッチには積極的に配分」を追加 |
| **社長** | human_directivesの反映が不十分 | 「人間の指示は最優先で計画に組み込む」を強調 |
| **リサーチャー** | 調査範囲が広すぎて浅い | 「注力ニッチに絞って深掘りする」方針に変更 |
| **リサーチャー** | 古い情報を拾ってくる | 「直近7日以内のデータを優先」制約を追加 |
| **アナリスト** | データ不足でも強気の結論を出す | 「サンプル数30未満は 'inconclusive' と明示」を追加 |
| **アナリスト** | 知見の粒度が粗い | 「actionableな知見のみ抽出。"〇〇すべき" の形式で」を追加 |
| **プランナー** | 投稿時間の考慮不足 | 「投稿時間は過去の知見を必ず参照して決定する」を追加 |
| **プランナー** | 同じ仮説の繰り返し | 「過去に検証済みの仮説と類似するものは避ける」制約を追加 |

### 9.4 チューニング頻度の目安

プロンプトチューニングの頻度はフェーズに応じて変化する。

```
頻度
  │
高 │  ■■■■
  │  ■■■■
  │  ■■■■
  │  ■■■■  ■■■
  │  ■■■■  ■■■
  │  ■■■■  ■■■
  │  ■■■■  ■■■  ■■
  │  ■■■■  ■■■  ■■
  │  ■■■■  ■■■  ■■  ■
低 │──────────────────────
   Phase2-3  Phase4  Phase5  Phase6
   (初期)   (中期)  (後期)  (安定期)
```

| フェーズ | チューニング頻度 | 焦点 |
|---------|---------------|------|
| **Phase 2〜3** (〜50アカウント) | 日次〜週次 | 基本的な判断基準の確立。「何が良いコンテンツか」の教育 |
| **Phase 4** (〜500アカウント) | 週次〜隔週 | ニッチ別の微調整。プランナーのニッチ特化プロンプトの整備 |
| **Phase 5** (〜1,500アカウント) | 月次 | 大きな方針変更時のみ。安定した判断基準の維持 |
| **Phase 6** (3,500アカウント〜) | 必要時のみ | プラットフォーム変更やビジネス方針転換時の対応 |

### 9.5 ダッシュボードからのプロンプト編集

プロンプトは `agent_prompt_versions` テーブルで管理され、ダッシュボードから直接編集できるUIを提供する。

```
┌────────────────────────────────────────────────────────────┐
│ ダッシュボード > エージェント管理 > プロンプト編集            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  エージェント: [▼ リサーチャー ]                             │
│                                                            │
│  現在のバージョン: v12 (active)                              │
│  最終更新: 2026-02-15 14:30 by pochi                       │
│  変更理由: 調査範囲を注力ニッチに限定                        │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ # リサーチャー System Prompt                          │  │
│  │                                                      │  │
│  │ ## 1. 役割定義                                        │  │
│  │ あなたは市場調査の専門家です。                          │  │
│  │ ...                                                  │  │
│  │                                                      │  │
│  │ ## 2. 思考アプローチ                                   │  │
│  │ 最も注力すべきニッチに絞り、競合アカウント3〜5件の       │  │
│  │ 直近10投稿を深掘り分析してください。                     │  │
│  │ ...                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [差分プレビュー]  [保存 (新バージョン)]  [キャンセル]        │
│                                                            │
│  ─────────────────────────────────────────────────────     │
│  変更履歴 (最近5件):                                        │
│  v12  調査範囲を注力ニッチに限定         02-15 14:30  pochi  │
│  v11  季節性トレンド調査を追加            02-12 09:15  pochi  │
│  v10  初期プロンプト作成                  02-10 11:00  pochi  │
│                     [v11に戻す] [v10に戻す]                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**実装方式**: ダッシュボードから `agent_prompt_versions` テーブルに新バージョンを保存する。保存時に新行を `active=true` でINSERTし、旧バージョンを `active=false` に更新。差分プレビュー機能でBefore/Afterを確認してから保存できる。ロールバック時は対象バージョンの `active` フラグを切り替える。

### 9.6 human_directives (一時的指示) とプロンプトチューニング (永続的変更) の使い分け

セクション4.9で定義した `submit_human_directive` ツールと、本セクションのプロンプトチューニングは **目的が異なる**。混同しないよう明確に区別する。

| 観点 | human_directives (DB) | プロンプトチューニング (DB) |
|------|----------------------|-------------------------------|
| **性質** | 一時的な戦術指示 | 永続的な行動変更 |
| **保存先** | PostgreSQL `human_directives` テーブル | PostgreSQL `agent_prompt_versions` テーブル |
| **有効期間** | 1サイクル (処理されたら `applied` に遷移) | 次の変更まで恒久的に有効 (`active=true` のバージョン) |
| **対象** | 特定アカウント/ニッチへの指示 | エージェント全体の行動パターン |
| **例** | 「今週はbeautyニッチに集中してtechは停止」 | 「エンゲージメント率をview数より常に優先して判断する」 |
| **例** | 「このURLの動画を参考にして」 | 「仮説立案時は必ず過去の類似仮説3件を参照する」 |
| **例** | 「ACC_0013のコンテンツ量を倍にして」 | 「データ不足の場合は必ず 'inconclusive' と判定する」 |
| **操作者** | ダッシュボードの指示フォーム | ダッシュボードのプロンプト編集UI |
| **反映タイミング** | 次のサイクル開始時 (社長が読み取り) | 次のグラフ初期化時 (セクション8.5参照) |

**判断基準**: 「この指示は今後も常に適用すべきか?」と問う。

- **Yes** → プロンプトに追記する (agent_prompt_versionsで永続的な行動変更)
- **No** → human_directivesとして投入する (一時的な指示)

```
具体例:

  ユースケース1: 「バレンタインに合わせたコンテンツを作って」
    → human_directives (一時的なイベント対応)

  ユースケース2: 「仮説立案時は季節イベントを常に考慮して」
    → プロンプト変更 (恒久的な思考パターンの追加)

  ユースケース3: 「ACC_0015のフォロワーが急減。原因調査して」
    → human_directives (特定アカウントへの一時的指示)

  ユースケース4: 「フォロワー急減時は投稿を一時停止し原因分析を優先」
    → プロンプト変更 (恒久的な判断ルールの追加)

  ユースケース5: 「アナリストがサンプル数3で仮説確認しているが最低10必要」
    → human_directives (directive_type='learning_guidance')
    → 学習方法そのものへの指導。エージェントのリフレクション方法を軌道修正
```

**`directive_type` の全種類**:

| directive_type | 用途 | 処理タイミング |
|---|---|---|
| `hypothesis` | 仮説の投入 | 社長がサイクル開始時に読み取り |
| `reference_content` | 参考コンテンツの指定 | 社長がサイクル開始時に読み取り |
| `instruction` | 一般的な指示 | 社長がサイクル開始時に読み取り |
| `learning_guidance` | 学習方法の指導 | 各エージェントがサイクル開始時に `get_learning_directives` で読み取り |
| `agent_response` | エージェントの相談・報告への返信 | 各エージェントが `get_human_responses` で読み取り |

## 10. エージェント個別振り返り（セルフリフレクション）

### 10.1 設計思想

v5.0の各AIエージェントは「会社の社員」として振る舞う。人間の優秀な社員が自分の仕事を振り返り、次回の改善点を自分でメモし、次の仕事に活かすように、AIエージェントも **毎サイクル自律的に自分の仕事を振り返る**。

この仕組みの核心は「人間が介入しなくても、エージェントが自分で改善する」という点にある。セクション9で定義した「人間によるプロンプトチューニング」は外部からの改善であり、本セクションの「セルフリフレクション」は内部からの改善である。両方が機能することで、改善速度が飛躍的に向上する。

```
改善の2チャネル:

  外部改善 (セクション9):                    内部改善 (セクション10):
  ┌─────────────────────────┐            ┌─────────────────────────┐
  │ 人間がエージェントの行動を │            │ エージェント自身が        │
  │ 観察し、プロンプトを修正   │            │ 自分の仕事を振り返り、     │
  │                         │            │ 次回の改善点を記録        │
  │ 頻度: 週次〜月次          │            │                         │
  │ 改善粒度: 大きな方針変更   │            │ 頻度: 毎サイクル (日次)   │
  │ 例: 「深掘り分析を優先」   │            │ 改善粒度: 小さな戦術改善   │
  └─────────────────────────┘            │ 例: 「次回はTikTokデータ  │
                                         │      を先に確認する」     │
                                         └─────────────────────────┘

  両方が機能 → 高頻度の個別最適化 + 低頻度の構造改善 = 最速の改善サイクル
```

### 10.2 リフレクションメカニズム

各LLMエージェントのLangGraphグラフに `reflect` ノードを追加する。このノードはメインタスク完了後に自動実行され、人間の指示なしに自律的に振り返りを行う。

#### ノードフロー

```
通常サイクル:
  [load_recent_reflections] → [load_learning_directives] → [main_task] → [reflect] → [save_reflection] → [end]
         │                           │                            │
         │  前回の振り返りを           │  人間からの学習方法        │  今回の仕事を自己評価
         │  読み込み                   │  指導を確認                │  良かった点・改善点を
         │  「前回の改善点」を         │  リフレクション方法に      │  構造化して記録
         │  今回のタスクに適用         │  反映する                  │
         │                           │                            │
         └──────── 継続改善ループ ─────┴────────────────────────────┘

次サイクル:
  [load_recent_reflections] → [load_learning_directives] → [main_task] → ...
         │                           │
         │  前回のreflectで記録した    │  get_learning_directives で
         │  「次回への具体的アクション」│  人間からの学習方法指導を確認し、
         │  を今回のコンテキストに注入 │  自分のリフレクション方法に反映する
```

エージェントは毎サイクル開始時に `get_learning_directives` で人間からの学習方法指導を確認し、自分のリフレクション方法に反映する。初期フェーズでは人間が各エージェントの学習方法を確認し「その学習方法だと良くない、ここをこのように学習した方が良い」と軌道修正できる。成熟期では指導が不要になり、自律学習に移行する。

#### セルフリフレクションの3ステップ

各エージェントは以下の3ステップで自己振り返りを行う。

**ステップ1: 自己採点 (Self-scoring)**

1〜10のスケールで自分の仕事を評価し、その理由を明記する。

```
エージェント別の自己採点例:

[社長 (Strategist)]
  自己評価: 7/10
  理由: 「リソース配分は前回の知見を活かして適切にできた。
        ただし、人間からのurgent指示の処理が遅れ、
        1サイクル分の遅延が生じた」

[リサーチャー (Researcher)]
  自己評価: 6/10
  理由: 「主要3ソース (Google Trends, 競合5アカウント, プラットフォーム公式)
        はカバーしたが、TikTokの直近トレンドデータを見逃した。
        beautyニッチの情報深度は十分だが、techニッチが浅い」

[アナリスト (Analyst)]
  自己評価: 7/10
  理由: 「仮説検証5件中4件の判定は適切だった。
        ただし、H-052の判定で因果関係の検証が不十分で、
        相関のみで 'confirmed' と判定してしまった。
        交絡因子の確認ステップが必要」

[プランナー (Planner)]
  自己評価: 8/10
  理由: 「過去の高スコア仮説パターンを適切に参照し、
        5件中4件が予測KPIの±15%以内だった。
        改善余地: 競合アカウントの最新投稿を参照し切れていない」
```

**ステップ2: 構造化振り返り (Structured Reflection)**

```
┌───────────────────────────────────────────────────┐
│ 振り返りの構造化フォーマット                         │
├───────────────────────────────────────────────────┤
│                                                   │
│  1. 良かった点 (went_well):                        │
│     ・具体的に何がうまくいったか                     │
│     ・どの判断/行動が効果的だったか                  │
│                                                   │
│  2. 改善点 (to_improve):                           │
│     ・何がうまくいかなかったか                       │
│     ・どこで判断を誤ったか                          │
│     ・どの情報が不足していたか                       │
│                                                   │
│  3. 次回への具体的アクション (next_actions):          │
│     ・次のサイクルで具体的に何を変えるか              │
│     ・「〇〇する」の形式で記述                       │
│     ・測定可能な形にする                             │
│                                                   │
└───────────────────────────────────────────────────┘
```

各エージェント別の具体例:

```
[社長 (Strategist)]
  良かった点:
    ・beautyニッチへの70%リソース配分が的中。全体engagement +12%
    ・前サイクルの知見 "朝投稿有効" を全クラスターに即時展開できた

  改善点:
    ・human_directivesの「techニッチ一時停止」指示をStep 2で処理すべきだったが
      Step 4の承認段階で初めて反映した (1ステップ遅い)
    ・プランナーBへの方針指示が曖昧で、差戻しが2回発生した

  次回への具体的アクション:
    ・「Step 2の最初にhuman_directives (priority=urgent) を確認する」
    ・「プランナーへの方針指示に、具体的な数値目標を必ず含める」

[リサーチャー (Researcher)]
  良かった点:
    ・Google Trendsの"glass skin"トレンド上昇を24時間以内に検出
    ・競合アカウント5件の分析で、リアクション形式Hookの有効性を特定

  改善点:
    ・TikTok CreativeCenter のデータを確認しなかった
    ・beautyニッチに集中しすぎて、techニッチの情報がゼロだった

  次回への具体的アクション:
    ・「調査開始時にTikTok CreativeCenterを最初に確認する」
    ・「注力ニッチ以外にも最低1件のトレンドチェックを行う」
    ・「情報源チェックリストを毎回確認してから調査開始する」

[アナリスト (Analyst)]
  良かった点:
    ・仮説H-048〜H-051の検証精度が高い (4/5件正しい判定)
    ・異常値検出でACC_0015のengagement急落を発見 → 人間に報告できた

  改善点:
    ・H-052で相関関係のみで 'confirmed' と判定した (因果関係未検証)
    ・サンプルサイズ25件で分析したが、30件未満では不十分

  次回への具体的アクション:
    ・「verdict判定前に必ず交絡因子の確認ステップを入れる」
    ・「サンプルサイズ30件未満の場合は 'inconclusive' と判定する」
    ・「因果関係の検証にはA/Bテストデータを優先的に使用する」

[プランナー (Planner)]
  良かった点:
    ・learningsテーブルの知見5件を仮説に適切に組み込めた
    ・「朝7時投稿 x リアクション形式Hook」の組み合わせ仮説が的中

  改善点:
    ・競合アカウントの直近3日の投稿を参照していなかった
    ・同じ仮説パターンの繰り返しが2件あった (多様性不足)

  次回への具体的アクション:
    ・「仮説立案前にmarket_intelの直近3日データを必ず確認する」
    ・「過去5サイクル以内の類似仮説がある場合は別パターンを選択する」
```

**ステップ3: 保存と次回読み込み**

```
MCPツール呼び出し:

  1. save_reflection({
       agent_type: "researcher",
       cycle_id: 42,
       self_score: 6,
       reasoning: "主要3ソースはカバーしたがTikTokトレンドデータを見逃した",
       went_well: [
         "Google Trendsの glass skin トレンド上昇を24時間以内に検出",
         "競合アカウント5件の分析でリアクション形式Hookの有効性を特定"
       ],
       to_improve: [
         "TikTok CreativeCenterのデータを確認しなかった",
         "beautyニッチに集中しすぎてtechニッチの情報がゼロだった"
       ],
       next_actions: [
         "調査開始時にTikTok CreativeCenterを最初に確認する",
         "注力ニッチ以外にも最低1件のトレンドチェックを行う"
       ]
     })
     → agent_reflections INSERT

次サイクルの開始時:

  2. get_recent_reflections({
       agent_type: "researcher",
       limit: 3
     })
     → 直近3サイクルの振り返りを取得
     → System Promptのコンテキストに注入

     注入例:
       「前回の振り返り:
        - 自己評価: 6/10
        - 次回アクション:
          1. 調査開始時にTikTok CreativeCenterを最初に確認する
          2. 注力ニッチ以外にも最低1件のトレンドチェックを行う
        これらの改善点を今回のタスクに必ず適用してください」
```

### 10.3 `agent_reflections` テーブル設計

```sql
CREATE TABLE agent_reflections (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- エージェント情報
    agent_type      VARCHAR(20) NOT NULL,
        -- strategist / researcher / analyst / planner
    agent_instance  VARCHAR(50),
        -- プランナーの場合はインスタンス名 (例: 'planner-beauty')
        -- その他は NULL

    -- サイクル紐づけ
    cycle_id        INTEGER REFERENCES cycles(id),

    -- 自己評価
    self_score      INTEGER NOT NULL,
        -- 1〜10のスケール
        -- 1-3: 大きな問題があった
        -- 4-6: 改善の余地が大きい
        -- 7-8: 良好
        -- 9-10: 非常に良い
    reasoning       TEXT NOT NULL,
        -- 自己評価の理由 (自然言語)

    -- 構造化振り返り
    went_well       TEXT[] NOT NULL DEFAULT '{}',
        -- 良かった点の配列
    to_improve      TEXT[] NOT NULL DEFAULT '{}',
        -- 改善点の配列
    next_actions    TEXT[] NOT NULL DEFAULT '{}',
        -- 次回への具体的アクションの配列

    -- メタデータ
    task_duration_ms INTEGER,
        -- タスク実行にかかった時間 (ミリ秒)
    tools_used      TEXT[],
        -- 使用したMCPツールの一覧
    llm_tokens_used INTEGER,
        -- 消費したLLMトークン数

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_agent_reflections_type
        CHECK (agent_type IN ('strategist', 'researcher', 'analyst', 'tool_specialist', 'data_curator', 'planner')),
    CONSTRAINT chk_agent_reflections_score
        CHECK (self_score >= 1 AND self_score <= 10)
);

COMMENT ON TABLE agent_reflections IS 'エージェントのセルフリフレクション記録。毎サイクル自動生成';
COMMENT ON COLUMN agent_reflections.next_actions IS '次サイクル開始時にコンテキストとして注入される具体的改善アクション';
```

### 10.4 LangGraph `reflect_all` ノードの実装

戦略サイクルグラフの `approve_plan` ノード完了後に実行される。全参加エージェントが並列でセルフリフレクションを行う。

```typescript
async function reflectAllNode(state: StrategyCycleState): Promise<Partial<StrategyCycleState>> {
  const reflections: AgentReflection[] = [];

  // 全エージェントが並列でセルフリフレクション実行
  const reflectionTasks = [
    reflectAgent("strategist", state),
    reflectAgent("researcher", state),
    reflectAgent("analyst", state),
    reflectAgent("tool_specialist", state),
    // プランナーは複数いる場合がある
    ...state.content_plans
      .map(p => p.cluster)
      .filter((v, i, a) => a.indexOf(v) === i) // unique clusters
      .map(cluster => reflectAgent("planner", state, cluster)),
  ];

  const results = await Promise.all(reflectionTasks);
  reflections.push(...results);

  return { reflections };
}

async function reflectAgent(
  agentType: string,
  state: StrategyCycleState,
  instance?: string
): Promise<AgentReflection> {
  // 1. 前回の振り返りを読み込み (改善の連続性確認)
  const recentReflections = await mcpClient.call("get_recent_reflections", {
    agent_type: agentType,
    limit: 3,
  });

  // 2. LLMに振り返りを依頼
  const reflection = await llm.invoke([
    { role: "system", content: getReflectionPrompt(agentType) },
    { role: "user", content: JSON.stringify({
      cycle_summary: state,
      previous_reflections: recentReflections,
      instruction: "今回のサイクルの自分の仕事を振り返り、" +
        "前回の改善点が適用できたかも含めて評価してください"
    })},
  ]);

  // 3. 振り返り結果を保存
  await mcpClient.call("save_reflection", {
    agent_type: agentType,
    cycle_id: state.cycle_id,
    self_score: reflection.self_score,
    reasoning: reflection.reasoning,
    went_well: reflection.went_well,
    to_improve: reflection.to_improve,
    next_actions: reflection.next_actions,
  });

  // 4. 必要に応じて人間にメッセージ送信 (セクション12参照)
  if (shouldNotifyHuman(reflection)) {
    await mcpClient.call("submit_agent_message", {
      agent_type: agentType,
      message_type: determineMessageType(reflection),
      content: formatAgentMessage(reflection),
      priority: determinePriority(reflection),
    });
  }

  return reflection;
}
```

### 10.5 セルフリフレクションの効果測定

セルフリフレクションが実際に改善に寄与しているかを定量的に計測する。

```
計測指標:

  1. 自己評価スコアの推移
     ┌──────────────────────────────────────────────┐
     │ agent_type │ cycle_1-10 │ cycle_11-20 │ cycle_21-30 │
     ├──────────────────────────────────────────────┤
     │ strategist │   6.2      │    7.1      │    7.8      │
     │ researcher │   5.8      │    6.9      │    7.5      │
     │ analyst    │   6.5      │    7.3      │    8.0      │
     │ planner-A  │   6.0      │    7.0      │    7.6      │
     └──────────────────────────────────────────────┘

  2. next_actionsの実行率
     → 前回のnext_actionsが今回の went_well に含まれているか
     → 目標: 80%以上

  3. 同じ改善点の繰り返し検出
     → to_improve に3サイクル以上同じ項目が出る場合
     → セルフリフレクションでは解決できない構造的問題
     → 人間によるプロンプトチューニング (セクション9) が必要なサイン
     → セクション14のプロンプト変更自動提案メカニズムがアラートを発火
```

```sql
-- セルフリフレクションの改善傾向を計測するクエリ
SELECT
    agent_type,
    AVG(self_score) FILTER (WHERE cycle_id <= 10) AS avg_score_first_10,
    AVG(self_score) FILTER (WHERE cycle_id > 10 AND cycle_id <= 20) AS avg_score_11_20,
    AVG(self_score) FILTER (WHERE cycle_id > 20) AS avg_score_21_plus,
    COUNT(*) AS total_reflections
FROM agent_reflections
GROUP BY agent_type
ORDER BY agent_type;
```

## 11. エージェント個別学習メモリ

### 11.1 設計思想

セクション6で説明した `learnings` テーブルは「会社の共有Wiki」に相当する。全エージェントが知見を投稿し、全エージェントが参照する。これに対して本セクションで定義する **個別学習メモリ** は「個人のノートブック」に相当する。

```
知見管理の2層構造:

  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  Layer 1: 共有知見 (learningsテーブル) — 会社のWiki               │
  │  ┌───────────────────────────────────────────────────────────┐  │
  │  │                                                           │  │
  │  │  ・全エージェントが投稿、全エージェントが参照              │  │
  │  │  ・統計的に有意な知見のみ (confidence >= 0.50)             │  │
  │  │  ・フォーマルな知見: 「beautyニッチで朝7時投稿は           │  │
  │  │    engagement_rate +20% (5件, p=0.03, confidence=0.82)」  │  │
  │  │  ・アナリストが品質管理 (confidence更新、evidence追加)      │  │
  │  │                                                           │  │
  │  └───────────────────────────────────────────────────────────┘  │
  │                                                                 │
  │  Layer 2: 個別学習メモリ (agent_individual_learningsテーブル)     │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
  │  │ 社長の    │  │ リサーチ  │  │ アナリスト │  │ プランナー │       │
  │  │ ノート    │  │ ャーの    │  │ のノート   │  │ のノート   │       │
  │  │          │  │ ノート    │  │           │  │           │       │
  │  │ ・自分    │  │ ・自分    │  │ ・自分     │  │ ・自分    │       │
  │  │  だけが   │  │  だけが   │  │  だけが    │  │  だけが   │       │
  │  │  書く     │  │  書く     │  │  書く      │  │  書く     │       │
  │  │ ・主に    │  │ ・主に    │  │ ・主に     │  │ ・主に    │       │
  │  │  自分が   │  │  自分が   │  │  自分が    │  │  自分が   │       │
  │  │  読む     │  │  読む     │  │  読む      │  │  読む     │       │
  │  │          │  │          │  │           │  │           │       │
  │  │ (他人も   │  │ (他人も   │  │ (他人も    │  │ (他人も   │       │
  │  │  覗ける)  │  │  覗ける)  │  │  覗ける)   │  │  覗ける)  │       │
  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

**共有知見と個別学習メモリの違い**:

| 観点 | 共有知見 (`learnings`) | 個別学習メモリ (`agent_individual_learnings`) |
|------|----------------------|---------------------------------------------|
| **例え** | 会社のWiki | 個人のノートブック |
| **書き込み** | 主にアナリストが投稿 | 各エージェントが自分で書く |
| **読み取り** | 全エージェントが対等に参照 | 主に本人が参照 (他人も覗ける) |
| **品質基準** | 統計的有意性が必要 (confidence >= 0.50) | 主観的でもOK。個人的な気づきレベル |
| **内容の例** | 「朝7時投稿はengagement +20% (p=0.03)」 | 「月曜朝の調査は情報が新鮮」 |
| **内容の例** | 「リアクション形式Hookは完視聴率1.8倍」 | 「Source Xはbeautyニッチのデータが不正確」 |
| **有効期間** | 恒久 (ただしconfidenceが低下すれば廃棄) | 恒久 (ただし長期未使用なら優先度低下) |
| **ベクトル検索** | あり (pgvector embedding) | なし (カテゴリ + テキスト検索) |

### 11.2 エージェント別の個別学習メモリ具体例

各エージェントが「個人ノート」に記録する内容の具体例。共有知見にはならないが、個人の業務品質を大きく向上させる知見。

```
[社長 (Strategist) の個人ノート]

  ・「リソース配分でbeautyニッチの比率を60%以上にすると、
     他ニッチの実験が不足して中長期の成長が鈍化する」
     category: resource_allocation

  ・「プランナーへの方針指示に具体的数値目標を含めないと
     差戻し率が2倍に上がる」
     category: communication

  ・「新ニッチ展開は同時に2つまでにすべき。3つ同時に試した
     サイクル15で全ニッチのパフォーマンスが低下した」
     category: strategy

  ・「human_directivesのurgent指示は即座に処理しないと
     人間の信頼を損なう。通常の処理フローより優先する」
     category: human_interaction
```

```
[リサーチャー (Researcher) の個人ノート]

  ・「Source X (特定の競合分析サイト) はbeautyニッチの
     データが2日遅れている。リアルタイム性が必要な時は
     直接プラットフォームを確認する」
     category: data_source

  ・「月曜朝の調査は週末のトレンド変化を捉えやすい。
     金曜朝の調査はウィークデイのデータが安定している」
     category: timing

  ・「競合アカウント分析は、フォロワー数より直近10投稿の
     平均view数の方が実力を正確に反映する」
     category: methodology

  ・「TikTok CreativeCenterのトレンドデータは日本と
     USで大きく異なる。リージョン設定を必ず確認する」
     category: platform_knowledge
```

```
[アナリスト (Analyst) の個人ノート]

  ・「Hookの長さとcompletion_rateの相関は、fitnessニッチでは
     beautyニッチより2倍強い。ニッチ別に分析すべき」
     category: analysis_pattern

  ・「7日分未満のメトリクスデータで分析すると、曜日効果に
     引きずられて誤った結論を導きやすい」
     category: methodology

  ・「仮説検証で 'confirmed' と判定する前に、少なくとも1つの
     反例を探すプロセスを入れると、偽陽性が30%減少する」
     category: verification

  ・「algorithm_performanceの改善率が3サイクル連続で横ばいの場合、
     データの問題ではなくプロンプトの構造的改善が必要なサイン」
     category: meta_analysis
```

```
[ツールスペシャリスト (Tool Specialist) の個人ノート]

  ・「Klingでアジア人の顔を生成する場合、character_orientationを
     'front'にすると品質が最も安定する。'side'だと不自然になることが30%ある」
     category: tool_characteristics

  ・「Fish Audio + Sync Lipsync の組み合わせは日本語の口パク精度が
     ElevenLabs + Hedra より15%高い (サンプル20件での比較)」
     category: tool_combination

  ・「Kling v2.0アップデート後、3850px超の画像が422エラーになる
     バグが修正されたが、4000px超では依然としてエラー」
     category: tool_failure_pattern

  ・「Runway Gen-3はプロンプトなしでimage-to-video生成すると
     動きが小さすぎる。'gentle movement'程度の最小プロンプトを推奨」
     category: tool_characteristics
```

```
[プランナー (Planner) の個人ノート]

  ・「Before/After形式のシナリオは、'Before'の映像が
     ネガティブ感情を明確に喚起する場合に効果が2倍になる」
     category: content_strategy

  ・「CTAで質問形式 ('あなたはどっち派?') を使うと、命令形式
     ('今すぐフォロー!') より30%エンゲージメントが高い」
     category: content_strategy

  ・「同じキャラクターで3連続投稿すると、4投目のengage率が
     15%低下する。キャラクターをローテーションすべき」
     category: scheduling

  ・「beauty niで投稿時間の最適化をしたとき、朝7-8時 (JST)
     がベストだったが、US向けアカウントでは真逆だった。
     ターゲット地域のタイムゾーンを必ず考慮する」
     category: timing
```

### 11.3 `agent_individual_learnings` テーブル設計

```sql
CREATE TABLE agent_individual_learnings (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- エージェント情報
    agent_type      VARCHAR(20) NOT NULL,
        -- strategist / researcher / analyst / planner
    agent_instance  VARCHAR(50),
        -- プランナーの場合はインスタンス名 (例: 'planner-beauty')

    -- 学習内容
    insight         TEXT NOT NULL,
        -- 個人的な気づき・知見 (自然言語)
        -- 共有learningsと違い、主観的でOK
    category        VARCHAR(30) NOT NULL,
        -- エージェント固有のカテゴリ
        -- 社長: resource_allocation, communication, strategy, human_interaction
        -- リサーチャー: data_source, timing, methodology, platform_knowledge
        -- アナリスト: analysis_pattern, methodology, verification, meta_analysis
        -- ツールSP: tool_characteristics, tool_combination, tool_failure_pattern, tool_update
        -- プランナー: content_strategy, scheduling, timing, hypothesis_pattern
    context         TEXT,
        -- この学びが得られた文脈 (例: "サイクル15でbeautyニッチを分析した際に...")

    -- 適用範囲
    applicable_niches VARCHAR(50)[],
        -- この知見が適用可能なジャンル (NULL = 汎用)

    -- 利用追跡
    times_applied   INTEGER NOT NULL DEFAULT 0,
        -- この知見を実際に適用した回数
        -- 高いほど実用的な知見
    last_applied_at TIMESTAMPTZ,
        -- 最後に適用した日時
        -- 長期間未使用の知見は優先度を下げる

    -- メタ情報
    source_reflection_id INTEGER REFERENCES agent_reflections(id),
        -- この学びの元になった振り返り (あれば)
        -- 振り返り以外のタイミングで記録される場合もある

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 制約
    CONSTRAINT chk_individual_learnings_type
        CHECK (agent_type IN ('strategist', 'researcher', 'analyst', 'tool_specialist', 'data_curator', 'planner'))
);

COMMENT ON TABLE agent_individual_learnings IS 'エージェント個別の学習メモリ。個人ノートブック相当';
COMMENT ON COLUMN agent_individual_learnings.times_applied IS '適用回数。高い値 = 実用的な知見';
COMMENT ON COLUMN agent_individual_learnings.last_applied_at IS '長期未使用の知見は読み込み優先度を下げる';
```

### 11.4 個別学習メモリのアクセスパターン

```
タスク開始時の読み込み優先順位:

  Priority 1: 自分の個別学習メモリ (直近20件)
    get_individual_learnings({ agent_type: "researcher", limit: 20 })
    → 自分のノートを確認

  Priority 2: 自分の直近振り返り (セクション10)
    get_recent_reflections({ agent_type: "researcher", limit: 3 })
    → 前回の改善アクションを確認

  Priority 3: 共有知見 (learningsテーブル)
    get_niche_learnings / search_similar_learnings
    → 会社の共有Wikiを確認

  Priority 4 (必要時のみ): 他エージェントの個別学習メモリ
    peek_other_agent_learnings({ target_agent_type: "analyst", category: "methodology" })
    → 同僚のノートを覗く (参考情報として)
```

```
書き込みタイミング:

  1. セルフリフレクション時 (セクション10のreflectノード内)
     → to_improveから再利用可能な知見を抽出して記録

  2. タスク実行中の発見
     → 「この情報源は不正確だ」と気づいた時点で即座に記録

  3. 他エージェントの知見を参照して学んだ時
     → 「アナリストのノートから分析手法のヒントを得た」を記録
```

### 11.5 個別学習メモリの知見ライフサイクル

個別学習メモリの知見は「使われるほど価値が上がり、使われなければ自然淘汰される」仕組みを持つ。

```
知見のライフサイクル:

  生成                 活用期                     昇格 or 淘汰
  ─────────────────────────────────────────────────────────────→

  [記録]               [繰り返し適用]              [共有知見へ昇格]
  times_applied=0      times_applied=5+            → learningsテーブルへ
  last_applied=今日     last_applied=今日            (十分な実績があれば)
                       「実用的な知見」
                                                  [自然淘汰]
                                                  times_applied=0
                                                  last_applied=90日前
                                                  → 読み込み対象外
                                                    (削除はしない)

  判断基準:
    ・times_applied >= 10 かつ 複数サイクルで一貫して有効
      → 共有learningsテーブルへ昇格を検討
    ・90日以上未使用
      → 読み込み優先度を最低に設定 (get_individual_learningsの結果に含まれない)
```

## 12. エージェント→人間コミュニケーション（相談・報告）

### 12.1 設計思想

セクション2.2の「(4) 外→内: 人間→社長」は人間からエージェントへの一方向通信 (`human_directives`) を定義した。本セクションでは逆方向、つまり **エージェントから人間への自発的コミュニケーション** を定義する。

```
従来の通信 (セクション2.2):

  人間 ──── human_directives ────→ 社長
                                   │
                                   ▼
                               プランナー
  (一方向: 人間→AI)

本セクションで追加:

  人間 ←── agent_communications ── 社長
       ←── agent_communications ── リサーチャー
       ←── agent_communications ── アナリスト
       ←── agent_communications ── ツールスペシャリスト
       ←── agent_communications ── データキュレーター
       ←── agent_communications ── プランナー
                                   │
                                   ▼
  人間 ──── human_directives ────→ 社長 (返信として)

  (双方向: AI→人間→AI)
```

会社の優秀な社員は、問題を一人で抱え込まず、上司に相談・報告・提案する。AIエージェントも同様に、困りごとがあれば相談し、成果が出れば報告し、改善案があれば提案する。

### 12.2 コミュニケーションの4タイプ

エージェントが人間に送信するメッセージは4タイプに分類される。

#### (1) 困りごと報告 (struggle)

エージェントが自分だけでは解決できない問題に直面した時に送信する。

```
具体例:

[リサーチャー → 人間]
  message_type: "struggle"
  priority: "normal"
  content: "TikTokのトレンドデータが3日前のものしか取得できません。
           リアルタイムデータソースがあれば調査精度が大幅に向上します。
           現状の対処: Google Trendsと競合アカウントの直接確認で代替していますが、
           TikTok固有のトレンド (サウンド、エフェクト) を見逃すリスクがあります。"

[アナリスト → 人間]
  message_type: "struggle"
  priority: "high"
  content: "ACC_0015のengagement_rateが3日間で50%低下していますが、
           原因の特定ができません。プラットフォーム側の制裁 (シャドウバン)
           の可能性がありますが、確認する手段がありません。
           人間による目視確認をお願いできますか？"

[プランナー → 人間]
  message_type: "struggle"
  priority: "normal"
  content: "fitnessニッチの利用可能なシナリオコンポーネントが3件しかなく、
           同じシナリオの再利用が続いています。新しいシナリオの追加を
           お願いできますか？"
```

#### (2) 提案 (proposal)

エージェントが自分の経験に基づいて改善案を提案する時に送信する。

```
具体例:

[アナリスト → 人間]
  message_type: "proposal"
  priority: "normal"
  content: "beautyニッチで3サイクル連続で仮説的中率60%超えを達成しました。
           この成功パターン (朝投稿 x リアクション形式Hook x 質問形式CTA)
           をfitnessニッチにも展開する価値があると考えます。
           根拠: 両ニッチのオーディエンス属性 (20-30代女性) が類似しています。"

[社長 → 人間]
  message_type: "proposal"
  priority: "normal"
  content: "techニッチのアカウント数を現在の10から15に増やすことを提案します。
           理由: 直近5サイクルでtechニッチのROIがbeautyニッチを上回っており、
           1アカウントあたりのフォロワー獲得コストが35%低いです。
           追加コスト見込み: 月$15 (fal.ai利用料増分)。"

[リサーチャー → 人間]
  message_type: "proposal"
  priority: "low"
  content: "現在の競合分析ではフォロワー数上位5アカウントを対象にしていますが、
           フォロワー数1万〜5万の成長中アカウントの方が参考になる戦略を
           使っていることが多いです。競合分析の対象基準を変更することを
           提案します。"
```

#### (3) 質問 (question)

エージェントが人間の判断を必要とする事項について質問する時に送信する。

```
具体例:

[プランナー → 人間]
  message_type: "question"
  priority: "normal"
  content: "新しいニッチ 'cooking' への展開を計画中ですが、
           このニッチの競合アカウントは手動で人間が調べた方が正確だと
           考えています。主要な競合アカウント3〜5件のリストを
           いただけますか？"

[社長 → 人間]
  message_type: "question"
  priority: "high"
  content: "beauty ニッチとfitness ニッチのリソース配分について:
           現在 beauty 70% / fitness 30% ですが、fitnessの伸びが良いため
           50% / 50% への変更を検討しています。
           beautyは安定収益源なので慎重に判断したいのですが、
           この方向性でよいでしょうか？"

[アナリスト → 人間]
  message_type: "question"
  priority: "normal"
  content: "仮説H-067 'techニッチでは夜投稿がベスト' の検証結果が
           inconclusive (サンプル不足) です。追加で10件のコンテンツを
           制作してサンプルを増やすか、現時点で仮説を棄却するか、
           どちらが望ましいですか？"
```

#### (4) 定期報告 (status_report)

各エージェントが定期的に自分の状態を報告する。セルフリフレクション (セクション10) の要約版。

```
具体例:

[リサーチャー → 人間] (週次自動送信)
  message_type: "status_report"
  priority: "low"
  content: "今週の自己評価: 7.2/10 (先週6.8から改善)
           改善点: 仮説の粒度を細かくしたことで情報の的確性が5%向上
           今週の成果:
             ・市場情報 42件収集 (先週35件)
             ・トレンド検出 8件 (うち3件がプランナーの仮説に採用)
             ・情報源カバレッジ: TikTok 95%, YouTube 90%, IG 85%
           来週の重点: techニッチの競合分析を強化"

[社長 → 人間] (日次自動送信)
  message_type: "status_report"
  priority: "low"
  content: "サイクル42完了報告:
           ・全体view数: 先週比 +8%
           ・仮説的中率: 62% (先週58%)
           ・制作完了: 15件 (目標15件 → 100%達成)
           ・投稿完了: 12件 (3件はスケジュール待ち)
           ・本日の判断: beautyニッチに65%配分、tech 20%, fitness 15%
           ・特記事項: ACC_0015のengagement急落 → アナリストに調査依頼済"
```

### 12.3 `agent_communications` テーブル設計

```sql
CREATE TABLE agent_communications (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 送信者情報
    agent_type      VARCHAR(20) NOT NULL,
        -- strategist / researcher / analyst / tool_specialist / data_curator / planner
    agent_instance  VARCHAR(50),
        -- プランナーの場合はインスタンス名

    -- メッセージ内容
    message_type    VARCHAR(20) NOT NULL,
        -- struggle: 困りごと報告
        -- proposal: 提案
        -- question: 質問
        -- status_report: 定期報告
        -- anomaly_alert: 異常検知アラート
        -- milestone: マイルストーン達成報告
    content         TEXT NOT NULL,
        -- メッセージ本文 (自然言語)
    priority        VARCHAR(10) NOT NULL DEFAULT 'normal',
        -- low: 情報共有レベル (定期報告等)
        -- normal: 通常の相談・提案
        -- high: 早めの対応が望ましい
        -- urgent: 即座の対応が必要

    -- ステータス管理
    status          VARCHAR(15) NOT NULL DEFAULT 'unread',
        -- unread: 未読
        -- read: 既読 (人間が閲覧済み)
        -- responded: 返信済み (human_directivesとして返信)
        -- archived: アーカイブ済み
    response_directive_id INTEGER REFERENCES human_directives(id),
        -- 人間の返信に対応するhuman_directivesのID (あれば)

    -- コンテキスト情報
    cycle_id        INTEGER REFERENCES cycles(id),
        -- このメッセージが関連するサイクル
    related_account_ids VARCHAR(20)[],
        -- 関連するアカウントID (あれば)
    related_hypothesis_ids INTEGER[],
        -- 関連する仮説ID (あれば)

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at         TIMESTAMPTZ,
    responded_at    TIMESTAMPTZ,

    -- 制約
    CONSTRAINT chk_agent_comms_type
        CHECK (agent_type IN ('strategist', 'researcher', 'analyst', 'tool_specialist', 'data_curator', 'planner')),
    CONSTRAINT chk_agent_comms_message_type
        CHECK (message_type IN ('struggle', 'proposal', 'question', 'status_report', 'anomaly_alert', 'milestone')),
    CONSTRAINT chk_agent_comms_priority
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT chk_agent_comms_status
        CHECK (status IN ('unread', 'read', 'responded', 'archived'))
);

COMMENT ON TABLE agent_communications IS 'エージェントから人間への自発的メッセージ。双方向コミュニケーションの基盤';
COMMENT ON COLUMN agent_communications.response_directive_id IS '人間の返信はhuman_directivesとして管理。このカラムで紐づけ';
```

### 12.4 コミュニケーションフローの全体像

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  エージェント側                         人間側 (ダッシュボード)            │
│                                                                         │
│  [タスク実行中]                                                          │
│       │                                                                 │
│       │  困りごとを検出                                                   │
│       │                                                                 │
│       ▼                                                                 │
│  submit_agent_message({                                                 │
│    agent_type: "researcher",                                            │
│    message_type: "struggle",            ┌─────────────────────────┐     │
│    content: "TikTokデータが             │ 📥 エージェントからの     │     │
│     3日前のもの...",                     │     受信トレイ            │     │
│    priority: "normal"                   │                         │     │
│  })                                     │ ● [高] ACC_0015急落報告  │     │
│       │                                │ ● [普] TikTokデータ問題  │     │
│       │  agent_communications           │ ○ [低] 週次レポート      │     │
│       │  INSERT                         │                         │     │
│       ├────────────────────────────────→│  [詳細] [返信] [既読]    │     │
│       │                                └─────────────┬───────────┘     │
│       │                                              │                  │
│       │                                   人間が返信を入力               │
│       │                                              │                  │
│       │                                              ▼                  │
│       │                                ┌──────────────────────┐        │
│       │                                │ submit_human_directive │        │
│       │                                │ ({                    │        │
│       │                                │   directive_type:     │        │
│       │  human_directives              │     "instruction",    │        │
│       │  INSERT                        │   content: "TikTok API│        │
│       │                                │     を追加検討中。     │        │
│  [次サイクル開始時]                      │     当面はGoogle       │        │
│       │                                │     Trendsで代替を"   │        │
│       ▼                                │ })                    │        │
│  get_human_responses({                 └──────────────────────┘        │
│    agent_type: "researcher"                                             │
│  })                                                                     │
│       │                                                                 │
│       │  「了解しました。Google Trendsでの代替を継続します。」              │
│       │                                                                 │
│       ▼                                                                 │
│  [タスクに反映]                                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 12.5 メッセージ送信の判断基準

エージェントは全てのサイクルでメッセージを送信するわけではない。以下の基準に基づいて「送信すべきか」を判断する。

```
送信判断ロジック (shouldNotifyHuman関数):

  ┌─────────────────────────────────────────────────┐
  │ 送信条件                           message_type  │
  ├─────────────────────────────────────────────────┤
  │                                                  │
  │ ● 自己評価が3サイクル連続で低下     → struggle    │
  │   (self_score が 3回連続で前回以下)               │
  │                                                  │
  │ ● 同じto_improveが3サイクル以上     → struggle    │
  │   続いている (構造的問題の可能性)                   │
  │                                                  │
  │ ● 異常値を検出 (KPIの急落/急伸)     → struggle    │
  │   (normal値の2σ以上の乖離)                        │
  │                                                  │
  │ ● 目標KPIを3サイクル連続達成         → proposal   │
  │   (成功パターンの横展開提案)                       │
  │                                                  │
  │ ● 新しい知見の信頼度が0.85超え       → proposal   │
  │   (高信頼知見の活用拡大提案)                       │
  │                                                  │
  │ ● 自分では判断できない二者択一       → question    │
  │   (リスクが高い意思決定)                           │
  │                                                  │
  │ ● 週次/日次の定期タイミング          → status_report│
  │   (社長: 日次、その他: 週次)                       │
  │                                                  │
  └─────────────────────────────────────────────────┘
```

```typescript
function shouldNotifyHuman(reflection: AgentReflection, history: AgentReflection[]): boolean {
  // 1. 自己評価が3サイクル連続で低下
  if (history.length >= 2) {
    const declining = history.slice(0, 2).every(
      (prev, i) => i === 0
        ? reflection.self_score <= prev.self_score
        : history[i-1].self_score <= prev.self_score
    );
    if (declining) return true;
  }

  // 2. 同じ改善点が3サイクル以上続いている
  if (history.length >= 2) {
    const recurring = reflection.to_improve.some(item =>
      history.slice(0, 2).every(prev =>
        prev.to_improve.some(prevItem => isSimilar(item, prevItem))
      )
    );
    if (recurring) return true;
  }

  // 3. 定期報告タイミング (社長: 毎サイクル、その他: 7サイクルごと)
  const reportInterval = reflection.agent_type === 'strategist' ? 1 : 7;
  if (state.cycle_number % reportInterval === 0) return true;

  return false;
}

function determineMessageType(reflection: AgentReflection): string {
  if (reflection.self_score <= 4) return "struggle";
  if (reflection.went_well.length >= 3 && reflection.self_score >= 8) return "proposal";
  return "status_report";
}
```

### 12.6 ダッシュボードの受信トレイUI

```
┌────────────────────────────────────────────────────────────────────┐
│ ダッシュボード > エージェントからのメッセージ                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  フィルタ: [▼ 全タイプ]  [▼ 全エージェント]  [▼ 未読のみ]          │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔴 高 │ アナリスト │ 困りごと │ 2026-02-17 09:15           │  │
│  │       │ ACC_0015のengagement_rateが3日間で50%低下。           │  │
│  │       │ シャドウバンの可能性あり。目視確認をお願いします        │  │
│  │       │                              [返信] [既読] [詳細]    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🟡 普 │ リサーチャー │ 困りごと │ 2026-02-17 08:30          │  │
│  │       │ TikTokのトレンドデータが3日前のものしか取得できません。 │  │
│  │       │ リアルタイムデータソースがあれば精度が向上します         │  │
│  │       │                              [返信] [既読] [詳細]    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🟡 普 │ アナリスト │ 提案 │ 2026-02-16 18:00              │  │
│  │       │ beautyニッチで3サイクル連続60%超え達成。                │  │
│  │       │ fitnessにも同戦略の展開を提案します                    │  │
│  │       │                              [返信] [既読] [詳細]    │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ ⚪ 低 │ 社長 │ 定期報告 │ 2026-02-16 10:00                │  │
│  │       │ サイクル42完了: view +8%, 的中率62%, 制作15/15件       │  │
│  │       │                              [返信] [既読] [詳細]    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ─────────────────────────────────────────────────────────────     │
│                                                                    │
│  返信パネル (リサーチャーの困りごとに返信中):                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ TikTok APIの追加を検討中です。当面はGoogle TrendsとTikTok     │  │
│  │ CreativeCenterの直接確認で代替してください。TikTok固有の       │  │
│  │ トレンド (サウンド、エフェクト) は週次で私が手動確認して       │  │
│  │ human_directivesとして投入します。                            │  │
│  │                                                              │  │
│  │                              [送信 (human_directiveとして)]   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 12.7 情報の流れの完全な双方向フロー (更新版)

セクション2.2の4方向に本セクションの通信を追加し、完全な双方向フローとなる。

| 方向 | 流れ | 具体的なデータ | DBテーブル |
|------|------|---------------|----------|
| **(1) 上→下** | 社長→プランナー→ツールSP→ワーカー | サイクル方針、制作指示、制作レシピ、投稿指示 | `cycles`, `content`, `task_queue` |
| **(2) 下→上** | ワーカー→アナリスト→社長 | 完了報告、パフォーマンスデータ、分析結果 | `metrics`, `analyses`, `algorithm_performance` |
| **(3) 横** | リサーチャー・アナリスト・ツールSP→社長・プランナー・ワーカー | 市場動向、トレンド、知見、仮説検証結果、制作レシピ | `market_intel`, `learnings`, `hypotheses`, `tool_knowledge` |
| **(4) 外→内** | 人間→社長 | 仮説投入、参考コンテンツ指定、設定変更 | `human_directives` |
| **(5) 内→外** | 全エージェント→人間 | 困りごと、提案、質問、定期報告 | `agent_communications` |
| **(6) 自己** | 各エージェント→自分 | 振り返り、個別学習メモリ | `agent_reflections`, `agent_individual_learnings` |

## 13. ツール知識学習メカニズム

### 13.1 設計思想

ツールスペシャリストは「AIツールの百科事典 + 実践経験ノート」として機能する。単なる静的な知識ではなく、実際の制作結果からのフィードバック、外部情報の定期収集、人間による経験則の教育を組み合わせた **継続学習サイクル** を回す。

```
ツール知識の3つの情報源:

  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  情報源1: 外部情報の定期収集                                         │
  │  ┌───────────────────────────────────────────────────────────┐      │
  │  │  ・AIツール関連のXアカウント投稿 (開発者、パワーユーザー)    │      │
  │  │  ・各ツール公式ドキュメントの変更                           │      │
  │  │  ・プレスリリース、ブログ記事                               │      │
  │  │  ・リサーチャーからのツール関連市場情報                      │      │
  │  │                                                           │      │
  │  │  頻度: 日次 (リサーチャーと連携)                            │      │
  │  │  保存先: tool_knowledge テーブル + MCPツール経由             │      │
  │  └───────────────────────────────────────────────────────────┘      │
  │                                                                     │
  │  情報源2: 制作経験の蓄積                                             │
  │  ┌───────────────────────────────────────────────────────────┐      │
  │  │  ・制作結果の品質評価 (品質スコア + 人間フィードバック)       │      │
  │  │  ・どのツール組み合わせが良かったか / 悪かったか             │      │
  │  │  ・失敗パターンの記録 (エラー内容、回避策)                   │      │
  │  │                                                           │      │
  │  │  頻度: 制作完了ごと                                        │      │
  │  │  保存先: tool_experiences テーブル + 個別学習メモリ          │      │
  │  └───────────────────────────────────────────────────────────┘      │
  │                                                                     │
  │  情報源3: 人間による経験則の教育                                      │
  │  ┌───────────────────────────────────────────────────────────┐      │
  │  │  ・ダッシュボードから tool_experiences テーブルへ経験則追加   │      │
  │  │    例: 「アジア人の顔はKlingが自然、西洋人はRunwayが自然」  │      │
  │  │    例: 「Fish Audio + Sync Lipsyncは日本語の口パク精度が高い」│     │
  │  │  ・手動Claude作業で得た知見のDB登録                          │      │
  │  │                                                           │      │
  │  │  頻度: 必要時 (人間判断)                                   │      │
  │  │  保存先: tool_experiences テーブル (DB管理)                 │      │
  │  └───────────────────────────────────────────────────────────┘      │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

### 13.2 学習サイクルの詳細

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ツールスペシャリスト 学習サイクル                         │
│                                                                          │
│  [Phase 1] 情報収集 ─→ [Phase 2] 制作レシピ設計 ─→ [Phase 3] 結果評価    │
│       │                     │                           │                │
│       │                     │                           │                │
│       ▼                     ▼                           ▼                │
│  外部情報スキャン        最適ツール選択            品質スコア記録          │
│  (リサーチャー連携)       レシピ生成               成功/失敗パターン       │
│       │                     │                    記録                    │
│       │                     │                           │                │
│       └─────────────────────┴───────────────────────────┘                │
│                              │                                           │
│                              ▼                                           │
│                    [Phase 4] 知識更新                                     │
│                    ・ツール知識DB更新                                      │
│                    ・個別学習メモリ更新                                    │
│                    ・推奨マトリックス更新                                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Phase 1: 情報収集** (リサーチャーと連携)

```
情報収集の対象と方法:

  1. X投稿のスキャン
     対象: AIツール開発者・パワーユーザーのXアカウント
     方法: リサーチャーが市場調査の一環として収集 → ツールSPに共有
     保存: market_intel (intel_type='tool_update') + tool_knowledge

  2. 公式ドキュメントの変更検知
     対象: Kling, Runway, Sora, Pika, Fish Audio, ElevenLabs, fal.ai 各ドキュメント
     方法: WebFetchで定期的にドキュメントページをスキャン
     検知: API仕様変更、新機能、価格変更、制限変更

  3. プレスリリース・ブログ記事
     対象: 各ツールの公式ブログ、AI関連ニュースサイト
     方法: WebSearchで「[ツール名] update」「[ツール名] new feature」等を検索
     頻度: 日次
```

**Phase 2: 制作レシピ設計** (戦略サイクル内)

```
レシピ設計のロジック:

  入力:
    ・コンテンツ要件 (キャラクター、ニッチ、プラットフォーム、品質目標)
    ・ツール知識DB (各ツールの得意/不得意/制約)
    ・過去の制作経験 (類似要件での成功実績)
    ・人間の経験則 (tool_experiences テーブル)

  処理:
    1. 要件からキーファクターを抽出
       (例: 人種、表情の重要度、動きの種類、音声言語)
    2. キーファクターに基づきツール知識DBを検索
    3. 過去の類似制作経験を参照 (search_similar_tool_usage)
    4. 最適な組み合わせをスコアリングして選択
    5. 代替レシピも1〜2件生成 (フォールバック用)

  出力:
    ・制作レシピ (ToolRecipe型)
    ・選定理由 (rationale)
    ・信頼度 (confidence)
    ・代替レシピ (alternatives)
```

**Phase 3: 結果評価**

```
制作完了後の品質評価フロー:

  制作ワーカー完了
    │
    ▼
  品質チェック (自動)
    ・ファイルサイズ検証
    ・黒フレーム検出
    ・音声同期チェック
    │
    ▼
  save_tool_experience({
    tool_combination: ["kling", "fish_audio", "sync_lipsync"],
    content_id: "CNT_202603_0001",
    quality_score: 0.85,
    notes: "口パク精度は高いが、横顔の生成がやや不自然",
    character_type: "asian_female",
    niche: "beauty"
  })
    │
    ▼
  ツールスペシャリストの個別学習メモリに記録
    → 次回の類似要件で参照
```

### 13.3 ツール知識の構造化: ツール × コンテンツタイプ × 特性マトリックス

ツールスペシャリストは以下のマトリックスを内部的に維持し、レシピ設計の根拠とする。

```
ツール推奨マトリックス (概念モデル):

                  │ アジア人 │ 西洋人  │ 動き大  │ 動き小  │ 日本語  │ 英語
  ────────────────┼─────────┼────────┼────────┼────────┼────────┼────────
  Kling           │  ★★★   │  ★★    │  ★★    │  ★★★  │  -     │  -
  Runway Gen-3    │  ★★    │  ★★★  │  ★★★  │  ★★    │  -     │  -
  Pika            │  ★★    │  ★★    │  ★★    │  ★★★  │  -     │  -
  ────────────────┼─────────┼────────┼────────┼────────┼────────┼────────
  Fish Audio      │  -      │  -     │  -     │  -     │  ★★★  │  ★★
  ElevenLabs      │  -      │  -     │  -     │  -     │  ★★    │  ★★★
  ────────────────┼─────────┼────────┼────────┼────────┼────────┼────────
  Sync Lipsync    │  ★★★   │  ★★   │  ★★    │  ★★★  │  ★★★  │  ★★
  Hedra           │  ★★    │  ★★★  │  ★★★  │  ★★    │  ★★    │  ★★★

  ★★★ = 最適  ★★ = 良好  ★ = 使用可能  - = 該当なし
```

このマトリックスは初期値を `tool_experiences` テーブルで人間がダッシュボードから設定し、制作経験の蓄積に応じて自動的に精度が向上する。

### 13.4 `tool_knowledge` テーブル設計

```sql
CREATE TABLE tool_knowledge (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- ツール情報
    tool_name       VARCHAR(50) NOT NULL,
        -- 'kling', 'runway', 'pika', 'sora', 'fish_audio', 'elevenlabs',
        -- 'sync_lipsync', 'hedra' 等
    category        VARCHAR(20) NOT NULL,
        -- 'video_gen', 'tts', 'lipsync', 'image_gen'
    version         VARCHAR(20),
        -- ツールのバージョン (例: 'v2.0', 'gen-3')

    -- 特性情報
    capabilities    JSONB NOT NULL DEFAULT '{}',
        -- { max_resolution: "3850x3850", max_duration_sec: 10, ... }
    limitations     JSONB NOT NULL DEFAULT '{}',
        -- { no_prompt_param: true, asian_face_quality: "high", ... }
    best_for        TEXT[],
        -- ["asian_face", "slow_motion", "beauty_content"]
    avoid_for       TEXT[],
        -- ["fast_action", "multiple_characters"]
    pricing         JSONB,
        -- { per_generation: 0.05, monthly_plan: 99 }

    -- 更新情報
    update_type     VARCHAR(20),
        -- 'capability', 'pricing', 'api_change', 'bug', 'new_feature'
    source_url      TEXT,
        -- 情報源URL
    last_verified   TIMESTAMPTZ,
        -- 最後に情報が検証された日時

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tool_experiences (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- 使用記録
    tool_combination TEXT[] NOT NULL,
        -- ['kling', 'fish_audio', 'sync_lipsync']
    content_id      VARCHAR(20) REFERENCES content(content_id),
    quality_score   NUMERIC(3,2) NOT NULL,
        -- 0.00〜1.00 の品質スコア
    notes           TEXT,
        -- 特記事項 (自然言語)

    -- コンテキスト
    character_type  VARCHAR(50),
        -- 'asian_female', 'western_male', etc.
    niche           VARCHAR(50),
    platform        VARCHAR(20),

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tool_knowledge IS 'AIツールの特性・制約・得意分野の知識ベース';
COMMENT ON TABLE tool_experiences IS 'ツール組み合わせの使用実績と品質評価記録';
```

## 14. プロンプト変更の自動提案メカニズム

### 14.1 設計思想

セクション9で定義した「人間によるプロンプトチューニング」は、人間が能動的にエージェントの行動を観察して改善する仕組みである。しかし、人間が常にダッシュボードを監視し続けることは現実的ではない。

本セクションでは、**システムが自動的に「プロンプト改善が必要」と判断し、人間にアラートを出す** メカニズムを定義する。

### 14.2 アラートトリガー条件

```
プロンプト改善が必要と判断される2つの条件:

  条件1: self_scoreが3サイクル連続で低下
  ──────────────────────────────────────
    cycle N:   self_score = 7
    cycle N+1: self_score = 6
    cycle N+2: self_score = 5  ← ここでアラート発火

    判定ロジック:
      score[N] > score[N+1] > score[N+2]
      → 3サイクル連続で低下 = 構造的な問題の可能性

  条件2: 同じto_improveが3回以上繰り返される
  ──────────────────────────────────────
    cycle N:   to_improve = ["TikTokデータを確認していない"]
    cycle N+3: to_improve = ["TikTokのトレンドを見逃した"]
    cycle N+7: to_improve = ["TikTok情報の収集が不足"]  ← ここでアラート発火

    判定ロジック:
      to_improveの意味的類似度が閾値以上 (isSimilar関数)
      かつ3回以上出現
      → セルフリフレクションでは解決できない構造的問題
      → プロンプトレベルの修正が必要
```

### 14.3 thought_logs分析による改善セクション提案

アラート発火時、システムはエージェントのthought_logs（思考ログ）を分析し、プロンプトのどのセクションを改善すべきかを特定する。

```
thought_logs分析のフロー:

  1. 直近10サイクル分のthought_logsを取得

  2. to_improveの繰り返しパターンを分類:
     ・判断基準の問題 → 「3. 判断基準 (Decision Criteria)」セクション
     ・情報収集の問題 → 「2. 思考アプローチ (Thinking Approach)」セクション
     ・ドメイン知識の問題 → 「4. ドメイン知識 (Domain Knowledge)」セクション
     ・制約違反の問題 → 「5. 制約 (Constraints)」セクション
     ・役割理解の問題 → 「1. 役割定義 (Role)」セクション

  3. 改善提案を生成:
     ・問題のカテゴリ
     ・影響を受けているプロンプトセクション
     ・具体的な改善案 (可能であれば)
     ・改善の優先度
```

### 14.4 ダッシュボードの「推奨改善」セクション

```
┌────────────────────────────────────────────────────────────────────┐
│ ダッシュボード > エージェント管理 > 推奨改善                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ⚠ プロンプト改善が推奨されるエージェント: 2件                       │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🔴 リサーチャー — self_score 3サイクル連続低下                │  │
│  │                                                              │  │
│  │ スコア推移: 7 → 6 → 5 (サイクル40〜42)                       │  │
│  │                                                              │  │
│  │ 繰り返し出現する改善点:                                       │  │
│  │   ・「TikTokのトレンドデータを見逃している」(4回出現)          │  │
│  │   ・「調査範囲が広すぎて深掘りできていない」(3回出現)          │  │
│  │                                                              │  │
│  │ 推奨改善セクション:                                           │  │
│  │   ・「2. 思考アプローチ」— 情報源の優先順位を明確化           │  │
│  │   ・「5. 制約」— TikTok調査を必須タスクとして追加             │  │
│  │                                                              │  │
│  │ 具体的な改善案:                                               │  │
│  │   思考アプローチに以下を追加:                                  │  │
│  │   「調査開始時に必ず以下の順序で情報源を確認:                   │  │
│  │     1. TikTok CreativeCenter (注力ニッチのトレンド)            │  │
│  │     2. Google Trends (横断的なトレンド)                        │  │
│  │     3. 競合アカウント直接確認 (最新投稿)」                     │  │
│  │                                                              │  │
│  │                    [プロンプト編集画面を開く] [既読にする]      │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ 🟡 プランナーA — 同じto_improveが3回以上繰り返し              │  │
│  │                                                              │  │
│  │ 繰り返し出現する改善点:                                       │  │
│  │   ・「競合アカウントの最新投稿を参照できていない」(3回出現)     │  │
│  │                                                              │  │
│  │ 推奨改善セクション:                                           │  │
│  │   ・「2. 思考アプローチ」— 仮説立案前の情報確認手順を追加     │  │
│  │                                                              │  │
│  │                    [プロンプト編集画面を開く] [既読にする]      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 14.5 実装: プロンプト改善チェッカー

推奨プロンプト改善の分析は週次cronジョブとして実行される。Claude Sonnet 4.5を使用して `agent_thought_logs` と `agent_reflections` のパターンを分析し、結果を `prompt_suggestions` テーブルに保存する。ダッシュボードの推奨パネル (02-architecture.md 6.7) はこのテーブルを読み取って表示する。

```typescript
interface PromptImprovementAlert {
  agent_type: string;
  agent_instance?: string;
  trigger: 'score_decline' | 'recurring_issue';
  severity: 'warning' | 'critical';
  details: {
    score_history?: number[];
    recurring_items?: { text: string; count: number }[];
  };
  suggested_sections: string[];
  suggested_changes?: string;
  created_at: string;
}

async function checkPromptImprovementNeeded(
  agentType: string,
  recentReflections: AgentReflection[]
): Promise<PromptImprovementAlert | null> {
  // 条件1: self_scoreが3サイクル連続で低下
  if (recentReflections.length >= 3) {
    const scores = recentReflections.slice(0, 3).map(r => r.self_score);
    if (scores[0] < scores[1] && scores[1] < scores[2]) {
      return {
        agent_type: agentType,
        trigger: 'score_decline',
        severity: 'critical',
        details: { score_history: scores.reverse() },
        suggested_sections: await analyzeSuggestedSections(agentType, recentReflections),
        suggested_changes: await generateSuggestedChanges(agentType, recentReflections),
        created_at: new Date().toISOString(),
      };
    }
  }

  // 条件2: 同じto_improveが3回以上繰り返される
  const allImprovements = recentReflections.flatMap(r => r.to_improve);
  const clusters = clusterSimilarTexts(allImprovements);
  const recurring = clusters.filter(c => c.count >= 3);

  if (recurring.length > 0) {
    return {
      agent_type: agentType,
      trigger: 'recurring_issue',
      severity: 'warning',
      details: { recurring_items: recurring },
      suggested_sections: await analyzeSuggestedSections(agentType, recentReflections),
      suggested_changes: await generateSuggestedChanges(agentType, recentReflections),
      created_at: new Date().toISOString(),
    };
  }

  return null;
}
```

## 15. WF完成後の知見移植プロセス

### 15.1 背景

v5.0のエージェントシステムが完成するまでの間（Phase 2〜3）、コンテンツ制作や市場調査は「手動Claude」（人間がClaudeを直接操作）で行う。この手動作業で得られる知見は貴重であり、エージェントシステムに確実に移植する必要がある。

本セクションでは「手動Claudeで得た知見 → エージェントへの移植」の具体的プロセスを定義する。

### 15.2 知見移植の6ステップ

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    知見移植プロセス (6ステップ)                              │
│                                                                          │
│  [Step 1]        [Step 2]        [Step 3]        [Step 4]               │
│  知見の整理       カテゴリ分け     プロンプト反映   バージョン記録          │
│       │               │               │               │                │
│       ▼               ▼               ▼               ▼                │
│  知見を構造化     カテゴリ分類     対応するDBテーブル  agent_prompt_       │
│  して整理        ツール特性/     に反映             versionsテーブルに  │
│                  コンテンツ戦略/                    変更を記録          │
│                  プラットフォーム                                        │
│                  特性/その他                                             │
│                                                                          │
│  [Step 5]        [Step 6]                                               │
│  効果測定        共有知見登録                                              │
│       │               │                                                 │
│       ▼               ▼                                                 │
│  変更前後の       有効な知見を                                             │
│  パフォーマンス    learningsテーブル                                       │
│  比較            にも登録                                                 │
│                  (全エージェント共有)                                      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 15.3 各ステップの詳細

**Step 1: 知見の整理 — 構造化**

手動Claude作業で得た知見を以下のフォーマットに従って構造化する。ダッシュボードの知見登録フォームから直接DBに登録する。

知見のフォーマット:

```markdown
# [知見タイトル]

## 発見日
2026-02-15

## 発見の経緯
[どのような作業中に発見したか]

## 知見の内容
[具体的な知見。データがあれば含める]

## 適用範囲
- ニッチ: [beauty, tech, etc. / 全般]
- プラットフォーム: [TikTok, YouTube, etc. / 全般]
- キャラクタータイプ: [asian, western, etc. / 全般]

## 対応エージェント
[この知見を適用すべきエージェント: 社長 / リサーチャー / アナリスト / ツールSP / プランナー]

## 信頼度
[高 / 中 / 低] — [根拠]
```

**Step 2: カテゴリ分け**

知見を以下の4カテゴリに分類する:

| カテゴリ | 内容 | 対応エージェント | 反映先 |
|---------|------|----------------|--------|
| **ツール特性** | AIツールの得意/不得意、パラメータ設定のコツ | ツールスペシャリスト | `tool_experiences` テーブル |
| **コンテンツ戦略** | 投稿フォーマット、タイミング、仮説パターン | プランナー、社長 | `agent_individual_learnings` テーブル (planner/strategist) |
| **プラットフォーム特性** | アルゴリズム特性、API制約、トレンド傾向 | リサーチャー、アナリスト | `agent_individual_learnings` テーブル (researcher/analyst) |
| **その他** | 上記に該当しない知見 | 関連エージェント | `agent_individual_learnings` テーブル (該当エージェント) |

**Step 3: DB反映**

対応するDBテーブルに知見を反映する。

```
反映の具体例:

  知見: 「アジア人の顔はKlingが自然、西洋人はRunwayが自然」
  カテゴリ: ツール特性
  対応エージェント: ツールスペシャリスト

  反映先: tool_experiences テーブル
  反映方法: ダッシュボードまたはMCPツール経由でDB登録

  追加内容:
    ### 動画生成ツールのキャラクター適性
    - Kling: アジア人の顔の生成が最も自然。肌の質感、表情の微細な変化が優秀
    - Runway Gen-3: 西洋人の顔の生成が自然。特にリアリスティックな表現に強い
    - Pika: スタイライズド表現に適している。リアリスティック度は低い
```

**Step 4: バージョン記録**

`agent_prompt_versions` テーブルで変更を記録する。

```sql
CREATE TABLE agent_prompt_versions (
    -- 主キー
    id              SERIAL PRIMARY KEY,

    -- プロンプト情報
    agent_type      VARCHAR(30) NOT NULL,
    prompt_content  TEXT NOT NULL,
        -- プロンプト本文 (Markdown)
    active          BOOLEAN NOT NULL DEFAULT true,
        -- true = 現在有効なバージョン (agent_typeごとに1つのみ)

    -- 変更内容
    change_summary  TEXT NOT NULL,
        -- 変更の概要 (自然言語)
    change_reason   TEXT,
        -- 変更理由
    change_section  VARCHAR(50),
        -- 変更されたセクション名 (例: 'Domain Knowledge > ツール別特性')
    changed_by      VARCHAR(50) NOT NULL DEFAULT 'system',
        -- 変更者 (ダッシュボードユーザー名 or 'system')
    source_insight_id INTEGER,
        -- 元となった知見のID (agent_individual_learnings.id, あれば)

    -- 効果測定
    performance_snapshot JSONB,
        -- 変更時点のパフォーマンス指標
    post_change_metrics  JSONB,
        -- 変更後のパフォーマンス指標 (後から更新)
    effectiveness       VARCHAR(20),
        -- 'effective', 'neutral', 'negative', 'pending'

    -- タイムスタンプ
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    measured_at     TIMESTAMPTZ
);

COMMENT ON TABLE agent_prompt_versions IS 'プロンプトのバージョン管理。active=trueが現在有効なバージョン';
```

**Step 5: 効果測定**

変更前後のパフォーマンスを比較し、知見の有効性を定量評価する。

```
効果測定の手順:

  1. 変更前の3サイクル分のパフォーマンスを記録 (pre_change_metrics)
     例: { avg_quality_score: 0.72, hypothesis_accuracy: 0.45, avg_self_score: 6.5 }

  2. プロンプト変更を適用

  3. 変更後の3サイクル分のパフォーマンスを記録 (post_change_metrics)
     例: { avg_quality_score: 0.81, hypothesis_accuracy: 0.52, avg_self_score: 7.2 }

  4. 効果判定:
     ・主要指標が5%以上改善 → effectiveness = 'effective'
     ・主要指標が変化なし (±5%以内) → effectiveness = 'neutral'
     ・主要指標が5%以上低下 → effectiveness = 'negative' → ロールバック検討
```

**Step 6: 共有知見登録**

有効と判定された知見は `learnings` テーブルにも登録し、全エージェントが参照できるようにする。

```
登録の判断基準:
  ・effectiveness = 'effective' の知見のみ登録
  ・初期confidence = 0.60 (手動作業からの知見なので中程度の信頼度から開始)
  ・サイクルを重ねて検証されればconfidenceが上昇

登録例:
  extract_learning({
    insight: "アジア人キャラクターの動画生成にはKlingが最適。
              顔の自然さ、肌の質感がRunway比で25%高評価
              (手動制作10件での評価)",
    category: "tool_selection",
    confidence: 0.60,
    source_analyses: [],
    applicable_niches: ["beauty", "fashion", "lifestyle"]
  })
```

### 15.4 知見移植のタイムライン

```
Phase 2 (手動Claude運用中):
  ┌─────────────────────────────────────────────────────────────────┐
  │ 手動作業 → 知見発見 → DB登録 → 蓄積                               │
  │                                                                 │
  │ 目標: 50件以上の知見を蓄積してからエージェントシステムに移植       │
  └─────────────────────────────────────────────────────────────────┘

Phase 3 (エージェント開発中):
  ┌─────────────────────────────────────────────────────────────────┐
  │ 蓄積した知見を一括移植:                                          │
  │   1. ツール特性 → tool_experiences テーブル                     │
  │   2. コンテンツ戦略 → agent_individual_learnings (planner等)    │
  │   3. プラットフォーム特性 → agent_individual_learnings (analyst等)│
  │   4. System Prompt → agent_prompt_versions テーブル             │
  │                                                                 │
  │ 効果測定: エージェント稼働後3サイクルで効果判定                    │
  └─────────────────────────────────────────────────────────────────┘

Phase 4以降 (エージェント運用中):
  ┌─────────────────────────────────────────────────────────────────┐
  │ 継続的な知見移植:                                                │
  │   ・手動作業で新しい知見が得られたら随時移植                      │
  │   ・エージェント自身の学習 + 人間の知見 = 最速の改善サイクル       │
  └─────────────────────────────────────────────────────────────────┘
```
