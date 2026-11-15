"use client";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { SITE_HOST } from "@/lib/contact";
import { weekRows, type Recap } from "@/lib/recap";
import { fmtMoney, fmtR, parseISODate } from "@/lib/util";
import { LogoMark } from "./Logo";
import { Media, useCountUp } from "./PosterCard";
import { themeColors } from "./ShareCard";

export interface RecapOptions {
  amounts: boolean;
  currency: string;
  handle: string;
  avatar?: string | null;
  media?: { blobId: string; kind: "image" | "video"; dim: number; blur: number } | null;
}

export const RECAP_SIZE = { week: { width: 960, height: 504 }, month: { width: 720, height: 720 } } as const;

const FONT = "'Inter Variable', Inter, system-ui, sans-serif";

/** A recap value at count-up progress `p`: currency (with sign) or R. */
export function recapValue(v: number, o: Pick<RecapOptions, "amounts" | "currency">, p = 1) {
  return o.amounts ? fmtMoney(v * p, o.currency, { sign: true }) : fmtR(v * p);
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

function Footer({ o, fg, sub, onMedia, theme }: { o: RecapOptions; fg: string; sub: string; onMedia: boolean; theme: ReturnType<typeof themeColors> }) {
  return (
    <div className="flex items-center gap-3 text-[16px] font-bold" style={{ color: fg }}>
      <span className="inline-flex items-center gap-2"><LogoMark size={24} /> LEDGR</span>
      {o.handle && (
        <>
          <span style={{ color: sub }}>×</span>
          {o.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={o.avatar} alt="" className="h-7 w-7 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${onMedia ? "#FFFFFF" : theme.fg}` }} />
            : <span className="grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold" style={{ background: onMedia ? "#FFFFFF" : theme.fg, color: onMedia ? "#0A0A0A" : theme.bg }}>{o.handle.replace(/^@/, "").charAt(0).toUpperCase() || "·"}</span>}
          <span>{o.handle}</span>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium uppercase tracking-[0.12em]" style={{ color: sub }}>{label}</p>
      <p className="mt-1.5 truncate text-[22px] font-semibold tracking-tight" style={{ color }}>{value}</p>
    </div>
  );
}

export const RecapCard = forwardRef<HTMLDivElement, { recap: Recap; opts: RecapOptions }>(function RecapCard({ recap: r, opts: o }, ref) {
  const theme = themeColors("ledger");
  const onMedia = !!o.media;
  const fg = onMedia ? "#FFFFFF" : theme.fg;
  const sub = onMedia ? "rgba(255,255,255,0.62)" : theme.sub;
  const pos = onMedia ? "#5BE49B" : theme.pos, neg = onMedia ? "#FF7A85" : theme.neg;
  const good = r.total >= 0;
  const big = r.trades ? recapValue(r.total, o) : "—";
  const week = r.kind === "week";
  const { width, height } = RECAP_SIZE[r.kind];
  const fit = useFit(big, week ? 104 : 96, week ? 560 : 620);
  const countRef = useRef<HTMLSpanElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  useCountUp(countRef, chartRef, big, (q) => recapValue(r.total, o, q), `${r.kind}:${r.start}:${o.amounts}`);

  const winRate = r.winRate === null ? "—" : `${Math.round(r.winRate * 100)}%`;
  const green = `${r.greenDays} of ${r.days.length}`;
  const best = r.best ? `${recapValue(r.best.value, o)}` : "—";
  const bestWhen = r.best ? (week ? parseISODate(r.best.date).toLocaleDateString("en-US", { weekday: "short" }) : shortDate(r.best.date)) : "";
  const title = week ? `Week of ${shortDate(r.start)}` : parseISODate(r.start).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const amount = (
    <p ref={fit.ref} className="w-max whitespace-nowrap font-extrabold leading-none tracking-[-0.04em]" style={{ fontSize: fit.size, color: onMedia ? fg : good ? pos : neg, textShadow: onMedia ? "0 8px 40px rgba(0,0,0,0.45)" : undefined }}>
      <span className="relative block tabular-nums">
        <span aria-hidden className="invisible">{big}</span>
        <span ref={countRef} data-poster-amount data-final={big} className="absolute left-0 top-0 origin-left" />
      </span>
    </p>
  );

  return (
    <div ref={ref} className="relative overflow-hidden rounded-[28px]" style={{ width, height, background: theme.gradient ? `${theme.gradient}, ${theme.bg}` : theme.bg, color: fg, fontFamily: FONT }}>
      {o.media && <Media {...o.media} />}
      {week ? (
        <div className="relative flex h-full p-12">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              <p className="text-[14px] font-semibold uppercase tracking-[0.2em]" style={{ color: sub }}>Weekly recap</p>
              <p className="mt-1.5 text-[30px] font-bold tracking-tight">{title}</p>
            </div>
            {amount}
            <div className="grid w-[560px] grid-cols-4 gap-5">
              <Stat label="Trades" value={String(r.trades)} sub={sub} />
              <Stat label="Win rate" value={winRate} sub={sub} />
              <Stat label="Green days" value={green} sub={sub} />
              <Stat label={`Best · ${bestWhen}`} value={best} sub={sub} />
            </div>
            <Footer o={o} fg={fg} sub={sub} onMedia={onMedia} theme={theme} />
          </div>
          <WeekDays recap={r} o={o} chartRef={chartRef} fg={fg} sub={sub} pos={pos} neg={neg} />
          <span className="absolute bottom-12 right-12 text-[15px] font-semibold tracking-tight" style={{ color: sub }}>{SITE_HOST}</span>
        </div>
      ) : (
        <div className="relative flex h-full flex-col items-center justify-between px-12 py-11 text-center">
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-[0.2em]" style={{ color: sub }}>Monthly recap</p>
            <p className="mt-1.5 text-[32px] font-bold tracking-tight">{title}</p>
          </div>
          <div ref={chartRef} data-poster-chart className="w-full">
            <MonthCurve recap={r} o={o} fg={fg} sub={sub} pos={pos} neg={neg} />
          </div>
          {amount}
          <div className="grid w-full grid-cols-4 gap-4">
            <Stat label="Win rate" value={winRate} sub={sub} />
            <Stat label="Green days" value={green} sub={sub} />
            <Stat label={`Best · ${bestWhen}`} value={best} sub={sub} />
            <Stat label="Trades" value={String(r.trades)} sub={sub} />
          </div>
          <div className="flex w-full items-center justify-between">
            <Footer o={o} fg={fg} sub={sub} onMedia={onMedia} theme={theme} />
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: sub }}>{SITE_HOST}</span>
          </div>
        </div>
      )}
    </div>
  );
});

/** Monday to Friday (plus traded weekend days): each day's result with a bar sized to the week's biggest day. */
function WeekDays({ recap, o, chartRef, fg, sub, pos, neg }: { recap: Recap; o: RecapOptions; chartRef: React.RefObject<HTMLDivElement | null>; fg: string; sub: string; pos: string; neg: string }) {
  const rows = weekRows(recap);
  const maxAbs = Math.max(1e-9, ...rows.map((x) => Math.abs(x.day?.value ?? 0)));
  return (
    <div ref={chartRef} data-poster-chart className="flex w-[300px] shrink-0 flex-col justify-center gap-3.5 pb-10 pl-6">
      {rows.map(({ date, label, day }) => (
        <div key={date} className="grid grid-cols-[44px_1fr] items-center gap-3">
          <span className="text-[15px] font-semibold uppercase tracking-[0.08em]" style={{ color: sub }}>{label}</span>
          {day ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2.5 shrink-0 rounded-full" style={{ width: Math.max(6, (Math.abs(day.value) / maxAbs) * 92), background: day.value >= 0 ? pos : neg }} />
              <span className="truncate text-[17px] font-semibold tabular-nums" style={{ color: day.value >= 0 ? fg : neg }}>{recapValue(day.value, o)}</span>
            </div>
          ) : <span className="text-[15px]" style={{ color: sub }}>No trades</span>}
        </div>
      ))}
    </div>
  );
}

