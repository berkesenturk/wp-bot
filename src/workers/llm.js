// src/workers/llm.js
//
// Two modes:
//   1. classify(text)         — silent, runs on every message, no reply
//   2. respond(text, command) — @bot triggered, always replies
//      command is optional — if absent, LLM acts as general assistant

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
const MODEL       = "mistral-large-latest";


// ── Error types ───────────────────────────────────────────────────────────────

export class LLMUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

export class LLMParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "LLMParseError";
  }
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const PROMPTS = {
  // Silent classification — runs on every message
  classify: (text) => `
You are an assistant that processes WhatsApp messages for a small operations team.
Analyze the message and return a structured JSON object.

Classify the message into one or more of these types:
- "task"     — contains an action item, follow-up, or to-do
- "invoice"  — mentions payment, invoice, amount, vendor, or financial transaction
- "question" — asks something that needs an answer
- "info"     — shares information, status update, or decision
- "other"    — does not fit any category above

Return ONLY this JSON structure, nothing else:
{
  "types": ["task"],
  "summary": "one sentence describing the message",
  "tasks": [{ "description": "...", "assignee": null, "deadline": null }],
  "invoice": { "vendor": null, "amount": null, "currency": null, "date": null },
  "question": null
}

Only populate fields relevant to the detected types. Use null for irrelevant fields.
No markdown, no explanation, just the JSON.

Message:
${text}
`.trim(),

  // Default @bot — general assistant, conversational reply
  general: (text) => `
You are a helpful assistant embedded in a WhatsApp group for a small operations team.
Respond naturally and helpfully to the message below.
Keep your response concise — this is a chat, not an email.
Reply in plain text, no markdown formatting.

Message:
${text}
`.trim(),

  // @bot summarize — focused bullet point summary
  summarize: (text) => `
You are an assistant that summarizes WhatsApp messages for a small operations team.
Summarize the following message in 2-4 concise bullet points.
Return ONLY: { "summary": ["point 1", "point 2"] }
No markdown, no explanation, just the JSON.

Message:
${text}
`.trim(),

  // @bot tasks — extract action items
  tasks: (text) => `
You are an assistant that extracts actionable tasks from WhatsApp messages.
Extract all tasks, action items, or follow-ups.
For each task include: description, assignee (if mentioned), deadline (if mentioned).
Return ONLY: { "tasks": [{ "description": "...", "assignee": null, "deadline": null }] }
No markdown, no explanation, just the JSON.

Message:
${text}
`.trim(),

  // @bot extract — structured data extraction
  extract: (text) => `
You are an assistant that extracts structured data from WhatsApp messages.
Extract any structured information (invoice details, contacts, dates, amounts, decisions).
Return ONLY a flat JSON object with the fields you find.
No markdown, no explanation, just the JSON.

Message:
${text}
`.trim(),
};

// ── Command parser ────────────────────────────────────────────────────────────

/**
 * Parse @bot message into { command, body }.
 *
 * Examples:
 *   "@bot hello"              → { command: "general", body: "hello" }
 *   "@bot summarize meeting"  → { command: "summarize", body: "meeting" }
 *   "@bot tasks do this"      → { command: "tasks", body: "do this" }
 *
 * Returns null if message doesn't start with @bot.
 */
export function parseBotCommand(text) {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.toLowerCase().startsWith("@bot")) return null;

  const body    = trimmed.slice(4).trim();
  const parts   = body.split(/\s+/);
  const first   = parts[0]?.toLowerCase() ?? "";

  // Check if first word is a known specialized command
  const knownCommands = ["summarize", "tasks", "extract"];
  if (knownCommands.includes(first)) {
    return {
      command: first,
      body:    parts.slice(1).join(" ").trim(),
    };
  }

  // No recognized command — treat full body as general assistant query
  return {
    command: "general",
    body:    body,
  };
}

// ── Core API call ─────────────────────────────────────────────────────────────

