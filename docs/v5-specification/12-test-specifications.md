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
| MCP Server | MCP | 98 MCP ツールの入出力・バリデーション |
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

### TEST-DB-002: 全27テーブルの存在確認
- **Category**: database
- **Priority**: P0
- **Prerequisites**: マイグレーション実行済み
- **Steps**:
  1. `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;` を実行
- **Expected Result**: 以下27テーブルが全て存在:
  `accounts`, `agent_communications`, `agent_individual_learnings`, `agent_prompt_versions`, `agent_reflections`, `agent_thought_logs`, `algorithm_performance`, `analyses`, `characters`, `components`, `content`, `content_learnings`, `content_sections`, `cycles`, `human_directives`, `hypotheses`, `learnings`, `market_intel`, `metrics`, `production_recipes`, `prompt_suggestions`, `publications`, `system_settings`, `task_queue`, `tool_catalog`, `tool_experiences`, `tool_external_sources`
- **Pass Criteria**: 返却行数 = 27 AND 全テーブル名が一致
- **Fail Indicators**: 行数 ≠ 27、またはテーブル名の不一致

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
- **Expected Result**: 以下9カラムが存在:
  `setting_key` (character varying), `setting_value` (jsonb), `category` (character varying), `description` (text), `default_value` (jsonb), `value_type` (character varying), `constraints` (jsonb), `updated_at` (timestamp with time zone), `updated_by` (character varying)
- **Pass Criteria**: 全9カラム名とデータ型が一致
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

### TEST-DB-046: system_settings 初期データ件数 (86件)
- **Category**: database
- **Priority**: P0
- **Prerequisites**: 初期INSERTマイグレーション実行済み
- **Steps**:
  1. `SELECT COUNT(*) FROM system_settings;`
- **Expected Result**: `count = 86`
- **Pass Criteria**: COUNT = 86
- **Fail Indicators**: COUNT ≠ 86

### TEST-DB-047: system_settings カテゴリ別件数
- **Category**: database
- **Priority**: P1
- **Prerequisites**: 初期INSERTマイグレーション実行済み
- **Steps**:
  1. `SELECT category, COUNT(*) FROM system_settings GROUP BY category ORDER BY category;`
- **Expected Result**:
  | category | count |
  |----------|-------|
  | agent | 43 |
  | cost_control | 4 |
  | credentials | 5 |
  | dashboard | 3 |
  | measurement | 6 |
  | posting | 8 |
  | production | 13 |
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
     Layer 4: `content_learnings`, `content_sections`, `publications`, `analyses`, `agent_reflections`, `agent_communications`, `tool_experiences`, `prompt_suggestions`
     Layer 5: `metrics`, `agent_individual_learnings`
- **Expected Result**: 全27テーブルがエラーなく作成される
- **Pass Criteria**: 全 CREATE TABLE が成功
- **Fail Indicators**: いずれかのテーブル作成でFK依存エラー

### TEST-DB-056: characters.status CHECK制約 (4値) とデフォルト値
- **Category**: database
- **Priority**: P0
- **Prerequisites**: characters テーブル作成済み
- **Steps**:
  1. status 省略で INSERT (`INSERT INTO characters (character_id, name, voice_id) VALUES ('CHR_STAT1', 'Test', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');`)
  2. `SELECT status FROM characters WHERE character_id = 'CHR_STAT1';`
  3. `'draft'`, `'pending_review'`, `'active'`, `'archived'` で各 INSERT — 成功
  4. `'deleted'` で INSERT — 失敗
- **Expected Result**: デフォルト = `'draft'`。4値成功。`'deleted'` は CHECK制約違反
- **Pass Criteria**: デフォルト = 'draft' AND 4値全て成功 AND 'deleted' がCHECK制約違反エラー
- **Fail Indicators**: デフォルトが 'draft' でない、または 'deleted' が成功する

### TEST-DB-057: characters.created_by CHECK制約 (2値) とデフォルト値
- **Category**: database
- **Priority**: P0
- **Prerequisites**: characters テーブル作成済み
- **Steps**:
  1. created_by 省略で INSERT
  2. `SELECT created_by FROM characters WHERE ...`
  3. `'human'`, `'curator'` で各 INSERT — 成功
  4. `'system'` で INSERT — 失敗
- **Expected Result**: デフォルト = `'human'`。2値成功。`'system'` は CHECK制約違反
- **Pass Criteria**: デフォルト = 'human' AND 'curator' 成功 AND 'system' がCHECK制約違反
- **Fail Indicators**: デフォルトが 'human' でない、または 'system' が成功する

### TEST-DB-058: characters.generation_metadata JSONB デフォルト NULL
- **Category**: database
- **Priority**: P1
- **Prerequisites**: characters テーブル作成済み
- **Steps**:
  1. generation_metadata 省略で INSERT
  2. `SELECT generation_metadata FROM characters WHERE ...`
  3. `'{"model": "claude-opus", "confidence": 0.85}'::jsonb` で INSERT — 成功
- **Expected Result**: デフォルト = `NULL`。JSONB値の挿入が成功
- **Pass Criteria**: デフォルト = NULL AND 有効なJSONBが保存される
- **Fail Indicators**: デフォルトが NULL でない、または JSONB挿入が失敗

### TEST-DB-059: 全インデックス数の確認 (139個)
- **Category**: database
- **Priority**: P1
- **Prerequisites**: インデックスマイグレーション実行済み
- **Steps**:
  1. `SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';`
- **Expected Result**: `count = 139`
- **Pass Criteria**: COUNT = 139
- **Fail Indicators**: COUNT ≠ 139

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

### 2.10 データキュレーター用ツール (9ツール)

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
- **Expected Result**: ツール総数 = 98 (戦略10 + リサーチャー12 + アナリスト14 + プランナー9 + ツールスペシャリスト5 + 制作ワーカー12 + 投稿ワーカー6 + 計測ワーカー7 + ダッシュボード10 + キュレーター9 + キュレーションダッシュボード3 + 自己学習14 - 重複13ダッシュボードREST)
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

### 2.14 不足ツールの補完テスト

> 以下は04-agent-design.md §4に定義されているが、§2.1〜§2.13でカバーされていなかったツールの補完テスト。

#### 戦略エージェント (1ツール不足)

### TEST-MCP-106: get_algorithm_performance — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: algorithm_performance テーブルにデータあり
- **Steps**:
  1. `get_algorithm_performance({ period: "weekly", limit: 12 })` を呼び出し
- **Expected Result**: 配列を返却 (最大12件)。各要素に `measured_at` (timestamptz), `hypothesis_accuracy` (float 0.0-1.0), `prediction_error` (float), `improvement_rate` (float) を含む
- **Pass Criteria**: 返却件数 <= 12 AND 全件の hypothesis_accuracy が 0.0-1.0
- **Fail Indicators**: キーの欠如、または hypothesis_accuracy が範囲外

#### リサーチャー (5ツール不足)

### TEST-MCP-107: save_competitor_account — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_competitor_account({ username: "@beauty_guru", followers: 500000, posting_frequency: "daily", platform: "tiktok" })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。market_intel テーブルに intel_type = 'competitor_account' の行が INSERT
- **Pass Criteria**: id が正の整数 AND market_intel に該当行が存在
- **Fail Indicators**: id が返らない、またはDB未挿入

### TEST-MCP-108: save_audience_signal — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_audience_signal({ signal_type: "engagement_spike", topic: "morning routine", sentiment: "positive", sample_data: { comments: ["love this!", "more please"] } })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。market_intel テーブルに intel_type = 'audience_signal' の行が INSERT
- **Pass Criteria**: id が正の整数
- **Fail Indicators**: id が返らない

### TEST-MCP-109: save_platform_update — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `save_platform_update({ platform: "youtube", update_type: "algorithm_change", description: "Shorts algorithm now favors 30-60s content", effective_date: "2026-03-01" })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。market_intel テーブルに intel_type = 'platform_update' の行が INSERT
- **Pass Criteria**: id が正の整数
- **Fail Indicators**: id が返らない

