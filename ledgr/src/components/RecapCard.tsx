"use client";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { SITE_HOST } from "@/lib/contact";
import { weekRows, type Recap } from "@/lib/recap";
import { fmtMoney, fmtR, parseISODate } from "@/lib/util";
import { LogoMark } from "./Logo";
import { COUNT_POP_SECONDS, COUNT_UP_SECONDS, countUpProgress, Media, useCountUp } from "./PosterCard";
import { themeColors } from "./ShareCard";

export type RecapFormat = "post" | "story";

export interface RecapOptions {
  amounts: boolean;
  currency: string;
  handle: string;
  avatar?: string | null;
  media?: { blobId: string; kind: "image" | "video"; dim: number; blur: number } | null;
}

/** Post: wide for weeks, square for months. Story: 9:16 for either. */
export function recapSize(kind: Recap["kind"], format: RecapFormat) {
  if (format === "story") return { width: 540, height: 960 };
  return kind === "week" ? { width: 960, height: 504 } : { width: 720, height: 720 };
}

const FONT = "'Inter Variable', Inter, system-ui, sans-serif";
// Fine film grain, so flat backgrounds feel printed rather than digital.
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

/** A recap value at count-up progress `p`: currency (with sign) or R. */
export function recapValue(v: number, o: Pick<RecapOptions, "amounts" | "currency">, p = 1) {
  return o.amounts ? fmtMoney(v * p, o.currency, { sign: true }) : fmtR(v * p);
}

/** The numbers that count up besides the total, keyed by `data-count`. Shared by the card and the video export. */
export function recapCounts(r: Recap, o: Pick<RecapOptions, "amounts" | "currency">): Record<string, (p: number) => string> {
  return {
    trades: (p) => String(Math.round(r.trades * p)),
    winrate: (p) => (r.winRate === null ? "—" : `${Math.round(r.winRate * 100 * p)}%`),
    green: (p) => `${Math.round(r.greenDays * p)} of ${r.days.length}`,
    best: (p) => (r.best ? recapValue(r.best.value, o, p) : "—"),
  };
}

function shortDate(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Shrinks the big number until it fits `room` pixels. */
function useFit(text: string, max: number, room: number) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [size, setSize] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = `${max}px`;
      const w = el.scrollWidth;
      const next = w > room ? Math.max(34, Math.floor((max * room) / w)) : max;
      el.style.fontSize = `${next}px`;
      setSize(next);
    };
    fit();
    let live = true;
    document.fonts?.ready.then(() => { if (live) fit(); });
    return () => { live = false; };
  }, [text, max, room]);
  return { ref, size };
}

/** A number that counts up in step with the big total. The final text sets the size; the counting text sits on top. */
function CountText({ id, at, replayKey, className, style }: { id: string; at: (p: number) => string; replayKey: unknown; className?: string; style?: CSSProperties }) {
  const final = at(1);
  const ref = useRef<HTMLSpanElement>(null);
  const atRef = useRef(at);
  atRef.current = at;
  useLayoutEffect(() => { if (ref.current) ref.current.textContent = final; }, [final]);
  useEffect(() => {
    const el = ref.current;
    if (!el || final === "—" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const sec = (now - t0) / 1000;
      const q = countUpProgress(sec);
      el.textContent = q >= 1 ? (el.dataset.final ?? "") : atRef.current(q);
      if (sec < COUNT_UP_SECONDS + COUNT_POP_SECONDS) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); el.textContent = el.dataset.final ?? el.textContent; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);
  return (
    <span className={`relative inline-block whitespace-nowrap tabular-nums ${className ?? ""}`} style={style}>
      <span aria-hidden className="invisible">{final}</span>
      <span ref={ref} data-count={id} data-final={final} className="absolute left-0 top-0" />
    </span>
  );
}

interface Palette { fg: string; sub: string; faint: string; pos: string; neg: string; onMedia: boolean; theme: ReturnType<typeof themeColors> }

function Footer({ o, c, host = true }: { o: RecapOptions; c: Palette; host?: boolean }) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3 text-[16px] font-bold" style={{ color: c.fg }}>
        <span className="inline-flex items-center gap-2"><LogoMark size={24} /> LEDGR</span>
        {o.handle && (
          <>
            <span style={{ color: c.sub }}>×</span>
            {o.avatar
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={o.avatar} alt="" className="h-7 w-7 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${c.onMedia ? "#FFFFFF" : c.theme.fg}` }} />
              : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold" style={{ background: c.onMedia ? "#FFFFFF" : c.theme.fg, color: c.onMedia ? "#0A0A0A" : c.theme.bg }}>{o.handle.replace(/^@/, "").charAt(0).toUpperCase() || "·"}</span>}
            <span className="truncate">{o.handle}</span>
          </>
        )}
      </div>
      {host && <span className="shrink-0 text-[14px] font-semibold tracking-tight" style={{ color: c.sub }}>{SITE_HOST}</span>}
    </div>
  );
}

