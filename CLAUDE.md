# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # production
npm run dev        # development (node --watch, auto-restart on file change)

node src/privacy/test.js   # test privacy/PII sanitization layer
node src/workers/test.js   # test embedding worker
```

To reset a broken WhatsApp session (401 error), delete the `auth_state` rows from SQLite and restart:
```bash
node -e "import('better-sqlite3').then(({default:DB})=>{ const db=new DB('data/messages.db'); db.prepare('DELETE FROM auth_state').run(); console.log('cleared'); })"
npm start
```

There is no lint script or test runner configured.

## Environment

Requires a `.env` file with:
```
API_KEY=...            # Mistral API key — for LLM features (@bot commands, classification)
PHONE_NUMBER=905xxxxxxxxx  # required on first boot (no stored session) to auto-request pairing code
PORT=3000              # optional, defaults to 3000
```

The LLM worker (`src/workers/llm.js`) calls `https://router.requesty.ai/v1/chat/completions` using `meta-llama/llama-3.3-70b-instruct:free`.

## Architecture

The app is a self-hosted WhatsApp AI assistant. `index.js` is the single entry point — it wires Express + Socket.IO, the Baileys WhatsApp socket, and the SQLite database together.

### Message pipeline (in order)

Every incoming WhatsApp message flows:

1. **Baileys** → raw `messages.upsert` event
2. **Normalizer** (`src/normalizer/index.js`) — pure function, converts raw Baileys object to a `NormalizedMessage`. Returns `null` for unsupported types.
3. **Media download** — images written to `media/` immediately, path stored on the normalized object.
4. **SQLite insert** (`src/db/messages.js`) — persisted before any processing.
5. **Socket.IO emit** — `message` and `chat_updated` events pushed to the browser UI.
6. **Router dispatch** (`src/router/index.js`) — routes by message type to `handleText` or `handleImage`.
7. Inside `handleText`:
   - Lifecycle commands (`@bot start/stop/status`) — always handled, bypass active gate
   - **Active gate** — silent drop if bot not started in this chat
   - Privacy sanitize → enqueue for embedding (active chats only)
   - `@bot search` → `src/workers/search.js`
   - `@bot debug <query>` → raw vector retrieval with distance scores, no LLM
   - `@bot summarize/tasks/extract/<general>` → `src/workers/llm.js` → rehydrate → reply
   - Default (no `@bot`) → silent `classify()` via LLM

### Privacy / PII layer (`src/privacy/`)

Two-pass sanitizer that runs before any text goes to an external LLM:
- **Layer 1** (`structural.js`): regex replaces phones, emails, IBANs, credit cards, IPs, VAT numbers
- **Layer 2** (`entities.js`): NLP (compromise library, fully local) replaces PERSON/ORG/LOCATION names

Entities are replaced with numbered tokens (`[PERSON_1]`, `[ORG_2]`, etc.) stored in a **per-chat persistent registry** in SQLite (`entity_registry` table). The same entity always gets the same token within a chat. `rehydrate(output, map)` restores original values in LLM responses.

Usage pattern:
```js
const { sanitized, map } = sanitize(text, chatId);  // returns Map<token, value>
const raw = await callLLM(sanitized);
const final = rehydrate(raw, map);
```

### Embedding / search (`src/workers/`)

- **embedder.js**: loads `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384-dim, ~470MB on first download, 50+ languages including Turkish, CPU, quantized) via `@xenova/transformers`. Fully local — no API calls. Exports `MODEL_FINGERPRINT` for drift detection.
- **embedQueue.js**: serial queue (one embed at a time to avoid LanceDB write conflicts). `indexed` column in `messages` table tracks state: `0=pending, 1=done, -1=failed`. On startup, `checkModelVersion()` compares stored fingerprint (in `meta` table) against current model — on mismatch, resets all `indexed` flags and drops all vector tables so everything re-embeds with the new model. `backfill()` then re-queues anything with `indexed != 1`. Exports `queueDepth()` and `isProcessing()` for observability.
- **vectorStore.js**: LanceDB embedded vector store at `data/vectors/`. One table per chat, named `chat_<chatId>`. `search()` accepts `maxDistance` threshold (L2; default `1.0` ≈ cosine sim 0.5) and returns a `distance` field on each result.
- **search.js**: embeds the query and calls `vectorStore.search()`, then rehydrates results.

### Bot lifecycle (`src/router/lifecycle.js` + `src/db/chatSettings.js`)

Per-chat activation state stored in `chat_settings` table. Bot only processes messages in chats where it has been activated via `@bot start`. Only the person who activated it can stop it. Lifecycle commands bypass the active gate.

### Auth (`src/auth/sqliteAuthState.js`)

Baileys session credentials stored in the `auth_state` SQLite table (not in files). Session persists across restarts. On first run or after reset, a QR code is displayed in the terminal and at `http://localhost:3000`.

### In-memory chat index

`index.js` maintains a `chats` object as UI state (last N messages per chat, unread counts). On `connection.open`, it calls `restoreChatsFromDb()` to rebuild this from SQLite. The in-memory state is the source of truth for the REST API and Socket.IO; SQLite is the durable source of truth.

### REST API (debug / observability)

- `GET /api/search/status` — indexing health: `{ total, indexed, failed, pending, queue_depth, processing }`
- `GET /api/debug/search?chatId=<id>&q=<query>&k=10` — raw vector search with distance scores, no LLM. Useful for tuning `maxDistance`.

## Data storage

| Path | Contents |
|---|---|
| `data/messages.db` | SQLite — messages, entity_registry, chat_settings, auth_state, meta |
| `data/vectors/` | LanceDB vector store (one table per chat) |
| `media/` | Downloaded images from WhatsApp |

The `meta` table stores key/value pairs. Currently used for `embed_model` (the model fingerprint, checked on startup for drift detection).
