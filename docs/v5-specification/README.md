# AI-Influencer v5.0 技術仕様書

> **作成日**: 2026-02-16
>
> **ステータス**: 設計完了 — 実装準備中
>
> **前バージョン**: v4.0 (Sheets + Pipeline) → v5.0 (DB + MCP + Multi-Agent)
>
> **関連ドキュメント**: [STRATEGY.md](../STRATEGY.md), [KPI-FEASIBILITY-ANALYSIS-v2-AI-DRIVEN.md](../KPI-FEASIBILITY-ANALYSIS-v2-AI-DRIVEN.md), [ALGORITHM-CONTENT-VOLUME-ANALYSIS.md](../ALGORITHM-CONTENT-VOLUME-ANALYSIS.md)

## 概要

v5.0は、AI-Influencerシステムを**完全AIエージェント駆動**に刷新する大規模リデザイン。人間がスプレッドシートにIDを手入力してパイプラインを回す現行フローを廃止し、複数のAIエージェントが自律的に「市場調査→仮説立案→コンテンツ制作→投稿→計測→分析→学習」のサイクルを高速で回す。

### v4.0の問題点

1. **データが散在**: 5つのインベントリ(別々のSpreadsheet) + 33列productionタブ + Drive + Markdown
2. **フィードバックループなし**: 作りっぱなし。投稿後のパフォーマンスが次のコンテンツ企画に反映されない
3. **人間に最適化された設計**: AIエージェントが自律的にデータを読み書きする前提になっていない
4. **スケール限界**: Sheetsベースでは3,500アカウント/日の運用に耐えられない

### v5.0の設計思想

- **全フローをAIエージェントが自律的に実行** — 人間は監視のみ
- **仮説駆動サイクル** — 毎サイクルで仮説→実験→検証→学習
- **フィードバックループ** — 分析結果が次の企画に自動反映
- **品質重視** — 量産ではなく、アルゴリズムの精度向上による質の改善
- **人間介入も可能** — ダッシュボードから仮説・参考コンテンツを差し込める

## ドキュメント構成

| ファイル | 内容 |
|---------|------|
| [01-tech-stack.md](01-tech-stack.md) | 技術スタック一覧（全サービス・ライブラリ・インフラ） |
| [02-architecture.md](02-architecture.md) | システムアーキテクチャ（データ基盤・エージェント・MCP・ダッシュボード） |
| [03-database-schema.md](03-database-schema.md) | PostgreSQLスキーマ完全定義（全テーブル・カラム・リレーション） |
| [04-agent-design.md](04-agent-design.md) | AIエージェント設計（階層構造・MCPツール・LangGraphグラフ・データフロー） |
| [05-cost-analysis.md](05-cost-analysis.md) | 運用コスト分析（月額・コンテンツ単価・スケール別試算） |
| [06-development-roadmap.md](06-development-roadmap.md) | 開発ロードマップ（週単位スケジュール・マイルストーン・依存関係） |
| [07-kpi-analysis.md](07-kpi-analysis.md) | KPI達成可能性分析 v3（v5仕様での再評価） |
| [08-algorithm-analysis.md](08-algorithm-analysis.md) | アルゴリズム精度分析（仮説的中率予測・成長曲線・改善戦略） |
| [09-risks-and-bottlenecks.md](09-risks-and-bottlenecks.md) | リスク・ボトルネック分析（Biz観点・Dev観点・緩和策） |

## アーキテクチャ概要図

```
+-------------------------------------------------------------+
|                       Human Dashboard                       |
|                    (Next.js + Shadcn/ui)                    |
|          KPI Monitoring / Accuracy / Intervention           |
+------------------------------+------------------------------+
                               |
+------------------------------v------------------------------+
|              LangGraph.js v1.0 (Orchestration)              |
|                                                             |
|  Strategy  Research  Analyst  Tool Spec  Planner x N        |
|  Agent     Agent     Agent    Agent      Agent              |
|  (Opus)    (Sonnet)  (Sonnet) (Sonnet)   (Sonnet)           |
|                                                             |
|                        MCP Protocol                         |
|                              |                              |
|              Custom MCP Server (Node.js)                    |
|           Business Logic + Queries (~73 tools)              |
|                              |                              |
|  Video    Text     Posting        Measurement               |
|  Worker   Worker   Worker         Worker                    |
|  (fal.ai) (LLM)    (Platforms)    (Platform APIs)           |
+------------------------------+------------------------------+
                               |
+------------------------------v------------------------------+
|                   PostgreSQL + pgvector                     |
|        Structured Data + Vector Search + Task Queue         |
+------------------------------+------------------------------+
                               |
+------------------------------v------------------------------+
|                         Google Drive                        |
|               Video / Image / Audio Files                   |
+-------------------------------------------------------------+
```

## 主要な技術的決定とその理由

| 決定事項 | 選択 | 理由 |
|---------|------|------|
| データベース | PostgreSQL + pgvector | 横断クエリ、時系列分析、ベクトル検索を1つのDBで |
| AIインターフェース | MCP Server (自作) | AIエージェントがネイティブにツール発見・呼び出し可能 |
| オーケストレーション | LangGraph v1.0 | 唯一のv1.0 GA、Supervisorパターン、耐久実行、JS/TS対応 |
| LLM | Claude (Opus + Sonnet) | 戦略=Opus(高推論), 実行=Sonnet(コスト効率) |
| エージェント構造 | 4層階層型 | 戦略は集約、実行は分散。スケール時はプランナー増設のみ |
| ダッシュボード | Next.js + Shadcn/ui | 操作可能なUI必要。Node.js/TSスタック統一 |
| 外部AI記憶サービス | 不採用 (pgvectorで代替) | ドメイン知識が構造化済み。依存を増やさない |
| 制作API | ツールスペシャリストが選択、ワーカーが実行 | ツール特性を学習し最適な組み合わせを推奨。実行はワーカーが担当 |
| コンテナ化 | Docker + docker-compose | 環境再現性、クラウド移植性、段階的導入 |
| ツール選択 | ツールスペシャリストAgent | ツールのクセ・特性を学習し最適な組み合わせを推奨 |
