-- ============================================================
-- AI-Influencer v5.0 — Trigger Definitions
-- Generated from docs/v5-specification/03-database-schema.md Section 9
-- ============================================================
-- Auto-update `updated_at` column on record modification
-- for all tables that have an `updated_at` column.
-- ============================================================

-- Generic trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Entity Tables
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_components_updated_at
    BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Production Tables
CREATE TRIGGER trg_content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_content_sections_updated_at
    BEFORE UPDATE ON content_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_publications_updated_at
    BEFORE UPDATE ON publications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Intelligence Tables
CREATE TRIGGER trg_hypotheses_updated_at
    BEFORE UPDATE ON hypotheses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_learnings_updated_at
    BEFORE UPDATE ON learnings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Observability Tables
CREATE TRIGGER trg_agent_individual_learnings_updated_at
    BEFORE UPDATE ON agent_individual_learnings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tool Management Tables
CREATE TRIGGER trg_tool_catalog_updated_at
    BEFORE UPDATE ON tool_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_production_recipes_updated_at
    BEFORE UPDATE ON production_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- System Management Tables
CREATE TRIGGER trg_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
