-- ============================================================
-- AI-Influencer v5.0 — Default System Settings (86 entries)
-- Generated from docs/v5-specification/03-database-schema.md Section 7.2
-- ============================================================
-- Categories: production (13), posting (8), review (4), agent (43),
--             measurement (6), cost_control (4), dashboard (3), credentials (5)
-- ============================================================

-- Production settings (13)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('MAX_CONCURRENT_PRODUCTIONS', '5', 'production', '同時動画制作数上限。fal.aiの並列タスク制限(40)以下に設定', '5', 'integer', '{"min": 1, "max": 40}'),
('PRODUCTION_POLL_INTERVAL_SEC', '30', 'production', 'パイプラインのタスクキューポーリング間隔（秒）', '30', 'integer', '{"min": 10, "max": 300}'),
('MAX_RETRY_ATTEMPTS', '3', 'production', '外部API呼び出し失敗時の最大リトライ回数', '3', 'integer', '{"min": 1, "max": 10}'),
('RETRY_BACKOFF_BASE_SEC', '2', 'production', 'リトライ時の指数バックオフ基準秒数（実際の待機 = base × 2^attempt）', '2', 'integer', '{"min": 1, "max": 30}'),
('QUALITY_FILTER_THRESHOLD', '5.0', 'production', '品質スコアがこの値未満のスクリプトは制作をスキップ', '5.0', 'float', '{"min": 0, "max": 10}'),
('VIDEO_SECTION_TIMEOUT_SEC', '600', 'production', '動画セクション1つの制作タイムアウト（秒）。Kling生成〜リップシンクまで', '600', 'integer', '{"min": 120, "max": 1800}'),
('RETRY_JITTER_MAX_SEC', '1', 'production', 'リトライ時のジッター最大秒数。バックオフに加算するランダム遅延', '1', 'integer', '{"min": 0, "max": 10}'),
('MAX_CONTENT_REVISION_COUNT', '3', 'production', 'コンテンツの最大差し戻し回数。超過時はcancelledに遷移', '3', 'integer', '{"min": 1, "max": 10}'),
('WORKER_THROUGHPUT_PER_HOUR', '5', 'production', 'ワーカー1インスタンスあたりの1時間処理能力目安', '5', 'integer', '{"min": 1, "max": 20}'),
-- task_queue retry policy
('MAX_TASK_RETRIES', '3', 'production', 'タスクキューの最大リトライ回数', '3', 'integer', '{"min": 1, "max": 10}'),
('RETRY_DELAY_BASE_MS', '1000', 'production', 'リトライ時のベース遅延（ミリ秒）', '1000', 'integer', '{"min": 100, "max": 60000}'),
('RETRY_BACKOFF_MULTIPLIER', '2.0', 'production', 'リトライ時の指数バックオフ乗数', '2.0', 'float', '{"min": 1.0, "max": 5.0}'),
('RETRY_MAX_DELAY_MS', '300000', 'production', 'リトライ遅延の上限（ミリ秒、5分）', '300000', 'integer', '{"min": 10000, "max": 600000}');

-- Posting settings (8)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('POSTING_POLL_INTERVAL_SEC', '120', 'posting', '投稿スケジューラーのポーリング間隔（秒）', '120', 'integer', '{"min": 30, "max": 600}'),
('MAX_POSTS_PER_ACCOUNT_PER_DAY', '2', 'posting', 'アカウントあたりの1日最大投稿数。BAN回避のため控えめに設定', '2', 'integer', '{"min": 1, "max": 10}'),
('POSTING_TIME_JITTER_MIN', '5', 'posting', '投稿時刻のランダムずらし幅（分）。Bot検知回避', '5', 'integer', '{"min": 0, "max": 60}'),
('PLATFORM_COOLDOWN_HOURS', '24', 'posting', '同一アカウント・同一プラットフォームの投稿間の最小間隔（時間）', '24', 'integer', '{"min": 1, "max": 72}'),
-- platform rate limits
('YOUTUBE_DAILY_UPLOAD_LIMIT', '6', 'posting', 'YouTube日次アップロード上限（10,000 APIユニット / 1,600ユニットperアップロード）', '6', 'integer', '{"min": 1, "max": 50}'),
('TIKTOK_DAILY_UPLOAD_LIMIT', '50', 'posting', 'TikTok日次アップロード上限', '50', 'integer', '{"min": 1, "max": 200}'),
('INSTAGRAM_HOURLY_API_LIMIT', '25', 'posting', 'Instagram時間あたりAPI上限（Graph API 200リクエスト/時間の制限内）', '25', 'integer', '{"min": 1, "max": 200}'),
('X_DAILY_POST_LIMIT', '50', 'posting', 'X日次投稿上限', '50', 'integer', '{"min": 1, "max": 300}');