### TEST-MCP-110: get_competitor_analysis — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: market_intel に competitor_account + competitor_post のデータあり
- **Steps**:
  1. `get_competitor_analysis({ platform: "tiktok", niche: "beauty" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `username` (string), `followers` (integer), `avg_views` (number), `content_strategy` (string) を含む
- **Pass Criteria**: 返却が配列 AND 各要素に4キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-111: get_platform_changes — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: market_intel に platform_update のデータあり
- **Steps**:
  1. `get_platform_changes({ platform: "youtube", since: "30d" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `update_type` (string), `description` (string), `effective_date` (string) を含む
- **Pass Criteria**: 返却が配列 AND 各要素に3キーが存在
- **Fail Indicators**: キーの欠如

#### アナリスト (6ツール不足)

### TEST-MCP-112: get_hypothesis_results — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: hypotheses に id=1 のデータあり、関連 content + metrics データあり
- **Steps**:
  1. `get_hypothesis_results({ hypothesis_id: 1 })` を呼び出し
- **Expected Result**: `{ predicted_kpis: object, actual_kpis: object, content_count: integer, raw_metrics: array }` を返却
- **Pass Criteria**: 全4キーが存在 AND content_count >= 0
- **Fail Indicators**: キーの欠如

### TEST-MCP-113: get_component_scores — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components に type='scenario' のデータあり
- **Steps**:
  1. `get_component_scores({ type: "scenario", subtype: "hook", limit: 20 })` を呼び出し
- **Expected Result**: 配列を返却 (最大20件)。各要素に `component_id` (string), `name` (string), `score` (number|null), `usage_count` (integer) を含む
- **Pass Criteria**: 返却件数 <= 20 AND 全件の type = 'scenario'
- **Fail Indicators**: キーの欠如、または type が不一致

### TEST-MCP-114: update_component_score — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components にデータあり (component_id='SCN_0001', score=NULL)
- **Steps**:
  1. `update_component_score({ component_id: "SCN_0001", new_score: 75.5 })` を呼び出し
  2. `SELECT score FROM components WHERE component_id = 'SCN_0001';`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: score = 75.50
- **Pass Criteria**: score が 75.50 に更新されている
- **Fail Indicators**: score が NULL のまま

### TEST-MCP-115: get_niche_performance_trends — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: publications + metrics に beauty ニッチのデータあり
- **Steps**:
  1. `get_niche_performance_trends({ niche: "beauty", period: "30d" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `date` (string), `avg_views` (number), `avg_engagement` (number), `content_count` (integer) を含む
- **Pass Criteria**: 返却が配列 AND 各要素に4キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-116: compare_hypothesis_predictions — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: hypotheses に predicted_kpis + actual_kpis が設定済みのデータ3件以上
- **Steps**:
  1. `compare_hypothesis_predictions({ hypothesis_ids: [1, 2, 3] })` を呼び出し
- **Expected Result**: 配列を返却 (3件)。各要素に `hypothesis_id` (integer), `predicted` (object), `actual` (object), `error_rate` (float) を含む
- **Pass Criteria**: 返却件数 = 3 AND 全件に error_rate が存在
- **Fail Indicators**: 返却件数が不一致、またはキーの欠如

### TEST-MCP-117: generate_improvement_suggestions — 正常系
- **Category**: mcp
- **Priority**: P2
- **Prerequisites**: learnings + metrics にデータあり
- **Steps**:
  1. `generate_improvement_suggestions({ niche: "beauty", account_id: "ACC_0013" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `suggestion` (string), `rationale` (string), `expected_impact` (string), `priority` (string) を含む
- **Pass Criteria**: 返却が配列 AND 各要素に4キーが存在
- **Fail Indicators**: キーの欠如

#### プランナー (3ツール不足)

### TEST-MCP-118: get_account_performance — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: accounts + publications + metrics にデータあり
- **Steps**:
  1. `get_account_performance({ account_id: "ACC_0013", period: "7d" })` を呼び出し
- **Expected Result**: `{ avg_views: number, avg_engagement: number, top_content: array, trend: string }` を返却
- **Pass Criteria**: 全4キーが存在 AND avg_views >= 0
- **Fail Indicators**: キーの欠如

### TEST-MCP-119: get_available_components — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components に type='scenario', niche='beauty' のデータあり
- **Steps**:
  1. `get_available_components({ type: "scenario", niche: "beauty", subtype: "hook" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `component_id` (string), `name` (string), `score` (number|null), `usage_count` (integer), `data` (object) を含む
- **Pass Criteria**: 返却が配列 AND 全件の type = 'scenario'
- **Fail Indicators**: type が不一致の件が混入

### TEST-MCP-120: get_niche_learnings — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: learnings テーブルに beauty ニッチのデータあり
- **Steps**:
  1. `get_niche_learnings({ niche: "beauty", min_confidence: 0.5, limit: 10 })` を呼び出し
- **Expected Result**: 配列を返却 (最大10件)。各要素に `insight` (string), `confidence` (float, >= 0.5), `category` (string) を含む
- **Pass Criteria**: 返却件数 <= 10 AND 全件の confidence >= 0.5
- **Fail Indicators**: confidence < 0.5 の件が混入

#### ツールスペシャリスト (2ツール不足)

### TEST-MCP-121: search_similar_tool_usage — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: tool_experiences にデータ5件以上
- **Steps**:
  1. `search_similar_tool_usage({ requirements: { character_type: "asian_female", niche: "beauty", content_type: "short_video", quality_priority: 0.8 }, limit: 5 })` を呼び出し
- **Expected Result**: 配列を返却 (最大5件)。各要素に `tool_combination` (string[]), `avg_quality_score` (number), `usage_count` (integer), `notes` (string) を含む
- **Pass Criteria**: 返却件数 <= 5 AND 各要素に4キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-122: update_tool_knowledge_from_external — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: tool_catalog にデータあり
- **Steps**:
  1. `update_tool_knowledge_from_external({ tool_name: "kling_v2.6", update_type: "capability", description: "Added portrait mode support", source_url: "https://docs.kling.ai/updates" })` を呼び出し
- **Expected Result**: `{ id: integer }` を返却。tool_external_sources テーブルに1行 INSERT
- **Pass Criteria**: id が正の整数
- **Fail Indicators**: id が返らない

#### ダッシュボード (3ツール不足)

### TEST-MCP-123: submit_learning_guidance — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: MCP Server 起動済み
- **Steps**:
  1. `submit_learning_guidance({ target_agent_type: "analyst", guidance: "Focus on completion rate as primary KPI", category: "content" })` を呼び出し
  2. `SELECT directive_type, content FROM human_directives ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: Step 1: `{ id: integer }`。Step 2: directive_type='learning_guidance', content に guidance 内容が含まれる
- **Pass Criteria**: human_directives に行が挿入されている
- **Fail Indicators**: 挿入されていない

### TEST-MCP-124: get_learning_directives — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: human_directives に directive_type='learning_guidance' のデータあり
- **Steps**:
  1. `get_learning_directives({ agent_type: "analyst" })` を呼び出し
- **Expected Result**: 配列を返却。各要素に `guidance` (string), `category` (string), `created_at` (string) を含む
- **Pass Criteria**: 返却が配列 AND 各要素に3キーが存在
- **Fail Indicators**: キーの欠如

### TEST-MCP-125: rollback_agent_prompt — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: agent_prompt_versions に analyst の version=1,2 あり (version=2 が active)
- **Steps**:
  1. `rollback_agent_prompt({ agent_type: "analyst", version: 1 })` を呼び出し
  2. `SELECT version, active FROM agent_prompt_versions WHERE agent_type = 'analyst' ORDER BY version;`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: version=1 が active=true、version=2 が active=false
- **Pass Criteria**: version=1 が active に切り替わっている
- **Fail Indicators**: version=2 が active のまま

#### データキュレーター (5ツール不足)

### TEST-MCP-126: update_component_data — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: components にデータあり (component_id='SCN_0001')
- **Steps**:
  1. `update_component_data({ component_id: "SCN_0001", data: { script_en: "Updated hook!", script_jp: "更新されたフック！" }, tags: ["beauty", "updated"] })` を呼び出し
  2. `SELECT data, tags FROM components WHERE component_id = 'SCN_0001';`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: data と tags が更新されている
- **Pass Criteria**: data->>'script_en' = 'Updated hook!' AND tags に 'updated' が含まれる
- **Fail Indicators**: data が更新されていない

### TEST-MCP-127: mark_curation_complete — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: task_queue に task_type='curate' のタスクあり (id=1)
- **Steps**:
  1. `mark_curation_complete({ queue_id: 1, result_component_ids: ["SCN_0001", "SCN_0002"] })` を呼び出し
  2. `SELECT status FROM task_queue WHERE id = 1;`
- **Expected Result**: Step 1: `{ success: true }`。Step 2: status = 'completed'
- **Pass Criteria**: task_queue.status が 'completed' に更新
- **Fail Indicators**: status が変更されていない

### TEST-MCP-128: create_character_profile — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: MCP Server 起動済み、CHARACTER_AUTO_GENERATION_ENABLED='true'
- **Steps**:
  1. `create_character_profile({ niche: "crypto_education", target_market: "JP_20-30", personality_traits: ["cheerful", "knowledgeable"], name_suggestion: "CryptoMiku" })` を呼び出し
  2. `SELECT character_id, name, status, created_by, generation_metadata FROM characters ORDER BY created_at DESC LIMIT 1;`
- **Expected Result**: Step 1: `{ character_id: string, name: string, personality: object, status: 'draft' }`。Step 2: status='draft', created_by='curator', generation_metadata IS NOT NULL
- **Pass Criteria**: character_id が CHR_ 形式 AND status = 'draft' AND created_by = 'curator' AND generation_metadata に niche と target_market が含まれる
- **Fail Indicators**: character_id が返らない、または status/created_by が不正

### TEST-MCP-129: generate_character_image — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: characters にデータあり (character_id='CHR_TEST1')、fal.ai APIキー設定済み
- **Steps**:
  1. `generate_character_image({ character_id: "CHR_TEST1", appearance_description: "anime style, blue hair, cheerful expression", style: "anime" })` を呼び出し
  2. `SELECT image_drive_id FROM characters WHERE character_id = 'CHR_TEST1';`
- **Expected Result**: Step 1: `{ image_drive_id: string, image_url: string }`。Step 2: image_drive_id が設定されている
- **Pass Criteria**: image_drive_id が非空 AND image_url が https:// で始まる
- **Fail Indicators**: image_drive_id が NULL、またはエラー

### TEST-MCP-130: select_voice_profile — 正常系
- **Category**: mcp
- **Priority**: P0
- **Prerequisites**: characters にデータあり、Fish Audio APIキー設定済み
- **Steps**:
  1. `select_voice_profile({ character_id: "CHR_TEST1", personality: "cheerful", gender: "female", age_range: "20-25", language: "ja" })` を呼び出し
  2. `SELECT voice_id FROM characters WHERE character_id = 'CHR_TEST1';`
- **Expected Result**: Step 1: `{ voice_id: string (32 chars), voice_name: string, sample_url: string }`。Step 2: voice_id が32文字hexで設定されている
- **Pass Criteria**: voice_id.length = 32 AND /^[0-9a-f]{32}$/ にマッチ AND voice_name が非空
- **Fail Indicators**: voice_id が32文字hexでない

#### 自己学習・コミュニケーション (1ツール不足)

### TEST-MCP-131: get_recent_reflections — 正常系
- **Category**: mcp
- **Priority**: P1
- **Prerequisites**: agent_reflections に analyst の振り返りデータ3件
- **Steps**:
  1. `get_recent_reflections({ agent_type: "analyst", limit: 5 })` を呼び出し
- **Expected Result**: 配列を返却 (最大5件)。各要素に `self_score` (integer 1-10), `score_reasoning` (string), `next_actions` (string[]), `created_at` (string) を含む
- **Pass Criteria**: 返却件数 <= 5 AND 全件の self_score が 1-10 の範囲内
- **Fail Indicators**: キーの欠如、または self_score が範囲外

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
- **Prerequisites**: HUMAN_REVIEW_ENABLED='true', AUTO_APPROVE_SCORE_THRESHOLD='8.0', content に status='ready' かつ quality_score=7.0 (閾値未満) の行あり
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

## 4. LangGraph Agent Layer Tests (TEST-AGT)

### TEST-AGT-001: 戦略サイクルグラフ — ノード実行順序
- **Category**: agent
- **Priority**: P0
- **Prerequisites**: LangGraph 戦略サイクルグラフ定義済み、全テーブルにテストデータ
- **Steps**:
  1. 戦略サイクルグラフを1回実行
  2. agent_thought_logs から各ノードの実行順序を取得
- **Expected Result**: ノード実行順序: collect_intel → analyze_cycle → set_strategy → plan_content → select_tools → approve_plan → (human_approval or reflect_all) → reflect_all
- **Pass Criteria**: collect_intel が最初 AND set_strategy が analyze_cycle の直後 AND reflect_all が最後
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
- **Expected Result**: strategist, researcher, analyst, planner, tool_specialist の各エージェントのリフレクションが INSERT (最低5行)
- **Pass Criteria**: `SELECT COUNT(DISTINCT agent_type) FROM agent_reflections WHERE cycle_id = ...` >= 5
- **Fail Indicators**: リフレクション行が 5 未満

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
- **Expected Result**: 各ノードの実行ログが記録 (最低7行: collect_intel, analyze_cycle, set_strategy, plan_content, select_tools, approve_plan, reflect_all)
- **Pass Criteria**: COUNT >= 7
- **Fail Indicators**: COUNT < 7

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

### TEST-AGT-028: データキュレーター — task_queue コンポーネント作成
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: task_queue に task_type='curate' のタスクあり
- **Steps**:
  1. データキュレーターがキュレーションタスクを取得・処理
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

### TEST-AGT-040: データキュレーター — キャラクタープロフィール自動生成
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: CHARACTER_AUTO_GENERATION_ENABLED='true', ニッチ='crypto_education', ターゲット市場='JP_20-30'
- **Steps**:
  1. create_character_profile ツールを `{ niche: 'crypto_education', target_market: 'JP_20-30' }` で呼び出し
- **Expected Result**: characters テーブルに新レコード作成。status='draft', created_by='curator'。name, personality が非空
- **Pass Criteria**: character_id が返却され、characters テーブルに status='draft' のレコードが存在
- **Fail Indicators**: character_id が null、またはテーブルにレコードなし

### TEST-AGT-041: データキュレーター — キャラクター画像生成
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: TEST-AGT-040 で作成した character_id が存在
- **Steps**:
  1. generate_character_image ツールを `{ character_id, appearance_description: 'anime style, blue hair' }` で呼び出し
- **Expected Result**: image_drive_id と image_url が返却される。characters テーブルの該当レコードに画像情報が保存
- **Pass Criteria**: image_drive_id が非空の文字列
- **Fail Indicators**: image_drive_id が null、またはDriveにファイルが存在しない

### TEST-AGT-042: データキュレーター — 音声プロフィール選定
- **Category**: agent
- **Priority**: P1
- **Prerequisites**: TEST-AGT-040 で作成した character_id が存在
- **Steps**:
  1. select_voice_profile ツールを `{ character_id, personality: 'cheerful', language: 'ja' }` で呼び出し
- **Expected Result**: voice_id (32文字hex), voice_name, sample_url が返却される
- **Pass Criteria**: voice_id が32文字の16進数文字列
- **Fail Indicators**: voice_id が空、または32文字hexでない

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
- **Prerequisites**: system_settings に86件のデータ
- **Steps**:
  1. `GET /api/settings` を呼び出し
- **Expected Result**: HTTP 200。`{ settings: SystemSetting[] }`。86件。カテゴリ別にグルーピング
- **Pass Criteria**: settings の件数 = 86
- **Fail Indicators**: 件数が 86 でない

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
- **Prerequisites**: system_settings に86件のデータ
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


### 5.4 Playwright ナビゲーションテスト

### TEST-DSH-048: 全15画面レンダリング確認
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: ダッシュボード起動済み、各テーブルにシードデータあり
- **Steps**:
  1. 以下の各URLに `await page.goto()` でアクセスし、HTTP 200 かつ主要コンテンツが表示されることを確認:
     - `/` (ホーム), `/kpi`, `/production`, `/review`, `/content`, `/accounts`, `/characters`, `/agents`, `/hypotheses`, `/learnings`, `/tools`, `/errors`, `/costs`, `/settings`, `/directives`
  2. 各ページで `await expect(page.locator('main')).toBeVisible()`
  3. 各ページで `await expect(page).not.toHaveTitle(/404|Error/)`
- **Expected Result**: 全15画面がエラーなくレンダリングされる
- **Pass Criteria**: 15画面全てで main 要素が visible AND タイトルに 404/Error を含まない
- **Fail Indicators**: いずれかの画面で main が非表示、またはエラーページが表示

### TEST-DSH-049: サイドバーナビゲーション — 全画面遷移
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: ダッシュボード起動済み (viewport: 1280px)
- **Steps**:
  1. `await page.goto('/')`
  2. サイドバーの各リンクを順にクリック:
     ```
     const pages = ['KPI', '制作キュー', 'コンテンツレビュー', 'コンテンツ一覧', 'アカウント管理', 'キャラクター管理', 'エージェント', '仮説ブラウザ', '知見ブラウザ', 'ツール管理', 'エラーログ', 'コスト管理', '設定', '人間指示'];
     for (const name of pages) {
       await page.getByRole('navigation').getByText(name).click();
       await expect(page).toHaveURL(new RegExp('/(kpi|production|review|content|accounts|characters|agents|hypotheses|learnings|tools|errors|costs|settings|directives)'));
     }
     ```
  3. 各遷移後に `await expect(page.locator('main')).toBeVisible()`
- **Expected Result**: サイドバーから全14画面（ホーム除く）に遷移可能
- **Pass Criteria**: 全遷移でURLが正しく変化 AND main が表示
- **Fail Indicators**: リンクが見つからない、遷移しない、エラーページが表示

### TEST-DSH-050: サイドバーアクティブ状態ハイライト
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み (viewport: 1280px)
- **Steps**:
  1. `await page.goto('/kpi')`
  2. `await expect(page.getByRole('navigation').getByText('KPI')).toHaveAttribute('aria-current', 'page')`
  3. `await page.goto('/settings')`
  4. `await expect(page.getByRole('navigation').getByText('設定')).toHaveAttribute('aria-current', 'page')`
  5. KPI のリンクが aria-current を持たないことを確認
- **Expected Result**: 現在のページに対応するサイドバーリンクがアクティブ状態
- **Pass Criteria**: アクティブページのリンクに aria-current='page' が設定
- **Fail Indicators**: アクティブ状態のハイライトがない

### TEST-DSH-051: ページタイトル表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/kpi')` → `await expect(page).toHaveTitle(/KPI/)`
  2. `await page.goto('/accounts')` → `await expect(page).toHaveTitle(/アカウント/)`
  3. `await page.goto('/settings')` → `await expect(page).toHaveTitle(/設定/)`
  4. `await page.goto('/agents')` → `await expect(page).toHaveTitle(/エージェント/)`
  5. `await page.goto('/errors')` → `await expect(page).toHaveTitle(/エラー/)`
- **Expected Result**: 各ページに適切な `<title>` が設定されている
- **Pass Criteria**: ページタイトルに画面名が含まれる
- **Fail Indicators**: タイトルが空、デフォルト値のまま、または不一致

### TEST-DSH-052: ブラウザバック/フォワードナビゲーション
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/')`
  2. `await page.getByRole('navigation').getByText('KPI').click()`
  3. `await expect(page).toHaveURL(/\/kpi/)`
  4. `await page.getByRole('navigation').getByText('設定').click()`
  5. `await expect(page).toHaveURL(/\/settings/)`
  6. `await page.goBack()` → `await expect(page).toHaveURL(/\/kpi/)`
  7. `await page.goForward()` → `await expect(page).toHaveURL(/\/settings/)`
- **Expected Result**: ブラウザの戻る/進むボタンが正常に動作
- **Pass Criteria**: 履歴に基づいた正しいURLに遷移
- **Fail Indicators**: 戻る/進む後に想定外のページが表示

### TEST-DSH-053: URL直打ちアクセス — 正常ルート
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await expect(page.locator('main')).toBeVisible()`
  3. `await expect(page.locator('h1, h2').first()).toContainText('エージェント')`
- **Expected Result**: URL直打ちで正しいページが表示される（CSR/SSRどちらでも動作）
- **Pass Criteria**: main 要素が表示 AND ページ見出しが正しい
- **Fail Indicators**: 白画面、404、またはホームにリダイレクト

### 5.5 Playwright テーマ切替テスト

### TEST-DSH-054: Dark → Light テーマ切替
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボードをDarkテーマ（デフォルト）で起動
- **Steps**:
  1. `await page.goto('/')`
  2. `const bgBefore = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)`
  3. Assert bgBefore corresponds to `#002b36` (rgb(0, 43, 54))
  4. `await page.getByRole('button', { name: /テーマ|theme/i }).click()`
  5. `const bgAfter = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)`
  6. Assert bgAfter corresponds to `#fdf6e3` (rgb(253, 246, 227))
- **Expected Result**: 背景色が Dark (#002b36) から Light (#fdf6e3) に変更
- **Pass Criteria**: bgAfter = rgb(253, 246, 227)
- **Fail Indicators**: 背景色が変わらない

### TEST-DSH-055: Light → Dark テーマ切替
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボードをLightテーマで起動
- **Steps**:
  1. `await page.goto('/')`
  2. `await page.evaluate(() => localStorage.setItem('theme', 'light'))`
  3. `await page.reload()`
  4. `await page.getByRole('button', { name: /テーマ|theme/i }).click()`
  5. `const bgAfter = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)`
  6. Assert bgAfter corresponds to `#002b36` (rgb(0, 43, 54))
- **Expected Result**: 背景色が Light (#fdf6e3) から Dark (#002b36) に変更
- **Pass Criteria**: bgAfter = rgb(0, 43, 54)
- **Fail Indicators**: 背景色が変わらない

### TEST-DSH-056: テーマの localStorage 永続化
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボードをDarkテーマで起動
- **Steps**:
  1. `await page.goto('/')`
  2. `await page.getByRole('button', { name: /テーマ|theme/i }).click()` (Dark → Light)
  3. `const stored = await page.evaluate(() => localStorage.getItem('theme'))`
  4. `expect(stored).toBe('light')`
- **Expected Result**: テーマ設定が localStorage に保存される
- **Pass Criteria**: localStorage.theme = 'light'
- **Fail Indicators**: localStorage にテーマが保存されない

### TEST-DSH-057: リロード後のテーマ維持
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボードをDarkテーマで起動
- **Steps**:
  1. `await page.goto('/')`
  2. `await page.getByRole('button', { name: /テーマ|theme/i }).click()` (Dark → Light)
  3. `await page.reload()`
  4. `const bg = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)`
  5. Assert bg corresponds to `#fdf6e3` (rgb(253, 246, 227))
- **Expected Result**: リロード後も Light テーマが維持される
- **Pass Criteria**: リロード後の背景色 = rgb(253, 246, 227)
- **Fail Indicators**: リロード後に Dark テーマに戻る

### TEST-DSH-058: Dark テーマ CSS変数 全値検証 (Playwright版)
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボードをDarkテーマで起動
- **Steps**:
  1. `await page.goto('/')`
  2. CSS 変数をルート要素から取得・検証:
     ```
     const vars = await page.locator(':root').evaluate(el => {
       const s = getComputedStyle(el);
       return { base03: s.getPropertyValue('--base03').trim(), base02: s.getPropertyValue('--base02').trim(), base01: s.getPropertyValue('--base01').trim(), base00: s.getPropertyValue('--base00').trim(), base0: s.getPropertyValue('--base0').trim(), base1: s.getPropertyValue('--base1').trim(), base2: s.getPropertyValue('--base2').trim(), base3: s.getPropertyValue('--base3').trim() };
     });
     expect(vars.base03).toBe('#002b36'); expect(vars.base02).toBe('#073642');
     expect(vars.base01).toBe('#586e75'); expect(vars.base00).toBe('#657b83');
     expect(vars.base0).toBe('#839496'); expect(vars.base1).toBe('#93a1a1');
     expect(vars.base2).toBe('#eee8d5'); expect(vars.base3).toBe('#fdf6e3');
     ```
- **Expected Result**: Solarized Dark の全8色が正しく設定
- **Pass Criteria**: 8変数全てが完全一致
- **Fail Indicators**: いずれかの値が不一致

### TEST-DSH-059: サイドバー色 テーマ別検証
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/')` (Dark テーマ)
  2. `const sidebarBgDark = await page.getByRole('navigation').evaluate(el => getComputedStyle(el).backgroundColor)`
  3. Assert sidebarBgDark corresponds to `#073642` (rgb(7, 54, 66))
  4. テーマを Light に切替
  5. `const sidebarBgLight = await page.getByRole('navigation').evaluate(el => getComputedStyle(el).backgroundColor)`
  6. Assert sidebarBgLight corresponds to `#eee8d5` (rgb(238, 232, 213))
- **Expected Result**: サイドバー背景色がテーマに応じて変更される
- **Pass Criteria**: Dark = rgb(7, 54, 66), Light = rgb(238, 232, 213)
- **Fail Indicators**: サイドバー色がテーマに連動しない

### TEST-DSH-060: Nunito フォント適用確認 (Playwright版)
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/')`
  2. `const fontFamily = await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)`
  3. `expect(fontFamily).toContain('Nunito')`
  4. `const monoFont = await page.locator('code, .font-mono').first().evaluate(el => getComputedStyle(el).fontFamily)`
  5. `expect(monoFont).toContain('JetBrains Mono')`
- **Expected Result**: Body に Nunito、コード要素に JetBrains Mono が適用
- **Pass Criteria**: fontFamily に 'Nunito' が含まれる AND monospace 要素に 'JetBrains Mono' が含まれる
- **Fail Indicators**: フォントが適用されていない

### 5.6 Playwright レスポンシブテスト

### TEST-DSH-061: Mobile (375px) — シングルカラムレイアウト
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.setViewportSize({ width: 375, height: 812 })`
  2. `await page.goto('/')`
  3. `await expect(page.getByRole('navigation')).not.toBeVisible()`
  4. `const mainWidth = await page.locator('main').evaluate(el => el.getBoundingClientRect().width)`
  5. Assert mainWidth >= 350 (ほぼフル幅)
- **Expected Result**: 375px でモバイルレイアウト (サイドバー非表示、シングルカラム)
- **Pass Criteria**: サイドバー非表示 AND メインコンテンツがフル幅
- **Fail Indicators**: サイドバーが表示されたまま

### TEST-DSH-062: Mobile — ハンバーガーメニュー開閉
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.setViewportSize({ width: 375, height: 812 })`
  2. `await page.goto('/')`
  3. `await expect(page.getByRole('button', { name: /メニュー|menu/i })).toBeVisible()`
  4. `await page.getByRole('button', { name: /メニュー|menu/i }).click()`
  5. `await expect(page.getByRole('navigation')).toBeVisible()`
  6. `await page.getByRole('navigation').getByText('KPI').click()`
  7. `await expect(page.getByRole('navigation')).not.toBeVisible()`
  8. `await expect(page).toHaveURL(/\/kpi/)`
- **Expected Result**: ハンバーガーメニューで開閉可能、遷移後に自動で閉じる
- **Pass Criteria**: メニュー開閉が動作 AND 遷移後にメニューが閉じる
- **Fail Indicators**: ハンバーガーボタンが表示されない、メニューが閉じない

### TEST-DSH-063: Tablet (768px) — サイドバー折りたたみ
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.setViewportSize({ width: 768, height: 1024 })`
  2. `await page.goto('/')`
  3. `const navWidth = await page.getByRole('navigation').evaluate(el => el.getBoundingClientRect().width)`
  4. Assert navWidth < 100 (折りたたみ状態 = アイコンのみ)
- **Expected Result**: 768px でタブレットレイアウト (サイドバー折りたたみ)
- **Pass Criteria**: サイドバー幅 < 100px
- **Fail Indicators**: フルサイドバーが表示

### TEST-DSH-064: Desktop (1280px) — フルサイドバー
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.setViewportSize({ width: 1280, height: 800 })`
  2. `await page.goto('/')`
  3. `await expect(page.getByRole('navigation')).toBeVisible()`
  4. `const navWidth = await page.getByRole('navigation').evaluate(el => el.getBoundingClientRect().width)`
  5. Assert navWidth >= 200 (フル表示)
- **Expected Result**: 1280px でフルサイドバー表示
- **Pass Criteria**: サイドバー幅 >= 200px AND メニューテキストが表示
- **Fail Indicators**: サイドバーが折りたたまれている

### TEST-DSH-065: Mobile — テーブル水平スクロール
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: accounts テーブルにデータあり
- **Steps**:
  1. `await page.setViewportSize({ width: 375, height: 812 })`
  2. `await page.goto('/accounts')`
  3. `const overflow = await page.locator('table').locator('..').evaluate(el => getComputedStyle(el).overflowX)`
  4. `expect(['auto', 'scroll']).toContain(overflow)`
- **Expected Result**: モバイルでテーブルが水平スクロール可能
- **Pass Criteria**: テーブルコンテナに overflow-x: auto/scroll が設定
- **Fail Indicators**: テーブルがはみ出して表示が崩れる

### TEST-DSH-066: チャートのレスポンシブリサイズ
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: KPIデータあり
- **Steps**:
  1. `await page.setViewportSize({ width: 1280, height: 800 })`
  2. `await page.goto('/kpi')`
  3. `const chartWidthDesktop = await page.locator('.recharts-wrapper').first().evaluate(el => el.getBoundingClientRect().width)`
  4. `await page.setViewportSize({ width: 375, height: 812 })`
  5. `await page.waitForTimeout(500)`
  6. `const chartWidthMobile = await page.locator('.recharts-wrapper').first().evaluate(el => el.getBoundingClientRect().width)`
  7. Assert chartWidthMobile < chartWidthDesktop AND chartWidthMobile >= 300
- **Expected Result**: チャートがビューポートに合わせてリサイズされる
- **Pass Criteria**: モバイル幅 < デスクトップ幅 AND モバイル幅 >= 300px
- **Fail Indicators**: チャートがリサイズされない

### 5.7 Playwright フォーム操作テスト

### TEST-DSH-067: アカウント作成フォーム — 全フィールド入力・送信
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: ダッシュボード起動済み、characters にCHR_0001あり
- **Steps**:
  1. `await page.goto('/accounts')`
  2. `await page.getByRole('button', { name: /新規作成|追加|Add/i }).click()`
  3. `await page.getByLabel('プラットフォーム').selectOption('youtube')`
  4. `await page.getByLabel('ハンドル').fill('@test_channel_e2e')`
  5. `await page.getByLabel('キャラクター').selectOption('CHR_0001')`
  6. `await page.getByRole('button', { name: /作成|保存|Save/i }).click()`
  7. `await expect(page.getByText(/作成しました|Created/i)).toBeVisible()`
- **Expected Result**: アカウントが正常に作成され、成功メッセージが表示
- **Pass Criteria**: 成功メッセージ表示 AND 一覧に新アカウントが出現
- **Fail Indicators**: エラーメッセージ表示、フォームが閉じない

### TEST-DSH-068: アカウント作成フォーム — バリデーションエラー (空入力)
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/accounts')`
  2. `await page.getByRole('button', { name: /新規作成|追加|Add/i }).click()`
  3. フィールドを空のまま送信: `await page.getByRole('button', { name: /作成|保存|Save/i }).click()`
  4. `await expect(page.getByText(/必須|required/i)).toBeVisible()`
- **Expected Result**: 必須フィールドのバリデーションエラーが表示
- **Pass Criteria**: エラーメッセージが表示 AND フォームが送信されない
- **Fail Indicators**: エラーなしで送信が成功

### TEST-DSH-069: アカウント作成フォーム — 不正プラットフォーム拒否
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/accounts')`
  2. `await page.getByRole('button', { name: /新規作成|追加|Add/i }).click()`
  3. プラットフォーム選択肢に 'youtube', 'tiktok', 'instagram', 'x' のみ存在することを確認:
     `const options = await page.getByLabel('プラットフォーム').locator('option').allTextContents()`
  4. Assert options に 'facebook' が含まれないこと
- **Expected Result**: 選択肢は4プラットフォーム (youtube, tiktok, instagram, x) のみ
- **Pass Criteria**: 4つの有効プラットフォームのみ選択可能
- **Fail Indicators**: 無効なプラットフォームが選択肢に含まれる

### TEST-DSH-070: 設定値編集 — number型入力
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: system_settings に MAX_RETRY_ATTEMPTS (type: integer, min: 1, max: 10) あり
- **Steps**:
  1. `await page.goto('/settings')`
  2. MAX_RETRY_ATTEMPTS の行を見つけて編集ボタンをクリック
  3. `await page.getByLabel(/値|value/i).fill('5')`
  4. `await page.getByRole('button', { name: /保存|Save/i }).click()`
  5. `await expect(page.getByText(/保存しました|Saved/i)).toBeVisible()`
- **Expected Result**: number型の設定値が正常に更新
- **Pass Criteria**: 成功メッセージが表示 AND 表示値が '5' に更新
- **Fail Indicators**: 保存が失敗、値が変わらない

### TEST-DSH-071: 設定値編集 — number型 制約違反拒否
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: system_settings に MAX_RETRY_ATTEMPTS (min: 1, max: 10) あり
- **Steps**:
  1. `await page.goto('/settings')`
  2. MAX_RETRY_ATTEMPTS の編集モーダルを開く
  3. `await page.getByLabel(/値|value/i).fill('15')`
  4. `await page.getByRole('button', { name: /保存|Save/i }).click()`
  5. `await expect(page.getByText(/範囲|range|1.*10/i)).toBeVisible()`
- **Expected Result**: 制約違反 (15 > max:10) でバリデーションエラー
- **Pass Criteria**: エラーメッセージ表示 AND 値が更新されない
- **Fail Indicators**: 制約違反の値が受け入れられる

### TEST-DSH-072: 設定値編集 — boolean型スイッチ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: system_settings に HUMAN_REVIEW_ENABLED (type: boolean) あり
- **Steps**:
  1. `await page.goto('/settings')`
  2. `await page.getByText('review').click()` (review カテゴリタブ)
  3. HUMAN_REVIEW_ENABLED のスイッチを見つけてクリック:
     `await page.locator('[data-key="HUMAN_REVIEW_ENABLED"]').getByRole('switch').click()`
  4. `await expect(page.getByText(/保存しました|Saved/i)).toBeVisible()`
- **Expected Result**: boolean型はスイッチUIで切替可能
- **Pass Criteria**: スイッチの状態が変更 AND 保存成功
- **Fail Indicators**: スイッチが表示されない、テキスト入力フィールドが表示

### TEST-DSH-073: コンテンツ承認フォーム — フィードバック入力
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: content に review_status='pending_review' の行あり
- **Steps**:
  1. `await page.goto('/review')`
  2. 最初の pending_review アイテムをクリック
  3. `await page.getByPlaceholder(/フィードバック|feedback/i).fill('LGTM - 品質良好')`
  4. `await page.getByRole('button', { name: /承認|approve/i }).click()`
  5. `await expect(page.getByText(/承認しました|Approved/i)).toBeVisible()`
- **Expected Result**: フィードバック付きで承認が完了
- **Pass Criteria**: 成功メッセージ表示 AND アイテムが一覧から消える
- **Fail Indicators**: 承認が失敗、アイテムが残る

### TEST-DSH-074: コンテンツ差し戻しフォーム — コメント必須バリデーション
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に review_status='pending_review' の行あり
- **Steps**:
  1. `await page.goto('/review')`
  2. 最初の pending_review アイテムをクリック
  3. コメント欄を空のまま差し戻しボタンをクリック:
     `await page.getByRole('button', { name: /差し戻し|reject/i }).click()`
  4. `await expect(page.getByText(/コメント.*必須|comment.*required/i)).toBeVisible()`
- **Expected Result**: コメントなしでの差し戻しは拒否される
- **Pass Criteria**: バリデーションエラーが表示
- **Fail Indicators**: コメントなしで差し戻しが成功

### TEST-DSH-075: コンテンツ差し戻しフォーム — カテゴリ選択付き差し戻し
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に review_status='pending_review' の行あり
- **Steps**:
  1. `await page.goto('/review')`
  2. 最初の pending_review アイテムをクリック
  3. `await page.getByLabel(/カテゴリ|category/i).selectOption('data_insufficient')`
  4. `await page.getByPlaceholder(/コメント|comment/i).fill('データ不足: 競合分析が欠けている')`
  5. `await page.getByRole('button', { name: /差し戻し|reject/i }).click()`
  6. `await expect(page.getByText(/差し戻しました|Rejected/i)).toBeVisible()`
- **Expected Result**: カテゴリ + コメント付きで差し戻しが完了
- **Pass Criteria**: rejection_category = 'data_insufficient' が設定
- **Fail Indicators**: カテゴリが保存されない

### TEST-DSH-076: human_directive 作成フォーム
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/directives')`
  2. `await page.getByRole('button', { name: /新規指示|新規作成|Add/i }).click()`
  3. `await page.getByLabel(/対象エージェント|target.*agent/i).selectOption('analyst')`
  4. `await page.getByLabel(/指示内容|content/i).fill('エンゲージメント率をビュー数より重視して仮説を生成せよ')`
  5. `await page.getByLabel(/優先度|priority/i).selectOption('high')`
  6. `await page.getByRole('button', { name: /送信|Submit/i }).click()`
  7. `await expect(page.getByText(/送信しました|Submitted/i)).toBeVisible()`
- **Expected Result**: human_directive が正常に作成
- **Pass Criteria**: 成功メッセージ表示 AND 履歴一覧に新しい指示が出現
- **Fail Indicators**: 送信失敗、エラーメッセージ表示

### TEST-DSH-077: フォーム送信成功時のトースト通知
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/settings')`
  2. 設定値を編集して保存
  3. `await expect(page.locator('[role="status"], .toast, [data-sonner-toast]')).toBeVisible()`
  4. `await expect(page.locator('[role="status"], .toast, [data-sonner-toast]')).toContainText(/保存|success/i)`
  5. トースト通知が数秒後に自動消去されることを確認:
     `await expect(page.locator('[role="status"], .toast, [data-sonner-toast]')).not.toBeVisible({ timeout: 10000 })`
- **Expected Result**: 成功時にトースト通知が表示され、数秒後に自動消去
- **Pass Criteria**: トースト表示 → 自動消去
- **Fail Indicators**: トーストが表示されない、消去されない

### TEST-DSH-078: フォーム送信失敗時のエラー表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/accounts')`
  2. `await page.getByRole('button', { name: /新規作成|追加|Add/i }).click()`
  3. `await page.route('**/api/accounts', route => route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }))`
  4. フォームを入力して送信
  5. `await expect(page.getByText(/エラー|error|失敗/i)).toBeVisible()`
- **Expected Result**: API エラー時にユーザーフレンドリーなエラーメッセージが表示
- **Pass Criteria**: エラーメッセージが表示 AND フォームが閉じない（再試行可能）
- **Fail Indicators**: エラーが表示されない、白画面

### 5.8 Playwright テーブル操作テスト

### TEST-DSH-079: コンテンツ一覧テーブル — カラムソート (昇順/降順)
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content テーブルに10件以上のデータあり
- **Steps**:
  1. `await page.goto('/content')`
  2. `await page.getByRole('columnheader', { name: /作成日|created/i }).click()` (昇順)
  3. 最初の行の日付を取得:
     `const firstDateAsc = await page.locator('tbody tr').first().locator('td').nth(/*date column index*/).textContent()`
  4. `await page.getByRole('columnheader', { name: /作成日|created/i }).click()` (降順)
  5. `const firstDateDesc = await page.locator('tbody tr').first().locator('td').nth(/*date column index*/).textContent()`
  6. Assert firstDateAsc <= firstDateDesc (日付順序が逆転)
- **Expected Result**: カラムヘッダークリックで昇順/降順が切り替わる
- **Pass Criteria**: 昇順→降順でデータ順序が逆転
- **Fail Indicators**: ソートが動作しない、データ順序が変わらない

### TEST-DSH-080: テーブルフィルター適用・解除
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に各ステータスのデータあり (planned, producing, published)
- **Steps**:
  1. `await page.goto('/content')`
  2. `await page.getByLabel(/ステータス|status/i).selectOption('planned')`
  3. テーブル全行のステータスが 'planned' であることを確認:
     `const statuses = await page.locator('tbody tr td.status').allTextContents()`
  4. Assert all statuses === 'planned'
  5. フィルターを解除: `await page.getByLabel(/ステータス|status/i).selectOption('')`
  6. テーブルに複数ステータスが表示されることを確認
- **Expected Result**: フィルター適用で絞り込み、解除で全件表示
- **Pass Criteria**: フィルター中は全件が指定ステータス AND 解除後は複数ステータス
- **Fail Indicators**: フィルターが効かない

### TEST-DSH-081: テーブルページネーション — 次/前ページ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に30件以上のデータ (DASHBOARD_ITEMS_PER_PAGE=20)
- **Steps**:
  1. `await page.goto('/content')`
  2. 1ページ目の表示件数を確認: `const rowCount1 = await page.locator('tbody tr').count()` → 20
  3. `await page.getByRole('button', { name: /次|next|>/i }).click()`
  4. `const rowCount2 = await page.locator('tbody tr').count()` → 10 (残り)
  5. `await page.getByRole('button', { name: /前|prev|</i }).click()`
  6. `const rowCount3 = await page.locator('tbody tr').count()` → 20 (1ページ目に戻る)
- **Expected Result**: ページネーションで次/前ページに遷移
- **Pass Criteria**: 各ページの表示件数が正しい
- **Fail Indicators**: ページ切替が動作しない、件数が不正

### TEST-DSH-082: テーブルページネーション — 特定ページ遷移
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: content に50件以上のデータ (DASHBOARD_ITEMS_PER_PAGE=20)
- **Steps**:
  1. `await page.goto('/content')`
  2. `await page.getByRole('button', { name: '3' }).click()` (3ページ目)
  3. `const rowCount = await page.locator('tbody tr').count()` → 10 (41-50件)
  4. ページネーションの「3」がアクティブ状態であることを確認
- **Expected Result**: 特定ページ番号クリックで直接遷移
- **Pass Criteria**: 3ページ目のデータが表示
- **Fail Indicators**: ページ遷移しない

### TEST-DSH-083: テーブル空データ時の表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: hypotheses テーブルが空
- **Steps**:
  1. `await page.goto('/hypotheses')`
  2. `await expect(page.getByText(/データがありません|No data|0件/i)).toBeVisible()`
  3. テーブルのヘッダーは表示されることを確認:
     `await expect(page.locator('thead')).toBeVisible()`
- **Expected Result**: 空データ時に「データがありません」メッセージが表示
- **Pass Criteria**: empty state メッセージ表示 AND テーブルヘッダーは維持
- **Fail Indicators**: 白画面、エラー、または空のtbodyのみ表示

### TEST-DSH-084: テーブル行クリックで詳細遷移
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: accounts にデータあり
- **Steps**:
  1. `await page.goto('/accounts')`
  2. `const firstAccountId = await page.locator('tbody tr').first().locator('td').first().textContent()`
  3. `await page.locator('tbody tr').first().click()`
  4. `await expect(page).toHaveURL(new RegExp('/accounts/ACC_'))`
  5. `await expect(page.locator('h1, h2')).toContainText(firstAccountId)`
- **Expected Result**: テーブル行クリックで詳細ページに遷移
- **Pass Criteria**: 正しいIDの詳細ページが表示
- **Fail Indicators**: 遷移しない、別のアカウントが表示

### 5.9 Playwright モーダル・ダイアログテスト

### TEST-DSH-085: 設定編集モーダル — 開く/閉じる
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: system_settings にデータあり
- **Steps**:
  1. `await page.goto('/settings')`
  2. 任意の設定行の編集ボタンをクリック:
     `await page.locator('tbody tr').first().getByRole('button', { name: /編集|edit/i }).click()`
  3. `await expect(page.getByRole('dialog')).toBeVisible()`
  4. モーダルのタイトルに設定キー名が含まれることを確認
  5. 閉じるボタンをクリック: `await page.getByRole('dialog').getByRole('button', { name: /閉じる|close|×/i }).click()`
  6. `await expect(page.getByRole('dialog')).not.toBeVisible()`
- **Expected Result**: モーダルの開閉が正常に動作
- **Pass Criteria**: 開く→表示 AND 閉じる→非表示
- **Fail Indicators**: モーダルが開かない、閉じない

### TEST-DSH-086: モーダル外クリックで閉じる
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/settings')`
  2. 設定編集モーダルを開く
  3. `await expect(page.getByRole('dialog')).toBeVisible()`
  4. モーダル外の overlay をクリック:
     `await page.locator('[data-overlay], .backdrop, [class*="overlay"]').click({ force: true })`
  5. `await expect(page.getByRole('dialog')).not.toBeVisible()`
- **Expected Result**: モーダル外クリックでモーダルが閉じる
- **Pass Criteria**: overlay クリック後にモーダルが非表示
- **Fail Indicators**: モーダルが閉じない

### TEST-DSH-087: ESCキーでモーダルを閉じる
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/settings')`
  2. 設定編集モーダルを開く
  3. `await expect(page.getByRole('dialog')).toBeVisible()`
  4. `await page.keyboard.press('Escape')`
  5. `await expect(page.getByRole('dialog')).not.toBeVisible()`
- **Expected Result**: ESCキーでモーダルが閉じる
- **Pass Criteria**: ESCキー押下後にモーダルが非表示
- **Fail Indicators**: ESCキーが無効

### TEST-DSH-088: 保存確認ダイアログ — 変更前後の値表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: system_settings に MAX_RETRY_ATTEMPTS = 3 あり
- **Steps**:
  1. `await page.goto('/settings')`
  2. MAX_RETRY_ATTEMPTS の編集モーダルを開く
  3. 値を '5' に変更して保存ボタンをクリック
  4. 確認ダイアログに変更前後の値が表示されることを確認:
     `await expect(page.getByRole('alertdialog')).toContainText('3')` (変更前)
     `await expect(page.getByRole('alertdialog')).toContainText('5')` (変更後)
  5. `await page.getByRole('alertdialog').getByRole('button', { name: /確認|confirm|OK/i }).click()`
  6. `await expect(page.getByText(/保存しました|Saved/i)).toBeVisible()`
- **Expected Result**: 確認ダイアログに変更前後の値が表示され、確認後に保存
- **Pass Criteria**: 変更前値 '3' AND 変更後値 '5' が表示
- **Fail Indicators**: 確認ダイアログが表示されない、値が表示されない

### TEST-DSH-089: エラーログ — リトライ確認ダイアログ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: task_queue に status='failed_permanent' の行あり
- **Steps**:
  1. `await page.goto('/errors')`
  2. 失敗タスクの「リトライ」ボタンをクリック
  3. 確認ダイアログが表示されることを確認:
     `await expect(page.getByRole('alertdialog')).toBeVisible()`
     `await expect(page.getByRole('alertdialog')).toContainText(/リトライ|retry/i)`
  4. リトライ回数が表示されていることを確認
  5. キャンセルボタンをクリック:
     `await page.getByRole('alertdialog').getByRole('button', { name: /キャンセル|cancel/i }).click()`
  6. `await expect(page.getByRole('alertdialog')).not.toBeVisible()`
- **Expected Result**: リトライ前に確認ダイアログが表示、キャンセルで閉じる
- **Pass Criteria**: ダイアログ表示 AND キャンセルで閉じる AND タスク状態は変更なし
- **Fail Indicators**: 確認なしでリトライが実行される

### TEST-DSH-090: 削除確認ダイアログ — OK/キャンセル
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: components に review_status='pending_review' の行あり
- **Steps**:
  1. `await page.goto('/tools')` (キュレーションレビューパネルを含む)
  2. コンポーネントの「削除」ボタンをクリック
  3. `await expect(page.getByRole('alertdialog')).toBeVisible()`
  4. `await expect(page.getByRole('alertdialog')).toContainText(/削除.*確認|本当に削除/i)`
  5. 「キャンセル」をクリック → ダイアログが閉じ、コンポーネントが残ることを確認
  6. 再度「削除」→ 確認ダイアログで「OK」をクリック
  7. `await expect(page.getByText(/削除しました|Deleted/i)).toBeVisible()`
- **Expected Result**: 削除確認でOK→削除実行、キャンセル→何もしない
- **Pass Criteria**: キャンセル=操作なし AND OK=削除実行
- **Fail Indicators**: 確認なしで削除、キャンセルしても削除される

### 5.10 エージェント管理画面テスト (7サブ機能)

### TEST-DSH-091: エージェント画面 — 7タブ切替
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: ダッシュボード起動済み、各テーブルにシードデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. 以下の7タブが存在することを確認し、各タブをクリックして内容が切り替わることを確認:
     ```
     const tabs = ['思考ログ', '対話', '進化', 'プロンプト管理', '改善提案', '個別成長', '受信トレイ'];
     for (const tab of tabs) {
       await page.getByRole('tab', { name: new RegExp(tab) }).click();
       await expect(page.getByRole('tabpanel')).toBeVisible();
     }
     ```
- **Expected Result**: 7タブ全てが表示され、クリックで内容が切り替わる
- **Pass Criteria**: 7タブ存在 AND 各タブクリック後にtabpanelが表示
- **Fail Indicators**: タブが欠如、内容が切り替わらない

### TEST-DSH-092: 思考ログビューア — エージェント別フィルタ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_thought_logs に strategist, researcher, analyst のデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /思考ログ/ }).click()`
  3. `await page.getByLabel(/エージェント/).selectOption('analyst')`
  4. ログ一覧が analyst のみであることを確認:
     `const agents = await page.locator('[data-agent-type]').allTextContents()`
  5. Assert all agents contain 'analyst'
- **Expected Result**: analyst でフィルタ時、analyst のログのみ表示
- **Pass Criteria**: 全件の agent_type = 'analyst'
- **Fail Indicators**: 他エージェントのログが混入

### TEST-DSH-093: 思考ログビューア — サイクル別フィルタ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_thought_logs に複数サイクルのデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /思考ログ/ }).click()`
  3. `await page.getByLabel(/サイクル/).selectOption('Cycle #127')`
  4. 全ログの cycle_id が 127 であることを確認
- **Expected Result**: 指定サイクルのログのみ表示
- **Pass Criteria**: 全件の cycle_id = 127
- **Fail Indicators**: 他サイクルのログが混入

### TEST-DSH-094: 思考ログビューア — 日付範囲フィルタ
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: agent_thought_logs に複数日付のデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /思考ログ/ }).click()`
  3. `await page.getByLabel(/開始日|from/i).fill('2026-03-01')`
  4. `await page.getByLabel(/終了日|to/i).fill('2026-03-07')`
  5. 全ログの日付が 2026-03-01 〜 2026-03-07 の範囲内であることを確認
- **Expected Result**: 指定日付範囲のログのみ表示
- **Pass Criteria**: 全件の created_at が指定範囲内
- **Fail Indicators**: 範囲外のログが混入

### TEST-DSH-095: 思考ログビューア — ステップ詳細展開
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_thought_logs にデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /思考ログ/ }).click()`
  3. ログエントリをクリックして展開:
     `await page.locator('[data-log-entry]').first().click()`
  4. 展開後に以下が表示されることを確認:
     - `await expect(page.getByText(/読み取りデータ|input_data/i)).toBeVisible()`
     - `await expect(page.getByText(/考慮事項|reasoning/i)).toBeVisible()`
     - `await expect(page.getByText(/判断|output/i)).toBeVisible()`
  5. MCPツール呼び出し詳細が表示されることを確認
- **Expected Result**: ログエントリ展開で入力データ・考慮事項・判断・MCP呼び出し詳細が表示
- **Pass Criteria**: 4セクション全て表示
- **Fail Indicators**: 展開しない、セクションが欠如

### TEST-DSH-096: 人間↔エージェント対話 — エージェント選択
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: agent_communications にデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /対話/ }).click()`
  3. 左サイドに6エージェント (戦略Agent, リサーチャー, アナリスト, プランナー, ツールSP, キュレーター) + 全体通知が表示されることを確認
  4. `await page.getByText('アナリスト').click()`
  5. 右側にアナリストとの対話履歴が表示されることを確認
- **Expected Result**: エージェント選択で対話履歴が切り替わる
- **Pass Criteria**: 6エージェント + 全体通知のリスト AND 選択時に対話履歴表示
- **Fail Indicators**: エージェントリストが表示されない

### TEST-DSH-097: 人間↔エージェント対話 — メッセージ送信
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /対話/ }).click()`
  3. `await page.getByText('アナリスト').click()`
  4. `await page.getByPlaceholder(/指示を入力|メッセージ/i).fill('エンゲージメント率を重視せよ')`
  5. `await page.getByLabel(/優先度|priority/i).selectOption('high')`
  6. `await page.getByRole('button', { name: /送信|Send/i }).click()`
  7. `await expect(page.getByText('エンゲージメント率を重視せよ')).toBeVisible()`
  8. `await expect(page.getByText(/pending/i)).toBeVisible()` (ステータス)
- **Expected Result**: メッセージが送信され、対話履歴に表示
- **Pass Criteria**: メッセージが対話ウィンドウに表示 AND ステータス = pending
- **Fail Indicators**: メッセージが送信されない、表示されない

### TEST-DSH-098: 人間↔エージェント対話 — ステータス表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: human_directives に status='applied' と status='pending' の行あり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /対話/ }).click()`
  3. `await page.getByText('アナリスト').click()`
  4. applied 状態のメッセージに「適用済み」バッジがあることを確認:
     `await expect(page.locator('[data-status="applied"]')).toBeVisible()`
  5. pending 状態のメッセージに「保留中」バッジがあることを確認:
     `await expect(page.locator('[data-status="pending"]')).toBeVisible()`
- **Expected Result**: 各メッセージのステータス (pending/applied) が視覚的に区別される
- **Pass Criteria**: ステータスバッジが正しく表示
- **Fail Indicators**: ステータスが表示されない

### TEST-DSH-099: エージェント進化 — self_score 推移チャート
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_reflections に複数サイクルのデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /進化/ }).click()`
  3. `await expect(page.locator('.recharts-wrapper, canvas, svg.chart')).toBeVisible()`
  4. チャートに少なくとも1つのデータポイントが描画されていることを確認:
     `await expect(page.locator('.recharts-dot, .recharts-line')).toHaveCount({ min: 1 })`
- **Expected Result**: self_score 推移チャートが描画される
- **Pass Criteria**: チャート要素が visible AND データポイントが存在
- **Fail Indicators**: チャートが描画されない

### TEST-DSH-100: エージェント進化 — 学習停滞アラート
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: agent_reflections に self_score が3サイクル連続低下しているデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /進化/ }).click()`
  3. `await expect(page.getByText(/停滞|stagnation|低下傾向/i)).toBeVisible()`
