# APIコスト分析: 1動画あたり（パイプライン実設定ベース）

**調査日**: 2026-02-18
**対象**: AI KOL パイプライン v4.0 — 3セクション（Hook + Body + CTA）× 5秒 = 15秒動画

> パイプラインの実際のデフォルト設定（`video-generator.js` line 16: `duration = 5`）に基づく正確なコスト。
> Body セクションは Fabric 1.0 (`veed/fabric-1.0`) を使用。Hook/CTA は Kling + Lipsync を継続。
> 1分あたりのコスト比較は [per-minute-cost.md](per-minute-cost.md) を参照。


## 結論

| 構成 | 1動画（15秒）あたり |
|------|---------------------|
| **Pro Lipsync（現在のパイプライン）** | **~$2.29** |
| **Standard Lipsync（コスト削減案）** | **~$1.95** |

> Body セクションを Fabric 1.0 に変更。Hook/CTA は Kling + Lipsync を継続。
> Std 構成は Fabric ($0.75) が Kling+Std Lipsync ($0.60) より高いため、以前の $1.80 から $1.95 に増加。


## 1セクション（5秒）あたりの内訳

### Hook / CTA セクション（Kling + Lipsync）

| ステップ | サービス | 単価 | 計算 | コスト |
|----------|----------|------|------|--------|
| 動画生成 | Kling v2.6 Standard (fal.ai) | [$0.07/秒](https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control) | $0.07 × 5秒 | **$0.35** |
| 音声生成 | Fish Audio TTS (直接API) | ~$0.001/セクション | 直接REST API（fal.ai とは別サービス） | **~$0.001** |
| 口パク同期 | Sync Lipsync v2/pro (fal.ai) | [$5.00/分](https://fal.ai/models/fal-ai/sync-lipsync/v2/pro) | $5.00 × 5/60分 | **$0.42** |
| **セクション計** | | | | **$0.77** |

### Body セクション（Fabric 1.0）

| ステップ | サービス | 単価 | 計算 | コスト |
|----------|----------|------|------|--------|
| 音声生成 | Fish Audio TTS (直接API) | ~$0.001/セクション | 直接REST API（fal.ai とは別サービス） | **~$0.001** |
| 動画生成 | Fabric 1.0 720p (fal.ai) | [$0.15/秒](https://fal.ai/models/veed/fabric-1.0) | $0.15 × 5秒 | **$0.75** |
| **セクション計** | | | | **~$0.75** |

> Fabric 1.0: 音声駆動の動画生成。Kling + Lipsync の2ステップを1ステップに統合。Body セクションのみ使用。
> Fish Audio TTS: ElevenLabs から移行。コスト約90%削減。Fish Audio は fal.ai とは独立した直接REST APIで、バイナリMP3を返却し、fal.storageにアップロード。


## 1動画（3セクション = 15秒）あたり

| サービス | Pro Lipsync | Standard Lipsync |
|----------|-------------|------------------|
| Kling × 2セクション（Hook/CTA） | $0.70 | $0.70 |
| Fish Audio × 3セクション | ~$0.003 | ~$0.003 |
| Lipsync × 2セクション（Hook/CTA） | $0.84 | $0.50 |
| Fabric 1.0 × 1セクション（Body） | $0.75 | $0.75 |
| ffmpeg結合 | $0（ローカル処理） | $0 |
| **合計** | **$2.29** | **$1.95** |

### コスト構成比（Pro構成）

| サービス | コスト | 構成比 |
|----------|--------|--------|
| Kling（動画生成 × 2） | $0.70 | **31%** |
| Lipsync Pro（口パク × 2） | $0.84 | **37%** |
| Fabric 1.0（Body動画生成 × 1） | $0.75 | **33%** |
| Fish Audio（TTS × 3） | ~$0.003 | **<1%** |

> コストが Kling / Lipsync / Fabric でほぼ均等に三分割。以前は Lipsync 55% が支配的だったが、Body を Fabric に移行したことでバランスが改善。


## 月間コスト試算

**前提**: 1アカウント1日1本、1本 = 15秒、月30日

| 時期 | アカウント数 | 月間動画数 | Pro ($2.29/本) | Std ($1.95/本) |
|------|------------|-----------|----------------|----------------|
| 2月 | 50 | 1,500 | **$3,435** | **$2,925** |
| 3月 | 160 | 4,800 | **$10,992** | **$9,360** |
| 4月 | 340 | 10,200 | **$23,358** | **$19,890** |
| 6月 | 700 | 21,000 | **$48,090** | **$40,950** |


## 直接APIとの比較

各サービスの公式APIを直接使う場合との単価比較。

| サービス | 現在の単価 | 直接API | 差額 | 備考 |
|----------|------------|---------|------|------|
| Kling v2.6 Std (fal.ai) | $0.07/秒 | $0.07/秒 | **同額** | 直接は [$4,200/3ヶ月](https://klingai.com/global/dev/pricing) 前払い必要 |
| Fish Audio TTS (直接API) | ~$0.001/セクション | - | **直接利用** | fal.ai とは別サービス。ElevenLabs ($0.01/セクション) から ~90% コスト削減 |
| Sync Lipsync Pro (fal.ai) | $5.00/分 | $4.02-$4.98/分 | **ほぼ同等** | [Sync Labs](https://sync.so/pricing) はスケールプラン必要 |
| Fabric 1.0 720p (fal.ai) | $0.15/秒 | - | **fal.ai独占** | [VEED](https://www.veed.io/) 提供。直接APIなし、fal.ai経由のみ |

> Kling/Lipsync/Fabric は fal.ai 経由（前払い不要・統一SDK）、TTS は Fish Audio 直接API（fal.ai とは独立したサービス）で最適なコスト構成。


## 参照元

| サービス | 公式料金ページ |
|----------|---------------|
| fal.ai 料金一覧 | https://fal.ai/pricing |
| Kling v2.6 Standard Motion Control | https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control |
| Fabric 1.0 (veed/fabric-1.0) | https://fal.ai/models/veed/fabric-1.0 |
| Sync Lipsync v2 Pro | https://fal.ai/models/fal-ai/sync-lipsync/v2/pro |
| Sync Lipsync v2 Standard | https://fal.ai/models/fal-ai/sync-lipsync/v2 |
| Fish Audio | https://fish.audio |
| Kling AI 直接API | https://klingai.com/global/dev/pricing |
| Sync Labs 直接API | https://sync.so/pricing |
