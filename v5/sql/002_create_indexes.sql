-- ============================================================
-- AI-Influencer v5.0 — Index Definitions
-- Generated from docs/v5-specification/03-database-schema.md Section 8
-- ============================================================

-- ========================================
-- 8.1 Entity Tables
-- ========================================

-- accounts
CREATE INDEX idx_accounts_platform ON accounts(platform);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_character ON accounts(character_id);
CREATE INDEX idx_accounts_niche ON accounts(niche);
CREATE INDEX idx_accounts_cluster ON accounts(cluster);
CREATE INDEX idx_accounts_platform_status ON accounts(platform, status);

-- characters
-- NOTE: character_id UNIQUE constraint auto-creates an index
CREATE INDEX idx_characters_status ON characters(status);
CREATE INDEX idx_characters_created_by ON characters(created_by);

-- components
CREATE INDEX idx_components_type ON components(type);
CREATE INDEX idx_components_type_subtype ON components(type, subtype);
CREATE INDEX idx_components_niche ON components(niche);
CREATE INDEX idx_components_score ON components(score DESC NULLS LAST);
CREATE INDEX idx_components_tags ON components USING GIN(tags);
CREATE INDEX idx_components_review_status ON components(review_status);
CREATE INDEX idx_components_curated_by ON components(curated_by);

-- ========================================
-- 8.2 Production Tables
-- ========================================

-- content
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_planned_date ON content(planned_post_date);
CREATE INDEX idx_content_status_planned_date ON content(status, planned_post_date);
CREATE INDEX idx_content_hypothesis ON content(hypothesis_id);
CREATE INDEX idx_content_character ON content(character_id);
CREATE INDEX idx_content_created_at ON content(created_at);
CREATE INDEX idx_content_format ON content(content_format);
CREATE INDEX idx_content_format_status ON content(content_format, status);
CREATE INDEX idx_content_recipe ON content(recipe_id);
CREATE INDEX idx_content_production_metadata ON content USING GIN(production_metadata);
CREATE INDEX idx_content_review_status ON content(review_status);
CREATE INDEX idx_content_quality_score ON content(quality_score DESC NULLS LAST);

-- content_sections
CREATE INDEX idx_content_sections_content ON content_sections(content_id);
CREATE INDEX idx_content_sections_component ON content_sections(component_id);

-- publications
CREATE INDEX idx_publications_content ON publications(content_id);
CREATE INDEX idx_publications_account ON publications(account_id);
CREATE INDEX idx_publications_platform ON publications(platform);
CREATE INDEX idx_publications_status ON publications(status);
CREATE INDEX idx_publications_posted_at ON publications(posted_at);
CREATE INDEX idx_publications_measure_after ON publications(measure_after);
CREATE INDEX idx_publications_status_measure ON publications(status, measure_after);

-- ========================================
-- 8.3 Intelligence Tables
-- ========================================

-- hypotheses
CREATE INDEX idx_hypotheses_cycle ON hypotheses(cycle_id);
CREATE INDEX idx_hypotheses_verdict ON hypotheses(verdict);
CREATE INDEX idx_hypotheses_category ON hypotheses(category);
CREATE INDEX idx_hypotheses_source ON hypotheses(source);
CREATE INDEX idx_hypotheses_created_at ON hypotheses(created_at);
CREATE INDEX idx_hypotheses_verdict_category ON hypotheses(verdict, category);
CREATE INDEX idx_hypotheses_predicted_kpis ON hypotheses USING GIN(predicted_kpis);
CREATE INDEX idx_hypotheses_actual_kpis ON hypotheses USING GIN(actual_kpis);

-- hypotheses vector index (HNSW)
CREATE INDEX idx_hypotheses_embedding ON hypotheses
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- market_intel
CREATE INDEX idx_market_intel_type ON market_intel(intel_type);
CREATE INDEX idx_market_intel_platform ON market_intel(platform);
CREATE INDEX idx_market_intel_niche ON market_intel(niche);
CREATE INDEX idx_market_intel_collected_at ON market_intel(collected_at);
CREATE INDEX idx_market_intel_expires_at ON market_intel(expires_at);
CREATE INDEX idx_market_intel_relevance ON market_intel(relevance_score DESC NULLS LAST);
CREATE INDEX idx_market_intel_type_platform ON market_intel(intel_type, platform);
CREATE INDEX idx_market_intel_data ON market_intel USING GIN(data);

