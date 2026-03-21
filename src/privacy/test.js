// node src/privacy/test.js
//
// Tests both single-message sanitization and cross-message token consistency.

import { sanitize, rehydrate, loadMap } from "./index.js";

const CHAT_A = "32477123456";
const CHAT_B = "32499999999";

console.log("═══════════════════════════════════════════════════");
console.log(" Privacy layer test");
console.log("═══════════════════════════════════════════════════");

// ── Test 1: Basic sanitization ────────────────────────────────────────────────
console.log("\n── Test 1: Basic structural + NLP sanitization");
const { sanitized: s1, map: m1 } = sanitize(
  "Call Ali Hassan at +32 477 123 456 or ali@company.com",
  CHAT_A
);
console.log("Input:     Call Ali Hassan at +32 477 123 456 or ali@company.com");
console.log("Sanitized:", s1);
console.log("Map:      ", Object.fromEntries(m1));    
console.log("Rehydrated:", rehydrate(s1, m1));

// ── Test 2: Same entity in next message → same token ─────────────────────────
console.log("\n── Test 2: Cross-message consistency (same chat)");
const { sanitized: s2, map: m2 } = sanitize(
  "Enercon replied. Forward to ali@company.com and copy Sarah Müller.",
  CHAT_A
);
console.log("Input:     Enercon replied. Forward to ali@company.com and copy Sarah Müller.");
console.log("Sanitized:", s2);
console.log("Map:      ", Object.fromEntries(m2));
console.log("→ ali@company.com should reuse its token from Test 1");

// ── Test 3: Same entity in different chat → different token ───────────────────
console.log("\n── Test 3: Isolation across chats");
const { sanitized: s3, map: m3 } = sanitize(
  "Contact ali@company.com about the invoice.",
  CHAT_B
);
console.log("Input:     Contact ali@company.com about the invoice.");
console.log("Sanitized:", s3);
console.log("Map:      ", Object.fromEntries(m3));
console.log("→ ali@company.com in CHAT_B should get a fresh [EMAIL_1], not reuse CHAT_A's token");

// ── Test 4: loadMap for async rehydration ─────────────────────────────────────
console.log("\n── Test 4: loadMap — full registry for a chat");
const fullMap = loadMap(CHAT_A);
console.log("Full registry for CHAT_A:", Object.fromEntries(fullMap));
const asyncOutput = "Invoice approved by [PERSON_1], send confirmation to [EMAIL_1]";
console.log("Async LLM output:  ", asyncOutput);
console.log("Rehydrated:        ", rehydrate(asyncOutput, fullMap));

// ── Test 5: Rehydration on structured JSON output ─────────────────────────────
console.log("\n── Test 5: Rehydrate structured JSON");
const jsonOutput = {
  vendor:   "[ORG_1]",
  approver: "[PERSON_1]",
  contact:  "[EMAIL_1]",
  items:    ["[ORG_1] turbine service", "parts"],
};
console.log("JSON output:  ", JSON.stringify(jsonOutput));
console.log("Rehydrated:   ", JSON.stringify(rehydrate(jsonOutput, fullMap)));