/** The four stats, split by hairlines. */
function Stats({ r, o, c, replayKey, cols = 4, align = "left" }: { r: Recap; o: RecapOptions; c: Palette; replayKey: unknown; cols?: 2 | 4; align?: "left" | "center" }) {
  const counts = recapCounts(r, o);
  const bestWhen = r.best ? (r.kind === "week" ? parseISODate(r.best.date).toLocaleDateString("en-US", { weekday: "long" }) : shortDate(r.best.date)) : "";
  const items: [string, string, string?][] = [["Trades", "trades"], ["Win rate", "winrate"], ["Green days", "green"], ["Best day", "best", bestWhen]];
  return (
    <div className={`grid w-full ${cols === 4 ? "grid-cols-4" : "grid-cols-2 gap-y-6"}`}>
      {items.map(([label, id, note], i) => (
        <div key={id} className={`min-w-0 px-4 ${align === "center" ? "text-center" : ""} ${i % cols === 0 ? "pl-0" : ""}`} style={i % cols ? { borderLeft: `1px solid ${c.faint}` } : undefined}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: c.sub }}>{label}</p>
          <p className="mt-2 text-[24px] font-bold leading-none tracking-tight" style={{ color: id === "best" && r.best ? (r.best.value >= 0 ? c.pos : c.neg) : c.fg }}>
            <CountText id={id} at={counts[id]} replayKey={replayKey} />
          </p>
          {note && <p className="mt-1.5 truncate text-[12px] font-medium" style={{ color: c.sub }}>{note}</p>}
        </div>
      ))}
    </div>
  );
}

function Badge({ text, c }: { text: string; c: Palette }) {
  return <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em]" style={{ color: c.fg, background: c.onMedia ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)", border: `1px solid ${c.faint}` }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.pos }} />{text}
  </span>;
}