-- market_intel vector index (HNSW)
CREATE INDEX idx_market_intel_embedding ON market_intel
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- metrics
CREATE INDEX idx_metrics_publication ON metrics(publication_id);
CREATE INDEX idx_metrics_measured_at ON metrics(measured_at);
CREATE INDEX idx_metrics_raw_data ON metrics USING GIN(raw_data);

-- analyses
CREATE INDEX idx_analyses_cycle ON analyses(cycle_id);
CREATE INDEX idx_analyses_type ON analyses(analysis_type);
CREATE INDEX idx_analyses_created_at ON analyses(created_at);
CREATE INDEX idx_analyses_affected ON analyses USING GIN(affected_hypotheses);

-- learnings
CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_confidence ON learnings(confidence DESC);
CREATE INDEX idx_learnings_applicable_niches ON learnings USING GIN(applicable_niches);
CREATE INDEX idx_learnings_applicable_platforms ON learnings USING GIN(applicable_platforms);
CREATE INDEX idx_learnings_created_at ON learnings(created_at);

-- learnings vector index (HNSW)
CREATE INDEX idx_learnings_embedding ON learnings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- content_learnings
CREATE INDEX idx_content_learnings_niche ON content_learnings(niche);
CREATE INDEX idx_content_learnings_micro_verdict ON content_learnings(micro_verdict);
CREATE INDEX idx_content_learnings_created_at ON content_learnings(created_at);

-- content_learnings vector index (HNSW)
CREATE INDEX idx_content_learnings_embedding ON content_learnings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ========================================
-- 8.4 Operations Tables
-- ========================================

-- cycles
CREATE INDEX idx_cycles_status ON cycles(status);
CREATE INDEX idx_cycles_cycle_number ON cycles(cycle_number);
CREATE INDEX idx_cycles_started_at ON cycles(started_at);

-- human_directives
CREATE INDEX idx_directives_status ON human_directives(status);
CREATE INDEX idx_directives_type ON human_directives(directive_type);
CREATE INDEX idx_directives_priority ON human_directives(priority);
CREATE INDEX idx_directives_status_priority ON human_directives(status, priority);
CREATE INDEX idx_directives_target_accounts ON human_directives USING GIN(target_accounts);
CREATE INDEX idx_directives_target_niches ON human_directives USING GIN(target_niches);
CREATE INDEX idx_directives_created_at ON human_directives(created_at);

-- task_queue
CREATE INDEX idx_task_queue_status ON task_queue(status);
CREATE INDEX idx_task_queue_type ON task_queue(task_type);
CREATE INDEX idx_task_queue_type_status ON task_queue(task_type, status);
CREATE INDEX idx_task_queue_priority ON task_queue(priority DESC, created_at ASC);
CREATE INDEX idx_task_queue_status_priority ON task_queue(status, priority DESC, created_at ASC);
CREATE INDEX idx_task_queue_created_at ON task_queue(created_at);
CREATE INDEX idx_task_queue_payload ON task_queue USING GIN(payload);

-- task_queue: partial index for retry/failure monitoring
CREATE INDEX idx_task_queue_status_retry ON task_queue(status) WHERE status IN ('retrying', 'failed_permanent');

-- algorithm_performance
CREATE INDEX idx_algorithm_perf_measured_at ON algorithm_performance(measured_at);
CREATE INDEX idx_algorithm_perf_period ON algorithm_performance(period);
CREATE INDEX idx_algorithm_perf_period_measured ON algorithm_performance(period, measured_at);

-- ========================================
-- 8.5 Observability Tables
-- ========================================

-- agent_prompt_versions
CREATE INDEX idx_prompt_versions_agent_active ON agent_prompt_versions(agent_type, active);
CREATE INDEX idx_prompt_versions_agent_version ON agent_prompt_versions(agent_type, version);
CREATE INDEX idx_prompt_versions_created_at ON agent_prompt_versions(created_at);

