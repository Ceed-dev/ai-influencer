# APIコスト分析: 1動画あたり（パイプライン実設定ベース）

**調査日**: 2026-02-11
**対象**: AI KOL パイプライン v4.0 — 3セクション × 5秒 = 15秒動画

> パイプラインの実際のデフォルト設定（`video-generator.js` line 16: `duration = 5`）に基づく正確なコスト。
> 1分あたりのコスト比較は [per-minute-cost.md](per-minute-cost.md) を参照。


## 結論

| 構成 | 1動画（15秒）あたり |
|------|---------------------|
| **Pro Lipsync（現在のパイプライン）** | **~$2.31** |
| **Standard Lipsync（コスト削減案）** | **~$1.80** |


## 1セクション（5秒）あたりの内訳

| ステップ | サービス | 単価 | 計算 | コスト |
|----------|----------|------|------|--------|
| 動画生成 | Kling v2.6 Standard (fal.ai) | [$0.07/秒](https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control) | $0.07 × 5秒 | **$0.35** |
| 音声生成 | Fish Audio TTS (直接API) | ~$0.001/セクション | 直接REST API（fal.ai とは別サービス） | **~$0.001** |
| 口パク同期 | Sync Lipsync v2/pro (fal.ai) | [$5.00/分](https://fal.ai/models/fal-ai/sync-lipsync/v2/pro) | $5.00 × 5/60分 | **$0.42** |
| **セクション計** | | | | **$0.77** |

> Fish Audio TTS: ElevenLabs から移行。コスト約90%削減。Fish Audio は fal.ai とは独立した直接REST APIで、バイナリMP3を返却し、fal.storageにアップロードしてリップシンク用URLを取得。


## 1動画（3セクション = 15秒）あたり

| サービス | Pro Lipsync | Standard Lipsync |
|----------|-------------|------------------|
| Kling × 3セクション | $1.05 | $1.05 |
| Fish Audio × 3セクション | ~$0.003 | ~$0.003 |
| Lipsync × 3セクション | $1.26 | $0.75 |
| ffmpeg結合 | $0（ローカル処理） | $0 |
| **合計** | **$2.31** | **$1.80** |

### コスト構成比（Pro構成）

| サービス | コスト | 構成比 |
|----------|--------|--------|
| Kling（動画生成） | $1.05 | **45%** |
| Lipsync Pro（口パク） | $1.26 | **55%** |
| Fish Audio（TTS） | ~$0.003 | **<1%** |

→ Lipsync が最大のコストドライバー。Standard版（$3.00/分）に変更するだけで1動画あたり $0.51 削減。


## 月間コスト試算

**前提**: 1アカウント1日1本、1本 = 15秒、月30日

| 時期 | アカウント数 | 月間動画数 | Pro ($2.31/本) | Std ($1.80/本) |
|------|------------|-----------|----------------|----------------|
| 2月 | 50 | 1,500 | **$3,465** | **$2,700** |
| 3月 | 160 | 4,800 | **$11,088** | **$8,640** |
| 4月 | 340 | 10,200 | **$23,562** | **$18,360** |
| 6月 | 700 | 21,000 | **$48,510** | **$37,800** |


## 直接APIとの比較

各サービスの公式APIを直接使う場合との単価比較。

| サービス | 現在の単価 | 直接API | 差額 | 備考 |
|----------|------------|---------|------|------|
| Kling v2.6 Std (fal.ai) | $0.07/秒 | $0.07/秒 | **同額** | 直接は [$4,200/3ヶ月](https://klingai.com/global/dev/pricing) 前払い必要 |
| Fish Audio TTS (直接API) | ~$0.001/セクション | - | **直接利用** | fal.ai とは別サービス。ElevenLabs ($0.01/セクション) から ~90% コスト削減 |
| Sync Lipsync Pro (fal.ai) | $5.00/分 | $4.02-$4.98/分 | **ほぼ同等** | [Sync Labs](https://sync.so/pricing) はスケールプラン必要 |

→ Kling/Lipsync は fal.ai 経由（前払い不要・統一SDK）、TTS は Fish Audio 直接API（fal.ai とは独立したサービス）で最適なコスト構成。


## 参照元

| サービス | 公式料金ページ |
|----------|---------------|
| fal.ai 料金一覧 | https://fal.ai/pricing |
| Kling v2.6 Standard Motion Control | https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control |
| Sync Lipsync v2 Pro | https://fal.ai/models/fal-ai/sync-lipsync/v2/pro |
| Sync Lipsync v2 Standard | https://fal.ai/models/fal-ai/sync-lipsync/v2 |
| Fish Audio | https://fish.audio |
| Kling AI 直接API | https://klingai.com/global/dev/pricing |
| Sync Labs 直接API | https://sync.so/pricing |
