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
 * Indexing stats broken down per chat.
 */
export function getIndexStatsByChat() {
  return getDb().prepare(`
    SELECT
      chat_id,
      chat_type,
      COUNT(*)                                           AS total,
      SUM(CASE WHEN indexed = 1  THEN 1 ELSE 0 END)     AS indexed,
      SUM(CASE WHEN indexed = -1 THEN 1 ELSE 0 END)     AS failed,
      SUM(CASE WHEN indexed = 0  THEN 1 ELSE 0 END)     AS pending,
      MAX(timestamp)                                     AS last_message_at
    FROM messages
    WHERE text IS NOT NULL
    GROUP BY chat_id
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
 * Indexing health stats — intentionally global, for admin/health dashboard only.
 * Never use this to scope work to a specific chat.
 */
export function getIndexStats() {
  const row = getDb().prepare(`
    SELECT
      COUNT(*)                          AS total,
      SUM(CASE WHEN indexed = 1  THEN 1 ELSE 0 END) AS indexed,
      SUM(CASE WHEN indexed = -1 THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN indexed = 0  THEN 1 ELSE 0 END) AS pending
    FROM messages
    WHERE text IS NOT NULL
  `).get();
  return row;
}