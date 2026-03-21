// privacy/registry.js
//
// Persistent entity registry backed by SQLite.
// Scoped per chat — same value always gets same token within a chat,
// different chats are isolated from each other.

import { getDb } from "../db/index.js";

// ── Schema ────────────────────────────────────────────────────────────────────
// Lazy init — table is created on first use, not at import time.
// This avoids the "DB not initialized" error when privacy module is imported
// before initDb() has run in index.js.

let initialized = false;

function ensureTable() {
  if (initialized) return;
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS entity_registry (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id    TEXT    NOT NULL,
      token      TEXT    NOT NULL,
      value      TEXT    NOT NULL,
      value_norm TEXT    NOT NULL,
      type       TEXT    NOT NULL,
      first_seen INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      last_seen  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      count      INTEGER NOT NULL DEFAULT 1,
      UNIQUE(chat_id, value_norm)
    );
    CREATE INDEX IF NOT EXISTS idx_registry_chat  ON entity_registry(chat_id);
    CREATE INDEX IF NOT EXISTS idx_registry_token ON entity_registry(chat_id, token);
  `);
  initialized = true;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Look up a value in the registry for this chat.
 * Returns the existing token or null if not found.
 * @param {string} chatId
 * @param {string} value
 * @returns {string|null}
 */
export function getToken(chatId, value) {
  ensureTable();
  const row = getDb()
    .prepare("SELECT token FROM entity_registry WHERE chat_id = ? AND value_norm = ?")
    .get(chatId, normalize(value));
  return row?.token ?? null;
}

/**
 * Get the next available token number for a type in this chat.
 * e.g. if [PERSON_1] and [PERSON_2] exist → returns "[PERSON_3]"
 * @param {string} chatId
 * @param {string} type  e.g. "PERSON", "ORG", "PHONE"
 * @returns {string}
 */
export function nextToken(chatId, type) {
  ensureTable();
  const row = getDb()
    .prepare(`
      SELECT COUNT(*) as n FROM entity_registry
      WHERE chat_id = ? AND type = ?
    `)
    .get(chatId, type);
  const n = (row?.n ?? 0) + 1;
  return "[" + type + "_" + n + "]";
}

/**
 * Load all entities for a chat as a Map<token, value>.
 * Used for rehydrating LLM output after async processing.
 * @param {string} chatId
 * @returns {Map<string, string>}
 */
export function loadMap(chatId) {
  ensureTable();
  const rows = getDb()
    .prepare("SELECT token, value FROM entity_registry WHERE chat_id = ? ORDER BY id ASC")
    .all(chatId);
  const map = new Map();
  for (const row of rows) {
    map.set(row.token, row.value);
  }
  return map;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Register a new entity. Returns the token.
 * If the entity already exists, touches it and returns the existing token.
 * @param {string} chatId
 * @param {string} token
 * @param {string} value  - canonical (original casing)
 * @param {string} type
 * @returns {string} token
 */
export function register(chatId, token, value, type) {
  ensureTable();
  const db       = getDb();
  const valueNorm = normalize(value);
  const now      = Math.floor(Date.now() / 1000);

  // Use INSERT OR IGNORE so concurrent inserts don't collide
  db.prepare(`
    INSERT OR IGNORE INTO entity_registry
      (chat_id, token, value, value_norm, type, first_seen, last_seen, count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(chatId, token, value, valueNorm, type, now, now);

  // Always touch — updates last_seen + count even if row already existed
  touch(chatId, value);

  // Return the actual token in DB (may differ if race condition on INSERT OR IGNORE)
  return getToken(chatId, value) ?? token;
}

/**
 * Update last_seen and increment count for an existing entity.
 * @param {string} chatId
 * @param {string} value
 */
export function touch(chatId, value) {
  ensureTable();
  const now = Math.floor(Date.now() / 1000);
  getDb()
    .prepare(`
      UPDATE entity_registry
      SET last_seen = ?, count = count + 1
      WHERE chat_id = ? AND value_norm = ?
    `)
    .run(now, chatId, normalize(value));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(value) {
  return (value ?? "").toLowerCase().trim();
}