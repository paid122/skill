import { SYSTEM_PROMPT } from "@/lib/ai";
import { clientIp, limited, validateAI, type AIBody } from "@/lib/aiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MatrixX as the assistant on the AI page. MatrixX Cloud exposes an OpenAI-style API
 * (POST {MATRIXX_API_URL}/chat/completions, Bearer key). The key stays on this server.
 *   MATRIXX_API_KEY   – optional server key; otherwise each user connects their own key (x-matrixx-key)
 *   MATRIXX_API_URL   – default https://getmatrixx.com/v1
 *   MATRIXX_MODEL     – optional; otherwise the first model MatrixX lists
 * Answers stream back as plain text, with errors as "[[ledgr-error]] …".
 */
const KEY = () => process.env.MATRIXX_API_KEY ?? "";
/** The server key, or the user's own key from the "Connect MatrixX" box (sent per request, never stored or logged). */
const keyFor = (req: Request) => {
  if (KEY()) return KEY();
  const k = (req.headers.get("x-matrixx-key") ?? "").trim();
  return /^[\x21-\x7e]{8,512}$/.test(k) ? k : "";
};
const BASE = () => (process.env.MATRIXX_API_URL || "https://getmatrixx.com/v1").replace(/\/$/, "");
let cachedModel: string | null = null;

async function pickModel(key: string): Promise<string> {
  if (process.env.MATRIXX_MODEL) return process.env.MATRIXX_MODEL;
  if (cachedModel) return cachedModel;
  try {
    const r = await fetch(`${BASE()}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    const id = j?.data?.[0]?.id;
    if (typeof id === "string") return (cachedModel = id);
  } catch { /* fall through */ }
  return "auto";
}

function errorText(status: number, body: string) {
  try {
    const j = JSON.parse(body);
    const m = j?.error?.message ?? j?.detail ?? j?.message;
    if (m) return `MatrixX: ${String(m).slice(0, 200)}`;
  } catch { /* not JSON */ }
  return status === 401 || status === 403 ? "MatrixX rejected the key. Make a new one on getmatrixx.com/developers and connect again." : status === 429 ? "MatrixX is rate limited right now. Try again shortly." : `MatrixX returned an error (${status}).`;
}

export async function GET() {
  return Response.json({ configured: Boolean(KEY()) });
}

export async function POST(req: Request) {
  const key = keyFor(req);
  if (!key) return Response.json({ error: "not_configured" }, { status: 503 });
  if (limited(clientIp(req))) return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  let parsed: AIBody | string;
  try { parsed = validateAI(await req.json()); } catch { parsed = "Invalid JSON."; }
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  const body = parsed;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (t: string) => controller.enqueue(encoder.encode(t));
      try {
        const res = await fetch(`${BASE()}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, Accept: "text/event-stream" },
          body: JSON.stringify({
            model: await pickModel(key),
            stream: true,
            messages: [{ role: "system", content: `${SYSTEM_PROMPT}\n\nJOURNAL CONTEXT\n${body.context}` }, ...body.messages],
          }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok || !res.body) { send(`\n\n[[ledgr-error]] ${errorText(res.status, await res.text().catch(() => ""))}`); controller.close(); return; }
        const type = res.headers.get("content-type") ?? "";
        if (!type.includes("event-stream")) {
          // Non-streaming reply
          const j = await res.json().catch(() => null);
          const text = j?.choices?.[0]?.message?.content;
          send(typeof text === "string" && text ? text : "\n\n[[ledgr-error]] MatrixX sent an empty answer.");
          controller.close();
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", any = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const j = JSON.parse(data);
              if (j?.error) { send(`\n\n[[ledgr-error]] MatrixX: ${String(j.error.message ?? j.error).slice(0, 200)}`); continue; }
              const delta = j?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) { any = true; send(delta); }
            } catch { /* ignore keep-alives */ }
          }
        }
        if (!any) send("\n\n[[ledgr-error]] MatrixX sent an empty answer.");
        controller.close();
      } catch {
        send("\n\n[[ledgr-error]] Could not reach MatrixX. Offline analysis is still available.");
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