-- agent_thought_logs
CREATE INDEX idx_thought_logs_agent_created ON agent_thought_logs(agent_type, created_at);
CREATE INDEX idx_thought_logs_cycle ON agent_thought_logs(cycle_id);
CREATE INDEX idx_thought_logs_graph_node ON agent_thought_logs(graph_name, node_name);
CREATE INDEX idx_thought_logs_created_at ON agent_thought_logs(created_at);
CREATE INDEX idx_thought_logs_tools_used ON agent_thought_logs USING GIN(tools_used);
CREATE INDEX idx_thought_logs_token_usage ON agent_thought_logs USING GIN(token_usage);

-- agent_reflections
CREATE INDEX idx_reflections_agent_created ON agent_reflections(agent_type, created_at);
CREATE INDEX idx_reflections_cycle ON agent_reflections(cycle_id);
CREATE INDEX idx_reflections_self_score ON agent_reflections(self_score);

-- agent_individual_learnings
CREATE INDEX idx_individual_learnings_agent_active ON agent_individual_learnings(agent_type, is_active);
CREATE INDEX idx_individual_learnings_agent_category ON agent_individual_learnings(agent_type, category);
CREATE INDEX idx_individual_learnings_source_reflection ON agent_individual_learnings(source_reflection_id);

-- agent_individual_learnings vector index (HNSW)
CREATE INDEX idx_individual_learnings_embedding ON agent_individual_learnings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- agent_communications
CREATE INDEX idx_agent_communications_cycle ON agent_communications(cycle_id);
CREATE INDEX idx_communications_status_created ON agent_communications(status, created_at);
CREATE INDEX idx_communications_agent_type ON agent_communications(agent_type, message_type);
CREATE INDEX idx_communications_priority_status ON agent_communications(priority, status);
CREATE INDEX idx_communications_created_at ON agent_communications(created_at);

-- ========================================
-- 8.6 Tool Management Tables
-- ========================================

-- tool_catalog
CREATE INDEX idx_tool_catalog_type ON tool_catalog(tool_type);
CREATE INDEX idx_tool_catalog_provider ON tool_catalog(provider);
CREATE INDEX idx_tool_catalog_active ON tool_catalog(is_active);
CREATE INDEX idx_tool_catalog_type_active ON tool_catalog(tool_type, is_active);
CREATE INDEX idx_tool_catalog_strengths ON tool_catalog USING GIN(strengths);
CREATE INDEX idx_tool_catalog_quirks ON tool_catalog USING GIN(quirks);

-- tool_experiences
CREATE INDEX idx_tool_experiences_tool ON tool_experiences(tool_id);
CREATE INDEX idx_tool_experiences_content ON tool_experiences(content_id);
CREATE INDEX idx_tool_experiences_content_type_quality ON tool_experiences(content_type, quality_score);
CREATE INDEX idx_tool_experiences_success ON tool_experiences(success);
CREATE INDEX idx_tool_experiences_created_at ON tool_experiences(created_at);

-- tool_external_sources
CREATE INDEX idx_tool_external_sources_type ON tool_external_sources(source_type);
CREATE INDEX idx_tool_external_sources_tool ON tool_external_sources(tool_id);
CREATE INDEX idx_tool_external_sources_fetched ON tool_external_sources(fetched_at);

-- tool_external_sources vector index (HNSW)
CREATE INDEX idx_tool_external_sources_embedding ON tool_external_sources
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- production_recipes
CREATE INDEX idx_recipes_format_platform ON production_recipes(content_format, target_platform);
CREATE INDEX idx_recipes_active ON production_recipes(is_active);
CREATE INDEX idx_recipes_default ON production_recipes(is_default, content_format);
CREATE INDEX idx_recipes_quality ON production_recipes(avg_quality_score DESC NULLS LAST);
CREATE INDEX idx_recipes_recommended ON production_recipes USING GIN(recommended_for);

-- prompt_suggestions
CREATE INDEX idx_prompt_suggestions_agent_status ON prompt_suggestions(agent_type, status);
CREATE INDEX idx_prompt_suggestions_status ON prompt_suggestions(status);
CREATE INDEX idx_prompt_suggestions_trigger ON prompt_suggestions(trigger_type);
CREATE INDEX idx_prompt_suggestions_created_at ON prompt_suggestions(created_at);

-- ========================================
-- 8.7 System Management Tables
-- ========================================

-- system_settings
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_updated_at ON system_settings(updated_at);
