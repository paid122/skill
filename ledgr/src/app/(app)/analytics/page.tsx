"use client";
import { FlaskConical, Info, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiCard, PageIntro, ScopeControls, Stat } from "@/components/blocks";
import { CompareBars, CountBars, DrawdownChart, EquityChart, PnlBars, SplitBar, TrendLine, useThemeColors } from "@/components/charts";
import { Badge, Card, Chips, Field, Modal, NotEnoughData, NumberInput, SectionTitle, Segmented, Tabs, Toggle } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { updateSettings } from "@/lib/actions";
import { chronological, closedOnly, computeStats, dailyPnl, equityCurve, frequency, groupStats, type EnrichedTrade, type Stats } from "@/lib/calc";
import { INSIGHT_KEYS } from "@/lib/defaults";
import { useCurrency, useScoped } from "@/lib/hooks";
import { computeInsights, INSIGHT_META } from "@/lib/insights";
import { useLedgr } from "@/lib/store";
import { EMOTIONS, GRADES, SESSIONS } from "@/lib/types";
import { cx, dayOfWeek, DOW, fmtDate, fmtMoney, fmtNum, fmtPct, fmtR, monthKey } from "@/lib/util";

type Tab = "charts" | "breakdown" | "insights" | "whatif";
type Metric = "avgR" | "net" | "winRate";

export default function AnalyticsPage() {
  const { current } = useScoped();
  const currency = useCurrency();
  const [tab, setTab] = useState<Tab>("charts");
  const stats = useMemo(() => computeStats(current), [current]);
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Analytics" sub="Every figure is calculated from your saved, closed records. Small samples vary — read patterns as prompts for review, not conclusions." actions={<ScopeControls />} />
      <PageVerse page="analytics" compact />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Overview">
        <KpiCard label="Total P&L" numeric={stats.net} format={(n) => fmtMoney(n, currency, { sign: true })} tip="Σ net of closed trades (after fees)." footnote={`${stats.closed} closed trades`} />
        <KpiCard label="Win rate" numeric={stats.winRate} format={(n) => fmtPct(n)} tip="Wins ÷ (wins + losses). Break-even excluded." footnote={`${stats.wins}W · ${stats.losses}L · ${stats.breakeven} BE`} />
        <KpiCard label="Profit factor" numeric={stats.profitFactor} format={(n) => (n === null ? (stats.grossProfit > 0 ? "No losses" : "—") : fmtNum(n))} tip="Gross profit ÷ gross loss." footnote={`${fmtMoney(stats.grossProfit, currency, { compact: true })} / ${fmtMoney(stats.grossLoss, currency, { compact: true })}`} />
        <KpiCard label="Average R" numeric={stats.avgR} format={(n) => fmtR(n)} tip="Mean R over trades with recorded risk." footnote={`${stats.rCoverage} of ${stats.closed} trades have risk recorded`} />
        <KpiCard label="Average winner" numeric={stats.avgWin} format={(n) => fmtMoney(n, currency)} tip="Gross profit ÷ number of winning trades." />
        <KpiCard label="Average loser" numeric={stats.avgLoss} format={(n) => fmtMoney(n, currency)} tip="Gross loss ÷ number of losing trades." />
        <KpiCard label="Maximum drawdown" numeric={stats.maxDD.amount} format={(n) => fmtMoney(n, currency)} tip="Largest peak-to-trough fall of cumulative P&L across closed trades in range." />
        <KpiCard label="Trade count" numeric={stats.closed} format={(n) => fmtNum(n, 0)} tip="Closed trades in range." footnote={stats.excludedDrafts + stats.excludedOpen ? `${stats.excludedDrafts + stats.excludedOpen} incomplete excluded` : "All records complete"} />
      </section>

      <Tabs tabs={[{ value: "charts", label: "Charts" }, { value: "breakdown", label: "Breakdowns" }, { value: "insights", label: "Pattern insights" }, { value: "whatif", label: "What-if analysis" }]} value={tab} onChange={setTab} />
      {tab === "charts" && <Charts list={current} currency={currency} stats={stats} />}
      {tab === "breakdown" && <Breakdowns list={current} currency={currency} />}
      {tab === "insights" && <Insights list={current} />}
      {tab === "whatif" && <WhatIf list={current} currency={currency} />}
    </div>
  );
}