- **Expected Result**: 学習停滞時にアラートが表示される
- **Pass Criteria**: 停滞アラートメッセージが表示
- **Fail Indicators**: 停滞検知されない

### TEST-DSH-101: プロンプト管理 — バージョン一覧表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_prompt_versions に複数バージョンあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /プロンプト管理/ }).click()`
  3. エージェントタイプを選択: `await page.getByLabel(/エージェント/).selectOption('strategist')`
  4. バージョン一覧が表示されることを確認:
     `await expect(page.locator('[data-version]')).toHaveCount({ min: 1 })`
  5. アクティブバージョンがハイライトされていることを確認:
     `await expect(page.locator('[data-version][data-active="true"]')).toBeVisible()`
- **Expected Result**: エージェントごとのプロンプトバージョン一覧表示
- **Pass Criteria**: バージョン一覧表示 AND アクティブバージョンがハイライト
- **Fail Indicators**: 一覧が空、アクティブ表示なし

### TEST-DSH-102: プロンプト管理 — プロンプト編集・保存
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: agent_prompt_versions にデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /プロンプト管理/ }).click()`
  3. 「新しいバージョンを作成」ボタンをクリック
  4. マークダウンエディタにプロンプトを入力:
     `await page.locator('[data-editor], textarea').fill('# Updated Prompt\n\nNew instructions here.')`
  5. 変更理由を入力: `await page.getByLabel(/変更理由|reason/i).fill('エンゲージメント重視の指示追加')`
  6. `await page.getByRole('button', { name: /保存|Save/i }).click()`
  7. `await expect(page.getByText(/保存しました|Saved/i)).toBeVisible()`
- **Expected Result**: 新バージョンのプロンプトが保存される
- **Pass Criteria**: 保存成功 AND バージョン一覧に新バージョンが追加
- **Fail Indicators**: 保存失敗、バージョンが追加されない

### TEST-DSH-103: プロンプト管理 — バージョン差分表示
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: agent_prompt_versions に2バージョン以上あり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /プロンプト管理/ }).click()`
  3. 古いバージョンをクリックして差分表示:
     `await page.locator('[data-version]').nth(1).click()`
  4. `await page.getByRole('button', { name: /差分|diff/i }).click()`
  5. 追加行 (green) と削除行 (red) が表示されることを確認:
     `await expect(page.locator('.diff-added, [data-diff="added"]')).toBeVisible()`
