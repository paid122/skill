"use client";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { EnrichedTrade } from "@/lib/calc";
import { setUI, useUI, type RangePreset } from "@/lib/hooks";
import { openEditor } from "@/lib/overlays";
import { useLedgr } from "@/lib/store";
import { addDays, cx, fmtDate, fmtMoney, fmtR, parseISODate, toISODate, today } from "@/lib/util";
import { Sparkline } from "./charts";
import { Badge, Input, Segmented, Select, Tooltip, useAnimatedNumber } from "./ui";

export function PageIntro({ title, sub, actions, children }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {title && <h2 className="text-[22px] font-semibold tracking-tight text-text sm:text-[26px]">{title}</h2>}
        {sub && <p className="mt-1 max-w-2xl text-sm text-text-2">{sub}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const RANGES: { value: RangePreset; label: string }[] = [
  { value: "7d", label: "7D" }, { value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "ytd", label: "YTD" }, { value: "all", label: "All" }, { value: "custom", label: "Custom" },
];

/** Global account + date-range selectors; state is shared across pages. */
export function ScopeControls({ showRange = true }: { showRange?: boolean }) {
  const prefs = useUI();
  const accounts = useLedgr((s) => s.accounts);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Account" value={prefs.accountId} onChange={(e) => setUI({ accountId: e.target.value })} className="h-9 w-auto min-w-[170px]">
        <option value="all">All accounts</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.status === "archived" ? " (archived)" : ""}</option>)}
      </Select>
      {showRange && (
        <>
          <Segmented ariaLabel="Date range" size="sm" value={prefs.range} onChange={(range) => setUI({ range, ...(range === "custom" && !prefs.from ? { from: addDays(today(), -29), to: today() } : {}) })} options={RANGES} />
          {prefs.range === "custom" && (
            <span className="flex items-center gap-1.5">
              <Input type="date" aria-label="From" value={prefs.from} max={prefs.to || undefined} onChange={(e) => setUI({ from: e.target.value })} className="h-8 w-[148px]" />
              <span className="text-muted">–</span>
              <Input type="date" aria-label="To" value={prefs.to} min={prefs.from || undefined} onChange={(e) => setUI({ to: e.target.value })} className="h-8 w-[148px]" />
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function KpiCard({ label, value, numeric, format, delta, deltaFormat, betterWhen = "higher", spark, sparkTone, tip, href, footnote }: {
  label: string; value?: string; numeric?: number | null; format?: (n: number | null) => string; delta?: number | null; deltaFormat?: (n: number) => string; betterWhen?: "higher" | "lower";
  spark?: number[]; sparkTone?: "pos" | "neg" | "accent"; tip: ReactNode; href?: string; footnote?: ReactNode;
}) {
  const animated = useAnimatedNumber(numeric ?? null);
  const shown = format ? format(numeric === null || numeric === undefined ? null : animated) : value;
  const good = delta === null || delta === undefined || delta === 0 ? null : betterWhen === "higher" ? delta > 0 : delta < 0;
  const inner = (
    <div className="card card-pad group flex h-full flex-col gap-2 transition-colors duration-150 hover:border-line">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12.5px] text-text-2">
          {label}
          <Tooltip text={tip}><Info size={12} className="text-muted" aria-label={`About ${label}`} tabIndex={0} /></Tooltip>
        </span>
        {href && <ArrowUpRight size={14} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <div className="num text-[22px] font-medium leading-none text-text sm:text-[24px]">{shown}</div>
      <div className="flex min-h-[18px] items-center gap-1.5 text-xs">
        {delta !== null && delta !== undefined && deltaFormat ? (
          <>
            <span className={cx("num inline-flex items-center gap-0.5", good === null ? "text-muted" : good ? "pos" : "neg")}>
              {delta > 0 ? <ArrowUpRight size={12} /> : delta < 0 ? <ArrowDownRight size={12} /> : null}
              {deltaFormat(delta)}
            </span>
            <span className="text-muted">vs previous period</span>
          </>
        ) : (
          <span className="text-muted">{footnote ?? "No comparison period"}</span>
        )}
      </div>
      {spark && <div className="mt-auto pt-1"><Sparkline data={spark} tone={sparkTone ?? "accent"} /></div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full rounded-[14px]">{inner}</Link> : inner;
}

/** Month calendar coloured by daily P&L; clicking a day opens the journal filtered to that date. */
export function PerformanceCalendar({ daily, currency, journalDates }: { daily: Map<string, { net: number; count: number }>; currency: string; journalDates?: Set<string> }) {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const days = useMemo(() => {
    const first = parseISODate(`${month}-01`);
    const startDow = (first.getDay() + 6) % 7;
    const cells: (string | null)[] = Array(startDow).fill(null);
    const d = new Date(first);
    while (d.getMonth() === first.getMonth()) { cells.push(toISODate(d)); d.setDate(d.getDate() + 1); }
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [month]);
  const maxAbs = Math.max(1, ...days.filter(Boolean).map((d) => Math.abs(daily.get(d!)?.net ?? 0)));
  const monthNet = days.reduce((s, d) => s + (d ? daily.get(d)?.net ?? 0 : 0), 0);
  const shift = (n: number) => { const d = parseISODate(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(toISODate(d).slice(0, 7)); };
  const label = parseISODate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-text"><ChevronLeft size={16} /></button>
          <span className="min-w-[130px] text-center text-[13px] font-medium">{label}</span>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-text"><ChevronRight size={16} /></button>
        </div>
        <span className={cx("num text-[13px]", monthNet > 0 ? "pos" : monthNet < 0 ? "neg" : "text-muted")}>{fmtMoney(monthNet, currency, { sign: true })}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] text-muted">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="pb-1">{d}</span>)}
        {days.map((d, i) => {
          if (!d) return <span key={i} />;
          const v = daily.get(d);
          const intensity = v ? 0.12 + (Math.abs(v.net) / maxAbs) * 0.5 : 0;
          const color = v ? (v.net > 0 ? "var(--pos)" : v.net < 0 ? "var(--neg)" : "var(--muted)") : undefined;
          return (
            <Tooltip key={d} text={v ? `${fmtDate(d)} · ${fmtMoney(v.net, currency, { sign: true })} · ${v.count} trade${v.count > 1 ? "s" : ""}` : `${fmtDate(d)} · no closed trades`}>
              <Link
                href={`/journal?from=${d}&to=${d}`}
                className={cx("relative flex aspect-square w-full flex-col items-center justify-center rounded-lg border text-[11px] transition-colors", d === today() ? "border-accent/60" : "border-transparent", v ? "text-text" : "text-muted hover:bg-card-2")}
                style={v ? { background: `color-mix(in srgb, ${color} ${Math.round(intensity * 100)}%, transparent)` } : undefined}
              >
                {Number(d.slice(8))}
                {journalDates?.has(d) && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-label="Journal entry" />}
              </Link>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export function ResultBadge({ x }: { x: EnrichedTrade }) {
  if (x.m.status === "draft") return <Badge tone="neutral">Draft</Badge>;
  if (x.m.status === "open") return <Badge>Open</Badge>;
  if (x.m.result === "win") return <Badge tone="pos">Win</Badge>;
  if (x.m.result === "loss") return <Badge tone="neg">Loss</Badge>;
  return <Badge tone="muted">Break-even</Badge>;
}

export function RecentTrades({ list, currency, limit = 6 }: { list: EnrichedTrade[]; currency: string; limit?: number }) {
  const rows = [...list].sort((a, b) => (b.trade.date + b.trade.updatedAt).localeCompare(a.trade.date + a.trade.updatedAt)).slice(0, limit);
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-muted">No trades in this period.</p>;
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((x) => (
        <li key={x.trade.id}>
          <Link href={`/journal/${x.trade.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-card-2/60">
            <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-semibold", x.trade.direction === "short" ? "bg-neg/10 text-neg" : "bg-pos/10 text-pos")}>{x.trade.direction === "short" ? "S" : "L"}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] text-text">{x.trade.symbol || "Untitled"} <span className="text-muted">#{x.trade.number}</span></span>
              <span className="block truncate text-xs text-muted">{fmtDate(x.trade.date)}{x.trade.setup ? ` · ${x.trade.setup}` : ""}</span>
            </span>
            <span className="text-right">
              <span className={cx("num block text-[13px]", (x.m.net ?? 0) > 0 ? "pos" : (x.m.net ?? 0) < 0 ? "neg" : "text-text-2")}>{x.m.status === "closed" ? fmtMoney(x.m.net, currency, { sign: true }) : "—"}</span>
              <span className="num block text-xs text-muted">{x.m.status === "closed" ? fmtR(x.m.r) : x.m.status === "draft" ? "Draft" : "Open"}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EditTradeButton({ id, children, tab, className }: { id: string; children: ReactNode; tab?: string; className?: string }) {
  return <button type="button" className={className} onClick={() => openEditor(id, tab)}>{children}</button>;
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: number | null; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx("num mt-1 truncate text-[17px] text-text", tone !== undefined && tone !== null && (tone > 0 ? "pos" : tone < 0 ? "neg" : ""))}>{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-muted">{hint}</p>}
    </div>
  );
}