-- Review settings (4)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('HUMAN_REVIEW_ENABLED', 'true', 'review', 'コンテンツ投稿前に人間のレビューを要求するか', 'true', 'boolean', null),
('AUTO_APPROVE_SCORE_THRESHOLD', '8.0', 'review', 'HUMAN_REVIEW_ENABLED=true時でも、品質スコアがこの値以上なら自動承認', '8.0', 'float', '{"min": 0, "max": 10}'),
('STRATEGY_APPROVAL_REQUIRED', 'true', 'review', '戦略サイクルのポリシー決定に人間の承認を要求するか', 'true', 'boolean', null),
('RECIPE_APPROVAL_REQUIRED', 'true', 'review', '新しいプロダクションレシピの使用に人間の承認を要求するか', 'true', 'boolean', null);

-- Agent settings (43: 38 base + 3 character auto-generation + 2 micro-cycle learning)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('HYPOTHESIS_CYCLE_INTERVAL_HOURS', '24', 'agent', '仮説駆動サイクルの実行間隔（時間）。日次=24', '24', 'integer', '{"min": 6, "max": 168}'),
('RESEARCHER_POLL_INTERVAL_HOURS', '6', 'agent', 'リサーチャーの市場情報収集間隔（時間）', '6', 'integer', '{"min": 1, "max": 48}'),
('ANOMALY_DETECTION_SIGMA', '2.0', 'agent', '異常検知の標準偏差閾値。この倍数を超えるメトリクス変動をアラート', '2.0', 'float', '{"min": 1.0, "max": 5.0}'),
('ANOMALY_DETECTION_WINDOW_DAYS', '14', 'agent', '異常検知の基準期間（日）。この期間の平均・標準偏差を基準に判定', '14', 'integer', '{"min": 7, "max": 90}'),
('LEARNING_CONFIDENCE_THRESHOLD', '0.7', 'agent', '知見(learnings)の信頼度がこの値以上で有効とみなす', '0.7', 'float', '{"min": 0.1, "max": 1.0}'),
('LEARNING_AUTO_PROMOTE_COUNT', '10', 'agent', '知見が何回適用成功したら自動昇格（グローバル知見化）するか', '10', 'integer', '{"min": 3, "max": 50}'),
('COMPONENT_DUPLICATE_THRESHOLD', '0.9', 'agent', 'コンポーネント重複判定のコサイン類似度閾値', '0.9', 'float', '{"min": 0.7, "max": 1.0}'),
('PLANNER_ACCOUNTS_PER_INSTANCE', '50', 'agent', 'プランナー1インスタンスあたりの担当アカウント数', '50', 'integer', '{"min": 10, "max": 100}'),
('ANOMALY_MIN_DATAPOINTS', '7', 'agent', '異常検知に必要な最小データポイント数。これ未満のメトリクスは異常判定をスキップ', '7', 'integer', '{"min": 3, "max": 30}'),
('QUALITY_WEIGHT_COMPLETION', '0.35', 'agent', '品質スコア計算: 完視聴率の重み', '0.35', 'float', '{"min": 0, "max": 1}'),
('QUALITY_WEIGHT_ENGAGEMENT', '0.25', 'agent', '品質スコア計算: エンゲージメント率の重み', '0.25', 'float', '{"min": 0, "max": 1}'),
('QUALITY_WEIGHT_SHARE', '0.20', 'agent', '品質スコア計算: シェア率の重み', '0.20', 'float', '{"min": 0, "max": 1}'),
('QUALITY_WEIGHT_RETENTION', '0.15', 'agent', '品質スコア計算: リテンション率の重み', '0.15', 'float', '{"min": 0, "max": 1}'),
('QUALITY_WEIGHT_SENTIMENT', '0.05', 'agent', '品質スコア計算: センチメント分析の重み', '0.05', 'float', '{"min": 0, "max": 1}'),
('HYPOTHESIS_CONFIRM_THRESHOLD', '0.3', 'agent', '仮説検証: 予測と実測の誤差がこの値以内ならconfirmed', '0.3', 'float', '{"min": 0.05, "max": 0.5}'),
('HYPOTHESIS_INCONCLUSIVE_THRESHOLD', '0.5', 'agent', '仮説検証: 誤差がこの値以上ならinconclusive（確信度不足）', '0.5', 'float', '{"min": 0.2, "max": 0.8}'),
('LEARNING_DEACTIVATE_THRESHOLD', '0.2', 'agent', '学びの信頼度がこの値未満に下がったらis_active=falseに自動更新', '0.2', 'float', '{"min": 0.05, "max": 0.5}'),
('LEARNING_AUTO_PROMOTE_ENABLED', 'false', 'agent', '学びの自動昇格（グローバル知見化）を有効にするか', 'false', 'boolean', null),
('LEARNING_SUCCESS_INCREMENT', '0.1', 'agent', '学び適用成功時のconfidence増加量', '0.1', 'float', '{"min": 0.01, "max": 0.3}'),
('LEARNING_FAILURE_DECREMENT', '0.15', 'agent', '学び適用失敗時のconfidence減少量', '0.15', 'float', '{"min": 0.01, "max": 0.3}'),
('LEARNING_SIMILARITY_THRESHOLD', '0.8', 'agent', '重複学び検出のコサイン類似度閾値。この値以上で重複とみなす', '0.8', 'float', '{"min": 0.5, "max": 0.99}'),
('MAX_LEARNINGS_PER_CONTEXT', '20', 'agent', 'タスク実行時にベクトル検索で取得する学びの最大数', '20', 'integer', '{"min": 5, "max": 50}'),
('EXPLORATION_RATE', '0.15', 'agent', '探索率。この確率で過去の最適解ではなく新しいアプローチを試行', '0.15', 'float', '{"min": 0, "max": 0.5}'),
('EMBEDDING_MODEL', '"text-embedding-3-small"', 'agent', 'ベクトル埋め込みに使用するモデル', '"text-embedding-3-small"', 'string', null),
('EMBEDDING_DIMENSION', '1536', 'agent', 'ベクトル埋め込みの次元数', '1536', 'integer', '{"min": 256, "max": 3072}'),
('RECIPE_FAILURE_THRESHOLD', '3', 'agent', 'レシピの連続失敗回数がこの値に達したら使用を一時停止', '3', 'integer', '{"min": 1, "max": 10}'),
('RECIPE_MIN_SUCCESS_RATE', '0.8', 'agent', 'レシピの最低成功率。これ未満のレシピは推奨リストから除外', '0.8', 'float', '{"min": 0.5, "max": 1.0}'),
('RECIPE_MIN_QUALITY', '6.0', 'agent', 'レシピの最低平均品質スコア。これ未満のレシピは改善提案の対象', '6.0', 'float', '{"min": 1, "max": 10}'),
('CURATION_MIN_QUALITY', '4.0', 'agent', 'キュレーション自動承認の最低品質スコア。未満は人間レビュー', '4.0', 'float', '{"min": 1, "max": 10}'),
('CURATION_RETRY_VARIANTS', '2', 'agent', 'キュレーション品質不足時の再生成バリエーション数', '2', 'integer', '{"min": 1, "max": 5}'),
('CURATION_BATCH_SIZE', '10', 'agent', 'キュレーション1バッチあたりの処理件数', '10', 'integer', '{"min": 1, "max": 50}'),
('RESEARCHER_RETRY_INTERVAL_HOURS', '1', 'agent', 'リサーチャーの情報収集失敗時のリトライ間隔（時間）', '1', 'integer', '{"min": 1, "max": 24}'),
('HYPOTHESIS_DIVERSITY_WINDOW', '5', 'agent', '仮説多様性チェックの直近サイクル数。この範囲内で同カテゴリの仮説数を制限', '5', 'integer', '{"min": 1, "max": 20}'),
('HYPOTHESIS_SAME_CATEGORY_MAX', '3', 'agent', 'HYPOTHESIS_DIVERSITY_WINDOW内の同一カテゴリ仮説の最大数', '3', 'integer', '{"min": 1, "max": 10}'),
('ANALYSIS_MIN_SAMPLE_SIZE', '5', 'agent', '分析に必要な最小サンプルサイズ。未満の場合はinconclusive判定', '5', 'integer', '{"min": 2, "max": 20}'),
('PROMPT_SUGGEST_LOW_SCORE', '5', 'agent', 'プロンプト改善提案のトリガー: パフォーマンススコアがこの値以下', '5', 'integer', '{"min": 1, "max": 10}'),
('PROMPT_SUGGEST_HIGH_SCORE', '8', 'agent', 'プロンプト改善提案: この値以上のスコアでは提案しない', '8', 'integer', '{"min": 5, "max": 10}'),
('PROMPT_SUGGEST_FAILURE_COUNT', '3', 'agent', 'プロンプト改善提案のトリガー: 同一パターンの失敗がこの回数以上', '3', 'integer', '{"min": 1, "max": 10}'),
-- Character auto-generation settings (3)
('CHARACTER_AUTO_GENERATION_ENABLED', 'false', 'agent', 'データキュレーターによるキャラクター自動生成の有効化', 'false', 'boolean', null),
('CHARACTER_REVIEW_REQUIRED', 'true', 'agent', 'キュレーター生成キャラクターの人間レビュー必須フラグ', 'true', 'boolean', null),
('CHARACTER_GENERATION_CONFIDENCE_THRESHOLD', '0.8', 'agent', 'キャラクター自動生成の自信度閾値（これ以上で自動承認）', '0.8', 'float', '{"min": 0.0, "max": 1.0}'),
-- Micro-cycle learning settings (2)
('MICRO_ANALYSIS_MAX_DURATION_SEC', '30', 'agent', 'マイクロサイクル分析の最大所要時間（秒）。超過時はタイムアウトしてスキップ', '30', 'integer', '{"min": 10, "max": 120}'),
('CROSS_NICHE_LEARNING_THRESHOLD', '0.75', 'agent', 'クロスニッチ学習のコサイン類似度閾値。この値以上で他ニッチの学習を適用可能と判定', '0.75', 'float', '{"min": 0.5, "max": 1.0}');