- **Expected Result**: バージョン間の差分がハイライト表示される
- **Pass Criteria**: 追加/削除のハイライトが表示
- **Fail Indicators**: 差分が表示されない

### TEST-DSH-104: プロンプト管理 — ロールバック操作
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_prompt_versions に2バージョン以上あり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /プロンプト管理/ }).click()`
  3. 非アクティブバージョンの「ロールバック」ボタンをクリック:
     `await page.locator('[data-version][data-active="false"]').first().getByRole('button', { name: /ロールバック|rollback/i }).click()`
  4. 確認ダイアログが表示: `await expect(page.getByRole('alertdialog')).toBeVisible()`
  5. 「確認」をクリック
  6. ロールバック先のバージョンがアクティブに変わることを確認
- **Expected Result**: ロールバックで指定バージョンがアクティブ化
- **Pass Criteria**: アクティブバージョンが変更
- **Fail Indicators**: ロールバック失敗、アクティブが変わらない

### TEST-DSH-105: 改善提案パネル — 提案一覧・承認/却下
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: prompt_suggestions に status='pending' のデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /改善提案/ }).click()`
  3. pending の提案一覧が表示されることを確認
  4. 提案の「承認」ボタンをクリック:
     `await page.locator('[data-suggestion]').first().getByRole('button', { name: /承認|accept/i }).click()`
  5. `await expect(page.getByText(/承認しました|Accepted/i)).toBeVisible()`
  6. 別の提案の「却下」ボタンをクリック:
     `await page.locator('[data-suggestion]').first().getByRole('button', { name: /却下|reject/i }).click()`
  7. `await expect(page.getByText(/却下しました|Rejected/i)).toBeVisible()`
