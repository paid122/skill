/**
 * Real price history for P&L cards.
 *
 * Candles come from a market-data provider, fetched once when the user asks and saved
 * with the trade (so the card is stable, works offline and exports without refetching).
 * Shared by the browser (choosing what to fetch, drawing) and the /api/candles route
 * (fetching and parsing). Nothing here invents prices: if a provider has no data,
 * the card keeps the plain execution line.
 */
import type { Trade } from "./types";

export type CandleProvider = "binance" | "twelvedata" | "databento";
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d";
export interface Bar { t: number; o: number; h: number; l: number; c: number }
export interface TradeChart {
  provider: CandleProvider;
  dataSymbol: string;
  interval: CandleInterval;
  bars: Bar[];
  fetchedAt: string;
}

export const PROVIDERS: Record<CandleProvider, { name: string; covers: string; env: string | null; site: string }> = {
  binance: { name: "Binance", covers: "Crypto (spot pairs)", env: null, site: "binance.com" },
  twelvedata: { name: "Twelve Data", covers: "Stocks, ETFs, forex", env: "TWELVEDATA_API_KEY", site: "twelvedata.com" },
  databento: { name: "Databento", covers: "CME futures (NQ, ES, MNQ, CL, GC …)", env: "DATABENTO_API_KEY", site: "databento.com" },
};

export const INTERVAL_MS: Record<CandleInterval, number> = { "1m": 60e3, "5m": 300e3, "15m": 900e3, "1h": 3600e3, "1d": 86400e3 };
export const MAX_BARS = 400;

/** Best guess of provider and the provider's symbol for a trade. The user can override both. */
export function guessSource(t: Pick<Trade, "symbol" | "market">): { provider: CandleProvider; dataSymbol: string } {
  const raw = (t.symbol || "").toUpperCase().trim();
  const clean = raw.replace(/[^A-Z0-9]/g, "");
  if (t.market === "Crypto" || ((!t.market || t.market === "Other") && /^(BTC|ETH|SOL|XRP|DOGE|BNB|ADA|AVAX|LTC|LINK)/.test(clean))) {
    // BTCUSD / BTC/USD / BTC-USD → BTCUSDT (Binance quotes dollar pairs in USDT).
    const pair = clean.endsWith("USDT") ? clean : clean.endsWith("USD") ? `${clean}T` : `${clean}USDT`;
    return { provider: "binance", dataSymbol: pair };
  }
  if (t.market === "Futures" || t.market === "Commodities" || t.market === "Indices") {
    // Root symbol (NQZ6 → NQ, MNQ → MNQ) as the most-traded contract: NQ.v.0.
    const root = clean.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, "") || clean;
    return { provider: "databento", dataSymbol: `${root}.v.0` };
  }
  if (t.market === "Forex") {
    const p = clean.length === 6 ? `${clean.slice(0, 3)}/${clean.slice(3)}` : raw;
    return { provider: "twelvedata", dataSymbol: p };
  }
  return { provider: "twelvedata", dataSymbol: clean || raw };
}

/** Candle size and time window: the whole trade plus context on both sides, ~40–150 bars. */
export function pickWindow(executionTimes: string[], now = Date.now()): { interval: CandleInterval; from: number; to: number } | null {
  const ts = executionTimes.map((x) => new Date(x).getTime()).filter(Number.isFinite);
  if (!ts.length) return null;
  const t0 = Math.min(...ts), t1 = Math.max(...ts), d = t1 - t0;
  const interval: CandleInterval = d <= 90 * 60e3 ? "1m" : d <= 6 * 3600e3 ? "5m" : d <= 24 * 3600e3 ? "15m" : d <= 6 * 86400e3 ? "1h" : "1d";
  const iv = INTERVAL_MS[interval];
  const pad = Math.max(d * 0.35, 20 * iv);
  const from = Math.floor((t0 - pad) / iv) * iv;
  const to = Math.min(Math.ceil((t1 + pad) / iv) * iv, Math.floor(now / iv) * iv);
  if (to <= from) return null;
  return { interval, from, to };
}

/** Combine smaller bars into larger ones (Databento only serves 1m, 1h and 1d). */
export function aggregate(bars: Bar[], ms: number): Bar[] {
  const out: Bar[] = [];
  for (const b of [...bars].sort((a, z) => a.t - z.t)) {
    const t = Math.floor(b.t / ms) * ms;
    const last = out[out.length - 1];
    if (last && last.t === t) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; }
    else out.push({ t, o: b.o, h: b.h, l: b.l, c: b.c });
  }
  return out;
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN);
const valid = (b: Bar) => [b.t, b.o, b.h, b.l, b.c].every(Number.isFinite) && b.h >= b.l;

/** Binance /api/v3/klines: [[openTime, "o", "h", "l", "c", ...], ...] */
export function parseBinance(json: unknown): Bar[] {
  if (!Array.isArray(json)) throw new Error("Unexpected response from Binance");
  return json.map((k) => ({ t: num(k[0]), o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]) })).filter(valid);
}

/** Twelve Data /time_series: { values: [{ datetime: "2026-11-12 14:31:00", open: "…", … }], status } (newest first). */
export function parseTwelveData(json: unknown): Bar[] {
  const j = json as { status?: string; message?: string; values?: Record<string, string>[] };
  if (!j || j.status === "error") throw new Error(j?.message || "Twelve Data returned an error");
  if (!Array.isArray(j.values)) return [];
  return j.values
    .map((v) => ({ t: Date.parse(`${v.datetime.replace(" ", "T")}${v.datetime.length <= 10 ? "T00:00:00" : ""}Z`), o: num(v.open), h: num(v.high), l: num(v.low), c: num(v.close) }))
    .filter(valid)
    .sort((a, z) => a.t - z.t);
}

/** Databento timeseries.get_range, encoding=json, pretty_px & pretty_ts: one JSON record per line. */
export function parseDatabento(text: string): Bar[] {
  const bars: Bar[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { hd?: { ts_event?: string | number }; open: string; high: string; low: string; close: string };
    const ts = r.hd?.ts_event;
    const t = typeof ts === "string" && /^\d+$/.test(ts) ? Number(BigInt(ts) / 1_000_000n) : typeof ts === "string" ? Date.parse(ts) : num(ts) / 1e6;
    bars.push({ t, o: num(r.open), h: num(r.high), l: num(r.low), c: num(r.close) });
  }
  return bars.filter(valid).sort((a, z) => a.t - z.t);
}

/**
 * Do the recorded fills sit inside the provider's candles at those times?
 * A mismatch usually means a different contract month, venue or quote (e.g. USDT vs USD),
 * and the card says so instead of hiding it.
 */
export function fillsMatch(bars: Bar[], interval: CandleInterval, fills: { time: string; price: number }[]): boolean {
  const iv = INTERVAL_MS[interval];
  return fills.every((f) => {
    const t = new Date(f.time).getTime();
    const bar = bars.find((b) => t >= b.t && t < b.t + iv);
    if (!bar) return false;
    const tol = Math.max((bar.h - bar.l) * 0.5, Math.abs(bar.c) * 0.0005);
    return f.price >= bar.l - tol && f.price <= bar.h + tol;
  });
}
