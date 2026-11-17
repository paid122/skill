export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Last price and previous close for the Markets watchlist (non-crypto symbols, from Yahoo Finance's
 * free, delayed data). GET /api/quotes?s=NQ=F,ES=F,EURUSD=X → { quotes: { "NQ=F": { price, prevClose } } }
 * Cached 30 s per symbol, so one page refresh costs a handful of upstream requests at most.
 */
const cache = new Map<string, { at: number; q: { price: number; prevClose: number | null } | null }>();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function quote(symbol: string) {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 30_000) return hit.q;
  let q: { price: number; prevClose: number | null } | null = null;
  try {
    const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (Ledgr journal)", Accept: "application/json" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (r.ok) {
      const meta = (await r.json())?.chart?.result?.[0]?.meta;
      if (meta && Number.isFinite(meta.regularMarketPrice)) q = { price: meta.regularMarketPrice, prevClose: Number.isFinite(meta.chartPreviousClose) ? meta.chartPreviousClose : (Number.isFinite(meta.previousClose) ? meta.previousClose : null) };
    }
  } catch { /* leave null */ }
  cache.set(symbol, { at: Date.now(), q });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return q;
}

export async function GET(req: Request) {
  const list = (new URL(req.url).searchParams.get("s") ?? "").split(",").map((x) => x.trim()).filter((x) => /^[A-Za-z0-9.=^-]{1,20}$/.test(x)).slice(0, 40);
  if (!list.length) return json({ error: "Add symbols with ?s=" }, 400);
  const out = await Promise.all(list.map(async (s) => [s, await quote(s)] as const));
  return json({ quotes: Object.fromEntries(out) });
}
