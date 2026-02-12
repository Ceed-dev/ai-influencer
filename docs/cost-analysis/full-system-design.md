# AI KOL 全自動パイプライン — システム設計 & コスト分析

**作成日**: 2026-02-11
**対象**: 全工程の自動化（市場調査 → シナリオ作成 → 動画制作 → 投稿 → 分析 → 学習ループ）
**KPI参照**: AI Influencerマスターシート — KPIタブ


## 目次

1. [KPIサマリー](#1-kpiサマリー)
2. [パイプライン全体フロー](#2-パイプライン全体フロー)
3. [フェーズ別 技術選定](#3-フェーズ別-技術選定)
4. [月別コスト表](#4-月別コスト表)
   - [2月（50アカウント）](#4-1-2月50アカウント)
   - [3月（160アカウント）](#4-2-3月160アカウント)
   - [4月（340アカウント）](#4-3-4月340アカウント)
   - [5月（1,480アカウント）](#4-4-5月1480アカウント)
   - [6月（3,500アカウント）](#4-5-6月3500アカウント)
5. [インフラ設計](#5-インフラ設計)
6. [並列化戦略](#6-並列化戦略)
7. [総コストサマリー](#7-総コストサマリー)
8. [リスクと制約](#8-リスクと制約)
9. [参照URL一覧](#9-参照url一覧)


## 1. KPIサマリー

| プラットフォーム | 2月 | 3月 | 4月 | 5月 | 6月 |
|---|---|---|---|---|---|
| TikTok | 12 | 42 | 92 | 392 | 960 |
| Instagram | 12 | 42 | 92 | 392 | 960 |
| YouTube | 12 | 42 | 92 | 392 | 960 |
| Twitter/X | 14 | 34 | 64 | 304 | 620 |
| **合計アカウント** | **50** | **160** | **340** | **1,480** | **3,500** |

### 日次制作量

各アカウントは毎日1投稿。動画プラットフォーム（TikTok/Instagram/YouTube）は同じ動画を3プラットフォームに投稿するのではなく、各アカウントが固有のコンテンツを投稿する。

| 指標 | 2月 | 3月 | 4月 | 5月 | 6月 |
|---|---|---|---|---|---|
| 動画制作数/日 | 36 | 126 | 276 | 1,176 | 2,880 |
| ツイート制作数/日 | 14 | 34 | 64 | 304 | 620 |
| 動画制作数/月 | 1,080 | 3,780 | 8,280 | 35,280 | 86,400 |
| ツイート数/月 | 420 | 1,020 | 1,920 | 9,120 | 18,600 |


## 2. パイプライン全体フロー

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 1: 市場リサーチ & トレンド分析                                      │
│  YouTube Data API / Apify (TikTok) / Google Trends / Exploding Topics   │
│  → GPT-4o で分析・要約                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 2: 仮説立案 & A/Bテスト設計                                       │
│  GPT-4o: 過去パフォーマンスデータ + トレンド → 仮説・テスト計画生成          │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 3: シナリオ & スクリプト作成                                       │
│  GPT-4o-mini (Batch API): アカウントごとに固有スクリプト生成                │
│  Twitter: GPT-4o-mini でツイート文面生成                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 4: 参考動画分析                                                   │
│  yt-dlp + ffmpeg (フレーム抽出) → GPT-4o Vision で構図・演出分析           │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 5: 動画制作（既存パイプライン v4.0）                               │
│  fal.ai: Kling (動画生成) + Sync Lipsync (口パク)                        │
│  Fish Audio: TTS音声生成（直接REST API、fal.aiとは別サービス）            │
│  ffmpeg: 3セクション結合 → Google Drive 保存                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 6: 投稿                                                          │
│  YouTube Data API / Instagram Graph API / TikTok Content Posting API    │
│  Twitter/X API v2 (Basic Plan)                                          │
│  API制限超過分: OpenClaw (Twitter) / Playwright + プロキシ (補助)         │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 7: パフォーマンス指標収集                                          │
│  YouTube Analytics API / Instagram Insights API (Graph API)              │
│  TikTok: Apify Scraper / Twitter: Apify or Data365                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 8: 分析 & スコアリング                                            │
│  GPT-4o: コンポーネント別パフォーマンス分析                                │
│  GAS Analytics (既存): KPI比較・スコア更新                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 9: 学習ループ                                                     │
│  PostgreSQL: パフォーマンス履歴蓄積                                       │
│  GPT-4o: 改善提案生成 → インベントリスコア更新 → Phase 1 へ               │
└─────────────────────────────────────────────────────────────────────────┘
```


## 3. フェーズ別 技術選定

### Phase 1: 市場リサーチ & トレンド分析

| ツール | 用途 | 選定理由 | プラン/スペック | 制限 | 参照URL |
|---|---|---|---|---|---|
| **YouTube Data API v3** | YouTubeトレンド取得 | 公式API、無料枠で十分 | 無料（10,000単位/日） | search.list = 100単位/コール | [YouTube Quota](https://developers.google.com/youtube/v3/determine_quota_cost) |
| **Apify TikTok Scraper** | TikTokトレンド取得 | 公式Research APIは商用不可。Apifyは$0.006/クエリで安価 | Scale $199/月 | 200投稿/秒、98%成功率 | [Apify TikTok](https://apify.com/apidojo/tiktok-scraper-api) |
| **Google Trends** | 検索トレンド分析 | 無料。API（アルファ版）申請可 | 無料 | アルファ版は要申請 | [Google Trends API](https://developers.google.com/search/apis/trends) |
| **DataForSEO** | Google Trends API代替 | $6/10K検索で最安クラス | 従量課金 | なし | [DataForSEO](https://dataforseo.com/) |
| **Treendly** | 新興トレンド早期発見 | $99/年で最安 | $99/年 | なし | [Treendly](https://treendly.com/) |
| **GPT-4o** | トレンドデータの分析・要約 | 高品質な分析能力 | Tier 2+（$50支払い+7日） | 5,000 RPM | [OpenAI Pricing](https://platform.openai.com/docs/pricing) |

### Phase 2: 仮説立案 & A/Bテスト設計

| ツール | 用途 | 選定理由 | プラン/スペック | コスト見積 | 参照URL |
|---|---|---|---|---|---|
| **GPT-4o** | 仮説生成・テスト設計 | 複雑な推論が必要 | 入力$2.50/1M、出力$10.00/1M | ~$0.01/コール | [OpenAI Pricing](https://platform.openai.com/docs/pricing) |
| **PostgreSQL (Cloud SQL)** | 過去パフォーマンスデータ蓄積 | リレーショナルデータの管理 | Enterprise 4vCPU/16GB | ~$27/月 | [Cloud SQL Pricing](https://cloud.google.com/sql/pricing) |

### Phase 3: シナリオ & スクリプト作成

| ツール | 用途 | 選定理由 | プラン/スペック | コスト見積 | 参照URL |
|---|---|---|---|---|---|
| **GPT-4o-mini (Batch API)** | 動画スクリプト一括生成 | 安価($0.075/1M入力)でBatch APIは更に50%OFF | Tier 2+ | ~$0.0003/スクリプト | [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) |
| **GPT-4o-mini** | ツイート文面生成 | 即時性不要なためBatch推奨 | 同上 | ~$0.0002/ツイート | 同上 |

### Phase 4: 参考動画分析

| ツール | 用途 | 選定理由 | プラン/スペック | コスト見積 | 参照URL |
|---|---|---|---|---|---|
| **yt-dlp** | 参考動画ダウンロード | OSS、無料 | 無料 | $0 | [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| **ffmpeg** | フレーム抽出 | OSS、ローカル処理 | 無料 | $0 | [ffmpeg](https://ffmpeg.org/) |
| **GPT-4o Vision** | 動画フレームの構図・演出分析 | 画像分析能力が高い | detail: low = 85トークン/画像 | ~$0.003/動画 | [OpenAI Vision](https://platform.openai.com/docs/guides/images-vision) |

### Phase 5: 動画制作（既存パイプライン）

| ツール | 用途 | 選定理由 | 単価 | コスト/セクション(5秒) | 参照URL |
|---|---|---|---|---|---|
| **Kling v2.6 Standard** (fal.ai) | AI動画生成 | 現行パイプライン実績あり | [$0.07/秒](https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control) | $0.35 | [fal.ai Kling](https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control) |
| **Fish Audio TTS** (直接API) | TTS音声生成 | 高品質、低コスト | ~$0.001/セクション | ~$0.001 | [Fish Audio](https://fish.audio) |
| **Sync Lipsync v2 Pro** (fal.ai) | 口パク同期 | 高品質 | [$5.00/分](https://fal.ai/models/fal-ai/sync-lipsync/v2/pro) | $0.42 | [fal.ai Lipsync](https://fal.ai/models/fal-ai/sync-lipsync/v2/pro) |
| **ffmpeg** | 3セクション結合 | ローカル処理、無料 | $0 | $0 | [ffmpeg](https://ffmpeg.org/) |
| | | **1動画(3セクション)合計** | | **$2.31 (Pro) / $1.80 (Std)** | [詳細](per-video-cost.md) |

### Phase 6: 投稿

| ツール | 用途 | プラン | レート制限 | 月額 | 参照URL |
|---|---|---|---|---|---|
| **YouTube Data API v3** | YouTube Shorts投稿 | 無料（クォータ制）| デフォルト6本/日/プロジェクト。増加申請必須 | $0 | [YouTube Upload](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits) |
| **Instagram Graph API** | Reels投稿 | 無料 | 25〜100投稿/24時間/アカウント | $0 | [Instagram Graph API](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api) |
| **TikTok Content Posting API** | TikTok投稿 | 無料（審査要） | ~15投稿/24時間/アカウント | $0 | [TikTok Content Posting](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) |
| **Twitter/X API v2** | ツイート投稿 | Basic $200/月 | 50,000投稿/月、100投稿/24時間/ユーザー | $200 | [X API Pricing](https://docs.x.com/x-api) |
| **Playwright + プロキシ** | API制限補完（緊急時） | Bright Data $10.50/GB | プラットフォーム検知リスクあり | $100-300 | [Bright Data](https://brightdata.com/) |

### Phase 7: パフォーマンス指標収集

| ツール | 用途 | プラン | レート制限 | 月額 | 参照URL |
|---|---|---|---|---|---|
| **YouTube Analytics API** | 再生数・エンゲージメント取得 | 無料（クォータ制） | 10,000単位/日 | $0 | [YouTube Analytics](https://developers.google.com/youtube/analytics) |
| **Instagram Graph API** | リーチ・インタラクション取得 | 無料 | 200リクエスト/時間/アカウント | $0 | [Instagram Insights](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights) |
| **Apify TikTok Scraper** | TikTok view/like/share取得 | Scale $199/月 | 200投稿/秒 | $199 (Phase 1と共有) | [Apify](https://apify.com/) |
| **Apify Twitter Scraper** | ツイートインプレッション取得 | Scale (上記に含む) | - | $0 (上記に含む) | [Apify](https://apify.com/) |

### Phase 8-9: 分析 & 学習ループ

| ツール | 用途 | プラン | コスト見積 | 参照URL |
|---|---|---|---|---|
| **GPT-4o** | コンポーネント別パフォーマンス分析 | Tier 2+ | ~$0.0075/コール | [OpenAI Pricing](https://platform.openai.com/docs/pricing) |
| **GAS Analytics (既存)** | KPI比較・スコア算出 | 無料 | $0 | 既存システム |
| **PostgreSQL (Cloud SQL)** | パフォーマンス履歴DB | Phase 2と共有 | $0 (共有) | [Cloud SQL](https://cloud.google.com/sql) |
| **GPT-4o** | 改善提案・次回推奨生成 | 同上 | ~$0.0075/コール | [OpenAI Pricing](https://platform.openai.com/docs/pricing) |


## 4. 月別コスト表

### 4-1. 2月（50アカウント）

**規模**: 動画36本/日(1,080本/月) + ツイート14本/日(420本/月)

| カテゴリ | サービス | 用途 | 単価/根拠 | 月額コスト | 備考 |
|---|---|---|---|---|---|
| **動画制作 (fal.ai)** | fal.ai Kling | 動画生成 | $0.35/セクション × 3 × 1,080本 | **$1,134** | 5秒×3セクション |
| | fal.ai Sync Lipsync Pro | 口パク同期 | $0.42/セクション × 3 × 1,080本 | **$1,361** | Pro版使用 |
| **TTS (Fish Audio)** | Fish Audio TTS | TTS音声生成 | ~$0.001/セクション × 3 × 1,080本 | **$3** | 直接REST API（fal.ai とは別サービス） |
| | **動画制作+TTS小計** | | | **$2,498** | Std版なら$1,947 |
| **AI (スクリプト)** | GPT-4o-mini Batch | 動画スクリプト生成 | $0.0003 × 1,080本 | **$0.32** | 3セクション分のスクリプト |
| | GPT-4o-mini Batch | ツイート生成 | $0.0002 × 420本 | **$0.08** | |
| **AI (分析)** | GPT-4o | 市場分析 | $0.01 × 30回/月 | **$0.30** | 日次1回 |
| | GPT-4o | パフォーマンス分析 | $0.0075 × 50 × 30 | **$11.25** | アカウント×日数 |
| | GPT-4o Vision | 参考動画分析 | $0.003 × 100本/月 | **$0.30** | 週25本程度 |
| | **AI小計** | | | **$12** | |
| **投稿API** | X API v2 | ツイート投稿 | Basic $200/月 | **$200** | 50,000投稿/月枠 |
| | YouTube/IG/TikTok API | 動画投稿 | 無料 | **$0** | クォータ内 |
| **分析収集** | Apify | TikTok/Twitter指標取得 | Scale $199/月 | **$199** | トレンド分析も兼用 |
| | YouTube/Instagram API | 指標取得 | 無料 | **$0** | |
| **トレンド** | DataForSEO | Google Trends代替 | ~$6/10K検索 | **$10** | |
| | Treendly | 新興トレンド検出 | $99/年 | **$8** | |
| **インフラ** | GCE e2-standard-4 | ワーカー(1台) | $0.134/時 × 24h × 30日 | **$96** | 常時稼働 |
| | Cloud SQL PostgreSQL | メタデータDB | 4vCPU/16GB/100GB SSD | **$27** | Enterprise |
| | Google Drive | 動画保存 | 1,080本 × ~15MB | **$0** | Workspace枠内 |
| | Cloud Tasks | ジョブキュー | 100万ops/月無料 | **$0** | 無料枠内 |
| **────────** | | | | **────────** | |
| **合計** | | | | **$3,079** | |

**fal.ai 残高要件**: $1,000+（40同時タスク解除。2月は3-6同時タスクで十分）

**並列処理**: 36本/日 × 12分/本 = 432分。1ワーカーで7.2時間。余裕あり。


### 4-2. 3月（160アカウント）

**規模**: 動画126本/日(3,780本/月) + ツイート34本/日(1,020本/月)

| カテゴリ | サービス | 用途 | 単価/根拠 | 月額コスト | 備考 |
|---|---|---|---|---|---|
| **動画制作 (fal.ai)** | fal.ai Kling | 動画生成 | $0.35 × 3 × 3,780 | **$3,969** | |
| | fal.ai Lipsync Pro | 口パク同期 | $0.42 × 3 × 3,780 | **$4,763** | |
| **TTS (Fish Audio)** | Fish Audio TTS | TTS音声生成 | ~$0.001 × 3 × 3,780 | **$11** | 直接REST API（fal.ai とは別サービス） |
| | **動画制作+TTS小計** | | | **$8,743** | Std: $6,816 |
| **AI** | GPT-4o-mini Batch | スクリプト(動画+ツイート) | | **$2** | |
| | GPT-4o | 市場分析+パフォーマンス分析 | $0.0075 × 160 × 30 + $0.30 | **$36** | |
| | GPT-4o Vision | 参考動画分析 | $0.003 × 200 | **$1** | |
| | **AI小計** | | | **$39** | |
| **投稿API** | X API v2 Basic | ツイート投稿 | | **$200** | 1,020/月 << 50,000枠 |
| **分析収集** | Apify Scale | TikTok+Twitter指標 | | **$199** | |
| **トレンド** | DataForSEO + Treendly | | | **$18** | |
| **インフラ** | GCE e2-standard-4 × 2 | ワーカー | $96 × 2 | **$192** | 2台で並列処理 |
| | Cloud SQL PostgreSQL | DB | | **$27** | |
| | Redis (Memorystore Basic 1GB) | ジョブキュー | ~$0.049/GB/時 × 730h | **$36** | BullMQ用 |
| | Cloud Tasks | オーケストレーション | | **$0** | |
| **────────** | | | | **────────** | |
| **合計** | | | | **$9,556** | |

**並列処理**: 126本/日 × 12分 = 1,512分 = 25.2時間（順次）。2ワーカーで12.6時間。3台が安全。
**fal.ai同時タスク**: ピーク時 ~15-20タスク（40枠内）。


### 4-3. 4月（340アカウント）

**規模**: 動画276本/日(8,280本/月) + ツイート64本/日(1,920本/月)

| カテゴリ | サービス | 用途 | 単価/根拠 | 月額コスト | 備考 |
|---|---|---|---|---|---|
| **動画制作 (fal.ai)** | fal.ai Kling | 動画生成 | $0.35 × 3 × 8,280 | **$8,694** | |
| | fal.ai Lipsync Pro | 口パク同期 | $0.42 × 3 × 8,280 | **$10,433** | |
| **TTS (Fish Audio)** | Fish Audio TTS | TTS音声生成 | ~$0.001 × 3 × 8,280 | **$25** | 直接REST API（fal.ai とは別サービス） |
| | **動画制作+TTS小計** | | | **$19,152** | Std: $14,929 |
| **AI** | GPT-4o-mini Batch | スクリプト | | **$4** | |
| | GPT-4o | 分析全般 | $0.0075 × 340 × 30 | **$77** | |
| | GPT-4o Vision | 参考動画 | | **$2** | |
| | **AI小計** | | | **$83** | |
| **投稿API** | X API v2 Basic | ツイート | | **$200** | |
| **分析収集** | Apify Scale | 指標取得 | | **$199** | |
| **トレンド** | DataForSEO + Treendly | | | **$25** | |
| **インフラ** | GCE e2-standard-4 × 5 | ワーカー | $96 × 5 | **$480** | 5台並列 |
| | Cloud SQL PostgreSQL | DB | 8vCPU/32GB スケールアップ | **$55** | |
| | Redis (Memorystore 2GB) | キュー | | **$72** | |
| | Cloud Tasks | | | **$0** | |
| **────────** | | | | **────────** | |
| **合計** | | | | **$20,490** | |

**並列処理**: 276本/日 = 11.5本/時。12分/本 → 常時2.3本同時処理。5ワーカーで余裕あり。
**fal.ai同時タスク**: ピーク時 ~25-30（40枠内だが余裕が少ない）。


### 4-4. 5月（1,480アカウント）

**規模**: 動画1,176本/日(35,280本/月) + ツイート304本/日(9,120本/月)

| カテゴリ | サービス | 用途 | 単価/根拠 | 月額コスト | 備考 |
|---|---|---|---|---|---|
| **動画制作 (fal.ai)** | fal.ai Kling | 動画生成 | $0.35 × 3 × 35,280 | **$37,044** | |
| | fal.ai Lipsync Pro | 口パク同期 | $0.42 × 3 × 35,280 | **$44,453** | → **Std版推奨** |
| **TTS (Fish Audio)** | Fish Audio TTS | TTS音声生成 | ~$0.001 × 3 × 35,280 | **$106** | 直接REST API（fal.ai とは別サービス） |
| | **動画制作+TTS小計(Pro)** | | | **$81,603** | |
| | **動画制作+TTS小計(Std)** | | Lipsync Std $0.25/セクション | **$63,610** | **Std版を強く推奨** |
| **AI** | GPT-4o-mini Batch | スクリプト | | **$14** | |
| | GPT-4o | 分析全般 | $0.0075 × 1,480 × 30 | **$333** | |
| | GPT-4o Vision | 参考動画 | | **$5** | |
| | **AI小計** | | | **$352** | |
| **投稿API** | X API v2 Basic | ツイート | 9,120 << 50,000枠 | **$200** | |
| | YouTube API | 追加クォータ申請 | 複数GCPプロジェクト必要 | **$0** | 審査通過必須 |
| **分析収集** | Apify Scale | 指標取得 | | **$199** | |
| | Bright Data プロキシ | バックアップ | Growth $499/月 | **$499** | TikTok補完 |
| **トレンド** | DataForSEO + Treendly | | | **$50** | |
| **インフラ** | GCE e2-standard-4 × 15 | ワーカー | $96 × 15 | **$1,440** | |
| | 　又は Spot VM × 15 | コスト削減版 | $44.6 × 15 | **$669** | 60%削減 |
| | Cloud SQL PostgreSQL | DB | 16vCPU/64GB | **$120** | |
| | Redis (Memorystore 5GB) | キュー | | **$180** | |
| | Cloud Tasks | | | **$1** | |
| **────────** | | | | **────────** | |
| **合計(Pro+OnDemand)** | | | | **$85,596** | |
| **合計(Std+Spot)** | | | | **$66,832** | **推奨構成** |

**並列処理**: 1,176本/日 = 49本/時。12分/本 → 常時9.8本同時。15ワーカーで十分。
**fal.ai同時タスク**: ピーク時 ~40-60。**エンタープライズプラン交渉必須**。
**重要**: 5月からLipsync Standardへの切替を強く推奨（月$18,000のコスト削減）。


### 4-5. 6月（3,500アカウント）

**規模**: 動画2,880本/日(86,400本/月) + ツイート620本/日(18,600本/月)

| カテゴリ | サービス | 用途 | 単価/根拠 | 月額コスト | 備考 |
|---|---|---|---|---|---|
| **動画制作 (fal.ai)** | fal.ai Kling | 動画生成 | $0.35 × 3 × 86,400 | **$90,720** | |
| | fal.ai Lipsync **Std** | 口パク同期 | $0.25 × 3 × 86,400 | **$64,800** | **Std版必須** |
| **TTS (Fish Audio)** | Fish Audio TTS | TTS音声生成 | ~$0.001 × 3 × 86,400 | **$259** | 直接REST API（fal.ai とは別サービス） |
| | **動画制作+TTS小計(Std)** | | | **$155,779** | Pro版だと$199,419 |
| **AI** | GPT-4o-mini Batch | スクリプト生成 | ~$0.0003 × 86,400 + $0.0002 × 18,600 | **$30** | |
| | GPT-4o | 市場分析+パフォ分析 | $0.0075 × 3,500 × 30 | **$788** | |
| | GPT-4o Vision | 参考動画 | $0.003 × 500 | **$2** | |
| | **AI小計** | | | **$820** | |
| **投稿API** | X API v2 Basic | ツイート | 18,600 << 50,000枠 | **$200** | |
| | YouTube API | 動画投稿 | 複数プロジェクト+クォータ増加 | **$0** | 16+プロジェクト必要 |
| | TikTok Content Posting | 動画投稿 | 960アカウント×15投稿/日=十分 | **$0** | 全アカウントOAuth必須 |
| | Instagram Graph API | Reels投稿 | 960アカウント×25投稿/日=十分 | **$0** | Business/Creator要 |
| **分析収集** | Apify Scale | TikTok+Twitter指標 | | **$199** | |
| | Bright Data Growth | プロキシ+バックアップ | | **$499** | |
| **トレンド** | DataForSEO + Treendly | | | **$80** | |
| **インフラ** | GCE Spot VM × 40 | ワーカー | $0.0619/h × 24 × 30 × 40 | **$1,787** | e2-standard-4 |
| | 　又は Cloud Run | オートスケール | $0.000024/vCPU秒 × 見積 | **$2,500** | ピーク対応可 |
| | Cloud SQL PostgreSQL | DB | 32vCPU/128GB | **$250** | HA構成推奨 |
| | Redis (Memorystore 10GB) | キュー | | **$360** | |
| | Cloud Storage | 動画一時保存 | 86,400 × 15MB × $0.02/GB | **$26** | Drive前のバッファ |
| | Cloud Tasks | ジョブ管理 | ~5M ops/月 | **$2** | |
| | Cloud Monitoring | 監視 | | **$50** | |
| **────────** | | | | **────────** | |
| **合計(Std+Spot)** | | | | **$162,385** | |

> **注意**: GCE Spot VMとCloud Runは代替構成（「又は」）であり、併用前提ではない。上記合計はSpot VM構成。Cloud Run構成の場合はインフラ費+$713（合計$163,098）。

**並列処理の詳細計算**:
- 2,880本/日 ÷ 20時間（4時間バッファ）= 144本/時
- 144本 × 12分/本 ÷ 60分 = **常時28.8本を同時処理**
- 各動画 = 3 fal.aiタスク（セクション並列）+ Lipsync 3タスク = 計6外部API呼出/動画
- ピーク時fal.ai同時タスク: 28.8 × 3 = **~87タスク** → **エンタープライズプラン必須**

**fal.aiエンタープライズ**: 同時100+タスク、ボリュームディスカウント（20-30%削減の可能性）で動画制作費 **$110,000-130,000/月** まで下がる可能性あり。要交渉。


## 5. インフラ設計

### アーキテクチャ全体図

```
                    ┌──────────────────┐
                    │  Cloud Scheduler  │ (日次トリガー)
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │   Cloud Tasks    │ (ジョブキュー)
                    │  + Redis/BullMQ  │
                    └────────┬─────────┘
                             ▼
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Worker VM 1 │ │ Worker VM 2 │ │ Worker VM N │  (GCE Spot / Cloud Run)
    │  Node.js    │ │  Node.js    │ │  Node.js    │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
    ┌──────┴───────────────┴───────────────┴──────┐
    │              外部API層                        │
    │  fal.ai (Kling / Lipsync)                      │
│  Fish Audio TTS (直接API、別サービス)           │
    │  OpenAI GPT-4o / GPT-4o-mini                 │
    │  Platform APIs (YouTube/IG/TikTok/X)         │
    │  Apify (スクレイピング)                       │
    └──────────────────┬──────────────────────────┘
                       ▼
    ┌──────────────────────────────────────────────┐
    │              データ層                          │
    │  Cloud SQL (PostgreSQL) — メタデータ/履歴      │
    │  Google Sheets — インベントリ/production       │
    │  Google Drive — 動画/アセット保存              │
    │  Cloud Storage — 一時バッファ                  │
    └──────────────────────────────────────────────┘
```

### ワーカーVM スペック

| 月 | アカウント数 | 動画/日 | 必要ワーカー数 | VMタイプ | 合計vCPU | 合計メモリ |
|---|---|---|---|---|---|---|
| 2月 | 50 | 36 | 1 | e2-standard-4 | 4 | 16GB |
| 3月 | 160 | 126 | 2-3 | e2-standard-4 | 8-12 | 32-48GB |
| 4月 | 340 | 276 | 5 | e2-standard-4 | 20 | 80GB |
| 5月 | 1,480 | 1,176 | 15 | e2-standard-4 (Spot) | 60 | 240GB |
| 6月 | 3,500 | 2,880 | 40 | e2-standard-4 (Spot) | 160 | 640GB |

### データベース設計

```sql
-- アカウント管理
accounts (account_id, platform, persona, oauth_tokens, status, created_at)

-- コンテンツ履歴
content_history (content_id, account_id, type, script, components, posted_at)

-- パフォーマンスデータ
performance (content_id, platform, views, likes, comments, shares, collected_at)

-- コンポーネントスコア
component_scores (component_id, type, score, times_used, last_updated)

-- トレンドデータ
trends (trend_id, platform, topic, score, detected_at)

-- 学習データ
learning_insights (insight_id, hypothesis, result, confidence, created_at)
```

### Cloud SQL サイジング

| 月 | レコード見積(累積) | インスタンス | 月額 |
|---|---|---|---|
| 2月 | ~50K | db-custom-4-16384 (4vCPU/16GB/100GB) | $27 |
| 3月 | ~200K | 同上 | $27 |
| 4月 | ~500K | db-custom-8-32768 (8vCPU/32GB/200GB) | $55 |
| 5月 | ~2M | db-custom-16-65536 (16vCPU/64GB/500GB) | $120 |
| 6月 | ~5M | db-custom-32-131072 (32vCPU/128GB/1TB) | $250 |


## 6. 並列化戦略

### 問題: 6月に2,880動画/日を24時間以内に制作

| 制約 | 値 | 計算 |
|---|---|---|
| 1動画の制作時間 | ~12分 | Kling(5min) + TTS(5s) + Lipsync(2min) + ffmpeg(30s) + upload(1min) |
| 順次処理した場合 | 34,560分 = 576時間 | 2,880 × 12分 |
| 利用可能時間 | 20時間/日 | 4時間のバッファ |
| 必要な同時処理数 | **29本** | 2,880 ÷ 20h ÷ (60/12) |
| fal.ai同時タスク | **87** | 29 × 3セクション |

### 戦略

```
Phase A: 深夜0時〜6時 (6時間)
  - 市場分析 + トレンド取得 (Phase 1)
  - 前日のパフォーマンスデータ収集 (Phase 7)
  - スクリプト一括生成 (Phase 3, Batch API)

Phase B: 6時〜22時 (16時間) — メイン制作ウィンドウ
  - 2,880本を16時間で制作 = 180本/時
  - 30本同時処理 × 各12分 → 150本/時（安全マージン付き）
  - 40ワーカーVMで分散処理

Phase C: 随時
  - 完成した動画から順次投稿 (Phase 6)
  - 投稿はAPIレート制限に従いキューで分散

Phase D: 22時〜24時 (2時間)
  - 分析処理 (Phase 8)
  - 学習ループ更新 (Phase 9)
```

### fal.ai 同時タスク制限の対処

| 戦略 | 同時タスク数 | 対象月 |
|---|---|---|
| $1,000チャージ | 40 | 2月〜4月 |
| エンタープライズ契約 | 100+ | 5月〜 |
| 複数fal.aiアカウント | 40 × N | フォールバック |
| 代替サービス分散 | Runway Gen-4 Turbo併用 | 6月（リスク分散） |

### 投稿APIのレート制限対処

| プラットフォーム | 制限 | 6月の必要量 | 対処 |
|---|---|---|---|
| **TikTok** | ~15投稿/日/アカウント | 960投稿/日(960アカウント×1) | **各アカウント1投稿/日なので制限内** |
| **YouTube** | ~10本/日/チャンネル + 6本/日/プロジェクト | 960投稿/日 | チャンネルは問題なし。**GCPプロジェクト16個+クォータ増加**必要 |
| **Instagram** | 25投稿/日/アカウント | 960投稿/日(960アカウント×1) | **制限内** |
| **Twitter/X** | 50,000投稿/月(Basic) | 18,600投稿/月 | **Basic Plan内** |

> **重要**: 各アカウントが1日1投稿なので、アカウントあたりの制限は全プラットフォームで余裕がある。問題はYouTube APIの**プロジェクト単位のクォータ**のみ。


## 7. 総コストサマリー

### 月別コスト推移（推奨構成: Lipsync Std + Spot VM）

| 月 | アカウント | 動画/月 | 動画制作費 | AI費 | 投稿/分析費 | インフラ費 | **合計** |
|---|---|---|---|---|---|---|---|
| **2月** | 50 | 1,080 | $1,947 | $12 | $417 | $123 | **$2,499** |
| **3月** | 160 | 3,780 | $6,816 | $39 | $417 | $255 | **$7,527** |
| **4月** | 340 | 8,280 | $14,929 | $83 | $424 | $607 | **$16,043** |
| **5月** | 1,480 | 35,280 | $63,610 | $352 | $948 | $970 | **$65,880** |
| **6月** | 3,500 | 86,400 | $155,779 | $820 | $978 | $2,475 | **$160,052** |
| **────** | | | | | | | **────────** |
| **5ヶ月累計** | | 134,820 | $243,081 | $1,306 | $3,184 | $4,430 | **$252,001** |

### コスト構成比（6月）

| カテゴリ | 月額 | 構成比 |
|---|---|---|
| 動画制作（fal.ai）+ TTS（Fish Audio） | $155,779 | **97.3%** |
| AI（OpenAI） | $820 | 0.5% |
| 投稿/分析 | $978 | 0.6% |
| インフラ | $2,475 | 1.5% |

> **動画制作APIが総コストの97%を占める**。fal.aiとのエンタープライズ交渉でのボリュームディスカウント（20-30%）が最大のコスト削減レバー。

### コスト削減オプション

| 施策 | 効果 | トレードオフ |
|---|---|---|
| **Lipsync Pro→Std** | -27%（6月で-$43,200/月） | 口パク品質がやや低下 |
| **Kling v1.6 Std** ($0.045/秒) | -36%（動画生成コスト） | v2.6より画質低下 |
| **fal.aiエンタープライズ** | -20〜30%（推定） | 要交渉・最低契約あり |
| **LatentSync** ($0.20/動画) | Lipsync費を-70% | fal.ai経由、品質要検証 |
| **Fish Audio TTS**（独立サービス） | TTS費-90%（移行済み） | ElevenLabsから移行完了。fal.ai とは別の直接REST API |
| **Spot VM** | インフラ費-54% | 中断リスクあり（リトライで対応） |

### 最大削減時の見積もり（6月）

| 項目 | 標準構成 | 最大削減構成 | 削減額 |
|---|---|---|---|
| 動画生成（Kling v1.6 Std） | $90,720 | $58,320 | -$32,400 |
| TTS（Fish Audio） | $259 | $259 | $0（移行済み） |
| Lipsync（LatentSync） | $64,800 | $17,280 | -$47,520 |
| AI | $820 | $820 | $0 |
| 投稿/分析 | $978 | $978 | $0 |
| インフラ（Spot） | $2,475 | $2,475 | $0 |
| **合計** | **$160,052** | **$79,132** | **-$80,920 (-51%)** |


## 8. リスクと制約

### 技術的リスク

| リスク | 影響度 | 対策 |
|---|---|---|
| **fal.ai同時タスク上限** | 高 | エンタープライズ交渉 / 複数アカウント / Runway併用 |
| **YouTube APIクォータ** | 高 | 複数GCPプロジェクト + コンプライアンス審査通過 |
| **TikTok審査不通過** | 中 | 段階的にアカウント追加、OpenClaw/Playwright代替 |
| **OAuthトークン管理** | 中 | DB一元管理 + 自動リフレッシュ + 失効アラート |
| **Spot VMの中断** | 低 | リトライメカニズム + 部分的にオンデマンド併用 |

### ビジネスリスク

| リスク | 影響度 | 対策 |
|---|---|---|
| **プラットフォームの規約変更** | 高 | マルチプラットフォーム分散、API変更の即時対応体制 |
| **アカウントBAN** | 高 | 自然な投稿パターン（時間帯分散）、コンテンツ品質重視 |
| **fal.ai料金値上げ** | 中 | 代替サービス検証（Runway, Hailuo）、直接API契約検討 |
| **AI生成コンテンツの規制強化** | 中 | AI生成の開示対応、品質重視でスパム認定回避 |

### 未解決の課題

1. **YouTube OAuthの大規模セットアップ**: 960チャンネルの認証フローの自動化が必要
2. **TikTok Content Posting API審査**: 商用大規模利用の審査基準が不明確
3. **Instagram Business Account一括作成**: Facebook Page連携が各アカウントに必要
4. **fal.aiエンタープライズ**: 契約条件・ボリュームディスカウント率が未確認


## 9. 参照URL一覧

### 動画制作API
| サービス | URL |
|---|---|
| fal.ai 料金一覧 | https://fal.ai/pricing |
| fal.ai Kling v2.6 | https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control |
| fal.ai Sync Lipsync Pro | https://fal.ai/models/fal-ai/sync-lipsync/v2/pro |
| fal.ai Sync Lipsync Standard | https://fal.ai/models/fal-ai/sync-lipsync/v2 |
| fal.ai LatentSync | https://fal.ai/models/fal-ai/latentsync |
| Fish Audio | https://fish.audio |
| fal.ai Enterprise | https://fal.ai/enterprise |
| Runway API Pricing | https://docs.dev.runwayml.com/guides/pricing/ |

### AI API
| サービス | URL |
|---|---|
| OpenAI Pricing | https://platform.openai.com/docs/pricing |
| OpenAI Rate Limits | https://platform.openai.com/docs/guides/rate-limits |
| OpenAI Batch API | https://platform.openai.com/docs/guides/batch |
| OpenAI Vision | https://platform.openai.com/docs/guides/images-vision |
| Anthropic Claude Pricing | https://docs.anthropic.com/en/docs/about-claude/pricing |

### 投稿API
| サービス | URL |
|---|---|
| YouTube Data API Quota | https://developers.google.com/youtube/v3/determine_quota_cost |
| YouTube Compliance Audits | https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits |
| Instagram Graph API | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api |
| TikTok Content Posting API | https://developers.tiktok.com/doc/content-posting-api-reference-direct-post |
| TikTok Rate Limits | https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit |
| X API Documentation | https://docs.x.com/x-api |

### 分析・スクレイピング
| サービス | URL |
|---|---|
| YouTube Analytics API | https://developers.google.com/youtube/analytics |
| Apify Pricing | https://apify.com/pricing |
| Apify TikTok Scraper | https://apify.com/apidojo/tiktok-scraper-api |
| Bright Data | https://brightdata.com/ |
| DataForSEO | https://dataforseo.com/ |
| Treendly | https://treendly.com/ |

### インフラ
| サービス | URL |
|---|---|
| GCE Pricing | https://cloud.google.com/compute/all-pricing |
| Cloud SQL Pricing | https://cloud.google.com/sql/pricing |
| Cloud Run Pricing | https://cloud.google.com/run/pricing |
| Cloud Tasks Pricing | https://cloud.google.com/tasks/pricing |
| Memorystore Redis Pricing | https://cloud.google.com/memorystore/docs/redis/pricing |


> **本ドキュメントは仮説ベースの設計見積もりです。** 実運用開始前に fal.ai エンタープライズ交渉、YouTube API クォータ増加申請、TikTok Content Posting API 審査を完了する必要があります。
