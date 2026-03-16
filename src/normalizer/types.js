// Message type constants.
// Nothing outside this file should use raw strings for message types.

export const MESSAGE_TYPES = {
  TEXT:    "text",
  IMAGE:   "image",
  UNKNOWN: "unknown",
};

// Baileys raw msgType strings we actively support
export const SUPPORTED_BAILEYS_TYPES = new Set([
  "conversation",
  "extendedTextMessage",
  "imageMessage",
]);
