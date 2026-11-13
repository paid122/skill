import { timingSafeEqual } from "node:crypto";
import { MATRIXX_API, STATE_COOKIE, callbackUrl } from "@/lib/matrixxConnect";

export const dynamic = "force-dynamic";

const back = (to: string, extra: Record<string, string> = {}) =>
  new Response(null, { status: 302, headers: { Location: to, "Set-Cookie": `${STATE_COOKIE}=; Path=/api/matrixx; Max-Age=0`, "Cache-Control": "no-store", ...extra } });

const same = (a: string, b: string) => a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * MatrixX sends people back here with a one-time code. This server swaps it for their MatrixX key and hands the key
 * to their browser (kept there, like a pasted key), then returns to the AI page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const saved = /(?:^|;\s*)ledgr_mx_state=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1] ?? "";
  if (url.searchParams.get("error")) return back("/ai?mx=cancelled");
  const code = url.searchParams.get("code") ?? "";
  if (!same(state, saved) || !/^mxa_[\w-]{10,100}$/.test(code)) return back("/ai?mx=failed");
  let key = "";
  try {
    const res = await fetch(`${MATRIXX_API()}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: callbackUrl(req) }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && typeof j.key === "string" && /^mxk_[\w-]{8,200}$/.test(j.key)) key = j.key;
  } catch { /* falls through */ }
  if (!key) return back("/ai?mx=failed");
  const html = `<!doctype html><meta charset="utf-8"><title>Connecting MatrixX…</title><meta name="robots" content="noindex">
<body style="background:#060606;color:#ededed;font:15px system-ui;display:grid;place-items:center;height:100vh">Connecting MatrixX…
<script>try{localStorage.setItem("ledgr.matrixxKey",${JSON.stringify(key)});localStorage.setItem("ledgr.matrixxVia","signin")}catch(e){}location.replace("/ai?mx=connected")</script>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Set-Cookie": `${STATE_COOKIE}=; Path=/api/matrixx; Max-Age=0` },
  });
}
