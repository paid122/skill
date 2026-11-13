"use client";
/**
 * Dashboard building blocks: stat cards with small gauges, a month calendar with weekly totals,
 * the LEDGR score radar and daily P&L bars. Everything is calculated from closed trades in scope.
 */
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { chronological, closedOnly, type EnrichedTrade, type Stats } from "@/lib/calc";
import { cx, fmtDate, fmtMoney, fmtNum, fmtPct, parseISODate, toISODate, today } from "@/lib/util";
import { useThemeColors } from "./charts";
import { Card, Tooltip } from "./ui";

const Info = ({ tip }: { tip: string }) => (
  <Tooltip text={tip}><span className="grid h-4 w-4 cursor-help place-items-center rounded-full border border-line text-[9px] text-muted">i</span></Tooltip>
);

function StatCard({ label, tip, children, side, href }: { label: string; tip: string; children: React.ReactNode; side?: React.ReactNode; href?: string }) {
  const body = (
    <Card className="flex h-full min-h-[118px] items-center justify-between gap-3 !p-5 transition-colors hover:border-muted/50">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-text-2">{label} <Info tip={tip} /></p>
        <div className="mt-2">{children}</div>
      </div>
      {side && <div className="shrink-0">{side}</div>}
    </Card>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

/** Half-circle gauge split into wins / break-even / losses. */
function WinGauge({ w, b, l }: { w: number; b: number; l: number }) {
  const c = useThemeColors();
  const total = w + b + l || 1;
  const R = 34, C = Math.PI * R;
  const seg = (n: number) => (n / total) * C;
  const arcs = [{ n: w, col: c.pos }, { n: b, col: c.muted }, { n: l, col: c.neg }];
  let off = 0;
  return (
    <div className="flex flex-col items-center">
      <svg width="92" height="52" viewBox="0 0 92 52" aria-hidden>
        <path d="M12 46 A34 34 0 0 1 80 46" fill="none" stroke="var(--line)" strokeWidth="7" strokeLinecap="round" />
        {arcs.map((a, i) => {
          const len = seg(a.n);
          const el = len > 0 && <path key={i} d="M12 46 A34 34 0 0 1 80 46" fill="none" stroke={a.col} strokeWidth="7" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} />;
          off += len;
          return el;
        })}
      </svg>
      <div className="-mt-1 flex gap-2 text-[10.5px] font-medium">
        <span className="rounded-full px-1.5" style={{ background: `color-mix(in srgb, ${c.pos} 18%, transparent)`, color: c.pos }}>{w}</span>
        <span className="rounded-full bg-card-2 px-1.5 text-muted">{b}</span>
        <span className="rounded-full px-1.5" style={{ background: `color-mix(in srgb, ${c.neg} 18%, transparent)`, color: c.neg }}>{l}</span>
      </div>
    </div>
  );
}

/** Ring showing gross profit vs gross loss. */
function PfRing({ gp, gl }: { gp: number; gl: number }) {
  const c = useThemeColors();
  const R = 24, C = 2 * Math.PI * R, share = gp + gl > 0 ? gp / (gp + gl) : 0;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="-rotate-90">
      <circle cx="32" cy="32" r={R} fill="none" stroke={gp + gl > 0 ? c.neg : "var(--line)"} strokeWidth="7" />
      {gp > 0 && <circle cx="32" cy="32" r={R} fill="none" stroke={c.pos} strokeWidth="7" strokeDasharray={`${share * C} ${C}`} />}
    </svg>
  );
}

function streaks(closed: EnrichedTrade[], daily: Map<string, { net: number; count: number }>) {
  const run = (signs: number[]) => {
    let cur = 0, best = 0, worst = 0, w = 0, l = 0;
    for (const s of signs) {
      if (s > 0) { w++; l = 0; } else if (s < 0) { l++; w = 0; } else { w = 0; l = 0; }
      best = Math.max(best, w); worst = Math.max(worst, l);
    }
    for (let i = signs.length - 1; i >= 0; i--) {
      if (signs[i] === 0) break;
      if (cur === 0 || Math.sign(cur) === signs[i]) cur += signs[i]; else break;
    }
    return { cur, best, worst };
  };
  const days = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => Math.sign(v.net));
  const trades = chronological(closed).map((x) => (x.m.result === "win" ? 1 : x.m.result === "loss" ? -1 : 0));
  return { days: run(days), trades: run(trades) };
}

