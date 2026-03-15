import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import express from "express";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";

// ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, { cors: { origin: "*" } });

app.use(express.json());

// Serve static files
const publicDir = path.join(__dirname, "public");
console.log("Static dir:", publicDir);
app.use(express.static(publicDir));

// Explicit root route
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

let sock = null;
const messageLog = [];

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_session");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("Scan QR code in WhatsApp -> Linked Devices");
      io.emit("qr", qr);
      io.emit("status", { connected: false, message: "Scan QR code to connect" });
    }
    if (connection === "open") {
      console.log("WhatsApp connected!");
      io.emit("status", { connected: true, message: "Connected" });
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting:", shouldReconnect);
      io.emit("status", { connected: false, message: "Disconnected. Reconnecting..." });
      if (shouldReconnect) connectToWhatsApp();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const msgType = Object.keys(msg.message)[0];
      const timestamp = new Date(msg.messageTimestamp * 1000).toISOString();

      let content = "";
      let mediaPath = null;

      if (msgType === "conversation") {
        content = msg.message.conversation;
      } else if (msgType === "extendedTextMessage") {
        content = msg.message.extendedTextMessage.text;
      } else if (msgType === "imageMessage") {
        content = msg.message.imageMessage.caption || "[Image]";
        mediaPath = await saveMedia(msg, "image", "jpg");
      } else if (msgType === "audioMessage") {
        content = "[Voice message]";
        mediaPath = await saveMedia(msg, "audio", "ogg");
      } else if (msgType === "documentMessage") {
        content = msg.message.documentMessage.fileName || "[Document]";
        mediaPath = await saveMedia(msg, "document", "pdf");
      } else if (msgType === "videoMessage") {
        content = msg.message.videoMessage.caption || "[Video]";
        mediaPath = await saveMedia(msg, "video", "mp4");
      } else {
        content = "[" + msgType + "]";
      }

      const record = {
        id: msg.key.id,
        direction: "incoming",
        from: formatJid(from),
        content,
        type: msgType,
        mediaPath,
        timestamp,
      };

      messageLog.push(record);
      console.log("Incoming [" + record.from + "]:", content);
      io.emit("message", record);
    }
  });
}

async function saveMedia(msg, type, ext) {
  try {
    const buffer = await downloadMediaMessage(msg, "buffer", {});
    const dir = path.join(__dirname, "media");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const filename = type + "_" + Date.now() + "." + ext;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
  } catch (err) {
    console.error("Media save error:", err.message);
    return null;
  }
}

function formatJid(jid) {
  return jid ? jid.replace(/@s\.whatsapp\.net|@g\.us/, "") : jid;
}

function toJid(phone) {
  const clean = phone.replace(/[\s\-\+]/g, "");
  return clean + "@s.whatsapp.net";
}

app.post("/api/send", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }
  if (!sock) {
    return res.status(503).json({ error: "WhatsApp not connected" });
  }
  try {
    const jid = toJid(phone);
    await sock.sendMessage(jid, { text: message });
    const record = {
      id: "out_" + Date.now(),
      direction: "outgoing",
      to: phone,
      content: message,
      type: "text",
      timestamp: new Date().toISOString(),
    };
    messageLog.push(record);
    io.emit("message", record);
    console.log("Sent to [" + phone + "]:", message);
    res.json({ success: true, record });
  } catch (err) {
    console.error("Send error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/messages", (req, res) => {
  const { phone } = req.query;
  if (phone) {
    return res.json(messageLog.filter((m) => m.from === phone || m.to === phone));
  }
  res.json(messageLog);
});

app.get("/api/status", (req, res) => {
  res.json({ connected: !!sock?.user });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
  connectToWhatsApp();
});