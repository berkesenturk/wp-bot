// src/workers/search.js
//
// @bot search handler.
// Embeds the query, retrieves top-k similar messages,
// then asks LLM to answer the question using those messages as context.

import { embed }    from "./embedder.js";
import { search }   from "./vectorStore.js";
import { respond }  from "./llm.js";
import { sanitize, rehydrate, loadMap, getOrRegisterToken } from "../privacy/index.js";
import { searchFTS } from "../db/messages.js";

/**
 * Handle a @bot search query.
 *
 * @param {string} query    - the user's question (raw, unsanitized)
 * @param {string} chatId
 * @param {number} k        - number of messages to retrieve (default 5)
 * @returns {Promise<string>} formatted reply for WhatsApp
 */
export async function handleSearch(query, chatId, k = 5) {
  if (!query?.trim()) {
    return "❓ Please provide a search query.\nExample: @bot search who approved turbine 4?";
  }

  console.log("[search] Query:", query, "| chat:", chatId);

  // Sanitize the query before embedding
  const { sanitized: sanitizedQuery, map } = sanitize(query, chatId);
  console.log("[search] Sanitized query:", sanitizedQuery);

  // Embed the query
  let queryVector;
  try {
    queryVector = await embed(sanitizedQuery);
  } catch (err) {
    throw new Error("Failed to embed search query: " + err.message);
  }

  // Run vector + BM25 in parallel, fuse with RRF
  const [vectorResults, bm25Results] = await Promise.all([
    search(chatId, queryVector, k * 2),
    Promise.resolve(searchFTS(chatId, query, k * 2)),
  ]);

  const results = reciprocalRankFusion(vectorResults, bm25Results, k);

  if (!results || results.length === 0) {
    return "🔍 No relevant messages found.\n\nThe search index may still be building — try again in a moment.";
  }

  console.log("[search] Retrieved", results.length, "results");

  // Build context block — use sanitized text and masked sender
  const context = results.map((r, i) => {
    const date   = new Date(r.timestamp * 1000).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
    const sender = r.sender && r.sender !== "me"
      ? getOrRegisterToken(chatId, r.sender, "PERSON")
      : (r.sender ?? "unknown");
    const text   = r.text ?? "";
    return (i + 1) + ". [" + date + " - " + sender + "] " + text;
  }).join("\n");

  // Ask LLM to answer using retrieved context
  const prompt = buildAnswerPrompt(sanitizedQuery, context);

  let answer;
  try {
    const { reply } = await respond("general", prompt);
    answer = rehydrate(reply, loadMap(chatId));
  } catch (err) {
    // If LLM fails, still return the raw retrieved messages
    console.error("[search] LLM answer failed, returning raw results:", err.message);
    return formatRawResults(query, results);
  }

  // Format final reply
  return formatSearchReply(query, sanitizedQuery, answer, results);
}

// ── Debug trace ──────────────────────────────────────────────────────────────

/**
 * Same pipeline as handleSearch but returns every intermediate step
 * for the debug UI (/search-test).
 */
export async function traceSearch(query, chatId, k = 5) {
  const { sanitized: sanitizedQuery, map } = sanitize(query, chatId);

  const queryVector = await embed(sanitizedQuery);

  const [vectorResults, bm25Results] = await Promise.all([
    search(chatId, queryVector, k * 2),
    Promise.resolve(searchFTS(chatId, query, k * 2)),
  ]);

  const results = reciprocalRankFusion(vectorResults, bm25Results, k);

  const maskSender = (s) => s && s !== "me"
    ? getOrRegisterToken(chatId, s, "PERSON")
    : (s ?? "unknown");

  const retrievedMessages = results.map(r => ({
    date:            new Date(r.timestamp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    sender:          r.sender ?? "unknown",
    sanitizedSender: maskSender(r.sender),
    originalText:    r.original_text ?? r.text ?? "",
    sanitizedText:   r.text ?? "",
    distance:        r.distance != null ? parseFloat(r.distance.toFixed(4)) : null,
  }));

  const context = results.map((r, i) => {
    const date   = new Date(r.timestamp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return (i + 1) + ". [" + date + " - " + maskSender(r.sender) + "] " + (r.text ?? "");
  }).join("\n");

  const prompt = buildAnswerPrompt(sanitizedQuery, context);

  let llmRaw = null, finalAnswer = null, llmError = null;
  try {
    const { reply } = await respond("general", prompt);
    llmRaw      = reply;
    finalAnswer = rehydrate(reply, loadMap(chatId));
  } catch (err) {
    llmError = err.message;
  }

  return { query, sanitizedQuery, retrievedMessages, prompt, llmRaw, finalAnswer, llmError };
}

// ── Reciprocal Rank Fusion ────────────────────────────────────────────────────

const RRF_K = 60;

const FORWARD_LOOKING = /\b(next|upcoming|when is|when are|schedule|soon|latest|most recent|sonraki|ne zaman|gelecek|yaklaşan|en son|bugün|yarın|bu hafta)\b/i;

function reciprocalRankFusion(vectorResults, bm25Results, k) {
  const scores = new Map();

  vectorResults.forEach((r, i) => {
    scores.set(r.id, { score: 1 / (RRF_K + i + 1), data: r });
  });

  bm25Results.forEach((r, i) => {
    const contrib = 1 / (RRF_K + i + 1);
    if (scores.has(r.id)) {
      scores.get(r.id).score += contrib;
    } else {
      scores.set(r.id, { score: contrib, data: { ...r, original_text: r.text } });
    }
  });

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ data }) => data);
}

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildAnswerPrompt(query, context) {
  const temporalNote = FORWARD_LOOKING.test(query)
    ? "\nIMPORTANT: The question is about a future, upcoming, or most-recent event. " +
      "The context messages span multiple dates. Use the MOST RECENT message on the topic " +
      "as the current state — earlier messages about the same subject are outdated.\n"
    : "";

  const distinctNote =
    "\nIf multiple messages refer to different instances of the same topic " +
    "(e.g. different invoices, different orders, different meetings with different dates or amounts), " +
    "treat each as a separate item — list all of them rather than picking just one.\n";

  return `
You are an assistant helping a team find information from their WhatsApp chat history.
Answer the question below using ONLY the provided context messages.
If the answer is not in the context, say so clearly — do not make up information.
Be concise and direct. This is a chat reply, not an essay.
${temporalNote}${distinctNote}
Context messages (most relevant first):
${context}

Question: ${query}
`.trim();
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatSearchReply(query, sanitizedQuery, answer, results) {
  const sourceLines = results.slice(0, 3).map((r) => {
    const date   = new Date(r.timestamp * 1000).toLocaleDateString("en-GB", {
      day: "numeric", month: "short",
    });
    const text   = (r.original_text ?? r.text ?? "").substring(0, 60);
    return "• [" + date + "] " + text + (text.length >= 60 ? "..." : "");
  });

  const sanitizedLine = sanitizedQuery !== query
    ? "\n_Sanitized query: " + sanitizedQuery + "_"
    : "";

  return "🔍 *Search result*\n\n"
    + answer
    + "\n\n_Sources:_\n"
    + sourceLines.join("\n")
    + sanitizedLine;
}

function formatRawResults(query, results) {
  const lines = results.map((r) => {
    const date = new Date(r.timestamp * 1000).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
    return "• [" + date + " - " + (r.sender ?? "?") + "] " + (r.original_text ?? r.text ?? "");
  });

  return "🔍 *Relevant messages for:* \"" + query + "\"\n\n" + lines.join("\n");
}