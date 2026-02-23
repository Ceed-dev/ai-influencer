-- content_learnings table (missing from initial migration)
-- Spec: 03-database-schema.md §3.6

CREATE TABLE IF NOT EXISTS content_learnings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id      VARCHAR(20) NOT NULL REFERENCES content(content_id),
    hypothesis_id   INTEGER REFERENCES hypotheses(id),
    predicted_kpis  JSONB NOT NULL,
    actual_kpis     JSONB NOT NULL,
    prediction_error FLOAT NOT NULL,
    micro_verdict   TEXT NOT NULL CHECK (micro_verdict IN ('confirmed', 'inconclusive', 'rejected')),
    contributing_factors TEXT[],
    detractors      TEXT[],
    what_worked     TEXT[],
    what_didnt_work TEXT[],
    key_insight     TEXT,
    applicable_to   TEXT[],
    confidence      FLOAT NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0.0 AND 1.0),
    cumulative_context  JSONB,
    promoted_to_learning_id INTEGER REFERENCES learnings(id),
    similar_past_learnings_referenced INTEGER NOT NULL DEFAULT 0,
    embedding       vector(1536),
    niche           VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_learnings_embedding ON content_learnings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_content_learnings_niche ON content_learnings (niche);
CREATE INDEX IF NOT EXISTS idx_content_learnings_verdict ON content_learnings (micro_verdict);
CREATE INDEX IF NOT EXISTS idx_content_learnings_created ON content_learnings (created_at);

COMMENT ON TABLE content_learnings IS 'コンテンツ単位のマイクロサイクル学習。per-content学習の核心データストア';
COMMENT ON COLUMN content_learnings.embedding IS 'ベクトル検索用。次のコンテンツ計画時にsearch_content_learningsで即座に検索';
COMMENT ON COLUMN content_learnings.micro_verdict IS 'confirmed/inconclusive/rejected';
COMMENT ON COLUMN content_learnings.promoted_to_learning_id IS '共有知見への昇格追跡。昇格済みならlearnings.idを格納';
COMMENT ON COLUMN content_learnings.cumulative_context IS '7d計測後の累積分析結果。pgvector 5テーブル検索の構造化集計 + AI解釈';
