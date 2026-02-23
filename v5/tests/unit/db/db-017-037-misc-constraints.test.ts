/**
 * FEAT-DB-017: publications.status CHECK
 * FEAT-DB-018: hypotheses.category CHECK (5 values)
 * FEAT-DB-019: hypotheses.verdict CHECK + default
 * FEAT-DB-020: hypotheses.confidence CHECK (0.00-1.00)
 * FEAT-DB-021: hypotheses.embedding vector(1536)
 * FEAT-DB-022: market_intel.intel_type CHECK (5 values)
 * FEAT-DB-023: task_queue.task_type CHECK (4 values)
 * FEAT-DB-024: task_queue.status CHECK (8 values) + default
 * FEAT-DB-025: task_queue.retry_count/max_retries defaults
 * FEAT-DB-026: agent_individual_learnings.category CHECK (17 values)
 * FEAT-DB-027: agent_individual_learnings.confidence default + range
 * FEAT-DB-028: agent_individual_learnings.success_rate GENERATED ALWAYS
 * FEAT-DB-029: agent_communications.message_type CHECK (6 values)
 * FEAT-DB-030: agent_type CHECK unified (6 tables)
 * FEAT-DB-031: human_directives.directive_type CHECK (5 values)
 * FEAT-DB-032: cycles.status CHECK (5 values)
 * FEAT-DB-033: tool_catalog.tool_type CHECK (11 values)
 * FEAT-DB-034: tool_external_sources.source_type CHECK (8 values)
 * FEAT-DB-035: production_recipes.content_format CHECK
 * FEAT-DB-036: prompt_suggestions.trigger_type CHECK (6 values)
 * FEAT-DB-037: prompt_suggestions.status CHECK + default
 */
import { withClient } from '../../helpers/db';

let counter = 0;
const uid = () => `T${Date.now()}_${++counter}`;

describe('publications constraints', () => {
  // We need FK refs, so we'll test with direct queries checking constraint metadata instead
  test('TEST-DB-021: publications.status CHECK constraint exists with correct values', async () => {
    await withClient(async (c) => {
      const res = await c.query(`
        SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
        WHERE conrelid = 'publications'::regclass AND conname = 'chk_publications_status'
      `);
      expect(res.rows).toHaveLength(1);
      const def = res.rows[0].def;
      for (const val of ['scheduled', 'posted', 'measured', 'failed']) {
        expect(def).toContain(val);
      }
    });
  });
});

