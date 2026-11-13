"use client";
import { Check, Minus, Plus, Settings2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EquityChart } from "@/components/charts";
import { KpiCard, PerformanceCalendar, RecentTrades, ScopeControls } from "@/components/blocks";
import { Button, Card, Field, IconButton, Input, Modal, NumberInput, Progress, SectionTitle, Segmented, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { deleteGoal, saveGoal, toggleChecklist, updateSettings, ValidationError } from "@/lib/actions";
import { chronological, closedOnly, computeStats, dailyPnl, disciplineScore, frequency, type EnrichedTrade } from "@/lib/calc";
import { useCurrency, useScoped } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import type { Goal } from "@/lib/types";
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtR, monthKey, nowISO, today, uid, weekStart } from "@/lib/util";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

type Gran = "trade" | "day" | "week" | "month";

export default function ClassicDashboard() {
  const { current, previous } = useScoped();
  const currency = useCurrency();
  const name = useLedgr((s) => s.settings.displayName);
  const journals = useLedgr((s) => s.dailyJournals);
  const trades = useLedgr((s) => s.trades);
  const t = today();
  const todayJ = journals.find((j) => j.date === t);
  const emotionsToday = [...trades.filter((x) => x.date === t).flatMap((x) => x.emotions), ...(todayJ?.mood ? [todayJ.mood] : [])];
  const journalIncomplete = !todayJ || !(todayJ.pre.intentions.trim() && (todayJ.post.happened.trim() || todayJ.post.learned.trim()));

  const stats = useMemo(() => computeStats(current), [current]);
  const prev = useMemo(() => (previous ? computeStats(previous) : null), [previous]);
  const disc = useMemo(() => disciplineScore(current.map((x) => x.trade), journals), [current, journals]);
  const prevDisc = useMemo(() => (previous ? disciplineScore(previous.map((x) => x.trade), journals) : null), [previous, journals]);
  const daily = useMemo(() => dailyPnl(current), [current]);
  const spark = useMemo(() => buildSparks(current), [current]);

  const diff = (a: number | null | undefined, b: number | null | undefined) => (a === null || a === undefined || b === null || b === undefined || !prev ? null : a - b);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[13px] text-muted">{fmtDate(t, "long")}</p>
            <h2 className="mt-1 text-[26px] font-semibold tracking-tight sm:text-[30px]">{greeting()}{name ? `, ${name}` : ""}.</h2>
            <p className="mt-1 text-[15px] text-text-2">Review your process. Learn from your decisions.</p>
          </div>
          <ScopeControls />
        </div>
        <PageVerse page="dashboard" context={{ journalIncomplete, emotionsToday }} />
      </section>

      {(stats.excludedDrafts > 0 || stats.excludedOpen > 0) && (
        <p className="-mt-2 text-xs text-muted">
          Statistics include {stats.closed} closed trade{stats.closed === 1 ? "" : "s"}. {stats.excludedDrafts > 0 && <Link className="text-accent hover:underline" href="/journal?result=draft">{stats.excludedDrafts} draft{stats.excludedDrafts > 1 ? "s" : ""}</Link>}{stats.excludedDrafts > 0 && stats.excludedOpen > 0 && " and "}{stats.excludedOpen > 0 && `${stats.excludedOpen} open position${stats.excludedOpen > 1 ? "s" : ""}`} are excluded until complete.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Key figures">
        <KpiCard label="Simulated P&L" numeric={stats.net} format={(n) => fmtMoney(n, currency, { sign: true })} delta={diff(stats.net, prev?.net)} deltaFormat={(d) => fmtMoney(d, currency, { sign: true, compact: true })} spark={spark.equity} sparkTone={stats.net >= 0 ? "pos" : "neg"} tip="Sum of net results (after fees) for closed trades in range." href="/analytics" />
        <KpiCard label="Win rate" numeric={stats.winRate} format={(n) => fmtPct(n)} delta={diff(stats.winRate, prev?.winRate)} deltaFormat={(d) => `${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d) * 100, 1)} pts`} spark={spark.winRate} tip="Wins ÷ (wins + losses). Break-even trades are excluded." href="/analytics" />
        <KpiCard label="Trades" numeric={stats.closed} format={(n) => fmtNum(n, 0)} delta={diff(stats.closed, prev?.closed)} deltaFormat={(d) => `${d > 0 ? "+" : "−"}${Math.abs(d)}`} betterWhen="higher" spark={spark.count} tip="Closed trades in range. Drafts and open positions are not counted." href="/journal" />
        <KpiCard label="Average R" numeric={stats.avgR} format={(n) => fmtR(n)} delta={diff(stats.avgR, prev?.avgR)} deltaFormat={(d) => fmtR(d)} spark={spark.avgR} tip={`Mean of net ÷ risk across ${stats.rCoverage} trades with a recorded stop or planned risk.`} href="/analytics" />
        <KpiCard label="Profit factor" numeric={stats.profitFactor} format={(n) => (n === null ? (stats.grossProfit > 0 ? "No losses" : "—") : fmtNum(n))} delta={diff(stats.profitFactor, prev?.profitFactor)} deltaFormat={(d) => `${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d))}`} tip="Gross profit of winning trades ÷ gross loss of losing trades." href="/analytics" />
        <KpiCard label="Discipline score" numeric={disc.score} format={(n) => (n === null ? "—" : fmtNum(n, 0))} delta={diff(disc.score, prevDisc?.score)} deltaFormat={(d) => `${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d), 0)}`} tip="Process score from journal completion, plan adherence, reflections, documentation consistency and emotional awareness. Never uses P&L." href="/psychology" />
      </section>

      <MainChart current={current} currency={currency} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
          <Card>
            <SectionTitle title="Performance calendar" sub="Daily net, closed trades. Gold dot: journal entry." />
            <PerformanceCalendar daily={daily} currency={currency} journalDates={new Set(journals.map((j) => j.date))} />
          </Card>
          <Card>
            <SectionTitle title="Recent trades" action={<Link href="/journal" className="text-[13px] text-text-2 hover:text-text">View journal</Link>} />
            <RecentTrades list={current} currency={currency} />
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <WeeklySummary list={current} currency={currency} />
          <Checklist />
          <Goals />
        </div>
      </div>
    </div>
  );
}

function buildSparks(list: EnrichedTrade[]) {
  const seq = chronological(closedOnly(list));
  let eq = 0, w = 0, l = 0, rs = 0, rn = 0;
  const equity: number[] = [], winRate: number[] = [], avgR: number[] = [];
  for (const x of seq) {
    eq += x.m.net as number;
    if (x.m.result === "win") w++;
    if (x.m.result === "loss") l++;
    if (x.m.r !== null) { rs += x.m.r; rn++; }
    equity.push(eq);
    if (w + l) winRate.push(w / (w + l));
    if (rn) avgR.push(rs / rn);
  }
  const byDay = new Map<string, number>();
  seq.forEach((x) => byDay.set(x.trade.date, (byDay.get(x.trade.date) ?? 0) + 1));
  return { equity, winRate, avgR, count: [...byDay.values()] };
}

function MainChart({ current, currency }: { current: EnrichedTrade[]; currency: string }) {
  const [gran, setGran] = useState<Gran>("day");
  const data = useMemo(() => {
    const seq = chronological(closedOnly(current));
    const keyOf = (d: string) => (gran === "day" ? d : gran === "week" ? weekStart(d) : gran === "month" ? monthKey(d) : d);
    if (gran === "trade") {
      let eq = 0;
      return seq.map((x) => ({ label: `#${x.trade.number}`, date: x.trade.date, value: (eq += x.m.net as number), net: x.m.net as number }));
    }
    const buckets = new Map<string, number>();
    seq.forEach((x) => buckets.set(keyOf(x.trade.date), (buckets.get(keyOf(x.trade.date)) ?? 0) + (x.m.net as number)));
    let eq = 0;
    return [...buckets.entries()].map(([k, net]) => ({
      label: gran === "month" ? new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }) : fmtDate(k, "day"),
      date: gran === "month" ? undefined : k,
      value: (eq += net),
      net,
    }));
  }, [current, gran]);
  return (
    <Card>
      <SectionTitle
        title="Cumulative P&L"
        sub="Closed trades in the selected account and range. Drag the handles below the chart to zoom."
        action={<Segmented size="sm" ariaLabel="Granularity" value={gran} onChange={setGran} options={[{ value: "trade", label: "Trade" }, { value: "day", label: "Daily" }, { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]} />}
      />
      {data.length < 2 ? (
        <div className="grid h-[300px] place-items-center text-center">
          <div>
            <p className="text-[13px] text-text-2">Not enough journal data yet.</p>
            <p className="mt-1 text-xs text-muted">Log at least two closed trades to draw the curve.</p>
          </div>
        </div>
      ) : (
        <EquityChart data={data} currency={currency} />
      )}
    </Card>
  );
}

