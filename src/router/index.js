// src/router/index.js
//
// Gate: bot only processes a chat after @bot start.
// Lifecycle commands (start/stop/status) always work.
// Embedding and all other processing only happens in active chats.

import { MESSAGE_TYPES }                                    from "../normalizer/types.js";
import { sanitize, rehydrate }                              from "../privacy/index.js";
import { parseBotCommand, respond,
         LLMUnavailableError, LLMParseError }               from "../workers/llm.js";
import { enqueue }                                          from "../workers/embedQueue.js";
import { handleSearch }                                     from "../workers/search.js";
import { embed }                                            from "../workers/embedder.js";
import { search as vectorSearch }                           from "../workers/vectorStore.js";
import { parseLifecycleCommand, handleLifecycle }           from "./lifecycle.js";
import { isActive }                                         from "../db/chatSettings.js";

const STATIC_REPLIES = {
  hi:    "👋 Hi! How can I help?\n\nCommands:\n• @bot <question> — ask me anything\n• @bot summarize <text>\n• @bot tasks <text>\n• @bot extract <text>\n• @bot search <query>\n• @bot status",
  hello: "👋 Hello! How can I help?\n\nCommands:\n• @bot <question> — ask me anything\n• @bot summarize <text>\n• @bot tasks <text>\n• @bot extract <text>\n• @bot search <query>\n• @bot status",
  hey:   "👋 Hey! How can I help?\n\nCommands:\n• @bot <question> — ask me anything\n• @bot summarize <text>\n• @bot tasks <text>\n• @bot extract <text>\n• @bot search <query>\n• @bot status",
  help:  "Commands:\n• @bot <question> — ask me anything\n• @bot summarize <text> — bullet-point summary\n• @bot tasks <text> — extract action items\n• @bot extract <text> — extract structured data\n• @bot search <query> — search message history\n• @bot status — check bot status\n• @bot stop — deactivate bot",
  ping:  "🏓 Pong!",
};

export async function dispatch(msg, reply) {
  if (!msg) return;

  switch (msg.type) {
    case MESSAGE_TYPES.TEXT:
      await handleText(msg, reply);
      break;
    case MESSAGE_TYPES.IMAGE:
      await handleImage(msg, reply);
      break;
    default:
      console.warn("[router] No handler for type:", msg.type);
  }
}

// ── Text handler ──────────────────────────────────────────────────────────────

async function handleText(msg, reply) {
  const { sanitized, map } = sanitize(msg.text, msg.chatId);

  // ── Step 1: Lifecycle commands — always handled, even in inactive chats ────
  const lifecycle = parseLifecycleCommand(msg.text);
  if (lifecycle) {
    const replyText = handleLifecycle(lifecycle.command, msg.chatId, msg.sender);
    await reply(msg.chatId, replyText);
    return;
  }

  // ── Step 2: Active gate — stop here if bot not started in this chat ────────
  if (!isActive(msg.chatId)) {
    console.log("[router] Chat inactive, ignoring →", msg.chatId);
    return;
  }

  // ── Step 3: Index message (active chats only) ──────────────────────────────
  enqueue({
    id:        msg.id,
    chatId:    msg.chatId,
    text:      sanitized,
    sender:    msg.sender,
    timestamp: msg.timestamp,
  });

  // ── Step 4: @bot command ───────────────────────────────────────────────────
  const parsed = parseBotCommand(msg.text);

  if (parsed) {

    // @bot search
    if (parsed.command === "search") {
      console.log("[router] @bot search | chat:", msg.chatId);
      await reply(msg.chatId, "🔍 Searching...");
      try {
        const result = await handleSearch(parsed.body, msg.chatId);
        await reply(msg.chatId, result);
      } catch (err) {
        console.error("[router] Search failed:", err.message);
        await reply(msg.chatId, "❌ Search failed: " + err.message);
      }
      return;
    }

    // @bot debug <query> — raw retrieval with scores, no LLM
    if (parsed.command === "general" && parsed.body.trim().toLowerCase().startsWith("debug ")) {
      const query = parsed.body.trim().slice(6).trim();
      if (query) {
        await reply(msg.chatId, "🔬 Running debug search...");
        try {
          const { sanitized: sq } = sanitize(query, msg.chatId);
          const vec     = await embed(sq);
          const results = await vectorSearch(msg.chatId, vec, 5, { maxDistance: 2.0 });
          if (!results.length) {
            await reply(msg.chatId, "🔬 No results found (index may be empty).");
          } else {
            const lines = results.map((r, i) => {
              const date = new Date(r.timestamp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
              const text = (r.original_text ?? r.text ?? "").substring(0, 60);
              return (i + 1) + ". [" + r.distance.toFixed(2) + "] " + date + " · " + (r.sender ?? "?") + ": " + text;
            });
            await reply(msg.chatId, "🔬 *Debug search* (lower score = more relevant)\n\n" + lines.join("\n"));
          }
        } catch (err) {
          await reply(msg.chatId, "❌ Debug search failed: " + err.message);
        }
        return;
      }
    }

    // @bot hi / hello / hey / help / ping — no LLM needed
    if (parsed.command === "general") {
      const keyword = parsed.body.trim().toLowerCase();
      if (STATIC_REPLIES[keyword]) {
        await reply(msg.chatId, STATIC_REPLIES[keyword]);
        return;
      }
    }

    // @bot summarize / tasks / extract / general
    console.log("[router] @bot", parsed.command, "| chat:", msg.chatId);
    const bodyText                  = parsed.body || msg.text;
    const { sanitized: s, map: m }  = sanitize(bodyText, msg.chatId);

    await reply(msg.chatId, "⏳ Processing...");

    try {
      const { reply: replyText } = await respond(parsed.command, s);
      const rehydratedReply      = rehydrate(replyText, m);
      console.log("[router] LLM reply:", rehydratedReply.substring(0, 120));
      await reply(msg.chatId, rehydratedReply);
    } catch (err) {
      console.error("[router] @bot failed:", err.name + ":", err.message);
      if (err instanceof LLMUnavailableError) {
        await reply(msg.chatId, "🔌 " + err.message);
      } else if (err instanceof LLMParseError) {
        await reply(msg.chatId, "⚠️ Got a response but couldn't read it. Please try again.");
      } else {
        await reply(msg.chatId, "❌ Something went wrong. Please try again.");
      }
    }
    return;
  }

  // ── Step 5: Default — no-op (classify disabled) ───────────────────────────
  console.log("[router] TEXT (no command) →", msg.chatId, "|", (msg.text ?? "").substring(0, 60));
}

// ── Image handler ─────────────────────────────────────────────────────────────

async function handleImage(msg, reply) {
  const { sanitized } = sanitize(msg.text ?? "", msg.chatId);

  console.log("[router] IMAGE →", msg.chatId);
  console.log("[router]   local path:", msg.media?.localPath ?? "not downloaded");

  if (!isActive(msg.chatId)) return;

  // Index image captions in active chats
  if (sanitized) {
    enqueue({
      id:        msg.id,
      chatId:    msg.chatId,
      text:      sanitized,
      sender:    msg.sender,
      timestamp: msg.timestamp,
    });
  }

  // Phase 2: OCR → classify → store
}
