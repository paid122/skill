"use client";
import { Droplet, Flame } from "lucide-react";
import { marketGlyph, symbolImage } from "@/lib/instrument";
import { forwardRef, useState } from "react";
import { INTERVAL_MS, locateByPrice, timesUnknown, type TradeChart } from "@/lib/candles";
import type { TradeMetrics } from "@/lib/calc";
import type { Trade } from "@/lib/types";
import { fmtMoney, fmtNum, fmtR, parseISODate } from "@/lib/util";
import { useBlobUrl } from "./BlobImage";
import { LogoMark } from "./Logo";
import { themeColors } from "./ShareCard";

/** Price with 2 decimals (up to 3 under 1,000, up to 5 under 10), without trailing zeros (6.27200 → 6.272). */
function fmtPrice(p: number | null) {
  if (p === null) return "—";
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: p >= 1000 ? 2 : p >= 10 ? 3 : 5 });
}

export interface PosterOptions { amounts: boolean; account: string | null; handle: string; currency: string }

/** Background media (the user's own image or video), dimmed and optionally blurred for legibility. */
function Media({ blobId, kind, dim, blur }: { blobId: string; kind: "image" | "video"; dim: number; blur: number }) {
  const { url } = useBlobUrl(blobId);
  const style = { filter: blur ? `blur(${blur}px)` : undefined, transform: blur ? "scale(1.06)" : undefined };
  return (
    <div data-poster-media className="absolute inset-0">
      {url && (kind === "video"
        // eslint-disable-next-line jsx-a11y/media-has-caption
        ? <video data-poster-video src={url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" style={style} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" style={style} />)}
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(0,0,0,${Math.min(0.95, dim + 0.2)}) 0%, rgba(0,0,0,${dim}) 45%, rgba(0,0,0,${Math.max(0, dim - 0.15)}) 100%)` }} />
    </div>
  );
}

function Pill({ at, text, below, color, label, labelText }: { at: readonly [number, number, ...unknown[]]; text: string; below: boolean; color: string; label: string; labelText: string }) {
  return (
    <g transform={`translate(${at[0]},${at[1]})`}>
      <circle r="6" fill={label} stroke={labelText} strokeWidth="2.5" />
      <g transform={`translate(0,${below ? 38 : -38})`}>
        <path d={below ? "M-7,-17 L0,-31 L7,-17 Z" : "M-7,17 L0,31 L7,17 Z"} fill={label} />
        <rect x="-42" y="-18" width="84" height="36" rx="12" fill={label} style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))" }} />
        <text x="0" y="6" textAnchor="middle" fontSize="17" fontWeight="800" fill={labelText} fontFamily="'Inter Variable', Inter, sans-serif">{text}</text>
      </g>
    </g>
  );
}

/**
 * Round market badge (top left). Order: the user's uploaded icon → the symbol's logo,
 * coin icon or flags → a Ledgr-drawn glyph (also used if a logo fails to load).
 */
function MarketBadge({ trade, bg, fg }: { trade: Trade; bg: string; fg: string }) {
  const iconId = trade.showcase?.icon ?? null;
  const { url } = useBlobUrl(iconId);
  const pic = symbolImage(trade.symbol, trade.market);
  const [failed, setFailed] = useState<string | null>(null);
  const g = marketGlyph(trade.symbol, trade.market);
  const size = g.text ? (g.text.length <= 1 ? 30 : g.text.length === 2 ? 24 : 19) : 0;
  const picKey = pic ? (pic.kind === "single" ? pic.src : pic.a + pic.b) : null;
  const showPic = !iconId && pic && failed !== picKey;
  const onError = () => setFailed(picKey);
  /* eslint-disable @next/next/no-img-element */
  if (showPic && pic.kind === "pair") {
    return (
      <span className="relative h-14 w-14 shrink-0" aria-label={`${trade.symbol} icon`}>
        <img src={pic.a} alt="" onError={onError} className="absolute left-0 top-0 h-10 w-10 rounded-full object-cover" style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.9)" }} />
        <img src={pic.b} alt="" onError={onError} className="absolute bottom-0 right-0 h-10 w-10 rounded-full object-cover" style={{ boxShadow: "0 0 0 2px rgba(255,255,255,0.9)" }} />
      </span>
    );
  }
  const isCoin = showPic && pic.kind === "single" && pic.src.startsWith("/symbols/");
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: showPic ? (isCoin ? "transparent" : "#FFFFFF") : bg, color: fg, boxShadow: "0 6px 24px rgba(0,0,0,0.25)" }} aria-label={`${trade.symbol} icon`}>
      {iconId && url ? <img src={url} alt="" className="h-full w-full object-cover" />
        : showPic && pic.kind === "single" ? <img src={pic.src} alt="" onError={onError} className={isCoin ? "h-full w-full" : "h-[62%] w-[62%] object-contain"} />
        : g.icon === "oil" ? <Droplet size={26} strokeWidth={2.4} fill={fg} />
        : g.icon === "gas" ? <Flame size={26} strokeWidth={2.4} />
        : <span className="font-extrabold leading-none tracking-[-0.03em]" style={{ fontSize: size }}>{g.text}</span>}
    </span>
  );
  /* eslint-enable @next/next/no-img-element */
}

/**
 * Real candles from the saved provider data, with Entry and Exit placed at the recorded
 * fill times and prices. Bars are spaced evenly (closed-market gaps are skipped).
 */
function PriceChart({ trade, chart, color, label, labelText }: { trade: Trade; chart: TradeChart; color: string; label: string; labelText: string }) {
  const bars = chart.bars;
  const W = 460, H = 330, pad = 12;
  const iv = INTERVAL_MS[chart.interval];
  const ex = [...trade.executions].sort((a, b) => a.time.localeCompare(b.time));
  // Scale to the line itself so it fills the space; the tags sit on the line.
  const closes = bars.map((b) => b.c);
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const step = (W - pad * 2) / bars.length;
  const xi = (i: number) => pad + (i + 0.5) * step;
  const y = (p: number) => (hi > lo ? pad + 22 + (1 - (p - lo) / (hi - lo)) * (H - pad * 2 - 44) : H / 2);
  const xt = (iso: string) => {
    const t = new Date(iso).getTime();
    let i = bars.findIndex((b) => t >= b.t && t < b.t + iv);
    if (i < 0) i = t < bars[0].t ? 0 : bars.length - 1;
    return pad + (i + Math.min(1, Math.max(0, (t - bars[i].t) / iv))) * step;
  };
  /** The point on the drawn line at a given x (between the two nearest closes). */
  const onLine = (x: number): [number, number] => {
    const u = Math.min(bars.length - 1, Math.max(0, (x - pad) / step - 0.5));
    const i = Math.floor(u), f = u - i;
    const c = i + 1 < bars.length ? closes[i] * (1 - f) + closes[i + 1] * f : closes[i];
    return [Math.min(xi(bars.length - 1), Math.max(xi(0), x)), y(c)];
  };
  const entry = ex.find((e) => e.kind === "entry");
  const exit = [...ex].reverse().find((e) => e.kind === "exit");
  // Without real times, place the tags where the price first traded through the entry, then the exit.
  const byPrice = timesUnknown(ex.map((e) => e.time)) && entry && exit ? locateByPrice(bars, entry.price, exit.price) : null;
  const ep = entry ? onLine(byPrice ? xi(byPrice.entry) : xt(entry.time)) : null;
  const xp = exit ? onLine(byPrice ? xi(byPrice.exit) : xt(exit.time)) : null;
  // Tag above the point unless it's near the top; if the two tags would collide, put them on opposite sides.
  let eBelow = ep ? ep[1] < 80 : false;
  let xBelow = xp ? xp[1] < 80 : false;
  if (ep && xp && eBelow === xBelow && Math.abs(ep[0] - xp[0]) < 96) { if (ep[1] <= xp[1]) { eBelow = false; xBelow = true; } else { eBelow = true; xBelow = false; } }
  const line = bars.map((b, i) => `${i ? "L" : "M"}${xi(i).toFixed(1)},${y(b.c).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label={`${chart.interval} price line with recorded entry and exit`} className="overflow-visible">
      <path d={line} fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }} />
      {ep && <Pill at={ep} text="Entry" below={eBelow} color={color} label={label} labelText={labelText} />}
      {xp && <Pill at={xp} text="Exit" below={xBelow} color={color} label={label} labelText={labelText} />}
    </svg>
  );
}

