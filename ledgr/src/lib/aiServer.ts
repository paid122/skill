/** Shared request checks for the MatrixX AI route. Server only. */
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const MAX_CONTEXT_CHARS = 120_000;

// Simple per-client rate limit (per server instance).
const hits = new Map<string, number[]>();
export function limited(key: string, perMinute = 20) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > perMinute;
}

export interface AIBody { messages: { role: "user" | "assistant"; content: string }[]; context: string }

export function validateAI(b: unknown): AIBody | string {
  if (!b || typeof b !== "object") return "Invalid request body.";
  const { messages, context } = b as Partial<AIBody>;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return "Invalid conversation.";
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim() || m.content.length > MAX_MESSAGE_CHARS) return "Invalid message.";
  }
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") return "Conversation must start and end with a user message.";
  if (typeof context !== "string" || context.length > MAX_CONTEXT_CHARS) return "Journal context is missing or too large.";
  return { messages, context };
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
