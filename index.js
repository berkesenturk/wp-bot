import "dotenv/config";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import express from "express";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pino from "pino";

import { initDb, getDb }                  from "./src/db/index.js";
import { insertMessage, getRecentChats }  from "./src/db/messages.js";
import { bufferAndMerge }                 from "./src/merger/index.js";
import { normalize }                      from "./src/normalizer/index.js";
import { dispatch }                       from "./src/router/index.js";
import { MESSAGE_TYPES }                  from "./src/normalizer/types.js";
import { useSQLiteAuthState }             from "./src/auth/sqliteAuthState.js";
import { init as initEmbedder }                       from "./src/workers/embedder.js";
import { backfill, checkModelVersion,
         drain, queueDepth, isProcessing as embedBusy } from "./src/workers/embedQueue.js";
import { getIndexStats, getIndexStatsByChat,
         deleteMessage, deleteMessagesByChat,
         deleteFTS, deleteFTSByChat, deleteAllFTS }      from "./src/db/messages.js";
import { isActive }                                     from "./src/db/chatSettings.js";
import { embed }                                       from "./src/workers/embedder.js";
import { traceSearch }                                     from "./src/workers/search.js";
import { search as vectorSearch,
         dropAllVectorTables,
         deleteVector, deleteVectorsByChat }            from "./src/workers/vectorStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const MEDIA_DIR  = path.join(__dirname, "media");

initDb();
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ── Startup sequence ──────────────────────────────────────────────────────────
// Order matters: DB first, then embedder, then backfill, then WhatsApp
async function startup() {
  console.log("[startup] Initializing embedding model...");
  try {
    await initEmbedder();
    console.log("[startup] Embedding model ready");
    await checkModelVersion(); // reset vectors if model changed
    backfill();                // re-queue any messages missed in previous run
  } catch (err) {
    console.error("[startup] Embedding model failed to load:", err.message);
    console.warn("[startup] Continuing without embeddings — search will not work");
  }
}

const app        = express();
const httpServer = createServer(app);
const io         = new SocketIO(httpServer, { cors: { origin: "*" } });

app.use(express.json());
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.use("/media", express.static(MEDIA_DIR)); // serve downloaded images
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

// ── In-memory chat index (UI state — source of truth is SQLite) ───────────────
const chats = {};

// Module-level so getOrCreateChat and event handlers can both access it
const contactStore = {};

function stripJid(jid) {
  return jid ? jid.replace(/@s\.whatsapp\.net|@g\.us|@lid/, "") : jid;
}

function getOrCreateChat(jid, chatId, chatType) {
  if (!chats[jid]) {
    chats[jid] = { jid, chatId, chatType, name: contactStore[jid] || chatId, unread: 0, messages: [] };
  }
  return chats[jid];
}

function applyContactName(jid, name) {
  if (!jid || !name) return;
  contactStore[jid] = name;
  if (chats[jid] && chats[jid].name !== name) {
    chats[jid].name = name;
    io.emit("chat_updated", chatSummary(chats[jid]));
  }
}

function chatSummary(chat) {
  return {
    jid:         chat.jid,
    name:        chat.name,
    chatType:    chat.chatType,
    unread:      chat.unread,
    lastMessage: chat.messages.at(-1) ?? null,
  };
}


// ── Restore chats from SQLite on startup ──────────────────────────────────────
function restoreChatsFromDb() {
  try {
    const rows = getRecentChats(50);
    console.log("[restore] Loading", rows.length, "chats from DB...");

    for (const row of rows) {
      // Reconstruct a JID from chatId + chatType
      // Messages store chat_id as stripped JID, so we re-add the suffix
      const suffix = row.chatType === "group" ? "@g.us" : "@s.whatsapp.net";
      const jid    = row.chatId + suffix;

      const chat = getOrCreateChat(jid, row.chatId, row.chatType);

      for (const dbMsg of row.messages) {
        const uiMsg = {
          id:        dbMsg.id,
          direction: dbMsg.sender === "me" ? "outgoing" : "incoming",
          jid,
          sender:    dbMsg.sender,
          content:   dbMsg.text ?? "[" + dbMsg.type + "]",
          type:      dbMsg.type,
          mediaPath: dbMsg.media_path ?? null,
          timestamp: new Date(dbMsg.timestamp * 1000).toISOString(),
        };
        chat.messages.push(uiMsg);
      }

      if (chat.messages.length > 0) {
        chat.lastMessage = chat.messages.at(-1);
      }

      console.log("[restore]  chat:", jid, "| messages:", chat.messages.length);
    }

    console.log("[restore] Done. Total chats restored:", rows.length);
  } catch (err) {
    console.error("[restore] Failed to restore chats:", err.message);
  }
}

