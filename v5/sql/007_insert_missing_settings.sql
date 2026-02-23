-- Insert 6 missing system_settings rows (FEAT-DB-041)
-- These were missing from the initial seed migration

INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints) VALUES
('CHECKPOINT_RETENTION_DAYS', '7', 'production', 'LangGraphチェックポイントの保持日数。超過分は自動クリーンアップ', '7', 'integer', '{"min": 1, "max": 30}'),
('REQUIRE_AUTO_CURATION', 'true', 'review', 'trueの場合キュレーション結果を人間レビューパネルに表示。falseで自動承認', 'true', 'boolean', null),
('TOOL_SCORE_WEIGHT_SUCCESS', '0.4', 'agent', 'ツールランキング: 成功率の重み', '0.4', 'float', '{"min": 0, "max": 1}'),
('TOOL_SCORE_WEIGHT_QUALITY', '0.3', 'agent', 'ツールランキング: 品質スコアの重み', '0.3', 'float', '{"min": 0, "max": 1}'),
('TOOL_SCORE_WEIGHT_COST', '0.2', 'agent', 'ツールランキング: コスト効率の重み', '0.2', 'float', '{"min": 0, "max": 1}'),
('TOOL_SCORE_WEIGHT_RECENCY', '0.1', 'agent', 'ツールランキング: 直近使用ボーナスの重み', '0.1', 'float', '{"min": 0, "max": 1}')
ON CONFLICT (setting_key) DO NOTHING;
