export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Video suggestions for the Study room, from the official YouTube Data API v3.
 * Needs YOUTUBE_API_KEY (server only). Without it the page links to YouTube searches instead.
 *   GET /api/youtube           → { configured }
 *   GET /api/youtube?q=...     → { videos: [{ id, title, channel, thumb, published }] }
 * Results are cached for 12 hours per query (each search costs API quota).
 */
interface Video { id: string; title: string; channel: string; thumb: string; published: string }

const cache = new Map<string, { at: number; videos: Video[] }>();
const TTL = 12 * 60 * 60 * 1000;
const hits = new Map<string, number[]>();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const key = () => (process.env.YOUTUBE_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!q) return json({ configured: !!key() });
  if (!key()) return json({ configured: false, videos: [] });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return json({ error: "Too many requests. Try again in a minute." }, 429);

  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.at < TTL) return json({ configured: true, videos: hit.videos });

  const api = new URL("https://www.googleapis.com/youtube/v3/search");
  api.search = new URLSearchParams({
    part: "snippet", q, type: "video", maxResults: "4", safeSearch: "strict", relevanceLanguage: "en",
    videoEmbeddable: "true", videoDuration: "medium", order: "relevance", key: key(),
  }).toString();
  try {
    const res = await fetch(api, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) return json({ configured: true, videos: [], error: `YouTube returned an error (${res.status}).` }, 502);
    const data = await res.json() as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string }; high?: { url?: string } } } }[] };
    const videos: Video[] = (data.items ?? []).filter((i) => i.id?.videoId).map((i) => ({
      id: i.id!.videoId!,
      title: decode(i.snippet?.title ?? ""),
      channel: decode(i.snippet?.channelTitle ?? ""),
      thumb: i.snippet?.thumbnails?.medium?.url ?? i.snippet?.thumbnails?.high?.url ?? `https://i.ytimg.com/vi/${i.id!.videoId}/mqdefault.jpg`,
      published: i.snippet?.publishedAt ?? "",
    }));
    cache.set(q.toLowerCase(), { at: Date.now(), videos });
    return json({ configured: true, videos });
  } catch {
    return json({ configured: true, videos: [], error: "Couldn't reach YouTube." }, 502);
  }
}
