// node src/workers/test.js
// Tests LLM worker end-to-end without WhatsApp.
// Set REQUESTY_API_KEY in your environment first:
//   export REQUESTY_API_KEY=rqsty-sk-...
//   node src/workers/test.js

import "dotenv/config";
import { initDb }                    from "../db/index.js";
import { sanitize, rehydrate }       from "../privacy/index.js";
import { parseBotCommand, callLLM }  from "./llm.js";

initDb();

const CHAT_ID = "test-chat-001";

async function run(label, message) {
  console.log("\n" + "═".repeat(60));
  console.log(" " + label);
  console.log("═".repeat(60));
  console.log("Input:", message);

  const parsed = parseBotCommand(message);
  if (!parsed) {
    console.log("→ Not a @bot command, would be stored only");
    return;
  }
  if (parsed.command === "unknown") {
    console.log("→ Unknown command. Available:", parsed.availableCommands.join(", "));
    return;
  }

  const textToProcess      = parsed.body || message;
  const { sanitized, map } = sanitize(textToProcess, CHAT_ID);

  console.log("Sanitized:  ", sanitized);
  if (map.size > 0) {
    console.log("PII tokens: ", Object.fromEntries(map));
  }

  try {
    console.log("Calling LLM...");
    const rawOutput   = await callLLM(parsed.command, sanitized);
    const finalOutput = rehydrate(rawOutput, map);
    console.log("Result:", JSON.stringify(finalOutput, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

// Run all tests sequentially
await run(
  "Test 1: Summarize a plain message",
  "@bot summarize We need to inspect turbine 4 tomorrow morning. Ali will bring the tools. Meeting at 8am at the site."
);

await run(
  "Test 2: Extract tasks",
  "@bot tasks Ali needs to send the report by Friday. Berke should call the supplier tomorrow. Invoice must be paid before end of month."
);

await run(
  "Test 3: Extract with PII — should sanitize before LLM",
  "@bot extract Invoice from Enercon for €2340. Contact jan@enercon.de or +32 477 123 456. IBAN: BE68 5390 0754 7034"
);

await run(
  "Test 4: Unknown command",
  "@bot translate Hello world"
);

await run(
  "Test 5: Not a bot command — should be ignored",
  "Just a regular message, nothing to do here"
);