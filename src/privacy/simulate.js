// src/privacy/simulate.js
//
// Simulates the full router pipeline for text and image messages
// without needing WhatsApp connected.
//
// Run: node src/privacy/simulate.js

import { initDb } from "../db/index.js";
import { sanitize, rehydrate, loadMap } from "./index.js";

// Must init DB before any registry calls
initDb();

const CHAT_ID = "32477123456";

function section(title) {
  console.log("\n" + "═".repeat(60));
  console.log(" " + title);
  console.log("═".repeat(60));
}

function test(label, text) {
  console.log("\n── " + label);
  console.log("   INPUT:    ", text);
  const { sanitized, map } = sanitize(text, CHAT_ID);
  console.log("   SANITIZED:", sanitized);
  if (map.size > 0) {
    console.log("   TOKENS:   ", Object.fromEntries(map));
  } else {
    console.log("   TOKENS:    none detected");
  }

  // Simulate LLM echoing back the sanitized text
  const rehydrated = rehydrate(sanitized, map);
  console.log("   REHYDRATED:", rehydrated);
  const match = rehydrated === text;
  console.log("   ROUNDTRIP:", match ? "✅ exact match" : "⚠️  differs (NLP may alter spacing/casing)");
  return map;
}

// ── Test 1: Plain text — no PII ───────────────────────────────────────────────
section("Test 1: Plain text — no PII");
test("No PII", "Hello, this is a test message");

// ── Test 2: Phone number ──────────────────────────────────────────────────────
section("Test 2: Structural PII — phone + email");
test(
  "Phone + email",
  "Call me from 05322562637 or berkesenturk11@gmail.com"
);

// ── Test 3: IBAN ──────────────────────────────────────────────────────────────
section("Test 3: Structural PII — IBAN");
test(
  "IBAN",
  "Please transfer to BE68 5390 0754 7034 by Friday"
);

// ── Test 4: Named entities ────────────────────────────────────────────────────
section("Test 4: NLP entities — name + org + location");
test(
  "Named entities",
  "Invoice from Enercon GmbH approved by Ali Hassan in Antwerp"
);

// ── Test 5: Mixed — real-world invoice message ────────────────────────────────
section("Test 5: Real-world invoice message");
test(
  "Invoice message",
  "Hi, Enercon sent invoice #4521 for €2340. Contact jan@enercon.de or +32 477 123 456. IBAN: BE68 5390 0754 7034"
);

// ── Test 6: Cross-message consistency ────────────────────────────────────────
section("Test 6: Cross-message consistency (same chat)");
console.log("\n   Sending two messages with the same phone number...");

const { map: map1 } = sanitize("Call me at 05322562637 tomorrow", CHAT_ID);
const { map: map2 } = sanitize("Did you call 05322562637 yet?", CHAT_ID);

const token1 = [...map1.keys()].find(k => k.startsWith("[PHONE"));
const token2 = [...map2.keys()].find(k => k.startsWith("[PHONE"));

console.log("   Message 1 token:", token1, "→", map1.get(token1));
console.log("   Message 2 token:", token2, "→", map2.get(token2));
console.log("   Same token reused:", token1 === token2 ? "✅ yes" : "❌ no — registry broken");

// ── Test 7: Chat isolation ────────────────────────────────────────────────────
section("Test 7: Chat isolation (different chats)");
const OTHER_CHAT = "32499999999";

const { map: mapA } = sanitize("Email ali@company.com", CHAT_ID);
const { map: mapB } = sanitize("Email ali@company.com", OTHER_CHAT);

const tokenA = [...mapA.keys()].find(k => k.startsWith("[EMAIL"));
const tokenB = [...mapB.keys()].find(k => k.startsWith("[EMAIL"));

console.log("   Chat A token:", tokenA, "→", mapA.get(tokenA));
console.log("   Chat B token:", tokenB, "→", mapB.get(tokenB));
console.log("   Tokens are independent:", tokenA === tokenB ? "✅ same token name (expected — both [EMAIL_1])" : "⚠️  different");
console.log("   Values isolated:", mapA.get(tokenA) === mapB.get(tokenB) ? "✅ same value, different registry rows" : "❌");

// ── Test 8: Rehydrate structured JSON output (simulated LLM response) ─────────
section("Test 8: Rehydrate structured JSON (simulated LLM output)");
const { sanitized: s8, map: m8 } = sanitize(
  "Invoice from Enercon GmbH. Contact: jan@enercon.de, +32 477 123 456",
  CHAT_ID
);
console.log("\n   Sanitized sent to LLM:", s8);

// Simulate LLM returning structured JSON with tokens
const simulatedLLMOutput = {
  vendor:  "[ORG_1]",
  contact: "[EMAIL_1]",
  phone:   "[PHONE_1]",
  amount:  2340,
  currency: "EUR",
};
console.log("   Simulated LLM output:", JSON.stringify(simulatedLLMOutput));

const fullMap = loadMap(CHAT_ID);
const rehydrated = rehydrate(simulatedLLMOutput, fullMap);
console.log("   Rehydrated output:   ", JSON.stringify(rehydrated));

// ── Summary ───────────────────────────────────────────────────────────────────
section("Registry state after all tests");
const finalRegistry = loadMap(CHAT_ID);
console.log("\n   All known entities for chat", CHAT_ID + ":");
for (const [token, value] of finalRegistry.entries()) {
  console.log("  ", token.padEnd(14), "→", value);
}