function ChartCard({ title, sub, children, enough, note, className }: { title: string; sub?: string; children: React.ReactNode; enough: boolean; note?: string; className?: string }) {
  return (
    <Card className={className}>
      <SectionTitle title={title} sub={sub} />
      {enough ? children : <NotEnoughData note={note} />}
    </Card>
  );
}

function Charts({ list, currency, stats }: { list: EnrichedTrade[]; currency: string; stats: Stats }) {
  const closed = useMemo(() => chronological(closedOnly(list)), [list]);
  const curve = useMemo(() => equityCurve(list), [list]);
  const eqData = curve.map((p) => ({ label: `#${list.find((x) => x.trade.id === p.tradeId)?.trade.number ?? p.index}`, date: p.date, value: p.equity, net: p.net }));
  const daily = useMemo(() => [...dailyPnl(list).entries()].sort().map(([d, v]) => ({ label: fmtDate(d, "day"), value: v.net, count: v.count })), [list]);
  const monthly = useMemo(() => {
    const m = new Map<string, { net: number; count: number }>();
    closed.forEach((x) => { const k = monthKey(x.trade.date); const v = m.get(k) ?? { net: 0, count: 0 }; v.net += x.m.net as number; v.count++; m.set(k, v); });
    return [...m.entries()].map(([k, v]) => ({ label: new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }), value: v.net, count: v.count }));
  }, [closed]);
  const winProg = useMemo(() => { let w = 0, l = 0; return closed.map((x, i) => { if (x.m.result === "win") w++; if (x.m.result === "loss") l++; return { label: `#${x.trade.number}`, value: w + l ? (w / (w + l)) * 100 : null, n: i + 1 }; }); }, [closed]);
  const rDist = useMemo(() => {
    const bins = [[-Infinity, -2, "≤ −2"], [-2, -1, "−2 to −1"], [-1, -0.5, "−1 to −0.5"], [-0.5, 0, "−0.5 to 0"], [0, 0.5, "0 to 0.5"], [0.5, 1, "0.5 to 1"], [1, 2, "1 to 2"], [2, 3, "2 to 3"], [3, Infinity, "≥ 3"]] as const;
    const rs = closed.map((x) => x.m.r).filter((r): r is number => r !== null);
    return { n: rs.length, data: bins.map(([a, b, label]) => ({ label, value: rs.filter((r) => r >= a && r < b).length, tone: (b <= 0 ? "neg" : "pos") as "pos" | "neg" })) };
  }, [closed]);
  const dd = curve.map((p, i) => ({ label: `${i + 1}`, value: p.drawdown }));
  const grades = useMemo(() => { const f = frequency(closed.map((x) => x.trade.grade).filter(Boolean) as string[]); return { n: f.reduce((s, x) => s + x.count, 0), data: GRADES.map((g) => ({ label: g, value: f.find((x) => x.key === g)?.count ?? 0 })) }; }, [closed]);
  const mistakes = useMemo(() => frequency(list.flatMap((x) => x.trade.mistakes)), [list]);
  const grp = (k: (x: EnrichedTrade) => string | string[] | null, order?: string[]) => {
    const g = groupStats(list, k);
    const rows = g.map((x) => ({ label: x.key, value: x.stats.net, n: x.stats.closed, extra: `${fmtPct(x.stats.winRate, 0)} win · ${fmtR(x.stats.avgR)}` }));
    return order ? rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows;
  };
  const enough = closed.length >= 2;
  const money = (v: number) => fmtMoney(v, currency, { compact: true });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard className="lg:col-span-2" title="1 · Equity curve" sub="Cumulative net by trade. Drag the handles to zoom." enough={enough}><EquityChart data={eqData} currency={currency} /></ChartCard>
      <ChartCard title="2 · Daily P&L" enough={daily.length > 0}><PnlBars data={daily} currency={currency} /></ChartCard>
      <ChartCard title="3 · Monthly P&L" enough={monthly.length > 0}><PnlBars data={monthly} currency={currency} /></ChartCard>
      <ChartCard title="4 · Win-rate progression" sub="Cumulative wins ÷ (wins + losses)" enough={winProg.length >= 5} note="Needs at least five closed trades."><TrendLine data={winProg} name="Win rate" format={(v) => `${fmtNum(v, 0)}%`} refY={50} /></ChartCard>
      <ChartCard title="5 · R distribution" sub={`${rDist.n} trades with recorded risk`} enough={rDist.n >= 3} note="Record a stop or planned risk to calculate R."><CountBars data={rDist.data} xLabel="R range" /></ChartCard>
      <ChartCard title="6 · Drawdown" sub="Distance below the prior equity peak, by trade" enough={enough}><DrawdownChart data={dd} currency={currency} /></ChartCard>
      <ChartCard title="7 · Winning vs losing records" enough={stats.closed > 0}>
        <SplitBar parts={[{ label: "Winning", value: stats.wins, tone: "pos" }, { label: "Losing", value: stats.losses, tone: "neg" }, { label: "Break-even", value: stats.breakeven, tone: "muted" }]} />
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line-soft pt-4 sm:grid-cols-4">
          <Stat label="Average winner" value={fmtMoney(stats.avgWin, currency)} tone={1} />
          <Stat label="Average loser" value={fmtMoney(stats.avgLoss, currency)} tone={-1} />
          <Stat label="Largest win" value={fmtMoney(stats.largestWin, currency)} />
          <Stat label="Largest loss" value={fmtMoney(stats.largestLoss, currency)} />
        </div>
      </ChartCard>
      <ChartCard title="8 · Setup comparison" sub="Net by setup" enough={grp((x) => x.trade.setup || null).length > 0}><CompareBars data={grp((x) => x.trade.setup || null)} format={money} valueLabel="Net" /></ChartCard>
      <ChartCard title="9 · Market comparison" sub="Net by market" enough={grp((x) => x.trade.market).length > 0}><CompareBars data={grp((x) => x.trade.market)} format={money} valueLabel="Net" /></ChartCard>
      <ChartCard title="10 · Session comparison" sub="Net by session" enough={grp((x) => x.trade.session).length > 0}><CompareBars data={grp((x) => x.trade.session, SESSIONS)} format={money} valueLabel="Net" /></ChartCard>
      <ChartCard title="11 · Day-of-week comparison" sub="Net by weekday" enough={enough}><CompareBars data={grp((x) => dayOfWeek(x.trade.date), DOW)} format={money} valueLabel="Net" /></ChartCard>
      <ChartCard title="12 · Emotion comparison" sub="Net by recorded emotion. Trades with several emotions appear in each." enough={grp((x) => x.trade.emotions).length > 0} note="Record emotions on the Psychology tab of each trade."><CompareBars data={grp((x) => x.trade.emotions, EMOTIONS)} format={money} valueLabel="Net" /></ChartCard>
      <ChartCard title="13 · Trade grade distribution" sub={`${grades.n} graded trades`} enough={grades.n > 0} note="Grade trades on the Execution tab."><CountBars data={grades.data} xLabel="Grade" /></ChartCard>
      <ChartCard title="14 · Mistake frequency" sub="Documented mistakes across all records in range" enough={mistakes.length > 0} note="No mistakes documented yet.">
        <CountBars data={mistakes.map((m) => ({ label: m.key.replace("Incomplete ", "Incompl. "), value: m.count }))} xLabel="Mistake" color="neutral" height={240} />
      </ChartCard>
    </div>
  );
}

