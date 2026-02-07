# Video Analytics Hub - ユーザーガイド

## このシステムは何をするのか

YouTube Shorts / TikTok / Instagram Reels の動画パフォーマンスを分析し、**次の動画をより良くするための改善提案**を自動生成するシステム。

```
あなたがやること:
1. 各プラットフォームからCSVをダウンロード（週1回程度）
2. CSVをGoogle Driveにアップロード
3. 分析結果をSheetsで確認
4. 改善提案を次の動画制作に活かす
```

---

## 日常の使い方フロー

### 📅 週次ルーティン（推奨: 毎週月曜）

#### Step 1: CSVをダウンロード（5分）

**YouTube Studio:**
1. [YouTube Studio](https://studio.youtube.com) → アナリティクス → 詳細モード
2. 「Shorts」でフィルタ
3. 右上「エクスポート」→ CSV

**TikTok:**
1. [TikTok Analytics](https://www.tiktok.com/creator#/analytics) → コンテンツ
2. 「データをダウンロード」→ CSV

**Instagram:**
1. Instagram アプリ → プロフェッショナルダッシュボード
2. 「インサイトをエクスポート」（または Meta Business Suite から）

#### Step 2: CSVをアップロード（1分）

Google Drive の `AI-Influencer/csv_imports/` フォルダに3つのCSVをドラッグ＆ドロップ。

ファイル名の例:
- `youtube_2026-02-06.csv`
- `tiktok_2026-02-06.csv`
- `instagram_2026-02-06.csv`

#### Step 3: 分析を実行（自動 or 手動）

**自動（n8n連携後）:**
- アップロードすると自動で分析開始
- 完了通知が届く

**手動:**
- Google Sheets を開く
- メニュー「Video Analytics」→「CSVをインポート」
- 処理完了まで待つ（1-2分）

#### Step 4: 結果を確認（5分）

Google Sheets の以下のシートを確認:

| シート名 | 見るべき内容 |
|---------|-------------|
| `recommendations` | 🎯 **最重要** - 次の動画への改善提案 |
| `analysis_reports` | 詳細な分析レポート |
| `videos_master` | 動画一覧と各プラットフォームの紐付け |

---

## 各シートの見方

### 📋 recommendations（改善提案）

| 列 | 説明 |
|----|------|
| priority | 優先度（1が最優先） |
| category | 種類: hook（冒頭）, pacing（テンポ）, content（内容）, format（形式） |
| recommendation | 具体的な改善提案 |
| platform | 対象プラットフォーム（all = 全部） |
| expected_impact | 期待される効果 |
| status | pending → implemented に変えて追跡 |

**使い方:**
1. priority 1-3 の提案を確認
2. 次の動画で実践
3. 実践したら status を `implemented` に変更
4. 翌週、効果を確認

### 📊 videos_master（動画マスター）

全動画の一覧。同じ動画の YouTube/TikTok/Instagram を紐付ける。

| 列 | 説明 |
|----|------|
| video_uid | システム内部ID |
| title | 動画タイトル |
| youtube_id | YouTube の動画ID |
| tiktok_id | TikTok の動画ID |
| instagram_id | Instagram の投稿ID |

**新しい動画を追加する時:**
1. 各プラットフォームに投稿
2. CSVインポート時に自動で追加される
3. タイトルで自動マッチング
4. マッチしない場合は `unlinked_imports` に入るので手動で紐付け

### 📈 metrics_youtube / tiktok / instagram

各プラットフォームの詳細指標。履歴として蓄積される。

主な指標:
- views: 再生回数
- completion_rate: 完走率（最後まで見た割合）
- engagement_rate: エンゲージメント率
- avg_watch_time: 平均視聴時間

---

## KPI目標の設定

`kpi_targets` シートで目標値を設定できる。

例:
| platform | metric | target_value | description |
|----------|--------|--------------|-------------|
| youtube | completion_rate | 0.5 | 50%完走 |
| tiktok | engagement_rate | 0.08 | 8%エンゲージメント |
| instagram | avg_watch_time | 15 | 15秒平均視聴 |

目標を超えた動画は「成功」として分析に使われる。

---

## よくある質問

### Q: CSVはどのくらいの頻度でアップすべき？

**A: 週1回で十分。** 毎日やっても分析精度は上がらない。週単位でトレンドを見るのがベスト。

### Q: 過去のデータはどこまで遡れる？

**A: プラットフォームの制限による。**
- YouTube: 制限なし（ただしCSVは500行まで）
- TikTok: 60日
- Instagram: 90日

このシステムはデータを蓄積するので、一度インポートすれば永久保存。

### Q: 動画が自動でマッチしない場合は？

**A: `unlinked_imports` シートを確認。** 手動で video_uid を設定するか、`videos_master` に新しい行を追加。

### Q: 分析が間違っている気がする

**A: AIの提案は参考程度に。** 最終判断は殿の経験と勘が重要。明らかに的外れな提案は無視してOK。

### Q: 英語と日本語どちらで出力される？

**A: 現在は英語。** 日本語化したい場合は `LLMAnalyzer.gs` のプロンプトを修正可能。

---

## トラブルシューティング

### CSVがインポートできない

1. ファイル形式が CSV (.csv) か確認
2. 文字コードが UTF-8 か確認
3. ヘッダー行があるか確認

### 分析が実行されない

1. OpenAI API Key が設定されているか確認
2. API の残高があるか確認
3. GAS の実行ログを確認（Apps Script → 実行数）

### Sheets が重い

1. 古いデータを別シートにアーカイブ
2. 条件付き書式を減らす
3. 不要な列を非表示に

---

## 用語集

| 用語 | 説明 |
|------|------|
| video_uid | システム内で動画を識別するユニークID |
| completion_rate | 動画を最後まで見た視聴者の割合（0-1） |
| engagement_rate | いいね・コメント・シェアの合計 ÷ 再生回数 |
| CTR | クリック率（インプレッション → 再生） |
| hook | 動画冒頭の引き（最初の1-3秒） |

---

## サポート

問題が発生した場合:
1. このガイドの「トラブルシューティング」を確認
2. GitHub Issues で報告: https://github.com/Ceed-dev/video-analytics-hub/issues
3. CONTEXT.md を更新して次のセッションで解決