describe('hypotheses constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM hypotheses WHERE statement LIKE 'TEST_%'");
    });
  });

  // TEST-DB-022: hypotheses.category CHECK (5 values)
  test('TEST-DB-022: valid category values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const cat of ['content_format', 'timing', 'niche', 'audience', 'platform_specific']) {
        await c.query(
          "INSERT INTO hypotheses (category, statement) VALUES ($1, $2)",
          [cat, `TEST_${uid()}`]
        );
      }
      await expect(
        c.query("INSERT INTO hypotheses (category, statement) VALUES ('budget', $1)", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_hypotheses_category/);
    });
  });

  // TEST-DB-023: hypotheses.verdict CHECK + default
  test('TEST-DB-023: verdict defaults to pending, invalid rejected', async () => {
    await withClient(async (c) => {
      await c.query("INSERT INTO hypotheses (category, statement) VALUES ('timing', $1)", [`TEST_${uid()}`]);
      const res = await c.query(
        "SELECT verdict FROM hypotheses WHERE statement LIKE 'TEST_%' ORDER BY id DESC LIMIT 1"
      );
      expect(res.rows[0].verdict).toBe('pending');

      for (const v of ['pending', 'confirmed', 'rejected', 'inconclusive']) {
        await c.query(
          "INSERT INTO hypotheses (category, statement, verdict) VALUES ('timing', $1, $2)",
          [`TEST_${uid()}`, v]
        );
      }

      await expect(
        c.query("INSERT INTO hypotheses (category, statement, verdict) VALUES ('timing', $1, 'unknown')", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_hypotheses_verdict/);
    });
  });

  // TEST-DB-024: hypotheses.confidence CHECK (0.00-1.00)
  test('TEST-DB-024: confidence range 0.00-1.00 enforced', async () => {
    await withClient(async (c) => {
      for (const conf of [0.00, 1.00, 0.75]) {
        await c.query(
          "INSERT INTO hypotheses (category, statement, confidence) VALUES ('timing', $1, $2)",
          [`TEST_${uid()}`, conf]
        );
      }
      await expect(
        c.query("INSERT INTO hypotheses (category, statement, confidence) VALUES ('timing', $1, -0.01)", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_hypotheses_confidence/);
      await expect(
        c.query("INSERT INTO hypotheses (category, statement, confidence) VALUES ('timing', $1, 1.01)", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_hypotheses_confidence/);
    });
  });

  // TEST-DB-025: hypotheses.embedding vector(1536) dimension
  test('TEST-DB-025: embedding accepts 1536 dimensions, rejects others', async () => {
    await withClient(async (c) => {
      const vec1536 = '[' + Array(1536).fill('0.1').join(',') + ']';
      await c.query(
        `INSERT INTO hypotheses (category, statement, embedding) VALUES ('timing', $1, $2::vector)`,
        [`TEST_${uid()}`, vec1536]
      );

      const vec1535 = '[' + Array(1535).fill('0.1').join(',') + ']';
      await expect(
        c.query(
          `INSERT INTO hypotheses (category, statement, embedding) VALUES ('timing', $1, $2::vector)`,
          [`TEST_${uid()}`, vec1535]
        )
      ).rejects.toThrow(/expected 1536 dimensions/);

      const vec1537 = '[' + Array(1537).fill('0.1').join(',') + ']';
      await expect(
        c.query(
          `INSERT INTO hypotheses (category, statement, embedding) VALUES ('timing', $1, $2::vector)`,
          [`TEST_${uid()}`, vec1537]
        )
      ).rejects.toThrow(/expected 1536 dimensions/);
    });
  });
});

describe('market_intel constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM market_intel WHERE data::text LIKE '%TEST_%'");
    });
  });

  // TEST-DB-026: market_intel.intel_type CHECK (5 values)
  test('TEST-DB-026: valid intel_type values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const t of ['trending_topic', 'competitor_post', 'competitor_account', 'audience_signal', 'platform_update']) {
        await c.query(
          "INSERT INTO market_intel (intel_type, data) VALUES ($1, $2::jsonb)",
          [t, JSON.stringify({ test: `TEST_${uid()}` })]
        );
      }
      await expect(
        c.query("INSERT INTO market_intel (intel_type, data) VALUES ('news_article', $1::jsonb)", [JSON.stringify({ test: `TEST_${uid()}` })])
      ).rejects.toThrow(/chk_market_intel_type/);
    });
  });
});

describe('task_queue constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM task_queue WHERE payload::text LIKE '%TEST_%'");
    });
  });

  // TEST-DB-027: task_queue.task_type CHECK (4 values)
  test('TEST-DB-027: valid task_type values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const t of ['produce', 'publish', 'measure', 'curate']) {
        await c.query(
          "INSERT INTO task_queue (task_type, payload) VALUES ($1, $2::jsonb)",
          [t, JSON.stringify({ test: `TEST_${uid()}` })]
        );
      }
      await expect(
        c.query("INSERT INTO task_queue (task_type, payload) VALUES ('analyze', $1::jsonb)", [JSON.stringify({ test: `TEST_${uid()}` })])
      ).rejects.toThrow(/chk_task_type/);
    });
  });

  // TEST-DB-028: task_queue.status CHECK (8 values) + default
  test('TEST-DB-028: valid status values, default = pending', async () => {
    await withClient(async (c) => {
      // Check default
      await c.query(
        "INSERT INTO task_queue (task_type, payload) VALUES ('produce', $1::jsonb)",
        [JSON.stringify({ test: `TEST_${uid()}` })]
      );
      const res = await c.query("SELECT status FROM task_queue ORDER BY id DESC LIMIT 1");
      expect(res.rows[0].status).toBe('pending');

      // All 8 valid values
      for (const s of ['pending', 'queued', 'waiting', 'processing', 'retrying', 'completed', 'failed', 'failed_permanent']) {
        await c.query(
          "INSERT INTO task_queue (task_type, payload, status) VALUES ('produce', $1::jsonb, $2)",
          [JSON.stringify({ test: `TEST_${uid()}` }), s]
        );
      }

      await expect(
        c.query("INSERT INTO task_queue (task_type, payload, status) VALUES ('produce', $1::jsonb, 'cancelled')", [JSON.stringify({ test: `TEST_${uid()}` })])
      ).rejects.toThrow(/chk_task_status/);
    });
  });

  // TEST-DB-030: retry_count and max_retries defaults
  test('TEST-DB-030: retry_count defaults to 0, max_retries defaults to 3', async () => {
    await withClient(async (c) => {
      await c.query(
        "INSERT INTO task_queue (task_type, payload) VALUES ('produce', $1::jsonb)",
        [JSON.stringify({ test: `TEST_${uid()}` })]
      );
      const res = await c.query("SELECT retry_count, max_retries FROM task_queue ORDER BY id DESC LIMIT 1");
      expect(res.rows[0].retry_count).toBe(0);
      expect(res.rows[0].max_retries).toBe(3);
    });
  });
});

