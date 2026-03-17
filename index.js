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

import { initDb }                         from "./src/db/index.js";
import { insertMessage, getRecentChats }  from "./src/db/messages.js";
import { normalize }                      from "./src/normalizer/index.js";
import { dispatch }                       from "./src/router/index.js";
import { MESSAGE_TYPES }                  from "./src/normalizer/types.js";
import { useSQLiteAuthState }             from "./src/auth/sqliteAuthState.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const MEDIA_DIR  = path.join(__dirname, "media");

initDb();
fs.mkdirSync(MEDIA_DIR, { recursive: true });

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

function stripJid(jid) {
  return jid ? jid.replace(/@s\.whatsapp\.net|@g\.us|@lid/, "") : jid;
}

function getOrCreateChat(jid, chatId, chatType) {
  if (!chats[jid]) {
    chats[jid] = { jid, chatId, chatType, name: chatId, unread: 0, messages: [] };
  }
  return chats[jid];
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

async function connectToWhatsApp() {
  const { state, saveCreds } = await useSQLiteAuthState();
  const { version }          = await fetchLatestBaileysVersion();

  console.log("[wa] Baileys version:", version.join("."));
  console.log("[wa] Auth state loaded. creds.me:", state.creds?.me?.id ?? "NOT SET — fresh session");

  sock = makeWASocket({
    version,
    auth:              state,
    printQRInTerminal: true,
    logger:            pino({ level: "silent" }),
  });

  console.log("[wa] Socket created, waiting for connection.update...");

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    console.log("[wa:connection.update] state:", connection ?? "undefined", "| qr:", !!qr, "| error:", lastDisconnect?.error?.message ?? "none");

    if (qr) {
      console.log("[wa] QR code received — session could NOT be restored, need fresh login");
      io.emit("qr", qr);
      io.emit("status", { connected: false, message: "Scan QR code to connect" });
    }

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
      const code            = lastDisconnect?.error?.output?.statusCode;
      const reason          = lastDisconnect?.error?.message ?? "unknown reason";
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log("[wa] Connection CLOSED | code:", code, "| reason:", reason, "| will reconnect:", shouldReconnect);
      io.emit("status", { connected: false, message: "Disconnected. Reconnecting..." });
      if (shouldReconnect) {
        console.log("[wa] Scheduling reconnect...");
        connectToWhatsApp();
      } else {
        console.log("[wa] Logged out — will NOT reconnect. Delete auth_state from DB and restart.");
      }
    }
  });

  // ── Core message pipeline ─────────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log("[pipeline] messages.upsert fired | type:", type, "| count:", messages.length);
    if (type !== "notify") {
      console.log("[pipeline] Skipping — type is not 'notify'");
      return;
    }

    for (const rawMsg of messages) {
      const rawType = rawMsg.message ? Object.keys(rawMsg.message)[0] : "NO_MESSAGE";
      const fromMe  = rawMsg.key?.fromMe ?? false;
      const fromJid = rawMsg.key?.remoteJid ?? "unknown";
      console.log("[pipeline] Raw message | type:", rawType, "| fromMe:", fromMe, "| from:", fromJid);

      // 1. Normalize
      const normalized = normalize(rawMsg);
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

      // 3. Persist to SQLite
      try {
        insertMessage(normalized);
        console.log("[db] Inserted message:", normalized.id);
      } catch (err) {
        console.error("[db] Insert failed:", err.message);
        continue;
      }

      // 4. Update in-memory UI state
      const jid   = rawMsg.key.remoteJid;
      const chat  = getOrCreateChat(jid, normalized.chatId, normalized.chatType);
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

      // 5. Route to worker
      dispatch(normalized).catch(err =>
        console.error("[router] Dispatch error:", err.message)
      );
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

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let isShuttingDown = false;
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\n[server] Shutting down gracefully...");
  try { await sock?.end(); } catch (_) {}
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("[server] Running at http://localhost:" + PORT);
  connectToWhatsApp();
});