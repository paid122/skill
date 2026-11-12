import { aggregate, INTERVAL_MS, MAX_BARS, parseBinance, parseDatabento, parseTwelveData, parseYahoo, PROVIDERS, yahooWindow, type Bar, type CandleInterval, type CandleProvider } from "@/lib/candles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historical candles for P&L cards. Keys stay on the server (.env.local):
 *   Binance      – no key (crypto)
 *   Yahoo        – no key (forex, futures, stocks, indices; unofficial endpoint, personal use)
 *   Twelve Data  – TWELVEDATA_API_KEY (stocks, ETFs, forex)
 *   Databento    – DATABENTO_API_KEY (CME futures)
 * GET /api/candles                      → which providers are configured
 * GET /api/candles?provider&symbol&interval&from&to   (from/to in epoch ms)
 */

const cache = new Map<string, { at: number; bars: Bar[] }>();
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 30;
}

const configured = (p: CandleProvider) => { const env = PROVIDERS[p].env; return !env || !!process.env[env]; };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function fetchText(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}
function errorMessage(text: string, fallback: string) {
  try { const j = JSON.parse(text); return String(j.detail ?? j.msg ?? j.message ?? fallback).slice(0, 300); } catch { return fallback; }
}
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

async function binance(symbol: string, interval: CandleInterval, from: number, to: number): Promise<Bar[]> {
  const u = new URL("https://data-api.binance.vision/api/v3/klines");
  u.search = new URLSearchParams({ symbol, interval, startTime: String(from), endTime: String(to - 1), limit: "1000" }).toString();
  const r = await fetchText(u.toString());
  if (!r.ok) throw new Error(errorMessage(r.text, `Binance returned ${r.status}`));
  return parseBinance(JSON.parse(r.text));
}

async function yahoo(symbol: string, interval: CandleInterval, from: number, to: number): Promise<Bar[]> {
  const iv = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "60m", "1d": "1d" }[interval];
  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  u.search = new URLSearchParams({ interval: iv, period1: String(Math.floor(from / 1000)), period2: String(Math.ceil(to / 1000)), includePrePost: "true" }).toString();
  const r = await fetchText(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 (Ledgr journal)", Accept: "application/json" } });
  if (!r.ok) {
    let msg = `Yahoo Finance returned ${r.status}`;
    try { msg = JSON.parse(r.text).chart?.error?.description ?? msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  return parseYahoo(JSON.parse(r.text));
}

async function twelvedata(symbol: string, interval: CandleInterval, from: number, to: number): Promise<Bar[]> {
  const iv = { "1m": "1min", "5m": "5min", "15m": "15min", "1h": "1h", "1d": "1day" }[interval];
  const u = new URL("https://api.twelvedata.com/time_series");
  u.search = new URLSearchParams({ symbol, interval: iv, start_date: utc(from), end_date: utc(to), timezone: "UTC", outputsize: "5000", order: "asc", apikey: process.env.TWELVEDATA_API_KEY! }).toString();
  const r = await fetchText(u.toString());
  if (!r.ok) throw new Error(errorMessage(r.text, `Twelve Data returned ${r.status}`));
  return parseTwelveData(JSON.parse(r.text));
}

async function databento(symbol: string, interval: CandleInterval, from: number, to: number): Promise<Bar[]> {
  const schema = interval === "1h" ? "ohlcv-1h" : interval === "1d" ? "ohlcv-1d" : "ohlcv-1m";
  const u = new URL("https://hist.databento.com/v0/timeseries.get_range");
  u.search = new URLSearchParams({
    dataset: "GLBX.MDP3", symbols: symbol, stype_in: /\.[cnv]\.\d+$/.test(symbol) ? "continuous" : "raw_symbol",
    schema, start: new Date(from).toISOString(), end: new Date(to).toISOString(), encoding: "json", pretty_px: "true", pretty_ts: "true",
  }).toString();
  const auth = Buffer.from(`${process.env.DATABENTO_API_KEY}:`).toString("base64");
  const r = await fetchText(u.toString(), { headers: { Authorization: `Basic ${auth}` } });
  if (!r.ok) throw new Error(errorMessage(r.text, `Databento returned ${r.status}`));
  const bars = parseDatabento(r.text);
  return interval === "5m" || interval === "15m" ? aggregate(bars, INTERVAL_MS[interval]) : bars;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!q.has("provider")) {
    return json({ providers: Object.fromEntries((Object.keys(PROVIDERS) as CandleProvider[]).map((p) => [p, { ...PROVIDERS[p], configured: configured(p) }])) });
  }
  const provider = q.get("provider") as CandleProvider;
  const symbol = (q.get("symbol") ?? "").trim();
  let interval = q.get("interval") as CandleInterval;
  let from = Number(q.get("from")), to = Number(q.get("to"));
  if (!(provider in PROVIDERS)) return json({ error: "Unknown data provider." }, 400);
  if (!/^[A-Za-z0-9./:_=^-]{1,32}$/.test(symbol)) return json({ error: "Enter a valid data symbol." }, 400);
  if (!(interval in INTERVAL_MS)) return json({ error: "Invalid candle size." }, 400);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to > Date.now() + 60_000) return json({ error: "Invalid time range." }, 400);
  if ((to - from) / INTERVAL_MS[interval] > MAX_BARS) return json({ error: "Time range is too long for this candle size." }, 400);
  if (!configured(provider)) return json({ error: `${PROVIDERS[provider].name} needs an API key. Add ${PROVIDERS[provider].env} to .env.local and restart Ledgr.`, needsKey: PROVIDERS[provider].env }, 400);
  if (limited(req.headers.get("x-forwarded-for") ?? "local")) return json({ error: "Too many requests. Try again in a minute." }, 429);

  // Yahoo keeps fine candles only for recent dates: use the finest size available.
  if (provider === "yahoo") ({ interval, from, to } = yahooWindow({ interval, from, to }));

  const key = `${provider}|${symbol}|${interval}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return json({ bars: hit.bars, interval });
  try {
    const fetcher = { binance, yahoo, twelvedata, databento }[provider];
    const bars = (await fetcher(symbol, interval, from, to)).filter((b) => b.t >= from && b.t < to);
    if (!bars.length) return json({ error: `${PROVIDERS[provider].name} has no ${interval} candles for ${symbol} at that time. Check the symbol, or the market may have been closed.` }, 404);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), bars });
    return json({ bars, interval });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return json({ error: `Could not load candles from ${PROVIDERS[provider].name}: ${msg}` }, 502);
  }
}
