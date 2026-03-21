// db/index.js
// SQLite connection and schema setup using better-sqlite3 (sync, no callback hell)

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DB_PATH    = path.join(__dirname, "../../data/messages.db");

let db;

export function getDb() {
  if (!db) throw new Error("DB not initialized. Call initDb() first.");
  return db;
}

export function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id             TEXT PRIMARY KEY,
      chat_id        TEXT NOT NULL,
      chat_type      TEXT NOT NULL CHECK(chat_type IN ('personal','group')),
      sender         TEXT NOT NULL,
      timestamp      INTEGER NOT NULL,
      type           TEXT NOT NULL CHECK(type IN ('text','image','unknown')),
      text           TEXT,
      media_mime     TEXT,
      media_caption  TEXT,
      media_path     TEXT,
      status         TEXT NOT NULL DEFAULT 'pending'
                       CHECK(status IN ('pending','processing','done','failed')),
      created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
 
    CREATE INDEX IF NOT EXISTS idx_messages_chat   ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
    CREATE INDEX IF NOT EXISTS idx_messages_ts     ON messages(timestamp DESC);
  `);
 
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

  console.log("[db] SQLite ready at", DB_PATH);
  return db;

  
}
