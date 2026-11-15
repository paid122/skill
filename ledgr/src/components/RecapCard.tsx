"use client";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { SITE_HOST } from "@/lib/contact";
import { weekRows, type Recap } from "@/lib/recap";
import { fmtMoney, fmtR, parseISODate } from "@/lib/util";
import { LogoMark } from "./Logo";
import { Media, useCountUp } from "./PosterCard";
import { themeColors } from "./ShareCard";

export type RecapFormat = "wide" | "square" | "story";

export interface RecapOptions {
  amounts: boolean;
  currency: string;
  handle: string;
  avatar?: string | null;
  media?: { blobId: string; kind: "image" | "video"; dim: number; blur: number; fit?: "cover" | "contain" } | null;
}

/** 16:9, square or 9:16 (story). */
export const RECAP_FORMATS: { value: RecapFormat; label: string; hint: string }[] = [
  { value: "wide", label: "16:9", hint: "Wide, for YouTube, X and landscape posts" },
  { value: "square", label: "Square", hint: "1:1, for Instagram and feed posts" },
  { value: "story", label: "9:16", hint: "Tall, fills a TikTok, Reel or story" },
];
export function recapSize(_kind: Recap["kind"], format: RecapFormat) {
  if (format === "story") return { width: 540, height: 960 };
  if (format === "square") return { width: 720, height: 720 };
  return { width: 960, height: 540 };
}

const FONT = "'Inter Variable', Inter, system-ui, sans-serif";
const WHITE = "#FFFFFF";
const SUB = "rgba(255,255,255,0.6)";

/** A recap value at count-up progress `p`: currency (with sign) or R. */
export function recapValue(v: number, o: Pick<RecapOptions, "amounts" | "currency">, p = 1) {
  return o.amounts ? fmtMoney(v * p, o.currency, { sign: true }) : fmtR(v * p);
}

