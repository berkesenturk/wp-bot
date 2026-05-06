// src/workers/vectorStore.js
//
// LanceDB vector store — one table per chat.
// Stores message embeddings for semantic search.
// LanceDB is embedded (no server), stored on disk alongside SQLite.

import * as lancedb from "@lancedb/lancedb";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DB_PATH    = path.join(__dirname, "../../data/vectors");

let db = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function getDB() {
  if (!db) {
    db = await lancedb.connect(DB_PATH);
    console.log("[vectorStore] Connected at", DB_PATH);
  }
  return db;
}

function tableName(chatId) {
  // LanceDB table names must be alphanumeric + underscore
  return "chat_" + chatId.replace(/[^a-zA-Z0-9]/g, "_");
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Insert or update a message embedding.
 * @param {object} params
 * @param {string} params.msgId
 * @param {string} params.chatId
 * @param {string} params.sender
 * @param {string} params.text       - sanitized text stored for retrieval
 * @param {string} params.originalText - rehydrated text for display
 * @param {number} params.timestamp
 * @param {number[]} params.vector   - 384-dimensional embedding
 */
export async function upsert({ msgId, chatId, sender, text, originalText, timestamp, vector }) {
  const conn  = await getDB();
  const tname = tableName(chatId);

  const record = [{
    id:           msgId,
    chat_id:      chatId,
    sender,
    text,
    original_text: originalText,
    timestamp,
    vector,        // LanceDB uses this for similarity search
  }];

  const tableNames = await conn.tableNames();
  if (tableNames.includes(tname)) {
    const table = await conn.openTable(tname);
    await table.add(record);
  } else {
    await conn.createTable(tname, record);
    console.log("[vectorStore] Created table:", tname);
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Find the top-k most semantically similar messages in a chat.
 * @param {string} chatId
 * @param {number[]} queryVector
 * @param {number} k            - max results to return
 * @param {object} opts
 * @param {number} [opts.from]        - min timestamp (Unix seconds)
 * @param {number} [opts.to]          - max timestamp (Unix seconds)
 * @param {number} [opts.maxDistance] - drop results above this L2 distance (default 1.0 ≈ cosine sim 0.5)
 * @returns {Promise<Array>}  each result includes a `distance` field
 */
export async function search(chatId, queryVector, k = 5, { from, to, maxDistance = 1.0 } = {}) {
  const conn  = await getDB();
  const tname = tableName(chatId);

  let table;
  try {
    table = await conn.openTable(tname);
  } catch {
    console.warn("[vectorStore] No table found for chat:", chatId);
    return [];
  }

  let query = table.search(queryVector).limit(k);
  if (from && to)  query = query.where(`timestamp >= ${from} AND timestamp <= ${to}`);
  else if (from)   query = query.where(`timestamp >= ${from}`);
  else if (to)     query = query.where(`timestamp <= ${to}`);

  const raw = await query.toArray();

  return raw
    .filter(r => r._distance <= maxDistance)
    .map(r => ({ ...r, distance: r._distance }));
}

/**
 * Count indexed vectors for a chat.
 * @param {string} chatId
 * @returns {Promise<number>}
 */
export async function count(chatId) {
  try {
    const conn  = await getDB();
    const table = await conn.openTable(tableName(chatId));
    return await table.countRows();
  } catch {
    return 0;
  }
}

/**
 * Delete a single message's vector from the store.
 */
export async function deleteVector(chatId, msgId) {
  try {
    const conn  = await getDB();
    const tname = tableName(chatId);
    const names = await conn.tableNames();
    if (!names.includes(tname)) return;
    const table = await conn.openTable(tname);
    await table.delete(`id = '${msgId.replace(/'/g, "''")}'`);
  } catch (err) {
    console.warn("[vectorStore] deleteVector failed:", err.message);
  }
}

/**
 * Drop the vector table for a single chat.
 */
export async function deleteVectorsByChat(chatId) {
  try {
    const conn  = await getDB();
    const tname = tableName(chatId);
    const names = await conn.tableNames();
    if (!names.includes(tname)) return;
    await conn.dropTable(tname);
    console.log("[vectorStore] Dropped table:", tname);
  } catch (err) {
    console.warn("[vectorStore] deleteVectorsByChat failed:", err.message);
  }
}

/**
 * Drop all chat vector tables. Called when the embedding model changes.
 */
export async function dropAllVectorTables() {
  const conn = await getDB();
  const names = await conn.tableNames();
  for (const name of names.filter(n => n.startsWith("chat_"))) {
    await conn.dropTable(name);
    console.log("[vectorStore] Dropped table:", name);
  }
}