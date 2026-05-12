# WhatsApp AI Assistant

A self-hosted WhatsApp assistant that indexes your message history and lets you query it with natural language. Built with a privacy-first design — PII is stripped before any data leaves the server.

---

## Stack

| Layer | Technology |
|---|---|
| WhatsApp protocol | Baileys (WebSocket, no browser) |
| Web server | Express + Socket.IO |
| Database | SQLite via better-sqlite3 |
| NLP / PII detection | compromise |
| Embeddings | Xenova paraphrase-multilingual-MiniLM-L12-v2 (local, CPU) |
| Vector store | LanceDB (embedded, per-chat tables) |
| Search | Hybrid: vector + BM25 + Reciprocal Rank Fusion |
| LLM | Mistral (`mistral-large-latest`) |
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

### Environment variables

Create a `.env` file:

```
API_KEY=...               # Mistral API key
PHONE_NUMBER=905xxxxxxxxx # required on first boot for pairing code
PORT=3000                 # optional, defaults to 3000
MERGE_WINDOW_MS=3000      # optional, message merge buffer in ms
```

---

## Docker

```bash
docker build -t wp-bot .
docker run -d --name wp-bot -p 3000:3000 --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/media:/app/media \
  -v $(pwd)/model-cache:/app/model-cache \
  wp-bot
```

The first start downloads the embedding model (~470 MB) into `model-cache/`. Mount it as a volume so it persists across container restarts.

---

## Resetting auth

If the session becomes invalid (401 error), clear it and re-scan:

```bash
node -e "import('better-sqlite3').then(({default:DB})=>{ const db=new DB('data/messages.db'); db.prepare('DELETE FROM auth_state').run(); console.log('cleared'); })"
npm start
```

---

## CLI tool

`scripts/wp-cli.sh` wraps the REST API for common operations:

| Command | Description |
|---|---|
| `wp start` | Start bot in dev mode (foreground) |
| `wp status` | Connection + indexing health |
| `wp pair [phone]` | Request WhatsApp pairing code |
| `wp connect` | Trigger reconnect |
| `wp reset` | Clear session (messages and vectors preserved) |
| `wp disconnect` | Logout and wipe ALL data |
| `wp logs [-f]` | Docker container logs |
| `wp index` | Embedding index health |

`wp pair` reads `PHONE_NUMBER` from `/etc/wp-bot.env` on EC2 if no argument is given.

---

## Web UI

Open `http://localhost:3000` to access the console.

- **All / DMs / Groups** tabs — filter chats by type
- Click any chat to open the message thread
- Images render inline with lightbox on click
- Send messages from the compose bar (Enter to send, Shift+Enter for newline)
- QR section is hidden when session is already active

---

## Bot Commands

Activate the bot in any chat first:

```
@bot start
```

Then use any of these commands:

| Command | Description |
|---|---|
| `@bot start` | Activate the bot in this chat |
| `@bot stop` | Deactivate the bot (only the activating user) |
| `@bot status` | Show activation status |
| `@bot <question>` | Ask anything — answered by the LLM |
| `@bot summarize <text>` | Bullet-point summary |
| `@bot tasks <text>` | Extract action items |
| `@bot extract <text>` | Extract structured data |
| `@bot search <query>` | Search message history (hybrid semantic + keyword) |
| `@bot debug <query>` | Raw vector results with distance scores (for tuning) |

Typing `hi`, `hello`, `hey`, `help`, or `ping` also triggers a static reply listing commands.

---

## Message Pipeline

Every incoming message flows through this sequence:

```
WhatsApp (Baileys)
      ↓
Merger              — buffers consecutive messages from same sender (3 s window)
      ↓
Normalizer          — converts raw Baileys object to clean NormalizedMessage
      ↓
Media download      — images saved to /media immediately (not lazy)
      ↓
SQLite insert       — persisted before any processing
      ↓
UI update           — pushed to browser via Socket.IO
      ↓
Router              — lifecycle gate → active gate → @bot dispatch
      ↓
Workers             — embedding queue, LLM calls, search
```

The normalizer is a pure function with no side effects. It returns `null` for unsupported message types (logged as a warning) and never throws.

---

## Search

`@bot search` uses **hybrid search** to find relevant messages:

1. Embeds the query with the same multilingual model used for indexing
2. Runs **vector search** (semantic similarity) and **BM25 keyword search** in parallel
3. Fuses the two ranked lists via **Reciprocal Rank Fusion (RRF)**
4. Sanitizes sender names in the result context before sending to the LLM
5. LLM synthesizes a natural-language answer from the retrieved messages

Indexing happens automatically in the background as messages arrive. The `@bot debug` command shows raw distance scores without LLM processing — useful for tuning the `maxDistance` threshold.

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

**Cross-message consistency** — the registry ensures the same entity always gets the same token within a chat.

**Chat isolation** — each chat has its own registry.

### Testing the privacy layer

