# AI-Influencer ユーザーガイド

## このシステムは何をするのか

YouTube Shorts / TikTok / Instagram Reels の動画パフォーマンスを分析し、**コンポーネント単位での改善提案**を自動生成するシステム。動画制作から分析までの完全ループを管理する。

```
v2.0の制作ループ:
1. コンポーネントを選んで動画を計画（master シートにドラフト作成）
2. AIの提案を確認して承認
3. n8nが承認済み動画のコンポーネントデータを読み取り、動画を生成
4. 3プラットフォームに投稿
5. CSVをダウンロードしてGoogle Driveにアップロード
6. 分析→改善提案→次の動画へ（ループ）
```

---

## 初期セットアップ

### Step 1: セットアップ実行（1回のみ）

1. Google Sheets を開く
2. メニュー「Video Analytics v2」→「Initial Setup (v2.0)」
3. 自動で以下が作成される:
   - Google Drive にフォルダ構造（Scenarios, Motions, Characters, Audio, Analytics）
   - 各コンポーネント用の独立スプレッドシート（インベントリ）
   - マスタースプレッドシートの全タブ
   - デモデータ

### Step 2: API キー設定

1. Apps Script エディタを開く
2. プロジェクトの設定 → スクリプトプロパティ
3. 以下を設定:
   - `OPENAI_API_KEY`: OpenAI API キー
   - `SPREADSHEET_ID`: マスタースプレッドシートのID

---

## 日常の使い方フロー

### 📅 動画制作ループ

#### Step 1: 動画を計画

メニュー「Video Analytics v2」→「Production」→「Create New Video...」

- タイトルを入力すると、video_uid が自動生成される
- master シートに新しい行が追加される（status = draft）
- master シートでコンポーネントIDを選択:
  - フックシナリオ（SCN_H_XXXX）
  - フックモーション（MOT_XXXX）
  - ボディシナリオ（SCN_B_XXXX）
  - キャラクター（CHR_XXXX）
  - オーディオ（AUD_XXXX）
  - 等

#### Step 2: AIの提案を確認して承認

- 過去の分析で生成されたAI推奨コンポーネント（ai_next_* 列）を参照
- メニュー → 「Production」→「Approve Video...」
- human_approved にチェック → status が approved に変更

#### Step 3: 動画を制作（n8n）

- n8n が approved 動画を取得
- 各コンポーネントのデータをインベントリから読み取り
- 動画生成ワークフローを実行
- status → in_production → published

#### Step 4: CSVをダウンロード＆アップロード（5分）