function Breakdowns({ list, currency }: { list: EnrichedTrade[]; currency: string }) {
  const [metric, setMetric] = useState<Metric>("avgR");
  const fmt = (v: number) => (metric === "avgR" ? fmtR(v) : metric === "net" ? fmtMoney(v, currency, { compact: true }) : `${fmtNum(v, 0)}%`);
  const dims: { title: string; key: (x: EnrichedTrade) => string | string[] | null }[] = [
    { title: "Setup", key: (x) => x.trade.setup || null },
    { title: "Market", key: (x) => x.trade.market },
    { title: "Session", key: (x) => x.trade.session },
    { title: "Weekday", key: (x) => dayOfWeek(x.trade.date) },
    { title: "Direction", key: (x) => (x.trade.direction === "long" ? "Long" : x.trade.direction === "short" ? "Short" : null) },
    { title: "Grade", key: (x) => x.trade.grade },
    { title: "Emotion", key: (x) => x.trade.emotions },
    { title: "Plan adherence", key: (x) => (x.trade.reflection.followedPlan === "yes" ? "Followed plan" : x.trade.reflection.followedPlan === "partial" ? "Partly followed" : x.trade.reflection.followedPlan === "no" ? "Did not follow" : null) },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-text-2">Compare groups by one measure. Trades without the attribute are left out.</p>
        <Segmented ariaLabel="Metric" value={metric} onChange={setMetric} options={[{ value: "avgR", label: "Average R" }, { value: "net", label: "Net" }, { value: "winRate", label: "Win rate" }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {dims.map((d) => {
          const rows = groupStats(list, d.key).map((g) => ({ label: g.key, n: g.stats.closed, value: metric === "avgR" ? g.stats.avgR : metric === "net" ? g.stats.net : g.stats.winRate === null ? null : g.stats.winRate * 100, extra: `${fmtPct(g.stats.winRate, 0)} win · ${fmtMoney(g.stats.net, currency, { compact: true })}` })).filter((r): r is { label: string; n: number; value: number; extra: string } => r.value !== null);
          return (
            <Card key={d.title}>
              <SectionTitle title={d.title} sub={`${rows.reduce((s, r) => s + r.n, 0)} trade-groupings`} />
              {rows.length ? (
                <>
                  <CompareBars data={rows} format={fmt} valueLabel={metric === "avgR" ? "Average R" : metric === "net" ? "Net" : "Win rate"} signed={metric !== "winRate"} />
                  <table className="mt-3 w-full text-xs">
                    <thead className="text-left text-muted"><tr><th className="py-1 font-medium">Group</th><th className="py-1 text-right font-medium">Trades</th><th className="py-1 text-right font-medium">Value</th></tr></thead>
                    <tbody>{rows.map((r) => <tr key={r.label} className="border-t border-line-soft"><td className="py-1.5 text-text-2">{r.label}{r.n < 5 && <span className="ml-1 text-muted">(small sample)</span>}</td><td className="num py-1.5 text-right">{r.n}</td><td className="num py-1.5 text-right">{fmt(r.value)}</td></tr>)}</tbody>
                  </table>
                </>
              ) : <NotEnoughData />}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Insights({ list }: { list: EnrichedTrade[] }) {
  const cfg = useLedgr((s) => s.settings.insights);
  const [configuring, setConfiguring] = useState(false);
  const insights = useMemo(() => computeInsights(list, cfg.minSample), [list, cfg.minSample]);
  const shown = insights.filter((i) => cfg.enabled[i.key] !== false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] text-text-2"><Info size={14} className="text-muted" /> Insights appear once you have {cfg.minSample} closed trades in range. They describe your records; they do not show cause or predict results.</p>
        <button type="button" onClick={() => setConfiguring(true)} className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text"><Settings2 size={14} /> Configure ({shown.length}/{insights.length})</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((i) => (
          <Card key={i.key} className="flex flex-col">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="text-[14px] font-semibold">{i.title}</h3>
              {i.status === "ok" && <Badge tone="muted">n = {i.sample}</Badge>}
            </div>
            <p className="text-xs text-muted">{i.description}</p>
            {i.status === "insufficient" ? (
              <div className="mt-4 flex flex-1 items-center rounded-lg border border-dashed border-line px-3 py-4 text-[13px] text-text-2">Not enough journal data yet.</div>
            ) : (
              <>
                <p className="mt-3 text-[13.5px] leading-relaxed text-text">{i.headline}</p>
                {i.rows && i.rows.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 border-t border-line-soft pt-3 text-xs">
                    {i.rows.slice(0, 6).map((r) => <li key={r.label} className="flex justify-between gap-3"><span className="truncate text-text-2">{r.label}</span><span className="num shrink-0 text-text-2">{r.value}</span></li>)}
                  </ul>
                )}
                {i.detail && <p className="mt-auto pt-3 text-[11.5px] leading-relaxed text-muted">{i.detail}</p>}
              </>
            )}
          </Card>
        ))}
      </div>
      <Modal open={configuring} onClose={() => setConfiguring(false)} title="Configure insights" size="md">
        <div className="grid gap-4">
          <Field label="Minimum closed trades before insights appear" hint="Higher values give steadier, more reliable patterns.">
            <NumberInput value={cfg.minSample} allowEmpty={false} onChange={(n) => updateSettings({ insights: { ...cfg, minSample: Math.max(5, Math.min(200, Math.round(n ?? 10))) } })} className="w-28" />
          </Field>
          <div className="grid gap-3 border-t border-line-soft pt-4">
            {INSIGHT_KEYS.map((k) => <Toggle key={k} label={INSIGHT_META[k].title} description={INSIGHT_META[k].description} checked={cfg.enabled[k] !== false} onChange={(v) => updateSettings({ insights: { ...cfg, enabled: { ...cfg.enabled, [k]: v } } })} />)}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// What-if (hypothetical, educational)
// ---------------------------------------------------------------------------

interface Scenario { excludeMistakes: string[]; excludeEmotions: string[]; onlySetups: string[]; onlySessions: string[]; capLossR: number | null; maxPerDay: number | null; onlyFollowedPlan: boolean }
const EMPTY_SCENARIO: Scenario = { excludeMistakes: [], excludeEmotions: [], onlySetups: [], onlySessions: [], capLossR: null, maxPerDay: null, onlyFollowedPlan: false };

function WhatIf({ list, currency }: { list: EnrichedTrade[]; currency: string }) {
  const c = useThemeColors();
  const mistakeCats = useLedgr((s) => s.settings.mistakeCategories);
  const [sc, setSc] = useState<Scenario>(EMPTY_SCENARIO);
  const closed = useMemo(() => chronological(closedOnly(list)), [list]);
  const setups = useMemo(() => [...new Set(closed.map((x) => x.trade.setup).filter(Boolean))], [closed]);
  const sessions = useMemo(() => [...new Set(closed.map((x) => x.trade.session).filter(Boolean))] as string[], [closed]);

  const { hypo, capped, uncappable } = useMemo(() => {
    const perDay = new Map<string, number>();
    let capped = 0, uncappable = 0;
    const out: EnrichedTrade[] = [];
    for (const x of closed) {
      const t = x.trade;
      const n = (perDay.get(t.date) ?? 0) + 1;
      perDay.set(t.date, n);
      if (sc.maxPerDay && n > sc.maxPerDay) continue;
      if (sc.excludeMistakes.some((m) => t.mistakes.includes(m))) continue;
      if (sc.excludeEmotions.some((e) => t.emotions.includes(e as never))) continue;
      if (sc.onlySetups.length && !sc.onlySetups.includes(t.setup)) continue;
      if (sc.onlySessions.length && !sc.onlySessions.includes(t.session ?? "")) continue;
      if (sc.onlyFollowedPlan && t.reflection.followedPlan !== "yes") continue;
      let m = x.m;
      if (sc.capLossR && (m.net ?? 0) < 0) {
        if (m.risk) {
          const floor = -sc.capLossR * m.risk;
          if ((m.net as number) < floor) { m = { ...m, net: floor, r: -sc.capLossR }; capped++; }
        } else uncappable++;
      }
      out.push({ trade: t, m });
    }
    return { hypo: out, capped, uncappable };
  }, [closed, sc]);

  const a = useMemo(() => computeStats(closed), [closed]);
  const h = useMemo(() => computeStats(hypo), [hypo]);
  const data = useMemo(() => {
    const hyIds = new Map(hypo.map((x) => [x.trade.id, x.m.net as number]));
    let ea = 0, eh = 0;
    return closed.map((x) => { ea += x.m.net as number; if (hyIds.has(x.trade.id)) eh += hyIds.get(x.trade.id)!; return { label: `#${x.trade.number}`, actual: ea, hypothetical: eh }; });
  }, [closed, hypo]);
  const active = JSON.stringify(sc) !== JSON.stringify(EMPTY_SCENARIO);

  if (closed.length < 5) return <Card><NotEnoughData note="What-if analysis needs at least five closed trades." /></Card>;

  const row = (label: string, av: string, hv: string) => (
    <tr className="border-t border-line-soft"><td className="py-2 text-text-2">{label}</td><td className="num py-2 text-right">{av}</td><td className="num py-2 text-right text-accent">{hv}</td></tr>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-[13px] text-text-2">
        <FlaskConical size={16} className="mt-0.5 shrink-0 text-accent" />
        <p><span className="font-semibold text-text">Hypothetical, for learning only.</span> This replays your recorded trades under assumptions you choose. It is not a prediction, does not account for how different decisions would have changed later trades, and is not a recommendation.</p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <SectionTitle title="Assumptions" action={active ? <button type="button" className="text-[13px] text-text-2 hover:text-text" onClick={() => setSc(EMPTY_SCENARIO)}>Reset</button> : undefined} />
          <div className="grid gap-5">
            <Field label="Remove trades with these documented mistakes"><Chips options={mistakeCats} value={sc.excludeMistakes} onChange={(v) => setSc({ ...sc, excludeMistakes: v })} /></Field>
            <Field label="Remove trades with these emotions"><Chips options={EMOTIONS} value={sc.excludeEmotions as never[]} onChange={(v) => setSc({ ...sc, excludeEmotions: v })} /></Field>
            {setups.length > 0 && <Field label="Keep only these setups"><Chips options={setups} value={sc.onlySetups} onChange={(v) => setSc({ ...sc, onlySetups: v })} /></Field>}
            {sessions.length > 0 && <Field label="Keep only these sessions"><Chips options={sessions} value={sc.onlySessions} onChange={(v) => setSc({ ...sc, onlySessions: v })} /></Field>}
            <Toggle label="Keep only trades where I followed my plan" checked={sc.onlyFollowedPlan} onChange={(v) => setSc({ ...sc, onlyFollowedPlan: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cap each loss at (R)" hint="Needs recorded risk"><NumberInput value={sc.capLossR} onChange={(n) => setSc({ ...sc, capLossR: n && n > 0 ? n : null })} placeholder="e.g. 1" /></Field>
              <Field label="Max trades per day"><NumberInput value={sc.maxPerDay} onChange={(n) => setSc({ ...sc, maxPerDay: n && n >= 1 ? Math.floor(n) : null })} placeholder="e.g. 2" /></Field>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Recorded vs hypothetical equity" sub={active ? `${hypo.length} of ${closed.length} trades kept${capped ? ` · ${capped} losses capped` : ""}${uncappable ? ` · ${uncappable} losses without recorded risk left unchanged` : ""}` : "Choose an assumption to compare."} />
            <div style={{ height: 300 }} role="img" aria-label="Recorded versus hypothetical cumulative P&L">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: c.muted }} minTickGap={32} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} tick={{ fill: c.muted }} width={64} tickFormatter={(v) => fmtMoney(v, currency, { compact: true })} />
                  <ReferenceLine y={0} stroke={c.border} strokeDasharray="3 3" />
                  <Tooltip cursor={{ stroke: c.muted, strokeDasharray: "3 3" }} content={({ active: on, payload, label }) => on && payload?.length ? (
                    <div className="rounded-xl border border-line bg-card-2 px-3 py-2 text-xs shadow-2xl">
                      <p className="mb-1 text-muted">{String(label)}</p>
                      <p>Recorded <span className="num ml-2">{fmtMoney(payload[0]?.value as number, currency)}</span></p>
                      {active && <p className="text-accent">Hypothetical <span className="num ml-2">{fmtMoney(payload[1]?.value as number, currency)}</span></p>}
                    </div>) : null} />
                  <Legend formatter={(v) => <span className="text-xs text-text-2">{v === "actual" ? "Recorded" : "Hypothetical"}</span>} iconType="plainline" />
                  <Line type="monotone" dataKey="actual" stroke={c.text2} strokeWidth={2} dot={false} animationDuration={400} />
                  {active && <Line type="monotone" dataKey="hypothetical" stroke={c.accent} strokeWidth={2} strokeDasharray="6 4" dot={false} animationDuration={400} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionTitle title="Comparison" sub="Hypothetical figures are not results." />
            <table className="w-full text-[13px]">
              <thead className="text-left text-xs text-muted"><tr><th className="py-1 font-medium">Measure</th><th className="py-1 text-right font-medium">Recorded</th><th className="py-1 text-right font-medium">Hypothetical</th></tr></thead>
              <tbody>
                {row("Trades", fmtNum(a.closed, 0), fmtNum(h.closed, 0))}
                {row("Net", fmtMoney(a.net, currency, { sign: true }), fmtMoney(h.net, currency, { sign: true }))}
                {row("Win rate", fmtPct(a.winRate), fmtPct(h.winRate))}
                {row("Profit factor", fmtNum(a.profitFactor), fmtNum(h.profitFactor))}
                {row("Average R", fmtR(a.avgR), fmtR(h.avgR))}
                {row("Maximum drawdown", fmtMoney(a.maxDD.amount, currency), fmtMoney(h.maxDD.amount, currency))}
              </tbody>
            </table>
            <p className={cx("mt-3 text-xs text-muted")}>{h.closed < 10 && active ? "Very few trades remain under these assumptions — the comparison is not meaningful." : "Use this to ask better questions in your next review."}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