```bash
node src/privacy/test.js
```

### Using in a worker

```js
import { sanitize, rehydrate, loadMap } from "../privacy/index.js";

const { sanitized, map } = sanitize(msg.text, msg.chatId);
const rawOutput = await callLLM(sanitized);
const finalOutput = rehydrate(rawOutput, map);

// For async workers — load full registry for a chat
const map = loadMap(chatId);
const finalOutput = rehydrate(storedOutput, map);
```

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

### WhatsApp pairing
```
POST /api/pair          { "phone": "905551234567" }
POST /api/connect       — trigger reconnect
POST /api/reset-auth    — clear session (data preserved)
POST /api/disconnect    — logout + wipe ALL data
```

### Indexing / search health
```
GET /api/search/status              — { total, indexed, failed, pending, queue_depth, processing }
GET /api/debug/search?chatId=<id>&q=<query>&k=10   — raw vector search with distance scores
GET /api/debug/search-trace?chatId=<id>&q=<query>  — verbose search trace
GET /api/debug/index-stats          — per-chat index statistics
```

### Delete messages
```
DELETE /api/messages/:id            — delete a single message
DELETE /api/chats/:jid/messages     — delete all messages in a chat
```

---

## Project Structure

```
wp-bot/
├── index.js                      ← server, WhatsApp connection, message pipeline, REST API
├── Dockerfile                    ← multi-stage build (builder + slim runtime)
├── package.json
├── scripts/
│   └── wp-cli.sh                 ← CLI wrapper for REST API
├── data/
│   └── messages.db               ← SQLite (auto-created)
├── media/                        ← downloaded images (auto-created)
├── public/
│   └── index.html                ← web UI
└── src/
    ├── merger/
    │   └── index.js              ← buffer consecutive messages, flush after MERGE_WINDOW_MS
    ├── normalizer/
    │   ├── index.js              ← normalize(rawMsg) pure function
    │   └── types.js              ← MESSAGE_TYPES constants
    ├── router/
    │   ├── index.js              ← message dispatch, @bot command router
    │   └── lifecycle.js          ← @bot start/stop/status handlers
    ├── workers/
    │   ├── embedder.js           ← Xenova embeddings (local, multilingual)
    │   ├── embedQueue.js         ← serial embed queue, backfill, model drift detection
    │   ├── vectorStore.js        ← LanceDB integration (one table per chat)
    │   ├── search.js             ← hybrid search: vector + BM25 + RRF fusion
    │   ├── llm.js                ← Mistral API, classify, respond, prompts
    │   └── test.js               ← worker tests
    ├── privacy/
    │   ├── index.js              ← sanitize(text, chatId), rehydrate(output, map)
    │   ├── structural.js         ← Layer 1: regex PII stripper
    │   ├── entities.js           ← Layer 2: NLP entity anonymizer
    │   ├── registry.js           ← persistent per-chat entity registry
    │   └── test.js               ← privacy layer test
    ├── auth/
    │   └── sqliteAuthState.js    ← Baileys session stored in SQLite
    ├── db/
    │   ├── index.js              ← SQLite init, schema, tables
    │   ├── messages.js           ← insert / query / update messages, FTS search
    │   └── chatSettings.js       ← per-chat bot activation state
    └── test/
        ├── search.test.js        ← standalone embedding + vector search test
        ├── search-tr.test.js     ← Turkish-language variant
        ├── seed-50.js            ← 50-message Turkish demo dataset
        ├── seed-100.js           ← 100-message dataset
        └── seed-1000.js          ← 1000-message stress test dataset
```

---

## Database Schema

### `messages`

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
| indexed | INTEGER | `0`=pending, `1`=done, `-1`=failed |

### `chat_settings`

| Column | Type | Notes |
|---|---|---|
| chat_id | TEXT PK | Chat scope |
| active | INTEGER | `0` or `1` |
| activated_by | TEXT | Sender who ran `@bot start` |
| activated_at | INTEGER | Unix timestamp |

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

### `meta`

Key/value store. Currently stores `embed_model` — the embedding model fingerprint checked on startup for drift detection. On mismatch all vectors are dropped and messages re-embedded.

### `auth_state`

Baileys session credentials stored atomically in SQLite.

### LanceDB vector tables

One table per chat at `data/vectors/`, named `chat_<chatId>`. Each row holds the message ID, sanitized text, original text, sender, timestamp, and 384-dimensional embedding vector.

---

## Phone Number Format

Pass numbers without `+` or spaces:
- ✅ `32477123456` (Belgium +32)
- ✅ `14155552671` (US +1)
- ❌ `+32 477 12 34 56`

---

## ⚠️ Important

This uses the **unofficial** WhatsApp Web protocol via Baileys.
- Suitable for internal tools and prototyping
- For production or commercial use, migrate to **Meta's official WhatsApp Business Cloud API**
- High-volume automated use may trigger account suspension