function StreakDial({ label, s }: { label: string; s: { cur: number; best: number; worst: number } }) {
  const c = useThemeColors();
  const col = s.cur > 0 ? c.pos : s.cur < 0 ? c.neg : c.muted;
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[3px] text-[15px] font-semibold" style={{ borderColor: col, color: col }}>{Math.abs(s.cur)}</span>
        <div className="grid gap-1 whitespace-nowrap text-[10px] leading-4">
          <span className="rounded-full px-1.5" style={{ background: `color-mix(in srgb, ${c.neg} 16%, transparent)`, color: c.neg }}>{s.worst} {label === "Days" ? "day" + (s.worst === 1 ? "" : "s") : "trade" + (s.worst === 1 ? "" : "s")}</span>
          <span className="rounded-full px-1.5" style={{ background: `color-mix(in srgb, ${c.pos} 16%, transparent)`, color: c.pos }}>{s.best} {label === "Days" ? "day" + (s.best === 1 ? "" : "s") : "trade" + (s.best === 1 ? "" : "s")}</span>
        </div>
      </div>
    </div>
  );
}

export function StatRow({ stats, list, daily, currency }: { stats: Stats; list: EnrichedTrade[]; daily: Map<string, { net: number; count: number }>; currency: string }) {
  const c = useThemeColors();
  const closed = useMemo(() => closedOnly(list), [list]);
  const st = useMemo(() => streaks(closed, daily), [closed, daily]);
  const ratio = stats.avgWin !== null && stats.avgLoss ? stats.avgWin / Math.abs(stats.avgLoss) : null;
  const winShare = stats.avgWin !== null && stats.avgLoss ? stats.avgWin / (stats.avgWin + Math.abs(stats.avgLoss)) : 0.5;
  const tone = (n: number | null) => (n === null ? "" : n > 0 ? "pos" : n < 0 ? "neg" : "");
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key figures">
      <StatCard label="Net P&L" tip="Sum of net results (after fees) for closed trades in range." href="/analytics">
        <p className={cx("num whitespace-nowrap text-[26px] font-semibold leading-none", tone(stats.net))}>{fmtMoney(stats.net, currency, { sign: true })}</p>
        <p className="mt-2 w-fit rounded-md bg-card-2 px-2 py-0.5 text-[11px] text-text-2">{stats.closed} trade{stats.closed === 1 ? "" : "s"}</p>
      </StatCard>
      <StatCard label="Trade win %" tip="Wins ÷ (wins + losses). Break-even trades are shown in grey and excluded." href="/analytics"
        side={<WinGauge w={stats.wins} b={stats.breakeven} l={stats.losses} />}>
        <p className="num text-[26px] font-semibold leading-none">{fmtPct(stats.winRate)}</p>
      </StatCard>
      <StatCard label="Avg win / loss" tip="Average winning trade ÷ average losing trade." href="/analytics">
        <p className="num text-[26px] font-semibold leading-none">{ratio === null ? "—" : fmtNum(ratio, 2)}</p>
        <div className="mt-3 w-[min(200px,100%)]">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-line">
            <span style={{ width: `${winShare * 100}%`, background: c.pos }} />
            <span style={{ width: `${(1 - winShare) * 100}%`, background: c.neg }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-medium">
            <span style={{ color: c.pos }}>{fmtMoney(stats.avgWin, currency)}</span>
            <span style={{ color: c.neg }}>{fmtMoney(stats.avgLoss, currency)}</span>
          </div>
        </div>
      </StatCard>
      <StatCard label="Profit factor" tip="Gross profit of winning trades ÷ gross loss of losing trades." href="/analytics" side={<PfRing gp={stats.grossProfit} gl={stats.grossLoss} />}>
        <p className="num text-[26px] font-semibold leading-none">{stats.profitFactor === null ? (stats.grossProfit > 0 ? "∞" : "—") : fmtNum(stats.profitFactor, 2)}</p>
      </StatCard>
      <Card className="min-h-[118px] !p-5">
        <p className="flex items-center gap-1.5 text-[13px] text-text-2">Current streak <Info tip="Current run of winning (green) or losing (red) days and trades; the pills show your longest losing and winning runs in range." /></p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <StreakDial label="Days" s={st.days} />
          <StreakDial label="Trades" s={st.trades} />
        </div>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------- calendar

export function MonthCalendar({ daily, list, currency, journalDates }: { daily: Map<string, { net: number; count: number }>; list: EnrichedTrade[]; currency: string; journalDates: Set<string> }) {
  const c = useThemeColors();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const winsByDay = useMemo(() => {
    const m = new Map<string, { w: number; l: number }>();
    closedOnly(list).forEach((x) => { const d = m.get(x.trade.date) ?? { w: 0, l: 0 }; if (x.m.result === "win") d.w++; if (x.m.result === "loss") d.l++; m.set(x.trade.date, d); });
    return m;
  }, [list]);
  const weeks = useMemo(() => {
    const first = parseISODate(`${month}-01`);
    const cells: (string | null)[] = Array(first.getDay()).fill(null); // Sunday first
    const d = new Date(first);
    while (d.getMonth() === first.getMonth()) { cells.push(toISODate(d)); d.setDate(d.getDate() + 1); }
    while (cells.length % 7) cells.push(null);
    const out: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [month]);
  const monthDays = weeks.flat().filter(Boolean) as string[];
  const monthNet = monthDays.reduce((s, d) => s + (daily.get(d)?.net ?? 0), 0);
  const monthTraded = monthDays.filter((d) => daily.get(d)?.count).length;
  const shift = (n: number) => { const d = parseISODate(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(toISODate(d).slice(0, 7)); };
  const label = parseISODate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const money = (n: number) => fmtMoney(n, currency, { sign: n < 0, compact: true });
  return (
    <Card className="flex h-full flex-col !p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-text"><ChevronLeft size={16} /></button>
          <span className="min-w-[140px] text-center text-[15px] font-semibold">{label}</span>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-text"><ChevronRight size={16} /></button>
          <button type="button" onClick={() => setMonth(today().slice(0, 7))} className="ml-2 rounded-lg border border-line px-3 py-1 text-[12.5px] text-text-2 hover:text-text">This month</button>
        </div>
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="text-text-2">Monthly stats:</span>
          <span className={cx("num rounded-md px-2 py-0.5 font-medium", monthNet > 0 ? "pos" : monthNet < 0 ? "neg" : "text-muted")} style={{ background: monthNet ? `color-mix(in srgb, ${monthNet > 0 ? c.pos : c.neg} 16%, transparent)` : undefined }}>{money(monthNet)}</span>
          <span className="rounded-md bg-card-2 px-2 py-0.5 text-text-2">{monthTraded} day{monthTraded === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="-mx-1 flex flex-1 overflow-x-auto px-1"><div className="grid min-w-[620px] flex-1 grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.05fr)] gap-1.5" style={{ gridTemplateRows: `auto repeat(${weeks.length}, minmax(86px, 1fr))` }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="rounded-lg bg-card-2 py-1.5 text-center text-[11.5px] font-medium text-text-2">{d}</div>)}
        <div />
        {weeks.map((wk, wi) => {
          const net = wk.reduce((s, d) => s + (d ? daily.get(d)?.net ?? 0 : 0), 0);
          const traded = wk.filter((d) => d && daily.get(d)?.count).length;
          return [
            ...wk.map((d, i) => {
              if (!d) return <div key={`${wi}-${i}`} className="min-h-[86px] rounded-lg bg-card-2/40" />;
              const v = daily.get(d);
              const wl = winsByDay.get(d);
              const wr = wl && wl.w + wl.l ? wl.w / (wl.w + wl.l) : null;
              const col = v ? (v.net > 0 ? c.pos : v.net < 0 ? c.neg : c.muted) : null;
              return (
                <Link key={d} href={`/journal?from=${d}&to=${d}`}
                  className={cx("relative flex min-h-[86px] flex-col items-end justify-between rounded-lg border p-1.5 text-right transition-colors", d === today() ? "border-accent/70" : v ? "border-transparent" : "border-line-soft hover:bg-card-2")}
                  style={col ? { background: `color-mix(in srgb, ${col} 22%, transparent)`, borderColor: `color-mix(in srgb, ${col} 55%, transparent)` } : undefined}
                  title={v ? `${fmtDate(d)} · ${fmtMoney(v.net, currency, { sign: true })} · ${v.count} trade${v.count > 1 ? "s" : ""}` : fmtDate(d)}>
                  <span className="flex w-full items-start justify-between">
                    {journalDates.has(d) ? <NotebookPen size={13} className="text-text-2" aria-label="Journal entry" /> : <span />}
                    <span className="text-[11px] text-text-2">{Number(d.slice(8))}</span>
                  </span>
                  {v && (
                    <span className="leading-tight">
                      <span className="num block whitespace-nowrap text-[13.5px] font-semibold" style={{ color: v.net === 0 ? undefined : col ?? undefined }}>{money(v.net)}</span>
                      <span className="block text-[10.5px] text-text-2">{v.count} trade{v.count > 1 ? "s" : ""}</span>
                      {wr !== null && <span className="block text-[10.5px] text-muted">{fmtNum(wr * 100, 1)}%</span>}
                    </span>
                  )}
                </Link>
              );
            }),
            <div key={`w${wi}`} className="flex min-h-[86px] flex-col justify-center rounded-lg border border-line-soft bg-card-2/50 px-2.5">
              <span className="text-[11px] text-text-2">Week {wi + 1}</span>
              <span className={cx("num whitespace-nowrap text-[14px] font-semibold", net > 0 ? "pos" : net < 0 ? "neg" : "")}>{money(net)}</span>
              <span className="mt-0.5 w-fit rounded-md bg-card-2 px-1.5 text-[10.5px] text-text-2">{traded} day{traded === 1 ? "" : "s"}</span>
            </div>,
          ];
        })}
      </div></div>
    </Card>
  );
}

// ---------------------------------------------------------------- score

/** LEDGR score: six process and result measures (0–100 each), averaged. Needs 10+ closed trades. */
export function ScoreRadar({ stats, daily, discipline }: { stats: Stats; daily: Map<string, { net: number; count: number }>; discipline: number | null }) {
  const c = useThemeColors();
  const days = [...daily.values()];
  const greenDays = days.length ? days.filter((d) => d.net > 0).length / days.length : null;
  const ratio = stats.avgWin !== null && stats.avgLoss ? stats.avgWin / Math.abs(stats.avgLoss) : null;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const enough = stats.closed >= 10;
  const axes = [
    { k: "Win %", v: stats.winRate === null ? null : clamp(stats.winRate * 100) },
    { k: "Profit factor", v: stats.profitFactor === null ? (stats.grossProfit > 0 ? 100 : null) : clamp((stats.profitFactor / 2.5) * 100) },
    { k: "Avg win/loss", v: ratio === null ? null : clamp((ratio / 2.5) * 100) },
    { k: "Drawdown", v: stats.grossProfit > 0 ? clamp(100 - (Math.abs(stats.maxDD.amount) / stats.grossProfit) * 100) : null },
    { k: "Consistency", v: greenDays === null ? null : clamp(greenDays * 100) },
    { k: "Discipline", v: discipline },
  ];
  const usable = axes.filter((a) => a.v !== null) as { k: string; v: number }[];
  const score = enough && usable.length >= 3 ? usable.reduce((s, a) => s + a.v, 0) / usable.length : null;
  return (
    <Card className="!p-5">
      <p className="flex items-center gap-1.5 text-[15px] font-semibold">LEDGR score <Info tip="Average of six 0–100 measures: win %, profit factor (2.5 = 100), average win ÷ loss (2.5 = 100), drawdown control, share of green days, and your discipline score. Shown after 10 closed trades." /></p>
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={axes.map((a) => ({ ...a, v: a.v ?? 0 }))} outerRadius="72%">
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis dataKey="k" tick={{ fill: c.text2, fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="v" stroke={c.accent} fill={c.accent} fillOpacity={0.22} strokeWidth={2} dot={{ r: 3, fill: c.accent }} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 border-t border-line-soft pt-4">
        <div>
          <p className="text-[12px] text-text-2">Your LEDGR score</p>
          <p className="num text-[26px] font-semibold leading-tight">{score === null ? "—" : fmtNum(score, 2)}</p>
        </div>
        <div>
          <div className="relative h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${c.neg}, #e9c46a, ${c.pos})` }}>
            {score !== null && <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-text" style={{ left: `${score}%` }} />}
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-muted">{[0, 20, 40, 60, 80, 100].map((n) => <span key={n}>{n}</span>)}</div>
        </div>
      </div>
      {!enough && <p className="mt-3 text-[12px] text-muted">Log at least 10 closed trades to see your score.</p>}
    </Card>
  );
}
