# APIコスト分析: 1分あたり（動画長に依存しない基本単価）

**調査日**: 2026-02-18（Fabric 1.0 対応更新）
**対象**: AI KOL パイプライン v4.0 で使用する外部API

> パイプラインは3セクション構成（Hook / Body / CTA）。Hook・CTA は Kling + Lipsync、Body は Fabric 1.0 を使用。全APIは**動画の長さに比例**して課金される。「1分あたりいくら」で整理すれば、動画長やセクション数が変わっても即座に再計算できる。
> 現在のパイプライン実設定（15秒動画）でのコストは [per-video-cost.md](per-video-cost.md) を参照。


## 結論: 1分の動画を作るのにいくらかかるか

3セクション構成（Hook / Body / CTA、各1/3）のブレンドコスト:

| 構成 | Kling 2/3（Hook/CTA） | Lipsync 2/3（Hook/CTA） | Fabric 1.0 1/3（Body） | TTS | **合計/分** |
|------|------------------------|--------------------------|------------------------|-----|-------------|
| **Pro Lipsync（現在）** | $2.80 | $3.33 | $3.00 | ~$0.01 | **$9.14/分** |
| **Standard Lipsync** | $2.80 | $2.00 | $3.00 | ~$0.01 | **$7.81/分** |

> ffmpeg結合はローカル処理のため無料。上記はAPI費用のみ。Fish Audio TTS は ElevenLabs から移行し、コスト約90%削減。Fish Audio は fal.ai とは独立した直接REST APIサービス。
> Body セクションは Kling + Lipsync の代わりに Fabric 1.0 を使用。Fabric 1.0 はテキスト＋画像から直接リップシンク動画を生成するため、Kling と Lipsync が不要。

### 動画長別のコスト早見表

| 動画の長さ | Pro Lipsync | Standard Lipsync |
|-----------|-------------|------------------|
| 15秒（現在のパイプライン） | $2.29 | $1.95 |
| 30秒 | $4.57 | $3.91 |
| 1分 | $9.14 | $7.81 |
| 2分 | $18.28 | $15.62 |


## 1. 各APIの公式料金

Kling・Lipsync・Fabric 1.0 は fal.ai 経由、TTS は Fish Audio 直接API。課金は**出力動画の秒数 or 入力文字数に対する従量課金**。

### 1-1. Kling v2.6 Standard Motion Control（動画生成 — Hook/CTA）

| 項目 | 値 |
|------|------|
| エンドポイント | `fal-ai/kling-video/v2.6/standard/motion-control` |
| 課金単位 | **$0.07/秒** |
| 1分あたり | **$4.20** |

**公式ソース**:
- fal.ai モデルページ: https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control
  - 記載: "Your request will cost $0.07 per second"
- fal.ai 料金一覧: https://fal.ai/pricing

**Kling 直接API との比較**:
- Kling 公式 API: V2.6 Standard Motion Control = **$0.07/秒**（fal.ai と同額）
- ただし Kling 直接は $4,200/3ヶ月の前払いパッケージが必要
- Kling 公式料金ページ: https://klingai.com/global/dev/pricing

### 1-2. Fish Audio TTS（音声生成）

| 項目 | 値 |
|------|------|
| エンドポイント | `https://api.fish.audio/v1/tts`（直接REST API） |
| 課金単位 | **~$0.001/セクション** |
| 1分の発話相当 | **~$0.01** |

ElevenLabs ($0.10/1K文字) から Fish Audio (直接REST API) に移行し、TTSコストを約90%削減。Fish Audio は fal.ai とは独立したサービスで、直接APIでバイナリMP3を返却し、fal.storage にアップロードしてリップシンク入力用URLを取得する。

**公式ソース**:
- Fish Audio: https://fish.audio

### 1-3. Sync Lipsync v2（口パク同期 — Hook/CTA）

パイプラインは現在 **Pro 版**を使用（Hook/CTA のみ）。Standard 版への変更でコスト削減可能。Body セクションは Fabric 1.0 が口パクを内包するため Lipsync 不要。