- **Expected Result**: 提案の承認/却下が正常に動作
- **Pass Criteria**: ステータスが accepted/rejected に更新
- **Fail Indicators**: 操作が失敗

### TEST-DSH-106: 改善提案パネル — プロンプト編集画面への遷移
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: prompt_suggestions に status='accepted' のデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /改善提案/ }).click()`
  3. accepted の提案の「プロンプト編集で適用」リンクをクリック
  4. プロンプト管理タブに切り替わることを確認:
     `await expect(page.getByRole('tab', { name: /プロンプト管理/ })).toHaveAttribute('aria-selected', 'true')`
- **Expected Result**: 改善提案からプロンプト管理タブに遷移
- **Pass Criteria**: プロンプト管理タブがアクティブ化
- **Fail Indicators**: 遷移しない

### TEST-DSH-107: 個別成長トラッキング — パフォーマンスカード
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_individual_learnings + agent_reflections にデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /個別成長/ }).click()`
  3. 各エージェントのパフォーマンスカードが表示されることを確認:
     `await expect(page.locator('[data-agent-card]')).toHaveCount({ min: 4 })`
  4. カードに以下の3指標が表示されることを確認:
     - self_score: `await expect(page.locator('[data-agent-card]').first().getByText(/スコア|score/i)).toBeVisible()`
     - 学習数: `await expect(page.locator('[data-agent-card]').first().getByText(/学習|learning/i)).toBeVisible()`
     - 振り返り: `await expect(page.locator('[data-agent-card]').first().getByText(/振り返り|reflection/i)).toBeVisible()`
