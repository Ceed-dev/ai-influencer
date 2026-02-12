# AI-Influencer 運用マニュアル

> **バージョン**: 4.0
> **最終更新**: 2026-02-10


## 目次

1. [概要](#1-概要)
2. [前提条件](#2-前提条件)
3. [インベントリ管理](#3-インベントリ管理)
   - [3.1 キャラクター追加](#31-キャラクター追加の手順)
   - [3.2 モーション動画追加](#32-モーション動画追加の手順)
   - [3.3 シナリオ追加](#33-シナリオ追加の手順)
   - [3.4 アカウント追加](#34-アカウント追加の手順)
4. [動画制作ワークフロー](#4-動画制作ワークフロー)
   - [4.1 制作行の作成](#41-制作行の作成)
   - [4.2 パイプライン実行](#42-パイプライン実行)
   - [4.3 処理中の確認方法](#43-処理中の確認方法)
   - [4.4 完了後の確認](#44-完了後の確認)
5. [トラブルシューティング](#5-トラブルシューティング)
6. [リファレンス](#6-リファレンス)


## 1. 概要

AI-Influencer は、AIキャラクターの動画コンテンツを自動生成し、SNSに投稿・分析するシステムです。

### 人間が行うこと

- キャラクター画像・モーション動画・シナリオなどの素材をインベントリに登録する
- 制作する動画の組み合わせ（キャラ + シナリオ + モーション）を production タブに設定する
- パイプラインを実行するコマンドを打つ
- 完成した動画を確認する

### 自動で行われること

- キャラクター画像からAI動画を生成（Kling）
- スクリプトから音声を生成（Fish Audio）
- 動画と音声のリップシンク
- 3セクション（hook/body/cta）の結合
- Google Drive への動画アップロード
- スプレッドシートへの結果記録


## 2. 前提条件

### 必要なソフトウェア

| ソフトウェア | 用途 | 確認コマンド |
|---|---|---|
| Node.js (v18以上) | パイプライン実行 | `node --version` |
| ffmpeg | 動画結合 | `ffmpeg -version` |
| npm | パッケージ管理 | `npm --version` |

### 環境変数の設定

プロジェクトのルートディレクトリに `.env` ファイルを作成します。`.env.example` をコピーして編集してください。

```bash
cp .env.example .env
```

`.env` に設定が必要な変数:

| 変数名 | 必須 | 説明 | 例 |
|---|---|---|---|
| `FAL_KEY` | **必須** | fal.ai の APIキー（Kling動画生成・Sync Lipsync に使用） | `fal-xxxxxxxxxxxx` |
| `FISH_AUDIO_API_KEY` | **必須** | Fish Audio の APIキー（TTS音声生成に使用、fal.ai とは別サービス） | `xxxxxxxxxxxxxxxx` |
| `GOOGLE_CREDENTIALS_PATH` | 必須 | Google OAuth 認証情報ファイルのパス | `./video_analytics_hub_claude_code_oauth.json` |
| `GOOGLE_TOKEN_PATH` | 必須 | Google OAuth トークンファイルのパス | `./.gsheets_token.json` |
| `MASTER_SPREADSHEET_ID` | 任意 | Master スプレッドシート ID（デフォルト値あり） | `1fI1s_KLceg...` |
| `YOUTUBE_CLIENT_ID` | 任意 | YouTube投稿用（Phase 2） | - |
| `YOUTUBE_CLIENT_SECRET` | 任意 | YouTube投稿用（Phase 2） | - |
| `YOUTUBE_REFRESH_TOKEN` | 任意 | YouTube投稿用（Phase 2） | - |

> **注意**: `FAL_AI_KEY` という変数名でも動作します（互換性のため）。

### 初回セットアップ

```bash
# 1. 依存パッケージをインストール
npm install

# 2. .env ファイルを作成（上記参照）
cp .env.example .env
# エディタで .env を開き、FAL_KEY などを入力

# 3. Google OAuth 認証情報を配置
# video_analytics_hub_claude_code_oauth.json をプロジェクトルートに配置

# 4. 動作確認（ドライラン）
node scripts/run-pipeline.js --dry-run --limit 1
```


## 3. インベントリ管理

インベントリとは、動画制作に使う素材（キャラクター、モーション、シナリオなど）のデータベースです。各インベントリは独立した Google スプレッドシートで管理されており、すべて `inventory` という名前のタブに情報を入力します。

### 共通カラム

すべてのインベントリには以下の共通カラムがあります:

| カラム | 説明 | 入力例 |
|---|---|---|
| `component_id` | 一意のID | `CHR_0001`, `MOT_0001`, `SCN_H_0001` |
| `type` | 素材のタイプ | `character`, `hook`, `body`, `cta` |
| `name` | 素材の名前 | `Yuki_default`, `wave_hello` |
| `description` | 説明 | `明るい表情の正面画像` |
| `file_link` | Drive上のファイルURL | `https://drive.google.com/file/d/xxxxx/view` |
| `drive_file_id` | DriveのファイルID | `1abc...xyz`（推奨: file_linkより確実） |
| `tags` | タグ（カンマ区切り） | `beauty,japanese,female` |
| `times_used` | 使用回数（自動更新） | `5` |
| `avg_performance_score` | 平均パフォーマンス（自動更新） | `7.2` |
| `created_date` | 作成日 | `2026-02-10` |
| `status` | ステータス | `active` / `inactive` |


### 3.1 キャラクター追加の手順

**スプレッドシート**: [Characters Inventory](https://docs.google.com/spreadsheets/d/1-m4f5LgNmArtpECZqqxFL-6P4eabBmPkOYX2VkFHCHA)

#### 手順

1. **キャラクター画像を用意する**
   - 推奨フォーマット: JPG または PNG
   - 推奨構図: 正面向き、上半身以上が映っている
   - 解像度: 512x512 以上推奨
   - 人物が鮮明に映っていること（AI動画生成の品質に影響します）

2. **Google Drive にフォルダを作成する**
   - [Characters/Images/ フォルダ](https://drive.google.com/drive/folders/1g8OsaH0sFfHe91zEY22MdbllWPp3HJZK) を開く
   - 「新しいフォルダ」を作成し、`CHR_XXXX` という名前をつける（例: `CHR_0002`）
   - 番号は既存のフォルダの最大値 + 1 にする

3. **画像をアップロードする**
   - 作成したフォルダ内に画像ファイルをアップロードする
   - 1フォルダに1画像を推奨

4. **Drive のファイル ID を取得する**
   - アップロードした画像を右クリック → 「リンクを取得」
   - URL は `https://drive.google.com/file/d/{ファイルID}/view` の形式
   - `{ファイルID}` の部分をコピーする（英数字とハイフン・アンダースコアの文字列）

5. **Characters Inventory スプレッドシートを開く**
   - 上記リンクからスプレッドシートを開く
   - `inventory` タブを選択する

6. **新しい行を追加する**
   - 最終行の下に新しい行を追加する
   - 以下のカラムを入力する:

| カラム | 入力内容 | 入力例 |
|---|---|---|
| `component_id` | `CHR_` + 4桁の連番 | `CHR_0002` |
| `type` | `character` と入力 | `character` |
| `name` | キャラクターの名前 | `Hana_smile` |
| `description` | 画像の説明 | `笑顔の正面画像、黒髪ロング` |
| `file_link` | Drive画像のURL | `https://drive.google.com/file/d/1abc.../view` |
| `drive_file_id` | Drive画像のファイルID | `1abc...xyz` |
| `tags` | 用途タグ（カンマ区切り） | `beauty,japanese,female` |
| `status` | `active` と入力 | `active` |
| `created_date` | 本日の日付 | `2026-02-10` |

> **重要**: `drive_file_id` は必ず入力してください。パイプラインが画像を取得する際にこの ID を使用します。`file_link` だけでも動作しますが、`drive_file_id` の方が確実です。


### 3.2 モーション動画追加の手順

**スプレッドシート**: [Motions Inventory](https://docs.google.com/spreadsheets/d/1ycnmfpL8OgAI7WvlPTr3Z9p1H8UTmCNMV7ahunMlsEw)

モーション動画は、AI動画生成時の「動きの参考」として使われます。人物が動いている短い動画を用意してください。

#### 手順

1. **モーション参照動画を用意する**
   - フォーマット: MP4
   - 長さ: 5〜10秒推奨
   - 内容: 人物の動きが映っている動画（手を振る、うなずく、ジェスチャーなど）

2. **タイプに応じた Drive フォルダにアップロードする**

   | タイプ | 用途 | Driveフォルダ |
   |---|---|---|
   | **Hook** | 冒頭の注目を引く動き | [Motions/Hooks/](https://drive.google.com/drive/folders/1M0mrI55dLLv73LSYX6cXW07tkGGavh4J) |
   | **Body** | 本編の説明的な動き | [Motions/Bodies/](https://drive.google.com/drive/folders/1GGdM0Ig_VQ6MzYwNo5obPvCuHinCAgFJ) |
   | **CTA** | 最後の行動喚起の動き | [Motions/CTAs/](https://drive.google.com/drive/folders/1wzIoCH_oFKBG0S1OtzR0-x8PjfTEi3L4) |

3. **Drive のファイル ID を取得する**
   - アップロードした動画を右クリック → 「リンクを取得」
   - URL から `{ファイルID}` の部分をコピーする

4. **Motions Inventory スプレッドシートを開く**
   - 上記リンクからスプレッドシートを開く
   - `inventory` タブを選択する

5. **新しい行を追加して各カラムを入力する**

| カラム | 入力内容 | 入力例 |
|---|---|---|
| `component_id` | `MOT_` + 4桁の連番 | `MOT_0005` |
| `type` | `hook` / `body` / `cta` のいずれか | `hook` |
| `name` | モーションの名前 | `wave_hello` |
| `description` | 動きの説明 | `右手を振って挨拶する動き` |
| `file_link` | Drive動画のURL | `https://drive.google.com/file/d/1def.../view` |
| `drive_file_id` | Drive動画のファイルID | `1def...xyz` |
| `tags` | 用途タグ（カンマ区切り） | `greeting,energetic` |
| `status` | `active` と入力 | `active` |
| `created_date` | 本日の日付 | `2026-02-10` |

> **重要**: `type` カラムに正しいタイプ（`hook` / `body` / `cta`）を設定してください。制作行でモーションを指定する際、タイプが一致していることを確認します。


### 3.3 シナリオ追加の手順

**スプレッドシート**: [Scenarios Inventory](https://docs.google.com/spreadsheets/d/13Meu7cniKUr1JiEyKla0qhfiV9Az1IFuzIedzDxjpiY)

シナリオは動画の「台本」です。キャラクターが話す内容を英語と日本語で用意します。パイプラインでは `script_en`（英語）が音声生成に使用されます。

#### 手順

1. **スクリプトを用意する**
   - `script_en`: 英語のスクリプト（TTS音声生成に使用される）
   - `script_jp`: 日本語のスクリプト（参考用）
   - 1シナリオ = 1セクション分（5〜10秒程度の発話）

2. **タイプとIDを決定する**

   | タイプ | ID形式 | 用途 |
   |---|---|---|
   | Hook | `SCN_H_XXXX` | 冒頭（視聴者の注目を引く） |
   | Body | `SCN_B_XXXX` | 本編（メインメッセージ） |
   | CTA | `SCN_C_XXXX` | 最後（行動喚起: フォロー、いいね等） |

3. **Scenarios Inventory スプレッドシートを開く**
   - 上記リンクからスプレッドシートを開く
   - `inventory` タブを選択する

4. **新しい行を追加して各カラムを入力する**

| カラム | 入力内容 | 入力例 |
|---|---|---|
| `component_id` | `SCN_H_XXXX` / `SCN_B_XXXX` / `SCN_C_XXXX` | `SCN_H_0003` |
| `type` | `hook` / `body` / `cta` のいずれか | `hook` |
| `name` | シナリオの名前 | `beauty_intro_01` |
| `description` | 内容の説明 | `美容系の導入、問いかけ形式` |
| `script_en` | 英語スクリプト | `Hey! Want to know my secret for glowing skin?` |
| `script_jp` | 日本語スクリプト | `ねえ！美肌の秘密知りたくない？` |
| `set_id` | セットID（任意、同じセットのシナリオをグループ化） | `SET_001` |
| `tags` | 用途タグ（カンマ区切り） | `beauty,question,casual` |
| `status` | `active` と入力 | `active` |
| `created_date` | 本日の日付 | `2026-02-10` |

> **ヒント**: `set_id` を使うと、hook/body/cta を1セットとしてグループ管理できます。例えば `SET_001` という set_id を hook/body/cta の3行に設定すると、1つの動画用のシナリオセットとして管理できます。


### 3.4 アカウント追加の手順

**スプレッドシート**: [Accounts Inventory](https://docs.google.com/spreadsheets/d/1CmT6C3qCW3md6lJ9Rvc2WNQkWa5zcvlq6Zp_enJHoUE)

#### 手順

1. **SNSプラットフォームでアカウントを作成する**
   - YouTube / TikTok / Instagram / X(Twitter) のいずれか
   - アカウント名（ハンドル名）を控えておく

2. **Accounts Inventory スプレッドシートを開く**
   - 上記リンクからスプレッドシートを開く
   - `inventory` タブを選択する

3. **新しい行を追加して各カラムを入力する**

| カラム | 入力内容 | 入力例 |
|---|---|---|
| `account_id` | `ACC_` + 4桁の連番 | `ACC_0008` |
| `persona_name` | AIキャラクターの表示名 | `Yuki Beauty` |
| `platform` | プラットフォーム名 | `youtube` / `tiktok` / `instagram` / `twitter` |
| `account_handle` | @ユーザー名 | `@yuki_beauty_ai` |
| `character_id` | 使用するキャラクターID | `CHR_0001` |
| `target_region` | ターゲット地域 | `JP` / `US` / `SEA` |
| `timezone` | タイムゾーン | `Asia/Tokyo` |
| `posting_window` | 投稿時間帯 | `18:00-22:00` |
| `content_niche` | コンテンツジャンル | `beauty` / `lifestyle` / `tech` |
| `voice_id` | Fish Audio reference_id（32文字16進数）**必須** | `a1b2c3d4e5f6...` |
| `status` | ステータス | `setup` → 準備完了後に `active` に変更 |
| `api_credential_key` | OAuth認証のキー名 | `youtube_acc_0008` |

4. **Gmail credentials タブに認証情報を登録する**（投稿機能使用時）
   - 同じスプレッドシートの `Gmail credentials` タブを開く
   - アカウントに紐づくGmail情報を登録する


## 4. 動画制作ワークフロー

### 4.1 制作行の作成

**スプレッドシート**: [Master Spreadsheet — production タブ](https://docs.google.com/spreadsheets/d/1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg)

制作する動画ごとに、`production` タブに1行追加します。この行が「どのキャラクターで、どのシナリオ・モーションを使って、動画を作るか」の指示書になります。

#### 手順

1. **Master Spreadsheet を開く**（上記リンク）
2. **`production` タブを選択する**
3. **最終行の下に新しい行を追加する**
4. **以下のカラムを入力する**

##### 入力が必要なカラム（人間が設定するもの）

| カラム | 説明 | 入力例 | 必須 |
|---|---|---|---|
| `video_id` | 動画ID（`VID_YYYYMM_XXXX` 形式） | `VID_202602_0001` | 必須 |
| `account_id` | 投稿先アカウントID | `ACC_0001` | 任意 |
| `title` | 動画タイトル | `美肌の秘密` | 任意 |
| `edit_status` | **`ready` にするとパイプラインの実行対象になる** | `ready` | **必須** |
| `character_id` | Characters Inventory のID | `CHR_0001` | **必須** |
| `hook_scenario_id` | Hook用シナリオID | `SCN_H_0001` | **必須** |
| `body_scenario_id` | Body用シナリオID | `SCN_B_0001` | **必須** |
| `cta_scenario_id` | CTA用シナリオID | `SCN_C_0001` | **必須** |
| `hook_motion_id` | Hook用モーションID | `MOT_0001` | **必須** |
| `body_motion_id` | Body用モーションID | `MOT_0002` | **必須** |
| `cta_motion_id` | CTA用モーションID | `MOT_0003` | **必須** |
| `voice_id` | Fish Audio reference_id（32文字16進数） | `a1b2c3d4e5f6...` | **必須** |

> **重要**: `edit_status` を `ready` に設定すると、パイプラインの処理対象になります。まだ準備中の場合は `draft` のままにしておいてください。

##### 自動入力されるカラム（パイプラインが記録するもの — 編集不要）

| カラム | 説明 |
|---|---|
| `pipeline_status` | 処理状態（`queued` → `processing` → `completed` / `error`） |
| `current_phase` | 現在のフェーズ（`uploading_character` / `processing_sections` / `concatenating` / `uploading_to_drive`） |
| `hook_video_url` | 生成された Hook 動画の Drive URL |
| `body_video_url` | 生成された Body 動画の Drive URL |
| `cta_video_url` | 生成された CTA 動画の Drive URL |
| `final_video_url` | 結合版（最終）動画の Drive URL |
| `drive_folder_id` | 出力先フォルダの Drive ID |
| `error_message` | エラーが発生した場合のメッセージ |
| `processing_time_sec` | 処理にかかった秒数 |
| `created_at` | 行が作成された日時 |
| `updated_at` | 最終更新日時 |
| `platform_post_ids` | 投稿後のプラットフォーム側ID |
| `yt_views` / `yt_engagement` | YouTube の視聴数・エンゲージメント |
| `tt_views` / `tt_engagement` | TikTok の視聴数・エンゲージメント |
| `ig_views` / `ig_engagement` | Instagram の視聴数・エンゲージメント |
| `overall_score` | 総合スコア |
| `analysis_date` | 分析日 |


### 4.2 パイプライン実行

#### 方法A: シートGUI（推奨）

Google Sheets のメニューからパイプラインを操作できます。VM上でウォッチャーデーモンが常駐しており、キューに入った動画を自動処理します。

##### ウォッチャーの起動（初回のみ / VM再起動後）

```bash
# PM2 で起動
pm2 start ecosystem.config.js

# 自動起動設定（VM再起動後も自動で起動する）
pm2 save
pm2 startup  # 表示されたコマンドを実行
```

##### シートからの実行手順

1. **[Master Spreadsheet](https://docs.google.com/spreadsheets/d/1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg)** の `production` タブを開く
2. 動画の行を入力し、`edit_status` を `ready` に設定する
3. メニュー **Video Analytics v2 > Pipeline** から操作:

| メニュー項目 | 動作 |
|---|---|
| **Queue All Ready Videos...** | ready な全行をバリデーション → 処理数を確認 → `pipeline_status = 'queued'` に設定 |
| **Queue All Ready (Dry Run)...** | 同上だが `pipeline_status = 'queued_dry'`（APIを呼ばないテスト実行） |
| **Queue Selected Videos** | シート上で選択中の行のみキューイング（行をShift+クリックまたはドラッグで範囲選択） |
| **Pipeline Status** | 全行の pipeline_status ごとの件数と処理中ジョブを表示 |
| **Stop Pipeline** | `queued` / `queued_dry` の行を全てクリア（処理中のジョブは完了まで続行） |

4. 30秒以内にVM上のウォッチャーが検出し、1行ずつ順番に処理を開始
5. `pipeline_status` と `current_phase` がリアルタイムで更新される
6. 完了後、`final_video_url` に動画URLが入る

##### ウォッチャーの管理

```bash
# ログの確認
pm2 logs pipeline-watcher

# ステータス確認
pm2 status

# 再起動
pm2 restart pipeline-watcher

# 停止
pm2 stop pipeline-watcher
```

#### 方法B: CLI（上級者向け）

ターミナルから直接パイプラインを実行することもできます。

##### 特定の動画を処理する

```bash
# まずドライラン（実際のAPIは呼ばない、動作確認用）
node scripts/run-pipeline.js --video-id VID_202602_0001 --dry-run

# 本番実行（API呼び出しあり、実際に動画を生成する）
node scripts/run-pipeline.js --video-id VID_202602_0001
```

##### ready な全行をまとめて処理する

```bash
# バッチのドライラン（最大5件）
node scripts/run-pipeline.js --dry-run --limit 5

# 本番バッチ実行（最大10件、デフォルト）
node scripts/run-pipeline.js --limit 10

# ready な全行を処理（上限なし）
node scripts/run-pipeline.js
```

##### コマンドオプション一覧

| オプション | 説明 | デフォルト |
|---|---|---|
| `--video-id <ID>` | 指定した video_id のみ処理 | なし（全readyを処理） |
| `--limit <N>` | 最大処理件数 | `10` |
| `--dry-run` | APIを呼ばず、ログだけ出す | `false` |
| `--help`, `-h` | ヘルプを表示 | - |

#### 実行の流れ（1動画あたり約12分）

```
Step 1: キャラクター画像を fal.storage にアップロード
Step 2: 3セクション(hook/body/cta)を並列処理
        各セクション:
        ├─ モーション動画を fal.storage にアップロード
        ├─ Kling (動画生成) + Fish Audio (TTS) を並列実行
        └─ Lipsync (口同期)
Step 3: ffmpeg で3セクションを結合 → final.mp4
Step 4: 4ファイルを Google Drive にアップロード
Step 5: production タブのステータス・URLを更新
```


### 4.3 処理中の確認方法

パイプライン実行中は、以下の方法で進捗を確認できます。

#### ウォッチャーのログを見る（GUI実行の場合）

```bash
pm2 logs pipeline-watcher --lines 50
```

#### ターミナルのログを見る（CLI実行の場合）

実行中のターミナルにリアルタイムでログが表示されます:

```
[pipeline:init] Video: VID_202602_0001, character: CHR_0001
[pipeline:image] Uploading character CHR_0001 to fal.storage...
[pipeline:image] fal.storage URL: https://fal.media/files/...
[pipeline:parallel] Processing 3 sections in parallel...
[pipeline:hook] --- Processing section: hook ---
[pipeline:body] --- Processing section: body ---
[pipeline:cta] --- Processing section: cta ---
...
[pipeline:done] Pipeline complete! Video: VID_202602_0001, time: 720s
```

#### production タブで確認する

[Master Spreadsheet](https://docs.google.com/spreadsheets/d/1fI1s_KLcegpiACJYpmpNe9tnQmnZo2o8eHIXNV5SpPg) の `production` タブを開き、対象の行を確認します:

| 確認カラム | 値 | 意味 |
|---|---|---|
| `pipeline_status` | `processing` | 処理中 |
| `current_phase` | `uploading_character` | キャラクター画像アップロード中 |
| `current_phase` | `processing_sections` | 3セクション並列処理中 |
| `current_phase` | `concatenating` | 動画結合中 |
| `current_phase` | `uploading_to_drive` | Drive アップロード中 |


### 4.4 完了後の確認

#### production タブで確認する

| 確認カラム | 正常完了時の値 |
|---|---|
| `pipeline_status` | `completed` |
| `current_phase` | （空欄） |
| `final_video_url` | Drive上の最終動画URL |
| `hook_video_url` | Hook セクション動画URL |
| `body_video_url` | Body セクション動画URL |
| `cta_video_url` | CTA セクション動画URL |
| `drive_folder_id` | 出力フォルダの Drive ID |
| `processing_time_sec` | 処理時間（秒） |

#### Google Drive で確認する

完成動画は以下の場所に保存されます:

```
Shared Drives > Product > AI-Influencer > Productions > {日付} > {video_id} /
├── 01_hook.mp4      ← Hook セクション
├── 02_body.mp4      ← Body セクション
├── 03_cta.mp4       ← CTA セクション
└── final.mp4        ← 結合版（最終動画）
```

[Productions フォルダ](https://drive.google.com/drive/folders/1KRQuZ4W7u5CXRamjvN4xmavfu-7TPb0X) から日付フォルダをたどってアクセスできます。


## 5. トラブルシューティング

### よくあるエラーと対処法

#### "has no drive_file_id or valid file_link"

**原因**: インベントリシートの `drive_file_id` と `file_link` の両方が空、または `file_link` のURL形式が不正です。

**対処法**:
1. エラーメッセージに表示されている component_id を確認する
2. 該当のインベントリスプレッドシートを開く
3. `drive_file_id` カラムに正しい Drive ファイルIDを入力する
4. パイプラインを再実行する

#### "not found in production tab"

**原因**: 指定した `--video-id` が production タブに存在しません。

**対処法**:
1. production タブを開き、指定した video_id が正しいか確認する
2. video_id のスペルミス（大文字小文字、アンダースコア）がないか確認する
3. 行が存在しない場合は、[4.1 制作行の作成](#41-制作行の作成) の手順で行を追加する

#### "Character not found: CHR_XXXX"

**原因**: production 行の `character_id` に指定したIDが Characters Inventory に存在しません。

**対処法**:
1. production タブの `character_id` の値を確認する
2. [Characters Inventory](https://docs.google.com/spreadsheets/d/1-m4f5LgNmArtpECZqqxFL-6P4eabBmPkOYX2VkFHCHA) で該当IDが `inventory` タブにあるか確認する
3. IDが間違っている場合は修正する。存在しない場合は [3.1 キャラクター追加](#31-キャラクター追加の手順) で追加する

#### "Hook/Body/CTA scenario not found" / "Hook/Body/CTA motion not found"

**原因**: production 行のシナリオID or モーションIDがインベントリに存在しません。

**対処法**: 上記の Character not found と同様に、各インベントリを確認して修正する。

#### "No image file found in character folder"

**原因**: キャラクターの Drive フォルダに画像ファイルがありません。

**対処法**:
1. Characters Inventory の `drive_file_id` が画像ファイル自体（フォルダではなく）を指しているか確認する
2. Drive上でファイルが削除されていないか確認する
3. ファイルの共有設定が適切か確認する

#### fal.ai 422 エラー

**原因**: fal.ai API に不正なパラメータが送信されました。

**よくある原因**:
- `prompt` パラメータに空文字を送っている（Kling motion-control には prompt を送らない）
- `keep_original_sound: true` を送っている（このパラメータは使用不可）

**対処法**: パイプラインのコードを更新してください。通常はコード側の問題のため、開発者に連絡してください。

#### Timeout エラー / 処理が長時間停止する

**原因**: fal.ai の動画生成に時間がかかっています（通常3〜5分/セクション）。

**対処法**:
1. デフォルトのタイムアウトは10分です（`FAL_TIMEOUT_MS` 環境変数で変更可能）
2. タイムアウトした場合は、再度同じコマンドを実行してください
3. 繰り返し発生する場合は fal.ai のステータスページを確認してください

#### "edit_status が ready だが処理されない"

**原因**: `pipeline_status` に前回の実行結果が残っています。

**対処法**:
- パイプラインは `edit_status = 'ready'` かつ `pipeline_status` が空または `'queued'` の行のみ処理します
- 再実行したい場合は `pipeline_status` を空にするか `queued` に変更してください

#### ウォッチャーが動作しない / キューした動画が処理されない

**原因**: VM上のウォッチャーデーモンが停止しています。

**対処法**:
```bash
# ステータス確認
pm2 status

# 停止していれば起動
pm2 start ecosystem.config.js

# ログでエラーを確認
pm2 logs pipeline-watcher --lines 100
```


## 6. リファレンス

コスト構造、スプレッドシートスキーマ（全タブ・カラム定義）、Drive フォルダ構造・ID一覧は [README.md](../../README.md) にまとめています:

- [コスト構造](../../README.md#コスト構造) — 1本あたり ~$2.31、月次見積もり
- [Google Sheets データスキーマ](../../README.md#google-sheets-データスキーマ) — 全タブ・カラム定義
- [Google Drive フォルダ構造](../../README.md#google-drive-フォルダ構造) — フォルダツリー・命名規則・Drive ID一覧
