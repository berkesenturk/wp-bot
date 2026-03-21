// privacy/structural.js
//
// Layer 1: Regex-based PII stripper.
// Consults the per-chat registry first — known values reuse existing tokens.
// New values get fresh tokens and are saved to the registry.

import { getToken, nextToken, register } from "./registry.js";

const RULES = [
  {
    type: "IBAN",
    regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g,
  },
  {
    type: "CARD",
    regex: /\b(?:\d[ -]?){13,19}\b/g,
  },
  {
    type: "EMAIL",
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: "PHONE",
    regex: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{1,4}\)?[\s.-]?)(?:\d[\s.-]?){6,10}\d/g,
  },
  {
    type: "IP",
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  },
  {
    type: "VAT",
    regex: /\b[A-Z]{2}[ ]?\d{2}(?:[ ]?\d{3,4}){2,3}\b/g,
  },
];

/**
 * @param {string} text
 * @param {string} chatId
 * @param {Map<string,string>} sessionMap - updated in place for this message's rehydration
 * @returns {string}
 */
export function stripStructural(text, chatId, sessionMap) {
  let result = text;

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    result = result.replace(rule.regex, (match) => {
      const value = match.trim();
      if (!value) return match;

      // 1. Check registry (persistent, cross-message)
      let token = getToken(chatId, value);

      if (!token) {
        // 2. New entity — assign next available token for this type in this chat
        token = nextToken(chatId, rule.type);
        register(chatId, token, value, rule.type);
        console.log("[privacy:structural] New entity registered:", token, "→", value);
      } else {
        console.log("[privacy:structural] Known entity reused:", token, "→", value);
      }

      // Always update session map for this message's rehydration
      sessionMap.set(token, value);
      return token;
    });
  }

  return result;
}