# 12. テスト仕様書 (Test Specifications)

> **原則**: Anthropic "Effective Harnesses for Long-Running Agents" に準拠。
> 全テストは **AIエージェントが人間の判断なしにPass/Failを判定可能** な精度で記述する。
> 曖昧な期待値（「正しく動作すること」「適切に処理されること」）は禁止。
> 全て具体的な数値・文字列・構造体で期待結果を定義する。

## テストID体系

```
TEST-{LAYER}-{NUMBER}
```

| Layer | Prefix | 対象 |
|-------|--------|------|
| Database | DB | PostgreSQL スキーマ・制約・トリガー・インデックス |
| MCP Server | MCP | 89 MCP ツールの入出力・バリデーション |
| Worker | WKR | タスクキュー処理・動画制作・投稿・計測ワーカー |
| LangGraph Agent | AGT | 4グラフのノード遷移・状態管理・チェックポイント |
| Dashboard | DSH | Next.js 15ページ・13 REST API・テーマ・レスポンシブ |
| Integration | INT | レイヤー間連携・グラフ間間接通信 |
| E2E | E2E | 全ライフサイクル貫通テスト |

## 優先度定義

| Priority | 定義 | 基準 |
|----------|------|------|
| P0 | ブロッカー | これが失敗するとシステムが起動・動作不能 |
| P1 | クリティカル | コア機能が動作不能。データ整合性に影響 |
| P2 | 重要 | 主要機能の一部が制限される |
| P3 | 低 | エッジケース・UI微調整 |

---

## 1. Database Layer Tests (TEST-DB)

### TEST-DB-001: pgvector拡張の有効化確認
- **Category**: database
- **Priority**: P0
- **Prerequisites**: PostgreSQL 16+ インスタンスが起動済み
- **Steps**:
  1. `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';` を実行
- **Expected Result**: 1行返却。`extname = 'vector'`
- **Pass Criteria**: 行数 = 1 AND extname = 'vector'
- **Fail Indicators**: 0行返却、またはERROR

### TEST-DB-002: 全26テーブルの存在確認
- **Category**: database
- **Priority**: P0
- **Prerequisites**: マイグレーション実行済み
- **Steps**:
  1. `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;` を実行
- **Expected Result**: 以下26テーブルが全て存在:
  `accounts`, `agent_communications`, `agent_individual_learnings`, `agent_prompt_versions`, `agent_reflections`, `agent_thought_logs`, `algorithm_performance`, `analyses`, `characters`, `components`, `content`, `content_sections`, `cycles`, `human_directives`, `hypotheses`, `learnings`, `market_intel`, `metrics`, `production_recipes`, `prompt_suggestions`, `publications`, `system_settings`, `task_queue`, `tool_catalog`, `tool_experiences`, `tool_external_sources`
- **Pass Criteria**: 返却行数 = 26 AND 全テーブル名が一致
- **Fail Indicators**: 行数 ≠ 26、またはテーブル名の不一致

### TEST-DB-003: accounts.platform CHECK制約
- **Category**: database
- **Priority**: P0
- **Prerequisites**: accounts テーブル作成済み
- **Steps**:
  1. `INSERT INTO accounts (account_id, platform, status) VALUES ('ACC_TEST1', 'youtube', 'setup');` — 成功を確認
  2. `INSERT INTO accounts (account_id, platform, status) VALUES ('ACC_TEST2', 'facebook', 'setup');` — 失敗を確認
- **Expected Result**: Step 1 は INSERT 成功。Step 2 は CHECK制約違反エラー
- **Pass Criteria**: Step 1 成功 AND Step 2 が `violates check constraint "chk_accounts_platform"` エラー
- **Fail Indicators**: Step 2 が成功する、または異なるエラー

### TEST-DB-004: accounts.platform 許可値の網羅確認
- **Category**: database
- **Priority**: P1
- **Prerequisites**: accounts テーブル作成済み
- **Steps**:
  1. 以下4値それぞれで INSERT を実行: `'youtube'`, `'tiktok'`, `'instagram'`, `'x'`
- **Expected Result**: 4件全て INSERT 成功
- **Pass Criteria**: 4件全てエラーなく挿入 AND `SELECT COUNT(*) FROM accounts WHERE platform IN ('youtube','tiktok','instagram','x')` が 4 を返す
- **Fail Indicators**: いずれかの INSERT が CHECK制約違反

### TEST-DB-005: accounts.status CHECK制約
- **Category**: database
- **Priority**: P0
- **Prerequisites**: accounts テーブル作成済み
- **Steps**:
  1. `'active'`, `'suspended'`, `'setup'` で各 INSERT — 成功を確認
  2. `'deleted'` で INSERT — 失敗を確認
- **Expected Result**: Step 1 の3件は成功。Step 2 は CHECK制約違反
- **Pass Criteria**: 3件成功 AND `'deleted'` が `chk_accounts_status` 違反
- **Fail Indicators**: `'deleted'` が成功する

### TEST-DB-006: accounts.status デフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: accounts テーブル作成済み
- **Steps**:
  1. `INSERT INTO accounts (account_id, platform) VALUES ('ACC_DEF1', 'youtube');`
  2. `SELECT status FROM accounts WHERE account_id = 'ACC_DEF1';`
- **Expected Result**: `status = 'setup'`
- **Pass Criteria**: status が文字列 `'setup'` と完全一致
- **Fail Indicators**: status が NULL または 'setup' 以外

### TEST-DB-007: accounts.monetization_status CHECK制約
- **Category**: database
- **Priority**: P1
- **Prerequisites**: accounts テーブル作成済み
- **Steps**:
  1. `'none'`, `'eligible'`, `'active'` で各 INSERT — 成功を確認
  2. `'pending'` で INSERT — 失敗を確認
- **Expected Result**: 3件成功、`'pending'` は CHECK制約違反
- **Pass Criteria**: `chk_accounts_monetization` 違反エラー
- **Fail Indicators**: `'pending'` が成功する

### TEST-DB-008: accounts.account_id UNIQUE制約
- **Category**: database
- **Priority**: P0
- **Prerequisites**: accounts テーブル作成済み
- **Steps**:
  1. `INSERT INTO accounts (account_id, platform) VALUES ('ACC_UNIQ', 'youtube');`
  2. 同一 account_id で再 INSERT
- **Expected Result**: Step 2 が UNIQUE制約違反エラー
- **Pass Criteria**: `duplicate key value violates unique constraint` エラー
- **Fail Indicators**: Step 2 が成功する

### TEST-DB-009: characters.voice_id NOT NULL制約
- **Category**: database
- **Priority**: P0
- **Prerequisites**: characters テーブル作成済み
- **Steps**:
  1. `INSERT INTO characters (character_id, name) VALUES ('CHR_TEST', 'TestChar');` — voice_id 省略
- **Expected Result**: NOT NULL制約違反エラー
- **Pass Criteria**: `null value in column "voice_id" violates not-null constraint` エラー
- **Fail Indicators**: INSERT が成功する

### TEST-DB-010: characters.voice_id VARCHAR(32)長制限
- **Category**: database
- **Priority**: P1
- **Prerequisites**: characters テーブル作成済み
- **Steps**:
  1. 32文字の voice_id で INSERT — 成功
  2. 33文字の voice_id で INSERT — 失敗
- **Expected Result**: Step 1 成功、Step 2 が `value too long for type character varying(32)` エラー
- **Pass Criteria**: 32文字は成功 AND 33文字は失敗
- **Fail Indicators**: 33文字が成功する

### TEST-DB-011: components.type CHECK制約
- **Category**: database
- **Priority**: P0
- **Prerequisites**: components テーブル作成済み
- **Steps**:
  1. `'scenario'`, `'motion'`, `'audio'`, `'image'` で各 INSERT — 成功
  2. `'video'` で INSERT — 失敗
- **Expected Result**: 4件成功、`'video'` は CHECK制約違反
- **Pass Criteria**: `chk_components_type` 違反エラー
- **Fail Indicators**: `'video'` が成功する

### TEST-DB-012: components.score CHECK制約 (範囲 0.00-100.00)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: components テーブル作成済み
- **Steps**:
  1. `score = 0.00` で INSERT — 成功
  2. `score = 100.00` で INSERT — 成功
  3. `score = 50.50` で INSERT — 成功
  4. `score = -0.01` で INSERT — 失敗
  5. `score = 100.01` で INSERT — 失敗
  6. `score = NULL` で INSERT — 成功 (NULL許可)
- **Expected Result**: Steps 1-3,6 成功。Steps 4-5 CHECK制約違反
- **Pass Criteria**: 範囲外の値が全て拒否される
- **Fail Indicators**: 範囲外の値が成功する

### TEST-DB-013: components.curated_by CHECK制約とデフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: components テーブル作成済み
- **Steps**:
  1. curated_by 省略で INSERT
  2. `SELECT curated_by FROM components WHERE ...`
  3. `'auto'` で INSERT — 成功
  4. `'system'` で INSERT — 失敗
- **Expected Result**: デフォルト値 `'human'`。`'auto'` 成功。`'system'` は CHECK制約違反
- **Pass Criteria**: デフォルト = 'human' AND 'auto' 成功 AND 'system' 失敗
- **Fail Indicators**: デフォルト値が 'human' でない、または 'system' が成功

### TEST-DB-014: components.review_status CHECK制約とデフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: components テーブル作成済み
- **Steps**:
  1. review_status 省略で INSERT → デフォルト確認
  2. `'auto_approved'`, `'pending_review'`, `'human_approved'` で各 INSERT — 成功
  3. `'rejected'` で INSERT — 失敗
- **Expected Result**: デフォルト = `'auto_approved'`。3値成功。`'rejected'` 失敗
- **Pass Criteria**: デフォルト = 'auto_approved' AND 'rejected' が CHECK制約違反
- **Fail Indicators**: デフォルトが異なる、または 'rejected' が成功

### TEST-DB-015: content.status CHECK制約 (12値)
- **Category**: database
- **Priority**: P0
- **Prerequisites**: content テーブル作成済み (FK依存テーブル含む)
- **Steps**:
  1. 以下12値で各 INSERT を実行:
     `'planned'`, `'producing'`, `'ready'`, `'pending_review'`, `'pending_approval'`, `'approved'`, `'rejected'`, `'revision_needed'`, `'posted'`, `'measured'`, `'cancelled'`, `'analyzed'`
  2. `'draft'` で INSERT — 失敗
- **Expected Result**: 12件成功。`'draft'` は CHECK制約違反
- **Pass Criteria**: 12値全て成功 AND 不正値が `chk_content_status` 違反
- **Fail Indicators**: いずれかの正規値が失敗、または不正値が成功

### TEST-DB-016: content.status デフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: content テーブル作成済み
- **Steps**:
  1. status 省略で INSERT
  2. `SELECT status FROM content WHERE ...`
- **Expected Result**: `status = 'planned'`
- **Pass Criteria**: status が文字列 `'planned'` と完全一致
- **Fail Indicators**: status が 'planned' 以外

### TEST-DB-017: content.content_format CHECK制約
- **Category**: database
- **Priority**: P0
- **Prerequisites**: content テーブル作成済み
- **Steps**:
  1. `'short_video'`, `'text_post'`, `'image_post'` で各 INSERT — 成功
  2. `'reel'` で INSERT — 失敗
- **Expected Result**: 3件成功。`'reel'` は CHECK制約違反
- **Pass Criteria**: `chk_content_format` 違反エラー
- **Fail Indicators**: `'reel'` が成功する

### TEST-DB-018: content.quality_score CHECK制約 (範囲 0-10)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: content テーブル作成済み
- **Steps**:
  1. `quality_score = 0` — 成功
  2. `quality_score = 10` — 成功
  3. `quality_score = 8.5` — 成功
  4. `quality_score = -1` — 失敗
  5. `quality_score = 10.1` — 失敗
  6. `quality_score = NULL` — 成功
- **Expected Result**: Steps 1-3,6 成功。Steps 4-5 CHECK制約違反
- **Pass Criteria**: `chk_content_quality_score` 違反エラー
- **Fail Indicators**: 範囲外の値が成功

### TEST-DB-019: content.rejection_category CHECK制約
- **Category**: database
- **Priority**: P1
- **Prerequisites**: content テーブル作成済み
- **Steps**:
  1. `'plan_revision'`, `'data_insufficient'`, `'hypothesis_weak'` で各 INSERT — 成功
  2. `NULL` で INSERT — 成功
  3. `'quality_low'` で INSERT — 失敗
- **Expected Result**: 3値+NULL成功。`'quality_low'` は CHECK制約違反
- **Pass Criteria**: `chk_content_rejection_category` 違反エラー
- **Fail Indicators**: `'quality_low'` が成功

### TEST-DB-020: content.review_status CHECK制約とデフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: content テーブル作成済み
- **Steps**:
  1. review_status 省略で INSERT → デフォルト確認
  2. `'not_required'`, `'pending_review'`, `'approved'`, `'rejected'` で各 INSERT — 成功
  3. `'auto_approved'` で INSERT — 失敗
- **Expected Result**: デフォルト = `'not_required'`。4値成功。`'auto_approved'` 失敗
- **Pass Criteria**: デフォルト = 'not_required' AND 'auto_approved' がCHECK制約違反
- **Fail Indicators**: デフォルトが異なる

### TEST-DB-021: publications.status CHECK制約
- **Category**: database
- **Priority**: P0
- **Prerequisites**: publications テーブル作成済み
- **Steps**:
  1. `'scheduled'`, `'posted'`, `'measured'`, `'failed'` で各 INSERT — 成功
  2. `'cancelled'` で INSERT — 失敗
- **Expected Result**: 4件成功。`'cancelled'` は CHECK制約違反
- **Pass Criteria**: `chk_publications_status` 違反エラー
- **Fail Indicators**: `'cancelled'` が成功

### TEST-DB-022: hypotheses.category CHECK制約 (5値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: hypotheses テーブル作成済み
- **Steps**:
  1. `'content_format'`, `'timing'`, `'niche'`, `'audience'`, `'platform_specific'` で各 INSERT — 成功
  2. `'budget'` で INSERT — 失敗
- **Expected Result**: 5件成功。`'budget'` は CHECK制約違反
- **Pass Criteria**: `chk_hypotheses_category` 違反エラー
- **Fail Indicators**: `'budget'` が成功

### TEST-DB-023: hypotheses.verdict CHECK制約とデフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: hypotheses テーブル作成済み
- **Steps**:
  1. verdict 省略で INSERT → デフォルト確認
  2. `'pending'`, `'confirmed'`, `'rejected'`, `'inconclusive'` で各 INSERT — 成功
  3. `'unknown'` で INSERT — 失敗
- **Expected Result**: デフォルト = `'pending'`。4値成功。`'unknown'` 失敗
- **Pass Criteria**: デフォルト = 'pending' AND 'unknown' がCHECK制約違反
- **Fail Indicators**: デフォルトが 'pending' でない

### TEST-DB-024: hypotheses.confidence CHECK制約 (範囲 0.00-1.00)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: hypotheses テーブル作成済み
- **Steps**:
  1. `confidence = 0.00` — 成功
  2. `confidence = 1.00` — 成功
  3. `confidence = 0.75` — 成功
  4. `confidence = -0.01` — 失敗
  5. `confidence = 1.01` — 失敗
- **Expected Result**: Steps 1-3 成功。Steps 4-5 CHECK制約違反
- **Pass Criteria**: `chk_hypotheses_confidence` 違反エラー
- **Fail Indicators**: 範囲外の値が成功

### TEST-DB-025: hypotheses.embedding vector(1536) 次元数
- **Category**: database
- **Priority**: P0
- **Prerequisites**: hypotheses テーブル作成済み、pgvector 有効
- **Steps**:
  1. 1536次元のベクトルで INSERT — 成功
  2. 1535次元のベクトルで INSERT — 失敗
  3. 1537次元のベクトルで INSERT — 失敗
- **Expected Result**: 1536次元のみ成功
- **Pass Criteria**: 不正次元数が `expected 1536 dimensions` エラー
- **Fail Indicators**: 不正次元数が成功

### TEST-DB-026: market_intel.intel_type CHECK制約 (5値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: market_intel テーブル作成済み
- **Steps**:
  1. `'trending_topic'`, `'competitor_post'`, `'competitor_account'`, `'audience_signal'`, `'platform_update'` で各 INSERT — 成功
  2. `'news_article'` で INSERT — 失敗
- **Expected Result**: 5件成功。`'news_article'` はCHECK制約違反
- **Pass Criteria**: 5値全て成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-027: task_queue.task_type CHECK制約 (4値)
- **Category**: database
- **Priority**: P0
- **Prerequisites**: task_queue テーブル作成済み
- **Steps**:
  1. `'produce'`, `'publish'`, `'measure'`, `'curate'` で各 INSERT — 成功
  2. `'analyze'` で INSERT — 失敗
- **Expected Result**: 4件成功。`'analyze'` はCHECK制約違反
- **Pass Criteria**: `chk_task_type` 違反エラー
- **Fail Indicators**: `'analyze'` が成功

### TEST-DB-028: task_queue.status CHECK制約 (8値)
- **Category**: database
- **Priority**: P0
- **Prerequisites**: task_queue テーブル作成済み
- **Steps**:
  1. 以下8値で各 INSERT:
     `'pending'`, `'queued'`, `'waiting'`, `'processing'`, `'retrying'`, `'completed'`, `'failed'`, `'failed_permanent'`
  2. `'cancelled'` で INSERT — 失敗
- **Expected Result**: 8件成功。`'cancelled'` は CHECK制約違反
- **Pass Criteria**: `chk_task_status` 違反エラー
- **Fail Indicators**: `'cancelled'` が成功

### TEST-DB-029: task_queue.status デフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: task_queue テーブル作成済み
- **Steps**:
  1. status 省略で INSERT
  2. `SELECT status FROM task_queue WHERE ...`
- **Expected Result**: `status = 'pending'`
- **Pass Criteria**: status が 'pending' と完全一致
- **Fail Indicators**: status が 'pending' 以外

### TEST-DB-030: task_queue.retry_count デフォルト値と max_retries デフォルト値
- **Category**: database
- **Priority**: P1
- **Prerequisites**: task_queue テーブル作成済み
- **Steps**:
  1. retry_count, max_retries 省略で INSERT
  2. `SELECT retry_count, max_retries FROM task_queue WHERE ...`
- **Expected Result**: `retry_count = 0`, `max_retries = 3`
- **Pass Criteria**: retry_count = 0 AND max_retries = 3
- **Fail Indicators**: いずれかのデフォルト値が異なる

### TEST-DB-031: agent_individual_learnings.category CHECK制約 (17値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: agent_individual_learnings テーブル作成済み
- **Steps**:
  1. 以下17値で各 INSERT:
     `'data_source'`, `'technique'`, `'pattern'`, `'mistake'`, `'insight'`, `'tool_characteristics'`, `'tool_combination'`, `'tool_failure_pattern'`, `'tool_update'`, `'data_classification'`, `'curation_quality'`, `'source_reliability'`, `'content'`, `'timing'`, `'audience'`, `'platform'`, `'niche'`
  2. `'general'` で INSERT — 失敗
- **Expected Result**: 17件成功。`'general'` は CHECK制約違反
- **Pass Criteria**: 17値全て成功 AND 不正値が拒否
- **Fail Indicators**: いずれかの正規値が失敗、または不正値が成功

### TEST-DB-032: agent_individual_learnings.confidence デフォルト値と範囲
- **Category**: database
- **Priority**: P1
- **Prerequisites**: agent_individual_learnings テーブル作成済み
- **Steps**:
  1. confidence 省略で INSERT → デフォルト確認
  2. `confidence = 0.0` — 成功
  3. `confidence = 1.0` — 成功
  4. `confidence = -0.1` — 失敗
  5. `confidence = 1.1` — 失敗
