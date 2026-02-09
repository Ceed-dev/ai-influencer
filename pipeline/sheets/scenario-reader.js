'use strict';

const config = require('../config');
const { readSheet } = require('./client');

const IDS = config.google.inventoryIds;

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] || ''; });
  return obj;
}

async function readInventory(spreadsheetId) {
  const rows = await readSheet(spreadsheetId, 'Sheet1!A:Z');
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => rowToObj(headers, r));
}

async function getRandomScenario(type) {
  const scenarios = await readInventory(IDS.scenarios);
  const filtered = type
    ? scenarios.filter((s) => s.type === type || s.scenario_type === type)
    : scenarios;
  if (filtered.length === 0) return null;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

async function getScenarioById(id) {
  const scenarios = await readInventory(IDS.scenarios);
  return scenarios.find((s) => s.scenario_id === id || s.id === id) || null;
}

async function getCharacter(characterId) {
  const characters = await readInventory(IDS.characters);
  return characters.find((c) => c.character_id === characterId || c.id === characterId) || null;
}

async function getMotion(motionId) {
  const motions = await readInventory(IDS.motions);
  return motions.find((m) => m.motion_id === motionId || m.id === motionId) || null;
}

module.exports = { getRandomScenario, getScenarioById, getCharacter, getMotion };
