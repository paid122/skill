"use client";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { forwardRef } from "react";
import type { TradeMetrics } from "@/lib/calc";
import type { Trade } from "@/lib/types";
import { fmtMoney, fmtNum, fmtR, parseISODate } from "@/lib/util";
import { useBlobUrl } from "./BlobImage";
import { LogoMark } from "./Logo";
import { themeColors } from "./ShareCard";

export interface PosterOptions { amounts: boolean; account: string | null; handle: string; currency: string }

/** Background media (the user's own image or video), dimmed and optionally blurred for legibility. */
function Media({ blobId, kind, dim, blur }: { blobId: string; kind: "image" | "video"; dim: number; blur: number }) {
  const { url } = useBlobUrl(blobId);
  const style = { filter: blur ? `blur(${blur}px)` : undefined, transform: blur ? "scale(1.06)" : undefined };
  return (
    <>
      {url && (kind === "video"
        // eslint-disable-next-line jsx-a11y/media-has-caption
        ? <video data-poster-video src={url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" style={style} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" style={style} />)}
      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(0,0,0,${Math.min(0.95, dim + 0.2)}) 0%, rgba(0,0,0,${dim}) 45%, rgba(0,0,0,${Math.max(0, dim - 0.15)}) 100%)` }} />
    </>
  );
}

/**
 * The execution path: one point per recorded execution (time → price), in order.
 * Ledgr has no market data, so nothing between executions is drawn or implied.
 */
function ExecutionPath({ trade, color, label, labelText }: { trade: Trade; color: string; label: string; labelText: string }) {
  const ex = [...trade.executions].sort((a, b) => a.time.localeCompare(b.time));
  if (ex.length < 2) return null;
  const W = 420, H = 300, pad = 36;
  const ts = ex.map((e) => new Date(e.time).getTime());
  const ps = ex.map((e) => e.price);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), pMin = Math.min(...ps), pMax = Math.max(...ps);
  const x = (t: number, i: number) => (t1 > t0 ? pad + ((t - t0) / (t1 - t0)) * (W - pad * 2) : pad + (i / (ex.length - 1)) * (W - pad * 2));
  const y = (p: number) => (pMax > pMin ? pad + (1 - (p - pMin) / (pMax - pMin)) * (H - pad * 2) : H / 2);
  const pts = ex.map((e, i) => [x(ts[i], i), y(e.price), e.kind] as const);
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const firstEntry = pts.find((p) => p[2] === "entry")!;
  const lastExit = [...pts].reverse().find((p) => p[2] === "exit");
  const Pill = ({ at, text, below }: { at: readonly [number, number, string]; text: string; below: boolean }) => (
    <g transform={`translate(${at[0]},${at[1]})`}>
      <circle r="6" fill={color} />
      <g transform={`translate(0,${below ? 30 : -30})`}>
        <rect x="-34" y="-15" width="68" height="30" rx="10" fill={label} />
        <text x="0" y="5" textAnchor="middle" fontSize="14" fontWeight="700" fill={labelText} fontFamily="'Inter Variable', Inter, sans-serif">{text}</text>
      </g>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label="Execution path from recorded entries and exits" className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 10px ${color}66)` }} />
      {pts.slice(1, -1).map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color} opacity=".7" />)}
      <Pill at={firstEntry} text="Entry" below={firstEntry[1] > H / 2 ? false : true} />
      {lastExit && <Pill at={lastExit} text="Exit" below={lastExit[1] > H / 2 ? false : true} />}
    </svg>
  );
}

export const PosterCard = forwardRef<HTMLDivElement, { trade: Trade; m: TradeMetrics; opts: PosterOptions }>(function PosterCard({ trade: t, m, opts }, ref) {
  const media = t.showcase?.media ?? null;
  const theme = themeColors(t.showcase?.background ?? "ledger");
  const onMedia = !!media;
  const fg = onMedia ? "#FFFFFF" : theme.fg;
  const sub = onMedia ? "rgba(255,255,255,0.62)" : theme.sub;
  const good = (m.r ?? m.net ?? 0) >= 0;
  const big = opts.amounts ? fmtMoney(m.net, opts.currency, { sign: true }) : fmtR(m.r);
  const date = parseISODate(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const size = m.entryQty ? `${fmtNum(m.entryQty, m.entryQty % 1 ? 2 : 0)} ${t.market === "Futures" ? (m.entryQty === 1 ? "contract" : "contracts") : t.market === "Stocks" ? "shares" : t.market === "Forex" ? "lots" : "units"}` : "—";
  const Arrow = t.direction === "short" ? ArrowDownRight : ArrowUpRight;

  return (
    <div ref={ref} className="relative overflow-hidden rounded-[28px]" style={{ width: 960, height: 504, background: theme.gradient ? `${theme.gradient}, ${theme.bg}` : theme.bg, color: fg, fontFamily: "'Inter Variable', Inter, system-ui, sans-serif" }}>
      {media && <Media {...media} />}
      <div className="relative flex h-full">
        <div className="flex flex-1 flex-col justify-between p-12">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: onMedia ? "rgba(255,255,255,0.14)" : theme.line, backdropFilter: "blur(8px)" }}><Arrow size={24} strokeWidth={2.2} /></span>
            <span className="text-[34px] font-bold tracking-tight">{t.symbol || "—"}</span>
            <span className="text-[15px] font-semibold uppercase tracking-[0.14em]" style={{ color: sub }}>{t.direction ?? ""} · {date}</span>
          </div>
          <div>
            <p className="text-[92px] font-extrabold leading-none tracking-[-0.04em]" style={{ color: onMedia ? fg : good ? theme.pos : theme.neg, textShadow: onMedia ? "0 8px 40px rgba(0,0,0,0.45)" : undefined }}>{big}</p>
            {opts.amounts && m.r !== null && <p className="mt-2 font-mono text-[18px]" style={{ color: sub }}>{fmtR(m.r)}</p>}
          </div>
          <dl className="grid w-fit grid-cols-[110px_auto] gap-y-3 text-[22px]">
            <dt style={{ color: sub }}>Entry</dt><dd className="font-semibold">{fmtNum(m.avgEntry, m.avgEntry !== null && m.avgEntry < 10 ? 5 : 2)}</dd>
            <dt style={{ color: sub }}>Exit</dt><dd className="font-semibold">{fmtNum(m.avgExit, m.avgExit !== null && m.avgExit < 10 ? 5 : 2)}</dd>
            <dt style={{ color: sub }}>Size</dt><dd className="font-semibold">{size}</dd>
          </dl>
          <div className="flex items-center gap-3 text-[17px] font-bold">
            <span className="inline-flex items-center gap-2"><LogoMark size={26} /> LEDGR</span>
            {opts.handle && <><span style={{ color: sub }}>×</span><span>{opts.handle}</span></>}
            {opts.account && <span className="ml-2 text-[13px] font-medium" style={{ color: sub }}>{opts.account}</span>}
          </div>
        </div>
        <div className="flex w-[440px] shrink-0 flex-col items-center justify-center pr-8">
          <ExecutionPath trade={t} color={fg} label={onMedia ? "#FFFFFF" : theme.fg} labelText={onMedia ? "#0A0A0A" : theme.bg} />
          <p className="mt-3 text-[11px]" style={{ color: sub }}>Simulated record · line joins recorded executions</p>
        </div>
      </div>
    </div>
  );
});