-- Measurement settings (6)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('METRICS_COLLECTION_DELAY_HOURS', '48', 'measurement', 'コンテンツ投稿後、メトリクス収集開始までの遅延（時間）', '48', 'integer', '{"min": 24, "max": 168}'),
('METRICS_COLLECTION_RETRY_HOURS', '6', 'measurement', 'メトリクス収集失敗時のリトライ間隔（時間）', '6', 'integer', '{"min": 1, "max": 72}'),
('METRICS_MAX_COLLECTION_ATTEMPTS', '5', 'measurement', 'メトリクス収集の最大試行回数', '5', 'integer', '{"min": 1, "max": 20}'),
('MEASUREMENT_POLL_INTERVAL_SEC', '300', 'measurement', '計測ジョブのポーリング間隔（秒）', '300', 'integer', '{"min": 60, "max": 900}'),
('METRICS_BACKFILL_MAX_DAYS', '7', 'measurement', 'メトリクス遡及取得の最大日数', '7', 'integer', '{"min": 1, "max": 30}'),
('METRICS_FOLLOWUP_DAYS', '[7, 30]', 'measurement', 'フォローアップ計測を実施する日数（投稿後N日目）', '[7, 30]', 'json', null);

-- Cost control settings (4)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('DAILY_BUDGET_LIMIT_USD', '100', 'cost_control', '1日あたりの最大API支出（USD）。超過時は新規制作を停止', '100', 'float', '{"min": 10, "max": 10000}'),
('MONTHLY_BUDGET_LIMIT_USD', '3000', 'cost_control', '月間最大API支出（USD）。超過時は全制作を停止', '3000', 'float', '{"min": 100, "max": 300000}'),
('FAL_AI_BALANCE_ALERT_USD', '50', 'cost_control', 'fal.ai残高がこの値を下回ったらダッシュボードにアラート', '50', 'float', '{"min": 10, "max": 1000}'),
('COST_TRACKING_ENABLED', 'true', 'cost_control', 'API利用コストの自動追跡を有効にするか', 'true', 'boolean', null);

