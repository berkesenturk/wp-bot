// db/messages.js
// All read/write operations for the messages table.
// Every function accepts/returns plain JS objects — no SQL leaks out.

import { getDb } from "./index.js";

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Insert a NormalizedMessage. Ignores duplicates (same id).
 * @param {NormalizedMessage} msg
 */
export function insertMessage(msg) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages
      (id, chat_id, chat_type, sender, timestamp, type,
       text, media_mime, media_caption, media_path, status)
    VALUES
      (@id, @chatId, @chatType, @sender, @timestamp, @type,
       @text, @mediaMime, @mediaCaption, @mediaPath, @status)
  `);

  stmt.run({
    id:           msg.id,
    chatId:       msg.chatId,
    chatType:     msg.chatType,
    sender:       msg.sender,
    timestamp:    msg.timestamp,
    type:         msg.type,
    text:         msg.text         ?? null,
    mediaMime:    msg.media?.mimeType  ?? null,
    mediaCaption: msg.media?.caption   ?? null,
    mediaPath:    msg.media?.localPath ?? null,
    status:       msg.status ?? "pending",
  });
}

/**
 * Update the status of a message.
 * @param {string} id
 * @param {'pending'|'processing'|'done'|'failed'} status
 */
export function updateStatus(id, status) {
  getDb()
    .prepare("UPDATE messages SET status = ? WHERE id = ?")
    .run(status, id);
}

/**
 * Update the local media path once a worker has downloaded the file.
 * @param {string} id
 * @param {string} localPath
 */
export function updateMediaPath(id, localPath) {
  getDb()
    .prepare("UPDATE messages SET media_path = ? WHERE id = ?")
    .run(localPath, id);
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all messages for a given chatId, newest first.
 * @param {string} chatId
 * @param {number} limit
 */
export function getMessagesByChat(chatId, limit = 50) {
  return getDb()
    .prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT ?")
    .all(chatId, limit);
}

/**
 * Fetch a single message by id.
 * @param {string} id
 */
export function getMessageById(id) {
  return getDb()
    .prepare("SELECT * FROM messages WHERE id = ?")
    .get(id);
}

/**
 * Fetch the most recent N messages per chat for restoring UI state on restart.
 * Returns rows grouped by chat_id, each with the latest message included.
 */
export function getRecentChats(messagesPerChat = 50) {
  const db = getDb();

  // Get all distinct chat_ids ordered by their latest message
  const chatIds = db.prepare(`
    SELECT chat_id, chat_type, MAX(timestamp) as last_ts
    FROM messages
    GROUP BY chat_id
    ORDER BY last_ts DESC
  `).all();

  const result = [];
  for (const row of chatIds) {
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE chat_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `).all(row.chat_id, messagesPerChat);

    result.push({
      chatId:   row.chat_id,
      chatType: row.chat_type,
      messages,
    });
  }

  return result;
}

/**
 * Update the indexed status of a message.
 * @param {string} id
 * @param {0|1|-1} indexed  0=pending, 1=done, -1=failed
 */
export function updateIndexed(id, indexed) {
  getDb()
    .prepare("UPDATE messages SET indexed = ? WHERE id = ?")
    .run(indexed, id);
}

/**
 * Fetch up to windowSize messages immediately before and after a given
 * timestamp in a chat. Used to build context windows for embedding.
 * @param {string} chatId
 * @param {number} timestamp
 * @param {number} windowSize  - max messages to fetch in each direction
 * @returns {{ before: Array, after: Array }}
 */
export function getNeighborMessages(chatId, timestamp, windowSize = 3) {
  const db = getDb();
  const before = db.prepare(`
    SELECT id, sender, text, timestamp FROM messages
    WHERE chat_id = ? AND text IS NOT NULL AND timestamp < ?
    ORDER BY timestamp ASC LIMIT ?
  `).all(chatId, timestamp, windowSize);

  const after = db.prepare(`
    SELECT id, sender, text, timestamp FROM messages
    WHERE chat_id = ? AND text IS NOT NULL AND timestamp > ?
    ORDER BY timestamp ASC LIMIT ?
  `).all(chatId, timestamp, windowSize);

  return { before, after };
}

/**
 * Fetch all messages not yet successfully indexed.
 * Returns messages where indexed = 0 (pending) or -1 (failed).
 * Used for backfill on startup.
 */
