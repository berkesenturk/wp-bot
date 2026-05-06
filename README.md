# WhatsApp AI Assistant

A self-hosted WhatsApp assistant that normalizes incoming messages into structured data, stores them in SQLite, and routes them to AI workers for extraction, summarization, and task detection. Built with a privacy-first design — PII is stripped before any data leaves the server.

---

## Stack

| Layer | Technology |
|---|---|
| WhatsApp protocol | Baileys (WebSocket, no browser) |
| Web server | Express + Socket.IO |
| Database | SQLite via better-sqlite3 |
| NLP / PII detection | compromise |
| Logging | Pino |

---

## Setup

```bash
npm install
npm start
```

On first run a QR code appears in the terminal **and** in the web UI at `http://localhost:3000`.

Open WhatsApp → Linked Devices → Link a Device → scan it.

The session is stored in SQLite (`data/messages.db`) and restored automatically on restart. You only need to scan the QR once unless you explicitly log out from WhatsApp.

---

## Resetting auth

If the session becomes invalid (401 error), clear it and re-scan:

```bash
npm run reset-auth
npm start
```

---

## Web UI

Open `http://localhost:3000` to access the console.

- **All / DMs / Groups** tabs — filter chats by type
- Click any chat to open the message thread
- Images render inline with lightbox on click
- Send messages from the compose bar (Enter to send, Shift+Enter for newline)
- QR section is hidden when session is already active

---

## REST API

### Send a message
```
POST /api/send
Content-Type: application/json

{ "jid": "32477123456@s.whatsapp.net", "message": "Hello" }
// or
{ "phone": "32477123456", "message": "Hello" }
```

### Get all chats
```
GET /api/chats
GET /api/chats?type=personal
GET /api/chats?type=group
```

### Get messages for a chat
```
GET /api/chats/:jid/messages
```

### Connection status
```
GET /api/status
```

---

## Message Pipeline

Every incoming message flows through this sequence:

```
WhatsApp (Baileys)
      ↓
Normalizer          — converts raw Baileys object to clean NormalizedMessage
      ↓
Media download      — images saved to /media immediately (not lazy)
      ↓
SQLite insert       — persisted before any processing
      ↓
UI update           — pushed to browser via Socket.IO
      ↓
Router              — dispatches to the correct worker by message type
      ↓
Worker (Phase 2)    — OCR / LLM / NLP processing
```

The normalizer is a pure function with no side effects. It returns `null` for unsupported message types (logged as a warning) and never throws.

---

## Supported Message Types

| Type | Handling |
|---|---|
| `text` | Normalized, stored, routed to LLM worker (Phase 2) |
| `image` | Downloaded immediately, caption moved to `text` field, routed to OCR worker (Phase 2) |
| `unknown` | Logged as warning, skipped |

---

## Privacy Layer

Before any text is sent to an external LLM provider, it passes through a two-layer PII sanitizer.

**Layer 1 — Structural (regex)**
Detects and replaces: phone numbers, email addresses, IBANs, credit card numbers, IP addresses, VAT numbers.

**Layer 2 — Named entities (NLP)**
Detects and replaces: person names, organizations, locations using the `compromise` library. Runs entirely locally — no API calls.

Each detected value is replaced with a numbered token (`[PERSON_1]`, `[EMAIL_2]`, etc.) and stored in a **persistent per-chat entity registry** in SQLite.

```
"Invoice from Enercon, approved by Ali Hassan at ali@company.com"
      ↓  sanitize(text, chatId)
"Invoice from [ORG_1], approved by [PERSON_1] at [EMAIL_1]"
      ↓  LLM provider sees only this
      ↓  rehydrate(output, map)
{ vendor: "Enercon", approver: "Ali Hassan", contact: "ali@company.com" }
```

**Cross-message consistency** — the registry ensures the same entity always gets the same token within a chat. If "Enercon" was `[ORG_1]` in message 1, it is still `[ORG_1]` in message 50.

