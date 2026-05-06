// src/merger/index.js
//
// Buffers consecutive messages from the same sender per chat.
// After MERGE_WINDOW_MS of silence, flushes a single merged message.
// Ensures the LLM/search pipeline sees complete thoughts, not fragments.

const MERGE_WINDOW_MS = parseInt(process.env.MERGE_WINDOW_MS ?? "3000", 10);

const pending = new Map(); // `${chatId}::${sender}` → { msgs, jid, timer }

/**
 * Buffer a normalized message. onFlush is called with the merged result
 * once MERGE_WINDOW_MS passes with no new messages from this sender.
 *
 * @param {NormalizedMessage} normalized
 * @param {string}            jid       - raw Baileys JID for sending replies
 * @param {Function}          onFlush   - (mergedNormalized, jid) => void
 */
export function bufferAndMerge(normalized, jid, onFlush) {
  const key = `${normalized.chatId}::${normalized.sender}`;

  let buf = pending.get(key);
  if (!buf) {
    buf = { msgs: [], jid };
    pending.set(key, buf);
  }

  buf.msgs.push(normalized);

  if (buf.timer) clearTimeout(buf.timer);
  buf.timer = setTimeout(() => {
    pending.delete(key);
    const merged = mergeMessages(buf.msgs);
    if (buf.msgs.length > 1) {
      console.log(`[merger] Merged ${buf.msgs.length} messages from ${normalized.sender} in ${normalized.chatId}`);
    }
    onFlush(merged, buf.jid);
  }, MERGE_WINDOW_MS);
}

function mergeMessages(msgs) {
  if (msgs.length === 1) return msgs[0];

  const last = msgs.at(-1);

  // .text holds both plain text and image captions (normalizer puts caption in .text)
  const textParts = msgs.map(m => m.text ?? null).filter(Boolean);
  const combinedText = textParts.length ? textParts.join("\n") : null;

  // Preserve the last image's media object for storage and UI display
  const imageMsg = [...msgs].reverse().find(m => m.type === "image" && m.media);

  return {
    ...last,
    text:  combinedText,
    // Route as text when there's any text content so the full LLM pipeline runs.
    // Fall back to image only for a purely-image batch with no text/captions.
    type:  combinedText ? "text" : (imageMsg ? "image" : "text"),
    media: imageMsg?.media ?? last.media ?? undefined,
  };
}
