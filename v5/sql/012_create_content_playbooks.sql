-- ============================================================
-- AI-Influencer v5.0 — content_playbooks table
-- コンテンツ型別制作指示書（Playbook）
-- Planner Agentがベクトル検索でコンテンツ方針に合った指示書を参照する
-- ============================================================

CREATE TABLE content_playbooks (
    id                      SERIAL PRIMARY KEY,
    playbook_name           TEXT NOT NULL,
    content_type            TEXT NOT NULL,
    content_format          TEXT NOT NULL CHECK (content_format IN ('short_video', 'text_post', 'image_post')),
    niche                   TEXT,
    platform                TEXT,
    markdown_content        TEXT NOT NULL,
    embedding               vector(1536),
    avg_effectiveness_score NUMERIC(4,2) CHECK (avg_effectiveness_score BETWEEN 0 AND 1),
    times_used              INTEGER NOT NULL DEFAULT 0,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_by              TEXT NOT NULL DEFAULT 'human' CHECK (created_by IN ('human', 'agent')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (playbook_name)
);

COMMENT ON TABLE content_playbooks IS 'コンテンツ型別制作指示書。Plannerがベクトル検索で参照';
COMMENT ON COLUMN content_playbooks.embedding IS 'pgvectorによる類似検索用。1536次元';

-- ベクトル検索インデックス
CREATE INDEX idx_content_playbooks_embedding ON content_playbooks USING HNSW (embedding vector_cosine_ops);

-- フィルタ用インデックス
CREATE INDEX idx_content_playbooks_content_type ON content_playbooks (content_type);
CREATE INDEX idx_content_playbooks_format       ON content_playbooks (content_format);
CREATE INDEX idx_content_playbooks_niche        ON content_playbooks (niche);
CREATE INDEX idx_content_playbooks_active       ON content_playbooks (is_active) WHERE is_active = true;

-- updated_at auto-update trigger
CREATE TRIGGER trg_content_playbooks_updated_at
    BEFORE UPDATE ON content_playbooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
