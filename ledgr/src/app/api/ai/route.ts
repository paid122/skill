import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/ai";
import { clientIp, limited, validateAI, type AIBody } from "@/lib/aiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-5-5";
export async function GET() {
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }
  if (limited(clientIp(req))) return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });

  let parsed: AIBody | string;
  try { parsed = validateAI(await req.json()); } catch { parsed = "Invalid JSON."; }
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