/**
 * The execution path: one point per recorded execution (time → price), in order.
 * Ledgr has no market data, so nothing between executions is drawn or implied.
 */
function ExecutionPath({ trade, color, label, labelText }: { trade: Trade; color: string; label: string; labelText: string }) {
  const ex = [...trade.executions].sort((a, b) => a.time.localeCompare(b.time));
  if (ex.length < 2) return null;
  const W = 460, H = 330, pad = 40;
  const ts = ex.map((e) => new Date(e.time).getTime());
  const ps = ex.map((e) => e.price);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), pMin = Math.min(...ps), pMax = Math.max(...ps);
  const x = (t: number, i: number) => (t1 > t0 ? pad + ((t - t0) / (t1 - t0)) * (W - pad * 2) : pad + (i / (ex.length - 1)) * (W - pad * 2));
  const y = (p: number) => (pMax > pMin ? pad + (1 - (p - pMin) / (pMax - pMin)) * (H - pad * 2) : H / 2);
  const pts = ex.map((e, i) => [x(ts[i], i), y(e.price), e.kind] as const);
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const firstEntry = pts.find((p) => p[2] === "entry")!;
  const lastExit = [...pts].reverse().find((p) => p[2] === "exit");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label="Execution path from recorded entries and exits" className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 10px ${color}66)` }} />
      {pts.slice(1, -1).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color} opacity=".7" />)}
      <Pill at={firstEntry} text="Entry" below={firstEntry[1] <= H / 2} color={color} label={label} labelText={labelText} />
      {lastExit && <Pill at={lastExit} text="Exit" below={lastExit[1] <= H / 2} color={color} label={label} labelText={labelText} />}
    </svg>
  );
}

export const PosterCard = forwardRef<HTMLDivElement, { trade: Trade; m: TradeMetrics; opts: PosterOptions }>(function PosterCard({ trade: t, m, opts }, ref) {
  const media = t.showcase?.media ?? null;
  const chart = t.showcase?.chart?.bars.length ? t.showcase.chart : null;
  const theme = themeColors(t.showcase?.background ?? "ledger");
  const onMedia = !!media;
  const fg = onMedia ? "#FFFFFF" : theme.fg;
  const sub = onMedia ? "rgba(255,255,255,0.62)" : theme.sub;
  const good = (m.r ?? m.net ?? 0) >= 0;
  // Points moved per unit, in the trade's favour (+) or against it (−). Used when there's no R
  // (no stop recorded) and the dollar amount is hidden, so the card never shows a bare dash.
  const points = m.avgEntry !== null && m.avgExit !== null ? (m.avgExit - m.avgEntry) * (t.direction === "short" ? -1 : 1) : null;
  const fmtPts = (p: number) => `${p >= 0 ? "+" : "−"}${fmtNum(Math.abs(p), Math.abs(p) < 1 ? 4 : 2)} pts`;
  const big = opts.amounts ? fmtMoney(m.net, opts.currency, { sign: true })
    : m.r !== null ? fmtR(m.r)
    : points !== null ? fmtPts(points)
    : "—";
  const date = parseISODate(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const noun = t.market === "Futures" ? "contract" : t.market === "Stocks" ? "share" : t.market === "Forex" || t.market === "Commodities" || t.market === "Indices" ? "lot" : "unit";
  const size = m.entryQty ? `${fmtNum(m.entryQty, m.entryQty % 1 ? 2 : 0)} ${noun}${m.entryQty === 1 ? "" : "s"}` : "—";
  // Big number shrinks for long amounts so it never runs into the chart.
  const bigSize = big.length <= 8 ? 92 : big.length <= 10 ? 78 : big.length <= 12 ? 66 : 56;

  return (
    <div ref={ref} className="relative overflow-hidden rounded-[28px]" style={{ width: 960, height: 504, background: theme.gradient ? `${theme.gradient}, ${theme.bg}` : theme.bg, color: fg, fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      {media && <Media {...media} />}
      <div className="relative flex h-full">
        <div className="flex flex-1 flex-col justify-between p-12">
          <div className="flex items-center gap-4">
            <MarketBadge trade={t} bg={onMedia ? "#FFFFFF" : theme.fg} fg={onMedia ? "#0A0A0A" : theme.bg} />
            <span className="text-[34px] font-bold tracking-tight">{t.symbol || "—"}</span>
            <span className="text-[15px] font-semibold uppercase tracking-[0.14em]" style={{ color: sub }}>{t.direction ?? ""} · {date}</span>
          </div>
          <div>
            <p className="font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: bigSize, color: onMedia ? fg : good ? theme.pos : theme.neg, textShadow: onMedia ? "0 8px 40px rgba(0,0,0,0.45)" : undefined }}>{big}</p>
            {opts.amounts && (m.r !== null || points !== null) && <p className="mt-2 font-mono text-[18px]" style={{ color: sub }}>{m.r !== null ? fmtR(m.r) : fmtPts(points!)}</p>}
          </div>
          <dl className="grid w-fit grid-cols-[110px_auto] gap-y-3 text-[22px]">
            <dt style={{ color: sub }}>Entry</dt><dd className="font-semibold">{fmtPrice(m.avgEntry)}</dd>
            <dt style={{ color: sub }}>Exit</dt><dd className="font-semibold">{fmtPrice(m.avgExit)}</dd>
            <dt style={{ color: sub }}>Size</dt><dd className="font-semibold">{size}</dd>
          </dl>
          <div className="flex items-center gap-3 text-[17px] font-bold">
            <span className="inline-flex items-center gap-2"><LogoMark size={26} /> LEDGR</span>
            {opts.handle && (
              <>
                <span style={{ color: sub }}>×</span>
                <span className="grid h-8 w-8 place-items-center rounded-full text-[14px] font-extrabold" style={{ background: onMedia ? "#FFFFFF" : theme.fg, color: onMedia ? "#0A0A0A" : theme.bg }}>{opts.handle.replace(/^@/, "").charAt(0).toUpperCase() || "·"}</span>
                <span>{opts.handle}</span>
              </>
            )}
            {opts.account && <span className="ml-2 text-[13px] font-medium" style={{ color: sub }}>{opts.account}</span>}
          </div>
        </div>
      </div>
      {/* Chart fills the right half, like a poster. */}
      <div className="absolute" style={{ left: 470, top: 74, width: 460, height: 330 }}>
        {chart
          ? <PriceChart trade={t} chart={chart} color={fg} label={onMedia ? "#FFFFFF" : theme.fg} labelText={onMedia ? "#0A0A0A" : theme.bg} />
          : <ExecutionPath trade={t} color={fg} label={onMedia ? "#FFFFFF" : theme.fg} labelText={onMedia ? "#0A0A0A" : theme.bg} />}
      </div>
    </div>
  );
});
