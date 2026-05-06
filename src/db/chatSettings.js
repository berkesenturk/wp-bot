// src/db/chatSettings.js
// Read/write operations for chat activation state.

import { getDb } from "./index.js";

/**
 * Check if bot is active in a chat.
 * @param {string} chatId
 * @returns {boolean}
 */
export function isActive(chatId) {
  const row = getDb()
    .prepare("SELECT active FROM chat_settings WHERE chat_id = ?")
    .get(chatId);
  return row?.active === 1;
}

/**
 * Get full settings for a chat.
 * @param {string} chatId
 * @returns {{ active, activated_by, activated_at } | null}
 */
export function getSettings(chatId) {
  return getDb()
    .prepare("SELECT * FROM chat_settings WHERE chat_id = ?")
    .get(chatId) ?? null;
}

/**
 * Activate the bot for a chat.
 * @param {string} chatId
 * @param {string} activatedBy  — sender who ran @bot start
 */
export function activate(chatId, activatedBy) {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    INSERT INTO chat_settings (chat_id, active, activated_by, activated_at, updated_at)
    VALUES (?, 1, ?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      active       = 1,
      activated_by = excluded.activated_by,
      activated_at = excluded.activated_at,
      updated_at   = excluded.updated_at
  `).run(chatId, activatedBy, now, now);
}

/**
 * Deactivate the bot for a chat.
 * @param {string} chatId
 */
export function deactivate(chatId) {
  const now = Math.floor(Date.now() / 1000);
  getDb().prepare(`
    INSERT INTO chat_settings (chat_id, active, updated_at)
    VALUES (?, 0, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      active     = 0,
      updated_at = excluded.updated_at
  `).run(chatId, now);
}