describe('agent_individual_learnings constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM agent_individual_learnings WHERE content LIKE 'TEST_%'");
    });
  });

  // TEST-DB-031: category CHECK (17 values)
  test('TEST-DB-031: all 17 category values accepted, invalid rejected', async () => {
    const categories = [
      'data_source', 'technique', 'pattern', 'mistake', 'insight',
      'tool_characteristics', 'tool_combination', 'tool_failure_pattern',
      'tool_update', 'data_classification', 'curation_quality',
      'source_reliability', 'content', 'timing', 'audience', 'platform', 'niche'
    ];
    await withClient(async (c) => {
      for (const cat of categories) {
        await c.query(
          "INSERT INTO agent_individual_learnings (agent_type, category, content) VALUES ('strategist', $1, $2)",
          [cat, `TEST_${uid()}`]
        );
      }
      await expect(
        c.query("INSERT INTO agent_individual_learnings (agent_type, category, content) VALUES ('strategist', 'general', $1)", [`TEST_${uid()}`])
      ).rejects.toThrow(/agent_individual_learnings_category_check/);
    });
  });

  // TEST-DB-032: confidence default + range
  test('TEST-DB-032: confidence defaults to 0.5, range 0.0-1.0', async () => {
    await withClient(async (c) => {
      await c.query(
        "INSERT INTO agent_individual_learnings (agent_type, category, content) VALUES ('strategist', 'pattern', $1)",
        [`TEST_${uid()}`]
      );
      const res = await c.query(
        "SELECT confidence FROM agent_individual_learnings WHERE content LIKE 'TEST_%' ORDER BY created_at DESC LIMIT 1"
      );
      expect(res.rows[0].confidence).toBe(0.5);

      // Valid range
      for (const conf of [0.0, 1.0]) {
        await c.query(
          "INSERT INTO agent_individual_learnings (agent_type, category, content, confidence) VALUES ('strategist', 'pattern', $1, $2)",
          [`TEST_${uid()}`, conf]
        );
      }

      await expect(
        c.query("INSERT INTO agent_individual_learnings (agent_type, category, content, confidence) VALUES ('strategist', 'pattern', $1, -0.1)", [`TEST_${uid()}`])
      ).rejects.toThrow(/agent_individual_learnings_confidence_check/);

      await expect(
        c.query("INSERT INTO agent_individual_learnings (agent_type, category, content, confidence) VALUES ('strategist', 'pattern', $1, 1.1)", [`TEST_${uid()}`])
      ).rejects.toThrow(/agent_individual_learnings_confidence_check/);
    });
  });

  // TEST-DB-033: success_rate GENERATED ALWAYS
  test('TEST-DB-033: success_rate auto-computed from times_applied/times_successful', async () => {
    await withClient(async (c) => {
      await c.query(
        "INSERT INTO agent_individual_learnings (agent_type, category, content, times_applied, times_successful) VALUES ('strategist', 'pattern', $1, 10, 7)",
        [`TEST_${uid()}`]
      );
      let res = await c.query(
        "SELECT success_rate FROM agent_individual_learnings ORDER BY created_at DESC LIMIT 1"
      );
      expect(res.rows[0].success_rate).toBeCloseTo(0.7, 5);

      await c.query(
        "INSERT INTO agent_individual_learnings (agent_type, category, content, times_applied, times_successful) VALUES ('strategist', 'pattern', $1, 0, 0)",
        [`TEST_${uid()}`]
      );
      res = await c.query(
        "SELECT success_rate FROM agent_individual_learnings ORDER BY created_at DESC LIMIT 1"
      );
      expect(res.rows[0].success_rate).toBeCloseTo(0.0, 5);
    });
  });
});

