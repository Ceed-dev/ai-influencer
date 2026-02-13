'use strict';

const config = require('../config');
const { readSheet } = require('./client');

const IDS = config.google.inventoryIds;
const TAB = 'inventory';

// In-memory cache — one read per inventory per process lifetime
const _cache = {
  motions: null,
  scenarios: null,
  characters: null,
};

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] || ''; });
  return obj;
}

async function loadInventory(key) {
  if (_cache[key]) return _cache[key];
  const rows = await readSheet(IDS[key], `${TAB}!A:Z`);
  if (rows.length < 2) {
    _cache[key] = [];
    return [];
  }
  const headers = rows[0];
  const items = rows.slice(1).map((r) => rowToObj(headers, r));
  _cache[key] = items;
  return items;
}

/**
 * Get a motion by component_id.
 * @param {string} id - e.g. "MOT_0001"
 * @returns {Promise<object|null>}
 */
async function getMotion(id) {
  const motions = await loadInventory('motions');
  return motions.find((m) => m.component_id === id) || null;
}

/**
 * Get a scenario by component_id.
 * @param {string} id - e.g. "SCN_H_0001"
 * @returns {Promise<object|null>}
 */
async function getScenario(id) {
  const scenarios = await loadInventory('scenarios');
  return scenarios.find((s) => s.component_id === id) || null;
}

/**
 * Get a character by component_id.
 * @param {string} id - e.g. "CHR_0001"
 * @returns {Promise<object|null>}
 */
async function getCharacter(id) {
  const characters = await loadInventory('characters');
  return characters.find((c) => c.component_id === id) || null;
}

/**
 * Resolve a production row into fully-populated data for the pipeline.
 *
 * @param {object} row - A row from the production tab (as object with column keys)
 * @returns {Promise<object>} Resolved data with character, voice, and sections array
 */
async function resolveProductionRow(row) {
  const character = await getCharacter(row.character_id);
  if (!character) throw new Error(`Character not found: ${row.character_id}`);

  const [hookScenario, bodyScenario, ctaScenario] = await Promise.all([
    getScenario(row.hook_scenario_id),
    getScenario(row.body_scenario_id),
    getScenario(row.cta_scenario_id),
  ]);
  if (!hookScenario) throw new Error(`Hook scenario not found: ${row.hook_scenario_id}`);
  if (!bodyScenario) throw new Error(`Body scenario not found: ${row.body_scenario_id}`);
  if (!ctaScenario) throw new Error(`CTA scenario not found: ${row.cta_scenario_id}`);

  const [hookMotion, bodyMotion, ctaMotion] = await Promise.all([
    getMotion(row.hook_motion_id),
    getMotion(row.body_motion_id),
    getMotion(row.cta_motion_id),
  ]);
  if (!hookMotion) throw new Error(`Hook motion not found: ${row.hook_motion_id}`);
  if (!bodyMotion) throw new Error(`Body motion not found: ${row.body_motion_id}`);
  if (!ctaMotion) throw new Error(`CTA motion not found: ${row.cta_motion_id}`);

  const scriptLanguage = row.script_language || 'en';
  if (scriptLanguage !== 'en' && scriptLanguage !== 'jp') {
    throw new Error(`Invalid script_language "${scriptLanguage}" for video ${row.video_id}. Must be "en" or "jp".`);
  }

  return {
    character,
    voice: (() => {
      const vid = row.voice_id;
      if (!vid) throw new Error(`voice_id is required for video ${row.video_id}. Set a Fish Audio reference_id in the production sheet.`);
      if (!/^[0-9a-f]{32}$/.test(vid)) throw new Error(`voice_id "${vid}" for video ${row.video_id} is not a valid Fish Audio reference_id (expected 32-char hex). Got ${vid.length} chars.`);
      return vid;
    })(),
    scriptLanguage,
    sections: [
      { scenario: hookScenario, motion: hookMotion, prefix: '01_hook', name: 'hook' },
      { scenario: bodyScenario, motion: bodyMotion, prefix: '02_body', name: 'body' },
      { scenario: ctaScenario, motion: ctaMotion, prefix: '03_cta', name: 'cta' },
    ],
  };
}

/**
 * Clear all cached inventory data. Useful for testing or long-running processes.
 */
function clearCache() {
  _cache.motions = null;
  _cache.scenarios = null;
  _cache.characters = null;
}

module.exports = {
  getMotion,
  getScenario,
  getCharacter,
  resolveProductionRow,
  clearCache,
};
