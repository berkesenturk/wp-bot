# WhatsApp Send/Receive Bot

A minimal but complete WhatsApp bot using **Baileys** (unofficial WhatsApp Web API).
Includes a REST API, real-time WebSocket UI, and media handling.

## Stack

- **Baileys** — WhatsApp Web protocol (no browser, pure WebSocket)
- **Express** — REST API (`POST /api/send`, `GET /api/messages`)
- **Socket.IO** — real-time message push to frontend
- **Pino** — logging

---

## Setup

```bash
npm install
npm start
```

On first run, a **QR code** appears in the terminal.
Open WhatsApp → Linked Devices → Link a Device → scan it.

The session is saved in `./auth_session/` — you won't need to re-scan unless logged out.

---

## REST API

### Send a message
```
POST /api/send
Content-Type: application/json

{
  "phone": "32477123456",
  "message": "Hello from the bot!"
}
```

### Get message history
```
GET /api/messages
GET /api/messages?phone=32477123456
```

### Check connection status
```
GET /api/status
```

---

## Project Structure

```
whatsapp-bot/
├── index.js          ← main server + WhatsApp logic
├── package.json
├── auth_session/     ← saved session (auto-created)
├── media/            ← downloaded media files (auto-created)
└── public/
    └── index.html    ← web UI
```

---

## Phone Number Format

Pass numbers **without** `+` or country code prefix spacing:
- ✅ `32477123456`  (Belgium +32)
- ✅ `14155552671`  (US +1)
- ❌ `+32 477 12 34 56`

---

## ⚠️ Important

This uses the **unofficial** WhatsApp Web protocol.
- Works for personal/internal tools and prototyping
- For production/commercial use, consider **Meta's official WhatsApp Business Cloud API**
- Account banning is possible with high-volume automated use
