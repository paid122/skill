export const runtime = "nodejs";

/**
 * Logo for a prop firm, served from LEDGR's own origin (so it loads fast and can be cached).
 * GET /api/firm-logo?f=topstep → the firm's site icon, or 404 so the page shows its letter badge.
 * Used only to identify the firm next to the trader's own accounts.
 */
const DOMAINS: Record<string, string> = {
  apex: "apextraderfunding.com",
  lucid: "lucidtrading.com",
  topstep: "topstep.com",
  takeprofittrader: "takeprofittrader.com",
  tradeify: "tradeify.co",
  tradeday: "tradeday.com",
  myfundedfutures: "myfundedfutures.com",
};
const cache = new Map<string, { at: number; body: ArrayBuffer; type: string } | null>();
const DAY = 86_400_000;

async function fetchIcon(domain: string) {
  const sources = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`,
    `https://${domain}/apple-touch-icon.png`,
  ];
  for (const u of sources) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (LEDGR)" }, redirect: "follow" });
      const type = r.headers.get("content-type") ?? "";
      if (!r.ok || !type.startsWith("image/")) continue;
      const body = await r.arrayBuffer();
      // Google's generic globe for unknown sites is tiny; skip anything that small.
      if (body.byteLength < 600) continue;
      return { at: Date.now(), body, type };
    } catch { /* try the next source */ }
  }
  return null;
}

export async function GET(req: Request) {
  const key = (new URL(req.url).searchParams.get("f") ?? "").toLowerCase();
  const domain = DOMAINS[key];
  if (!domain) return new Response("Unknown firm", { status: 404 });
  let hit = cache.get(key);
  if (hit === undefined || (hit && Date.now() - hit.at > DAY) || (hit === null && Math.random() < 0.1)) {
    hit = await fetchIcon(domain);
    cache.set(key, hit);
  }
  if (!hit) return new Response("No logo", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return new Response(hit.body, { headers: { "Content-Type": hit.type, "Cache-Control": "public, max-age=604800, immutable" } });
}
