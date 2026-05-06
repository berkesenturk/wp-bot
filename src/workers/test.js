// node src/workers/test.js

import "dotenv/config";
import { initDb }                                       from "../db/index.js";
import { sanitize, rehydrate }                          from "../privacy/index.js";
import { parseBotCommand, classify, respond, formatReply } from "./llm.js";

initDb();

const CHAT_ID = "test-chat-001";

function section(title) {
  console.log("\n" + "═".repeat(60));
  console.log(" " + title);
  console.log("═".repeat(60));
}

async function testClassify(label, text) {
  section("SILENT CLASSIFY: " + label);
  console.log("Input:", text);
  const { sanitized, map } = sanitize(text, CHAT_ID);
  console.log("Sanitized:", sanitized);
  const raw    = await classify(sanitized);
  const result = rehydrate(raw, map);
  console.log("Result:", JSON.stringify(result, null, 2));
}

async function testBot(label, message) {
  section("@BOT: " + label);
  console.log("Input:", message);
  const parsed = parseBotCommand(message);
  if (!parsed) { console.log("→ Not a @bot message"); return; }
  console.log("Command:", parsed.command, "| Body:", parsed.body);
  const { sanitized, map } = sanitize(parsed.body || message, CHAT_ID);
  console.log("Sanitized:", sanitized);
  const { raw, reply } = await respond(parsed.command, sanitized);
  const rehydratedReply = rehydrate(reply, map);
  console.log("\nWhatsApp reply:");
  console.log("─────────────────────────────");
  console.log(rehydratedReply);
  console.log("─────────────────────────────");
}

// ── Silent path ───────────────────────────────────────────────────────────────
await testClassify("Info message",    "Turbine 4 inspection done. Everything looks fine.");
await testClassify("Task message",    "Ali needs to send the report by Friday.");
await testClassify("Invoice with PII","Invoice from Enercon €2340. Contact jan@enercon.de +32 477 123 456");

// ── @bot path ─────────────────────────────────────────────────────────────────
await testBot("General question",    "@bot what should I prioritize today?");
await testBot("No command keyword",  "@bot can you check if turbine 4 report was sent?");
await testBot("Summarize command",   "@bot summarize We inspected turbine 4. Found wear on blade 2. Ali orders parts. Next check in 2 weeks.");
await testBot("Tasks command",       "@bot tasks Ali report by Friday. Berke calls supplier tomorrow.");
await testBot("Extract with PII",    "@bot extract Invoice Enercon €2340 jan@enercon.de BE68 5390 0754 7034");