// ── Media download ────────────────────────────────────────────────────────────
async function downloadMedia(rawMsg, normalizedId, mimeType) {
  try {
    const buffer   = await downloadMediaMessage(rawMsg, "buffer", {});
    const ext      = mimeType?.split("/")[1]?.split(";")[0] ?? "bin";
    const filepath = path.join(MEDIA_DIR, normalizedId + "." + ext);
    fs.writeFileSync(filepath, buffer);
    console.log("[media] Saved:", filepath);
    return filepath;
  } catch (err) {
    console.error("[media] Download failed:", err.message);
    return null;
  }
}

// ── WhatsApp connection ───────────────────────────────────────────────────────
let sock = null;
let intentionalDisconnect = false;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useSQLiteAuthState();
  const { version }          = await fetchLatestBaileysVersion();

  console.log("[wa] Baileys version:", version.join("."));
  console.log("[wa] Auth state loaded. creds.me:", state.creds?.me?.id ?? "NOT SET — fresh session");

  sock = makeWASocket({
    version,
    auth:              state,
    printQRInTerminal: false,
    logger:            pino({ level: "silent" }),
    mobile:            false,
  });

  console.log("[wa] Socket created, waiting for connection.update...");

  // Auto-request pairing code on fresh sessions (no stored credentials)
  if (!state.creds?.me?.id) {
    const phone = (process.env.PHONE_NUMBER ?? "").replace(/\D/g, "");
    if (!phone) {
      console.error("[wa] Fresh session detected but PHONE_NUMBER is not set in .env — cannot request pairing code");
    } else {
      try {
        const code = await sock.requestPairingCode(phone);
        console.log("[wa] ╔══════════════════════════════════╗");
        console.log("[wa] ║   WHATSAPP PAIRING CODE          ║");
        console.log("[wa] ║                                  ║");
        console.log("[wa] ║   " + code + "                     ║");
        console.log("[wa] ║                                  ║");
        console.log("[wa] ║   WhatsApp → Settings →          ║");
        console.log("[wa] ║   Linked Devices →               ║");
        console.log("[wa] ║   Link with phone number         ║");
        console.log("[wa] ╚══════════════════════════════════╝");
      } catch (err) {
        console.error("[wa] Failed to request pairing code:", err.message);
      }
    }
  }

  // ── Contact / chat name events ────────────────────────────────────────────
  sock.ev.on("contacts.upsert", (contacts) => {
    for (const c of contacts) {
      const name = c.notify || c.name || c.verifiedName;
      if (c.id && name) {
        console.log("[contacts] Stored:", c.id, "→", name);
        applyContactName(c.id, name);
      }
    }
  });

  sock.ev.on("contacts.update", (updates) => {
    for (const u of updates) {
      const name = u.notify || u.name || u.verifiedName;
      if (u.id && name) applyContactName(u.id, name);
    }
  });

  // chats.upsert carries group subjects and cached contact names from the server
  sock.ev.on("chats.upsert", (chatList) => {
    for (const c of chatList) {
      const name = c.name || c.subject;
      if (c.id && name) applyContactName(c.id, name);
    }
  });

  sock.ev.on("chats.update", (updates) => {
    for (const u of updates) {
      const name = u.name || u.subject;
      if (u.id && name) applyContactName(u.id, name);
    }
  });

  // Resolver: given any JID, return clean phone number
  function resolveJid(jid) {
    if (!jid) return null;
    // Try contact store first (resolves @lid to real number)
    if (contactStore[jid]) return contactStore[jid];
    // Strip suffix and return raw number
    const stripped = jid.replace(/@s\.whatsapp\.net|@g\.us|@lid/, "");
    // @lid numbers are internal IDs — flag them so we know they're unresolved
    if (jid.endsWith("@lid")) {
      console.warn("[contacts] Unresolved @lid JID:", jid, "— contact store may not have synced yet");
    }
    return stripped;
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    console.log("[wa:connection.update] state:", connection ?? "undefined", "| qr:", !!qr, "| error:", lastDisconnect?.error?.message ?? "none");

    if (connection === "open") {
      console.log("[wa] Connection OPEN — session restored successfully");
      console.log("[wa] Logged in as:", sock.user?.id ?? "unknown");
      restoreChatsFromDb();
      io.emit("status", { connected: true, message: "Connected" });
      for (const chat of Object.values(chats)) {
        io.emit("chat_updated", chatSummary(chat));
      }
      console.log("[wa] Listening for incoming messages...");
    }

    if (connection === "close") {
      const code   = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message ?? "unknown reason";
      console.log("[wa] Connection CLOSED | code:", code, "| reason:", reason);

      // Don't auto-reconnect if the disconnect was intentional (UI-triggered)
      if (intentionalDisconnect) {
        console.log("[wa] Intentional disconnect — not reconnecting");
        intentionalDisconnect = false;
        sock = null;
        return;
      }

      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log("[wa] Will reconnect:", shouldReconnect);

      if (!shouldReconnect) {
        // Session invalidated server-side — clear credentials so next connect shows fresh QR
        getDb().prepare("DELETE FROM auth_state").run();
        console.log("[wa] Auth state cleared — reconnecting for fresh pairing code...");
        io.emit("status", { connected: false, message: "Session ended. Check server logs for new pairing code." });
        connectToWhatsApp();
      } else {
        io.emit("status", { connected: false, message: "Disconnected. Reconnecting..." });
        console.log("[wa] Scheduling reconnect...");
        connectToWhatsApp();
      }
    }
  });

  // ── Core message pipeline ─────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log("[pipeline] messages.upsert fired | type:", type, "| count:", messages.length);
    if (type !== "notify") {
      console.log("[pipeline] Skipping — unknown type:", type);
      return;
    }

    for (const rawMsg of messages) {
      const rawType = rawMsg.message ? Object.keys(rawMsg.message)[0] : "NO_MESSAGE";
      const fromMe  = rawMsg.key?.fromMe ?? false;
      const fromJid = rawMsg.key?.remoteJid ?? "unknown";
      console.log("[pipeline] Raw message | type:", rawType, "| fromMe:", fromMe, "| from:", fromJid);

      // 1. Normalize — pass resolveJid so @lid JIDs become real phone numbers
      const normalized = normalize(rawMsg, resolveJid);
      if (!normalized) {
        console.log("[pipeline] Normalizer returned null — skipping");
        continue;
      }
      console.log("[pipeline] Normalized OK | id:", normalized.id, "| type:", normalized.type);

      // 2. Download media immediately if image
      if (normalized.type === MESSAGE_TYPES.IMAGE) {
        const localPath = await downloadMedia(rawMsg, normalized.id, normalized.media.mimeType);
        if (localPath) normalized.media.localPath = localPath;
      }

      // 3. Emit to UI immediately so the user sees the message without delay
      const jid  = rawMsg.key.remoteJid;
      const chat = getOrCreateChat(jid, normalized.chatId, normalized.chatType);
      const uiMsg = {
        id:        normalized.id,
        direction: rawMsg.key.fromMe ? "outgoing" : "incoming",
        jid,
        sender:    normalized.sender,
        content:   normalized.text ?? "[" + normalized.type + "]",
        type:      normalized.type,
        mediaPath: normalized.media?.localPath ?? null,
        timestamp: new Date(normalized.timestamp * 1000).toISOString(),
      };
      chat.messages.push(uiMsg);
      if (!rawMsg.key.fromMe) chat.unread++;

      io.emit("message",      uiMsg);
      io.emit("chat_updated", chatSummary(chat));

      // 4. Buffer for merging — DB insert and dispatch happen after the merge
      //    window closes so consecutive messages are handled as one thought.
      bufferAndMerge(normalized, jid, (merged, replyJid) => {
        try {
          insertMessage(merged);
          console.log("[db] Inserted message:", merged.id, merged.text?.length > 1 ? `(${merged.text.split("\n").length} parts)` : "");
        } catch (err) {
          console.error("[db] Insert failed:", err.message);
          return;
        }

        const reply = async (_chatId, text) => {
          try {
            await sock.sendMessage(replyJid, { text });
            console.log("[reply] Sent to", replyJid, ":", text.substring(0, 60));
          } catch (err) {
            console.error("[reply] Failed to send:", err.message);
          }
        };

        dispatch(merged, reply).catch(err =>
          console.error("[router] Dispatch error:", err.message)
        );
      });
    }
  });
}

