import { timingSafeEqual } from "node:crypto";
import { BACK_COOKIE, MATRIXX_API, STATE_COOKIE, callbackUrl, safeBack } from "@/lib/matrixxConnect";

export const dynamic = "force-dynamic";

const clear = (h: Headers) => {
  h.append("Set-Cookie", `${STATE_COOKIE}=; Path=/api/matrixx; Max-Age=0`);
  h.append("Set-Cookie", `${BACK_COOKIE}=; Path=/api/matrixx; Max-Age=0`);
  return h;
};
const back = (to: string) => new Response(null, { status: 302, headers: clear(new Headers({ Location: to, "Cache-Control": "no-store" })) });

const same = (a: string, b: string) => a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * MatrixX sends people back here with a one-time code. This server swaps it for their MatrixX key and hands the key
 * to their browser (kept there, like a pasted key), then returns to the AI page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const cookies = req.headers.get("cookie") ?? "";
  const saved = /(?:^|;\s*)ledgr_mx_state=([^;]+)/.exec(cookies)?.[1] ?? "";
  let page = "/ai";
  try { page = safeBack(decodeURIComponent(/(?:^|;\s*)ledgr_mx_back=([^;]+)/.exec(cookies)?.[1] ?? "")); } catch { /* the AI page */ }
  if (url.searchParams.get("error")) return back(`${page}?mx=cancelled`);
  const code = url.searchParams.get("code") ?? "";
  if (!same(state, saved) || !/^mxa_[\w-]{10,100}$/.test(code)) return back(`${page}?mx=failed`);
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
  if (!key) return back(`${page}?mx=failed`);
  const html = `<!doctype html><meta charset="utf-8"><title>Connecting MatrixX…</title><meta name="robots" content="noindex">
<body style="background:#060606;color:#ededed;font:15px system-ui;display:grid;place-items:center;height:100vh">Connecting MatrixX…
<script>try{localStorage.setItem("ledgr.matrixxKey",${JSON.stringify(key)});localStorage.setItem("ledgr.matrixxVia","signin")}catch(e){}location.replace(${JSON.stringify(page + "?mx=connected")})</script>`;
  return new Response(html, {
    headers: clear(new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" })),
  });
}
