"use client";
/**
 * The trade's real price chart on the trade page: candles around the trade with the entries and
 * exits marked, plus the stop and target. Uses the chart saved with the P&L card when there is one,
 * otherwise loads it from /api/candles (kept in memory for the session).
 */
import { useEffect, useMemo, useState } from "react";
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

function Candles({ t, bars, interval }: { t: Trade; bars: Bar[]; interval: CandleInterval }) {
  const W = 760, H = 320, padL = 8, padR = 64, padT = 14, padB = 26;
  const ex = useMemo(() => [...t.executions].sort((a, b) => a.time.localeCompare(b.time)), [t.executions]);
  // If the recorded prices are far from this market's (a CFD, another contract, or sample data),
  // scale to the candles and put the markers on the candle at each fill's time instead.
  const bLo = Math.min(...bars.map((b) => b.l)), bHi = Math.max(...bars.map((b) => b.h)), band = Math.max(bHi - bLo, bHi * 0.002);
  const near = (p: number) => p >= bLo - band && p <= bHi + band;
  const offScale = ex.some((e) => !near(e.price));
  const levels = offScale ? [] : [t.stopPrice, t.targetPrice].filter((p): p is number => p !== null && near(p));
  const prices = [bLo, bHi, ...(offScale ? [] : ex.map((e) => e.price)), ...levels];
  const lo = Math.min(...prices), hi = Math.max(...prices), span = hi - lo || 1;
  const step = (W - padL - padR) / bars.length;
  const x = (i: number) => padL + (i + 0.5) * step;
  const y = (p: number) => padT + (1 - (p - lo) / span) * (H - padT - padB);
  const iv = INTERVAL_MS[interval];
  const unknown = timesUnknown(ex.map((e) => e.time));
  const firstEntry = ex.find((e) => e.kind === "entry"), lastExit = [...ex].reverse().find((e) => e.kind === "exit");
  const byPrice = unknown && firstEntry && lastExit ? locateByPrice(bars, firstEntry.price, lastExit.price) : null;
  const barAt = (iso: string, kind: string) => {
    if (byPrice && !offScale) return kind === "entry" ? byPrice.entry : byPrice.exit;
    const tt = new Date(iso).getTime();
    let i = bars.findIndex((b) => tt >= b.t && tt < b.t + iv);
    if (i < 0) i = tt < bars[0].t ? 0 : bars.length - 1;
    return i;
  };
  const xAt = (iso: string, kind: string) => x(barAt(iso, kind));
  const yAt = (e: { time: string; kind: string; price: number }) => (offScale ? y(bars[barAt(e.time, e.kind)].c) : y(e.price));
  const long = t.direction !== "short";
  const fmt = (p: number) => fmtNum(p, span < 5 ? 4 : 2);
  const ticks = [hi, lo + span / 2, lo];
  const time = (ms: number) => new Date(ms).toLocaleString(undefined, interval === "1d" ? { month: "short", day: "numeric" } : { hour: "2-digit", minute: "2-digit" });
  const bw = Math.max(1, Math.min(9, step * 0.62));

  return (
    <div className="overflow-hidden rounded-xl border border-line-soft bg-bg-2/40">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${t.symbol} ${interval} price chart with entry and exit`}>
        {ticks.map((p) => (
          <g key={p}>
            <line x1={padL} x2={W - padR} y1={y(p)} y2={y(p)} stroke="var(--grid)" />
            <text x={W - padR + 6} y={y(p) + 4} fontSize="11" fill="var(--muted)" className="num">{fmt(p)}</text>
          </g>
        ))}
        {t.stopPrice !== null && levels.includes(t.stopPrice) && <PriceLine y={y(t.stopPrice)} x2={W - padR} color="var(--neg)" label={`Stop ${fmt(t.stopPrice)}`} below={t.targetPrice !== null && levels.includes(t.targetPrice) && y(t.stopPrice) > y(t.targetPrice)} />}
        {t.targetPrice !== null && levels.includes(t.targetPrice) && <PriceLine y={y(t.targetPrice)} x2={W - padR} color="var(--pos)" label={`Target ${fmt(t.targetPrice)}`} below={t.stopPrice !== null && levels.includes(t.stopPrice) && y(t.targetPrice) > y(t.stopPrice)} />}
        {bars.map((b, i) => {
          const up = b.c >= b.o, c = up ? "var(--pos)" : "var(--neg)";
          return (
            <g key={b.t} opacity={0.9}>
              <line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} stroke={c} strokeWidth="1" />
              <rect x={x(i) - bw / 2} y={y(Math.max(b.o, b.c))} width={bw} height={Math.max(1, Math.abs(y(b.o) - y(b.c)))} fill={c} rx="0.5" />
            </g>
          );
        })}
        {ex.map((e) => {
          const ex0 = xAt(e.time, e.kind), ey = yAt(e);
          // Arrow under the price for buys, over it for sells; flipped when it would leave the chart.
          let buy = (e.kind === "entry") === long;
          if (buy && ey + 34 > H - padB) buy = false; else if (!buy && ey - 34 < padT) buy = true;
          const tip = buy ? `M${ex0},${ey + 7} l-6,10 h12 z` : `M${ex0},${ey - 7} l-6,-10 h12 z`;
          return (
            <g key={e.id}>
              <line x1={ex0 - 12} x2={ex0 + 12} y1={ey} y2={ey} stroke="var(--text)" strokeWidth="1.5" />
              <path d={tip} fill={e.kind === "entry" ? "var(--text)" : "var(--accent)"} stroke="var(--bg)" strokeWidth="1" />
              <text x={ex0} y={buy ? ey + 30 : ey - 21} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">{e.kind === "entry" ? "Entry" : "Exit"}</text>
            </g>
          );
        })}
        <text x={padL} y={H - 8} fontSize="11" fill="var(--muted)">{time(bars[0].t)}</text>
        <text x={W - padR} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="end">{time(bars[bars.length - 1].t)} · {interval} candles</text>
      </svg>
      {offScale && <p className="border-t border-line-soft px-3 py-2 text-[12px] text-muted">Your recorded prices don&apos;t match this market&apos;s prices (a CFD, another contract month, or sample data), so the markers sit on the candle at your entry and exit times.</p>}
    </div>
  );
}

function PriceLine({ y, x2, color, label, below }: { y: number; x2: number; color: string; label: string; below?: boolean }) {
  return (
    <g>
      <line x1={8} x2={x2} y1={y} y2={y} stroke={color} strokeDasharray="5 5" strokeOpacity="0.8" />
      <text x={12} y={below ? y + 14 : y - 5} fontSize="11" fill={color}>{label}</text>
    </g>
  );
}
