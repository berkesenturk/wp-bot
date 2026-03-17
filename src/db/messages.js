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
 * Fetch all pending messages (for worker polling).
 * @param {'text'|'image'} type  optional type filter
 */
export function getPendingMessages(type) {
  if (type) {
    return getDb()
      .prepare("SELECT * FROM messages WHERE status = 'pending' AND type = ? ORDER BY timestamp ASC")
      .all(type);
  }
  return getDb()
    .prepare("SELECT * FROM messages WHERE status = 'pending' ORDER BY timestamp ASC")
    .all();
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