function shortDate(iso: string) {
  return parseISODate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Whole-number label for the chart's end point, e.g. +$932. */
function roundValue(v: number, o: Pick<RecapOptions, "amounts" | "currency">) {
  if (!o.amounts) return fmtR(v);
  const s = new Intl.NumberFormat("en-US", { style: "currency", currency: o.currency, maximumFractionDigits: 0 }).format(Math.abs(v));
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}`;
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

function Brand({ o, size = 16 }: { o: RecapOptions; size?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 font-bold" style={{ fontSize: size }}>
      <span className="inline-flex items-center gap-2"><LogoMark size={size + 6} /> LEDGR</span>
      {o.handle && (
        <>
          <span style={{ color: SUB }}>×</span>
          {o.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={o.avatar} alt="" className="rounded-full object-cover" style={{ width: size + 8, height: size + 8 }} />
            : <span className="grid shrink-0 place-items-center rounded-full font-extrabold" style={{ width: size + 8, height: size + 8, fontSize: size - 3, background: WHITE, color: "#0A0A0A" }}>{o.handle.replace(/^@/, "").charAt(0).toUpperCase() || "·"}</span>}
          <span className="truncate">{o.handle}</span>
        </>
      )}
    </div>
  );
}

/** Label / value rows, like a receipt. */
function Rows({ rows, labelWidth, size, gap = 6 }: { rows: [string, string][]; labelWidth: number; size: number; gap?: number }) {
  return (
    <dl className="grid" style={{ gridTemplateColumns: `${labelWidth}px auto`, fontSize: size, rowGap: gap }}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt style={{ color: SUB }}>{k}</dt>
          <dd className="font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const RecapCard = forwardRef<HTMLDivElement, { recap: Recap; opts: RecapOptions; format?: RecapFormat }>(function RecapCard({ recap: r, opts: o, format = "wide" }, ref) {
  const theme = themeColors("ledger");
  const big = r.trades ? recapValue(r.total, o) : "—";
  const week = r.kind === "week";
  const story = format === "story";
  const { width, height } = recapSize(r.kind, format);
  const wide = format === "wide";
  const fit = useFit(big, story ? 84 : 92, story ? 452 : wide ? 540 : 620);
  const countRef = useRef<HTMLSpanElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  useCountUp(countRef, chartRef, big, (q) => recapValue(r.total, o, q), `${r.kind}:${r.start}:${o.amounts}:${format}`);

  const title = week ? `Week of ${shortDate(r.start)}` : parseISODate(r.start).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const winRate = r.winRate === null ? "—" : `${Math.round(r.winRate * 100)}%`;
  const green = `${r.greenDays} of ${r.days.length}`;
  const best = r.best ? `${recapValue(r.best.value, o)} ${week ? parseISODate(r.best.date).toLocaleDateString("en-US", { weekday: "short" }) : shortDate(r.best.date)}` : "—";
  const stats: [string, string][] = week
    ? [["Trades", String(r.trades)], ["Win rate", winRate], ["Green days", green], ["Best day", best]]
    : [["Win rate", winRate], ["Green days", green], ["Best day", best], ["Trades", String(r.trades)]];
  const days: [string, string][] = weekRows(r).map(({ label, day }) => [label, day ? recapValue(day.value, o) : "No trades"]);

  const amount = (
    <p ref={fit.ref} className="w-max whitespace-nowrap font-bold leading-none tracking-[-0.035em]" style={{ fontSize: fit.size, textShadow: o.media ? "0 6px 30px rgba(0,0,0,0.45)" : undefined }}>
      <span className="relative block tabular-nums">
        <span aria-hidden className="invisible">{big}</span>
        <span ref={countRef} data-poster-amount data-final={big} className="absolute left-0 top-0 origin-left" />
      </span>
    </p>
  );
  const heading = (center: boolean, big = false) => (
    <div className={center ? "text-center" : ""}>
      <p className={`${big ? "text-[14px]" : "text-[12px]"} font-semibold uppercase tracking-[0.22em]`} style={{ color: SUB }}>{week ? "Weekly" : "Monthly"}</p>
      <p className={`mt-1.5 ${big ? "text-[32px]" : "text-[24px]"} font-semibold tracking-tight`}>{title}</p>
    </div>
  );

  const dayListOf = (size: number, gap: number, full = true) => (
    <dl className={`grid ${full ? "" : "gap-x-8"}`} style={{ gridTemplateColumns: full ? "150px 1fr" : "auto auto", fontSize: size, rowGap: gap }}>
      {days.map(([k, v]) => (
        <div key={k} className="contents">
          <dt style={{ color: SUB }}>{k}</dt>
          <dd className={`${full ? "" : "text-right "}font-semibold tabular-nums`} style={{ color: v === "No trades" ? SUB : WHITE }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
  const dayList = dayListOf(15, 8, false);

  return (
    <div ref={ref} className="relative overflow-hidden rounded-[28px]" style={{ width, height, background: theme.bg, color: WHITE, fontFamily: FONT }}>
      {o.media && <Media {...o.media} fit={o.media.fit ?? "contain"} shade="even" />}
      {story ? (
        <div className="relative flex h-full flex-col items-center justify-center gap-9 px-11 text-center">
          {heading(true)}
          {!week && <div ref={chartRef} data-poster-chart><MonthLine recap={r} o={o} width={360} height={150} /></div>}
          {amount}
          <div className="text-left"><Rows rows={stats} labelWidth={130} size={16} /></div>
          {week && <div ref={chartRef} data-poster-chart className="text-left"><Rows rows={days} labelWidth={130} size={16} /></div>}
          <div className="flex flex-col items-center gap-2"><Brand o={o} /><span className="text-[12px]" style={{ color: SUB }}>{SITE_HOST}</span></div>
        </div>
      ) : wide ? (
        <div className="relative h-full p-11">
          {heading(false)}
          <div className="mt-10">{amount}</div>
          <div className="mt-7"><Rows rows={stats} labelWidth={120} size={15} /></div>
          <div ref={chartRef} data-poster-chart className="absolute right-11 top-1/2 -translate-y-1/2">
            {week ? dayList : <MonthLine recap={r} o={o} width={330} height={170} />}
          </div>
          <div className="absolute bottom-10 left-11"><Brand o={o} /></div>
          <span className="absolute bottom-10 right-11 text-[13px]" style={{ color: SUB }}>{SITE_HOST}</span>
        </div>
      ) : (
        <div className="relative flex h-full flex-col items-center justify-between px-12 pb-9 pt-10 text-center">
          {heading(true)}
          {!week && <div ref={chartRef} data-poster-chart><MonthLine recap={r} o={o} width={380} height={160} /></div>}
          {amount}
          {week ? (
            <div className="flex items-start gap-14 text-left">
              <Rows rows={stats} labelWidth={110} size={16} />
              <div ref={chartRef} data-poster-chart>{dayList}</div>
            </div>
          ) : <div className="text-left"><Rows rows={stats} labelWidth={130} size={16} /></div>}
          <div className="flex flex-col items-center gap-2"><Brand o={o} /><span className="text-[12px]" style={{ color: SUB }}>{SITE_HOST}</span></div>
        </div>
      )}
    </div>
  );
});

/** Running total across the month's trading days: a thin white line from zero, end value and zero marked on the right. */
function MonthLine({ recap, o, width: W, height: H, labels = 11 }: { recap: Recap; o: RecapOptions; width: number; height: number; labels?: number }) {
  const padR = labels > 11 ? 74 : 64, padB = labels + 11, padT = 8;
  const pts = recap.curve; // [period start at 0, then each trading day]
  const vals = pts.map((p) => p.value);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const x = (i: number) => (pts.length < 2 ? 0 : (i / (pts.length - 1)) * (W - padR));
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const yEnd = Math.abs(y(last.value) - y(0)) < 16 ? y(0) + (last.value >= 0 ? -16 : 16) : y(last.value);
  const first = recap.days[0]?.date ?? recap.start, end = recap.days[recap.days.length - 1]?.date ?? recap.end;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block overflow-visible" aria-hidden>
      <line x1={0} x2={W - padR} y1={y(0)} y2={y(0)} stroke={WHITE} strokeOpacity={0.18} />
      <path d={line} fill="none" stroke={WHITE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <text x={W - padR + 8} y={yEnd + 4} fontSize={labels} fontWeight="600" fill={WHITE} fontFamily={FONT}>{roundValue(recap.total, o)}</text>
      <text x={W - padR + 8} y={y(0) + 4} fontSize={labels} fontWeight="500" fill={SUB} fontFamily={FONT}>{o.amounts ? roundValue(0, o) : "0R"}</text>
      <text x={0} y={H - 4} fontSize={labels} fontWeight="500" fill={SUB} fontFamily={FONT}>{shortDate(first)}</text>
      <text x={W - padR} y={H - 4} fontSize={labels} fontWeight="500" fill={SUB} fontFamily={FONT} textAnchor="end">{shortDate(end)}</text>
    </svg>
  );
}
