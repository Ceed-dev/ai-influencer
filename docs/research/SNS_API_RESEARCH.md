# SNS分析・トレンド調査 API リサーチレポート

> 対象: 最大3,500アカウント管理（TikTok / Instagram / YouTube / Twitter）
> 調査日: 2026-02-11


## 目次

1. [分析収集（メトリクス取得）](#1-分析収集メトリクス取得)
   - [1.1 TikTok API](#11-tiktok-api)
   - [1.2 YouTube Analytics API](#12-youtube-analytics-api)
   - [1.3 Instagram Insights API（Graph API）](#13-instagram-insights-apigraph-api)
   - [1.4 Twitter/X API v2](#14-twitterx-api-v2)
2. [マーケットリサーチ・トレンド分析](#2-マーケットリサーチトレンド分析)
   - [2.1 TikTok Research API](#21-tiktok-research-api)
   - [2.2 YouTube Data API v3](#22-youtube-data-api-v3)
   - [2.3 Google Trends API / SerpAPI](#23-google-trends-api--serpapi)
   - [2.4 スクレイピングツール](#24-スクレイピングツール)
   - [2.5 トレンド検出サービス](#25-トレンド検出サービス)
3. [統合型ソーシャルメディアAPI](#3-統合型ソーシャルメディアapi)
4. [3,500アカウント運用のための推奨構成](#4-3500アカウント運用のための推奨構成)


## 1. 分析収集（メトリクス取得）

### 1.1 TikTok API

#### 概要

TikTokには主に3つのAPI体系がある:

| API | 用途 | アクセス要件 |
|-----|------|-------------|
| **TikTok for Developers (Login Kit + Video API)** | 自アカウントの動画一覧・メトリクス取得 | アプリ登録 + OAuth認証 |
| **TikTok API for Business** | 広告主向け分析 | Business Center登録 |
| **TikTok Research API** | 学術・研究向けデータアクセス | 大学/研究機関所属が必要 |

#### 取得可能メトリクス（Video List API v2）

`/v2/video/list/` エンドポイントで以下のフィールドを取得可能:

```
id, title, cover_image_url, view_count, like_count, comment_count,
share_count, create_time, video_description, hashtag_names,
music_id, region_code, username, effect_ids
```

必要スコープ: `user.info.basic`, `video.list`

#### レート制限

| エンドポイント | 制限 | 単位 |
|---------------|------|------|
| `/v2/video/list/` | 600リクエスト | /分 |
| Content Posting API | 6リクエスト/ユーザー | /分 |
| Research API | 1,000リクエスト | /日（最大100,000レコード/日） |
| 全般 | 1,000リクエスト | /日（リクエストあたり最大100件） |

- クォータリセット: UTC 12:00 AM
- 超過時: HTTP 429 `rate_limit_exceeded`

#### 要件・注意点

- **未審査クライアント**: 投稿した動画は全て「非公開」モードに制限される。制限解除にはTikTok審査が必要
- **Content Posting API**: `video.publish` スコープの承認が必要
- アプリはTikTok Developer Portalで登録

#### 3,500アカウント運用での課題

- 各アカウントごとにOAuth認証が必要
- 600リクエスト/分の制限で、3,500アカウントを毎日ポーリングするには約6分（1リクエスト/アカウント）
- 日次1,000リクエスト制限（Research API）は不十分 → **スクレイピング併用が必要**

#### ソース
- [TikTok API v2 Rate Limits](https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit)
- [TikTok Video List API](https://developers.tiktok.com/doc/tiktok-api-v2-video-list)
- [TikTok API Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes)
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [TikTok API for Business Portal](https://business-api.tiktok.com/portal/docs)


### 1.2 YouTube Analytics API

#### 概要

YouTube Analytics APIはOAuth 2.0認証を使い、チャンネルの詳細分析データを提供する。

#### 取得可能メトリクス

| カテゴリ | メトリクス |
|---------|----------|
| 基本指標 | views, estimatedMinutesWatched, averageViewDuration |
| エンゲージメント | likes, dislikes, comments, shares, subscribersGained, subscribersLost |
| 収益（該当する場合） | estimatedRevenue, estimatedAdRevenue, grossRevenue |
| インプレッション | impressions, impressionClickThroughRate |
| トラフィック | trafficSource, deviceType |

#### クォータシステム

| 操作 | クォータコスト（単位） |
|------|---------------------|
| `reports.query`（分析レポート） | 1単位 |
| `videos.list`（動画詳細） | 1単位 |
| `search.list`（検索） | 100単位 |
| 動画アップロード | 1,600単位 |
| **デフォルト日次クォータ** | **10,000単位/日/プロジェクト** |

#### 複数チャンネル管理

| 方式 | 説明 | 上限 |
|------|------|------|
| **Groups（グループ）** | チャンネル・動画をグループ化して集計分析 | 最大500チャンネル/グループ |
| **Content Owner** | `onBehalfOfContentOwner`パラメータで一括認証 | MCN/CMS向け |
| **個別OAuth** | アカウントごとにOAuth認証 | 制限なし（管理コスト高） |

#### 3,500アカウント運用での課題

- **OAuth認証**: アカウントごとに個別認証が必要（サービスアカウントフロー非対応）
- **クォータ**: デフォルト10,000単位/日。3,500チャンネル x 1単位 = 3,500単位/日（レポート取得のみ）で余裕あり
- **クォータ増加**: Google Cloud Consoleから申請可能。YouTube APIコンプライアンス審査が必要
- **Reporting API**: バルクレポートをスケジュール・ダウンロード可能（大量チャンネル向き）

#### ソース
- [YouTube Analytics API Data Model](https://developers.google.com/youtube/analytics/data_model)
- [YouTube Analytics API Reference](https://developers.google.com/youtube/analytics/reference)
- [YouTube Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube Reporting API](https://developers.google.com/youtube/reporting/v1/reference/rest)
- [YouTube OAuth Implementation](https://developers.google.com/youtube/reporting/guides/authorization)


### 1.3 Instagram Insights API（Graph API）

#### 概要

Instagram Graph API（現在v22.0）でBusiness/Creatorアカウントの分析データを取得可能。

#### 取得可能メトリクス（Reels）

| メトリクス | 説明 |
|-----------|------|
| reach | リーチ数 |
| saved | 保存数 |
| likes | いいね数 |
| comments | コメント数 |
| shares | シェア数 |
| total_interactions | 合計インタラクション |
| **Reels Skip Rate** (新) | 最初の3秒以内にスキップした割合 |

**v21以降で非推奨になったメトリクス（2025年1月8日～）:**
- `video_views`（非Reelsコンテンツ）
- `email_contacts`, `profile_views`, `website_clicks`
- `phone_call_clicks`, `text_message_clicks`

**v22で非推奨:**
- `plays`, `clips_replays_count`
- `ig_reels_aggregated_all_plays_count`, `impressions`（Reels）

#### レート制限

| 項目 | 制限 |
|------|------|
| APIコール | **200リクエスト/時間/Instagramアカウント** |
| リセット | ローリング1時間ウィンドウ |
| 超過時 | HTTP 429 |
| 複数アカウント | アカウントごとに独立カウント（10アカウント=2,000リクエスト/時間） |

> **重要**: 以前は5,000リクエスト/時間だったが、2025年に200リクエスト/時間に大幅削減（96%減）

#### 要件

- Instagram Business または Creator アカウント
- Facebook App登録 + Meta App Review
- Business認証済みアプリはより高い制限と優先処理を受けられる

#### 3,500アカウント運用での課題

- **レート制限計算**: 3,500アカウント x 200リクエスト/時間 = 700,000リクエスト/時間（理論上は十分）
- ただし各アカウントのOAuth認証が個別に必要
- Meta App Reviewの通過が必要
- **非推奨メトリクスへの対応**: v22移行でメトリクス名変更への追従が必要

#### ソース
- [Instagram Graph API Developer Guide 2026](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)
- [Instagram API Rate Limits Explained](https://creatorflow.so/blog/instagram-api-rate-limits-explained/)
- [Meta API Updates for Instagram Marketing API](https://www.socialmediatoday.com/news/meta-announces-updates-for-the-instagram-marketing-api/807083/)
- [Instagram Graph API Guide 2026 (Authentication, Limits, Errors)](https://getlate.dev/blog/instagram-graph-api)


### 1.4 Twitter/X API v2

#### 料金プラン

| プラン | 月額 | ツイート取得数/月 | レート制限 |
|--------|------|------------------|-----------|
| **Free** | $0 | - | 書き込み専用、500投稿/月 |
| **Basic** | $100 | 2M | 制限あり |
| **Pro** | $5,000 | 10M | 高い制限 |
| **Enterprise** | $42,000+ | カスタム | カスタム |

#### 取得可能メトリクス

- ツイートインプレッション
- エンゲージメント数（いいね、リツイート、リプライ）
- いいね/リツイートしたユーザー一覧
- URL クリック数
- プロフィールクリック数

#### レート制限（15分ウィンドウ）

| プラン | リクエスト/15分 |
|--------|----------------|
| Free | 制限厳しい（基本的に書き込み専用） |
| Basic | エンドポイントごとに異なる |
| Pro | 高い制限 |
| Enterprise | カスタム交渉 |

#### 最新動向（2025-2026）

- **従量課金モデル（ベータ）**: 2025年12月より、月額固定ではなく使用量ベースの課金モデルをクローズドベータでテスト中
- レート制限緩和・実使用量に応じた段階的課金に移行予定

#### 3,500アカウント運用での課題

- **コスト**: Free/Basicでは分析取得が実質不可能。Proで$5,000/月、Enterpriseで$42,000+/月
- **代替手段**: スクレイピングまたはサードパーティAPI（後述）の方がコスト効率が高い
- X社の規約変更リスクが高い

#### ソース
- [X (Twitter) API Pricing Tiers 2025](https://twitterapi.io/blog/twitter-api-pricing-2025)
- [Twitter API Limits Guide 2025](https://www.gramfunnels.com/blog/twitter-api-limits)
- [Twitter API Pricing and Limits (Data365)](https://data365.co/guides/twitter-api-limitations-and-pricing)
- [X API Pricing Updates](https://www.socialmediatoday.com/news/x-formerly-twitter-launches-usage-based-api-access-charges/803315/)


## 2. マーケットリサーチ・トレンド分析

### 2.1 TikTok Research API

#### 概要

学術・研究目的で公開TikTokデータにアクセスするためのAPI。

#### 取得可能データ

| データ種別 | 内容 |
|-----------|------|
| 動画検索 | ハッシュタグ・説明文・ユーザーによるクエリ |
| 動画コメント | 公開コメント取得 |
| ユーザーアカウント | 公開プロフィール情報 |
| トレンドハッシュタグ | トレンドハッシュタグデータ |

#### アクセス要件

- **資格**: 米国・欧州の非営利大学の学術研究者
- **申請**: TikTok Developers Portalで研究計画を提出
- **商用利用**: TikTokの書面による許可なしには不可
- **データ保持**: 15日ごとにデータを更新する必要あり

#### レート制限

| 項目 | 制限 |
|------|------|
| 日次リクエスト | 1,000リクエスト/日 |
| レコード取得上限 | 100,000レコード/日 |
| リクエストあたり | 最大100件 |
| リセット | UTC 12:00 AM |

#### 制限事項

- TikTok公式動画・広告は見えない
- カナダ由来の動画、中国関連アカウントは表示されない場合がある
- プライベートメッセージ・削除済みコンテンツは不可
- **商用プロジェクトには不適合**（学術目的のみ）

#### 代替アプローチ

商用利用には以下を推奨:
1. **Apify TikTok Scraper** - $0.006/クエリ（後述）
2. **EnsembleData** - $100/月～
3. **Data365** - カスタム価格
4. **自前スクレイピング** - Playwright + プロキシ

#### ソース
- [TikTok Research API FAQ](https://developers.tiktok.com/doc/research-api-faq)
- [TikTok Research API Product Page](https://developers.tiktok.com/products/research-api/)
- [TikTok Research API Video Query Specs](https://developers.tiktok.com/doc/research-api-specs-query-videos/)


### 2.2 YouTube Data API v3（トレンドリサーチ用）

#### 主要エンドポイント

| エンドポイント | 用途 | クォータコスト |
|---------------|------|-------------|
| `search.list` | キーワード・トピック検索 | **100単位** |
| `videos.list` (chart=mostPopular) | トレンド動画取得 | 1単位 |
| `videoCategories.list` | カテゴリ一覧 | 1単位 |
| `channels.list` | チャンネル情報 | 1単位 |

#### クォータ計算（3,500アカウント・トレンド調査）

```
日次クォータ: 10,000単位（デフォルト）

例: 1日10回の検索 = 10 x 100 = 1,000単位
    + 3,500チャンネル分析  = 3,500単位
    合計: 4,500単位/日 → デフォルトクォータ内
```

- 検索を多用する場合はクォータ増加申請が必要
- ページネーションのたびに100単位消費されるため注意

#### ソース
- [YouTube Data API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube Data API v3 Guide](https://elfsight.com/blog/youtube-data-api-v3-limits-operations-resources-methods-etc/)
- [YouTube Videos: list](https://developers.google.com/youtube/v3/docs/videos/list)


### 2.3 Google Trends API / SerpAPI

#### Google Trends API（公式・アルファ版）

- **ローンチ**: 2025年7月24日
- **ステータス**: アルファ版、アクセス制限あり
- **申請先**: [developers.google.com/search/apis/trends](https://developers.google.com/search/apis/trends)
- **優先される申請者**: リアルタイムユースケース、プロジェクト準備完了、フィードバック提供可能
- **認証**: Google Cloud認証
- **料金**: 未定（アルファ期間中）

#### SerpAPI（Google Trends代替）

| プラン | 月額 | 検索数/月 |
|--------|------|----------|
| Developer | $75 | 5,000 |
| Production | $150 | 15,000 |
| Big Data | $275 | 30,000 |

コスト: 約$15/1,000リクエスト（**高額な部類**）

#### より安価な代替サービス

| サービス | 料金目安 | 特徴 |
|---------|---------|------|
| **DataForSEO** | $6/10K検索 | 最安クラス |
| **Serper** | $50/50Kクエリ（$1/1K） | 高速、従量課金 |
| **SearchCans** | $0.56-0.90/1Kリクエスト | 6ヶ月有効クレジット |
| **ScrapingBee** | $49-599/月 | Google Trends スクレイピング対応 |

#### ソース
- [Google Trends API (Alpha) 公式](https://developers.google.com/search/apis/trends)
- [Google Trends API Announcement](https://developers.google.com/search/blog/2025/07/trends-api)
- [SerpAPI Pricing vs Alternatives](https://www.searchcans.com/blog/serpapi-pricing-alternatives-comparison-2026/)
- [Best Google Trends Scraping APIs 2026 (ScrapingBee)](https://www.scrapingbee.com/blog/best-google-trends-api/)


### 2.4 スクレイピングツール

#### Apify

| 項目 | 詳細 |
|------|------|
| **料金** | 無料（$5クレジット付き）/ Starter $39/月 / Scale $199/月 |
| **TikTok Scraper** | 200投稿/秒、98%成功率、$0.006/クエリ、$0.0003/投稿 |
| **Instagram Scraper** | 100-200投稿/秒、$0.50/1,000投稿 |
| **対応プラットフォーム** | TikTok, Instagram, YouTube, Twitter, Facebook, LinkedIn, Reddit |
| **特徴** | 1,000以上のプリビルトActor（スクレイパー）、ノーコード対応 |

**3,500アカウント向け評価**: コスト効率が高い。TikTok 3,500アカウント x 10投稿 = 35,000投稿 → 約$10.5/回

#### Bright Data

| 項目 | 詳細 |
|------|------|
| **Web Scraper API** | $4/CPM（Pay-As-You-Go）、$3.06/CPM（Growth $499/月） |
| **レジデンシャルプロキシ** | $10.50/GB（Pay-As-You-Go） |
| **モバイルプロキシ** | $14.4/GB～ |
| **データセンタープロキシ** | $0.80/IP |
| **Growth Plan** | $499/月 |
| **Business Plan** | $999/月 |
| **対応プラットフォーム** | Facebook, Twitter, Instagram, TikTok, YouTube等 |
| **特徴** | 150M+ IP、195ヶ国、99.99% uptime |

**ソーシャルメディアスクレイパー**: 25%割引中（6ヶ月、コード: APIS25）

#### ScrapingBee

| プラン | 月額 | APIクレジット | 同時リクエスト |
|--------|------|-------------|--------------|
| Freelance | $49 | 250,000 | 10 |
| Startup | $99 | 1,000,000 | 30 |
| Business | $249 | 3,500,000 | 100 |
| Business+ | $599 | 8,000,000 | 200 |

**注意**: クレジット消費は設定により1x-75xで変動。JS レンダリング・プレミアムプロキシはBusiness以上

#### Oxylabs

| 項目 | 詳細 |
|------|------|
| **レジデンシャルプロキシ** | $4.00/GB（Pay-As-You-Go）、10GB=$80 |
| **モバイルプロキシ** | $9/GB～ |
| **データセンタープロキシ** | $6.75/月～ |
| **ISPプロキシ** | $16/月～ |
| **課金モデル** | 成功ベース課金（成功結果のみ課金） |
| **特徴** | AI駆動アンブロッキング、精密ジオターゲティング |

#### ブラウザ自動化（Playwright / Puppeteer）

| 項目 | Playwright | Puppeteer |
|------|-----------|-----------|
| **ブラウザ対応** | Chromium, Firefox, WebKit | Chrome/Chromium のみ |
| **プロキシ管理** | 組み込みサポート、セッション間ローテーション容易 | 手動設定必要 |
| **ステルス性** | 良好（stealth plugin併用） | 優位（stealth pluginのエコシステムが強い） |
| **大規模運用** | 推奨（並列スクレイピングに強い） | Chrome限定で安定 |
| **料金** | 無料（OSS） | 無料（OSS） |

**大規模運用のベストプラクティス**:
- レジデンシャル/モバイルプロキシ必須（データセンターIPはすぐブロックされる）
- User-Agentローテーション
- 人間的な動作シミュレーション（遅延、マウス移動）
- Cookie/セッション管理
- Sticky session（ログイン状態維持時）

**クラウドブラウザサービス（Browserless）**:
- 無料: 1,000ユニット
- 有料: $250/月～（50同時実行で$500/月）
- セルフホスト: Docker + 商用ライセンス

#### OpenClaw

OpenClawはソーシャルメディアスクレイピングツールではなく、**オープンソースのAIアシスタント**（MIT License）。

| 項目 | 詳細 |
|------|------|
| **種類** | セルフホストAIアシスタント |
| **料金** | 無料（LLM API料金のみ: $5-20/月が目安） |
| **SNS機能** | Twitter/X, Bluesky への投稿・スケジュール（基本的な機能） |
| **本来の用途** | チャットベースのAIアシスタント |

**結論**: SNSスクレイピング用途には不適合

#### ソース
- [Apify Pricing](https://apify.com/pricing)
- [Apify TikTok Scraper API](https://apify.com/apidojo/tiktok-scraper-api)
- [Bright Data Social Media Scraper](https://brightdata.com/products/web-scraper/social-media-scrape)
- [Bright Data Pricing](https://brightdata.com/)
- [ScrapingBee Pricing](https://www.scrapingbee.com/pricing/)
- [Oxylabs Pricing](https://oxylabs.io/pricing)
- [Browserless Pricing](https://www.browserless.io/pricing)
- [OpenClaw Pricing](https://www.getopenclaw.ai/pricing)


### 2.5 トレンド検出サービス

#### エンタープライズ級ソーシャルリスニング

| サービス | 月額 | 特徴 |
|---------|------|------|
| **Brandwatch** | $800-$300,000（要問合せ） | AI駆動リスニング、100M+オンラインソース、感情分析、トレンド検出、競合ベンチマーク |
| **Sprout Social** | $249/月～ | 感情・トレンド分析、競合ベンチマーク、share-of-voice |
| **Hootsuite** | $99/月～ | Talkwalker統合（2024年買収）、サードパーティ連携 |
| **Talkwalker** | 要問合せ | SNS・ニュース・フォーラム・ブログの横断分析、API提供 |

#### 低～中価格帯のトレンド検出

| サービス | 月額 | 特徴 |
|---------|------|------|
| **Google Trends** | 無料 | 検索トレンド・地域分析、APIはアルファ版 |
| **Exploding Topics** | $39-249/月 | Reddit/Google/YouTube/TikTokのデータを分析、Semrushが買収 |
| **Treendly** | $99/年（約$8.25/月） | Exploding Topicsの79%安 |
| **Glimpse** | 無料（10検索/月）、$99/月 | Google Trendsの強化版 |
| **TickerTrends** | $19/月～ | 低コストトレンド検出 |

#### API対応ソーシャルリスニング

| サービス | 月額 | API対応 | 対応プラットフォーム |
|---------|------|---------|-------------------|
| **Phyllo Social Listening API** | カスタム（～$20,000/年） | REST API | 20+ プラットフォーム |
| **Data365** | カスタム | REST API | Instagram, TikTok, YouTube, Twitter, LinkedIn |
| **Talkwalker API** | 要問合せ | REST API | SNS + ニュース + フォーラム + ブログ |

#### ソース
- [Brandwatch Alternatives (Sprout Social)](https://sproutsocial.com/insights/brandwatch-alternatives/)
- [Best Social Listening Tools 2026](https://embedsocial.com/blog/social-listening-tools/)
- [Hootsuite vs Brandwatch](https://www.hootsuite.com/hootsuite-vs-brandwatch)
- [Exploding Topics Pricing](https://tipsonblogging.com/2025/05/exploding-topics-pricing/)
- [Phyllo Pricing](https://www.getphyllo.com/pricing)
- [Data365 Pricing](https://data365.co/pricing)


## 3. 統合型ソーシャルメディアAPI

複数プラットフォームを一元管理するためのAPI:

| サービス | 月額 | 対応プラットフォーム | 特徴 |
|---------|------|-------------------|------|
| **Phyllo** | カスタム（～$20K/年） | 20+（YouTube, Instagram, TikTok, Twitter等） | クリエイターデータ正規化、認証フロー統合 |
| **Data365** | カスタム | Instagram, TikTok, YouTube, Twitter, LinkedIn | 統一API、99.9% uptime |
| **EnsembleData** | $100/月～ | TikTok, Instagram, YouTube | ユニットベース課金、スクレイピングベース |
| **Ayrshare** | 要確認 | TikTok, Instagram, YouTube, Twitter等 | 投稿 + 分析 |
| **SociaVault** | 要確認 | Twitter/X中心 | X API代替 |

#### ソース
- [Phyllo - APIs for Social Data](https://www.getphyllo.com/)
- [Data365 Social Media APIs](https://data365.co/)
- [EnsembleData Pricing](https://ensembledata.com/pricing)
- [Best Unified Social Media APIs 2026](https://www.outstand.so/blog/best-unified-social-media-apis-for-devs)


## 4. 3,500アカウント運用のための推奨構成

### コスト・実現性比較表

| 方式 | 月額概算 | 実現性 | リスク |
|------|---------|--------|--------|
| **全プラットフォーム公式API** | $5,000-50,000+ | 中 | OAuth管理が膨大、X API高額 |
| **Apify中心** | $199-500 | 高 | プラットフォーム変更でActor停止リスク |
| **Bright Data中心** | $499-999 | 高 | 安定性高いがコスト高め |
| **自前Playwright + プロキシ** | $500-2,000（プロキシ代） | 中 | 開発・保守コスト高、ブロックリスク |
| **ハイブリッド（推奨）** | $500-1,500 | 最高 | バランス型 |

### 推奨ハイブリッド構成

```
┌─────────────────────────────────────────────────┐
│                分析収集パイプライン                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  YouTube Analytics API (公式)                     │
│    → 3,500ch: 3,500単位/日 (デフォルト内)           │
│    → OAuth認証管理が最大課題                        │
│    → Reporting API でバルクレポート                  │
│                                                 │
│  Instagram Graph API (公式)                       │
│    → 200リクエスト/時間/アカウント                    │
│    → 3,500アカウントなら公式APIで十分                │
│    → Meta App Review必須                          │
│                                                 │
│  TikTok: Apify TikTok Scraper                    │
│    → $0.0003/投稿、高速・安定                      │
│    → 公式APIはレート制限が厳しすぎる                 │
│                                                 │
│  Twitter/X: Apify or Data365                     │
│    → 公式API Pro ($5,000/月) は高額すぎる           │
│    → スクレイピング代替で95%以上コスト削減            │
│                                                 │
├─────────────────────────────────────────────────┤
│              トレンド分析パイプライン                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  YouTube Data API v3                             │
│    → search.list (100単位/回) で制限的に使用         │
│    → videos.list chart=mostPopular (1単位)         │
│                                                 │
│  Google Trends                                   │
│    → 公式API (アルファ申請) or SerpAPI代替           │
│    → DataForSEO ($6/10K) が最安                    │
│                                                 │
│  TikTok トレンド                                   │
│    → Apify Trending Videos Insights Actor          │
│    → EnsembleData ($100/月～)                      │
│                                                 │
│  Exploding Topics or Treendly                    │
│    → 新興トレンドの早期発見                          │
│    → Treendly: $99/年 (最安)                       │
│                                                 │
│  Bright Data (プロキシ層・バックアップ)              │
│    → レジデンシャルプロキシ $10.50/GB               │
│    → 自前スクレイパーのフォールバック                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 月額コスト見積もり（推奨構成）

| 項目 | 月額 |
|------|------|
| YouTube Analytics API | $0（無料枠内） |
| Instagram Graph API | $0（無料） |
| Apify Scale Plan（TikTok + Twitter スクレイピング） | $199 |
| プロキシ（Bright Data or Oxylabs、バックアップ用） | $100-300 |
| Google Trends代替（DataForSEO等） | $50-100 |
| Treendly（トレンド検出） | $8 |
| **合計** | **$357-607/月** |

### 段階的導入ロードマップ

| フェーズ | 対象 | 期間 |
|---------|------|------|
| Phase 1 | YouTube公式API + Instagram公式API（50アカウント） | 2週間 |
| Phase 2 | Apify TikTok/Twitter追加（200アカウント） | 2週間 |
| Phase 3 | トレンド分析パイプライン構築 | 2週間 |
| Phase 4 | 700アカウントまでスケール | 1ヶ月 |
| Phase 5 | 3,500アカウントへのフルスケール | 2ヶ月 |

### 最重要の技術的課題

1. **OAuth トークン管理**: 3,500アカウントのトークン保存・リフレッシュ・失効管理
2. **レート制限の分散処理**: キューイングシステム（BullMQ等）でAPIコール分散
3. **データ正規化**: 4プラットフォームの異なるメトリクス名称の統一スキーマ
4. **障害回復**: スクレイパー停止時の公式API自動フォールバック
5. **コンプライアンス**: 各プラットフォームのTOS遵守（特にスクレイピング）
