import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const MAX_CONTEXT_CHARS = 120_000;

// Simple per-client rate limit (per server instance).
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 20;
}

interface Body { messages: { role: "user" | "assistant"; content: string }[]; context: string }

function validate(b: unknown): Body | string {
  if (!b || typeof b !== "object") return "Invalid request body.";
  const { messages, context } = b as Partial<Body>;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return "Invalid conversation.";
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim() || m.content.length > MAX_MESSAGE_CHARS) return "Invalid message.";
  }
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") return "Conversation must start and end with a user message.";
  if (typeof context !== "string" || context.length > MAX_CONTEXT_CHARS) return "Journal context is missing or too large.";
  return { messages, context };
}

export async function GET() {
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });

  let parsed: Body | string;
  try { parsed = validate(await req.json()); } catch { parsed = "Invalid JSON."; }
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium" },
          system: [
            { type: "text", text: SYSTEM_PROMPT },
            { type: "text", text: `JOURNAL CONTEXT\n${parsed.context}` },
          ],
          messages: parsed.messages,
        });
        stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nI can't help with that request. I can review your own journal records, statistics and reflections."));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n_(Response truncated.)_"));
        }
        controller.close();
      } catch (e) {
        let msg = "Ledgr AI could not reach the model. Offline analysis is still available.";
        if (e instanceof Anthropic.AuthenticationError) msg = "The configured API key was rejected.";
        else if (e instanceof Anthropic.RateLimitError) msg = "The model is rate limited right now. Try again shortly.";
        else if (e instanceof Anthropic.APIError) msg = `The model returned an error (${e.status ?? "unknown"}).`;
        controller.enqueue(encoder.encode(`\n\n[[ledgr-error]] ${msg}`));
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
