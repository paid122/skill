"use client";
import { CandlestickSeries, createChart, createSeriesMarkers, CrosshairMode, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type SeriesMarker, type Time, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { useThemeColors } from "@/components/charts";
import { INTERVAL_MS, type Bar, type CandleInterval } from "@/lib/candles";
import type { MarketSymbol } from "@/lib/markets";

export interface ChartMark { time: number; price: number; kind: "entry" | "exit"; long: boolean; label: string }

/** Lightweight Charts plots in UTC; shift each bar so the axis reads in the trader's own time. */
const local = (ms: number) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / 1000) as UTCTimestamp;
/** Each bar on its candle's start (Yahoo stamps the forming candle with the last trade's time, e.g. 16:07 on a 5m chart). */
const toCandle = (b: Bar, iv: CandleInterval) => ({ time: local(Math.floor(b.t / INTERVAL_MS[iv]) * INTERVAL_MS[iv]), open: b.o, high: b.h, low: b.l, close: b.c });
/** Merge bars that land on the same candle (keeps the first open, the last close). */
function aligned(bars: Bar[], iv: CandleInterval) {
  const out: ReturnType<typeof toCandle>[] = [];
  for (const b of bars) {
    const c = toCandle(b, iv), last = out[out.length - 1];
    if (last && last.time === c.time) { last.high = Math.max(last.high, c.high); last.low = Math.min(last.low, c.low); last.close = c.close; }
    else if (!last || (c.time as number) > (last.time as number)) out.push(c);
  }
  return out;
}
/** Latest crypto candles straight from Binance's public REST API (used when the live socket can't connect). */
async function binanceRecent(symbol: string, iv: CandleInterval): Promise<Bar[]> {
  const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${iv}&limit=2`);
  const rows = (await r.json()) as [number, string, string, string, string][];
  return rows.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] }));
}
const BARS = 300;

async function loadBars(m: MarketSymbol, interval: CandleInterval, bars = BARS): Promise<Bar[]> {
  const to = Date.now(), from = to - bars * INTERVAL_MS[interval];
  const q = new URLSearchParams({ provider: m.provider, symbol: m.dataSymbol, interval, from: String(from), to: String(to) });
  const r = await fetch(`/api/candles?${q}`);
  const j = (await r.json()) as { bars?: Bar[]; error?: string };
  if (!r.ok || !j.bars) throw new Error(j.error ?? "Couldn't load prices.");
  return j.bars;
}

/**
 * LEDGR's market chart (TradingView Lightweight Charts). Crypto streams live from Binance's public
 * websocket; other markets refresh every 30 s from delayed data. Journal entries and exits are marked.
 */
export function MarketChart({ market, interval, marks, onPrice, onUpdate }: { market: MarketSymbol; interval: CandleInterval; marks: ChartMark[]; onPrice?: (price: number, at: number) => void; onUpdate?: (how: "live" | "polling" | "delayed", at: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markers = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceCb = useRef(onPrice);
  priceCb.current = onPrice;
  const updCb = useRef(onUpdate);
  updCb.current = onUpdate;
  const c = useThemeColors();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  // Create the chart once; restyle when the theme changes.
  useEffect(() => {
    if (!box.current) return;
    const ch = createChart(box.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: c.muted, fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", fontSize: 11, attributionLogo: true },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border },
      timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: { mode: CrosshairMode.Normal },
    });
    const s = ch.addSeries(CandlestickSeries, { upColor: c.pos, downColor: c.neg, borderVisible: false, wickUpColor: c.pos, wickDownColor: c.neg });
    chart.current = ch; series.current = s; markers.current = createSeriesMarkers(s, []);
    return () => { ch.remove(); chart.current = null; series.current = null; markers.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    chart.current?.applyOptions({ layout: { textColor: c.muted }, grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } }, rightPriceScale: { borderColor: c.border }, timeScale: { borderColor: c.border } });
    series.current?.applyOptions({ upColor: c.pos, downColor: c.neg, wickUpColor: c.pos, wickDownColor: c.neg });
  }, [c]);

  // Load history, then keep it fresh: crypto streams live (or polls every 2 s if the stream can't connect),
  // everything else refreshes every 15 s from delayed data.
  useEffect(() => {
    let live = true, ws: WebSocket | null = null, timer: ReturnType<typeof setInterval> | null = null, watchdog: ReturnType<typeof setTimeout> | null = null;
    const push = (bars: Bar[], how: "live" | "polling" | "delayed") => {
      if (!live || !series.current) return;
      for (const c of aligned(bars, interval)) { try { series.current.update(c); } catch { /* older than the last candle */ } }
      const l = bars[bars.length - 1];
      if (l) priceCb.current?.(l.c, Date.now());
      updCb.current?.(how, Date.now());
    };
    const poll = (how: "polling" | "delayed", ms: number, get: () => Promise<Bar[]>) => {
      if (timer) return;
      timer = setInterval(() => { get().then((b) => push(b, how)).catch(() => undefined); }, ms);
    };
    setState("loading");
    loadBars(market, interval).then((bars) => {
      if (!live || !series.current) return;
      series.current.setData(aligned(bars, interval));
      chart.current?.timeScale().scrollToRealTime();
      const last = bars[bars.length - 1];
      if (last) priceCb.current?.(last.c, last.t);
      setState("ready");
      if (market.live) {
        const fallback = () => { if (live) poll("polling", 2000, () => binanceRecent(market.dataSymbol, interval)); };
        try {
          ws = new WebSocket(`wss://data-stream.binance.vision/ws/${market.dataSymbol.toLowerCase()}@kline_${interval}`);
          ws.onmessage = (e) => {
            const k = JSON.parse(e.data)?.k;
            if (!k) return;
            if (watchdog) { clearTimeout(watchdog); watchdog = null; }
            push([{ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c }], "live");
          };
          ws.onerror = fallback;
          ws.onclose = fallback;
        } catch { fallback(); }
        // No message within 5 s (blocked network, firewall): switch to polling.
        watchdog = setTimeout(fallback, 5000);
      } else {
        poll("delayed", 15_000, () => loadBars(market, interval, 4));
      }
    }).catch((e) => { if (live) { setError(e instanceof Error ? e.message : "Couldn't load prices."); setState("error"); } });
    return () => {
      live = false;
      if (ws) { ws.onclose = null; ws.onerror = null; ws.close(); }
      if (timer) clearInterval(timer);
      if (watchdog) clearTimeout(watchdog);
    };
  }, [market, interval]);

  // Your journal's entries and exits on this market.
  useEffect(() => {
    const data = series.current?.data() ?? [];
    const first = data.length ? (data[0].time as number) : Infinity, lastT = data.length ? (data[data.length - 1].time as number) : -Infinity;
    const ms: SeriesMarker<Time>[] = marks
      .map((m) => {
        const bucket = Math.floor(m.time / INTERVAL_MS[interval]) * INTERVAL_MS[interval];
        const up = (m.kind === "entry") === m.long; // buying: long entry or short exit
        return { time: local(bucket), position: up ? "belowBar" : "aboveBar", color: m.kind === "entry" ? c.text : up ? c.pos : c.neg, shape: up ? "arrowUp" : "arrowDown", text: m.label, size: 1 } as SeriesMarker<Time>;
      })
      .filter((x) => (x.time as number) >= first && (x.time as number) <= lastT)
      .sort((a, b) => (a.time as number) - (b.time as number));
    markers.current?.setMarkers(ms);
  }, [marks, interval, c, state]);

  return (
    <div className="relative h-full w-full">
      <div ref={box} className="absolute inset-0" />
      {state !== "ready" && (
        <div className="absolute inset-0 grid place-items-center text-[13px] text-muted">
          {state === "loading" ? "Loading prices…" : <span className="max-w-sm text-center">{error}</span>}
        </div>
      )}
    </div>
  );
}
