-- Seed prediction_weights: 4 platforms × 9 factors = 36 rows
-- Initial weight = 1/9 ≈ 0.1111 (uniform distribution)

INSERT INTO prediction_weights (platform, factor_name, weight) VALUES
-- YouTube
('youtube', 'hook_type', 0.1111),
('youtube', 'content_length', 0.1111),
('youtube', 'post_hour', 0.1111),
('youtube', 'post_weekday', 0.1111),
('youtube', 'niche', 0.1111),
('youtube', 'narrative_structure', 0.1111),
('youtube', 'sound_bgm', 0.1111),
('youtube', 'hashtag_keyword', 0.1111),
('youtube', 'cross_account_performance', 0.1111),
-- TikTok
('tiktok', 'hook_type', 0.1111),
('tiktok', 'content_length', 0.1111),
('tiktok', 'post_hour', 0.1111),
('tiktok', 'post_weekday', 0.1111),
('tiktok', 'niche', 0.1111),
('tiktok', 'narrative_structure', 0.1111),
('tiktok', 'sound_bgm', 0.1111),
('tiktok', 'hashtag_keyword', 0.1111),
('tiktok', 'cross_account_performance', 0.1111),
-- Instagram
('instagram', 'hook_type', 0.1111),
('instagram', 'content_length', 0.1111),
('instagram', 'post_hour', 0.1111),
('instagram', 'post_weekday', 0.1111),
('instagram', 'niche', 0.1111),
('instagram', 'narrative_structure', 0.1111),
('instagram', 'sound_bgm', 0.1111),
('instagram', 'hashtag_keyword', 0.1111),
('instagram', 'cross_account_performance', 0.1111),
-- X (Twitter)
('x', 'hook_type', 0.1111),
('x', 'content_length', 0.1111),
('x', 'post_hour', 0.1111),
('x', 'post_weekday', 0.1111),
('x', 'niche', 0.1111),
('x', 'narrative_structure', 0.1111),
('x', 'sound_bgm', 0.1111),
('x', 'hashtag_keyword', 0.1111),
('x', 'cross_account_performance', 0.1111)
ON CONFLICT (platform, factor_name) DO NOTHING;
