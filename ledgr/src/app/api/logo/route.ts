export const runtime = "nodejs";

/**
 * Company / index-owner logo for a ticker, fetched from Financial Modeling Prep's free
 * logo images and served from Ledgr's own origin (so card exports can include it).
 * 404 when there is no logo; the card then falls back to its drawn badge.
 */
const cache = new Map<string, { at: number; body: ArrayBuffer | null; type: string }>();

export async function GET(req: Request) {
  const s = (new URL(req.url).searchParams.get("s") ?? "").toUpperCase();
  if (!/^[A-Z0-9.]{1,12}$/.test(s)) return new Response("Invalid symbol", { status: 400 });
  let hit = cache.get(s);
  if (!hit || Date.now() - hit.at > 7 * 86400e3) {
    try {
      const r = await fetch(`https://financialmodelingprep.com/image-stock/${encodeURIComponent(s)}.png`, { signal: AbortSignal.timeout(10_000) });
      const type = r.headers.get("content-type") ?? "";
      hit = { at: Date.now(), body: r.ok && type.startsWith("image/") ? await r.arrayBuffer() : null, type };
    } catch {
      return new Response("Logo service unavailable", { status: 502 });
    }
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
    cache.set(s, hit);
  }
  if (!hit.body) return new Response("No logo", { status: 404, headers: { "Cache-Control": "public, max-age=86400" } });
  return new Response(hit.body, { headers: { "Content-Type": hit.type, "Cache-Control": "public, max-age=604800, immutable" } });
}