- **Expected Result**: エージェント別のパフォーマンスカードに3指標表示
- **Pass Criteria**: 4エージェント以上のカード AND 各カードに3指標
- **Fail Indicators**: カードが表示されない、指標が欠如

### TEST-DSH-108: 個別成長トラッキング — エージェント比較ビュー
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: agent_individual_learnings にデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /個別成長/ }).click()`
  3. 比較ビューに切替: `await page.getByRole('button', { name: /比較|compare/i }).click()`
  4. エージェント間のランキングまたは推移グラフが表示されることを確認
- **Expected Result**: エージェント間の成長比較が視覚化される
- **Pass Criteria**: 比較チャートまたはランキングが表示
- **Fail Indicators**: 比較ビューが表示されない

### TEST-DSH-109: 受信トレイ — メッセージ一覧・未読バッジ
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: agent_communications に status='unread' の行3件あり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /受信トレイ/ }).click()`
  3. メッセージ一覧が表示されることを確認:
     `await expect(page.locator('[data-message]')).toHaveCount({ min: 3 })`
  4. 未読バッジが表示されることを確認:
     `await expect(page.locator('.badge, [data-unread]')).toContainText('3')`
- **Expected Result**: 未読メッセージ数のバッジ付きで一覧表示
- **Pass Criteria**: メッセージ一覧 AND 未読バッジ = 3
- **Fail Indicators**: メッセージが表示されない、バッジが不正

### TEST-DSH-110: 受信トレイ — メッセージ返信
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: agent_communications に status='unread' の行あり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /受信トレイ/ }).click()`
  3. 最初のメッセージをクリック
  4. `await page.getByPlaceholder(/返信|reply/i).fill('了解。次サイクルから適用して。')`
  5. `await page.getByRole('button', { name: /返信|Reply/i }).click()`
  6. `await expect(page.getByText(/返信しました|Replied/i)).toBeVisible()`
  7. メッセージのステータスが 'responded' に変わることを確認
- **Expected Result**: メッセージへの返信が保存され、ステータスが responded に更新
- **Pass Criteria**: 返信保存 AND ステータス = responded
- **Fail Indicators**: 返信が失敗

### TEST-DSH-111: 受信トレイ — ステータスフィルタ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: agent_communications に各ステータスのデータあり
- **Steps**:
  1. `await page.goto('/agents')`
  2. `await page.getByRole('tab', { name: /受信トレイ/ }).click()`
  3. `await page.getByLabel(/ステータス|status/i).selectOption('unread')`
  4. 全件が unread であることを確認
  5. `await page.getByLabel(/ステータス|status/i).selectOption('responded')`
  6. 全件が responded であることを確認
- **Expected Result**: ステータスフィルタで絞り込み可能
- **Pass Criteria**: フィルタ適用で正しく絞り込み
- **Fail Indicators**: フィルタが効かない

### 5.11 キャラクター管理画面テスト

### TEST-DSH-112: キャラクター一覧 — status フィルタ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: characters に draft/active/archived のデータあり
- **Steps**:
  1. `await page.goto('/characters')`
  2. `await page.getByLabel(/ステータス|status/i).selectOption('active')`
  3. 全件が active であることを確認:
     `const statuses = await page.locator('tbody tr [data-status]').allTextContents()`
  4. Assert all statuses === 'active'
- **Expected Result**: ステータスフィルタで絞り込み可能
- **Pass Criteria**: 全件のステータスが指定値
- **Fail Indicators**: フィルタが効かない

### TEST-DSH-113: キャラクター詳細表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: characters にCHR_0001あり
- **Steps**:
  1. `await page.goto('/characters')`
  2. CHR_0001 の行をクリック
  3. 詳細ページに以下が表示されることを確認:
     - `await expect(page.getByText('CHR_0001')).toBeVisible()`
     - `await expect(page.getByText(/名前|name/i)).toBeVisible()`
     - `await expect(page.getByText(/ニッチ|niche/i)).toBeVisible()`
     - `await expect(page.getByText(/パーソナリティ|personality/i)).toBeVisible()`
     - 画像プレビューが表示: `await expect(page.locator('img[alt*="character"], img[alt*="キャラクター"]')).toBeVisible()`
- **Expected Result**: キャラクターの全情報 + 画像が詳細ページに表示
- **Pass Criteria**: 5項目全て表示
- **Fail Indicators**: いずれかの項目が欠如

### TEST-DSH-114: キャラクター レビュー — 承認フロー
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: characters に review_status='pending_review' (自動生成キャラクター) のデータあり
- **Steps**:
  1. `await page.goto('/characters')`
  2. `await page.getByLabel(/ステータス|status/i).selectOption('pending_review')`
  3. 最初のキャラクターをクリック
  4. `await page.getByRole('button', { name: /承認|approve/i }).click()`
  5. `await expect(page.getByText(/承認しました|Approved/i)).toBeVisible()`
  6. 一覧に戻り、承認したキャラクターの review_status が 'human_approved' であることを確認
- **Expected Result**: 自動生成キャラクターを承認 → human_approved に遷移
- **Pass Criteria**: review_status = 'human_approved'
- **Fail Indicators**: ステータスが変更されない

### TEST-DSH-115: キャラクター レビュー — 却下フロー
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: characters に review_status='pending_review' のデータあり
- **Steps**:
  1. `await page.goto('/characters')`
  2. pending_review のキャラクターをクリック
  3. `await page.getByPlaceholder(/理由|reason/i).fill('パーソナリティが不適切')`
  4. `await page.getByRole('button', { name: /却下|reject/i }).click()`
  5. `await expect(page.getByText(/却下しました|Rejected/i)).toBeVisible()`
- **Expected Result**: キャラクターを理由付きで却下
- **Pass Criteria**: 却下成功 AND フィードバックが保存
- **Fail Indicators**: 却下が失敗

### TEST-DSH-116: キャラクター手動作成フォーム
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/characters')`
  2. `await page.getByRole('button', { name: /新規作成|手動作成|Add/i }).click()`
  3. `await page.getByLabel(/名前|name/i).fill('テストキャラ')`
  4. `await page.getByLabel(/ニッチ|niche/i).fill('beauty')`
  5. `await page.getByLabel(/パーソナリティ|personality/i).fill('明るく元気')`
  6. `await page.getByLabel(/ターゲット|target/i).fill('20代女性')`
  7. `await page.getByRole('button', { name: /作成|Save/i }).click()`
  8. `await expect(page.getByText(/作成しました|Created/i)).toBeVisible()`
- **Expected Result**: キャラクターが手動で作成される
- **Pass Criteria**: 作成成功 AND 一覧に新キャラクターが出現
- **Fail Indicators**: 作成失敗

### TEST-DSH-117: キャラクター画像プレビュー
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: characters に image_drive_id 付きのデータあり
- **Steps**:
  1. `await page.goto('/characters')`
  2. キャラクターの行にサムネイル画像が表示されることを確認:
     `await expect(page.locator('tbody tr img').first()).toBeVisible()`
  3. 画像をクリックして拡大プレビューが表示されることを確認:
     `await page.locator('tbody tr img').first().click()`
     `await expect(page.locator('[data-lightbox], [role="dialog"] img')).toBeVisible()`
- **Expected Result**: サムネイル表示 AND クリックで拡大プレビュー
- **Pass Criteria**: サムネイル AND 拡大画像が表示
- **Fail Indicators**: 画像が表示されない

### 5.12 未カバー画面テスト

### TEST-DSH-118: 制作キュー画面 — task_queue一覧
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: task_queue にデータあり
- **Steps**:
  1. `await page.goto('/production')`
  2. テーブルが表示されることを確認:
     `await expect(page.locator('table, [data-table]')).toBeVisible()`
  3. 各行に task_id, type, status, priority, created_at が表示されることを確認
  4. `await expect(page.locator('tbody tr')).toHaveCount({ min: 1 })`
- **Expected Result**: task_queue の一覧がテーブル表示
- **Pass Criteria**: テーブル表示 AND 必要カラムが全て存在
- **Fail Indicators**: テーブルが表示されない

### TEST-DSH-119: 制作キュー画面 — ステータス別フィルター
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: task_queue に queued, processing, completed のデータあり
- **Steps**:
  1. `await page.goto('/production')`
  2. `await page.getByLabel(/ステータス|status/i).selectOption('processing')`
  3. 全件が processing であることを確認
  4. `await page.getByLabel(/ステータス|status/i).selectOption('queued')`
  5. 全件が queued であることを確認
- **Expected Result**: ステータスフィルターが動作
- **Pass Criteria**: フィルタ適用で正しく絞り込み
- **Fail Indicators**: フィルタが効かない

### TEST-DSH-120: 制作キュー画面 — 優先度変更
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: task_queue に queued ステータスの行あり
- **Steps**:
  1. `await page.goto('/production')`
  2. queued タスクの優先度ドロップダウンを変更:
     `await page.locator('tbody tr').first().getByLabel(/優先度|priority/i).selectOption('high')`
  3. `await expect(page.getByText(/更新しました|Updated/i)).toBeVisible()`
- **Expected Result**: タスクの優先度が変更される
- **Pass Criteria**: 優先度が更新 AND 成功メッセージ表示
- **Fail Indicators**: 優先度が変更されない

### TEST-DSH-121: コンテンツ一覧画面 — 全content検索
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content にデータあり
- **Steps**:
  1. `await page.goto('/content')`
  2. `await page.getByPlaceholder(/検索|search/i).fill('beauty')`
  3. `await page.keyboard.press('Enter')`
  4. 表示結果に 'beauty' が含まれることを確認
- **Expected Result**: キーワード検索で絞り込み可能
- **Pass Criteria**: 検索結果が表示
- **Fail Indicators**: 検索が動作しない

### TEST-DSH-122: コンテンツ一覧画面 — ステータス別フィルター
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に各ステータスのデータあり
- **Steps**:
  1. `await page.goto('/content')`
  2. `await page.getByLabel(/ステータス|status/i).selectOption('published')`
  3. 全件が published であることを確認
- **Expected Result**: ステータスフィルターが動作
- **Pass Criteria**: フィルタ適用で正しく絞り込み
- **Fail Indicators**: フィルタが効かない

### TEST-DSH-123: 仮説ブラウザ画面 — 仮説一覧・カテゴリ別分析
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: hypotheses に各カテゴリ (timing, content_type, platform, audience) のデータあり
- **Steps**:
  1. `await page.goto('/hypotheses')`
  2. テーブルが表示されることを確認
  3. `await page.getByLabel(/カテゴリ|category/i).selectOption('timing')`
  4. 全件が timing カテゴリであることを確認
  5. 的中率推移チャートが表示されることを確認:
     `await expect(page.locator('.recharts-wrapper, canvas, svg.chart')).toBeVisible()`
- **Expected Result**: 仮説一覧 + カテゴリフィルタ + 的中率チャートが表示
- **Pass Criteria**: テーブル AND フィルタ AND チャート全て表示
- **Fail Indicators**: いずれかが欠如

### TEST-DSH-124: 知見ブラウザ画面 — 信頼度フィルター
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: learnings に confidence 0.3〜0.9 のデータあり
- **Steps**:
  1. `await page.goto('/learnings')`
  2. 信頼度スライダーまたは入力で min_confidence=0.7 を設定:
     `await page.getByLabel(/最低信頼度|min.*confidence/i).fill('0.7')`
  3. 全件の confidence >= 0.7 であることを確認
- **Expected Result**: 信頼度フィルターで高信頼度の知見のみ表示
- **Pass Criteria**: 全件 confidence >= 0.7
- **Fail Indicators**: 低信頼度の知見が混入

### TEST-DSH-125: 知見ブラウザ画面 — 類似知見検索
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: learnings にデータあり (pgvector embedding)
- **Steps**:
  1. `await page.goto('/learnings')`
  2. `await page.getByPlaceholder(/類似検索|similar/i).fill('エンゲージメント率改善')`
  3. `await page.getByRole('button', { name: /検索|Search/i }).click()`
  4. 類似度スコア付きの結果が表示されることを確認:
     `await expect(page.locator('[data-similarity]')).toHaveCount({ min: 1 })`
- **Expected Result**: テキストベースの類似知見検索が動作
- **Pass Criteria**: 類似度スコア付きの結果表示
- **Fail Indicators**: 検索が動作しない

