"use client";
/**
 * The trade's real price chart on the trade page, drawn with TradingView Lightweight Charts:
 * candles around the trade with the entries and exits marked, plus the stop and target. Uses the chart saved with the P&L card when there is one,
 * otherwise loads it from /api/candles (kept in memory for the session).
 */
import { CandlestickSeries, createChart, createSeriesMarkers, CrosshairMode, LineStyle, type SeriesMarker, type Time, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useThemeColors } from "@/components/charts";
import { dayWindow, guessSource, INTERVAL_MS, locateByPrice, pickWindow, timesUnknown, type Bar, type CandleInterval } from "@/lib/candles";
import type { Trade } from "@/lib/types";
import { fmtNum } from "@/lib/util";

const cache = new Map<string, { bars: Bar[]; interval: CandleInterval } | null>();

export function TradePriceChart({ t }: { t: Trade }) {
  const saved = t.showcase?.chart?.bars.length ? { bars: t.showcase.chart.bars, interval: t.showcase.chart.interval } : null;
  const times = t.executions.map((e) => e.time);
  const key = `${t.id}:${t.symbol}:${t.market}:${times.join("|")}`;
  const [data, setData] = useState<{ bars: Bar[]; interval: CandleInterval } | null>(saved ?? cache.get(key) ?? null);
  const [state, setState] = useState<"loading" | "ready" | "none">(saved || cache.get(key) ? "ready" : cache.has(key) ? "none" : "loading");

  useEffect(() => {
    if (saved) { setData(saved); setState("ready"); return; }
    if (cache.has(key)) { const c = cache.get(key)!; setData(c); setState(c ? "ready" : "none"); return; }
    if (!t.symbol || !times.length) { setState("none"); return; }
    const win = timesUnknown(times) ? dayWindow(times[0]) : pickWindow(times);
    if (!win) { setState("none"); return; }
    const { provider, dataSymbol } = guessSource(t);
    const q = new URLSearchParams({ provider, symbol: dataSymbol, interval: win.interval, from: String(win.from), to: String(win.to) });
    let live = true;
    setState("loading");
    fetch(`/api/candles?${q}`).then((r) => r.json()).then((j: { bars?: Bar[]; interval?: CandleInterval }) => {
      const v = j.bars?.length ? { bars: j.bars, interval: j.interval ?? win.interval } : null;
      cache.set(key, v);
      if (live) { setData(v); setState(v ? "ready" : "none"); }
    }).catch(() => { if (live) setState("none"); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!saved]);

  if (state === "loading") return <div className="grid h-[300px] place-items-center rounded-xl border border-line-soft bg-bg-2/40 text-[13px] text-muted"><span className="animate-pulse">Loading the price chart…</span></div>;
  if (state === "none" || !data) {
    return (
      <div className="grid h-[200px] place-items-center rounded-xl border border-dashed border-line-soft px-6 text-center text-[13px] text-muted">
        {!times.length ? "Add the entry and exit to see this trade's price chart." : "Price history isn't available for this symbol or date (free data covers about the last 2 months in small candles)."}
      </div>
    );
  }
  return <Candles t={t} bars={data.bars} interval={data.interval} />;
}

/** Lightweight Charts plots in UTC; shift each bar so the axis reads in the trader's own time. */
const local = (ms: number) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / 1000) as UTCTimestamp;

/** The symbol on TradingView, for the "Open in TradingView" link. */
function tvSymbol(t: Trade): string {
  const { provider, dataSymbol } = guessSource(t);
  if (provider === "binance") return `BINANCE:${dataSymbol}`;
  if (dataSymbol.endsWith("=F")) return `${dataSymbol.slice(0, -2)}1!`;
  if (dataSymbol.endsWith("=X")) return `FX:${dataSymbol.slice(0, -2)}`;
  return dataSymbol;
}

/** The trade's candles on TradingView Lightweight Charts, with entries, exits, stop and target. */
function Candles({ t, bars, interval }: { t: Trade; bars: Bar[]; interval: CandleInterval }) {
  const box = useRef<HTMLDivElement>(null);
  const c = useThemeColors();
  const ex = useMemo(() => [...t.executions].sort((a, b) => a.time.localeCompare(b.time)), [t.executions]);
  // If the recorded prices are far from this market's (a CFD, another contract, or sample data),
  // the markers sit above/below the candle at each fill's time instead of at the price.
  const bLo = Math.min(...bars.map((b) => b.l)), bHi = Math.max(...bars.map((b) => b.h)), band = Math.max(bHi - bLo, bHi * 0.002);
  const near = (p: number) => p >= bLo - band && p <= bHi + band;
  const offScale = ex.some((e) => !near(e.price));
  const long = t.direction !== "short";

  useEffect(() => {
    if (!box.current) return;
    const ch = createChart(box.current, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: c.muted, fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", fontSize: 11, attributionLogo: true },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: c.border, timeVisible: interval !== "1d", secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: true, handleScale: true,
    });
    const s = ch.addSeries(CandlestickSeries, { upColor: c.pos, downColor: c.neg, borderVisible: false, wickUpColor: c.pos, wickDownColor: c.neg });
    s.setData(bars.map((b) => ({ time: local(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));
    // Snap each fill to the start of its candle so the marker lands on a bar.
    const iv = INTERVAL_MS[interval];
    const unknown = timesUnknown(ex.map((e) => e.time));
    const firstEntry = ex.find((e) => e.kind === "entry"), lastExit = [...ex].reverse().find((e) => e.kind === "exit");
    const byPrice = unknown && firstEntry && lastExit && !offScale ? locateByPrice(bars, firstEntry.price, lastExit.price) : null;
    const barTime = (iso: string, kind: string) => {
      if (byPrice) return bars[kind === "entry" ? byPrice.entry : byPrice.exit].t;
      const tt = new Date(iso).getTime();
      const b = bars.find((x) => tt >= x.t && tt < x.t + iv) ?? (tt < bars[0].t ? bars[0] : bars[bars.length - 1]);
      return b.t;
    };
    const marks = ex.map((e): SeriesMarker<Time> => {
      const buy = (e.kind === "entry") === long;
      // Exits: green when the exit is better than the first entry, red when it's worse.
      const gain = firstEntry ? (e.price - firstEntry.price) * (long ? 1 : -1) : 0;
      const color = e.kind === "entry" ? c.accent : gain >= 0 ? c.pos : c.neg;
      return offScale
        ? { time: local(barTime(e.time, e.kind)), position: buy ? "belowBar" as const : "aboveBar" as const, shape: buy ? "arrowUp" as const : "arrowDown" as const, color, text: e.kind === "entry" ? "Entry" : "Exit" }
        : { time: local(barTime(e.time, e.kind)), position: buy ? "atPriceBottom" as const : "atPriceTop" as const, price: e.price, shape: buy ? "arrowUp" as const : "arrowDown" as const, color, text: `${e.kind === "entry" ? "Entry" : "Exit"} ${fmtNum(e.price, 2)}` };
    }).sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(s, marks);
    if (!offScale) {
      if (t.stopPrice !== null && near(t.stopPrice)) s.createPriceLine({ price: t.stopPrice, color: c.neg, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Stop" });
      if (t.targetPrice !== null && near(t.targetPrice)) s.createPriceLine({ price: t.targetPrice, color: c.pos, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Target" });
      for (const e of ex) if (e.kind === "entry") { s.createPriceLine({ price: e.price, color: c.text2, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: "" }); break; }
    }
    ch.timeScale().fitContent();
    return () => ch.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, interval, c, offScale, t.stopPrice, t.targetPrice, ex, long]);

  return (
    <div className="overflow-hidden rounded-xl border border-line-soft bg-bg-2/40">
      <div ref={box} className="h-[340px] w-full" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-3 py-2 text-[12px] text-muted">
        <span>{interval} candles · scroll or pinch to zoom</span>
        <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol(t))}`} target="_blank" rel="noreferrer" className="text-text-2 hover:text-text">Open in TradingView ↗</a>
      </div>
      {offScale && <p className="border-t border-line-soft px-3 py-2 text-[12px] text-muted">Your recorded prices don&apos;t match this market&apos;s prices (a CFD, another contract month, or sample data), so the markers sit on the candle at your entry and exit times.</p>}
    </div>
  );
}
