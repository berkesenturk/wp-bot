// normalizer/index.js
//
// Pure function: takes a raw Baileys message object, returns a
// NormalizedMessage or null (unknown/unsupported types are logged and skipped).
//
// Rules:
//   - No side effects (no DB, no file I/O, no network)
//   - Never throws — catches all errors and returns null
//   - Raw Baileys object is never passed downstream

import { MESSAGE_TYPES, SUPPORTED_BAILEYS_TYPES } from "./types.js";

/**
 * @param {object} rawMsg - Baileys message object from messages.upsert
 * @returns {NormalizedMessage|null}
 */
export function normalize(rawMsg) {
  try {
    if (!rawMsg?.message) return null;
    if (rawMsg.key?.remoteJid === "status@broadcast") return null;

    const msgType = detectType(rawMsg);

    if (!SUPPORTED_BAILEYS_TYPES.has(msgType)) {
      console.warn("[normalizer] Unsupported type:", msgType, "| id:", rawMsg.key?.id);
      return null;
    }

    const jid       = rawMsg.key.remoteJid;
    const chatType  = jid.endsWith("@g.us") ? "group" : "personal";
    const chatId    = stripJid(jid);
    const sender    = resolveSender(rawMsg, chatType, jid);
    const timestamp = resolveTimestamp(rawMsg);

    const base = {
      id:        rawMsg.key.id,
      chatId,
      chatType,
      sender,
      timestamp,
      status:    "pending",
      text:      null,
      media:     null,
    };

    // ── Text ──────────────────────────────────────────────────────────────────
    if (msgType === "conversation") {
      return {
        ...base,
        type: MESSAGE_TYPES.TEXT,
        text: rawMsg.message.conversation,
      };
    }

    if (msgType === "extendedTextMessage") {
      return {
        ...base,
        type: MESSAGE_TYPES.TEXT,
        text: rawMsg.message.extendedTextMessage?.text ?? null,
      };
    }

    // ── Image ─────────────────────────────────────────────────────────────────
    if (msgType === "imageMessage") {
      const caption = rawMsg.message.imageMessage?.caption ?? null;
      return {
        ...base,
        type: MESSAGE_TYPES.IMAGE,
        text: caption,           // caption is text — one source of truth
        media: {
          mimeType:  rawMsg.message.imageMessage?.mimetype ?? "image/jpeg",
          localPath: null,       // filled immediately after normalize() in the listener
        },
      };
    }

    return null;

  } catch (err) {
    console.error("[normalizer] Unexpected error:", err.message, "| raw id:", rawMsg?.key?.id);
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectType(rawMsg) {
  const keys = Object.keys(rawMsg.message);
  // messageContextInfo is metadata, not the actual type — skip it
  const meaningful = keys.filter(k => k !== "messageContextInfo" && k !== "senderKeyDistributionMessage");
  return meaningful[0] ?? keys[0];
}

function stripJid(jid) {
  return jid ? jid.replace(/@s\.whatsapp\.net|@g\.us|@lid/, "") : jid;
}

function resolveSender(rawMsg, chatType, jid) {
  if (chatType === "group") {
    return stripJid(rawMsg.key.participant ?? "unknown");
  }
  return stripJid(jid);
}

function resolveTimestamp(rawMsg) {
  const raw = rawMsg.messageTimestamp;
  if (!raw) return Math.floor(Date.now() / 1000);
  return typeof raw === "object" ? raw.toNumber?.() ?? Number(raw) : Number(raw);
}