### TEST-DSH-126: ツール管理画面 — tool_catalog一覧
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: tool_catalog にデータあり
- **Steps**:
  1. `await page.goto('/tools')`
  2. ツール一覧テーブルが表示されることを確認:
     `await expect(page.locator('table, [data-table]')).toBeVisible()`
  3. 各行に tool_name, tool_type, version, performance_score が表示されることを確認
- **Expected Result**: ツールカタログの一覧表示
- **Pass Criteria**: テーブル AND 必要カラム全て表示
- **Fail Indicators**: テーブルが空

### TEST-DSH-127: ツール管理画面 — キュレーションレビューパネル
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: components に review_status='pending_review' のデータあり
- **Steps**:
  1. `await page.goto('/tools')`
  2. キュレーションレビューセクションに移動:
     `await page.getByRole('tab', { name: /キュレーション|curation/i }).click()`
  3. pending_review のコンポーネント一覧が表示されることを確認
  4. 各コンポーネントに種別・自信度が表示されることを確認:
     `await expect(page.locator('[data-confidence]')).toHaveCount({ min: 1 })`
  5. 承認ボタンをクリック:
     `await page.locator('[data-component]').first().getByRole('button', { name: /承認|approve/i }).click()`
  6. `await expect(page.getByText(/承認しました|Approved/i)).toBeVisible()`
- **Expected Result**: キュレーション結果のレビュー + 承認が動作
- **Pass Criteria**: コンポーネント一覧表示 AND 承認操作成功
- **Fail Indicators**: パネルが表示されない、承認が失敗

### TEST-DSH-128: コスト管理画面 — 日次/月次API支出
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: system_settings (cost_control) + task_queue にコストデータあり
- **Steps**:
  1. `await page.goto('/costs')`
  2. 日次API支出が表示されることを確認:
     `await expect(page.getByText(/日次|daily/i)).toBeVisible()`
  3. 月次API支出が表示されることを確認:
     `await expect(page.getByText(/月次|monthly/i)).toBeVisible()`
  4. 予算消化率チャートが表示されることを確認:
     `await expect(page.locator('.recharts-wrapper, [data-chart]')).toBeVisible()`
- **Expected Result**: 日次/月次のAPI支出 + 予算消化率が表示
- **Pass Criteria**: 3要素全て表示
- **Fail Indicators**: いずれかが欠如