function WeeklySummary({ list, currency }: { list: EnrichedTrade[]; currency: string }) {
  const ws = weekStart(today());
  const week = list.filter((x) => x.trade.date >= ws);
  const s = computeStats(week);
  const setups = frequency(closedOnly(list).map((x) => x.trade.setup).filter(Boolean));
  const mistakes = frequency(list.flatMap((x) => x.trade.mistakes));
  return (
    <Card>
      <SectionTitle title="This week" sub={`Since ${fmtDate(ws, "day")}`} action={<Link href={`/weekly-review?week=${ws}`} className="text-[13px] text-text-2 hover:text-text">Weekly review</Link>} />
      <dl className="grid grid-cols-3 gap-3">
        <div><dt className="text-xs text-muted">Net</dt><dd className={`num mt-1 text-[15px] ${s.net > 0 ? "pos" : s.net < 0 ? "neg" : ""}`}>{fmtMoney(s.net, currency, { sign: true, compact: true })}</dd></div>
        <div><dt className="text-xs text-muted">Trades</dt><dd className="num mt-1 text-[15px]">{s.closed}</dd></div>
        <div><dt className="text-xs text-muted">Win rate</dt><dd className="num mt-1 text-[15px]">{fmtPct(s.winRate, 0)}</dd></div>
      </dl>
      <div className="mt-5 grid gap-3 border-t border-line-soft pt-4 text-[13px]">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted">Most common setup</span>
          <span className="text-right text-text">{setups[0] ? <>{setups[0].key} <span className="text-muted">· {setups[0].count}</span></> : "—"}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted">Most documented mistake</span>
          <span className="text-right text-text">{mistakes[0] ? <>{mistakes[0].key} <span className="text-muted">· {mistakes[0].count}</span></> : "None recorded"}</span>
        </div>
      </div>
    </Card>
  );
}

