import makeWASocket, {
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
import { useSQLiteAuthState } from "./src/auth/sqliteAuthState.js";

import { initDb }                    from "./src/db/index.js";
import { insertMessage, updateMediaPath } from "./src/db/messages.js";
import { normalize }                 from "./src/normalizer/index.js";
import { dispatch }                  from "./src/router/index.js";
import { MESSAGE_TYPES }             from "./src/normalizer/types.js";

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
app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

const chats = {};

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

// ── Media download — called immediately after normalization ───────────────────
async function downloadMedia(rawMsg, normalizedId, mimeType) {
  try {
    const buffer   = await downloadMediaMessage(rawMsg, "buffer", {});
    const ext      = mimeType?.split("/")[1]?.split(";")[0] ?? "bin";
    const filename = normalizedId + "." + ext;
    const filepath = path.join(MEDIA_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    console.log("[media] Saved:", filepath);
    return filepath;
  } catch (err) {
    console.error("[media] Download failed:", err.message);
    return null;
  }
}

let sock = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useSQLiteAuthState();

  const { version }          = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth:              state,
    printQRInTerminal: true,
    logger:            pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      io.emit("qr", qr);
      io.emit("status", { connected: false, message: "Scan QR code to connect" });
    }
    if (connection === "open") {
      console.log("[wa] Connected");
      io.emit("status", { connected: true, message: "Connected" });
    }
    if (connection === "close") {
      const code            = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      io.emit("status", { connected: false, message: "Disconnected. Reconnecting..." });
      if (shouldReconnect) connectToWhatsApp();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const rawMsg of messages) {

      // 1. Normalize
      const normalized = normalize(rawMsg);
      if (!normalized) continue;

      // 2. Download media immediately if image
      if (normalized.type === MESSAGE_TYPES.IMAGE) {
        const localPath = await downloadMedia(rawMsg, normalized.id, normalized.media.mimeType);
        if (localPath) {
          normalized.media.localPath = localPath;
        }
      }

      // 3. Persist to SQLite (media_path already set if download succeeded)
      try {
        insertMessage(normalized);
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

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\n[server] Shutting down gracefully...");
  try {
    await sock?.logout();   // tells WA server this is a clean disconnect
  } catch (_) {}
  try {
    await sock?.end();      // closes the WebSocket
  } catch (_) {}
  httpServer.close(() => {
    console.log("[server] HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000); // force exit after 3s
}

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException",  (err) => { console.error("[crash]", err); shutdown(); });
process.on("unhandledRejection", (err) => { console.error("[crash]", err); shutdown(); });

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("[server] Running at http://localhost:" + PORT);
  connectToWhatsApp();
});