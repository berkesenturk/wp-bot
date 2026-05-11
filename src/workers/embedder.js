// src/workers/embedder.js
//
// Wraps @xenova/transformers for local text embedding.
// Model: paraphrase-multilingual-MiniLM-L12-v2 (384-dim, ~470MB on first download, 50+ languages including Turkish)
// Runs entirely in-process — no API calls, no PII leaves the machine.

import { pipeline, env } from "@xenova/transformers";

if (process.env.XENOVA_CACHE_DIR) env.cacheDir = process.env.XENOVA_CACHE_DIR;

let embedder  = null;
let isReady   = false;
let initError = null;

const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

// Bump this string whenever the model or quantization changes.
// Changing it triggers a full re-embed on next startup.
export const MODEL_FINGERPRINT = "Xenova/paraphrase-multilingual-MiniLM-L12-v2@quantized-v1";

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Load the embedding model. Must be called before embed().
 * Blocks until model is ready. Safe to call multiple times.
 */
export async function init() {
  if (isReady)   return;
  if (initError) throw initError;

  console.log("[embedder] Loading model:", MODEL, "(first run downloads ~470MB)");
  try {
    embedder = await pipeline("feature-extraction", MODEL, {
      quantized: true, // smaller, faster
    });
    isReady = true;
    console.log("[embedder] Model ready");
  } catch (err) {
    initError = err;
    console.error("[embedder] Failed to load model:", err.message);
    throw err;
  }
}

/**
 * Check if model is ready without throwing.
 */
export function ready() {
  return isReady;
}

// ── Embed ─────────────────────────────────────────────────────────────────────

/**
 * Convert text to a normalized embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>}  384-dimensional vector
 */
export async function embed(text) {
  if (!isReady) throw new Error("Embedder not initialized. Call init() first.");
  if (!text || !text.trim()) throw new Error("Cannot embed empty text.");

  const output = await embedder(text, {
    pooling:   "mean",
    normalize: true,  // unit vectors → cosine similarity = dot product
  });

  // Convert tensor to plain JS array
  return Array.from(output.data);
}

/**
 * Cosine similarity between two vectors (both must be normalized).
 * Returns value between -1 and 1. Higher = more similar.
 */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error("Vector dimension mismatch");
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // already normalized so magnitude = 1
}