- **Expected Result**: デフォルト = `0.5`。範囲 0.0-1.0
- **Pass Criteria**: デフォルト = 0.5 AND 範囲外が拒否
- **Fail Indicators**: デフォルトが 0.5 でない、または範囲外が成功

### TEST-DB-033: agent_individual_learnings.success_rate GENERATED ALWAYS カラム
- **Category**: database
- **Priority**: P1
- **Prerequisites**: agent_individual_learnings テーブル作成済み
- **Steps**:
  1. `times_applied = 10, times_successful = 7` で INSERT
  2. `SELECT success_rate FROM agent_individual_learnings WHERE ...`
  3. `times_applied = 0, times_successful = 0` で INSERT
  4. `SELECT success_rate FROM agent_individual_learnings WHERE ...`
- **Expected Result**: Step 2: `success_rate = 0.7`。Step 4: `success_rate = 0.0`
- **Pass Criteria**: 自動計算値が `times_successful / times_applied` (or 0.0) と一致
- **Fail Indicators**: 計算値が不一致、またはGENERATED列でない

### TEST-DB-034: agent_communications.message_type CHECK制約 (6値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: agent_communications テーブル作成済み
- **Steps**:
  1. `'struggle'`, `'proposal'`, `'question'`, `'status_report'`, `'anomaly_alert'`, `'milestone'` で各 INSERT — 成功
  2. `'error'` で INSERT — 失敗
- **Expected Result**: 6件成功。`'error'` は CHECK制約違反
- **Pass Criteria**: 6値全て成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-035: agent_type CHECK制約の統一確認 (6テーブル共通)
- **Category**: database
- **Priority**: P0
- **Prerequisites**: 全テーブル作成済み
- **Steps**:
  1. 以下6テーブルの agent_type カラムで `'strategist'` を INSERT — 全て成功:
     `agent_prompt_versions`, `agent_thought_logs`, `agent_reflections`, `agent_individual_learnings`, `agent_communications`, `prompt_suggestions`
  2. 同6テーブルで `'worker'` を INSERT — 全て失敗
- **Expected Result**: 6テーブル全てで許可値 = `'strategist'`, `'researcher'`, `'analyst'`, `'planner'`, `'tool_specialist'`, `'data_curator'`
- **Pass Criteria**: 全テーブルで `'worker'` がCHECK制約違反
- **Fail Indicators**: いずれかのテーブルで `'worker'` が成功

### TEST-DB-036: human_directives.directive_type CHECK制約 (5値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: human_directives テーブル作成済み
- **Steps**:
  1. `'hypothesis'`, `'reference_content'`, `'instruction'`, `'learning_guidance'`, `'agent_response'` で各 INSERT — 成功
  2. `'command'` で INSERT — 失敗