export function getUnindexedMessages() {
  return getDb()
    .prepare(`
      SELECT * FROM messages
      WHERE indexed != 1
        AND text IS NOT NULL
        AND chat_id IN (SELECT chat_id FROM chat_settings WHERE active = 1)
      ORDER BY timestamp ASC
    `)
    .all();
}

/**
 * Indexing stats broken down per chat, including active status.
 */
export function getIndexStatsByChat() {
  return getDb().prepare(`
    SELECT
      m.chat_id,
      m.chat_type,
      COUNT(*)                                             AS total,
      SUM(CASE WHEN m.indexed = 1  THEN 1 ELSE 0 END)     AS indexed,
      SUM(CASE WHEN m.indexed = -1 THEN 1 ELSE 0 END)     AS failed,
      SUM(CASE WHEN m.indexed = 0  THEN 1 ELSE 0 END)     AS pending,
      MAX(m.timestamp)                                     AS last_message_at,
      COALESCE(cs.active, 0)                               AS active
    FROM messages m
    LEFT JOIN chat_settings cs ON cs.chat_id = m.chat_id
    WHERE m.text IS NOT NULL
    GROUP BY m.chat_id
    ORDER BY last_message_at DESC
  `).all();
}

/**
 * Reset all successfully indexed messages back to pending.
 * Used when the embedding model changes — forces a full re-embed.
 * Intentionally global: dropAllVectorTables() wipes every chat's vectors,
 * so all chats must be reset. Backfill will only re-queue active chats.
 */
export function resetAllIndexed() {
  getDb().prepare("UPDATE messages SET indexed = 0 WHERE indexed = 1").run();
}

// ── FTS5 (BM25 keyword search) ────────────────────────────────────────────────

export function insertFTS(msgId, chatId, text) {
  const db = getDb();
  db.prepare("DELETE FROM messages_fts WHERE msg_id = ?").run(msgId);
  db.prepare("INSERT INTO messages_fts(msg_id, chat_id, text) VALUES (?, ?, ?)").run(msgId, chatId, text);
}

export function deleteFTS(msgId) {
  getDb().prepare("DELETE FROM messages_fts WHERE msg_id = ?").run(msgId);
}

export function deleteFTSByChat(chatId) {
  getDb().prepare("DELETE FROM messages_fts WHERE chat_id = ?").run(chatId);
}

export function deleteAllFTS() {
  getDb().prepare("DELETE FROM messages_fts").run();
}

/**
 * BM25 keyword search within a single chat.
 * FTS5 rank column is bm25() with sign reversed — lower = better, so ORDER BY rank = best first.
 * @param {string} chatId
 * @param {string} query
 * @param {number} k
 * @returns {Array<{ id, sender, text, timestamp }>}
 */
export function searchFTS(chatId, query, k = 10) {
  const clean = query.replace(/[*"'^()[\]?]/g, " ").trim();
  if (!clean) return [];

  // OR between terms so BM25 ranks partial matches — FTS5 default AND is too strict
  const orQuery = clean.split(/\s+/).filter(Boolean).join(" OR ");

  const rows = getDb().prepare(`
    SELECT msg_id, rank
    FROM messages_fts
    WHERE messages_fts MATCH ?
      AND chat_id = ?
    ORDER BY rank
    LIMIT ?
  `).all(orQuery, chatId, k);

  if (!rows.length) return [];

  const stmt = getDb().prepare("SELECT id, sender, text, timestamp FROM messages WHERE id = ?");
  return rows.map(r => stmt.get(r.msg_id)).filter(Boolean);
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a single message by id.
 */
export function deleteMessage(id) {
  getDb().prepare("DELETE FROM messages WHERE id = ?").run(id);
}

/**
 * Delete all messages for a chat.
 */
export function deleteMessagesByChat(chatId) {
  getDb().prepare("DELETE FROM messages WHERE chat_id = ?").run(chatId);
}

/**
 * Indexing health stats for active chats only — scoped to active = 1
 * to match per-chat isolation. Used by the monitor health dashboard.
 */
export function getIndexStats() {
  const row = getDb().prepare(`
    SELECT
      COUNT(*)                                        AS total,
      SUM(CASE WHEN indexed = 1  THEN 1 ELSE 0 END)  AS indexed,
      SUM(CASE WHEN indexed = -1 THEN 1 ELSE 0 END)  AS failed,
      SUM(CASE WHEN indexed = 0  THEN 1 ELSE 0 END)  AS pending
    FROM messages
    WHERE text IS NOT NULL
      AND chat_id IN (SELECT chat_id FROM chat_settings WHERE active = 1)
  `).get();
  return row;
}