// ── REST API ──────────────────────────────────────────────────────────────────

app.post("/api/send", async (req, res) => {
  const { jid, phone, message } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });
  if (!sock)    return res.status(503).json({ error: "WhatsApp not connected" });

  const targetJid = jid ?? (phone ? phone.replace(/[\s\-\+]/g, "") + "@s.whatsapp.net" : null);
  if (!targetJid) return res.status(400).json({ error: "jid or phone required" });

  try {
    await sock.sendMessage(targetJid, { text: message });

    // Build and emit UI message immediately so sender sees it without waiting
    // for Baileys to echo it back via messages.upsert
    const chatType = targetJid.endsWith("@g.us") ? "group" : "personal";
    const chat     = getOrCreateChat(targetJid, stripJid(targetJid), chatType);
    const uiMsg    = {
      id:        "out_" + Date.now(),
      direction: "outgoing",
      jid:       targetJid,
      sender:    "me",
      content:   message,
      type:      "text",
      timestamp: new Date().toISOString(),
    };
    chat.messages.push(uiMsg);
    chat.lastMessage = uiMsg;

    io.emit("message",      uiMsg);
    io.emit("chat_updated", chatSummary(chat));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chats", (req, res) => {
  const { type } = req.query;
  const list = Object.values(chats)
    .filter(c => !type || c.chatType === type)
    .map(chatSummary)
    .sort((a, b) => {
      const ta = a.lastMessage?.timestamp ?? "";
      const tb = b.lastMessage?.timestamp ?? "";
      return tb.localeCompare(ta);
    });
  res.json(list);
});