async function callAPI(prompt) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY not set in environment");

  let response;
  try {
    response = await fetch(MISTRAL_URL, {
      method:  "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  512,
        temperature: 0.1,
        messages:    [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });
  } catch (err) {
    // Network error, DNS failure, timeout — API is unreachable
    console.error("[llm] API unreachable:", err.message);
    throw new LLMUnavailableError("AI service is currently unreachable. Please try again later.");
  }

  if (response.status === 401 || response.status === 403) {
    throw new LLMUnavailableError("AI service authentication failed. Check your API key.");
  }

  if (response.status === 429) {
    throw new LLMUnavailableError("AI service rate limit reached. Please wait a moment and try again.");
  }

  if (response.status >= 500) {
    const body = await response.text().catch(() => "");
    console.error("[llm] API server error:", response.status, body.substring(0, 100));
    throw new LLMUnavailableError("AI service is experiencing issues. Please try again shortly.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[llm] API error:", response.status, body.substring(0, 100));
    throw new LLMUnavailableError("AI service returned an error (" + response.status + "). Please try again.");
  }

  const data    = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  console.log("[llm] Raw response:", content.substring(0, 200));
  return content;
}

// ── Public: silent classification ─────────────────────────────────────────────

/**
 * Classify a message silently. No reply. Returns structured object.
 * @param {string} sanitizedText
 * @returns {Promise<object>}
 */
export async function classify(sanitizedText) {
  console.log("[llm] Classifying silently...");
  const content = await callAPI(PROMPTS.classify(sanitizedText));
  const clean   = content.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    throw new LLMParseError("Classification returned non-JSON: " + clean.substring(0, 100));
  }
}

// ── Public: @bot response ─────────────────────────────────────────────────────

/**
 * Run an @bot command and return a formatted reply string.
 * @param {string} command   - "general" | "summarize" | "tasks" | "extract"
 * @param {string} sanitizedText
 * @returns {Promise<{ raw: object|string, reply: string }>}
 */
export async function respond(command, sanitizedText) {
  console.log("[llm] Responding | command:", command);
  const content = await callAPI(PROMPTS[command](sanitizedText));

  // General command — plain text response, no JSON parsing needed
  if (command === "general") {
    return { raw: content, reply: content.trim() };
  }

  // Structured commands — parse JSON then format
  const clean = content.replace(/```json|```/g, "").trim();
  let raw;
  try {
    raw = JSON.parse(clean);
  } catch {
    throw new LLMParseError("LLM returned non-JSON: " + clean.substring(0, 100));
  }

  return { raw, reply: formatReply(command, raw) };
}

// ── Output formatter ──────────────────────────────────────────────────────────

export function formatReply(command, output) {
  try {
    if (command === "summarize") {
      const points = output.summary ?? [];
      if (!points.length) return "Could not generate a summary.";
      return "📋 *Summary*\n\n" + points.map(p => "• " + p).join("\n");
    }

    if (command === "tasks") {
      const tasks = output.tasks ?? [];
      if (!tasks.length) return "No tasks found in this message.";
      const lines = tasks.map((t, i) => {
        let line = (i + 1) + ". " + (t.description ?? "Unknown task");
        if (t.assignee) line += " — " + t.assignee;
        if (t.deadline) line += " _(by " + t.deadline + ")_";
        return line;
      });
      return "✅ *Tasks found*\n\n" + lines.join("\n");
    }

    if (command === "extract") {
      const entries = Object.entries(output).filter(([, v]) => v !== null);
      if (!entries.length) return "No structured data found.";
      const lines = entries.map(([k, v]) => {
        const key = k.charAt(0).toUpperCase() + k.slice(1);
        return "*" + key + ":* " + v;
      });
      return "🧾 *Extracted data*\n\n" + lines.join("\n");
    }

    return JSON.stringify(output, null, 2);
  } catch (err) {
    return "Error formatting response: " + err.message;
  }
}