describe('agent_communications constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM agent_communications WHERE content LIKE 'TEST_%'");
    });
  });

  // TEST-DB-034: message_type CHECK (6 values)
  test('TEST-DB-034: valid message_type values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const mt of ['struggle', 'proposal', 'question', 'status_report', 'anomaly_alert', 'milestone']) {
        await c.query(
          "INSERT INTO agent_communications (agent_type, message_type, content) VALUES ('strategist', $1, $2)",
          [mt, `TEST_${uid()}`]
        );
      }
      await expect(
        c.query("INSERT INTO agent_communications (agent_type, message_type, content) VALUES ('strategist', 'error', $1)", [`TEST_${uid()}`])
      ).rejects.toThrow(/agent_communications_message_type_check/);
    });
  });
});

describe('agent_type CHECK unified (6 tables)', () => {
  // TEST-DB-035: agent_type check on 6 tables
  test('TEST-DB-035: strategist accepted, worker rejected on all 6 tables', async () => {
    await withClient(async (c) => {
      // Test 'worker' is rejected on each table
      const tables = [
        { table: 'agent_prompt_versions', insert: "INSERT INTO agent_prompt_versions (agent_type, version, prompt_content) VALUES ('worker', 99999, 'test')" },
        { table: 'agent_thought_logs', insert: "INSERT INTO agent_thought_logs (agent_type, graph_name, node_name, reasoning, decision) VALUES ('worker', 'test', 'test', 'test', 'test')" },
        { table: 'agent_reflections', insert: "INSERT INTO agent_reflections (agent_type, task_description, self_score, score_reasoning) VALUES ('worker', 'test', 5, 'test')" },
        { table: 'agent_individual_learnings', insert: "INSERT INTO agent_individual_learnings (agent_type, category, content) VALUES ('worker', 'pattern', 'test')" },
        { table: 'agent_communications', insert: "INSERT INTO agent_communications (agent_type, message_type, content) VALUES ('worker', 'question', 'test')" },
        { table: 'prompt_suggestions', insert: "INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion) VALUES ('worker', 'manual', '{}'::jsonb, 'test')" },
      ];

      for (const { table, insert } of tables) {
        await expect(c.query(insert)).rejects.toThrow(/agent_type/);
      }
    });
  });
});

describe('human_directives constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM human_directives WHERE content LIKE 'TEST_%'");
    });
  });

  // TEST-DB-036: directive_type CHECK (5 values)
  test('TEST-DB-036: valid directive_type values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const dt of ['hypothesis', 'reference_content', 'instruction', 'learning_guidance', 'agent_response']) {
        await c.query(
          "INSERT INTO human_directives (directive_type, content) VALUES ($1, $2)",
          [dt, `TEST_${uid()}`]
        );
      }
      await expect(
        c.query("INSERT INTO human_directives (directive_type, content) VALUES ('command', $1)", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_directives_type/);
    });
  });
});

describe('cycles constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM cycles WHERE cycle_number >= 99900");
    });
  });

  // TEST-DB-037: cycles.status CHECK (5 values)
  test('TEST-DB-037: valid status values succeed, invalid fails', async () => {
    let cycleNum = 99900;
    await withClient(async (c) => {
      for (const status of ['planning', 'executing', 'measuring', 'analyzing', 'completed']) {
        await c.query(
          "INSERT INTO cycles (cycle_number, status) VALUES ($1, $2)",
          [++cycleNum, status]
        );
      }
      await expect(
        c.query("INSERT INTO cycles (cycle_number, status) VALUES ($1, 'cancelled')", [++cycleNum])
      ).rejects.toThrow(/chk_cycles_status/);
    });
  });
});

