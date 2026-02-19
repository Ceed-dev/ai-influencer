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

## 仕様書一覧

| # | ファイル | 内容 |
|---|---------|------|
| 01 | [技術スタック一覧](01-tech-stack.md) | 使用する全サービス・ライブラリ・インフラ |
| 02 | [システムアーキテクチャ](02-architecture.md) | 4層アーキテクチャ、データ基盤層、AIエージェント層、MCP Server、ダッシュボード |
| 03 | [PostgreSQLスキーマ完全定義](03-database-schema.md) | 全テーブル・カラム・リレーション・インデックス（pgvector含む） |
| 04 | [AIエージェント設計](04-agent-design.md) | 階層構造、MCPツール一覧、LangGraphグラフ設計、仮説駆動サイクル |
| 05 | [運用コスト分析](05-cost-analysis.md) | コンテンツ単価、AIエージェント運用コスト、スケール別月間総コスト |
| 06 | [開発ロードマップ](06-development-roadmap.md) | 週単位スケジュール、マイルストーン、依存関係、リスクバッファ |
| 07 | [KPI達成可能性分析 v3](07-kpi-analysis.md) | v5.0仕様での再評価（2026年2月〜6月 + 長期展望） |
| 08 | [アルゴリズム精度分析](08-algorithm-analysis.md) | 仮説的中率予測、成長曲線、改善戦略 |
| 09 | [リスク・ボトルネック分析](09-risks-and-bottlenecks.md) | ビジネス・技術・プラットフォーム・運用リスクと緩和策 |
| 10 | [Agent Team実装ガイド](10-implementation-guide.md) | 10エージェントの役割分担、ディレクトリ構造、ブランチ戦略 |
| 11 | [実装前チェックリスト](11-pre-implementation-checklist.md) | インフラ・APIキー・OAuth・アカウント作成の準備事項 |
| 12 | [テスト仕様書](12-test-specifications.md) | 311テスト（DB/MCP/Worker/Agent/Dashboard/Integration/E2E） |
| 13 | [エージェントハーネス仕様](13-agent-harness.md) | 全自動実装ワークフロー、feature_list.json、品質ゲート |

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
|  Strategy  Research  Analyst  Tool Spec  Data       Planner |
|  Agent     Agent     Agent    Agent      Curator    x N     |
|  (Opus)    (Sonnet)  (Sonnet) (Sonnet)   (Sonnet)   (Sonnet)|
|                                                             |
|                        MCP Protocol                         |
|                              |                              |
|              Custom MCP Server (Node.js)                    |
|       Business Logic + Queries (98 MCP + 13 REST API)       |
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
| データベース | PostgreSQL + pgvector (本番: Cloud SQL / 開発: Docker) | 横断クエリ、時系列分析、ベクトル検索を1つのDBで。本番はCloud SQLマネージド |
| AIインターフェース | MCP Server (自作) | AIエージェントがネイティブにツール発見・呼び出し可能 |
| オーケストレーション | LangGraph v1.0 | 唯一のv1.0 GA、Supervisorパターン、耐久実行、JS/TS対応 |
| LLM | Claude (Opus + Sonnet) | 戦略=Opus(高推論), 実行=Sonnet(コスト効率) |
| エージェント構造 | 4層階層型 | 戦略は集約、実行は分散。スケール時はプランナー増設のみ |
| ダッシュボード | Next.js + Shadcn/ui | 操作可能なUI必要。Node.js/TSスタック統一 |
| 外部AI記憶サービス | 不採用 (pgvectorで代替) | ドメイン知識が構造化済み。依存を増やさない |
| コンテンツ制作 | content_format + 動的レシピ駆動 | content_format (short_video/text_post/image_post) でワーカータイプを自動振り分け。動画はproduction_recipesのレシピ (JSONB steps) に従い実行、テキストはLLM直接生成 |
| 制作API | ツールスペシャリストが選択、ワーカーが実行 | ツール特性を学習し最適な組み合わせを推奨。実行はワーカーが担当 |
| コンテナ化 | Docker + docker-compose | 環境再現性、クラウド移植性、段階的導入 |
| ツール選択 | ツールスペシャリストAgent | ツールのクセ・特性を学習し最適な組み合わせを推奨 |
