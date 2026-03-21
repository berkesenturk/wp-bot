// privacy/index.js
//
// Main exports: sanitize(text, chatId) and rehydrate(output, map)
//
// Usage in a worker:
//   const { sanitized, map } = sanitize(msg.text, msg.chatId);
//   const rawOutput          = await callLLM(sanitized);
//   const finalOutput        = rehydrate(rawOutput, map);
//
// For async workers processing old messages:
//   const map         = loadMap(chatId);   // full registry for this chat
//   const finalOutput = rehydrate(output, map);

export { loadMap } from "./registry.js";

import { stripStructural } from "./structural.js";
import { stripEntities }   from "./entities.js";

/**
 * Sanitize text before sending to an LLM provider.
 * Uses the persistent per-chat registry so known entities always
 * get the same token across messages.
 *
 * @param {string} text
 * @param {string} chatId
 * @returns {{ sanitized: string, map: Map<string,string> }}
 */
export function sanitize(text, chatId) {
  if (!text || typeof text !== "string") {
    return { sanitized: text, map: new Map() };
  }
  if (!chatId) {
    console.warn("[privacy] sanitize() called without chatId — registry disabled");
    chatId = "__no_chat__";
  }

  // Session map: token → original value for THIS message's rehydration.
  // Populated by both layers as they run.
  const sessionMap = new Map();

  let result = text;

  // Layer 1: structural PII (phones, emails, IBANs, etc.)
  result = stripStructural(result, chatId, sessionMap);

  // Layer 2: named entities (people, orgs, locations)
  result = stripEntities(result, chatId, sessionMap);

  if (sessionMap.size > 0) {
    console.log("[privacy] Sanitized", sessionMap.size, "tokens for chat", chatId, ":", [...sessionMap.keys()].join(", "));
  }

  return { sanitized: result, map: sessionMap };
}

/**
 * Rehydrate LLM output — swap tokens back to original values.
 * Works recursively on strings, objects, and arrays.
 *
 * @param {string|object} output
 * @param {Map<string,string>} map
 * @returns {string|object}
 */
export function rehydrate(output, map) {
  if (!map || map.size === 0) return output;

  if (typeof output === "string") {
    let result = output;
    for (const [token, original] of map.entries()) {
      result = result.split(token).join(original);
    }
    return result;
  }

  if (Array.isArray(output)) {
    return output.map(item => rehydrate(item, map));
  }

  if (output !== null && typeof output === "object") {
    const result = {};
    for (const [key, value] of Object.entries(output)) {
      result[key] = rehydrate(value, map);
    }
    return result;
  }

  return output;
}