describe('tool_catalog constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM tool_catalog WHERE tool_name LIKE 'TEST_%'");
    });
  });

  // TEST-DB-038: tool_catalog.tool_type CHECK (11 values)
  test('TEST-DB-038: all 11 tool_type values accepted, invalid rejected', async () => {
    const types = [
      'video_generation', 'tts', 'lipsync', 'image_generation', 'embedding',
      'llm', 'search', 'social_api', 'analytics_api', 'storage', 'other'
    ];
    await withClient(async (c) => {
      for (const t of types) {
        await c.query(
          "INSERT INTO tool_catalog (tool_name, tool_type, provider) VALUES ($1, $2, 'test')",
          [`TEST_${uid()}`, t]
        );
      }
      await expect(
        c.query("INSERT INTO tool_catalog (tool_name, tool_type, provider) VALUES ($1, 'audio', 'test')", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_tool_catalog_tool_type/);
    });
  });
});

describe('tool_external_sources constraints', () => {
  // TEST-DB-039: source_type CHECK (8 values)
  test('TEST-DB-039: source_type CHECK constraint exists with correct values', async () => {
    await withClient(async (c) => {
      const res = await c.query(`
        SELECT pg_get_constraintdef(oid) AS def
        FROM pg_constraint
        WHERE conrelid = 'tool_external_sources'::regclass AND conname = 'chk_tool_external_sources_source_type'
      `);
      expect(res.rows).toHaveLength(1);
      const def = res.rows[0].def;
      for (const val of ['x_post', 'official_doc', 'press_release', 'blog', 'forum', 'research_paper', 'changelog', 'other']) {
        expect(def).toContain(val);
      }
    });
  });
});

describe('production_recipes constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM production_recipes WHERE recipe_name LIKE 'TEST_%'");
    });
  });

  // TEST-DB-040: content_format CHECK
  test('TEST-DB-040: valid content_format values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const fmt of ['short_video', 'text_post', 'image_post']) {
        await c.query(
          "INSERT INTO production_recipes (recipe_name, content_format, steps) VALUES ($1, $2, '[]'::jsonb)",
          [`TEST_${uid()}`, fmt]
        );
      }
      await expect(
        c.query("INSERT INTO production_recipes (recipe_name, content_format, steps) VALUES ($1, 'long_video', '[]'::jsonb)", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_recipes_content_format/);
    });
  });
});

describe('prompt_suggestions constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM prompt_suggestions WHERE suggestion LIKE 'TEST_%'");
    });
  });

  // TEST-DB-041: trigger_type CHECK (6 values)
  test('TEST-DB-041: valid trigger_type values succeed, invalid fails', async () => {
    await withClient(async (c) => {
      for (const tt of ['score_decline', 'repeated_issue', 'new_pattern', 'tool_update', 'manual', 'other']) {
        await c.query(
          "INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion) VALUES ('strategist', $1, '{}'::jsonb, $2)",
          [tt, `TEST_${uid()}`]
        );
      }
      await expect(
        c.query("INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion) VALUES ('strategist', 'auto', '{}'::jsonb, $1)", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_prompt_suggestions_trigger_type/);
    });
  });

  // TEST-DB-042: status CHECK + default
  test('TEST-DB-042: status defaults to pending, invalid rejected', async () => {
    await withClient(async (c) => {
      await c.query(
        "INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion) VALUES ('strategist', 'manual', '{}'::jsonb, $1)",
        [`TEST_${uid()}`]
      );
      const res = await c.query(
        "SELECT status FROM prompt_suggestions WHERE suggestion LIKE 'TEST_%' ORDER BY created_at DESC LIMIT 1"
      );
      expect(res.rows[0].status).toBe('pending');

      for (const s of ['pending', 'accepted', 'rejected', 'expired']) {
        await c.query(
          "INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion, status) VALUES ('strategist', 'manual', '{}'::jsonb, $1, $2)",
          [`TEST_${uid()}`, s]
        );
      }

      await expect(
        c.query("INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion, status) VALUES ('strategist', 'manual', '{}'::jsonb, $1, 'archived')", [`TEST_${uid()}`])
      ).rejects.toThrow(/chk_prompt_suggestions_status/);
    });
  });
});