| バージョン | エンドポイント | 課金単位 | 1分あたり |
|-----------|---------------|---------|----------|
| **Pro（現在）** | `fal-ai/sync-lipsync/v2/pro` | $5.00/分 | **$5.00** |
| **Standard** | `fal-ai/sync-lipsync/v2` | $3.00/分 | **$3.00** |

**公式ソース**:
- Pro: https://fal.ai/models/fal-ai/sync-lipsync/v2/pro — "Your request will cost $5 per minute"
- Standard: https://fal.ai/models/fal-ai/sync-lipsync/v2

**Sync Labs 直接API との比較**:
- Sync Labs 公式: lipsync-2-pro = $0.067-$0.083/秒（≒ $4.02-$4.98/分）
- fal.ai の $5/分とほぼ同等
- Sync Labs 料金ページ: https://sync.so/pricing
- Sync Labs ドキュメント: https://docs.sync.so/models/lipsync


### 1-4. Fabric 1.0（動画生成 — Body）

| 項目 | 値 |
|------|------|
| エンドポイント | `veed/fabric-1.0` |
| 課金単位 | **$0.15/秒**（720p） |
| 1分あたり | **$9.00** |

テキスト＋画像から直接リップシンク付き動画を生成するモデル。Body セクションで Kling + Lipsync の代わりに使用。単体の1分あたりコストは $9.00 だが、パイプライン全体では 1/3 のセクションにのみ適用されるためブレンドコストは $3.00/分。

**公式ソース**:
- fal.ai モデルページ: https://fal.ai/models/veed/fabric-1.0
- VEED: https://www.veed.io


## 2. コスト構成の内訳（1分あたり）

1分あたり $9.14（Pro）のうち、各サービスの占める割合（ブレンドコスト）:

| サービス | 適用セクション | コスト/分（ブレンド） | 構成比 |
|----------|---------------|----------------------|--------|
| Kling（動画生成） | Hook/CTA（2/3） | $2.80 | **31%** |
| Lipsync Pro（口パク） | Hook/CTA（2/3） | $3.33 | **36%** |
| Fabric 1.0（動画生成） | Body（1/3） | $3.00 | **33%** |
| Fish Audio（TTS） | 全セクション | ~$0.01 | **<1%** |

→ コストが3サービスにほぼ均等に分散。Lipsync を Standard に変えると $1.33/分 の削減（全体 -15%）。


## 3. GUIツール vs API の比較（1分あたり）

### GUI（ウェブ版サブスク）を使った場合の1分あたりコスト

**Kling AI ウェブ版**: https://klingai.com/pricing
- Standard ($5.99/月): 66クレジット → 5秒動画 約13本 = 65秒分 → **~$5.53/分**
- Pro ($29.99/月): 660クレジット → 5秒動画 約132本 = 660秒分 → **~$2.73/分**
- ProPlus ($89.99/月): 3,000クレジット → 5秒動画 約600本 = 3,000秒分 → **~$1.80/分**

**Sync Labs ウェブ版**: https://sync.so/pricing
- Starter ($29/月): 10分/月 → **$2.90/分**
- Creator ($49/月): 30分/月 → **$1.63/分**

**ElevenLabs ウェブ版**: https://elevenlabs.io/pricing
- Starter ($5/月): 30,000文字 → **$0.17/1K文字**（APIの $0.10 より割高）

### 1分の動画を作る合計コスト比較

| 方式 | Kling (2/3) | Fabric (1/3) | TTS | Lipsync (2/3) | **合計/分** | 備考 |
|------|-------------|--------------|-----|----------------|-------------|------|
| **API（Pro Lipsync）** | $2.80 | $3.00 | $0.01 | $3.33 | **$9.14** | 自動化可、上限なし |
| **API（Std Lipsync）** | $2.80 | $3.00 | $0.01 | $2.00 | **$7.81** | 自動化可、上限なし |
| **GUI（最安プラン組合せ）** | — | — | — | — | **~$4.51** | 手動操作、月間上限あり |
| **GUI（低プラン）** | — | — | — | — | **~$8.60** | 手動操作、月間上限あり |

