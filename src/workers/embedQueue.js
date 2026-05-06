// src/workers/embedQueue.js
//
// Serial embedding queue — processes one message at a time.
// Prevents write conflicts in LanceDB and out-of-order indexing.
// Updates messages.indexed in SQLite after each attempt.
//
// Quality guarantees:
//   - Serial processing → no concurrent LanceDB writes
//   - indexed column tracks state → backfill catches anything missed
//   - Model readiness checked before processing
//   - Failures marked as indexed=-1 → retried on next restart

import { ready, embed, MODEL_FINGERPRINT }    from "./embedder.js";
import { upsert, dropAllVectorTables }        from "./vectorStore.js";
import { updateIndexed, getUnindexedMessages,
         resetAllIndexed, getNeighborMessages,
         insertFTS, deleteAllFTS }              from "../db/messages.js";
import { getMeta, setMeta }                   from "../db/index.js";
import { loadMap, rehydrate }                  from "../privacy/index.js";

// Bump this string whenever the embedding strategy changes (window size,
// merging logic, etc.) to force a full re-index on next startup.
const INDEX_STRATEGY = "ctx_window_v1_fts";

// Combined version key stored in meta — covers both model and strategy.
const INDEX_VERSION  = MODEL_FINGERPRINT + "|" + INDEX_STRATEGY;

// Number of messages to fetch before and after the target for context.
const CONTEXT_WINDOW = 1;

// ── Queue state ───────────────────────────────────────────────────────────────

const queue   = [];       // pending items: { id, chatId, text, sender, timestamp }
let processing = false;   // mutex — only one embed at a time

// ── Public: push ──────────────────────────────────────────────────────────────

/**
 * Add a message to the embedding queue.
 * @param {{ id: string, chatId: string, text: string, sender: string, timestamp: number }} msg
 */
export function enqueue(msg) {
  if (!msg.text?.trim()) return; // nothing to embed
  queue.push(msg);
  console.log("[embedQueue] Queued:", msg.id, "| queue length:", queue.length);
  processNext();
}

// ── Public: observability ─────────────────────────────────────────────────────

export function queueDepth()   { return queue.length; }
export function isProcessing() { return processing; }

// ── Public: model version check ───────────────────────────────────────────────

/**
 * On startup, compare stored index version (model + strategy) against current.
 * If they differ, reset all indexed flags and drop vector tables so everything
 * is re-embedded. Covers both model changes and embedding strategy changes.
 */
export async function checkModelVersion() {
  const stored = getMeta("embed_model");
  if (stored && stored !== INDEX_VERSION) {
    console.warn("[embedQueue] Index version changed:", stored, "→", INDEX_VERSION);
    console.warn("[embedQueue] Resetting all indexed flags and dropping vector tables...");
    resetAllIndexed();
    await dropAllVectorTables();
    deleteAllFTS();
    console.warn("[embedQueue] Re-index will begin via backfill()");
  }
  setMeta("embed_model", INDEX_VERSION);
}

// ── Public: backfill ──────────────────────────────────────────────────────────

/**
 * On startup, re-queue all messages not yet successfully indexed.
 * Catches anything dropped during a previous crash or failed embed.
 */
export function backfill() {
  const missed = getUnindexedMessages();
  if (missed.length === 0) {
    console.log("[embedQueue] Backfill: nothing to re-index");
    return;
  }
  console.log("[embedQueue] Backfill: re-queuing", missed.length, "unindexed messages");
  for (const row of missed) {
    queue.push({
      id:        row.id,
      chatId:    row.chat_id,
      text:      row.text,
      sender:    row.sender,
      timestamp: row.timestamp,
    });
  }
  processNext();
}

// ── Internal: serial worker ───────────────────────────────────────────────────

async function processNext() {
  if (processing)       return; // already running
  if (queue.length === 0) return;
  if (!ready()) {
    // Model not ready yet — will be called again once init() resolves
    console.log("[embedQueue] Model not ready, will retry when ready");
    return;
  }

  processing = true;

  while (queue.length > 0) {
    const msg = queue.shift();
    await processOne(msg);
  }

  processing = false;
}

async function processOne(msg) {
  const { id, chatId, text, sender, timestamp } = msg;

  try {
    const map          = loadMap(chatId);
    const originalText = rehydrate(text, map);

    // Embed a context window around this message rather than just its text.
    // Consecutive messages from the same sender within the window are merged
    // into one turn so the model sees complete thoughts, not fragments.
    const contextText = buildContextWindow(chatId, { sender, text, timestamp });
    const vector      = await embed(contextText);

    await upsert({
      msgId:        id,
      chatId,
      sender,
      text,          // sanitized — stored for reference
      originalText,  // rehydrated — shown in search results
      timestamp,
      vector,        // embedded from context window
    });

    insertFTS(id, chatId, originalText);
    updateIndexed(id, 1);
    console.log("[embedQueue] Indexed:", id);

  } catch (err) {
    console.error("[embedQueue] Failed to index:", id, "|", err.message);
    try { updateIndexed(id, -1); } catch (_) {}
  }
}

// ── Context window builder ────────────────────────────────────────────────────

/**
 * Build the text to embed for a message by expanding it into a context window.
 *
 * Fetches CONTEXT_WINDOW neighbors before and after, then merges consecutive
 * messages from the same sender into single turns. This gives the model enough
 * conversational context to understand what each message means.
 *
 * @param {string} chatId
 * @param {{ sender: string, text: string, timestamp: number }} target
 * @returns {string}
 */
export function buildContextWindow(chatId, target) {
  const { before, after } = getNeighborMessages(chatId, target.timestamp, CONTEXT_WINDOW);

  const all = [
    ...before,
    { sender: target.sender, text: target.text },
    ...after,
  ];

  // Merge consecutive same-sender messages into one turn each
  const turns = [];
  for (const msg of all) {
    if (!msg.text?.trim()) continue;
    const last = turns.at(-1);
    if (last && last.sender === msg.sender) {
      last.text += "\n" + msg.text;
    } else {
      turns.push({ sender: msg.sender, text: msg.text });
    }
  }

  return turns.map(t => t.text).join("\n\n");
}

// ── Public: drain (for graceful shutdown) ─────────────────────────────────────

/**
 * Wait for the queue to empty. Call before process.exit().
 * Resolves immediately if queue is empty.
 */
export function drain() {
  return new Promise((resolve) => {
    if (queue.length === 0 && !processing) return resolve();
    const interval = setInterval(() => {
      if (queue.length === 0 && !processing) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}