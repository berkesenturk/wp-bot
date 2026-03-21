// privacy/entities.js
//
// Layer 2: NLP-based entity anonymizer using compromise.
// Consults the per-chat registry first — same entity across messages
// always gets the same token.

import nlp from "compromise";
import { getToken, nextToken, register } from "./registry.js";

const ENTITY_TYPES = [
  { method: "people",        type: "PERSON" },
  { method: "organizations", type: "ORG"    },
  { method: "places",        type: "LOC"    },
];

/**
 * @param {string} text   - already partially sanitized by structural layer
 * @param {string} chatId
 * @param {Map<string,string>} sessionMap - updated in place
 * @returns {string}
 */
export function stripEntities(text, chatId, sessionMap) {
  let result = text;

  for (const { method, type } of ENTITY_TYPES) {
    const doc   = nlp(result);
    const found = doc[method]().out("array");

    // Longest first — replace "Ali Hassan" before "Ali"
    const sorted = [...new Set(found)]
      .filter(e => e && e.length >= 2)
      .sort((a, b) => b.length - a.length);

    for (const entity of sorted) {
      // Skip if this span is already a token like [PHONE_1]
      if (/^\[[A-Z_0-9]+\]$/.test(entity.trim())) continue;

      // 1. Check registry
      let token = getToken(chatId, entity);

      if (!token) {
        // 2. New entity
        token = nextToken(chatId, type);
        register(chatId, token, entity, type);
        console.log("[privacy:entities] New entity registered:", token, "→", entity);
      } else {
        console.log("[privacy:entities] Known entity reused:", token, "→", entity);
      }

      sessionMap.set(token, entity);

      // Replace all occurrences as whole words
      const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp("\\b" + escaped + "\\b", "g"), token);
    }
  }

  return result;
}