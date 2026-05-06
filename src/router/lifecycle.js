// src/router/lifecycle.js
//
// Handles @bot start / stop / status lifecycle commands.
// These work regardless of whether the bot is active or not.
// start/stop/status are checked BEFORE the active gate.

import { isActive, getSettings, activate, deactivate } from "../db/chatSettings.js";

const LIFECYCLE_COMMANDS = new Set(["start", "stop", "status"]);

/**
 * Check if a message text is a lifecycle command.
 * @param {string} text
 * @returns {{ command: string } | null}
 */
export function parseLifecycleCommand(text) {
  if (!text) return null;
  const trimmed = text.trim().toLowerCase();
  if (!trimmed.startsWith("@bot")) return null;

  const rest  = trimmed.slice(4).trim();
  const parts = rest.split(/\s+/);
  const command = parts[0];

  if (!LIFECYCLE_COMMANDS.has(command)) return null;
  return { command };
}

/**
 * Handle a lifecycle command and return a reply string.
 * Returns null if command was not handled (shouldn't happen if parseLifecycleCommand passed).
 *
 * @param {string} command   - "start" | "stop" | "status"
 * @param {string} chatId
 * @param {string} sender    - who sent the command
 * @returns {string} reply to send
 */
export function handleLifecycle(command, chatId, sender) {
  if (command === "start") {
    if (isActive(chatId)) {
      return "✅ Bot is already active in this chat.";
    }
    activate(chatId, sender);
    console.log("[lifecycle] Bot activated | chat:", chatId, "| by:", sender);
    return "✅ *Bot activated.*\n\n"
      + "I will now process messages in this chat.\n\n"
      + "Commands:\n"
      + "• @bot <question> — ask me anything\n"
      + "• @bot summarize <text> — summarize\n"
      + "• @bot tasks <text> — extract tasks\n"
      + "• @bot extract <text> — extract structured data\n"
      + "• @bot search <query> — search message history\n"
      + "• @bot stop — deactivate bot (only you can do this)\n"
      + "• @bot status — check bot status";
  }

  if (command === "stop") {
    const settings = getSettings(chatId);

    // Not active — nothing to stop
    if (!settings || settings.active === 0) {
      return "ℹ️ Bot is not active in this chat.";
    }

    // Only the person who started it can stop it
    if (settings.activated_by !== sender) {
      return "🔒 Only the person who activated the bot can stop it.\n"
        + "_Activated by: " + settings.activated_by + "_";
    }

    deactivate(chatId);
    console.log("[lifecycle] Bot deactivated | chat:", chatId, "| by:", sender);
    return "🔴 *Bot deactivated.*\n\nMessages will no longer be processed in this chat.\nSend @bot start to reactivate.";
  }

  if (command === "status") {
    const settings = getSettings(chatId);

    if (!settings || settings.active === 0) {
      return "🔴 *Bot is inactive* in this chat.\nSend @bot start to activate.";
    }

    const since = settings.activated_at
      ? new Date(settings.activated_at * 1000).toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
        })
      : "unknown";

    return "✅ *Bot is active* in this chat.\n"
      + "_Activated by " + settings.activated_by + " on " + since + "_";
  }

  return null;
}