function Checklist() {
  const items = useLedgr((s) => s.settings.checklist);
  const done = useLedgr((s) => s.checklistLog[today()]) ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(items);
  const completed = items.filter((i) => done.includes(i.id)).length;
  return (
    <Card>
      <SectionTitle title="Daily checklist" sub={`${completed} of ${items.length} complete today`} action={<IconButton label="Customise checklist" onClick={() => { setDraft(items); setEditing(true); }}><Settings2 size={15} /></IconButton>} />
      <Progress value={items.length ? (completed / items.length) * 100 : 0} className="mb-3" />
      <ul className="flex flex-col">
        {items.map((i) => {
          const on = done.includes(i.id);
          return (
            <li key={i.id}>
              <button type="button" role="checkbox" aria-checked={on} onClick={() => toggleChecklist(today(), i.id)} className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left text-[13.5px] transition-colors hover:bg-card-2/50">
                <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                <span className={on ? "text-muted line-through" : "text-text"}>{i.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Modal open={editing} onClose={() => setEditing(false)} title="Customise checklist" size="sm" footer={<><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button variant="accent" onClick={() => { updateSettings({ checklist: draft.filter((d) => d.label.trim()) }); setEditing(false); }}>Save checklist</Button></>}>
        <div className="flex flex-col gap-2">
          {draft.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2">
              <Input value={d.label} maxLength={80} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} aria-label={`Item ${i + 1}`} />
              <IconButton label="Remove item" onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 size={14} /></IconButton>
            </div>
          ))}
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setDraft([...draft, { id: uid("chk"), label: "" }])} className="self-start">Add item</Button>
        </div>
      </Modal>
    </Card>
  );
}

function Goals() {
  const goals = useLedgr((s) => s.goals);
  const [edit, setEdit] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useFeedback();
  const blank = (): Goal => ({ id: uid("goal"), title: "", target: 10, progress: 0, unit: "sessions", due: null, createdAt: nowISO() });
  return (
    <Card>
      <SectionTitle title="Learning goals" action={<IconButton label="Add goal" onClick={() => { setError(null); setEdit(blank()); }}><Plus size={15} /></IconButton>} />
      {goals.length === 0 ? (
        <p className="text-[13px] text-muted">Set a learning goal, such as “Review 20 trades with full reflections”.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((g) => (
            <li key={g.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <button type="button" className="truncate text-left text-[13.5px] text-text hover:text-accent" onClick={() => { setError(null); setEdit(g); }}>{g.title}</button>
                <div className="flex items-center gap-0.5">
                  <IconButton label="Decrease progress" className="h-7 w-7" onClick={() => saveGoal({ ...g, progress: Math.max(0, g.progress - 1) })}><Minus size={13} /></IconButton>
                  <span className="num min-w-[56px] text-center text-xs text-text-2">{g.progress}/{g.target}</span>
                  <IconButton label="Increase progress" className="h-7 w-7" onClick={() => saveGoal({ ...g, progress: Math.min(g.target, g.progress + 1) })}><Plus size={13} /></IconButton>
                </div>
              </div>
              <Progress value={(g.progress / g.target) * 100} tone={g.progress >= g.target ? "pos" : "accent"} />
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={goals.some((g) => g.id === edit?.id) ? "Edit goal" : "New learning goal"} size="sm"
        footer={<>
          {edit && goals.some((g) => g.id === edit.id) && <Button variant="danger" className="mr-auto" onClick={async () => { if (await confirm({ title: "Delete goal?", confirm: "Delete", danger: true })) { deleteGoal(edit.id); setEdit(null); } }}>Delete</Button>}
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
          <Button variant="accent" onClick={() => { try { if (edit) saveGoal(edit); setEdit(null); } catch (e) { setError(e instanceof ValidationError ? e.message : "Could not save."); } }}>Save goal</Button>
        </>}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Goal"><Input value={edit.title} maxLength={100} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Complete reflections for 20 trades" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Progress"><NumberInput value={edit.progress} allowEmpty={false} onChange={(n) => setEdit({ ...edit, progress: Math.max(0, n ?? 0) })} /></Field>
              <Field label="Target"><NumberInput value={edit.target} allowEmpty={false} onChange={(n) => setEdit({ ...edit, target: n ?? 0 })} /></Field>
              <Field label="Unit"><Input value={edit.unit} maxLength={20} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></Field>
            </div>
            {error && <p className="text-[13px] text-neg">{error}</p>}
          </div>
        )}
      </Modal>
    </Card>
  );
}