**Chat isolation** — each chat has its own registry. "Enercon" in chat A and chat B get independent tokens.

### Testing the privacy layer

```bash
node src/privacy/test.js
```

### Using in a worker

```js
import { sanitize, rehydrate, loadMap } from "../privacy/index.js";

// Sanitize before LLM call
const { sanitized, map } = sanitize(msg.text, msg.chatId);
const rawOutput = await callLLM(sanitized);
const finalOutput = rehydrate(rawOutput, map);

// For async workers — load full registry for a chat
const map = loadMap(chatId);
const finalOutput = rehydrate(storedOutput, map);
```

---

## Project Structure

```
wp-bot/
├── index.js                      ← server, WhatsApp connection, message pipeline
├── package.json
├── data/
│   └── messages.db               ← SQLite (auto-created)
├── media/                        ← downloaded images (auto-created)
├── public/
│   └── index.html                ← web UI
└── src/
    ├── normalizer/
    │   ├── index.js              ← normalize(rawMsg) pure function
    │   └── types.js              ← MESSAGE_TYPES constants
    ├── router/
    │   └── index.js              ← dispatches NormalizedMessage to workers
    ├── workers/                  ← Phase 2: OCR, LLM, NLP workers
    ├── privacy/
    │   ├── index.js              ← sanitize(text, chatId), rehydrate(output, map)
    │   ├── structural.js         ← Layer 1: regex PII stripper
    │   ├── entities.js           ← Layer 2: NLP entity anonymizer
    │   ├── registry.js           ← persistent per-chat entity registry
    │   └── test.js               ← privacy layer test
    ├── auth/
    │   └── sqliteAuthState.js    ← Baileys session stored in SQLite
    └── db/
        ├── index.js              ← SQLite init, schema, tables
        └── messages.js           ← insert / query / update messages
```

---

## Database Schema

### `messages`
Stores all normalized incoming and outgoing messages.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Baileys message key |
| chat_id | TEXT | Stripped JID |
| chat_type | TEXT | `personal` or `group` |
| sender | TEXT | Phone number or `me` |
| timestamp | INTEGER | Unix seconds |
| type | TEXT | `text`, `image`, `unknown` |
| text | TEXT | Message content or image caption |
| media_mime | TEXT | MIME type for images |
| media_path | TEXT | Local file path |
| status | TEXT | `pending` → `processing` → `done` / `failed` |

### `entity_registry`
Persistent PII token map per chat, used by the privacy layer.

| Column | Type | Notes |
|---|---|---|
| chat_id | TEXT | Chat scope |
| token | TEXT | e.g. `[PERSON_1]` |
| value | TEXT | Original value |
| value_norm | TEXT | Lowercase for lookup |
| type | TEXT | `PERSON`, `ORG`, `PHONE`, etc. |
| first_seen | INTEGER | Unix timestamp |
| last_seen | INTEGER | Updated on each occurrence |
| count | INTEGER | How many times seen |

### `auth_state`
Baileys session credentials stored atomically in SQLite.

---

## Phone Number Format

Pass numbers without `+` or spaces:
- ✅ `32477123456` (Belgium +32)
- ✅ `14155552671` (US +1)
- ❌ `+32 477 12 34 56`

---

## Roadmap

| Phase | Status | Features |
|---|---|---|
| 1 — Infrastructure | ✅ Done | WhatsApp connection, message storage, normalization, UI, privacy layer |
| 2 — Image processing | 🔜 Next | OCR pipeline, invoice extraction, structured DB records |
| 3 — LLM capabilities | 🔜 | Summarization, task extraction, voice transcription |
| 4 — Search | 🔜 | Embedding generation, vector search, `@bot search` command |

---

## ⚠️ Important

This uses the **unofficial** WhatsApp Web protocol via Baileys.
- Suitable for internal tools and prototyping
- For production or commercial use, migrate to **Meta's official WhatsApp Business Cloud API**
- High-volume automated use may trigger account suspension