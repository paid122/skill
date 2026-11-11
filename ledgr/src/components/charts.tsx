"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, Brush, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useLedgr } from "@/lib/store";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/util";

export interface ThemeColors { neutral: string; pos: string; neg: string; accent: string; text: string; text2: string; muted: string; grid: string; card: string; card2: string; border: string; series: string[] }

const read = (): ThemeColors => {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { neutral: v("--neutral"), pos: v("--pos"), neg: v("--neg"), accent: v("--accent"), text: v("--text"), text2: v("--text-2"), muted: v("--muted"), grid: v("--grid"), card: v("--card"), card2: v("--card-2"), border: v("--border"), series: [1, 2, 3, 4, 5].map((i) => v(`--series-${i}`)) };
};
const FALLBACK: ThemeColors = { neutral: "#D6B36C", pos: "#42B883", neg: "#E36E73", accent: "#C5A66D", text: "#F1F2F0", text2: "#A4AAB1", muted: "#747E89", grid: "rgba(255,255,255,.04)", card: "#151A20", card2: "#1A2027", border: "#262D36", series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"] };

/** Resolved theme colours for SVG attributes; re-reads when appearance changes. */
export function useThemeColors(): ThemeColors {
  const appearance = useLedgr((s) => s.settings.appearance);
  const [c, setC] = useState<ThemeColors>(FALLBACK);
  useEffect(() => {
    const id = requestAnimationFrame(() => setC(read()));
    return () => cancelAnimationFrame(id);
  }, [appearance]);
  return c;
}

const axisProps = { tickLine: false, axisLine: false, fontSize: 11 } as const;

export function ChartTooltip({ active, payload, label, render }: { active?: boolean; payload?: { payload: Record<string, unknown>; value: number; name: string; color?: string }[]; label?: string | number; render: (p: Record<string, unknown>, label?: string | number) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-line bg-card-2 px-3 py-2 text-xs text-text shadow-2xl">{render(payload[0].payload, label)}</div>;
}

export function Sparkline({ data, tone }: { data: number[]; tone: "pos" | "neg" | "accent" }) {
  const c = useThemeColors();
  const color = tone === "pos" ? c.pos : tone === "neg" ? c.neg : c.accent;
  if (data.length < 2) return <div className="h-9" />;
  const d = data.map((v, i) => ({ i, v }));
  const gid = `sp-${tone}`;
  return (
    <div className="h-9" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={d} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gid})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cumulative equity with zoom (brush) and hover. */
export function EquityChart({ data, currency, height = 300, brush = true, baseline = 0, series }: { data: { label: string; value: number; date?: string; net?: number }[]; currency: string; height?: number; brush?: boolean; baseline?: number; series?: string }) {
  const c = useThemeColors();
  const last = data[data.length - 1]?.value ?? 0;
  const color = last >= baseline ? c.pos : c.neg;
  return (
    <div style={{ height }} role="img" aria-label={`${series ?? "Cumulative P&L"} chart with ${data.length} points`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" {...axisProps} tick={{ fill: c.muted }} minTickGap={32} />
          <YAxis {...axisProps} tick={{ fill: c.muted }} width={64} tickFormatter={(v) => fmtMoney(v, currency, { compact: true })} domain={["auto", "auto"]} />
          <ReferenceLine y={baseline} stroke={c.border} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: c.muted, strokeDasharray: "3 3" }}
            content={<ChartTooltip render={(p) => (
              <>
                <p className="text-muted">{p.date ? fmtDate(p.date as string) : String(p.label)}</p>
                <p className="num mt-1 text-[13px]">{fmtMoney(p.value as number, currency)}</p>
                {typeof p.net === "number" && <p className={`num ${(p.net as number) >= 0 ? "pos" : "neg"}`}>{fmtMoney(p.net as number, currency, { sign: true })} this period</p>}
              </>
            )} />}
          />
          <Area type="monotone" dataKey="value" name={series ?? "Cumulative P&L"} stroke={color} strokeWidth={2} fill="url(#eq-fill)" animationDuration={500} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.card }} />
          {brush && data.length > 12 && <Brush dataKey="label" height={22} stroke={c.border} fill={c.card} travellerWidth={8} tickFormatter={() => ""} />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Signed bars (daily / monthly P&L). */
export function PnlBars({ data, currency, height = 240 }: { data: { label: string; value: number; count?: number }[]; currency: string; height?: number }) {
  const c = useThemeColors();
  return (
    <div style={{ height }} role="img" aria-label={`Profit and loss bars, ${data.length} periods`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" {...axisProps} tick={{ fill: c.muted }} minTickGap={20} />
          <YAxis {...axisProps} tick={{ fill: c.muted }} width={64} tickFormatter={(v) => fmtMoney(v, currency, { compact: true })} />
          <ReferenceLine y={0} stroke={c.border} />
          <Tooltip content={<ChartTooltip render={(p) => (<><p className="text-muted">{String(p.label)}</p><p className={`num mt-1 text-[13px] ${(p.value as number) >= 0 ? "pos" : "neg"}`}>{fmtMoney(p.value as number, currency, { sign: true })}</p>{typeof p.count === "number" && <p className="text-muted">{p.count as number} trades</p>}</>)} />} />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={28} animationDuration={500}>
            {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? c.pos : c.neg} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal comparison bars for grouped statistics. Signed metric colours by polarity. */
export function CompareBars({ data, format, height, signed = true, valueLabel }: { data: { label: string; value: number; n: number; extra?: string }[]; format: (v: number) => string; height?: number; signed?: boolean; valueLabel: string }) {
  const c = useThemeColors();
  const h = height ?? Math.max(120, data.length * 34 + 24);
  return (
    <div style={{ height: h }} role="img" aria-label={`${valueLabel} by group`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke={c.grid} />
          <XAxis type="number" {...axisProps} tick={{ fill: c.muted }} tickFormatter={(v) => format(v)} />
          <YAxis type="category" dataKey="label" {...axisProps} tick={{ fill: c.text2 }} width={120} />
          {signed && <ReferenceLine x={0} stroke={c.border} />}
          <Tooltip content={<ChartTooltip render={(p) => (<><p className="text-text">{String(p.label)}</p><p className="num mt-1">{valueLabel}: {format(p.value as number)}</p><p className="text-muted">{p.n as number} trades{p.extra ? ` · ${p.extra}` : ""}</p></>)} />} />
          <Bar dataKey="value" radius={4} maxBarSize={18} animationDuration={500}>
            {data.map((d, i) => <Cell key={i} fill={signed ? (d.value >= 0 ? c.pos : c.neg) : c.accent} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-hue frequency bars (distributions and counts). */
export function CountBars({ data, height = 220, xLabel, color }: { data: { label: string; value: number; tone?: "pos" | "neg" }[]; height?: number; xLabel: string; color?: string }) {
  const c = useThemeColors();
  return (
    <div style={{ height }} role="img" aria-label={`${xLabel} distribution`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" {...axisProps} tick={{ fill: c.muted }} interval={0} />
          <YAxis {...axisProps} tick={{ fill: c.muted }} allowDecimals={false} width={40} />
          <Tooltip content={<ChartTooltip render={(p) => (<><p className="text-muted">{xLabel}: {String(p.label)}</p><p className="num mt-1">{p.value as number} trades</p></>)} />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={500}>
            {data.map((d, i) => <Cell key={i} fill={d.tone === "pos" ? c.pos : d.tone === "neg" ? c.neg : color === "neutral" ? c.neutral : color ?? c.accent} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Generic line with a percentage or numeric axis. */
export function TrendLine({ data, format, height = 220, name, refY }: { data: { label: string; value: number | null; n?: number }[]; format: (v: number) => string; height?: number; name: string; refY?: number }) {
  const c = useThemeColors();
  return (
    <div style={{ height }} role="img" aria-label={`${name} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" {...axisProps} tick={{ fill: c.muted }} minTickGap={28} />
          <YAxis {...axisProps} tick={{ fill: c.muted }} width={52} tickFormatter={(v) => format(v)} domain={["auto", "auto"]} />
          {refY !== undefined && <ReferenceLine y={refY} stroke={c.border} strokeDasharray="3 3" />}
          <Tooltip cursor={{ stroke: c.muted, strokeDasharray: "3 3" }} content={<ChartTooltip render={(p) => (<><p className="text-muted">{String(p.label)}</p><p className="num mt-1">{name}: {p.value === null ? "—" : format(p.value as number)}</p>{typeof p.n === "number" && <p className="text-muted">after {p.n as number} trades</p>}</>)} />} />
          <Line type="monotone" dataKey="value" name={name} stroke={c.accent} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.card }} connectNulls animationDuration={500} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Multiple equity lines (account comparison). Categorical colours in fixed order. */
export function MultiLine({ data, keys, labels, currency, height = 280 }: { data: Record<string, number | string | null>[]; keys: string[]; labels: Record<string, string>; currency: string; height?: number }) {
  const c = useThemeColors();
  return (
    <div style={{ height }} role="img" aria-label="Account comparison chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" {...axisProps} tick={{ fill: c.muted }} minTickGap={28} />
          <YAxis {...axisProps} tick={{ fill: c.muted }} width={64} tickFormatter={(v) => `${fmtNum(v, 0)}%`} />
          <ReferenceLine y={0} stroke={c.border} strokeDasharray="3 3" />
          <Tooltip cursor={{ stroke: c.muted, strokeDasharray: "3 3" }} content={({ active, payload, label }) => active && payload?.length ? (
            <div className="rounded-xl border border-line bg-card-2 px-3 py-2 text-xs shadow-2xl">
              <p className="mb-1 text-muted">{String(label)}</p>
              {payload.map((p) => <p key={String(p.dataKey)} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} /><span className="text-text-2">{labels[String(p.dataKey)]}</span><span className="num ml-auto pl-3 text-text">{fmtNum(p.value as number, 2)}%</span></p>)}
            </div>) : null} />
          <Legend formatter={(v) => <span className="text-xs text-text-2">{labels[v] ?? v}</span>} iconType="plainline" />
          {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={c.series[i % c.series.length]} strokeWidth={2} dot={false} connectNulls animationDuration={500} />)}
        </LineChart>
      </ResponsiveContainer>
      <span className="sr-only">Values are percentage return on each account's virtual starting balance. {currency}</span>
    </div>
  );
}

/** Drawdown (always ≤ 0). */
export function DrawdownChart({ data, currency, height = 200 }: { data: { label: string; value: number }[]; currency: string; height?: number }) {
  const c = useThemeColors();
  return (
    <div style={{ height }} role="img" aria-label="Drawdown chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" {...axisProps} tick={{ fill: c.muted }} minTickGap={32} />
          <YAxis {...axisProps} tick={{ fill: c.muted }} width={64} tickFormatter={(v) => fmtMoney(v, currency, { compact: true })} />
          <Tooltip cursor={{ stroke: c.muted, strokeDasharray: "3 3" }} content={<ChartTooltip render={(p) => (<><p className="text-muted">{String(p.label)}</p><p className="num neg mt-1">{fmtMoney(p.value as number, currency)}</p><p className="text-muted">below prior peak</p></>)} />} />
          <Area type="stepAfter" dataKey="value" stroke={c.neg} strokeWidth={1.5} fill={c.neg} fillOpacity={0.12} animationDuration={500} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-part proportion bar (e.g. winning vs losing records) with legend. */
export function SplitBar({ parts }: { parts: { label: string; value: number; tone: "pos" | "neg" | "muted" }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return null;
  const bg = { pos: "bg-pos", neg: "bg-neg", muted: "bg-muted/50" };
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.label} className={`${bg[p.tone]} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {parts.map((p) => <span key={p.label} className="flex items-center gap-2 text-text-2"><span className={`h-2 w-2 rounded-full ${bg[p.tone]}`} />{p.label}<span className="num text-text">{p.value}</span><span className="text-muted">({Math.round((p.value / total) * 100)}%)</span></span>)}
      </div>
    </div>
  );
}