**YouTube Studio:**
1. [YouTube Studio](https://studio.youtube.com) → アナリティクス → 詳細モード
2. 「Shorts」でフィルタ → 右上「エクスポート」→ CSV

**TikTok:**
1. [TikTok Analytics](https://www.tiktok.com/creator#/analytics) → コンテンツ
2. 「データをダウンロード」→ CSV

**Instagram:**
1. Instagram アプリ → プロフェッショナルダッシュボード
2. 「インサイトをエクスポート」

Google Drive の `Analytics/CSV_Imports/` 各プラットフォームフォルダにCSVをドロップ。

#### Step 5: 分析を実行

**自動（n8n連携後）:**
- アップロードすると自動で分析開始

**手動:**
- メニュー「Video Analytics v2」→「Analyze」→「All Videos (Enhanced)」
- コンポーネント情報を含む高精度分析が実行される

#### Step 6: 結果を確認

| シート名 | 見るべき内容 |
|---------|-------------|
| `recommendations` | 🎯 改善提案（コンポーネント別） |
| `video_analysis` | 個別動画の詳細分析 |
| `analysis_reports` | 全体レポート |
| `master` | 動画一覧・ステータス・スコア |

---

## コンポーネント管理

### コンポーネントの追加

メニュー → 「Components」→「Add Component...」

1. インベントリタイプを選択（scenarios, motions, characters, audio）
2. 名前とサブタイプを入力
3. コンポーネントIDが自動生成される
4. 詳細はインベントリスプレッドシートで直接編集

### コンポーネントの閲覧

メニュー → 「Components」→「Browse Scenarios/Motions/Characters/Audio」

### スコアの確認

メニュー → 「Components」→「Score Summary」
- 各インベントリタイプのトップパフォーマーを表示

### スコアの手動更新

メニュー → 「Components」→「Update All Scores」
- 全コンポーネントの avg_performance_score を再計算

---

## 各シートの見方

### 📋 master（マスター）

全動画の一覧。1行 = 1動画制作。

| 列グループ | 説明 |
|-----------|------|
| Identity | video_uid, タイトル, ステータス, 作成日 |
| Hook/Body/CTA | 各セクションのコンポーネントID |
| Character | キャラクターID |
| Platforms | YouTube/TikTok/Instagram の動画ID |
| Metrics | 各プラットフォームの最新メトリクス（スナップショット） |
| Analysis | overall_score, 分析日, トップ改善提案 |
| AI Next | AIが推奨する次の動画のコンポーネント |
| Approval | 人間の承認チェックボックスとメモ |

### 📋 recommendations（改善提案）

| 列 | 説明 |
|----|------|
| video_uid | 対象動画（all = 全体） |
| priority | 優先度（1が最優先） |
| category | 種類: hook, pacing, content, format, thumbnail, audio |
| recommendation | 具体的な改善提案 |
| platform | 対象プラットフォーム |
| expected_impact | 期待される効果 |
| status | pending → implemented に変えて追跡 |
| compared_to_previous | 前回との比較（NEW/IMPROVED/UNCHANGED/DECLINED） |

### 📊 インベントリ（コンポーネント一覧）

各インベントリスプレッドシート（Scenarios, Motions, Characters, Audio）:

| 列 | 説明 |
|----|------|
| component_id | 固有ID（SCN_H_0001等） |
| type | hook/body/cta or voice/bgm |
| name | コンポーネント名 |
| times_used | 使用回数（自動計算） |
| avg_performance_score | 平均パフォーマンススコア（自動更新） |
| status | active / archived |

---

## KPI目標の設定

`kpi_targets` シートで目標値を設定:

| platform | metric | target_value | description |
|----------|--------|--------------|-------------|
| youtube | completion_rate | 0.5 | 50%完走 |
| tiktok | engagement_rate | 0.08 | 8%エンゲージメント |
| instagram | avg_watch_time | 15 | 15秒平均視聴 |

---

## v1.0からのアップグレード

メニュー → 「Video Analytics v2」→「Upgrade from v1.0」

自動で以下を実行:
- videos_master → master にリネーム
- 新しい列を追加（コンポーネントID、AI推奨、承認等）
- scenario_cuts を削除
- インベントリスプレッドシートを新規作成
- Drive フォルダ構造を作成

---

## よくある質問

### Q: CSVはどのくらいの頻度でアップすべき？
**A: 週1回で十分。** 毎日やっても分析精度は上がらない。

### Q: コンポーネントのスコアはどう計算される？
**A:** そのコンポーネントを使った全動画の overall_score の平均値。分析実行時に自動更新される。

### Q: AIの推奨コンポーネントとは？
**A:** 分析時にAIが過去のパフォーマンスデータを元に、次の動画に最適なコンポーネントを推奨する。master シートの ai_next_* 列に書き込まれる。

### Q: 動画が自動でマッチしない場合は？
**A: `unlinked_imports` シートを確認。** 手動で video_uid を設定するか、master に新しい行を追加。

### Q: 分析が間違っている気がする
**A: AIの提案は参考程度に。** 最終判断は経験と勘が重要。明らかに的外れな提案は無視してOK。

---

## トラブルシューティング

### セットアップが失敗する
1. Script Properties に `SPREADSHEET_ID` と `OPENAI_API_KEY` が設定されているか確認
2. GAS の実行ログを確認（Apps Script → 実行数）

### CSVがインポートできない
1. ファイル形式が CSV (.csv) か確認
2. 文字コードが UTF-8 か確認
3. ヘッダー行があるか確認

### コンポーネントが見つからない
1. インベントリスプレッドシートが作成されているか確認
2. メニュー → 「Status Dashboard」でインベントリ接続状態を確認
3. 接続されていない場合、`setupCompleteSystem()` を再実行

### 分析が実行されない
1. OpenAI API Key が設定されているか確認
2. API の残高があるか確認
3. GAS の実行ログを確認

---

## 用語集

| 用語 | 説明 |
|------|------|
| video_uid | システム内で動画を識別するユニークID (VID_YYYYMM_XXXX) |
| component_id | コンポーネントの固有ID (SCN_H_XXXX, MOT_XXXX等) |
| inventory | コンポーネントの一覧スプレッドシート |
| completion_rate | 動画を最後まで見た視聴者の割合（0-1） |
| engagement_rate | いいね・コメント・シェアの合計 ÷ 再生回数 |
| overall_score | 全プラットフォーム総合のKPIスコア（0-100） |
| hook | 動画冒頭の引き（最初の1-3秒） |
| body | 動画の本編部分 |
| CTA | Call To Action（最後のアクション促進部分） |

---

## サポート

問題が発生した場合:
1. このガイドの「トラブルシューティング」を確認
2. メニュー → 「Status Dashboard」で接続状態を確認
3. GitHub Issues で報告: https://github.com/Ceed-dev/ai-influencer/issues
