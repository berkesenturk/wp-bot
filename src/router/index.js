// router/index.js
//
// Receives NormalizedMessage, dispatches to correct worker.
// All text going to LLM is sanitized first — PII never leaves the server raw.

import { MESSAGE_TYPES } from "../normalizer/types.js";
import { sanitize, rehydrate } from "../privacy/index.js";

export async function dispatch(msg) {
  if (!msg) return;

  switch (msg.type) {
    case MESSAGE_TYPES.TEXT:
      await handleText(msg);
      break;
    case MESSAGE_TYPES.IMAGE:
      await handleImage(msg);
      break;
    default:
      console.warn("[router] No handler for type:", msg.type);
  }
}

async function handleText(msg) {
  const { sanitized, map } = sanitize(msg.text, msg.chatId);

  console.log("[router] TEXT →", msg.chatId);
  console.log("[router]   original: ", msg.text);
  console.log("[router]   sanitized:", sanitized);
  console.log("[router]   tokens:   ", map.size > 0 ? Object.fromEntries(map) : "none");

  // Phase 2: wire to LLM
  // const rawOutput   = await llmWorker.process(sanitized);
  // const finalOutput = rehydrate(rawOutput, map);
  // → store finalOutput
}

async function handleImage(msg) {
  // Sanitize caption/text if present
  const { sanitized, map } = sanitize(msg.text ?? "", msg.chatId);

  console.log("[router] IMAGE →", msg.chatId);
  console.log("[router]   text (sanitized):", sanitized || "(none)");
  console.log("[router]   tokens:          ", map.size > 0 ? Object.fromEntries(map) : "none");
  console.log("[router]   local path:      ", msg.media?.localPath ?? "not downloaded");

  // Phase 2: wire to OCR + LLM
  // const ocrText     = await ocrWorker.extract(msg.media.localPath);
  // const combined    = [ocrText, sanitized].filter(Boolean).join("\n");
  // const rawOutput   = await llmWorker.process(combined);
  // const finalOutput = rehydrate(rawOutput, map);
  // → store finalOutput
}