/** Running total across the month's trading days, from zero. */
function MonthCurve({ recap, o, fg, sub, pos, neg }: { recap: Recap; o: RecapOptions; fg: string; sub: string; pos: string; neg: string }) {
  const W = 624, H = 190, padT = 16, padB = 26, padR = 70;
  const pts = recap.curve;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const x = (i: number) => (pts.length < 2 ? 0 : (i / (pts.length - 1)) * (W - padR));
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const color = recap.total >= 0 ? pos : neg;
  // Keep the end label clear of the zero label when the month ends near zero.
  const yEnd = Math.abs(y(last.value) - y(0)) < 20 ? y(0) + (last.value >= 0 ? -20 : 20) : y(last.value);
  const endLabel = o.amounts ? fmtMoney(recap.total, o.currency, { sign: true, compact: true }) : fmtR(recap.total);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="mx-auto block overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="recap-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={0} x2={W - padR} y1={y(0)} y2={y(0)} stroke={sub} strokeOpacity={0.5} strokeDasharray="4 6" />
      <text x={W - padR + 10} y={y(0) + 5} fontSize="14" fontWeight="600" fill={sub} fontFamily={FONT}>{o.amounts ? fmtMoney(0, o.currency) : "0R"}</text>
      {pts.length > 1 && <path d={`${line} L${x(pts.length - 1)} ${y(lo)} L0 ${y(lo)} Z`} fill="url(#recap-fill)" />}
      <path d={line} fill="none" stroke={fg} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(last.value)} r={6} fill={color} stroke={fg} strokeWidth={2} />
      <text x={W - padR + 10} y={yEnd + 5} fontSize="15" fontWeight="700" fill={fg} fontFamily={FONT}>{endLabel}</text>
      <text x={0} y={H - 4} fontSize="13" fontWeight="600" fill={sub} fontFamily={FONT}>{shortDate(recap.start)}</text>
      <text x={W - padR} y={H - 4} fontSize="13" fontWeight="600" fill={sub} fontFamily={FONT} textAnchor="end">{shortDate(recap.end)}</text>
    </svg>
  );
}
