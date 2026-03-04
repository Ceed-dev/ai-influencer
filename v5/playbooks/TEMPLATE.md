# [コンテンツ名] — Playbook

## メタデータ
- content_type:          （例: ai_beauty_real）
- content_format:        short_video / text_post / image_post
- niche:                 （例: beauty, fitness, lifehack, tech）
- platform:              youtube / tiktok / instagram / x / 全プラット
- hook_type:             question / reaction / statement / story / demonstration / shock / mystery
- narrative_structure:   linear（時系列） / parallel（比較） / climactic（山型・オチあり） / circular（円環・最初と最後が呼応） / listicle（リスト型）
- 作成者:
- 作成日:
- バージョン: v1

## 1. コンテンツ概要 (What)
<!-- どんなコンテンツか。ターゲット視聴者、コンセプト、世界観を書く -->
<!-- 例: リアルな質感のAI美女が美容系LifeHackを紹介する30秒以内の縦型動画 -->

キャラクター推奨:
- キャラクタータイプ:  （例: asian_female, western_female）
- スクリプト言語:     en / jp

## 2. 参考リンク
<!-- 目標とするクオリティや方向性の参考アカウント・投稿URLを記載 -->

## 3. セクション構成
<!-- Planner Agentがコンテンツのセクションを組む際に参照する。セクション数・ラベル・各セクションの役割と推奨尺を書く -->

例（3セクション構成）:
- セクション1: hook     — 冒頭で視聴者を引き込む（〜3秒）
- セクション2: body     — コンテンツ本編（〜20秒）
- セクション3: cta      — フォロー誘導・締め（〜5秒）

使用可能なラベル: hook / body / cta / intro / summary / demo / transition

## 4. 制作フロー (How)
<!-- ツールをどの順番でどう使うか。パラメータを具体的に書く -->

推奨ツール組み合わせ:
- video_gen:  （例: kling / runway / pika）
- tts:        （例: fish_audio / elevenlabs）
- lipsync:    （例: sync_lipsync / hedra）
- concat:     ffmpeg

### ステップ1: [ツール名]
- 目的:
- 入力:
- パラメータ: （例: duration: 5, aspect_ratio: 9:16）
- プロンプト:
- ネガティブプロンプト:
- 期待する出力:
- 注意点:

### ステップ2: [ツール名]
（ステップ1と同じ形式で繰り返す）

## 5. ツールの特性・癖 (With)
<!-- 使用ツールごとに得意・不得意・ハマりどころを書く -->

### [ツール名]
- 得意なこと:
- 不得意なこと:
- よく使うパラメータ:
- ハマりどころ:

## 6. フックの型
<!-- 冒頭1〜3秒で何をどう見せるか。hook_typeの選択理由と具体的な演出パターンを書く -->
<!-- 例: hook_type=question → 手を上げて「これ知ってる？」から入る -->

## 7. クオリティ基準
<!-- 何をもって「OKレベル」とするか。合格・不合格の判断基準を具体的に書く -->
<!-- 例: AI感が出ていない / 口パクがズレていない / 30秒以内 -->

## 8. コスト目安
<!-- 1本あたりの推定コスト（時間・API費用）を記載する -->

## 9. 学んだこと・改善メモ
<!-- 試行錯誤で分かったことを書き留める。後からv5.0の学習データとして活用する -->