### TEST-DSH-129: コスト管理画面 — 予算超過アラート
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: コスト消化率が COST_ALERT_THRESHOLD (80%) を超えている状態
- **Steps**:
  1. `await page.goto('/costs')`
  2. `await expect(page.getByText(/予算超過|budget.*alert|警告/i)).toBeVisible()`
  3. アラートが Warning 色 (#b58900) で表示されていることを確認:
     `const alertColor = await page.locator('[data-alert]').evaluate(el => getComputedStyle(el).color)`
- **Expected Result**: 予算超過時にアラートが表示される
- **Pass Criteria**: アラートメッセージ表示 AND Warning 色
- **Fail Indicators**: アラートが表示されない

### TEST-DSH-130: 人間指示画面 — 履歴閲覧
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: human_directives に複数の指示あり
- **Steps**:
  1. `await page.goto('/directives')`
  2. 指示履歴一覧が表示されることを確認:
     `await expect(page.locator('[data-directive], tbody tr')).toHaveCount({ min: 2 })`
  3. 各指示に対象エージェント・ステータス・作成日が表示されることを確認
  4. 指示をクリックして詳細が展開されることを確認
- **Expected Result**: 過去の指示履歴が閲覧可能
- **Pass Criteria**: 履歴一覧表示 AND 詳細展開可能
- **Fail Indicators**: 履歴が表示されない

### 5.13 ローディング・エラー状態テスト

### TEST-DSH-131: APIコール中のローディングインジケーター
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. API応答を遅延させる:
     `await page.route('**/api/accounts', route => new Promise(resolve => setTimeout(() => { route.fulfill({ status: 200, body: JSON.stringify({ accounts: [], total: 0 }) }); resolve(); }, 3000)))`
  2. `await page.goto('/accounts')`
  3. ローディングインジケーターが表示されることを確認:
     `await expect(page.locator('[data-loading], .spinner, [role="progressbar"]')).toBeVisible()`
  4. データ読み込み完了後にローディングが消えることを確認:
     `await expect(page.locator('[data-loading], .spinner, [role="progressbar"]')).not.toBeVisible({ timeout: 5000 })`
- **Expected Result**: API読み込み中にローディングが表示 → 完了後に消去
- **Pass Criteria**: ローディング表示→消去の遷移
- **Fail Indicators**: ローディングが表示されない、消えない

### TEST-DSH-132: APIエラー時のエラーメッセージ表示
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. API をエラーにモック:
     `await page.route('**/api/kpi/summary', route => route.fulfill({ status: 500, body: JSON.stringify({ error: 'Database connection failed' }) }))`
  2. `await page.goto('/kpi')`
  3. `await expect(page.getByText(/エラー|error|失敗/i)).toBeVisible()`
  4. エラーメッセージにリトライ可能な情報が含まれることを確認
- **Expected Result**: APIエラー時にユーザーフレンドリーなエラーメッセージが表示
- **Pass Criteria**: エラーメッセージ表示 AND 白画面にならない
- **Fail Indicators**: 白画面、コンソールエラーのみ

### TEST-DSH-133: ネットワークエラー時のリトライUI
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. ネットワーク接続を模擬的に切断:
     `await page.route('**/api/**', route => route.abort('connectionfailed'))`
  2. `await page.goto('/accounts')`
  3. エラー表示が出ることを確認:
     `await expect(page.getByText(/接続.*エラー|network.*error|再試行/i)).toBeVisible()`
  4. リトライボタンが表示されることを確認:
     `await expect(page.getByRole('button', { name: /再試行|retry/i })).toBeVisible()`
  5. ネットワークを復旧してリトライ:
     `await page.unroute('**/api/**')`
     `await page.getByRole('button', { name: /再試行|retry/i }).click()`
  6. データが正常に表示されることを確認
- **Expected Result**: ネットワークエラー時にリトライUIが表示、リトライで復旧可能
- **Pass Criteria**: エラー表示 → リトライボタン → 復旧成功
- **Fail Indicators**: リトライUIが表示されない

### TEST-DSH-134: 空レスポンス時の empty state 表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. 空データを返すモック:
     `await page.route('**/api/content*', route => route.fulfill({ status: 200, body: JSON.stringify({ content: [], total: 0 }) }))`
  2. `await page.goto('/content')`
  3. `await expect(page.getByText(/データがありません|No data|0件|コンテンツがありません/i)).toBeVisible()`
  4. 「新規作成」ボタンや説明テキストなどの CTA が表示されることを確認
- **Expected Result**: データが空の場合に empty state が表示 (エラーではない)
- **Pass Criteria**: empty state メッセージ + CTA 表示
- **Fail Indicators**: 白画面、エラーメッセージ、または空テーブルのみ

### 5.14 エッジケーステスト

### TEST-DSH-135: 空データ状態でのダッシュボード全画面表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: DBが初期状態（system_settings のみ、他テーブル空）
- **Steps**:
  1. 全15画面に順にアクセスし、いずれもクラッシュしないことを確認:
     ```
     const urls = ['/', '/kpi', '/production', '/review', '/content', '/accounts', '/characters', '/agents', '/hypotheses', '/learnings', '/tools', '/errors', '/costs', '/settings', '/directives'];
     for (const url of urls) {
       await page.goto(url);
       await expect(page.locator('main')).toBeVisible();
       // コンソールエラーがないことを確認
       const errors = [];
       page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
       expect(errors).toHaveLength(0);
     }
     ```
- **Expected Result**: データが空でも全画面がクラッシュせずに表示
- **Pass Criteria**: 15画面全て main 表示 AND コンソールエラーなし
- **Fail Indicators**: いずれかの画面でクラッシュ/白画面

### TEST-DSH-136: 大量データ (1000行+) テーブルパフォーマンス
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: content テーブルに1000件以上のデータ
- **Steps**:
  1. `const start = Date.now()`
  2. `await page.goto('/content')`
  3. `await page.locator('tbody tr').first().waitFor()`
  4. `const loadTime = Date.now() - start`
  5. Assert loadTime < 5000 (5秒以内)
  6. ページネーションが正しく動作することを確認 (50ページ)
  7. 次ページボタンクリックの応答時間 < 2000ms
- **Expected Result**: 1000件以上でもページネーション表示が5秒以内に完了
- **Pass Criteria**: 初期ロード < 5秒 AND ページ遷移 < 2秒
- **Fail Indicators**: ロードに5秒以上かかる、フリーズ

### TEST-DSH-137: 長文テキストの truncation / tooltip
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: content に title が200文字以上のデータあり
- **Steps**:
  1. `await page.goto('/content')`
  2. 長文タイトルのセルが truncation されていることを確認:
     `const cellWidth = await page.locator('td.title').first().evaluate(el => el.scrollWidth > el.clientWidth)`
  3. Assert cellWidth === true (テキストがオーバーフロー)
  4. セルにホバーして tooltip が表示されることを確認:
     `await page.locator('td.title').first().hover()`
     `await expect(page.locator('[role="tooltip"]')).toBeVisible()`
  5. tooltip に全文が表示されることを確認
- **Expected Result**: 長文は truncation + hover で tooltip 表示
- **Pass Criteria**: truncation AND tooltip に全文表示
- **Fail Indicators**: テキストがはみ出してレイアウト崩れ

### TEST-DSH-138: 特殊文字 (日本語・絵文字・HTML entities) の表示
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に以下のデータあり: 日本語タイトル「美容の極意✨」、HTML entities「&amp; &lt; &gt;」、絵文字「🎬🔥」
- **Steps**:
  1. `await page.goto('/content')`
  2. 日本語が正しく表示:
     `await expect(page.getByText('美容の極意✨')).toBeVisible()`
  3. HTML entities がエスケープされて正しく表示 (XSS防止):
     `await expect(page.getByText('& < >')).toBeVisible()` (レンダリングされたテキスト)
  4. 絵文字が正しく表示:
     `await expect(page.getByText('🎬🔥')).toBeVisible()`
- **Expected Result**: 日本語・絵文字・HTML entities が正しく表示 AND XSS防止
- **Pass Criteria**: 3種類全て正しく表示 AND HTML がエスケープ
- **Fail Indicators**: 文字化け、HTML が実行される (XSS)

### TEST-DSH-139: 不正URLアクセス — 404ページ
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/nonexistent-page')`
  2. `await expect(page.getByText(/404|見つかりません|Not Found/i)).toBeVisible()`
  3. ホームへのリンクが表示されることを確認:
     `await expect(page.getByRole('link', { name: /ホーム|Home/i })).toBeVisible()`
- **Expected Result**: 存在しないURLで404ページが表示
- **Pass Criteria**: 404メッセージ + ホームリンク表示
- **Fail Indicators**: 白画面、またはエラー画面

### TEST-DSH-140: 同時操作 — 別タブで同じ設定を編集
- **Category**: dashboard / playwright
- **Priority**: P3
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. Tab1: `const page1 = await context.newPage()`
  2. `await page1.goto('/settings')`
  3. Tab2: `const page2 = await context.newPage()`
  4. `await page2.goto('/settings')`
  5. Tab1: MAX_RETRY_ATTEMPTS を 5 に変更して保存
  6. Tab2: MAX_RETRY_ATTEMPTS を 7 に変更して保存
  7. Tab1 をリロードして値を確認 → 7 が表示（後勝ち）
- **Expected Result**: 後の保存が勝つ (last-write-wins)
- **Pass Criteria**: 最終値が最後に保存された値と一致
- **Fail Indicators**: エラー、データ不整合

### 5.15 アクセシビリティテスト

### TEST-DSH-141: Tab キーフォーカス移動
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み (viewport: 1280px)
- **Steps**:
  1. `await page.goto('/settings')`
  2. `await page.keyboard.press('Tab')`
  3. 最初のフォーカス可能要素にフォーカスが当たることを確認:
     `const focused = await page.evaluate(() => document.activeElement?.tagName)`
  4. Assert focused is 'A' or 'BUTTON' or 'INPUT'
  5. 連続 Tab でフォーカスが順序通りに移動することを確認
  6. Shift+Tab で逆順に移動することを確認
- **Expected Result**: Tab キーで論理的な順序でフォーカスが移動
- **Pass Criteria**: フォーカスが移動 AND 順序が論理的
- **Fail Indicators**: フォーカスが移動しない、フォーカスがトラップされる

### TEST-DSH-142: Enter キーでボタン操作
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/settings')`
  2. 編集ボタンにフォーカス:
     `await page.locator('tbody tr').first().getByRole('button', { name: /編集|edit/i }).focus()`
  3. `await page.keyboard.press('Enter')`
  4. モーダルが開くことを確認:
     `await expect(page.getByRole('dialog')).toBeVisible()`
- **Expected Result**: Enter キーでボタンが操作可能
- **Pass Criteria**: Enter でボタンがアクティベート
- **Fail Indicators**: Enter が無効

### TEST-DSH-143: ARIA ラベル存在確認
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/')`
  2. サイドバーに aria-label or role="navigation" があることを確認:
     `await expect(page.locator('nav, [role="navigation"]')).toBeVisible()`
  3. メインコンテンツに role="main" or `<main>` タグがあることを確認:
     `await expect(page.locator('main, [role="main"]')).toBeVisible()`
  4. 全てのボタンに accessible name があることを確認:
     ```
     const buttons = await page.locator('button').all();
     for (const btn of buttons) {
       const name = await btn.getAttribute('aria-label') || await btn.textContent();
       expect(name?.trim()).toBeTruthy();
     }
     ```
  5. 全ての画像に alt テキストがあることを確認:
     ```
     const imgs = await page.locator('img').all();
     for (const img of imgs) {
       const alt = await img.getAttribute('alt');
       expect(alt).toBeTruthy();
     }
     ```
- **Expected Result**: 全インタラクティブ要素に accessible name、全画像に alt が設定
- **Pass Criteria**: 全ボタンに name AND 全画像に alt
- **Fail Indicators**: aria-label/alt が欠如

### TEST-DSH-144: フォーカス可視性確認
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: ダッシュボード起動済み
- **Steps**:
  1. `await page.goto('/')`
  2. Tab キーでボタンにフォーカス
  3. フォーカスリングが視覚的に確認できることを確認:
     ```
     const outline = await page.evaluate(() => {
       const el = document.activeElement;
       const s = getComputedStyle(el);
       return s.outlineStyle !== 'none' || s.boxShadow !== 'none';
     });
     expect(outline).toBe(true);
     ```
- **Expected Result**: フォーカス状態が視覚的に確認可能
- **Pass Criteria**: outline または box-shadow でフォーカスリング表示
- **Fail Indicators**: フォーカスリングが非表示

### 5.16 ホーム画面コンポーネント詳細テスト (§6.14対応)

### TEST-DSH-145: ホーム — KPISummaryCards 4枚表示
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: metrics, accounts にデータあり
- **Steps**:
  1. `await page.goto('/')`
  2. 4枚のサマリカードが表示されることを確認:
     `await expect(page.locator('[data-card="kpi-summary"], .kpi-card')).toHaveCount(4)`
  3. 各カードに値が表示されていることを確認 (「-」や「N/A」ではない):
     - 総アカウント数: `await expect(page.getByText(/総アカウント|Total Accounts/i).locator('..')).not.toContainText('-')`
     - アクティブ率
     - 平均品質スコア
     - 日次予算消化率
- **Expected Result**: 4枚のKPIサマリカードに実データが表示
- **Pass Criteria**: 4枚全て表示 AND 値が数値
- **Fail Indicators**: カードが欠如、値が表示されない

### TEST-DSH-146: ホーム — EngagementTrendChart 30日チャート
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: metrics に過去30日分のデータあり
- **Steps**:
  1. `await page.goto('/')`
  2. エンゲージメント推移チャート (Recharts AreaChart) が表示:
     `await expect(page.locator('.recharts-area, .recharts-wrapper').first()).toBeVisible()`
  3. X軸に日付ラベルが表示されていることを確認
- **Expected Result**: 過去30日間のエンゲージメント推移が AreaChart で表示
- **Pass Criteria**: チャート描画 AND 日付ラベル表示
- **Fail Indicators**: チャートが描画されない

### TEST-DSH-147: ホーム — RecentContentTable 最新20件
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に20件以上のデータあり
- **Steps**:
  1. `await page.goto('/')`
  2. テーブルが表示されることを確認:
     `await expect(page.locator('table').last()).toBeVisible()`
  3. 表示件数が20件以下であることを確認:
     `const rows = await page.locator('table').last().locator('tbody tr').count()`
  4. Assert rows <= 20
  5. 各行に status badge + quality score が表示されていることを確認
- **Expected Result**: 最新20件のコンテンツが status badge + quality score 付きで表示
- **Pass Criteria**: 20件以下 AND status badge + quality score 表示
- **Fail Indicators**: テーブルが表示されない、件数超過

### TEST-DSH-148: ホーム — PlatformBreakdownPie チャート
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: content に複数プラットフォームのデータあり
- **Steps**:
  1. `await page.goto('/')`
  2. PieChart が表示:
     `await expect(page.locator('.recharts-pie, .recharts-sector')).toBeVisible()`
  3. 凡例に4プラットフォーム (YouTube, TikTok, Instagram, X) が表示:
     `await expect(page.getByText('YouTube')).toBeVisible()`
     `await expect(page.getByText('TikTok')).toBeVisible()`
- **Expected Result**: 4プラットフォーム別のコンテンツ分布が PieChart で表示
- **Pass Criteria**: PieChart 描画 AND プラットフォーム凡例表示
- **Fail Indicators**: チャートが描画されない

### 5.17 コンテンツレビュー画面コンポーネント詳細テスト (§6.14対応)

### TEST-DSH-149: レビュー — ReviewQueue 一覧表示
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: content に review_status='pending_review' + 'pending_approval' のデータあり
- **Steps**:
  1. `await page.goto('/review')`
  2. レビュー待ちアイテム一覧が表示:
     `await expect(page.locator('[data-review-item]')).toHaveCount({ min: 1 })`
  3. 優先度・作成日でソートされていることを確認
- **Expected Result**: pending_review/pending_approval のアイテムが優先度順に表示
- **Pass Criteria**: アイテム一覧表示
- **Fail Indicators**: 一覧が空

### TEST-DSH-150: レビュー — ContentPreview (動画)
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: content に content_format='short_video' のレビュー待ちデータあり
- **Steps**:
  1. `await page.goto('/review')`
  2. 動画コンテンツのアイテムをクリック
  3. 動画プレイヤーが表示されることを確認:
     `await expect(page.locator('video')).toBeVisible()`
  4. 再生ボタンが存在することを確認
- **Expected Result**: 動画コンテンツのプレビューが表示
- **Pass Criteria**: video 要素が visible
- **Fail Indicators**: プレイヤーが表示されない

### TEST-DSH-151: レビュー — QualityScoreDisplay レーダーチャート
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: content に quality_scores 付きのデータあり
- **Steps**:
  1. `await page.goto('/review')`
  2. レビューアイテムをクリック
  3. レーダーチャートが表示:
     `await expect(page.locator('.recharts-radar, .recharts-polar-grid')).toBeVisible()`
  4. 5メトリクス (originality, engagement_potential, brand_alignment, technical_quality, platform_fit) のラベルが表示
- **Expected Result**: 5メトリクスのレーダーチャートが表示
- **Pass Criteria**: レーダーチャート AND 5ラベル表示
- **Fail Indicators**: チャートが表示されない

### TEST-DSH-152: レビュー — RevisionHistory アコーディオン
- **Category**: dashboard / playwright
- **Priority**: P2
- **Prerequisites**: content に複数バージョンのデータあり
- **Steps**:
  1. `await page.goto('/review')`
  2. レビューアイテムをクリック
  3. 「改訂履歴」セクションをクリック:
     `await page.getByRole('button', { name: /改訂履歴|revision/i }).click()`
  4. アコーディオンが展開されて過去バージョンが表示:
     `await expect(page.locator('[data-revision]')).toHaveCount({ min: 1 })`
- **Expected Result**: アコーディオン形式で過去バージョンの改訂履歴が表示
- **Pass Criteria**: アコーディオン展開 AND 改訂データ表示
- **Fail Indicators**: アコーディオンが展開しない

### 5.18 設定画面コンポーネント詳細テスト (§6.14対応)

### TEST-DSH-153: 設定 — SettingsCategoryTabs 8カテゴリ (Playwright版)
- **Category**: dashboard / playwright
- **Priority**: P0
- **Prerequisites**: system_settings に8カテゴリのデータあり
- **Steps**:
  1. `await page.goto('/settings')`
  2. 8カテゴリのタブが表示されることを確認:
     ```
     const categories = ['production', 'posting', 'review', 'agent', 'measurement', 'cost_control', 'dashboard', 'credentials'];
     for (const cat of categories) {
       await expect(page.getByRole('tab', { name: new RegExp(cat, 'i') })).toBeVisible();
     }
     ```
  3. 各タブをクリックして内容が切り替わることを確認
- **Expected Result**: 8カテゴリタブが全て表示、切替が動作
- **Pass Criteria**: 8タブ存在 AND 切替動作
- **Fail Indicators**: タブが欠如

### TEST-DSH-154: 設定 — EditSettingModal 型別入力UI
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: system_settings に integer, string, boolean, json 型のデータあり
- **Steps**:
  1. `await page.goto('/settings')`
  2. integer 型の設定を編集 → NumberInput が表示されることを確認:
     `await expect(page.getByRole('dialog').locator('input[type="number"]')).toBeVisible()`
  3. boolean 型の設定を編集 → Switch が表示されることを確認:
     `await expect(page.getByRole('dialog').getByRole('switch')).toBeVisible()`
  4. json 型の設定を編集 → Monaco Editor またはテキストエリアが表示されることを確認:
     `await expect(page.getByRole('dialog').locator('[data-editor], textarea')).toBeVisible()`
- **Expected Result**: 設定値の型に応じた適切な入力UIが表示
- **Pass Criteria**: integer→NumberInput, boolean→Switch, json→Editor
- **Fail Indicators**: 全て同じテキスト入力

### 5.19 エラーログ画面コンポーネント詳細テスト (§6.14対応)

### TEST-DSH-155: エラーログ — ErrorFilterBar
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: task_queue にエラーデータあり
- **Steps**:
  1. `await page.goto('/errors')`
  2. フィルターバーが表示:
     `await expect(page.locator('[data-filter-bar]')).toBeVisible()`
  3. ステータスフィルタ (retrying/failed_permanent) が使用可能:
     `await page.getByLabel(/ステータス|status/i).selectOption('retrying')`
  4. 日付範囲フィルタが使用可能:
     `await page.getByLabel(/開始日|from/i).fill('2026-03-01')`
  5. エージェントタイプフィルタが使用可能:
     `await page.getByLabel(/エージェント|agent/i).selectOption('video_worker')`
- **Expected Result**: 3種類のフィルタ (ステータス/日付/エージェント) が使用可能
- **Pass Criteria**: 3フィルタ全て操作可能
- **Fail Indicators**: フィルタが表示されない

### TEST-DSH-156: エラーログ — ErrorDetailDrawer
- **Category**: dashboard / playwright
- **Priority**: P1
- **Prerequisites**: task_queue にエラーデータあり
- **Steps**:
  1. `await page.goto('/errors')`
  2. エラー行をクリック:
     `await page.locator('tbody tr').first().click()`
  3. ドロワーが開くことを確認:
     `await expect(page.locator('[data-drawer], [role="complementary"]')).toBeVisible()`
  4. ドロワーにエラートレースが表示されることを確認:
     `await expect(page.locator('[data-drawer]').getByText(/error|stack/i)).toBeVisible()`
  5. リトライボタンが存在することを確認:
     `await expect(page.locator('[data-drawer]').getByRole('button', { name: /リトライ|retry/i })).toBeVisible()`
- **Expected Result**: エラー詳細がドロワーに表示、リトライボタン付き
- **Pass Criteria**: ドロワー表示 AND エラートレース AND リトライボタン
- **Fail Indicators**: ドロワーが開かない

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

## 7. E2E Layer Tests (TEST-E2E)

### TEST-E2E-001: 仮説駆動サイクル完全ライフサイクル
- **Category**: e2e
- **Priority**: P0
- **Prerequisites**: 全システム稼働。accounts にアクティブアカウント最低1件。全外部APIキー設定済み
- **Steps**:
  1. 戦略サイクルグラフを起動 (サイクル#1)
  2. リサーチャーが市場情報収集 → market_intel に INSERT
  3. アナリストが分析 (analyze_cycle) → 初回サイクルのため前サイクルレビューはスキップ
  4. 社長が方針決定 (set_strategy) → 注力ニッチ・リソース配分を決定
  5. プランナーが仮説立案 + コンテンツ計画 (plan_content) → hypotheses に INSERT (verdict='pending') + content に INSERT (status='planned')
  6. Tool Specialist がレシピ選択 (select_tools) → content.recipe_id 設定
  7. 制作パイプラインが動画制作 → content.status = 'ready'
  8. 投稿スケジューラーが投稿 → publications.status = 'posted'
  9. 計測ジョブがメトリクス収集 → metrics に INSERT
  10. 次のサイクル (サイクル#2) でアナリストが仮説検証 (analyze_cycle) → hypotheses.verdict 更新
  11. 知見抽出 → learnings に INSERT
- **Expected Result**: 全11ステップが完了。hypotheses.verdict ≠ 'pending'。learnings に新行存在
- **Pass Criteria**: Step 11 完了 AND verdict ∈ {'confirmed', 'rejected', 'inconclusive'} AND learnings COUNT > 0
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
  1. PostgreSQL マイグレーション実行 (27テーブル + 86設定値)
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

## テストサマリー

| Section | Layer | Tests | P0 | P1 | P2 | P3 |
|---------|-------|-------|----|----|----|----|
| 1 | Database | 59 | 21 | 35 | 3 | 0 |
| 2 | MCP Server | 131 | 46 | 72 | 13 | 0 |
| 3 | Worker | 40 | 18 | 18 | 4 | 0 |
| 4 | LangGraph Agent | 35 | 11 | 19 | 5 | 0 |
| 5 | Dashboard | 156 | 30 | 92 | 32 | 2 |
| 6 | Integration | 20 | 7 | 11 | 2 | 0 |
| 7 | E2E | 12 | 4 | 8 | 0 | 0 |
| **Total** | | **453** | **137** | **255** | **59** | **2** |

> 全453テスト。各テストは AI エージェントが Pass/Fail を判定可能な精度で記述。
> P0 テスト (137件) は初回リリース前に全件パス必須。
> ※ TEST-AGT-033〜039 は欠番 (将来の拡張用に予約)。実テスト数は TEST-AGT-001〜032 + 040〜042 = 35件。

