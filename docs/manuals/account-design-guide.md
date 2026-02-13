# アカウント設計ガイド

50アカウント運用に向けた、ペルソナ設計からインベントリ登録までの完全ガイド。


## 目次

1. [全体像](#1-全体像)
2. [設計の考え方](#2-設計の考え方)
3. [Step 1: ペルソナを設計する](#3-step-1-ペルソナを設計する)
4. [Step 2: キャラクター画像を準備する](#4-step-2-キャラクター画像を準備する)
5. [Step 3: シナリオを準備する](#5-step-3-シナリオを準備する)
6. [Step 4: インベントリに登録する](#6-step-4-インベントリに登録する)
7. [Step 5: 動画制作行を作成する](#7-step-5-動画制作行を作成する)
8. [設計テンプレート](#8-設計テンプレート)
9. [FAQ](#9-faq)


## 1. 全体像

1つの動画を作るには、以下の4つのインベントリにデータが揃っている必要があります。

```
アカウント設計（このガイド）
    │
    ├── Accounts Inventory    … 誰が（ペルソナ × プラットフォーム）
    ├── Characters Inventory  … どんな見た目で（キャラクター画像）
    ├── Scenarios Inventory   … 何を話すか（hook / body / cta のスクリプト）
    └── Motions Inventory     … どう動くか（参照モーション動画）
                                  ↓
                        production タブに1行追加
                                  ↓
                        パイプラインが自動で動画生成
```

### インベントリ間の関係

```
Accounts ──(character_id)──► Characters
    │                            │
    │                      画像1枚（顔写真）
    │
    └──► production タブ ──(scenario_ids)──► Scenarios（スクリプト3本）
                         ──(motion_ids)───► Motions（参照動画3本）
```

**ポイント**: 1つのキャラクター(CHR_XXXX)を複数のアカウントで共有できます。同一人物が YouTube / TikTok / Instagram に投稿するイメージです。


## 2. 設計の考え方

### 2.1 アカウント展開パターン

| パターン | 説明 | 例 |
|---|---|---|
| **1キャラ × 3プラットフォーム** | 同じペルソナをYT/TT/IGに展開 | Violet → YouTube, TikTok, Instagram |
| **1ニッチ × 複数キャラ** | 同じジャンルで異なるペルソナ | AI Tools ニッチ → Violet(女性), Ken(男性) |
| **1キャラ × 複数ニッチ** | 1人が複数テーマを扱う | Violet → AI Tools, Productivity, SaaS |

**50アカウントの構成例**:

| キャラクター数 | プラットフォーム | アカウント数 |
|---|---|---|
| 17キャラ | × 3 (YT/TT/IG) | = 51アカウント |
| 10キャラ | × 3 + 一部2 | = 50アカウント |
| 25キャラ | × 2 (TT/IG) | = 50アカウント |

### 2.2 ニッチカテゴリの例

| ニッチ | ターゲット | コンテンツ例 |
|---|---|---|
| `ai_tools` | ビジネスパーソン | AI SaaS紹介、生産性向上Tips |
| `productivity` | 会社員・リモートワーカー | 時短術、ツール比較 |
| `startup_tips` | 起業家・副業希望者 | ビジネスアイデア、成功事例 |
| `beauty_tech` | 美容に関心のある層 | AI美容ツール、スキンケアTech |
| `finance` | 投資・節約に興味がある層 | 家計管理アプリ、投資Tips |
| `study_hack` | 学生・資格勉強中の人 | AI学習ツール、勉強法 |
| `health_fitness` | 健康意識が高い層 | フィットネスアプリ、健康管理 |
| `cooking_tech` | 料理好き | AIレシピ、スマートキッチン |

### 2.3 ターゲット地域 × 言語

| target_region | 言語 | script_language | 使用されるスクリプト | 備考 |
|---|---|---|---|---|
| `JP` | 日本語 | `jp` | `script_jp` | 日本市場向け |
| `US` | 英語 | `en` | `script_en` | 英語圏市場向け |


## 3. Step 1: ペルソナを設計する

1アカウントにつき以下を決めます。

| 決めること | 説明 | 例 |
|---|---|---|
| **ペルソナ名** | キャラクターの表示名（SNSの名前） | `Violet`, `Mia Chen`, `Ken Sudo` |
| **プラットフォーム** | 投稿先 | `youtube` / `tiktok` / `instagram` |
| **ニッチ** | コンテンツジャンル | `ai_tools`, `productivity` 等 |
| **ターゲット地域** | JP or US | `JP`, `US` |
| **キャラクターの性格・トーン** | strategy_notes に記載 | 「フレンドリーで親しみやすい。専門用語は避ける」 |
| **使用するキャラクター画像** | 既存 or 新規作成 | `CHR_0001` or 新規 `CHR_0002` |
| **ボイス** | Fish Audio reference_id（32文字16進数）**必須** | `a1b2c3d4e5f6...` |

### ペルソナ設計シートの書き方（推奨）

設計段階では、まずスプレッドシートやメモで以下をまとめてからインベントリに登録すると効率的です。

```
ペルソナ名: Mia Chen
キャラクター: 新規 → CHR_0002
ニッチ: startup_tips
地域: US
性格: 自信があり前向き。起業経験を語るスタイル。
プラットフォーム: YouTube, TikTok, Instagram (3アカウント)
→ ACC_0008 (YouTube), ACC_0009 (TikTok), ACC_0010 (Instagram)
```


## 4. Step 2: キャラクター画像を準備する

パイプラインは**キャラクター画像1枚**を元にAI動画を生成します。この画像の品質が動画の品質に直結します。

### 画像の要件

| 項目 | 要件 |
|---|---|
| **形式** | JPG または PNG |
| **推奨サイズ** | 720×1280（縦長）または 1024×1024（正方形） |
| **内容** | 上半身〜バストアップ。顔がはっきり写っていること |
| **背景** | シンプルな背景推奨（オフィス、無地 等） |
| **向き** | 正面 or やや斜め。横顔は非推奨 |

### 画像の準備方法

AI生成（Midjourney, Stable Diffusion 等）でキャラクター画像を作成し、以下の手順で登録します。

### 登録手順

1. **Google Drive にアップロード**
   - Drive フォルダ: `AI-Influencer/Characters/` 配下に `CHR_XXXX` フォルダを作成
   - 画像ファイル名: `CHR_XXXX_v1.jpg`（例: `CHR_0002_v1.jpg`）
   - ファイルをアップロード

2. **Drive ファイルIDを取得**
   - アップロードしたファイルを右クリック → 「リンクを取得」
   - URL内の `/d/` と `/view` の間の文字列がファイルID
   - 例: `https://drive.google.com/file/d/1kRI1TUSWrc6ZYqhuymc255nv4WVA_HK3/view`
   - → ファイルID: `1kRI1TUSWrc6ZYqhuymc255nv4WVA_HK3`

3. **Characters Inventory に登録**（[→ Step 4.2 で詳述](#42-characters-inventory-に登録する)）


## 5. Step 3: シナリオを準備する

1つの動画は **3つのシナリオ**（hook / body / cta）で構成されます。

| セクション | 役割 | 長さの目安 |
|---|---|---|
| **hook** | 最初の1〜3秒で視聴者の注意を引く | 1〜2文 |
| **body** | 本編。価値を伝える | 5〜10文 |
| **cta** | 行動を促す（フォロー、コメント、商品リンク等） | 1〜3文 |

### シナリオの書き方

- `script_en`（英語）と `script_jp`（日本語）の両方を用意する
- production タブの `script_language` カラム（`en` / `jp`）に応じてパイプラインが自動選択する
- 1セット（hook + body + cta）で1つの動画の台本になる

### セット管理

`set_id` カラムを使うと、hook/body/cta を1セットとしてグループ管理できます。

```
SCN_H_0001 (hook)  → set_id: SET_0001
SCN_B_0001 (body)  → set_id: SET_0001
SCN_C_0001 (cta)   → set_id: SET_0001
```

同じ `set_id` のシナリオは、1つの動画用のスクリプトセットとして扱われます。


## 6. Step 4: インベントリに登録する

### 6.1 Accounts Inventory に登録する

**スプレッドシート**: [Accounts Inventory](https://docs.google.com/spreadsheets/d/1CmT6C3qCW3md6lJ9Rvc2WNQkWa5zcvlq6Zp_enJHoUE)

**タブ**: `accounts`

| カラム | 入力内容 | 入力例 | 必須 |
|---|---|---|---|
| `account_id` | `ACC_` + 4桁連番 | `ACC_0008` | **必須** |
| `persona_name` | ペルソナ表示名 | `Mia Chen` | **必須** |
| `platform` | プラットフォーム | `youtube` / `tiktok` / `instagram` | **必須** |
| `email` | アカウントのログインメール | `example@gmail.com` | **必須** |
| `password` | ログインパスワード | （直接入力） | **必須** |
| `target_region` | ターゲット地域 | `JP` / `US` | **必須** |
| `content_niche` | コンテンツジャンル | `ai_tools` / `productivity` 等 | **必須** |
| `manager` | 運用担当者名 | `Badhan` | 任意 |
| `strategy_notes` | 運用方針・メモ | 「フレンドリー、専門用語避ける」 | 推奨 |
| `character_id` | キャラクターID | `CHR_0001` | **必須** |
| `status` | 初期値 `setup` | `setup` | **必須** |
| `created_date` | 作成日 | `2026-02-11` | **必須** |
| `last_posted_at` | 空欄（投稿後に自動更新） | | 空欄 |
| `memo` | 自由メモ | | 任意 |

**同じペルソナで3プラットフォーム展開する場合**: 3行追加し、`persona_name` と `character_id` は同じ、`platform` と `account_id` だけ変える。

#### Gmail認証情報の登録

**タブ**: `gmail_credentials`

| カラム | 入力内容 | 入力例 |
|---|---|---|
| `gmail_id` | `GMAIL_` + 4桁連番 | `GMAIL_0013` |
| `email` | Gmailアドレス | `newaccount@gmail.com` |
| `password` | パスワード | （直接入力） |
| `two_factor_recovery` | 2FAリカバリーコード | `xxxx xxxx xxxx xxxx` |
| `linked_account_ids` | 紐づくアカウントID（カンマ区切り） | `ACC_0008,ACC_0009,ACC_0010` |
| `status` | `active` | `active` |

### 6.2 Characters Inventory に登録する

**スプレッドシート**: [Characters Inventory](https://docs.google.com/spreadsheets/d/1-m4f5LgNmArtpECZqqxFL-6P4eabBmPkOYX2VkFHCHA)

**タブ**: `inventory`

| カラム | 入力内容 | 入力例 | 必須 |
|---|---|---|---|
| `component_id` | `CHR_` + 4桁連番 | `CHR_0002` | **必須** |
| `type` | 固定値 `character` | `character` | **必須** |
| `name` | キャラクター名 | `Mia` | **必須** |
| `description` | キャラクターの説明 | `Startup advisor persona` | 推奨 |
| `file_link` | Drive上の画像URL | `https://drive.google.com/file/d/XXXXX/view` | **必須** |
| `tags` | タグ（カンマ区切り） | `female,startup,us` | 推奨 |
| `times_used` | `0`（初期値） | `0` | **必須** |
| `avg_performance_score` | 空欄（自動計算） | | 空欄 |
| `created_date` | 作成日 | `2026-02-11` | **必須** |
| `status` | `active` | `active` | **必須** |
| `drive_file_id` | **画像のDriveファイルID** | `1kRI1TUSWrc6ZYqhuymc255nv4WVA_HK3` | **必須** |

> **重要**: `drive_file_id` はパイプラインが画像を取得するために使います。`file_link` は人間がブラウザで確認するためのURLです。**両方必要です**。

### 6.3 Scenarios Inventory に登録する

**スプレッドシート**: [Scenarios Inventory](https://docs.google.com/spreadsheets/d/13Meu7cniKUr1JiEyKla0qhfiV9Az1IFuzIedzDxjpiY)

**タブ**: `inventory`

1つの動画につき **3行**（hook / body / cta）を登録します。

| カラム | 入力内容 | 入力例 | 必須 |
|---|---|---|---|
| `component_id` | タイプ別ID | `SCN_H_0002`(hook) / `SCN_B_0002`(body) / `SCN_C_0002`(cta) | **必須** |
| `type` | セクションタイプ | `hook` / `body` / `cta` | **必須** |
| `name` | シナリオ名 | `Startup pitch hook` | **必須** |
| `description` | 説明 | `起業の最初の一歩について` | 推奨 |
| `file_link` | 空欄 | | 空欄 |
| `tags` | タグ | `hook,startup,motivation` | 推奨 |
| `times_used` | `0` | `0` | **必須** |
| `avg_performance_score` | 空欄 | | 空欄 |
| `created_date` | 作成日 | `2026-02-11` | **必須** |
| `status` | `active` | `active` | **必須** |
| `script_en` | **英語スクリプト全文** | `"Did you know that 90% of startups..."` | **必須** |
| `script_jp` | **日本語スクリプト全文** | `「スタートアップの90%が...」` | 推奨 |

#### component_id のルール

| セクション | プレフィックス | 例 |
|---|---|---|
| hook | `SCN_H_` | `SCN_H_0001`, `SCN_H_0002` |
| body | `SCN_B_` | `SCN_B_0001`, `SCN_B_0002` |
| cta | `SCN_C_` | `SCN_C_0001`, `SCN_C_0002` |

### 6.4 Motions Inventory（通常は追加不要）

モーション動画はキャラクターの「動き方」の参照動画です。現在3本（hook用/body用/cta用）が登録済みで、**全キャラクターで共有可能**です。新しいモーションパターンを追加したい場合のみ登録が必要です。

**スプレッドシート**: [Motions Inventory](https://docs.google.com/spreadsheets/d/1ycnmfpL8OgAI7WvlPTr3Z9p1H8UTmCNMV7ahunMlsEw)


## 7. Step 5: 動画制作行を作成する

全インベントリにデータを登録したら、**production タブ**に1行追加してパイプラインに動画生成を指示します。

**スプレッドシート**: [Master Spreadsheet — production タブ](https://docs.google.com/spreadsheets/d/1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg)

| カラム | 入力内容 | 入力例 |
|---|---|---|
| `video_id` | `VID_YYYYMM_XXXX` | `VID_202602_0002` |
| `account_id` | Accounts の ID | `ACC_0008` |
| `title` | 動画タイトル | `Startup Pitch Hook Test` |
| `edit_status` | `ready` にすると実行対象 | `ready` |
| `character_id` | Characters の ID | `CHR_0002` |
| `hook_scenario_id` | hook シナリオID | `SCN_H_0002` |
| `body_scenario_id` | body シナリオID | `SCN_B_0002` |
| `cta_scenario_id` | cta シナリオID | `SCN_C_0002` |
| `hook_motion_id` | hook モーションID | `MOT_0001` |
| `body_motion_id` | body モーションID | `MOT_0002` |
| `cta_motion_id` | cta モーションID | `MOT_0003` |
| `voice_id` | Fish Audio reference_id **必須** | `a1b2c3d4e5f6...` |
| `script_language` | TTS音声生成に使用するスクリプト言語 **必須** | `en` または `jp` |

他のカラム（`pipeline_status`, `hook_video_url` 等）はパイプラインが自動で埋めます。


## 8. 設計テンプレート

### 50アカウント設計の作業チェックリスト

```
Phase 1: 設計（このガイドの Step 1）
  □ 何キャラクター × 何プラットフォームで50にするか決める
  □ 各キャラクターのペルソナ（名前、ニッチ、地域、性格）を決める
  □ 各キャラクターのSNSアカウントを作成する

Phase 2: 画像準備（Step 2）
  □ キャラクター画像をAI生成 or 用意する
  □ Google Drive Characters/ フォルダにアップロードする
  □ ファイルIDを控える

Phase 3: シナリオ準備（Step 3）
  □ 各ニッチ × 各セクション(hook/body/cta)のスクリプトを書く
  □ 英語版(script_en) + 日本語版(script_jp) を用意する

Phase 4: インベントリ登録（Step 4）
  □ Characters Inventory に画像を登録する
  □ Scenarios Inventory にスクリプトを登録する
  □ Accounts Inventory にアカウント情報を登録する
  □ gmail_credentials にGmail情報を登録する

Phase 5: テスト（Step 5）
  □ production タブに1行追加してテスト動画を作成する
  □ 動画が正しく生成されることを確認する
  □ 問題なければ残りの production 行を追加する
```

### ペルソナ設計テンプレート（1キャラ分）

以下をコピーして各キャラクターごとに記入してください。

```
■ キャラクター基本情報
  character_id:    CHR_XXXX
  名前:
  性別:
  年齢イメージ:
  職業イメージ:
  性格・トーン:

■ コンテンツ設計
  ニッチ:
  ターゲット地域:   JP / US
  ターゲット層:
  言語:            日本語 / 英語

■ プラットフォーム展開
  □ YouTube   → ACC_XXXX
  □ TikTok    → ACC_XXXX
  □ Instagram → ACC_XXXX

■ キャラクター画像
  画像ファイル名:   CHR_XXXX_v1.jpg
  Drive file ID:
  画像の説明:

■ シナリオ（最初の1セット）
  set_id:          SET_XXXX
  hook ID:         SCN_H_XXXX
  body ID:         SCN_B_XXXX
  cta ID:          SCN_C_XXXX
  テーマ:
```


## 9. FAQ

### Q: 1つのキャラクター画像を複数アカウントで使い回せる？
**A: はい。** 同じ `character_id` を複数の `account_id` に設定できます。例えば CHR_0001 を YouTube / TikTok / Instagram の3アカウントで使う場合、3行とも `character_id: CHR_0001` にします。

### Q: シナリオは使い回せる？
**A: はい。** 同じシナリオID（SCN_H_0001等）を複数の production 行で指定できます。ただし、同じ動画が複数アカウントに投稿されることになるため、ニッチやターゲットが同じアカウント間でのみ推奨します。

### Q: モーション動画は追加する必要がある？
**A: 基本的に不要。** 現在の3本（MOT_0001〜0003）は全キャラクターで共有できます。異なる動きのパターン（座っている、歩いている等）が必要な場合のみ追加します。

### Q: voice_id は何を指定する？
**A: Fish Audio の reference_id（32文字の16進数）を指定します。voice_id は必須項目です。** Fish Audio のウェブサイト（https://fish.audio）でボイスを選択し、そのreference_idをコピーしてください。各アカウントに必ず設定する必要があります。

### Q: account_id の連番はどこから始める？
**A: 現在 ACC_0007 まで使用済み。** 新規は `ACC_0008` から始めてください。

### Q: character_id の連番はどこから始める？
**A: 現在 CHR_0001 のみ。** 新規は `CHR_0002` から始めてください。

### Q: シナリオの連番はどこから始める？
**A: 現在各タイプ0001まで使用済み。** 新規は `SCN_H_0002`, `SCN_B_0002`, `SCN_C_0002` から始めてください。

### Q: status はいつ変える？
**A:**
- アカウント作成直後: `setup`
- SNSアカウント作成完了 + インベントリ登録完了: `active` に変更
- 運用停止時: `paused`
- BAN された場合: `banned`


## 関連ドキュメント

| ドキュメント | 内容 |
|---|---|
| [OPERATIONS.md](OPERATIONS.md) | インベントリ管理・動画制作の運用手順書 |
| [README.md](../../README.md) | 全カラムのスキーマ定義・技術リファレンス |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | システム全体図・データフロー |