-- Dashboard settings (3)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('DASHBOARD_THEME', '"dark"', 'dashboard', 'ダッシュボードのカラーテーマ。dark=Solarized Dark, light=Solarized Light', '"dark"', 'enum', '{"options": ["dark", "light"]}'),
('DASHBOARD_ITEMS_PER_PAGE', '20', 'dashboard', '一覧画面のデフォルト表示件数', '20', 'integer', '{"min": 10, "max": 100}'),
('DASHBOARD_AUTO_REFRESH_SEC', '30', 'dashboard', 'ダッシュボードの自動リフレッシュ間隔（秒）。0=無効', '30', 'integer', '{"min": 0, "max": 300}');

-- Credential settings (5)
INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('CRED_FAL_AI_API_KEY', '""', 'credentials', 'fal.ai APIキー。ダッシュボードの設定画面から入力', '""', 'string', null),
('CRED_FISH_AUDIO_API_KEY', '""', 'credentials', 'Fish Audio APIキー。Plus plan ($11/month) 必須', '""', 'string', null),
('CRED_OPENAI_API_KEY', '""', 'credentials', 'OpenAI APIキー（Embedding用: text-embedding-3-small）', '""', 'string', null),
('CRED_ANTHROPIC_API_KEY', '""', 'credentials', 'Anthropic APIキー（Claude Opus/Sonnet）', '""', 'string', null),
('CRED_GOOGLE_SERVICE_ACCOUNT_KEY', '""', 'credentials', 'Google Cloud サービスアカウントキー（JSON）。Drive・Sheets API用', '""', 'string', null);
