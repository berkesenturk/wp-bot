// router/index.js
//
// Receives a NormalizedMessage and dispatches it to the correct worker.
// Workers are stubs for now — they will be wired in Phase 2.
//
// Rule: the router only knows about NormalizedMessage shape.
// It never imports from Baileys.

import { MESSAGE_TYPES } from "../normalizer/types.js";

/**
 * Dispatch a normalized message to the appropriate worker.
 * @param {NormalizedMessage} msg
 */
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
      // Should not reach here — normalizer already filtered unknowns
      console.warn("[router] No handler for type:", msg.type);
  }
}

// ── Handlers (stubs — replaced by real workers in Phase 2) ───────────────────

async function handleText(msg) {
  console.log("[router] TEXT →", msg.chatId, "|", (msg.text ?? "").substring(0, 60));
  // Phase 2: await llmWorker.process(msg)
}

async function handleImage(msg) {
  console.log("[router] IMAGE →", msg.chatId, "| caption:", msg.media?.caption ?? "(none)");
  // Phase 2: await ocrWorker.process(msg)
  //   worker will: download file → run OCR → update media_path + status in DB
}