- **Expected Result**: 5件成功。`'command'` は CHECK制約違反
- **Pass Criteria**: 5値成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-037: cycles.status CHECK制約 (5値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: cycles テーブル作成済み
- **Steps**:
  1. `'planning'`, `'executing'`, `'measuring'`, `'analyzing'`, `'completed'` で各 INSERT — 成功
  2. `'cancelled'` で INSERT — 失敗
- **Expected Result**: 5件成功。`'cancelled'` は CHECK制約違反
- **Pass Criteria**: 5値成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-038: tool_catalog.tool_type CHECK制約 (11値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: tool_catalog テーブル作成済み
- **Steps**:
  1. 以下11値で各 INSERT:
     `'video_generation'`, `'tts'`, `'lipsync'`, `'image_generation'`, `'embedding'`, `'llm'`, `'search'`, `'social_api'`, `'analytics_api'`, `'storage'`, `'other'`
  2. `'audio'` で INSERT — 失敗
- **Expected Result**: 11件成功。`'audio'` は CHECK制約違反
- **Pass Criteria**: `chk_tool_catalog_tool_type` 違反エラー
- **Fail Indicators**: 不正値が成功

### TEST-DB-039: tool_external_sources.source_type CHECK制約 (8値)
- **Category**: database
- **Priority**: P2
- **Prerequisites**: tool_external_sources テーブル作成済み
- **Steps**:
  1. `'x_post'`, `'official_doc'`, `'press_release'`, `'blog'`, `'forum'`, `'research_paper'`, `'changelog'`, `'other'` で各 INSERT — 成功
  2. `'tweet'` で INSERT — 失敗
- **Expected Result**: 8件成功。`'tweet'` は CHECK制約違反
- **Pass Criteria**: 8値成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-040: production_recipes.content_format CHECK制約
- **Category**: database
- **Priority**: P1
- **Prerequisites**: production_recipes テーブル作成済み
- **Steps**:
  1. `'short_video'`, `'text_post'`, `'image_post'` で各 INSERT — 成功
  2. `'long_video'` で INSERT — 失敗
- **Expected Result**: 3件成功。`'long_video'` は CHECK制約違反
- **Pass Criteria**: `chk_recipes_content_format` 違反エラー
- **Fail Indicators**: 不正値が成功

### TEST-DB-041: prompt_suggestions.trigger_type CHECK制約 (6値)
- **Category**: database
- **Priority**: P2
- **Prerequisites**: prompt_suggestions テーブル作成済み
- **Steps**:
  1. `'score_decline'`, `'repeated_issue'`, `'new_pattern'`, `'tool_update'`, `'manual'`, `'other'` で各 INSERT — 成功
  2. `'auto'` で INSERT — 失敗
- **Expected Result**: 6件成功。`'auto'` は CHECK制約違反
- **Pass Criteria**: 6値成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-042: prompt_suggestions.status CHECK制約とデフォルト値
- **Category**: database
- **Priority**: P2
- **Prerequisites**: prompt_suggestions テーブル作成済み
- **Steps**:
  1. status 省略で INSERT → デフォルト確認
  2. `'pending'`, `'accepted'`, `'rejected'`, `'expired'` で各 INSERT — 成功
  3. `'archived'` で INSERT — 失敗
- **Expected Result**: デフォルト = `'pending'`。4値成功。`'archived'` 失敗
- **Pass Criteria**: デフォルト = 'pending' AND 不正値がCHECK制約違反
- **Fail Indicators**: デフォルトが異なる、または不正値が成功

### TEST-DB-043: system_settings テーブル構造確認
- **Category**: database
- **Priority**: P0
- **Prerequisites**: system_settings テーブル作成済み
- **Steps**:
  1. `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'system_settings' ORDER BY ordinal_position;`
- **Expected Result**: 以下8カラムが存在:
  `setting_key` (character varying), `setting_value` (jsonb), `category` (character varying), `description` (text), `default_value` (jsonb), `value_type` (character varying), `constraints` (jsonb), `updated_at` (timestamp with time zone), `updated_by` (character varying)
- **Pass Criteria**: 全カラム名とデータ型が一致
- **Fail Indicators**: カラムの欠如または型の不一致

### TEST-DB-044: system_settings.category CHECK制約 (8値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: system_settings テーブル作成済み
- **Steps**:
  1. `'production'`, `'posting'`, `'agent'`, `'measurement'`, `'dashboard'`, `'credentials'`, `'cost_control'`, `'review'` で各 INSERT — 成功
  2. `'system'` で INSERT — 失敗
- **Expected Result**: 8件成功。`'system'` はCHECK制約違反
- **Pass Criteria**: 8値成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-045: system_settings.value_type CHECK制約 (6値)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: system_settings テーブル作成済み
- **Steps**:
  1. `'integer'`, `'float'`, `'boolean'`, `'string'`, `'json'`, `'enum'` で各 INSERT — 成功
  2. `'array'` で INSERT — 失敗
- **Expected Result**: 6件成功。`'array'` はCHECK制約違反
- **Pass Criteria**: 6値成功 AND 不正値が拒否
- **Fail Indicators**: 不正値が成功

### TEST-DB-046: system_settings 初期データ件数 (73件)
- **Category**: database
- **Priority**: P0
- **Prerequisites**: 初期INSERTマイグレーション実行済み
- **Steps**:
  1. `SELECT COUNT(*) FROM system_settings;`
- **Expected Result**: `count = 73`
- **Pass Criteria**: COUNT = 73
- **Fail Indicators**: COUNT ≠ 73

### TEST-DB-047: system_settings カテゴリ別件数
- **Category**: database
- **Priority**: P1
- **Prerequisites**: 初期INSERTマイグレーション実行済み
- **Steps**:
  1. `SELECT category, COUNT(*) FROM system_settings GROUP BY category ORDER BY category;`
- **Expected Result**:
  | category | count |
  |----------|-------|
  | agent | 38 |
  | cost_control | 4 |
  | credentials | 5 |
  | dashboard | 3 |
  | measurement | 6 |
  | posting | 4 |
  | production | 9 |
  | review | 4 |
- **Pass Criteria**: 8カテゴリの件数が全て一致
- **Fail Indicators**: いずれかのカテゴリの件数が不一致

### TEST-DB-048: system_settings 主要デフォルト値の確認
- **Category**: database
- **Priority**: P0
- **Prerequisites**: 初期INSERTマイグレーション実行済み
- **Steps**:
  1. 以下のキーのデフォルト値を確認:
     ```sql
     SELECT setting_key, setting_value FROM system_settings
     WHERE setting_key IN (
       'MAX_CONCURRENT_PRODUCTIONS', 'MAX_RETRY_ATTEMPTS',
       'HUMAN_REVIEW_ENABLED', 'AUTO_APPROVE_SCORE_THRESHOLD',
       'LEARNING_CONFIDENCE_THRESHOLD', 'DAILY_BUDGET_LIMIT_USD',
       'EMBEDDING_DIMENSION', 'LEARNING_SUCCESS_INCREMENT',
       'LEARNING_FAILURE_DECREMENT'
     );
     ```
- **Expected Result**:
  | setting_key | setting_value |
  |-------------|---------------|
  | MAX_CONCURRENT_PRODUCTIONS | '5' |
  | MAX_RETRY_ATTEMPTS | '3' |
  | HUMAN_REVIEW_ENABLED | 'true' |
  | AUTO_APPROVE_SCORE_THRESHOLD | '8.0' |
  | LEARNING_CONFIDENCE_THRESHOLD | '0.7' |
  | DAILY_BUDGET_LIMIT_USD | '100' |
  | EMBEDDING_DIMENSION | '1536' |
  | LEARNING_SUCCESS_INCREMENT | '0.1' |
  | LEARNING_FAILURE_DECREMENT | '0.15' |
- **Pass Criteria**: 全9キーの値が完全一致
- **Fail Indicators**: いずれかの値が不一致

### TEST-DB-049: FK制約 — accounts.character_id → characters.character_id
- **Category**: database
- **Priority**: P0
- **Prerequisites**: accounts, characters テーブル作成済み
- **Steps**:
  1. 存在しない character_id で accounts INSERT — 失敗
  2. characters に CHR_FK01 を INSERT 後、accounts でその character_id を参照 — 成功
- **Expected Result**: Step 1 は FK制約違反。Step 2 は成功
- **Pass Criteria**: `violates foreign key constraint` エラー (Step 1)
- **Fail Indicators**: 存在しないFKでINSERTが成功

### TEST-DB-050: FK制約 — content.hypothesis_id → hypotheses.id
- **Category**: database
- **Priority**: P1
- **Prerequisites**: content, hypotheses テーブル作成済み
- **Steps**:
  1. 存在しない hypothesis_id で content INSERT — 失敗
  2. `hypothesis_id = NULL` で content INSERT — 成功 (NULLable FK)
- **Expected Result**: Step 1 はFK違反。Step 2 は成功
- **Pass Criteria**: 不正FK拒否 AND NULL許可
- **Fail Indicators**: 存在しないFKが成功、またはNULLが拒否

### TEST-DB-051: updated_at トリガー動作確認
- **Category**: database
- **Priority**: P1
- **Prerequisites**: accounts テーブル作成済み、トリガー設定済み
- **Steps**:
  1. accounts に1行 INSERT、`created_at` と `updated_at` を記録
  2. 1秒以上待機
  3. その行の `platform_username` を UPDATE
  4. `SELECT updated_at FROM accounts WHERE ...`
- **Expected Result**: `updated_at` が Step 1 の値より新しい
- **Pass Criteria**: updated_at > (Step 1 の updated_at)
- **Fail Indicators**: updated_at が変更されていない

### TEST-DB-052: インデックス存在確認 — accounts テーブル
- **Category**: database
- **Priority**: P1
- **Prerequisites**: インデックス作成済み
- **Steps**:
  1. `SELECT indexname FROM pg_indexes WHERE tablename = 'accounts' ORDER BY indexname;`
- **Expected Result**: 以下のインデックスが存在:
  `idx_accounts_character`, `idx_accounts_cluster`, `idx_accounts_niche`, `idx_accounts_platform`, `idx_accounts_platform_status`, `idx_accounts_status`
- **Pass Criteria**: 6個のインデックスが全て存在
- **Fail Indicators**: いずれかのインデックスが欠如

### TEST-DB-053: インデックス存在確認 — content テーブル
- **Category**: database
- **Priority**: P1
- **Prerequisites**: インデックス作成済み
- **Steps**:
  1. `SELECT indexname FROM pg_indexes WHERE tablename = 'content' ORDER BY indexname;`
- **Expected Result**: 以下のインデックスが存在:
  `idx_content_character`, `idx_content_created_at`, `idx_content_format`, `idx_content_format_status`, `idx_content_hypothesis`, `idx_content_planned_date`, `idx_content_production_metadata`, `idx_content_quality_score`, `idx_content_recipe`, `idx_content_review_status`, `idx_content_status`, `idx_content_status_planned_date`
- **Pass Criteria**: 12個のインデックスが全て存在
- **Fail Indicators**: いずれかのインデックスが欠如

### TEST-DB-054: HNSW ベクトルインデックス存在確認
- **Category**: database
- **Priority**: P1
- **Prerequisites**: pgvector + インデックス作成済み
- **Steps**:
  1. `SELECT indexname, indexdef FROM pg_indexes WHERE indexdef LIKE '%hnsw%' OR indexdef LIKE '%ivfflat%' ORDER BY indexname;`
- **Expected Result**: hypotheses, market_intel, learnings, agent_individual_learnings, tool_external_sources のembeddingカラムにベクトルインデックスが存在
- **Pass Criteria**: 5テーブルのベクトルインデックスが存在
- **Fail Indicators**: ベクトルインデックスが欠如

### TEST-DB-055: テーブル作成順序 — FK依存関係の検証
- **Category**: database
- **Priority**: P0
- **Prerequisites**: クリーンなDB
- **Steps**:
  1. 以下の順序で CREATE TABLE を実行:
     Layer 1: `characters`, `cycles`, `system_settings`, `tool_catalog`
     Layer 2: `accounts`, `hypotheses`, `components`, `production_recipes`
     Layer 3: `content`, `market_intel`, `learnings`, `human_directives`, `task_queue`, `algorithm_performance`, `agent_prompt_versions`, `agent_thought_logs`, `tool_external_sources`
     Layer 4: `content_sections`, `publications`, `analyses`, `agent_reflections`, `agent_communications`, `tool_experiences`, `prompt_suggestions`
     Layer 5: `metrics`, `agent_individual_learnings`
- **Expected Result**: 全26テーブルがエラーなく作成される
- **Pass Criteria**: 全 CREATE TABLE が成功
- **Fail Indicators**: いずれかのテーブル作成でFK依存エラー

---

## 2. MCP Server Layer Tests (TEST-MCP)

### 2.1 戦略エージェント用ツール (10ツール)

### TEST-MCP-001: get_portfolio_kpi_summary — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: accounts テーブルに3件以上、publications + metrics にデータあり
- **Steps**:
  1. `get_portfolio_kpi_summary({ period: "7d" })` を呼び出し
- **Expected Result**: 以下のキーを含むオブジェクトを返却:
  `total_accounts` (integer), `active_accounts` (integer), `total_views` (integer), `avg_engagement_rate` (float), `follower_growth` (integer), `monetized_count` (integer)
- **Pass Criteria**: 全6キーが存在 AND total_accounts >= 0 AND avg_engagement_rate >= 0.0
- **Fail Indicators**: キーの欠如、または型の不一致

### TEST-MCP-002: get_portfolio_kpi_summary — period バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `get_portfolio_kpi_summary({ period: "7d" })` — 成功
  2. `get_portfolio_kpi_summary({ period: "30d" })` — 成功
  3. `get_portfolio_kpi_summary({ period: "1y" })` — 失敗
- **Expected Result**: `"7d"`, `"30d"` は成功。`"1y"` はバリデーションエラー
- **Pass Criteria**: 不正な period でエラーを返却
- **Fail Indicators**: 不正な period が受け入れられる

### TEST-MCP-003: get_cluster_performance — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: accounts にクラスター情報あり
- **Steps**:
  1. `get_cluster_performance({ period: "7d" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `cluster` (string), `account_count` (integer), `avg_views` (number), `avg_engagement` (number) を含む
- **Pass Criteria**: 返却が配列 AND 各要素に4キーが存在
- **Fail Indicators**: 配列でない、またはキーの欠如

### TEST-MCP-004: get_top_learnings — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: learnings テーブルにデータあり
- **Steps**:
  1. `get_top_learnings({ limit: 10, min_confidence: 0.7 })` を呼び出し
- **Expected Result**: 配列を返却 (最大10件)。各要素に `insight` (string), `confidence` (float, >= 0.7), `evidence_count` (integer), `category` (string) を含む
- **Pass Criteria**: 返却件数 <= 10 AND 全件の confidence >= 0.7
- **Fail Indicators**: confidence < 0.7 の件が混入

### TEST-MCP-005: get_active_hypotheses — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: hypotheses テーブルにデータあり
- **Steps**:
  1. `get_active_hypotheses({ verdict: "pending" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `id` (integer), `statement` (string), `category` (string), `predicted_kpis` (object), `evidence_count` (integer) を含む
- **Pass Criteria**: 全件の verdict が 'pending'
- **Fail Indicators**: verdict が 'pending' でない件が混入

### TEST-MCP-006: create_cycle — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: cycles テーブル空
- **Steps**:
  1. `create_cycle({ cycle_number: 1 })` を呼び出し
- **Expected Result**: `{ id: integer, cycle_number: 1, status: 'planning' }` を返却
- **Pass Criteria**: id が正の整数 AND cycle_number = 1 AND status = 'planning'
- **Fail Indicators**: status が 'planning' でない、または id が返らない

### TEST-MCP-007: set_cycle_plan — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: cycles テーブルに cycle_id=1 が存在
- **Steps**:
  1. `set_cycle_plan({ cycle_id: 1, summary: { focus: "beauty", target_accounts: 5 } })` を呼び出し
- **Expected Result**: `{ success: true }` を返却
- **Pass Criteria**: success === true
- **Fail Indicators**: success が false またはエラー

### TEST-MCP-008: allocate_resources — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: cycles テーブルに cycle_id=1 が存在
- **Steps**:
  1. `allocate_resources({ cycle_id: 1, allocations: [{ cluster: "cluster_a", content_count: 10, budget: 50 }] })` を呼び出し
- **Expected Result**: `{ success: true }` を返却
- **Pass Criteria**: success === true
- **Fail Indicators**: エラーが返却される

### TEST-MCP-009: send_planner_directive — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `send_planner_directive({ cluster: "cluster_a", directive_text: "Focus on skincare content" })` を呼び出し
- **Expected Result**: `{ success: true }` を返却
- **Pass Criteria**: success === true
- **Fail Indicators**: エラーが返却される

### TEST-MCP-010: get_pending_directives — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: human_directives テーブルに status='pending' のデータあり
- **Steps**:
  1. `get_pending_directives({})` を呼び出し
- **Expected Result**: 配列を返却。各要素に `id`, `directive_type`, `content`, `priority`, `created_at` を含む
- **Pass Criteria**: 全件の status が 'pending' (内部フィルタ)
- **Fail Indicators**: status が 'pending' でない件が混入

### 2.2 リサーチャー用ツール (12ツール)

### TEST-MCP-011: save_trending_topic — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み、market_intel テーブル空
- **Steps**:
  1. `save_trending_topic({ topic: "glass skin", volume: 50000, growth_rate: 0.25, platform: "tiktok", niche: "beauty" })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。market_intel テーブルに1行 INSERT (intel_type = 'trending_topic')
- **Pass Criteria**: id が正の整数 AND market_intel に intel_type='trending_topic' の行が存在
- **Fail Indicators**: id が返らない、またはDB未挿入

### TEST-MCP-012: save_competitor_post — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_competitor_post({ post_url: "https://tiktok.com/@user/video/123", views: 1000000, format: "short_video", hook_technique: "question_hook", platform: "tiktok" })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。intel_type = 'competitor_post'
- **Pass Criteria**: id が正の整数
- **Fail Indicators**: エラーが返却される

### TEST-MCP-013: get_recent_intel — フィルタリング確認
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: market_intel に trending_topic 3件 + competitor_post 2件
- **Steps**:
  1. `get_recent_intel({ intel_type: "trending_topic", platform: "tiktok", limit: 20 })` を呼び出し
- **Expected Result**: 配列を返却。全件の intel_type = 'trending_topic'。各要素に `id`, `data`, `relevance_score`, `collected_at` を含む
- **Pass Criteria**: 返却件数 <= 20 AND 全件 intel_type = 'trending_topic'
- **Fail Indicators**: competitor_post の件が混入

### TEST-MCP-014: search_similar_intel — ベクトル検索
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: market_intel にembedding付きデータ5件以上
- **Steps**:
  1. `search_similar_intel({ query_text: "skincare trends in Japan", limit: 10 })` を呼び出し
- **Expected Result**: 配列を返却 (最大10件)。各要素に `id`, `data`, `similarity` (float 0.0-1.0) を含む。similarity 降順でソート
- **Pass Criteria**: 返却件数 <= 10 AND similarity が降順 AND 全値 0.0-1.0
- **Fail Indicators**: ソート順が不正、または similarity が範囲外

### TEST-MCP-015: get_niche_trends — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: market_intel にbeautyニッチのデータあり
- **Steps**:
  1. `get_niche_trends({ niche: "beauty", period: "7d" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `topic`, `volume`, `trend_direction` を含む
- **Pass Criteria**: 返却が配列 AND 各要素に3キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-016: get_intel_gaps — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: market_intel にデータあり
- **Steps**:
  1. `get_intel_gaps({ niche: "beauty" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `intel_type`, `last_collected`, `gap_hours` を含む
- **Pass Criteria**: 返却が配列 AND gap_hours >= 0
- **Fail Indicators**: gap_hours が負の値

### TEST-MCP-017: mark_intel_expired — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: market_intel に intel_id=1 のデータあり
- **Steps**:
  1. `mark_intel_expired({ intel_id: 1 })` を呼び出し
- **Expected Result**: `{ success: true }` を返却
- **Pass Criteria**: success === true
- **Fail Indicators**: エラーが返却される

### 2.3 アナリスト用ツール (14ツール)

### TEST-MCP-018: get_metrics_for_analysis — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: metrics + publications にデータあり
- **Steps**:
  1. `get_metrics_for_analysis({ since: "48h", status: "measured" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `publication_id`, `content_id`, `views`, `engagement_rate` を含む
- **Pass Criteria**: 返却が配列 AND 各要素に必須キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-019: verify_hypothesis — verdict設定
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: hypotheses に verdict='pending' の仮説あり (id=1)
- **Steps**:
  1. `verify_hypothesis({ hypothesis_id: 1, verdict: "confirmed", confidence: 0.85, evidence_summary: "10 content pieces showed 25% improvement" })` を呼び出し
  2. `SELECT verdict, confidence FROM hypotheses WHERE id = 1;`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: verdict='confirmed', confidence=0.85
- **Pass Criteria**: DB上の verdict と confidence が更新されている
- **Fail Indicators**: verdict が 'pending' のまま

### TEST-MCP-020: verify_hypothesis — 不正verdict拒否
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: hypotheses にデータあり
- **Steps**:
  1. `verify_hypothesis({ hypothesis_id: 1, verdict: "maybe", confidence: 0.5, evidence_summary: "..." })` を呼び出し
- **Expected Result**: バリデーションエラー (verdict must be one of: pending, confirmed, rejected, inconclusive)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: `'maybe'` が受け入れられる

### TEST-MCP-021: extract_learning — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: learnings テーブル空
- **Steps**:
  1. `extract_learning({ insight: "Morning posts get 30% more engagement in beauty niche", category: "timing", confidence: 0.75, source_analyses: [1], applicable_niches: ["beauty"] })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。learnings テーブルに1行 INSERT
- **Pass Criteria**: id が正の整数 AND learnings テーブルに category='timing' の行が存在
- **Fail Indicators**: id が返らない

### TEST-MCP-022: extract_learning — category バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `extract_learning({ insight: "...", category: "budget", confidence: 0.5, source_analyses: [], applicable_niches: [] })` を呼び出し
- **Expected Result**: バリデーションエラー (category must be one of: content, timing, audience, platform, niche)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: `'budget'` が受け入れられる

### TEST-MCP-023: detect_anomalies — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: metrics に14日分以上のデータあり
- **Steps**:
  1. `detect_anomalies({ period: "7d", threshold: 2.0 })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `account_id`, `metric`, `expected`, `actual`, `deviation` を含む
- **Pass Criteria**: 返却が配列 AND 全件の |deviation| >= 2.0
- **Fail Indicators**: deviation の絶対値が threshold 未満の件が混入

### TEST-MCP-024: calculate_algorithm_performance — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: hypotheses に confirmed + rejected のデータあり
- **Steps**:
  1. `calculate_algorithm_performance({ period: "weekly" })` を呼び出し
- **Expected Result**: `{ hypothesis_accuracy: float, prediction_error: float, learning_count: integer, improvement_rate: float }` を返却
- **Pass Criteria**: hypothesis_accuracy が 0.0-1.0 の範囲内
- **Fail Indicators**: 値が範囲外、またはキーの欠如

### TEST-MCP-025: create_analysis — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: cycles テーブルにデータあり
- **Steps**:
  1. `create_analysis({ cycle_id: 1, analysis_type: "cycle_review", findings: "Beauty niche outperformed by 20%", recommendations: "Increase beauty content allocation" })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却
- **Pass Criteria**: id が正の整数 AND analyses テーブルに行が存在
- **Fail Indicators**: id が返らない

### TEST-MCP-026: update_learning_confidence — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: learnings テーブルにデータあり (id=1, confidence=0.5)
- **Steps**:
  1. `update_learning_confidence({ learning_id: 1, new_confidence: 0.8, additional_evidence: "Verified with 5 more data points" })` を呼び出し
  2. `SELECT confidence FROM learnings WHERE id = 1;`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: confidence = 0.80
- **Pass Criteria**: confidence が 0.80 に更新されている
- **Fail Indicators**: confidence が変更されていない

### 2.4 プランナー用ツール (9ツール)

### TEST-MCP-027: get_assigned_accounts — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: accounts に cluster='cluster_a' のデータ3件
- **Steps**:
  1. `get_assigned_accounts({ cluster: "cluster_a" })` を呼び出し
- **Expected Result**: 配列を返却 (3件)。各要素に `account_id`, `platform`, `niche`, `follower_count`, `status` を含む
- **Pass Criteria**: 返却件数 = 3 AND 全件の cluster が 'cluster_a'
- **Fail Indicators**: 他クラスターの件が混入

### TEST-MCP-028: plan_content — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: hypotheses, characters, components にデータあり
- **Steps**:
  1. `plan_content({ hypothesis_id: 1, character_id: "CHR_0001", script_language: "jp", content_format: "short_video", sections: [{ component_id: "SCN_0001", section_label: "hook" }, { component_id: "SCN_0002", section_label: "body" }, { component_id: "SCN_0003", section_label: "cta" }] })` を呼び出し
- **Expected Result**: `{ content_id: string }` を返却。content テーブルに1行 + content_sections テーブルに3行 INSERT
- **Pass Criteria**: content_id が CNT_ 形式 AND content_sections に3行存在
- **Fail Indicators**: content_id が返らない、または content_sections の件数が不正

### TEST-MCP-029: plan_content — content_format バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `plan_content({ ..., content_format: "live_stream", ... })` を呼び出し
- **Expected Result**: バリデーションエラー
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'live_stream' が受け入れられる

### TEST-MCP-030: schedule_content — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: content テーブルにデータあり
- **Steps**:
  1. `schedule_content({ content_id: "CNT_202603_0001", planned_post_date: "2026-03-15" })` を呼び出し
  2. `SELECT planned_post_date FROM content WHERE content_id = 'CNT_202603_0001';`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: planned_post_date = '2026-03-15'
- **Pass Criteria**: 日付が正しく設定されている
- **Fail Indicators**: 日付が未設定

### TEST-MCP-031: request_production — task_queue INSERT確認
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: content テーブルにデータあり
- **Steps**:
  1. `request_production({ content_id: "CNT_202603_0001", priority: 0 })` を呼び出し
  2. `SELECT task_type, status, priority FROM task_queue WHERE payload->>'content_id' = 'CNT_202603_0001';`
- **Expected Result**: Step 1: `{ task_id: integer }`。Step 2: task_type='produce', status='pending', priority=0
- **Pass Criteria**: task_queue に正しく INSERT されている
- **Fail Indicators**: task_queue に行が存在しない

### TEST-MCP-032: create_hypothesis — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `create_hypothesis({ category: "timing", statement: "Morning posts at 7AM get 30% more engagement", rationale: "Based on 14-day data analysis", target_accounts: ["ACC_0013", "ACC_0015"], predicted_kpis: { views: 5000, engagement_rate: 0.05 } })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。hypotheses テーブルに1行 INSERT (verdict='pending', source='ai')
- **Pass Criteria**: id が正の整数 AND verdict = 'pending'
- **Fail Indicators**: id が返らない

### TEST-MCP-033: get_content_pool_status — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: content テーブルに各ステータスのデータあり
- **Steps**:
  1. `get_content_pool_status({ cluster: "cluster_a" })` を呼び出し
- **Expected Result**: `{ content: { pending_approval: int, planned: int, producing: int, ready: int, analyzed: int }, publications: { scheduled: int, posted: int, measured: int } }` を返却
- **Pass Criteria**: 全キーが存在 AND 全値が 0 以上の整数
- **Fail Indicators**: キーの欠如

### 2.5 ツールスペシャリスト用ツール (5ツール)

### TEST-MCP-034: get_tool_knowledge — カテゴリフィルタ
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: tool_catalog にデータあり
- **Steps**:
  1. `get_tool_knowledge({ category: "video_gen" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `tool_name`, `capabilities`, `limitations`, `best_for`, `parameters`, `updated_at` を含む
- **Pass Criteria**: 全件の tool_type が video_generation 系
- **Fail Indicators**: 無関係な tool_type が混入

### TEST-MCP-035: save_tool_experience — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: tool_catalog にデータあり、content にデータあり
- **Steps**:
  1. `save_tool_experience({ tool_combination: ["kling_v2.6", "fish_audio_tts", "fal_lipsync"], content_id: "CNT_202603_0001", quality_score: 0.85, notes: "Natural lip movement", character_type: "asian_female", niche: "beauty" })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却
- **Pass Criteria**: id が正の整数
- **Fail Indicators**: エラーが返却される

### TEST-MCP-036: get_tool_recommendations — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: tool_catalog + tool_experiences + production_recipes にデータあり
- **Steps**:
  1. `get_tool_recommendations({ content_requirements: { character_id: "CHR_0001", niche: "beauty", platform: "youtube", quality_target: 0.8 } })` を呼び出し
- **Expected Result**: `{ recipe: { video_gen, tts, lipsync, concat }, rationale: string, confidence: float, alternatives: array }` を返却
- **Pass Criteria**: recipe オブジェクトに4キーが存在 AND confidence が 0.0-1.0
- **Fail Indicators**: recipe が不完全

### 2.6 制作ワーカー用ツール (12ツール)

### TEST-MCP-037: get_production_task — タスクなし
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: task_queue テーブル空
- **Steps**:
  1. `get_production_task({})` を呼び出し
- **Expected Result**: `null` を返却
- **Pass Criteria**: 返却値が null
- **Fail Indicators**: 例外が発生する

### TEST-MCP-038: get_production_task — タスクあり
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: task_queue に task_type='produce', status='pending' の行が1件
- **Steps**:
  1. `get_production_task({})` を呼び出し
- **Expected Result**: `{ task_id: integer, content_id: string, payload: object }` を返却。task_queue の status が 'processing' に更新
- **Pass Criteria**: task_id が正の整数 AND payload に content_id が含まれる AND DB上 status='processing'
- **Fail Indicators**: status が 'pending' のまま

### TEST-MCP-039: get_character_info — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: characters にデータあり
- **Steps**:
  1. `get_character_info({ character_id: "CHR_0001" })` を呼び出し
- **Expected Result**: `{ name: string, voice_id: string (32 chars), image_drive_id: string, appearance: object }` を返却
- **Pass Criteria**: voice_id.length = 32 AND name が空でない
- **Fail Indicators**: voice_id が32文字でない

### TEST-MCP-040: start_video_generation — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: fal.ai APIキーが設定済み
- **Steps**:
  1. `start_video_generation({ image_url: "https://fal.media/files/...", motion_data: { duration: "5", aspect_ratio: "9:16" }, section: "hook" })` を呼び出し
- **Expected Result**: `{ request_id: string }` を返却
- **Pass Criteria**: request_id が空でない文字列
- **Fail Indicators**: request_id が返らない

### TEST-MCP-041: start_tts — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: Fish Audio APIキーが設定済み
- **Steps**:
  1. `start_tts({ text: "みんな〜！今日も一緒にキレイになろう！", voice_id: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", language: "jp" })` を呼び出し
- **Expected Result**: `{ audio_url: string }` を返却 (URL形式)
- **Pass Criteria**: audio_url が https:// で始まる文字列
- **Fail Indicators**: audio_url が返らない

### TEST-MCP-042: start_tts — voice_id 空文字拒否
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `start_tts({ text: "Hello", voice_id: "", language: "en" })` を呼び出し
- **Expected Result**: バリデーションエラー (voice_id is required)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 空の voice_id が受け入れられる

### TEST-MCP-043: start_lipsync — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: fal.ai APIキーが設定済み
- **Steps**:
  1. `start_lipsync({ video_url: "https://fal.media/files/video.mp4", audio_url: "https://fal.media/files/audio.mp3" })` を呼び出し
- **Expected Result**: `{ request_id: string }` を返却
- **Pass Criteria**: request_id が空でない文字列
- **Fail Indicators**: request_id が返らない

### TEST-MCP-044: upload_to_drive — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: Google Drive APIが設定済み
- **Steps**:
  1. `upload_to_drive({ file_url: "https://fal.media/files/final.mp4", folder_id: "1KRQuZ4W7u5CXRamjvN4xmavfu-7TPb0X", filename: "test_video.mp4" })` を呼び出し
- **Expected Result**: `{ drive_file_id: string, drive_url: string }` を返却
- **Pass Criteria**: drive_file_id が空でない AND drive_url が https://drive.google.com で始まる
- **Fail Indicators**: いずれかが返らない

### TEST-MCP-045: update_content_status — ステータス更新
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: content テーブルにデータあり (status='producing')
- **Steps**:
  1. `update_content_status({ content_id: "CNT_202603_0001", status: "ready", metadata: { total_seconds: 720 } })` を呼び出し
  2. `SELECT status FROM content WHERE content_id = 'CNT_202603_0001';`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: status = 'ready'
- **Pass Criteria**: status が 'ready' に更新されている
- **Fail Indicators**: status が 'producing' のまま

### TEST-MCP-046: update_content_status — 不正ステータス拒否
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `update_content_status({ content_id: "CNT_202603_0001", status: "deleted" })` を呼び出し
- **Expected Result**: バリデーションエラー
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'deleted' が受け入れられる

### TEST-MCP-047: run_quality_check — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: content にデータあり
- **Steps**:
  1. `run_quality_check({ content_id: "CNT_202603_0001", video_url: "https://fal.media/files/final.mp4" })` を呼び出し
- **Expected Result**: `{ passed: boolean, checks: [{ name: string, passed: boolean, details: string }] }` を返却
- **Pass Criteria**: checks が配列 AND 各要素に name, passed, details が存在
- **Fail Indicators**: checks の構造が不正

### TEST-MCP-048: report_production_complete — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: task_queue に処理中のタスクあり
- **Steps**:
  1. `report_production_complete({ task_id: 1, content_id: "CNT_202603_0001", drive_folder_id: "1abc", video_drive_id: "2def" })` を呼び出し
  2. `SELECT status FROM task_queue WHERE id = 1;`
  3. `SELECT video_drive_id FROM content WHERE content_id = 'CNT_202603_0001';`
- **Expected Result**: task_queue.status = 'completed'。content.video_drive_id = '2def'
- **Pass Criteria**: 両テーブルが更新されている
- **Fail Indicators**: いずれかのテーブルが未更新

### 2.7 投稿ワーカー用ツール (6ツール)

### TEST-MCP-049: get_publish_task — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: task_queue に task_type='publish' の行あり
- **Steps**:
  1. `get_publish_task({})` を呼び出し
- **Expected Result**: `{ task_id: integer, content_id: string, platform: string, payload: object }` を返却
- **Pass Criteria**: platform が 'youtube'|'tiktok'|'instagram'|'x' のいずれか
- **Fail Indicators**: platform が不正値

### TEST-MCP-050: publish_to_youtube — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: YouTube OAuth設定済み、content にデータあり
- **Steps**:
  1. `publish_to_youtube({ content_id: "CNT_202603_0001", title: "Morning Skincare", description: "...", tags: ["skincare"], video_drive_id: "1abc" })` を呼び出し
- **Expected Result**: `{ platform_post_id: string, post_url: string }` を返却
- **Pass Criteria**: platform_post_id が空でない AND post_url が URL形式
- **Fail Indicators**: いずれかが返らない

### TEST-MCP-051: publish_to_tiktok — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: TikTok OAuth設定済み
- **Steps**:
  1. `publish_to_tiktok({ content_id: "CNT_202603_0001", description: "Morning skincare routine", tags: ["skincare"], video_drive_id: "1abc" })` を呼び出し
- **Expected Result**: `{ platform_post_id: string, post_url: string }` を返却
- **Pass Criteria**: platform_post_id が空でない
- **Fail Indicators**: エラーが返却される

### TEST-MCP-052: publish_to_instagram — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: Instagram OAuth設定済み
- **Steps**:
  1. `publish_to_instagram({ content_id: "CNT_202603_0001", caption: "Morning skincare", tags: ["skincare"], video_drive_id: "1abc" })` を呼び出し
- **Expected Result**: `{ platform_post_id: string, post_url: string }` を返却
- **Pass Criteria**: platform_post_id が空でない
- **Fail Indicators**: エラーが返却される

### TEST-MCP-053: publish_to_x — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: X OAuth設定済み
- **Steps**:
  1. `publish_to_x({ content_id: "CNT_202603_0001", text: "Check out my skincare routine!", video_drive_id: "1abc" })` を呼び出し
- **Expected Result**: `{ platform_post_id: string, post_url: string }` を返却
- **Pass Criteria**: platform_post_id が空でない
- **Fail Indicators**: エラーが返却される

### TEST-MCP-054: report_publish_result — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: task_queue に publish タスクあり、publications にデータあり
- **Steps**:
  1. `report_publish_result({ task_id: 1, content_id: "CNT_202603_0001", platform_post_id: "abc123", post_url: "https://youtube.com/shorts/abc123", posted_at: "2026-03-15T10:00:00Z" })` を呼び出し
  2. `SELECT status FROM publications WHERE platform_post_id = 'abc123';`
- **Expected Result**: publications.status = 'posted'。posted_at が設定されている
- **Pass Criteria**: status = 'posted' AND posted_at IS NOT NULL
- **Fail Indicators**: status が 'scheduled' のまま

### 2.8 計測ワーカー用ツール (7ツール)

### TEST-MCP-055: get_measurement_tasks — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: task_queue に task_type='measure' の行あり
- **Steps**:
  1. `get_measurement_tasks({ limit: 10 })` を呼び出し
- **Expected Result**: 配列を返却 (最大10件)。各要素に `task_id`, `publication_id`, `platform`, `platform_post_id` を含む
- **Pass Criteria**: 返却件数 <= 10 AND 各要素に4キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-056: collect_youtube_metrics — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: YouTube Data API設定済み
- **Steps**:
  1. `collect_youtube_metrics({ platform_post_id: "dQw4w9WgXcQ" })` を呼び出し
- **Expected Result**: `{ views: integer, likes: integer, comments: integer, shares: integer, watch_time: number, completion_rate: float }` を返却
- **Pass Criteria**: 全6キーが存在 AND completion_rate が 0.0-1.0
- **Fail Indicators**: キーの欠如、または completion_rate が範囲外

### TEST-MCP-057: collect_tiktok_metrics — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: TikTok API設定済み
- **Steps**:
  1. `collect_tiktok_metrics({ platform_post_id: "123456" })` を呼び出し
- **Expected Result**: `{ views, likes, comments, shares, saves, completion_rate }` を返却
- **Pass Criteria**: 全6キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-058: collect_instagram_metrics — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: Instagram API設定済み
- **Steps**:
  1. `collect_instagram_metrics({ platform_post_id: "17841400xxx" })` を呼び出し
- **Expected Result**: `{ views, likes, comments, saves, reach, impressions }` を返却
- **Pass Criteria**: 全6キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-059: collect_x_metrics — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: X API設定済み
- **Steps**:
  1. `collect_x_metrics({ platform_post_id: "123456789" })` を呼び出し
- **Expected Result**: `{ impressions, likes, retweets, replies, quotes }` を返却
- **Pass Criteria**: 全5キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-060: collect_account_metrics — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: accounts にデータあり
- **Steps**:
  1. `collect_account_metrics({ account_id: "ACC_0013" })` を呼び出し
- **Expected Result**: `{ follower_count: integer, follower_delta: integer }` を返却
- **Pass Criteria**: follower_count >= 0
- **Fail Indicators**: キーの欠如

### TEST-MCP-061: report_measurement_complete — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: task_queue に measure タスクあり
- **Steps**:
  1. `report_measurement_complete({ task_id: 1, publication_id: 1, metrics_data: { views: 5000, likes: 200, engagement_rate: 0.04 } })` を呼び出し
  2. `SELECT status FROM task_queue WHERE id = 1;`
  3. `SELECT COUNT(*) FROM metrics WHERE publication_id = 1;`
- **Expected Result**: task_queue.status = 'completed'。metrics テーブルに1行以上
- **Pass Criteria**: task_queue 完了 AND metrics にデータ挿入
- **Fail Indicators**: いずれかが未更新

### 2.9 ダッシュボード用ツール (10ツール)

### TEST-MCP-062: get_dashboard_summary — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: 各テーブルにデータあり
- **Steps**:
  1. `get_dashboard_summary({})` を呼び出し
- **Expected Result**: `{ kpi: object, algorithm_accuracy: object, active_cycles: integer, pending_tasks: integer }` を返却
- **Pass Criteria**: 全4キーが存在 AND active_cycles >= 0
- **Fail Indicators**: キーの欠如

### TEST-MCP-063: update_system_config — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: system_settings に MAX_CONCURRENT_PRODUCTIONS あり
- **Steps**:
  1. `update_system_config({ key: "MAX_CONCURRENT_PRODUCTIONS", value: 10 })` を呼び出し
  2. `SELECT setting_value FROM system_settings WHERE setting_key = 'MAX_CONCURRENT_PRODUCTIONS';`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: setting_value = '10'
- **Pass Criteria**: 値が更新されている
- **Fail Indicators**: 値が変更されていない

### TEST-MCP-064: update_system_config — 制約違反拒否
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: system_settings に MAX_CONCURRENT_PRODUCTIONS (min:1, max:40) あり
- **Steps**:
  1. `update_system_config({ key: "MAX_CONCURRENT_PRODUCTIONS", value: 50 })` を呼び出し
- **Expected Result**: バリデーションエラー (value exceeds max constraint of 40)
- **Pass Criteria**: エラーが返却される AND DB値が変更されていない
- **Fail Indicators**: 50 が受け入れられる

### TEST-MCP-065: submit_human_directive — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `submit_human_directive({ directive_type: "hypothesis", content: "Test morning posts for beauty niche", target_accounts: ["ACC_0013"], target_agents: ["analyst"], priority: "high" })` を呼び出し
  2. `SELECT directive_type, status FROM human_directives ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: Step 1: `{ id: integer }`。Step 2: directive_type='hypothesis', status='pending'
- **Pass Criteria**: human_directives に行が挿入されている
- **Fail Indicators**: 挿入されていない

### TEST-MCP-066: approve_or_reject_plan — 承認
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: content に status='pending_approval' の行あり
- **Steps**:
  1. `approve_or_reject_plan({ content_id: "CNT_202603_0001", decision: "approve" })` を呼び出し
  2. `SELECT status, approved_at FROM content WHERE content_id = 'CNT_202603_0001';`
- **Expected Result**: status = 'planned'。approved_at IS NOT NULL
- **Pass Criteria**: status が 'planned' に遷移 AND approved_at が設定されている
- **Fail Indicators**: status が 'pending_approval' のまま

### TEST-MCP-067: approve_or_reject_plan — 差戻し（カテゴリ付き）
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: content に status='pending_approval' の行あり
- **Steps**:
  1. `approve_or_reject_plan({ content_id: "CNT_202603_0002", decision: "reject", feedback: "Need more data", rejection_category: "data_insufficient" })` を呼び出し
  2. `SELECT status, rejection_category, approval_feedback FROM content WHERE content_id = 'CNT_202603_0002';`
- **Expected Result**: status は承認前の状態維持。rejection_category = 'data_insufficient'。approval_feedback = 'Need more data'
- **Pass Criteria**: rejection_category と approval_feedback が正しく設定
- **Fail Indicators**: rejection_category が NULL

### TEST-MCP-068: get_pending_approvals — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: content に status='pending_approval' の行あり
- **Steps**:
  1. `get_pending_approvals({})` を呼び出し
- **Expected Result**: 配列を返却。各要素に `content_id`, `hypothesis`, `plan_summary`, `cost_estimate`, `created_at` を含む
- **Pass Criteria**: 返却が配列 AND 全件が pending_approval 状態
- **Fail Indicators**: 他ステータスの件が混入

### TEST-MCP-069: update_agent_prompt — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: agent_prompt_versions テーブル空
- **Steps**:
  1. `update_agent_prompt({ agent_type: "analyst", prompt_content: "You are an analyst agent...", change_reason: "Initial version" })` を呼び出し
  2. `SELECT version, agent_type FROM agent_prompt_versions ORDER BY version DESC LIMIT 1;`
- **Expected Result**: Step 1: `{ version_id: uuid }`。Step 2: version=1, agent_type='analyst'
- **Pass Criteria**: version = 1 AND version_id が UUID形式
- **Fail Indicators**: version が 1 でない

### TEST-MCP-070: update_prompt_suggestion_status — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: prompt_suggestions にデータあり (status='pending')
- **Steps**:
  1. `update_prompt_suggestion_status({ suggestion_id: 1, status: "accepted" })` を呼び出し
  2. `SELECT status FROM prompt_suggestions WHERE id = 1;`
- **Expected Result**: status = 'accepted'
- **Pass Criteria**: status が 'accepted' に更新
- **Fail Indicators**: status が 'pending' のまま

### 2.10 データキュレーター用ツール (6ツール)

### TEST-MCP-071: get_curation_queue — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: task_queue に task_type='curate' の行あり
- **Steps**:
  1. `get_curation_queue({ limit: 10 })` を呼び出し
- **Expected Result**: 配列を返却 (最大10件)。各要素に `id`, `source`, `raw_data`, `data_type` を含む
- **Pass Criteria**: 返却件数 <= 10 AND 各要素に4キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-072: create_component — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `create_component({ type: "scenario", subtype: "hook", name: "Beauty hook intro", data: { script_en: "Hey everyone!", script_jp: "みんな〜！" }, tags: ["beauty", "skincare"] })` を呼び出し
  2. `SELECT type, subtype, name FROM components ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: Step 1: `{ component_id: string }`。Step 2: type='scenario', subtype='hook'
- **Pass Criteria**: component_id が SCN_ 形式 AND DB にデータ挿入
- **Fail Indicators**: component_id が返らない

### TEST-MCP-073: create_component — type バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `create_component({ type: "video", subtype: "intro", name: "Test", data: {}, tags: [] })` を呼び出し
- **Expected Result**: バリデーションエラー (type must be one of: scenario, motion, audio, image)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'video' が受け入れられる

### TEST-MCP-074: get_similar_components — ベクトル検索
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components にembedding付きデータ5件以上
- **Steps**:
  1. `get_similar_components({ type: "scenario", query_text: "skincare morning routine", limit: 5 })` を呼び出し
- **Expected Result**: 配列を返却 (最大5件)。各要素に `component_id`, `similarity` (float 0.0-1.0) を含む
- **Pass Criteria**: 全件の type = 'scenario' AND similarity が降順
- **Fail Indicators**: type が不一致、またはソート不正

### TEST-MCP-075: submit_for_human_review — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components にデータあり
- **Steps**:
  1. `submit_for_human_review({ component_ids: ["SCN_0001", "SCN_0002"], summary: "Auto-curated beauty scenarios need review" })` を呼び出し
  2. `SELECT review_status FROM components WHERE component_id IN ('SCN_0001', 'SCN_0002');`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: 全件 review_status = 'pending_review'
- **Pass Criteria**: review_status が 'pending_review' に更新
- **Fail Indicators**: review_status が変更されていない

### 2.11 キュレーションダッシュボード用ツール (3ツール)

### TEST-MCP-076: get_curated_components_for_review — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components に review_status='pending_review' の行あり
- **Steps**:
  1. `get_curated_components_for_review({})` を呼び出し
- **Expected Result**: 配列を返却。各要素に `component_id`, `type`, `data`, `curator_confidence` を含む
- **Pass Criteria**: 全件の review_status が 'pending_review'
- **Fail Indicators**: 他ステータスの件が混入

### TEST-MCP-077: approve_curated_component — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components に review_status='pending_review' の行あり
- **Steps**:
  1. `approve_curated_component({ component_id: "SCN_0001" })` を呼び出し
  2. `SELECT review_status FROM components WHERE component_id = 'SCN_0001';`
- **Expected Result**: review_status = 'human_approved'
- **Pass Criteria**: review_status が 'human_approved' に更新
- **Fail Indicators**: review_status が変更されていない

### TEST-MCP-078: submit_reference_content — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `submit_reference_content({ url: "https://tiktok.com/@user/video/123", description: "Good hook example", target_type: "scenario" })` を呼び出し
- **Expected Result**: `{ queue_id: integer }` を返却。task_queue に task_type='curate' の行が INSERT
- **Pass Criteria**: queue_id が正の整数
- **Fail Indicators**: queue_id が返らない

### 2.12 エージェント自己学習・コミュニケーション用ツール (8ツール)

### TEST-MCP-079: save_reflection — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: cycles にデータあり
- **Steps**:
  1. `save_reflection({ agent_type: "analyst", cycle_id: 1, task_description: "Cycle review and hypothesis verification", self_score: 7, score_reasoning: "Good accuracy but missed one anomaly", what_went_well: ["Hypothesis verification was accurate"], what_to_improve: ["Need to check more data sources"], next_actions: ["Add competitor analysis step"] })` を呼び出し
- **Expected Result**: `{ id: uuid }` を返却。agent_reflections に1行 INSERT
- **Pass Criteria**: id が UUID形式 AND self_score = 7
- **Fail Indicators**: id が返らない

### TEST-MCP-080: save_reflection — self_score 範囲バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_reflection({ ..., self_score: 0, ... })` — 失敗 (最小1)
  2. `save_reflection({ ..., self_score: 11, ... })` — 失敗 (最大10)
  3. `save_reflection({ ..., self_score: 1, ... })` — 成功
  4. `save_reflection({ ..., self_score: 10, ... })` — 成功
- **Expected Result**: 0と11は拒否。1と10は成功
- **Pass Criteria**: 範囲 1-10 のみ受け入れ
- **Fail Indicators**: 範囲外が受け入れられる

### TEST-MCP-081: save_individual_learning — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_individual_learning({ agent_type: "researcher", content: "TikTok Creative Center data has 24h delay", category: "data_source", context: "Discovered during cycle #5 trend collection", confidence: 0.6 })` を呼び出し
  2. `SELECT agent_type, category, confidence FROM agent_individual_learnings ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: agent_type='researcher', category='data_source', confidence=0.6
- **Pass Criteria**: DB に正しく挿入されている
- **Fail Indicators**: データが挿入されていない

### TEST-MCP-082: get_individual_learnings — エージェント別フィルタ
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: agent_individual_learnings に researcher 3件 + analyst 2件
- **Steps**:
  1. `get_individual_learnings({ agent_type: "researcher", limit: 20 })` を呼び出し
- **Expected Result**: 配列を返却。全件の agent_type = 'researcher'。各要素に `content`, `category`, `times_applied`, `last_applied_at` を含む
- **Pass Criteria**: 返却件数 = 3 AND 全件 agent_type = 'researcher'
- **Fail Indicators**: analyst の件が混入

### TEST-MCP-083: peek_other_agent_learnings — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: agent_individual_learnings に各エージェントのデータあり
- **Steps**:
  1. `peek_other_agent_learnings({ target_agent_type: "analyst", category: "pattern", limit: 10 })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `content`, `category`, `agent_type` を含む
- **Pass Criteria**: 全件の agent_type = 'analyst'
- **Fail Indicators**: 他エージェントの件が混入

### TEST-MCP-084: submit_agent_message — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `submit_agent_message({ agent_type: "analyst", message_type: "anomaly_alert", content: "ACC_0015 views dropped 60% week over week", priority: "high" })` を呼び出し
  2. `SELECT message_type, priority, status FROM agent_communications ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: message_type='anomaly_alert', priority='high', status='unread'
- **Pass Criteria**: DB に正しく挿入されている AND status='unread'
- **Fail Indicators**: status が 'unread' でない

### TEST-MCP-085: get_human_responses — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: agent_communications に status='responded' の行あり
- **Steps**:
  1. `get_human_responses({ agent_type: "analyst" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `message_id`, `response_content`, `responded_at` を含む
- **Pass Criteria**: 返却が配列 AND 全件に response_content が存在
- **Fail Indicators**: response_content が NULL の件が混入

### TEST-MCP-086: mark_learning_applied — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: agent_individual_learnings に id=xxx の行あり (times_applied=0)
- **Steps**:
  1. `mark_learning_applied({ learning_id: "xxx" })` を呼び出し
  2. `SELECT times_applied, last_applied_at FROM agent_individual_learnings WHERE id = 'xxx';`
- **Expected Result**: times_applied = 1。last_applied_at IS NOT NULL
- **Pass Criteria**: times_applied が 0→1 にインクリメント AND last_applied_at が設定
- **Fail Indicators**: times_applied が 0 のまま

### 2.13 MCP ツール共通テスト

### TEST-MCP-087: 未認証リクエストの拒否
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. 認証トークンなしで任意の MCP ツールを呼び出し
- **Expected Result**: 認証エラー (401 Unauthorized 相当)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: ツールが正常実行される

### TEST-MCP-088: 存在しないツール名の呼び出し
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `nonexistent_tool({})` を呼び出し
- **Expected Result**: ツール未定義エラー
- **Pass Criteria**: "tool not found" 相当のエラー
- **Fail Indicators**: エラーなしで返却

### TEST-MCP-089: 必須引数の欠如
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `plan_content({})` を呼び出し (必須引数なし)
- **Expected Result**: バリデーションエラー (missing required fields)
- **Pass Criteria**: 具体的な欠如フィールド名を含むエラー
- **Fail Indicators**: エラーなしで実行

### TEST-MCP-090: DB接続エラー時のグレースフルエラー
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み、DBを停止
- **Steps**:
  1. PostgreSQL を停止した状態で `get_dashboard_summary({})` を呼び出し
- **Expected Result**: 接続エラーを明示するエラーメッセージ (スタックトレースではない)
- **Pass Criteria**: エラーメッセージに "database" or "connection" が含まれる
- **Fail Indicators**: 未処理例外が発生

### TEST-MCP-091: MCP ツール総数の確認
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. MCP Server のツール一覧を取得 (list_tools プロトコル)
- **Expected Result**: ツール総数 = 89 (戦略10 + リサーチャー12 + アナリスト14 + プランナー9 + ツールスペシャリスト5 + 制作ワーカー12 + 投稿ワーカー6 + 計測ワーカー7 + ダッシュボード10 + キュレーター6 + キュレーションダッシュボード3 + 自己学習8 - 重複13ダッシュボードREST)
- **Pass Criteria**: MCP ツール数が仕様と一致
- **Fail Indicators**: ツール数が不一致

### TEST-MCP-092: save_trending_topic — platform バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_trending_topic({ ..., platform: "facebook", ... })` を呼び出し
- **Expected Result**: バリデーションエラー (platform は youtube/tiktok/instagram/x のみ)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'facebook' が受け入れられる

### TEST-MCP-093: save_reflection — agent_type バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_reflection({ agent_type: "worker", ... })` を呼び出し
- **Expected Result**: バリデーションエラー
- **Pass Criteria**: エラーが返却される (worker は許可値外)
- **Fail Indicators**: 'worker' が受け入れられる

### TEST-MCP-094: submit_agent_message — message_type バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `submit_agent_message({ ..., message_type: "error", ... })` を呼び出し
- **Expected Result**: バリデーションエラー (message_type は struggle/proposal/question/status_report/anomaly_alert/milestone のみ)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'error' が受け入れられる

### TEST-MCP-095: submit_agent_message — priority デフォルト値
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `submit_agent_message({ agent_type: "analyst", message_type: "status_report", content: "Cycle complete" })` — priority 省略
  2. `SELECT priority FROM agent_communications ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: priority = 'normal'
- **Pass Criteria**: デフォルト priority = 'normal'
- **Fail Indicators**: priority が NULL または 'normal' 以外

### TEST-MCP-096: create_hypothesis — category バリデーション
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `create_hypothesis({ category: "budget", statement: "...", rationale: "...", target_accounts: [], predicted_kpis: {} })` を呼び出し
- **Expected Result**: バリデーションエラー
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'budget' が受け入れられる

### TEST-MCP-097: save_individual_learning — category バリデーション (17値)
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_individual_learning({ agent_type: "researcher", content: "test", category: "general" })` を呼び出し
- **Expected Result**: バリデーションエラー (17カテゴリのいずれでもない)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'general' が受け入れられる

### TEST-MCP-098: get_production_task — 優先度順取得
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: task_queue に priority=0 と priority=10 の produce タスク各1件
- **Steps**:
  1. `get_production_task({})` を呼び出し
- **Expected Result**: priority=10 のタスクが先に返却
- **Pass Criteria**: 返却された task の priority が 10
- **Fail Indicators**: priority=0 のタスクが先に返却

### TEST-MCP-099: update_system_config — 存在しないキーの拒否
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `update_system_config({ key: "NON_EXISTENT_KEY", value: 42 })` を呼び出し
- **Expected Result**: エラー (設定キーが存在しない)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 新しいキーが作成される

### TEST-MCP-100: approve_or_reject_plan — 不正 rejection_category 拒否
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: content にデータあり
- **Steps**:
  1. `approve_or_reject_plan({ content_id: "CNT_202603_0001", decision: "reject", rejection_category: "quality_low" })` を呼び出し
- **Expected Result**: バリデーションエラー (rejection_category は plan_revision/data_insufficient/hypothesis_weak のみ)
- **Pass Criteria**: エラーが返却される
- **Fail Indicators**: 'quality_low' が受け入れられる

### TEST-MCP-101: search_similar_learnings — ベクトル検索 + confidence フィルタ
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: learnings にembedding付きデータ (confidence 0.3〜0.9)
- **Steps**:
  1. `search_similar_learnings({ query_text: "morning post timing", limit: 10, min_confidence: 0.5 })` を呼び出し
- **Expected Result**: 配列を返却。全件の confidence >= 0.5。各要素に similarity 含む
- **Pass Criteria**: 全件 confidence >= 0.5 AND similarity 降順
- **Fail Indicators**: confidence < 0.5 の件が混入

### TEST-MCP-102: get_component_data — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components にデータあり
- **Steps**:
  1. `get_component_data({ component_id: "SCN_0001" })` を呼び出し
- **Expected Result**: `{ type: string, subtype: string, data: object, drive_file_id: string|null }` を返却
- **Pass Criteria**: type が 'scenario'|'motion'|'audio'|'image' のいずれか
- **Fail Indicators**: キーの欠如

### TEST-MCP-103: get_component_data — 存在しない component_id
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `get_component_data({ component_id: "NONEXISTENT" })` を呼び出し
- **Expected Result**: null または "not found" エラー
- **Pass Criteria**: 例外ではなく適切なエラーレスポンス
- **Fail Indicators**: 未処理例外が発生

### TEST-MCP-104: check_video_status — ポーリング状態確認
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: start_video_generation で取得した request_id あり
- **Steps**:
  1. `check_video_status({ request_id: "req_abc123" })` を呼び出し
- **Expected Result**: `{ status: string, video_url?: string }` を返却。status は 'queued'|'processing'|'completed'|'failed' のいずれか
- **Pass Criteria**: status が有効な値 AND completed 時に video_url が存在
- **Fail Indicators**: status が不明な値

### TEST-MCP-105: generate_script — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: content + components にデータあり
- **Steps**:
  1. `generate_script({ content_id: "CNT_202603_0001", scenario_data: { script_jp: "テスト" }, script_language: "jp" })` を呼び出し
- **Expected Result**: `{ hook_script: string, body_script: string, cta_script: string }` を返却
- **Pass Criteria**: 3つのスクリプトが全て空でない文字列
- **Fail Indicators**: いずれかが空文字または NULL

---

## 3. Worker Layer Tests (TEST-WKR)

### TEST-WKR-001: タスクキューポーリング — 空キュー
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: task_queue テーブル空、ワーカープロセス起動済み
- **Steps**:
  1. PRODUCTION_POLL_INTERVAL_SEC (デフォルト30秒) 待機
  2. ワーカーログを確認
- **Expected Result**: "No pending tasks" 相当のログ出力。エラーなし。ワーカーは停止しない
- **Pass Criteria**: ワーカープロセスが稼働中 AND エラーログなし
- **Fail Indicators**: ワーカーがクラッシュ、またはエラーログ出力

### TEST-WKR-002: タスクキューポーリング — タスク取得
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: task_queue に status='pending', task_type='produce' の行1件
- **Steps**:
  1. ワーカーのポーリングサイクルを待機
  2. `SELECT status, assigned_worker, started_at FROM task_queue WHERE id = 1;`
- **Expected Result**: status='processing', assigned_worker が非NULL, started_at が非NULL
- **Pass Criteria**: 3カラムが全て更新されている
- **Fail Indicators**: status が 'pending' のまま

### TEST-WKR-003: 動画制作ワーカー — セクション並列処理
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: 有効な制作タスク (3セクション: hook/body/cta)
- **Steps**:
  1. 制作タスクを実行
  2. ログから各セクションの開始・完了時刻を記録
- **Expected Result**: 3セクション (hook/body/cta) が並列で処理される。hook/body/cta の開始時刻がほぼ同一 (差 < 5秒)
- **Pass Criteria**: 各セクション開始時刻の最大差 < 5秒
- **Fail Indicators**: セクションが逐次実行されている (開始時刻の差 > 30秒)

### TEST-WKR-004: 動画制作ワーカー — Kling + TTS 並列 (セクション内)
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: 有効な制作タスク
- **Steps**:
  1. 1セクションの制作を実行
  2. ログから Kling 動画生成と Fish Audio TTS の開始時刻を記録
- **Expected Result**: 同一セクション内で Kling と TTS が並列開始 (差 < 3秒)
- **Pass Criteria**: 開始時刻の差 < 3秒
- **Fail Indicators**: TTS が Kling 完了後に開始 (差 > 30秒)

### TEST-WKR-005: 動画制作ワーカー — リトライ (指数バックオフ)
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: 外部APIがエラーを返す状態 (fal.ai停止等)
- **Steps**:
  1. 制作タスクを実行 (外部APIが失敗)
  2. `SELECT retry_count, status FROM task_queue WHERE id = 1;` を定期的に確認
- **Expected Result**: retry_count が 0→1→2→3 と増加。各リトライ間隔が指数的に増加 (RETRY_BACKOFF_BASE_SEC=2: 2秒→4秒→8秒)。retry_count=3 (= max_retries) で status='failed_permanent'
- **Pass Criteria**: retry_count = 3 AND status = 'failed_permanent'
- **Fail Indicators**: 無限リトライ、またはリトライなしで即失敗

### TEST-WKR-006: 動画制作ワーカー — タイムアウト処理
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: VIDEO_SECTION_TIMEOUT_SEC = 600 (system_settings)
- **Steps**:
  1. 外部APIが600秒以上応答しない制作タスクを実行
- **Expected Result**: 600秒後にタイムアウトエラー。リトライカウントがインクリメント
- **Pass Criteria**: エラーメッセージに "timeout" が含まれる AND retry_count が増加
- **Fail Indicators**: 無限待機

### TEST-WKR-007: 動画制作ワーカー — チェックポイント保存
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: 有効な制作タスク (3セクション)
- **Steps**:
  1. 制作タスクを実行
  2. セクション1完了後にチェックポイントを確認
- **Expected Result**: content.production_metadata にセクション1の完了情報が保存されている
- **Pass Criteria**: production_metadata.sections[0] に fal_request_ids が存在
- **Fail Indicators**: production_metadata が NULL

### TEST-WKR-008: 動画制作ワーカー — チェックポイント復旧
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: セクション1完了、セクション2で失敗した制作タスク
- **Steps**:
  1. 制作タスクをリトライ実行
  2. セクション1の再処理有無を確認
- **Expected Result**: セクション1はスキップ (チェックポイントから復旧)。セクション2から再開
- **Pass Criteria**: セクション1の Kling/TTS API 呼び出しがログに存在しない
- **Fail Indicators**: セクション1 が再実行されている

### TEST-WKR-009: 動画制作ワーカー — content ステータス遷移
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: content に status='planned' の行あり
- **Steps**:
  1. 制作タスクを投入 → 実行開始
  2. `SELECT status FROM content WHERE content_id = '...';` を定期確認
- **Expected Result**: status が planned → producing → ready の順に遷移
- **Pass Criteria**: 最終 status = 'ready'
- **Fail Indicators**: 最終 status が 'ready' でない

### TEST-WKR-010: 動画制作ワーカー — ffmpeg concat
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: 3セクションの動画ファイルが生成済み
- **Steps**:
  1. ffmpeg concat 処理を実行
- **Expected Result**: final.mp4 が生成される。H.264 CRF18 エンコード。黒画面検出 (blackdetect) でセクション間に > 0.1秒の黒画面がないこと
- **Pass Criteria**: final.mp4 が存在 AND ファイルサイズ > 0 AND blackdetect で blackframe なし
- **Fail Indicators**: final.mp4 が存在しない、または黒画面が検出される

### TEST-WKR-011: 動画制作ワーカー — 画像リサイズ
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: 4000x4000px のキャラクター画像
- **Steps**:
  1. 画像リサイズ処理を実行 (Kling上限 3850x3850)
- **Expected Result**: リサイズ後の画像が 3850x3850 以下
- **Pass Criteria**: width <= 3850 AND height <= 3850
- **Fail Indicators**: リサイズされない、または Kling に 422 エラーが発生

### TEST-WKR-012: 投稿ワーカー — 投稿時刻ジッター
- **Category**: worker
- **Priority**: P2
- **Prerequisites**: POSTING_TIME_JITTER_MIN = 5 (system_settings)
- **Steps**:
  1. 同一アカウントで10回投稿を実行 (テスト環境)
  2. 各投稿の実際の投稿時刻を記録
- **Expected Result**: 投稿時刻がスケジュール時刻 ± 5分の範囲でランダムにずれる
- **Pass Criteria**: 全投稿の |実際 - スケジュール| <= 5分
- **Fail Indicators**: 全投稿が同一時刻 (ジッターなし)

### TEST-WKR-013: 投稿ワーカー — 1日投稿数制限
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: MAX_POSTS_PER_ACCOUNT_PER_DAY = 2 (system_settings)
- **Steps**:
  1. 同一アカウントで3件の投稿タスクを投入
  2. ワーカーの処理を確認
- **Expected Result**: 2件は投稿成功。3件目はスキップされ翌日にリスケジュール
- **Pass Criteria**: 当日の投稿数 = 2
- **Fail Indicators**: 3件が全て当日に投稿される

### TEST-WKR-014: 投稿ワーカー — プラットフォーム別ルーティング
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: task_queue に publish タスク (platform='youtube') あり
- **Steps**:
  1. 投稿ワーカーがタスクを取得
  2. 呼び出される MCP ツールを確認
- **Expected Result**: `publish_to_youtube` が呼び出される (publish_to_tiktok 等ではない)
- **Pass Criteria**: 正しいプラットフォーム用ツールが使用される
- **Fail Indicators**: 誤ったプラットフォーム用ツールが使用される

### TEST-WKR-015: 計測ワーカー — measure_after 判定
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: publications に posted_at = 48時間以上前 の行あり (measure_after = posted_at + 48h)
- **Steps**:
  1. 計測ワーカーのポーリングを実行
- **Expected Result**: measure_after <= NOW() の publications のみ計測対象として取得
- **Pass Criteria**: measure_after > NOW() の行は取得されない
- **Fail Indicators**: 未到達の行が取得される

### TEST-WKR-016: 計測ワーカー — metrics テーブル INSERT
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: publications に計測対象の行あり
- **Steps**:
  1. 計測ワーカーが計測実行
  2. `SELECT COUNT(*) FROM metrics WHERE publication_id = 1;`
- **Expected Result**: metrics テーブルに1行以上 INSERT
- **Pass Criteria**: COUNT >= 1
- **Fail Indicators**: metrics が空

### TEST-WKR-017: 計測ワーカー — publications ステータス更新
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: publications に status='posted' の行あり
- **Steps**:
  1. 計測ワーカーが計測完了
  2. `SELECT status FROM publications WHERE id = 1;`
- **Expected Result**: status = 'measured'
- **Pass Criteria**: status が 'measured' に更新
- **Fail Indicators**: status が 'posted' のまま

### TEST-WKR-018: テキスト制作ワーカー — LLM直接生成
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: task_queue に content_format='text_post' の produce タスクあり
- **Steps**:
  1. テキスト制作ワーカーがタスクを取得・実行
  2. `SELECT status FROM content WHERE ...;`
- **Expected Result**: content.status = 'ready'。recipe_id は NULL (テキスト投稿にレシピ不要)
- **Pass Criteria**: status = 'ready' AND recipe_id IS NULL
- **Fail Indicators**: 動画制作ワーカーが呼ばれる

### TEST-WKR-019: ワーカー — 同時実行数制限
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: MAX_CONCURRENT_PRODUCTIONS = 5 (system_settings)
- **Steps**:
  1. task_queue に produce タスクを10件投入
  2. ワーカーの同時処理数を確認
- **Expected Result**: 同時に processing 状態のタスクが 5 以下
- **Pass Criteria**: `SELECT COUNT(*) FROM task_queue WHERE status = 'processing' AND task_type = 'produce'` <= 5
- **Fail Indicators**: 同時処理数が 5 を超える

### TEST-WKR-020: ワーカー — failed_permanent 後の再処理防止
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: task_queue に status='failed_permanent' の行あり
- **Steps**:
  1. ワーカーのポーリングサイクルを3回以上待機
  2. `SELECT status FROM task_queue WHERE id = 1;`
- **Expected Result**: status が 'failed_permanent' のまま変更されない
- **Pass Criteria**: ポーリング後も status = 'failed_permanent'
- **Fail Indicators**: status が 'processing' に変更される

### TEST-WKR-021: キュレーションワーカー — コンポーネント作成
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: task_queue に task_type='curate' のタスクあり
- **Steps**:
  1. キュレーションワーカーがタスクを取得・実行
  2. `SELECT COUNT(*) FROM components WHERE curated_by = 'auto';`
- **Expected Result**: components テーブルに curated_by='auto' の行が新規作成
- **Pass Criteria**: COUNT が増加している
- **Fail Indicators**: コンポーネントが作成されない

### TEST-WKR-022: キュレーションワーカー — 重複検出
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: components に類似コンポーネントが存在 (cosine similarity > COMPONENT_DUPLICATE_THRESHOLD=0.9)
- **Steps**:
  1. 同一内容のキュレーションタスクを実行
- **Expected Result**: 重複が検出され、新コンポーネントは作成されない
- **Pass Criteria**: components テーブルの行数が増加しない
- **Fail Indicators**: 重複コンポーネントが作成される

### TEST-WKR-023: ワーカー — task_queue 優先度ソート
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: task_queue に priority=0, priority=10, priority=-10 のタスク各1件
- **Steps**:
  1. ワーカーが3件を順に取得
- **Expected Result**: 取得順: priority=10 → priority=0 → priority=-10
- **Pass Criteria**: ORDER BY priority DESC, created_at ASC の順
- **Fail Indicators**: 優先度順でない

### TEST-WKR-024: 動画制作ワーカー — fal.ai 403 (残高不足) ハンドリング
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: fal.ai APIが 403 Forbidden を返す状態
- **Steps**:
  1. 制作タスクを実行
- **Expected Result**: error_message に "残高不足" or "Forbidden" or "balance" が含まれる。status = 'failed' (リトライ対象)
- **Pass Criteria**: エラーメッセージが enriched されている
- **Fail Indicators**: 汎用エラーメッセージのみ

### TEST-WKR-025: 動画制作ワーカー — fal.ai 422 ハンドリング
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: 不正パラメータ (prompt空文字等) での制作タスク
- **Steps**:
  1. 制作タスクを実行
- **Expected Result**: error_message に "422" or "Unprocessable" が含まれる。status = 'failed_permanent' (パラメータエラーはリトライ不要)
- **Pass Criteria**: status = 'failed_permanent' (即失敗)
- **Fail Indicators**: リトライが行われる

### TEST-WKR-026: ワーカー — HUMAN_REVIEW_ENABLED=true 時の遷移
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: HUMAN_REVIEW_ENABLED='true', content に status='ready' の行あり
- **Steps**:
  1. 制作完了後の content ステータスを確認
- **Expected Result**: status が 'ready' → 'pending_review' に遷移
- **Pass Criteria**: status = 'pending_review'
- **Fail Indicators**: status が直接 'posted' に遷移

### TEST-WKR-027: ワーカー — AUTO_APPROVE_SCORE_THRESHOLD による自動承認
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: HUMAN_REVIEW_ENABLED='true', AUTO_APPROVE_SCORE_THRESHOLD='8.0', content に quality_score=9.0 の行あり
- **Steps**:
  1. 制作完了後の content ステータスを確認
- **Expected Result**: quality_score (9.0) >= AUTO_APPROVE_SCORE_THRESHOLD (8.0) なので自動承認。review_status = 'approved'
- **Pass Criteria**: review_status = 'approved' (人間レビューをスキップ)
- **Fail Indicators**: review_status = 'pending_review'

### TEST-WKR-028: ワーカー — HUMAN_REVIEW_ENABLED=false 時の遷移
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: HUMAN_REVIEW_ENABLED='false'
- **Steps**:
  1. 制作完了後の content ステータスを確認
- **Expected Result**: review_status = 'not_required'。status = 'ready' のまま投稿可能
- **Pass Criteria**: review_status = 'not_required'
- **Fail Indicators**: review_status が 'pending_review'

### TEST-WKR-029: ワーカー — MAX_CONTENT_REVISION_COUNT 超過でキャンセル
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: MAX_CONTENT_REVISION_COUNT='3', content に revision_count=3 の行あり
- **Steps**:
  1. 4回目の差し戻しを実行
- **Expected Result**: content.status = 'cancelled'
- **Pass Criteria**: status = 'cancelled'
- **Fail Indicators**: 4回目のリビジョンが許可される

### TEST-WKR-030: 投稿ワーカー — PLATFORM_COOLDOWN_HOURS 遵守
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: PLATFORM_COOLDOWN_HOURS='24', ACC_0013 で 12時間前に投稿済み
- **Steps**:
  1. ACC_0013 への新規投稿タスクを実行
- **Expected Result**: 投稿がスキップされ、クールダウン期間後にリスケジュール
- **Pass Criteria**: 投稿が実行されない
- **Fail Indicators**: 12時間後に投稿が実行される

### TEST-WKR-031: 計測ワーカー — フォローアップ計測スケジュール
- **Category**: worker
- **Priority**: P2
- **Prerequisites**: METRICS_FOLLOWUP_DAYS='[7, 30]', publications に投稿7日前の行あり
- **Steps**:
  1. 計測ワーカーがフォローアップ計測を実行
- **Expected Result**: metrics テーブルに measurement_point='7d' の行が INSERT
- **Pass Criteria**: measurement_point = '7d'
- **Fail Indicators**: フォローアップ計測が実行されない

### TEST-WKR-032: ワーカー — コスト追跡
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: COST_TRACKING_ENABLED='true'
- **Steps**:
  1. 制作タスクを1件完了
  2. tool_experiences テーブルを確認
- **Expected Result**: tool_experiences に cost_actual が記録されている
- **Pass Criteria**: cost_actual > 0
- **Fail Indicators**: cost_actual が NULL

### TEST-WKR-033: ワーカー — DAILY_BUDGET_LIMIT_USD 超過時の制作停止
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: DAILY_BUDGET_LIMIT_USD='100', 当日の累計コストが $95
- **Steps**:
  1. コスト $10 の制作タスクを実行 (合計 $105 > $100)
- **Expected Result**: 制作がブロックされる。新規タスクの取得を停止
- **Pass Criteria**: タスクが取得されない AND ログに "budget exceeded" 相当のメッセージ
- **Fail Indicators**: 予算超過後も制作が継続

### TEST-WKR-034: ワーカー — リトライジッター
- **Category**: worker
- **Priority**: P2
- **Prerequisites**: RETRY_JITTER_MAX_SEC='1'
- **Steps**:
  1. リトライを10回実行し、各リトライ間隔を記録
- **Expected Result**: 各リトライ間隔 = base × 2^attempt + random(0, RETRY_JITTER_MAX_SEC)。ジッターにより完全に同一間隔にならない
- **Pass Criteria**: リトライ間隔にバラツキがある
- **Fail Indicators**: 全リトライが完全に同一間隔

### TEST-WKR-035: 制作ワーカー — Drive アップロード確認
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: 制作完了した動画ファイルあり
- **Steps**:
  1. 制作完了後の content レコードを確認
- **Expected Result**: video_drive_id が非NULL、drive_folder_id が非NULL、video_drive_url が https://drive.google.com で始まる
- **Pass Criteria**: 3カラムが全て非NULL
- **Fail Indicators**: いずれかのカラムが NULL

### TEST-WKR-036: 投稿ワーカー — publications レコード作成
- **Category**: worker
- **Priority**: P0
- **Prerequisites**: content に status='ready' (approved) の行あり
- **Steps**:
  1. 投稿ワーカーがタスクを実行
  2. `SELECT * FROM publications WHERE content_id = '...';`
- **Expected Result**: publications に1行 INSERT。status='posted', posted_at が非NULL, platform_post_id が非NULL
- **Pass Criteria**: 3カラムが全て正しい値
- **Fail Indicators**: publications にレコードが存在しない

### TEST-WKR-037: 投稿ワーカー — measure_after 自動設定
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: METRICS_COLLECTION_DELAY_HOURS='48'
- **Steps**:
  1. 投稿完了後の publications レコードを確認
- **Expected Result**: measure_after = posted_at + INTERVAL '48 hours'
- **Pass Criteria**: measure_after と posted_at の差が 48時間 (± 1分)
- **Fail Indicators**: measure_after が NULL または 48時間からの乖離が大きい

### TEST-WKR-038: 計測ワーカー — リトライ間隔
- **Category**: worker
- **Priority**: P2
- **Prerequisites**: METRICS_COLLECTION_RETRY_HOURS='6', 計測APIが失敗
- **Steps**:
  1. 計測タスク実行 → API失敗
  2. 次回リトライまでの間隔を確認
- **Expected Result**: リトライ間隔 >= 6時間
- **Pass Criteria**: 次回リトライの scheduled 時刻が 6時間以上後
- **Fail Indicators**: 即座にリトライされる

### TEST-WKR-039: 計測ワーカー — 最大試行回数
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: METRICS_MAX_COLLECTION_ATTEMPTS='5'
- **Steps**:
  1. 計測APIが常に失敗する状態で計測タスクを実行
  2. 5回失敗後のステータスを確認
- **Expected Result**: 5回失敗後に task_queue.status = 'failed_permanent'
- **Pass Criteria**: retry_count >= 5 AND status = 'failed_permanent'
- **Fail Indicators**: 6回以上リトライされる

### TEST-WKR-040: ワーカー — system_settings 動的読み込み
- **Category**: worker
- **Priority**: P1
- **Prerequisites**: ワーカー稼働中
- **Steps**:
  1. `UPDATE system_settings SET setting_value = '10' WHERE setting_key = 'MAX_CONCURRENT_PRODUCTIONS';`
  2. 次回ポーリングでの同時実行数を確認
- **Expected Result**: 新しい設定値 (10) が適用される
- **Pass Criteria**: 同時処理数の上限が 10 に変更
- **Fail Indicators**: 変更前の値 (5) が使い続けられる

---

## 4. LangGraph Agent Layer Tests (TEST-AGT)

### TEST-AGT-001: 戦略サイクルグラフ — ノード実行順序
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: LangGraph 戦略サイクルグラフ定義済み、全テーブルにテストデータ
- **Steps**:
  1. 戦略サイクルグラフを1回実行
  2. agent_thought_logs から各ノードの実行順序を取得
- **Expected Result**: ノード実行順序: collect_intel → analyze_cycle → plan_content → select_tools → approve_plan → (human_approval or reflect_all) → reflect_all
- **Pass Criteria**: collect_intel が最初 AND reflect_all が最後
- **Fail Indicators**: ノード順序が仕様と異なる

### TEST-AGT-002: 戦略サイクルグラフ — cycles テーブル更新
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: LangGraph 戦略サイクルグラフ起動
- **Steps**:
  1. グラフを1回実行完了
  2. `SELECT status FROM cycles ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: status = 'completed'
- **Pass Criteria**: 最新サイクルの status = 'completed'
- **Fail Indicators**: status が 'planning' or 'executing' のまま

### TEST-AGT-003: 戦略サイクルグラフ — STRATEGY_APPROVAL_REQUIRED=true 時の人間承認フロー
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: STRATEGY_APPROVAL_REQUIRED='true'
- **Steps**:
  1. グラフ実行、approve_plan ノードに到達
  2. content.status を確認
- **Expected Result**: content.status = 'pending_approval'。人間の承認を待機
- **Pass Criteria**: status = 'pending_approval' AND グラフが一時停止
- **Fail Indicators**: 承認なしで 'planned' に遷移

### TEST-AGT-004: 戦略サイクルグラフ — 差戻しルーティング (rejection_category)
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: content に rejection_category='data_insufficient' の行あり
- **Steps**:
  1. 差戻し後のグラフ実行を確認
- **Expected Result**: rejection_category に応じたノードに遷移:
  - `plan_revision` → plan_content ノード
  - `data_insufficient` → collect_intel ノード
  - `hypothesis_weak` → analyze_cycle ノード
- **Pass Criteria**: 正しいノードに遷移
- **Fail Indicators**: 全差戻しが同一ノードに遷移

### TEST-AGT-005: 戦略サイクルグラフ — 最大リビジョンループ (3回)
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: グラフ内でリビジョンが3回発生する状態
- **Steps**:
  1. 3回差戻し後のグラフ動作を確認
- **Expected Result**: 3回目の差戻し後、強制承認されてグラフが進行
- **Pass Criteria**: 4回目のリビジョンループに入らない
- **Fail Indicators**: 無限ループ

### TEST-AGT-006: 戦略サイクルグラフ — エージェントリフレクション
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: グラフが reflect_all ノードに到達
- **Steps**:
  1. reflect_all ノード実行後、agent_reflections テーブルを確認
- **Expected Result**: strategist, researcher, analyst, planner の各エージェントのリフレクションが INSERT (最低4行)
- **Pass Criteria**: `SELECT COUNT(DISTINCT agent_type) FROM agent_reflections WHERE cycle_id = ...` >= 4
- **Fail Indicators**: リフレクション行が 4 未満

### TEST-AGT-007: 戦略サイクルグラフ — self_score 1-10 の範囲
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: agent_reflections にデータあり
- **Steps**:
  1. `SELECT self_score FROM agent_reflections WHERE cycle_id = ...;`
- **Expected Result**: 全件の self_score が 1 以上 10 以下
- **Pass Criteria**: MIN(self_score) >= 1 AND MAX(self_score) <= 10
- **Fail Indicators**: 範囲外の値が存在

### TEST-AGT-008: 制作パイプライングラフ — content_format によるワーカー振り分け
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: content_format='short_video' と 'text_post' の制作タスク各1件
- **Steps**:
  1. 各タスクの処理ワーカーを確認
- **Expected Result**: short_video → Video Worker (recipe_idのレシピに従い外部APIツール使用)。text_post → Text Worker (LLM直接生成)
- **Pass Criteria**: 正しいワーカータイプが割り当てられる
- **Fail Indicators**: text_post に Video Worker が割り当てられる

### TEST-AGT-009: 制作パイプライングラフ — recipe_id 参照
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: content に recipe_id=1 の行あり、production_recipes に id=1 のレシピあり
- **Steps**:
  1. 制作タスクを実行
  2. tool_experiences からツール呼び出しを確認
- **Expected Result**: production_recipes.steps に定義されたツールが順番に使用される
- **Pass Criteria**: steps で定義された全ツールが使用される
- **Fail Indicators**: レシピに含まれないツールが使用される

### TEST-AGT-010: 投稿スケジューラーグラフ — タスク生成
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: content に status='ready' (or 'approved') + publications に status='scheduled' の行あり
- **Steps**:
  1. 投稿スケジューラーグラフを実行
  2. task_queue を確認
- **Expected Result**: task_queue に task_type='publish' の行が INSERT
- **Pass Criteria**: publish タスクが存在
- **Fail Indicators**: publish タスクが生成されない

### TEST-AGT-011: 計測ジョブグラフ — measure_after 到達検出
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: publications に measure_after <= NOW() の行あり
- **Steps**:
  1. 計測ジョブグラフを実行
  2. task_queue を確認
- **Expected Result**: task_queue に task_type='measure' の行が INSERT
- **Pass Criteria**: measure タスクが存在
- **Fail Indicators**: measure タスクが生成されない

### TEST-AGT-012: 戦略サイクルグラフ — 仮説多様性チェック
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: HYPOTHESIS_DIVERSITY_WINDOW='5', HYPOTHESIS_SAME_CATEGORY_MAX='3'
- **Steps**:
  1. 直近5サイクルで category='timing' の仮説が3件存在する状態
  2. 新たに category='timing' の仮説を生成しようとする
- **Expected Result**: 同カテゴリの仮説が制限に達しているため、異なるカテゴリの仮説が推奨される
- **Pass Criteria**: 新仮説の category が 'timing' でない
- **Fail Indicators**: 4件目の 'timing' 仮説が生成される

### TEST-AGT-013: エージェント個別学習 — confidence 更新 (成功)
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: LEARNING_SUCCESS_INCREMENT='0.1', agent_individual_learnings に confidence=0.5 の行あり
- **Steps**:
  1. 学びを適用して成功 (self_score >= 7)
  2. `SELECT confidence FROM agent_individual_learnings WHERE id = '...';`
- **Expected Result**: confidence = 0.6 (0.5 + 0.1)
- **Pass Criteria**: confidence が 0.1 増加
- **Fail Indicators**: confidence が変更されない

### TEST-AGT-014: エージェント個別学習 — confidence 更新 (失敗)
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: LEARNING_FAILURE_DECREMENT='0.15', agent_individual_learnings に confidence=0.5 の行あり
- **Steps**:
  1. 学びを適用して失敗 (self_score < 7)
  2. `SELECT confidence FROM agent_individual_learnings WHERE id = '...';`
- **Expected Result**: confidence = 0.35 (0.5 - 0.15)
- **Pass Criteria**: confidence が 0.15 減少
- **Fail Indicators**: confidence が変更されない

### TEST-AGT-015: エージェント個別学習 — is_active 自動無効化
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: LEARNING_DEACTIVATE_THRESHOLD='0.2', agent_individual_learnings に confidence=0.25 の行あり
- **Steps**:
  1. 失敗により confidence が 0.25 → 0.10 に低下
  2. `SELECT is_active FROM agent_individual_learnings WHERE id = '...';`
- **Expected Result**: is_active = false (confidence 0.10 < threshold 0.2)
- **Pass Criteria**: is_active = false
- **Fail Indicators**: is_active = true のまま

### TEST-AGT-016: エージェント個別学習 — 自動昇格 (グローバル知見化)
- **Category**: agent
- **Priority**: P2
- **Prerequisites**: LEARNING_AUTO_PROMOTE_ENABLED='true' (デフォルトfalseなので変更要), LEARNING_AUTO_PROMOTE_COUNT='10'
- **Steps**:
  1. agent_individual_learnings の times_applied が 10 に到達
  2. learnings テーブルを確認
- **Expected Result**: learnings テーブルに同内容の行が INSERT (グローバル知見に昇格)
- **Pass Criteria**: learnings に新行が存在
- **Fail Indicators**: 昇格が行われない

### TEST-AGT-017: 戦略サイクルグラフ — agent_thought_logs 記録
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: グラフ1回実行
- **Steps**:
  1. `SELECT COUNT(*) FROM agent_thought_logs WHERE cycle_id = 1;`
- **Expected Result**: 各ノードの実行ログが記録 (最低6行: collect_intel, analyze_cycle, plan_content, select_tools, approve_plan, reflect_all)
- **Pass Criteria**: COUNT >= 6
- **Fail Indicators**: COUNT < 6

### TEST-AGT-018: グラフ間通信 — PostgreSQL ステータス変更のみ
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: 戦略サイクルグラフ + 制作パイプライングラフが同時稼働
- **Steps**:
  1. 戦略サイクルグラフが content を INSERT (status='planned')
  2. 制作パイプライングラフがその content を取得
- **Expected Result**: グラフ間の直接メッセージングなし。content.status の変更のみで連携
- **Pass Criteria**: 直接的なグラフ間APIコールがログに存在しない
- **Fail Indicators**: 直接的なグラフ間通信が検出される

### TEST-AGT-019: 仮説検証 — HYPOTHESIS_CONFIRM_THRESHOLD
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: HYPOTHESIS_CONFIRM_THRESHOLD='0.3', hypotheses に predicted_kpis と actual_kpis があり誤差 < 0.3
- **Steps**:
  1. アナリストの仮説検証を実行
- **Expected Result**: 誤差 < 0.3 → verdict = 'confirmed'
- **Pass Criteria**: verdict = 'confirmed'
- **Fail Indicators**: verdict が 'inconclusive' or 'rejected'

### TEST-AGT-020: 仮説検証 — HYPOTHESIS_INCONCLUSIVE_THRESHOLD
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: HYPOTHESIS_INCONCLUSIVE_THRESHOLD='0.5', 誤差 >= 0.5
- **Steps**:
  1. アナリストの仮説検証を実行
- **Expected Result**: 誤差 >= 0.5 → verdict = 'inconclusive'
- **Pass Criteria**: verdict = 'inconclusive'
- **Fail Indicators**: verdict が 'confirmed'

### TEST-AGT-021: 品質スコア計算 — 重み付け
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: system_settings の品質重み: QUALITY_WEIGHT_COMPLETION=0.35, QUALITY_WEIGHT_ENGAGEMENT=0.25, QUALITY_WEIGHT_SHARE=0.20, QUALITY_WEIGHT_RETENTION=0.15, QUALITY_WEIGHT_SENTIMENT=0.05
- **Steps**:
  1. completion_rate=0.8, engagement_rate=0.6, share_rate=0.4, retention_rate=0.7, sentiment=0.9 の場合の品質スコアを計算
- **Expected Result**: score = 0.8×0.35 + 0.6×0.25 + 0.4×0.20 + 0.7×0.15 + 0.9×0.05 = 0.28 + 0.15 + 0.08 + 0.105 + 0.045 = 0.66
- **Pass Criteria**: 計算結果 = 0.66 (誤差 ±0.01)
- **Fail Indicators**: 計算結果が 0.66 から ±0.01 以上乖離

### TEST-AGT-022: 異常検知 — ANOMALY_DETECTION_SIGMA
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: ANOMALY_DETECTION_SIGMA='2.0', ANOMALY_DETECTION_WINDOW_DAYS='14', ANOMALY_MIN_DATAPOINTS='7'
- **Steps**:
  1. 14日間の平均 views=1000, 標準偏差=200 のアカウント
  2. 当日 views=500 (平均からの偏差 = 2.5σ)
- **Expected Result**: 偏差 2.5 > 閾値 2.0 → 異常検知アラート
- **Pass Criteria**: detect_anomalies の結果に該当アカウントが含まれる
- **Fail Indicators**: 異常が検知されない

### TEST-AGT-023: 異常検知 — 最小データポイント不足
- **Category**: agent
- **Priority**: P2
- **Prerequisites**: ANOMALY_MIN_DATAPOINTS='7', アカウントのデータポイント数=5
- **Steps**:
  1. detect_anomalies を実行
- **Expected Result**: データポイント不足のアカウントはスキップされる
- **Pass Criteria**: 該当アカウントが結果に含まれない
- **Fail Indicators**: 不十分なデータで異常判定が行われる

### TEST-AGT-024: 探索率 — EXPLORATION_RATE
- **Category**: agent
- **Priority**: P2
- **Prerequisites**: EXPLORATION_RATE='0.15'
- **Steps**:
  1. 100回のコンテンツ計画を実行
  2. 過去の最適解とは異なるアプローチが採用された回数をカウント
- **Expected Result**: 探索的アプローチの採用率 = 約15% (±5%)
- **Pass Criteria**: 探索率が 10%-20% の範囲内
- **Fail Indicators**: 探索率が 0% (常に最適解) または > 30%

### TEST-AGT-025: プロンプト改善提案 — トリガー検知
- **Category**: agent
- **Priority**: P2
- **Prerequisites**: PROMPT_SUGGEST_LOW_SCORE='5', PROMPT_SUGGEST_FAILURE_COUNT='3'
- **Steps**:
  1. あるエージェントの self_score が3回連続で 5 以下
- **Expected Result**: prompt_suggestions テーブルに trigger_type='repeated_issue' の行が INSERT
- **Pass Criteria**: prompt_suggestions に行が存在
- **Fail Indicators**: 提案が生成されない

### TEST-AGT-026: エージェントコミュニケーション — 自発的メッセージ
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: エージェントの self_score 推移が低下傾向
- **Steps**:
  1. エージェントがリフレクション実行後に苦戦を検知
  2. agent_communications テーブルを確認
- **Expected Result**: message_type='struggle' の行が INSERT
- **Pass Criteria**: agent_communications に struggle メッセージが存在
- **Fail Indicators**: メッセージが生成されない

### TEST-AGT-027: 制作パイプライングラフ — チェックポイント位置
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: LangGraph チェックポイント設定済み
- **Steps**:
  1. 制作パイプライングラフの各ノードでチェックポイントが保存されるか確認
- **Expected Result**: 以下4箇所でチェックポイントが保存: (1) 各セクション完了後, (2) concat前, (3) 品質チェック後, (4) Drive アップロード後
- **Pass Criteria**: 4箇所のチェックポイントが確認可能
- **Fail Indicators**: チェックポイントが存在しない

### TEST-AGT-028: 戦略サイクルグラフ — データキュレーター統合
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: task_queue に task_type='curate' のタスクあり
- **Steps**:
  1. データキュレーターノードがキュレーションタスクを処理
  2. components テーブルを確認
- **Expected Result**: 新コンポーネントが作成され、review_status が適切に設定
- **Pass Criteria**: components に新行が存在
- **Fail Indicators**: キュレーションが実行されない

### TEST-AGT-029: レシピ失敗閾値 — RECIPE_FAILURE_THRESHOLD
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: RECIPE_FAILURE_THRESHOLD='3', あるレシピが連続3回失敗
- **Steps**:
  1. 4回目のタスクでそのレシピが推奨されるか確認
- **Expected Result**: 連続3回失敗したレシピは推奨リストから除外
- **Pass Criteria**: get_tool_recommendations がそのレシピを返さない
- **Fail Indicators**: 失敗したレシピが推奨される

### TEST-AGT-030: 戦略サイクルグラフ — Opus/Sonnet モデル割り当て
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: LangGraph 設定確認
- **Steps**:
  1. 各ノードで使用されるモデルを確認
- **Expected Result**: strategist ノード = Claude Opus。researcher/analyst/planner/tool_specialist/data_curator ノード = Claude Sonnet
- **Pass Criteria**: 全ノードのモデル割り当てが仕様通り
- **Fail Indicators**: strategist が Sonnet を使用

### TEST-AGT-031: 戦略サイクルグラフ — プランナーインスタンス数
- **Category**: agent
- **Priority**: P2
- **Prerequisites**: PLANNER_ACCOUNTS_PER_INSTANCE='50', 120アカウントが存在
- **Steps**:
  1. 戦略サイクルグラフ実行時のプランナーインスタンス数を確認
- **Expected Result**: ceil(120/50) = 3 インスタンスが起動
- **Pass Criteria**: プランナーインスタンス数 = 3
- **Fail Indicators**: インスタンス数が 1 (全アカウントを1つで処理)

### TEST-AGT-032: 学び重複検出 — LEARNING_SIMILARITY_THRESHOLD
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: LEARNING_SIMILARITY_THRESHOLD='0.8', 既存の学びに類似度0.85の新しい学びを保存しようとする
- **Steps**:
  1. save_individual_learning で類似内容を保存
- **Expected Result**: 既存の学びとの類似度が 0.85 > 0.8 (閾値) → 重複として警告 or 既存学びの更新
- **Pass Criteria**: 重複が検出される
- **Fail Indicators**: 重複内容が別行として保存される

---

## 5. Dashboard Layer Tests (TEST-DSH)

### 5.1 REST API テスト (13エンドポイント)

### TEST-DSH-001: GET /api/accounts — 正常系
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: accounts テーブルに5件のデータ
- **Steps**:
  1. `GET /api/accounts` を呼び出し
- **Expected Result**: HTTP 200。`{ accounts: Account[], total: 5 }`
- **Pass Criteria**: total = 5 AND accounts 配列の長さ = 5
- **Fail Indicators**: HTTP ≠ 200、または total が不正

### TEST-DSH-002: GET /api/accounts — プラットフォームフィルタ
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: accounts に youtube 2件 + tiktok 3件
- **Steps**:
  1. `GET /api/accounts?platform=youtube` を呼び出し
- **Expected Result**: HTTP 200。total = 2。全件の platform = 'youtube'
- **Pass Criteria**: total = 2 AND 全件 platform = 'youtube'
- **Fail Indicators**: tiktok の件が混入

### TEST-DSH-003: GET /api/accounts/:id — 正常系
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: accounts に ACC_0013 が存在
- **Steps**:
  1. `GET /api/accounts/ACC_0013` を呼び出し
- **Expected Result**: HTTP 200。`{ account: Account }` (関連 characters, publications 含む)
- **Pass Criteria**: account.account_id = 'ACC_0013'
- **Fail Indicators**: HTTP 404

### TEST-DSH-004: GET /api/accounts/:id — 存在しないID
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: accounts に ACC_9999 が存在しない
- **Steps**:
  1. `GET /api/accounts/ACC_9999` を呼び出し
- **Expected Result**: HTTP 404。エラーメッセージ含む
- **Pass Criteria**: HTTP 404
- **Fail Indicators**: HTTP 200 で空データ返却

### TEST-DSH-005: POST /api/accounts — アカウント作成
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: characters に CHR_0001 が存在
- **Steps**:
  1. `POST /api/accounts` with body `{ platform: "youtube", handle: "@test_channel", character_id: "CHR_0001" }` を呼び出し
- **Expected Result**: HTTP 201。`{ account: Account }` (account_id が ACC_ 形式で生成)
- **Pass Criteria**: HTTP 201 AND account_id が ACC_ で始まる
- **Fail Indicators**: HTTP ≠ 201

### TEST-DSH-006: POST /api/accounts — 不正プラットフォーム拒否
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: なし
- **Steps**:
  1. `POST /api/accounts` with body `{ platform: "facebook", ... }` を呼び出し
- **Expected Result**: HTTP 400。バリデーションエラー
- **Pass Criteria**: HTTP 400 AND エラーメッセージに "platform" が含まれる
- **Fail Indicators**: HTTP 201 で作成成功

### TEST-DSH-007: PUT /api/accounts/:id — アカウント更新
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: accounts に ACC_0013 が存在
- **Steps**:
  1. `PUT /api/accounts/ACC_0013` with body `{ status: "suspended" }` を呼び出し
  2. `SELECT status FROM accounts WHERE account_id = 'ACC_0013';`
- **Expected Result**: HTTP 200。status = 'suspended'
- **Pass Criteria**: DB の status が 'suspended' に更新
- **Fail Indicators**: status が変更されない

### TEST-DSH-008: GET /api/content — ステータスフィルタ + ページネーション
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: content に各ステータスのデータ計30件
- **Steps**:
  1. `GET /api/content?status=planned&page=1&limit=10` を呼び出し
- **Expected Result**: HTTP 200。`{ content: Content[], total: number }`。content 配列の長さ <= 10。全件 status = 'planned'
- **Pass Criteria**: 返却件数 <= 10 AND total が planned 件数と一致
- **Fail Indicators**: 他ステータスの件が混入

### TEST-DSH-009: POST /api/content/:id/approve — コンテンツ承認
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: content に status='pending_approval' の行あり (id=CNT_202603_0001)
- **Steps**:
  1. `POST /api/content/CNT_202603_0001/approve` with body `{ comment: "LGTM" }` を呼び出し
  2. `SELECT status, approved_at FROM content WHERE content_id = 'CNT_202603_0001';`
- **Expected Result**: HTTP 200。status = 'planned'。approved_at IS NOT NULL
- **Pass Criteria**: status = 'planned' AND approved_at が設定
- **Fail Indicators**: status が変更されない

### TEST-DSH-010: POST /api/content/:id/reject — コンテンツ差し戻し
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: content に status='pending_approval' の行あり
- **Steps**:
  1. `POST /api/content/CNT_202603_0002/reject` with body `{ comment: "Needs more data", rejection_category: "data_insufficient" }` を呼び出し
  2. `SELECT rejection_category, approval_feedback FROM content WHERE content_id = 'CNT_202603_0002';`
- **Expected Result**: HTTP 200。rejection_category = 'data_insufficient'。approval_feedback = 'Needs more data'
- **Pass Criteria**: rejection_category と approval_feedback が正しく設定
- **Fail Indicators**: 値が NULL

### TEST-DSH-011: POST /api/content/:id/reject — comment 必須バリデーション
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: content にデータあり
- **Steps**:
  1. `POST /api/content/CNT_202603_0001/reject` with body `{ rejection_category: "plan_revision" }` — comment なし
- **Expected Result**: HTTP 400。バリデーションエラー (comment is required for rejection)
- **Pass Criteria**: HTTP 400
- **Fail Indicators**: comment なしで差し戻し成功

### TEST-DSH-012: GET /api/kpi/summary — 正常系
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: accounts + publications + metrics にデータあり
- **Steps**:
  1. `GET /api/kpi/summary` を呼び出し
- **Expected Result**: HTTP 200。`{ accounts: number, followers: object, engagement: object }`
- **Pass Criteria**: 全3キーが存在 AND accounts >= 0
- **Fail Indicators**: HTTP ≠ 200

### TEST-DSH-013: GET /api/hypotheses — フィルタ
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: hypotheses に各 verdict のデータあり
- **Steps**:
  1. `GET /api/hypotheses?verdict=pending&category=timing` を呼び出し
- **Expected Result**: HTTP 200。全件 verdict='pending' AND category='timing'
- **Pass Criteria**: フィルタが正しく適用
- **Fail Indicators**: フィルタ外の件が混入

### TEST-DSH-014: GET /api/learnings — 信頼度フィルタ
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: learnings に confidence 0.3〜0.9 のデータ
- **Steps**:
  1. `GET /api/learnings?min_confidence=0.7` を呼び出し
- **Expected Result**: HTTP 200。全件 confidence >= 0.7
- **Pass Criteria**: 全件 confidence >= 0.7
- **Fail Indicators**: confidence < 0.7 の件が混入

### TEST-DSH-015: GET /api/settings — 全設定取得
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: system_settings に73件のデータ
- **Steps**:
  1. `GET /api/settings` を呼び出し
- **Expected Result**: HTTP 200。`{ settings: SystemSetting[] }`。73件。カテゴリ別にグルーピング
- **Pass Criteria**: settings の件数 = 73
- **Fail Indicators**: 件数が 73 でない

### TEST-DSH-016: PUT /api/settings/:key — 設定更新
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: system_settings に MAX_RETRY_ATTEMPTS あり
- **Steps**:
  1. `PUT /api/settings/MAX_RETRY_ATTEMPTS` with body `{ value: 5 }` を呼び出し
  2. `SELECT setting_value FROM system_settings WHERE setting_key = 'MAX_RETRY_ATTEMPTS';`
- **Expected Result**: HTTP 200。setting_value = '5'
- **Pass Criteria**: 値が更新されている
- **Fail Indicators**: 値が変更されない

### TEST-DSH-017: PUT /api/settings/:key — 制約違反拒否
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: system_settings に MAX_RETRY_ATTEMPTS (min:1, max:10) あり
- **Steps**:
  1. `PUT /api/settings/MAX_RETRY_ATTEMPTS` with body `{ value: 15 }` を呼び出し
- **Expected Result**: HTTP 400。バリデーションエラー
- **Pass Criteria**: HTTP 400 AND DB値が変更されない
- **Fail Indicators**: 15 が受け入れられる

### TEST-DSH-018: GET /api/errors — 正常系
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: task_queue に error_message 付きの行あり
- **Steps**:
  1. `GET /api/errors` を呼び出し
- **Expected Result**: HTTP 200。`{ errors: ErrorLog[], total: number }`
- **Pass Criteria**: errors が配列
- **Fail Indicators**: HTTP ≠ 200

### 5.2 ダッシュボードUI テスト

### TEST-DSH-019: Solarized Dark テーマ — CSS変数確認
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: ダッシュボードを Dark テーマで起動
- **Steps**:
  1. ルート要素の CSS 変数を確認
- **Expected Result**: 以下の CSS 変数が設定:
  `--base03: #002b36`, `--base02: #073642`, `--base01: #586e75`, `--base00: #657b83`, `--base0: #839496`, `--base1: #93a1a1`, `--base2: #eee8d5`, `--base3: #fdf6e3`
- **Pass Criteria**: 全8値が完全一致
- **Fail Indicators**: いずれかの値が不一致

### TEST-DSH-020: Solarized Light テーマ — 切替確認
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: ダッシュボードを起動
- **Steps**:
  1. `DASHBOARD_THEME` を 'light' に変更
  2. テーマが切り替わることを確認
- **Expected Result**: 背景色が #fdf6e3 (base3)、テキスト色が #657b83 (base00) に変更
- **Pass Criteria**: 背景色 = #fdf6e3 AND テキスト色 = #657b83
- **Fail Indicators**: テーマが切り替わらない

### TEST-DSH-021: フォント — Nunito 使用確認
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: ダッシュボードを起動
- **Steps**:
  1. `document.querySelector('body')` の `font-family` を確認
- **Expected Result**: font-family に 'Nunito' が含まれる
- **Pass Criteria**: font-family.includes('Nunito') = true
- **Fail Indicators**: Nunito が使用されていない

### TEST-DSH-022: レスポンシブ — sm ブレイクポイント (640px)
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: ダッシュボードを起動
- **Steps**:
  1. ビューポート幅を 639px に設定
  2. レイアウトがモバイル表示に変更されることを確認
- **Expected Result**: 639px でモバイルレイアウト (シングルカラム)
- **Pass Criteria**: カラム数 = 1
- **Fail Indicators**: デスクトップレイアウトのまま

### TEST-DSH-023: レスポンシブ — md ブレイクポイント (768px)
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: ダッシュボードを起動
- **Steps**:
  1. ビューポート幅を 768px に設定
- **Expected Result**: タブレットレイアウトに変更 (2カラム)
- **Pass Criteria**: カラム数 = 2
- **Fail Indicators**: レイアウトが変更されない

### TEST-DSH-024: レスポンシブ — lg ブレイクポイント (1024px)
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: ダッシュボードを起動
- **Steps**:
  1. ビューポート幅を 1024px に設定
- **Expected Result**: デスクトップレイアウト表示
- **Pass Criteria**: サイドバーが表示される
- **Fail Indicators**: レイアウトが変更されない

### TEST-DSH-025: レスポンシブ — xl ブレイクポイント (1280px)
- **Category**: dashboard
- **Priority**: P3
- **Prerequisites**: ダッシュボードを起動
- **Steps**:
  1. ビューポート幅を 1280px に設定
- **Expected Result**: ワイドデスクトップレイアウト表示
- **Pass Criteria**: コンテンツ最大幅が適用される
- **Fail Indicators**: レイアウトが変更されない

### TEST-DSH-026: ダッシュボード自動リフレッシュ
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: DASHBOARD_AUTO_REFRESH_SEC='30'
- **Steps**:
  1. ダッシュボードを開き30秒待機
  2. データの自動更新を確認
- **Expected Result**: 30秒後にAPIが再呼び出しされ表示データが更新
- **Pass Criteria**: API呼び出しログに30秒間隔のリクエストが存在
- **Fail Indicators**: 自動リフレッシュが発生しない

### TEST-DSH-027: ダッシュボード — ページネーションデフォルト値
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: DASHBOARD_ITEMS_PER_PAGE='20'
- **Steps**:
  1. コンテンツ一覧ページを開く (50件のデータ)
- **Expected Result**: 1ページ目に20件表示。ページネーションに3ページ (20+20+10)
- **Pass Criteria**: 表示件数 = 20 AND ページ数 = 3
- **Fail Indicators**: 全件が1ページに表示

### 5.3 ダッシュボードページ テスト (15ページ)

### TEST-DSH-028: KPIダッシュボードページ — 表示項目
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: データあり
- **Steps**:
  1. KPIダッシュボードページを開く
- **Expected Result**: 以下が表示: 総アカウント数、アクティブアカウント数、総フォロワー数、平均エンゲージメント率、収益化アカウント数
- **Pass Criteria**: 5項目が全て表示
- **Fail Indicators**: いずれかの項目が欠如

### TEST-DSH-029: Algorithm Accuracy ページ — チャート表示
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: algorithm_performance にデータあり
- **Steps**:
  1. アルゴリズム精度ページを開く
- **Expected Result**: 仮説的中率の時系列チャートが表示。予測誤差のチャートが表示
- **Pass Criteria**: 2つのチャートが描画される
- **Fail Indicators**: チャートが表示されない

### TEST-DSH-030: Thought Log Viewer ページ — フィルタリング
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: agent_thought_logs に各エージェントのデータあり
- **Steps**:
  1. agent_type='analyst' でフィルタ
- **Expected Result**: analyst のログのみ表示
- **Pass Criteria**: 全件の agent_type = 'analyst'
- **Fail Indicators**: 他エージェントのログが混入

### TEST-DSH-031: Human-Agent Dialogue ページ — メッセージ一覧
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: agent_communications にデータあり
- **Steps**:
  1. Human-Agent Dialogueページを開く
- **Expected Result**: エージェントからのメッセージ一覧が表示。未読バッジが表示
- **Pass Criteria**: メッセージ件数が agent_communications テーブルの件数と一致
- **Fail Indicators**: メッセージが表示されない

### TEST-DSH-032: Human-Agent Dialogue ページ — 返信機能
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: agent_communications に status='unread' の行あり
- **Steps**:
  1. メッセージを選択して返信を入力
  2. `SELECT status, human_response FROM agent_communications WHERE id = '...';`
- **Expected Result**: status = 'responded'。human_response が入力テキストと一致
- **Pass Criteria**: 返信が保存されている
- **Fail Indicators**: human_response が NULL

### TEST-DSH-033: Agent Evolution ページ — リフレクション推移
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: agent_reflections に複数サイクルのデータあり
- **Steps**:
  1. Agent Evolutionページを開く
- **Expected Result**: エージェントごとの self_score 推移チャートが表示
- **Pass Criteria**: 最低1つのチャートが描画される
- **Fail Indicators**: チャートが表示されない

### TEST-DSH-034: Individual Growth Tracking ページ
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: agent_individual_learnings にデータあり
- **Steps**:
  1. Individual Growth Trackingページを開く
- **Expected Result**: エージェント別の学び数、平均confidence、success_rate が表示
- **Pass Criteria**: 3指標が表示される
- **Fail Indicators**: いずれかの指標が欠如

### TEST-DSH-035: Prompt Management ページ — バージョン一覧
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: agent_prompt_versions にデータあり
- **Steps**:
  1. Prompt Managementページを開く
- **Expected Result**: エージェントごとのプロンプトバージョン一覧。現在のアクティブバージョンがハイライト
- **Pass Criteria**: バージョン一覧が表示される
- **Fail Indicators**: 一覧が空

### TEST-DSH-036: Prompt Improvement Suggestions ページ
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: prompt_suggestions にデータあり
- **Steps**:
  1. ページを開く
  2. pending の提案を accepted に変更
- **Expected Result**: status が 'accepted' に更新される
- **Pass Criteria**: DB上の status = 'accepted'
- **Fail Indicators**: status が変更されない

### TEST-DSH-037: Content Review ページ — 承認/差し戻し
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: content に review_status='pending_review' の行あり
- **Steps**:
  1. Content Reviewページを開く
  2. 承認ボタンをクリック
  3. `SELECT review_status FROM content WHERE content_id = '...';`
- **Expected Result**: review_status = 'approved'
- **Pass Criteria**: review_status が更新される
- **Fail Indicators**: review_status が 'pending_review' のまま

### TEST-DSH-038: Settings ページ — カテゴリ別グルーピング
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: system_settings にデータあり
- **Steps**:
  1. Settingsページを開く
- **Expected Result**: 8カテゴリ (production, posting, agent, measurement, dashboard, credentials, cost_control, review) でグルーピング表示
- **Pass Criteria**: 8カテゴリが全て表示される
- **Fail Indicators**: カテゴリが欠如

### TEST-DSH-039: Account Management ページ — CRUD
- **Category**: dashboard
- **Priority**: P0
- **Prerequisites**: ダッシュボードを起動
- **Steps**:
  1. アカウント新規作成
  2. アカウント情報更新
  3. アカウントステータス変更
- **Expected Result**: 3操作が全て成功
- **Pass Criteria**: DB に反映される
- **Fail Indicators**: いずれかの操作が失敗

### TEST-DSH-040: Error Log ページ — 期間フィルタ
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: task_queue に各日付のエラーデータあり
- **Steps**:
  1. 過去7日間のフィルタを適用
- **Expected Result**: last_error_at が直近7日以内のエラーのみ表示
- **Pass Criteria**: 全件の last_error_at >= NOW() - INTERVAL '7 days'
- **Fail Indicators**: 7日以上前のエラーが表示

### TEST-DSH-041: Performance ページ — アカウント別パフォーマンス
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: metrics + publications にデータあり
- **Steps**:
  1. Performanceページを開く
- **Expected Result**: アカウント別のビュー数、エンゲージメント率の一覧が表示
- **Pass Criteria**: 最低1アカウントのデータが表示
- **Fail Indicators**: データが表示されない

### TEST-DSH-042: Agent Inbox ページ — ステータスフィルタ
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: agent_communications に各ステータスのデータあり
- **Steps**:
  1. status='unread' でフィルタ
- **Expected Result**: unread のメッセージのみ表示
- **Pass Criteria**: 全件 status = 'unread'
- **Fail Indicators**: read/responded の件が混入

### TEST-DSH-043: Curation Review ページ — コンポーネント一覧
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: components に review_status='pending_review' の行あり
- **Steps**:
  1. Curation Reviewページを開く
- **Expected Result**: pending_review のコンポーネント一覧が表示。種別・自信度が表示
- **Pass Criteria**: 全件 review_status = 'pending_review'
- **Fail Indicators**: 他ステータスの件が混入

### TEST-DSH-044: REST API — CORS設定
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: Next.js API Server 起動済み
- **Steps**:
  1. 異なるオリジンからAPI呼び出し
- **Expected Result**: CORS ポリシーが適用される (許可されたオリジンのみ)
- **Pass Criteria**: 未許可オリジンからの呼び出しが拒否
- **Fail Indicators**: 全オリジンからアクセス可能

### TEST-DSH-045: REST API — レスポンスタイム
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: system_settings に73件のデータ
- **Steps**:
  1. `GET /api/settings` を10回呼び出し、レスポンスタイムを計測
- **Expected Result**: 平均レスポンスタイム < 500ms
- **Pass Criteria**: 平均 < 500ms AND 最大 < 2000ms
- **Fail Indicators**: 平均 >= 500ms

### TEST-DSH-046: REST API — 不正JSONリクエストボディ
- **Category**: dashboard
- **Priority**: P1
- **Prerequisites**: API Server 起動済み
- **Steps**:
  1. `POST /api/accounts` with invalid JSON body (`{invalid}`) を呼び出し
- **Expected Result**: HTTP 400。JSONパースエラーメッセージ
- **Pass Criteria**: HTTP 400
- **Fail Indicators**: HTTP 500 (サーバーエラー)

### TEST-DSH-047: REST API — 存在しないエンドポイント
- **Category**: dashboard
- **Priority**: P2
- **Prerequisites**: API Server 起動済み
- **Steps**:
  1. `GET /api/nonexistent` を呼び出し
- **Expected Result**: HTTP 404
- **Pass Criteria**: HTTP 404
- **Fail Indicators**: HTTP 200 または 500

---

## 6. Integration Layer Tests (TEST-INT)

### TEST-INT-001: 戦略サイクル → 制作パイプライン連携
- **Category**: integration
- **Priority**: P0
- **Prerequisites**: 戦略サイクルグラフ + 制作パイプライングラフが稼働
- **Steps**:
  1. 戦略サイクルグラフが content (status='planned') と task_queue (type='produce') を作成
  2. 制作パイプライングラフが task_queue からタスクを取得
  3. 制作完了後の content.status を確認
- **Expected Result**: content.status が planned → producing → ready に遷移
- **Pass Criteria**: 最終 status = 'ready'
- **Fail Indicators**: タスクが取得されない、またはステータスが遷移しない

### TEST-INT-002: 制作パイプライン → 投稿スケジューラー連携
- **Category**: integration
- **Priority**: P0
- **Prerequisites**: content に status='ready' (or 'approved') の行あり
- **Steps**:
  1. 投稿スケジューラーが task_queue (type='publish') を作成
  2. 投稿ワーカーがタスクを処理
  3. publications.status を確認
- **Expected Result**: publications.status = 'posted'
- **Pass Criteria**: 投稿が完了している
- **Fail Indicators**: publish タスクが生成されない

### TEST-INT-003: 投稿 → 計測連携
- **Category**: integration
- **Priority**: P0
- **Prerequisites**: publications に status='posted', measure_after <= NOW() の行あり
- **Steps**:
  1. 計測ジョブグラフが task_queue (type='measure') を作成
  2. 計測ワーカーがメトリクスを収集
  3. metrics テーブルと publications.status を確認
- **Expected Result**: metrics にデータ挿入。publications.status = 'measured'
- **Pass Criteria**: metrics COUNT > 0 AND publications.status = 'measured'
- **Fail Indicators**: metrics が空

### TEST-INT-004: 計測 → 分析サイクル連携
- **Category**: integration
- **Priority**: P0
- **Prerequisites**: publications に status='measured' の行あり、content に status='posted' の行あり
- **Steps**:
  1. 次の戦略サイクルでアナリストが分析実行
  2. analyses テーブルと content.status を確認
- **Expected Result**: analyses に行が INSERT。content.status = 'analyzed'
- **Pass Criteria**: analyses に行が存在 AND content.status = 'analyzed'
- **Fail Indicators**: 分析が実行されない

### TEST-INT-005: 仮説駆動サイクル — 仮説→コンテンツ→計測→検証
- **Category**: integration
- **Priority**: P0
- **Prerequisites**: 全グラフが稼働
- **Steps**:
  1. hypotheses に仮説を INSERT (verdict='pending')
  2. content が作成・制作・投稿・計測されるまで待機
  3. アナリストが仮説検証を実行
  4. `SELECT verdict FROM hypotheses WHERE id = ...;`
- **Expected Result**: verdict が 'confirmed', 'rejected', or 'inconclusive' のいずれかに更新
- **Pass Criteria**: verdict ≠ 'pending'
- **Fail Indicators**: verdict が 'pending' のまま

### TEST-INT-006: human_directives → エージェント処理連携
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: 戦略サイクルグラフが稼働
- **Steps**:
  1. `submit_human_directive({ directive_type: "hypothesis", content: "Test beauty content at 7AM", priority: "high" })` を実行
  2. 次の戦略サイクルで get_pending_directives が呼ばれることを確認
  3. human_directives.status を確認
- **Expected Result**: status = 'acknowledged'
- **Pass Criteria**: status が 'pending' → 'acknowledged' に遷移
- **Fail Indicators**: status が 'pending' のまま

### TEST-INT-007: MCP Server → PostgreSQL トランザクション整合性
- **Category**: integration
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. plan_content でコンテンツ + セクション3行を同時作成
  2. セクション作成中にエラーを発生させる (例: 不正 component_id)
- **Expected Result**: トランザクション全体がロールバック。content にも content_sections にもデータなし
- **Pass Criteria**: 部分的なデータが残らない
- **Fail Indicators**: content は作成されたが content_sections が空 (不整合)

### TEST-INT-008: system_settings 変更 → 全レイヤー反映
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: 全レイヤーが稼働
- **Steps**:
  1. `PUT /api/settings/MAX_CONCURRENT_PRODUCTIONS` で値を 3 に変更
  2. ワーカーの同時処理数を確認
- **Expected Result**: ワーカーが新しい値 (3) を使用
- **Pass Criteria**: 同時処理数 <= 3
- **Fail Indicators**: 変更前の値が使用され続ける

### TEST-INT-009: ベクトル検索 — embedding 生成 → 検索
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: OpenAI API (text-embedding-3-small) が設定済み
- **Steps**:
  1. hypotheses に仮説を INSERT (embedding 自動生成)
  2. search_similar_intel で類似検索を実行
- **Expected Result**: embedding が 1536 次元で生成され、検索結果に含まれる
- **Pass Criteria**: 検索結果が返却される
- **Fail Indicators**: embedding が NULL、または検索結果が空

### TEST-INT-010: agent_individual_learnings → learnings 昇格
- **Category**: integration
- **Priority**: P2
- **Prerequisites**: LEARNING_AUTO_PROMOTE_ENABLED='true', LEARNING_AUTO_PROMOTE_COUNT='10'
- **Steps**:
  1. 個別学習の times_applied を 10 に到達させる
  2. learnings テーブルを確認
- **Expected Result**: learnings に同内容の行が INSERT
- **Pass Criteria**: learnings に新行が存在
- **Fail Indicators**: 昇格が行われない

### TEST-INT-011: コスト追跡 — 制作→計測→アラート連携
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: FAL_AI_BALANCE_ALERT_USD='50', 残高が $45
- **Steps**:
  1. 制作タスクを実行 (残高チェック)
- **Expected Result**: ダッシュボードにアラートが表示される
- **Pass Criteria**: アラートが表示、または agent_communications にアラートが INSERT
- **Fail Indicators**: アラートなし

### TEST-INT-012: Tool Specialist → 制作ワーカー レシピ連携
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: production_recipes にレシピあり
- **Steps**:
  1. Tool Specialist が content に recipe_id を設定
  2. 制作ワーカーがそのレシピに基づいてツールを使用
  3. tool_experiences にレシピ使用結果が記録
- **Expected Result**: tool_experiences.recipe_used にレシピ情報が保存
- **Pass Criteria**: recipe_used が非NULL
- **Fail Indicators**: レシピが無視される

### TEST-INT-013: Dashboard REST API → MCP Server 独立性
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: MCP Server とダッシュボード API が稼働
- **Steps**:
  1. MCP Server を停止
  2. Dashboard REST API (GET /api/accounts) を呼び出し
- **Expected Result**: Dashboard API は独立してDBに直結するため、MCP Server 停止時も正常動作
- **Pass Criteria**: HTTP 200 が返却される
- **Fail Indicators**: HTTP 500 (MCP Server に依存)

### TEST-INT-014: HUMAN_REVIEW_ENABLED=true 全フロー
- **Category**: integration
- **Priority**: P0
- **Prerequisites**: HUMAN_REVIEW_ENABLED='true', AUTO_APPROVE_SCORE_THRESHOLD='8.0'
- **Steps**:
  1. quality_score=6.0 のコンテンツが 'ready' に到達
  2. content.review_status を確認
  3. ダッシュボードで承認
  4. 投稿スケジューラーに到達するか確認
- **Expected Result**: review_status = 'pending_review' (6.0 < 8.0 なので自動承認されない)。人間が承認後 → review_status = 'approved' → 投稿可能
- **Pass Criteria**: 人間承認なしでは投稿されない
- **Fail Indicators**: 自動承認される

### TEST-INT-015: コンテンツキャンセル — 全ステージからの遷移
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: content に各ステータスの行あり
- **Steps**:
  1. status='producing' の content を cancelled に変更
  2. status='ready' の content を cancelled に変更
  3. status='pending_review' の content を cancelled に変更
- **Expected Result**: 全ステータスから 'cancelled' への遷移が成功
- **Pass Criteria**: 3件全て status = 'cancelled'
- **Fail Indicators**: いずれかの遷移が拒否

### TEST-INT-016: データキュレーション → コンポーネント → コンテンツ計画連携
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: curate タスクあり
- **Steps**:
  1. データキュレーターがコンポーネントを作成
  2. プランナーがそのコンポーネントをコンテンツ計画に使用
  3. content_sections テーブルを確認
- **Expected Result**: content_sections にキュレーション生成コンポーネントの component_id が含まれる
- **Pass Criteria**: component_id が正しく紐付けされている
- **Fail Indicators**: コンポーネントが使用されない

### TEST-INT-017: プロンプト変更 → パフォーマンス比較
- **Category**: integration
- **Priority**: P2
- **Prerequisites**: agent_prompt_versions にデータあり
- **Steps**:
  1. update_agent_prompt でプロンプトを変更
  2. 5サイクル後に agent_prompt_versions.performance_before/after を確認
- **Expected Result**: performance_before に変更前のメトリクス、変更後のパフォーマンスデータが蓄積
- **Pass Criteria**: performance_before が非NULL
- **Fail Indicators**: パフォーマンスデータが記録されない

### TEST-INT-018: 複数プラットフォーム投稿 — 1コンテンツ → 4プラットフォーム
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: content に status='ready' の行あり、4プラットフォームのアカウントあり
- **Steps**:
  1. 同一コンテンツを youtube, tiktok, instagram, x に投稿
  2. `SELECT COUNT(*) FROM publications WHERE content_id = '...';`
- **Expected Result**: publications に4行 INSERT (各プラットフォーム1行)
- **Pass Criteria**: COUNT = 4 AND 各行の platform が異なる
- **Fail Indicators**: COUNT < 4

### TEST-INT-019: algorithm_performance — 日次・週次・月次記録
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: 30日分以上のデータ蓄積
- **Steps**:
  1. `SELECT period, COUNT(*) FROM algorithm_performance GROUP BY period;`
- **Expected Result**: daily, weekly, monthly の3期間でデータが存在
- **Pass Criteria**: 3期間が全て存在
- **Fail Indicators**: いずれかの期間が欠如

### TEST-INT-020: agent_communications → human_directives 双方向
- **Category**: integration
- **Priority**: P1
- **Prerequisites**: エージェントがメッセージ送信、人間が返信
- **Steps**:
  1. エージェントが submit_agent_message (question)
  2. 人間がダッシュボードで返信
  3. エージェントが get_human_responses で確認
- **Expected Result**: 双方向のコミュニケーションが成立
- **Pass Criteria**: get_human_responses に返信が含まれる
- **Fail Indicators**: 返信が取得できない

---

## 7. E2E Layer Tests (TEST-E2E)

### TEST-E2E-001: 仮説駆動サイクル完全ライフサイクル
- **Category**: e2e
- **Priority**: P0
- **Prerequisites**: 全システム稼働。accounts にアクティブアカウント最低1件。全外部APIキー設定済み
- **Steps**:
  1. 戦略サイクルグラフを起動 (サイクル#1)
  2. リサーチャーが市場情報収集 → market_intel に INSERT
  3. アナリストが仮説生成 → hypotheses に INSERT (verdict='pending')
  4. プランナーがコンテンツ計画 → content に INSERT (status='planned')
  5. Tool Specialist がレシピ選択 → content.recipe_id 設定
  6. 制作パイプラインが動画制作 → content.status = 'ready'
  7. 投稿スケジューラーが投稿 → publications.status = 'posted'
  8. 計測ジョブがメトリクス収集 → metrics に INSERT
  9. 次のサイクルでアナリストが仮説検証 → hypotheses.verdict 更新
  10. 知見抽出 → learnings に INSERT
- **Expected Result**: 全10ステップが完了。hypotheses.verdict ≠ 'pending'。learnings に新行存在
- **Pass Criteria**: Step 10 完了 AND verdict ∈ {'confirmed', 'rejected', 'inconclusive'} AND learnings COUNT > 0
- **Fail Indicators**: いずれかのステップで停止

### TEST-E2E-002: 動画制作 E2E — 3セクション並列制作
- **Category**: e2e
- **Priority**: P0
- **Prerequisites**: fal.ai + Fish Audio API 設定済み。キャラクター画像あり
- **Steps**:
  1. content (3セクション: hook/body/cta) + task_queue を作成
  2. 制作ワーカーが処理開始
  3. 全セクション完了 → ffmpeg concat → final.mp4 生成
  4. Google Drive にアップロード
- **Expected Result**: final.mp4 が Google Drive に保存。content.video_drive_id が非NULL。処理時間 < 20分
- **Pass Criteria**: video_drive_id IS NOT NULL AND final.mp4 のファイルサイズ > 0
- **Fail Indicators**: final.mp4 が存在しない

### TEST-E2E-003: テキスト投稿 E2E
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: X OAuth設定済み。アカウントあり
- **Steps**:
  1. content_format='text_post' のコンテンツ計画を作成
  2. テキスト制作ワーカーがLLMでテキスト生成
  3. 投稿ワーカーがXに投稿
- **Expected Result**: X に投稿が成功。publications.platform_post_id が非NULL
- **Pass Criteria**: platform_post_id IS NOT NULL AND post_url が URL形式
- **Fail Indicators**: 投稿が失敗

### TEST-E2E-004: 人間レビューフロー E2E
- **Category**: e2e
- **Priority**: P0
- **Prerequisites**: HUMAN_REVIEW_ENABLED='true', STRATEGY_APPROVAL_REQUIRED='true'
- **Steps**:
  1. 戦略サイクルがコンテンツ計画作成 → content.status = 'pending_approval'
  2. 人間がダッシュボードで承認 → status = 'planned'
  3. 制作完了 → status = 'ready' → 'pending_review'
  4. 人間がダッシュボードでレビュー承認 → review_status = 'approved'
  5. 投稿完了
- **Expected Result**: 2回の人間承認 (計画承認 + レビュー承認) を経て投稿完了
- **Pass Criteria**: publications.status = 'posted'
- **Fail Indicators**: 人間承認なしで投稿される

### TEST-E2E-005: エラー復旧 E2E — fal.ai 403 からの復旧
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: fal.ai 残高が復旧後の状態
- **Steps**:
  1. 残高不足で制作失敗 (task_queue.status = 'failed', retry_count = 1)
  2. fal.ai に残高チャージ
  3. リトライ実行
- **Expected Result**: リトライでセクション制作が成功。チェックポイントから復旧
- **Pass Criteria**: 最終的に content.status = 'ready'
- **Fail Indicators**: リトライ後も失敗

### TEST-E2E-006: マルチプラットフォーム同時投稿 E2E
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: 4プラットフォーム (YouTube, TikTok, Instagram, X) のアカウント設定済み
- **Steps**:
  1. 1コンテンツを4プラットフォームに投稿
  2. 各プラットフォームの投稿結果を確認
- **Expected Result**: 4件の publications レコード。全件 status = 'posted'
- **Pass Criteria**: `SELECT COUNT(*) FROM publications WHERE content_id = '...' AND status = 'posted'` = 4
- **Fail Indicators**: いずれかのプラットフォームで投稿失敗

### TEST-E2E-007: エージェント学習サイクル E2E
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: 5サイクル以上のデータ蓄積
- **Steps**:
  1. 5サイクル実行
  2. agent_individual_learnings の件数を確認
  3. algorithm_performance の推移を確認
- **Expected Result**: agent_individual_learnings の件数が増加。algorithm_performance に5日分のデータ
- **Pass Criteria**: learnings COUNT > 0 AND algorithm_performance に daily 行が5件以上
- **Fail Indicators**: 学習データが蓄積されない

### TEST-E2E-008: ダッシュボード → システム設定変更 → 動作反映 E2E
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: ダッシュボード + 全レイヤーが稼働
- **Steps**:
  1. ダッシュボードで HUMAN_REVIEW_ENABLED を 'false' に変更
  2. 次のコンテンツ制作で review_status を確認
- **Expected Result**: review_status = 'not_required' (人間レビューをスキップ)
- **Pass Criteria**: 制作完了後に pending_review にならない
- **Fail Indicators**: HUMAN_REVIEW_ENABLED 変更が反映されない

### TEST-E2E-009: 大規模アカウント E2E — 50アカウント
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: accounts に50アカウント、PLANNER_ACCOUNTS_PER_INSTANCE='50'
- **Steps**:
  1. 戦略サイクルを1回実行
  2. 50アカウントに対するコンテンツ計画を確認
- **Expected Result**: 50アカウント全てにコンテンツが計画される。プランナーは1インスタンス
- **Pass Criteria**: content テーブルに50件以上の行 AND プランナーインスタンス = 1
- **Fail Indicators**: 一部アカウントのコンテンツが欠如

### TEST-E2E-010: システム起動 → 定常運用 E2E
- **Category**: e2e
- **Priority**: P0
- **Prerequisites**: クリーンインストール完了
- **Steps**:
  1. PostgreSQL マイグレーション実行 (26テーブル + 73設定値)
  2. MCP Server 起動
  3. LangGraph 4グラフ起動
  4. ダッシュボード起動
  5. 3サイクル実行
- **Expected Result**: 全コンポーネントがエラーなく起動。3サイクルが正常完了
- **Pass Criteria**: エラーログなし AND cycles に status='completed' が3件
- **Fail Indicators**: 起動失敗、またはサイクル未完了

### TEST-E2E-011: 差し戻し → 再制作 E2E
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: HUMAN_REVIEW_ENABLED='true'
- **Steps**:
  1. コンテンツ制作完了 → 'pending_review'
  2. 人間がダッシュボードで差し戻し (rejection_category='plan_revision')
  3. プランナーが計画修正
  4. 再制作 → 'ready' → 'pending_review'
  5. 人間が承認
  6. 投稿完了
- **Expected Result**: content.revision_count = 1。最終的に publications.status = 'posted'
- **Pass Criteria**: revision_count >= 1 AND 最終的に投稿成功
- **Fail Indicators**: 差し戻し後のフローが停止

### TEST-E2E-012: 月間予算超過 E2E
- **Category**: e2e
- **Priority**: P1
- **Prerequisites**: MONTHLY_BUDGET_LIMIT_USD='3000', 月間累計 = $2990
- **Steps**:
  1. コスト $15 の制作タスクを投入
- **Expected Result**: 月間予算超過 ($3005 > $3000) により制作がブロック
- **Pass Criteria**: 新規制作が開始されない AND ログに "monthly budget exceeded" 相当のメッセージ
- **Fail Indicators**: 予算超過後も制作が実行される

---

## テストサマリー

| Section | Layer | Tests | P0 | P1 | P2 | P3 |
|---------|-------|-------|----|----|----|----|
| 1 | Database | 55 | 15 | 33 | 5 | 2 |
| 2 | MCP Server | 105 | 30 | 55 | 15 | 5 |
| 3 | Worker | 40 | 12 | 18 | 7 | 3 |
| 4 | LangGraph Agent | 32 | 8 | 15 | 7 | 2 |
| 5 | Dashboard | 47 | 9 | 24 | 10 | 4 |
| 6 | Integration | 20 | 6 | 11 | 3 | 0 |
| 7 | E2E | 12 | 3 | 7 | 2 | 0 |
| **Total** | | **311** | **83** | **163** | **49** | **16** |

> 全311テスト。各テストは AI エージェントが Pass/Fail を判定可能な精度で記述。
> P0 テスト (83件) は初回リリース前に全件パス必須。