app.get("/api/chats/:jid/messages", (req, res) => {
  const jid  = decodeURIComponent(req.params.jid);
  const chat = chats[jid];
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  chat.unread = 0;
  res.json(chat.messages);
});

app.get("/api/status", (req, res) => {
  res.json({ connected: !!sock?.user });
});

app.post("/api/connect", (req, res) => {
  if (sock?.user) return res.status(400).json({ error: "Already connected" });
  connectToWhatsApp();
  res.json({ success: true });
});

app.post("/api/disconnect", async (req, res) => {
  try {
    console.log("[server] Disconnect requested from UI — full data wipe");
    intentionalDisconnect = true;
    if (sock) { try { await sock.end(); } catch (_) {} }

    // Wipe all stored data so the next login starts completely fresh
    const db = getDb();
    db.prepare("DELETE FROM auth_state").run();
    db.prepare("DELETE FROM messages").run();
    db.prepare("DELETE FROM entity_registry").run();
    db.prepare("DELETE FROM chat_settings").run();
    db.prepare("DELETE FROM meta").run();
    deleteAllFTS();

    // Drop all LanceDB vector tables
    await dropAllVectorTables();

    // Delete downloaded media files
    fs.rmSync(MEDIA_DIR, { recursive: true, force: true });
    fs.mkdirSync(MEDIA_DIR, { recursive: true });

    // Clear in-memory chat state
    for (const key of Object.keys(chats)) delete chats[key];

    io.emit("chats_cleared");
    io.emit("status", { connected: false, message: "Disconnected. Check server logs for new pairing code." });
    connectToWhatsApp();
    res.json({ success: true });
  } catch (err) {
    intentionalDisconnect = false;
    console.error("[server] Disconnect error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/pair", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "phone is required" });
  if (!sock)  return res.status(503).json({ error: "WhatsApp socket not ready" });

  // Strip any non-digit characters
  const digits = phone.replace(/\D/g, "");
  try {
    const code = await sock.requestPairingCode(digits);
    console.log("[pair] Pairing code for", digits, ":", code);
    res.json({ code });
  } catch (err) {
    console.error("[pair] requestPairingCode failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reset-auth", async (req, res) => {
  try {
    intentionalDisconnect = true;
    if (sock) { try { await sock.end(); } catch (_) {} }
    getDb().prepare("DELETE FROM auth_state").run();
    io.emit("status", { connected: false, message: "Session reset. Check server logs for new pairing code." });
    connectToWhatsApp();
    res.json({ success: true });
  } catch (err) {
    intentionalDisconnect = false;
    res.status(500).json({ error: err.message });
  }
});

// ── Search health endpoint ────────────────────────────────────────────────────
app.get("/api/search/status", (req, res) => {
  try {
    const stats = getIndexStats();
    res.json({
      total:       stats.total,
      indexed:     stats.indexed,
      failed:      stats.failed,
      pending:     stats.pending,
      queue_depth: queueDepth(),
      processing:  embedBusy(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Per-chat index stats ──────────────────────────────────────────────────────
app.get("/api/debug/index-stats", (req, res) => {
  try {
    res.json(getIndexStatsByChat());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Debug: messages for a chat with their index state ────────────────────────
app.get("/api/debug/messages", (req, res) => {
  const { chatId, limit = "100" } = req.query;
  if (!chatId) return res.status(400).json({ error: "chatId is required" });
  try {
    const rows = getDb().prepare(`
      SELECT id, sender, timestamp, type, text, media_path, indexed
      FROM messages
      WHERE chat_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(chatId, parseInt(limit, 10));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Debug search endpoint (raw results with scores, no LLM) ──────────────────
app.get("/api/debug/search", async (req, res) => {
  const { chatId, q, k = "10" } = req.query;
  if (!chatId || !q) return res.status(400).json({ error: "chatId and q are required" });
  if (!sock?.user) return res.status(503).json({ error: "WhatsApp not connected" });

  if (!isActive(chatId)) {
    return res.status(400).json({ error: "Chat is not active. Send @bot start in that chat first." });
  }

  try {
    const chatRow        = getIndexStatsByChat().find(r => r.chat_id === chatId);
    const indexedForChat = chatRow?.indexed ?? 0;

    const vec     = await embed(q);
    const results = await vectorSearch(chatId, vec, parseInt(k, 10), { maxDistance: 2.0 });

    res.json({
      query:   q,
      chatId,
      indexed: indexedForChat,
      results: results.map(r => ({
        distance:  parseFloat(r.distance.toFixed(4)),
        sender:    r.sender,
        timestamp: r.timestamp,
        date:      new Date(r.timestamp * 1000).toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
        }),
        text: r.original_text ?? r.text ?? "",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Search pipeline trace (debug UI) ─────────────────────────────────────────
app.get("/api/debug/search-trace", async (req, res) => {
  const { chatId, q, k = "5" } = req.query;
  if (!chatId || !q) return res.status(400).json({ error: "chatId and q are required" });
  try {
    const trace = await traceSearch(q, chatId, parseInt(k, 10));
    res.json(trace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Message deletion ──────────────────────────────────────────────────────────

app.delete("/api/messages/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const db   = getDb();
    const row  = db.prepare("SELECT chat_id, chat_type FROM messages WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Message not found" });

    deleteMessage(id);
    deleteFTS(id);
    await deleteVector(row.chat_id, id);

    const suffix = row.chat_type === "group" ? "@g.us" : "@s.whatsapp.net";
    const jid    = row.chat_id + suffix;
    if (chats[jid]) chats[jid].messages = chats[jid].messages.filter(m => m.id !== id);

    io.emit("message_deleted", { id, chatId: row.chat_id });
    res.json({ success: true });
  } catch (err) {
    console.error("[api] deleteMessage failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/chats/:jid/messages", async (req, res) => {
  const jid    = decodeURIComponent(req.params.jid);
  const chatId = stripJid(jid);
  try {
    deleteMessagesByChat(chatId);
    deleteFTSByChat(chatId);
    await deleteVectorsByChat(chatId);

    if (chats[jid]) {
      chats[jid].messages    = [];
      chats[jid].lastMessage = null;
      chats[jid].unread      = 0;
    }

    io.emit("chat_messages_cleared", { jid, chatId });
    res.json({ success: true });
  } catch (err) {
    console.error("[api] deleteMessagesByChat failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let isShuttingDown = false;
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\n[server] Shutting down gracefully...");
  console.log("[server] Draining embed queue...");
  await drain().catch(() => {});
  try { await sock?.end(); } catch (_) {}
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
}
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log("[server] Running at http://localhost:" + PORT);
  await startup();          // load embedder, backfill missed messages
  connectToWhatsApp();      // then connect to WhatsApp
});