export const RecapCard = forwardRef<HTMLDivElement, { recap: Recap; opts: RecapOptions; format?: RecapFormat }>(function RecapCard({ recap: r, opts: o, format = "post" }, ref) {
  const theme = themeColors("ledger");
  const onMedia = !!o.media;
  const c: Palette = {
    fg: onMedia ? "#FFFFFF" : theme.fg,
    sub: onMedia ? "rgba(255,255,255,0.66)" : theme.sub,
    faint: onMedia ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
    pos: onMedia ? "#5BE49B" : theme.pos,
    neg: onMedia ? "#FF7A85" : theme.neg,
    onMedia, theme,
  };
  const good = r.total >= 0;
  const tint = good ? c.pos : c.neg;
  const big = r.trades ? recapValue(r.total, o) : "—";
  const week = r.kind === "week";
  const story = format === "story";
  const { width, height } = recapSize(r.kind, format);
  const replayKey = `${r.kind}:${r.start}:${o.amounts}:${format}`;
  const fit = useFit(big, story ? 96 : week ? 108 : 100, story ? 452 : week ? 540 : 624);
  const countRef = useRef<HTMLSpanElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  useCountUp(countRef, chartRef, big, (q) => recapValue(r.total, o, q), replayKey);

  const kicker = week ? "Weekly recap" : "Monthly recap";
  const title = week ? `Week of ${shortDate(r.start)}` : parseISODate(r.start).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const range = `${shortDate(r.start)} – ${shortDate(r.end)}`;

  const amount = (
    <p ref={fit.ref} className="w-max whitespace-nowrap font-extrabold leading-none tracking-[-0.045em]" style={{ fontSize: fit.size, color: onMedia ? c.fg : tint, textShadow: onMedia ? "0 8px 40px rgba(0,0,0,0.45)" : `0 0 60px ${tint}55` }}>
      <span className="relative block tabular-nums">
        <span aria-hidden className="invisible">{big}</span>
        <span ref={countRef} data-poster-amount data-final={big} className="absolute left-0 top-0 origin-left" />
      </span>
    </p>
  );
  const chart = week
    ? <WeekBars recap={r} o={o} c={c} width={story ? 452 : 316} height={story ? 250 : 300} />
    : <MonthCurve recap={r} o={o} c={c} width={story ? 452 : 624} height={story ? 230 : 196} />;

  return (
    <div ref={ref} className="relative overflow-hidden rounded-[28px]" style={{ width, height, background: theme.bg, color: c.fg, fontFamily: FONT }}>
      {o.media ? <Media {...o.media} /> : (
        // Ambient glow in the result's colour, a soft vignette and grain.
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 60% at ${story ? "50% 30%" : week ? "80% 20%" : "50% 18%"}, ${tint}2E, transparent 70%), radial-gradient(120% 90% at 50% 120%, rgba(0,0,0,0.55), transparent 60%)` }}>
          <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
        </div>
      )}
      {story ? (
        <div className="relative flex h-full flex-col justify-between px-11 pb-11 pt-12">
          <div>
            <Badge text={kicker} c={c} />
            <p className="mt-4 text-[36px] font-bold leading-tight tracking-tight">{title}</p>
            <p className="mt-1 text-[15px] font-medium" style={{ color: c.sub }}>{range}</p>
          </div>
          {amount}
          <div ref={chartRef} data-poster-chart>{chart}</div>
          <Stats r={r} o={o} c={c} replayKey={replayKey} cols={2} />
          <Footer o={o} c={c} />
        </div>
      ) : week ? (
        <div className="relative flex h-full gap-6 p-12">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="flex items-center gap-4">
              <Badge text={kicker} c={c} />
              <span className="text-[14px] font-medium" style={{ color: c.sub }}>{range}</span>
            </div>
            <div>
              <p className="mb-3 text-[30px] font-bold tracking-tight">{title}</p>
              {amount}
            </div>
            <Stats r={r} o={o} c={c} replayKey={replayKey} />
            <Footer o={o} c={c} host={false} />
          </div>
          <div className="flex w-[316px] shrink-0 flex-col justify-between">
            <div ref={chartRef} data-poster-chart className="flex flex-1 items-center">{chart}</div>
            <span className="self-end text-[14px] font-semibold tracking-tight" style={{ color: c.sub }}>{SITE_HOST}</span>
          </div>
        </div>
      ) : (
        <div className="relative flex h-full flex-col items-center justify-between px-12 py-11 text-center">
          <div className="flex flex-col items-center">
            <Badge text={kicker} c={c} />
            <p className="mt-3 text-[34px] font-bold tracking-tight">{title}</p>
          </div>
          <div ref={chartRef} data-poster-chart className="w-full">{chart}</div>
          {amount}
          <Stats r={r} o={o} c={c} replayKey={replayKey} align="center" />
          <Footer o={o} c={c} />
        </div>
      )}
    </div>
  );
});

/** Each weekday's result as a bar from the zero line, value on top (or below for red days). */
function WeekBars({ recap, o, c, width: W, height: H }: { recap: Recap; o: RecapOptions; c: Palette; width: number; height: number }) {
  const rows = weekRows(recap);
  const vals = rows.map((x) => x.day?.value ?? 0);
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
  const padT = 30, padB = 46;
  const span = hi - lo || 1;
  const y = (v: number) => padT + ((hi - v) / span) * (H - padT - padB);
  const slot = W / rows.length;
  const bw = Math.min(42, slot * 0.56);
  const compact = (v: number) => (o.amounts ? fmtMoney(v, o.currency, { sign: true, compact: true }) : fmtR(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="wb-pos" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={c.pos} /><stop offset="1" stopColor={c.pos} stopOpacity="0.55" /></linearGradient>
        <linearGradient id="wb-neg" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor={c.neg} /><stop offset="1" stopColor={c.neg} stopOpacity="0.55" /></linearGradient>
      </defs>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={c.sub} strokeOpacity={0.45} strokeDasharray="3 5" />
      {rows.map(({ date, label, day }, i) => {
        const cx = slot * i + slot / 2;
        const v = day?.value ?? 0;
        const top = Math.min(y(v), y(0)), h = Math.max(day ? 4 : 0, Math.abs(y(v) - y(0)));
        const up = v >= 0;
        return (
          <g key={date}>
            {day ? <rect x={cx - bw / 2} y={up ? y(0) - h : top} width={bw} height={h} rx={Math.min(8, bw / 3)} fill={up ? "url(#wb-pos)" : "url(#wb-neg)"} />
              : <circle cx={cx} cy={y(0)} r={3} fill={c.sub} fillOpacity={0.6} />}
            {day && <text x={cx} y={up ? y(0) - h - 9 : y(0) + h + 18} textAnchor="middle" fontSize="13" fontWeight="700" fill={up ? c.fg : c.neg} fontFamily={FONT}>{compact(v)}</text>}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="13" fontWeight="700" letterSpacing="1.5" fill={day ? c.fg : c.sub} fillOpacity={day ? 0.9 : 0.6} fontFamily={FONT}>{label.toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Running total across the month's trading days, from zero, with a dot per day (green up, red down). */
function MonthCurve({ recap, o, c, width: W, height: H }: { recap: Recap; o: RecapOptions; c: Palette; width: number; height: number }) {
  const padT = 18, padB = 28, padR = 78;
  const pts = recap.curve;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const x = (i: number) => (pts.length < 2 ? 0 : (i / (pts.length - 1)) * (W - padR));
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const color = recap.total >= 0 ? c.pos : c.neg;
  const money = (v: number, compact = false) => (o.amounts ? fmtMoney(v, o.currency, { sign: v !== 0, compact }) : fmtR(v));
  // Keep the end label clear of the zero label when the month ends near zero.
  const yEnd = Math.abs(y(last.value) - y(0)) < 20 ? y(0) + (last.value >= 0 ? -20 : 20) : y(last.value);
  const grid = [0.25, 0.5, 0.75].map((f) => padT + f * (H - padT - padB));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="mx-auto block overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="mc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.36" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="mc-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      {grid.map((gy) => <line key={gy} x1={0} x2={W - padR} y1={gy} y2={gy} stroke={c.fg} strokeOpacity={0.06} />)}
      <line x1={0} x2={W - padR} y1={y(0)} y2={y(0)} stroke={c.sub} strokeOpacity={0.5} strokeDasharray="3 5" />
      <text x={W - padR + 12} y={y(0) + 5} fontSize="13" fontWeight="600" fill={c.sub} fontFamily={FONT} textAnchor="start">{money(0)}</text>
      {pts.length > 1 && <path d={`${line} L${x(pts.length - 1)} ${H - padB} L0 ${H - padB} Z`} fill="url(#mc-fill)" />}
      <path d={line} fill="none" stroke={c.fg} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {pts.slice(1, -1).map((p, i) => <circle key={p.date} cx={x(i + 1)} cy={y(p.value)} r={3.5} fill={p.value >= pts[i].value ? c.pos : c.neg} stroke={c.theme.bg} strokeWidth={1.5} />)}
      <circle cx={x(pts.length - 1)} cy={y(last.value)} r={12} fill={color} opacity={0.55} filter="url(#mc-glow)" />
      <circle cx={x(pts.length - 1)} cy={y(last.value)} r={6} fill={color} stroke={c.fg} strokeWidth={2} />
      <text x={W - padR + 12} y={yEnd + 5} fontSize="15" fontWeight="800" fill={c.fg} fontFamily={FONT}>{money(recap.total, true)}</text>
      <text x={0} y={H - 6} fontSize="12" fontWeight="700" letterSpacing="1" fill={c.sub} fontFamily={FONT}>{shortDate(recap.start).toUpperCase()}</text>
      <text x={W - padR} y={H - 6} fontSize="12" fontWeight="700" letterSpacing="1" fill={c.sub} fontFamily={FONT} textAnchor="end">{shortDate(recap.end).toUpperCase()}</text>
    </svg>
  );
}