### まとめ

- **GUIの方が単価は安くなり得る**（月額サブスクに含まれるクレジット内で使う場合）
- ただし GUI には**月間上限**がある。例えば Kling Pro ($29.99/月) は660秒 = 11分 相当しか生成できない
- **50アカウント × 1本/日 × 15秒 = 22,500秒/月（375分/月）** の規模は GUI では到底まかなえない
- したがって **量産フェーズでは API 一択**。GUI は少量のテストや単発制作にのみ有効


## 4. コスト削減の可能性

### 即座に実行可能

| 施策 | 効果（1分あたり） | 効果（15秒動画1本あたり） | 影響 |
|------|-------------------|--------------------------|------|
| **Lipsync を Pro → Standard に変更** | -$1.33/分 | -$0.33/本 | Hook/CTA のみに影響（2/3セクション）。画質がやや下がる |

> 旧構成（全セクション Kling+Lipsync）では Lipsync 変更で -$2.00/分だったが、Body が Fabric 1.0 に移行したため Lipsync の適用範囲は 2/3 に縮小。削減効果も 2/3 に減少。

### 検討余地のある施策

| 施策 | 効果 | トレードオフ |
|------|------|-------------|
| Kling Pro 版（画質UP） | +$1.68/分（Hook/CTA のみ、2/3適用） | 画質向上だがコスト増 |
| Kling 直接API契約 ($4,200/3ヶ月) | 月2,000本以上で得 | 前払い＋未使用分失効リスク |
| セクション長を5秒→3秒に短縮 | -40%（全体が短くなる） | コンテンツ品質低下のリスク |
| Body を全セクションに拡大 | Kling+Lipsync 不要に | Fabric 1.0 の品質・表現力の検証が必要 |


## 5. 月間コスト試算

### 前提

- 1アカウント1日1本
- 1本 = 15秒（3セクション × 5秒）
- 月30日

### 試算表

| 時期 | アカウント数 | 月間動画 | 月間動画時間 | Pro ($9.14/分) | Std ($7.81/分) |
|------|------------|---------|-------------|----------------|----------------|
| 2月 | 50 | 1,500 | 375分 | **$3,428** | **$2,929** |
| 3月 | 160 | 4,800 | 1,200分 | **$10,968** | **$9,372** |
| 4月 | 340 | 10,200 | 2,550分 | **$23,307** | **$19,916** |
| 6月 | 700 | 21,000 | 5,250分 | **$47,985** | **$41,003** |

> 「1分あたりいくら」が分かっていれば、動画の長さや本数が変わっても即座に再計算できる。


## 参照元一覧

| サービス | 公式料金ページ |
|----------|---------------|
| fal.ai 全体料金 | https://fal.ai/pricing |
| Kling v2.6 Standard Motion Control (fal.ai) | https://fal.ai/models/fal-ai/kling-video/v2.6/standard/motion-control |
| Kling v2.6 Pro Motion Control (fal.ai) | https://fal.ai/models/fal-ai/kling-video/v2.6/pro/motion-control |
| Sync Lipsync v2 Pro (fal.ai) | https://fal.ai/models/fal-ai/sync-lipsync/v2/pro |
| Sync Lipsync v2 Standard (fal.ai) | https://fal.ai/models/fal-ai/sync-lipsync/v2 |
| Fabric 1.0 (fal.ai / VEED) | https://fal.ai/models/veed/fabric-1.0 |
| VEED | https://www.veed.io |
| Fish Audio | https://fish.audio |
| Kling AI 直接API料金 | https://klingai.com/global/dev/pricing |
| Sync Labs 直接API料金 | https://sync.so/pricing |
| Sync Labs APIドキュメント | https://docs.sync.so/models/lipsync |
