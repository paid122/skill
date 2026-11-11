"use client";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageIntro, ScopeControls, Stat } from "@/components/blocks";
import { CountBars, TrendLine } from "@/components/charts";
import { Button, Card, Input, NotEnoughData, Progress, SectionTitle, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { updateSettings } from "@/lib/actions";
import { chronological, disciplineScore, emotionalBalance, frequency } from "@/lib/calc";
import { useScoped } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { EMOTIONS, POSITIVE_EMOTIONS, STRAINED_EMOTIONS } from "@/lib/types";
import { fmtDate, fmtNum, fmtPct, today, weekStart } from "@/lib/util";

export default function PsychologyPage() {
  const { current } = useScoped();
  const journals = useLedgr((s) => s.dailyJournals);
  const mistakeCats = useLedgr((s) => s.settings.mistakeCategories);
  const trades = useMemo(() => current.map((x) => x.trade), [current]);
  const disc = useMemo(() => disciplineScore(trades, journals), [trades, journals]);
  const emotions = useMemo(() => frequency(trades.flatMap((t) => t.emotions)), [trades]);
  const mistakes = useMemo(() => frequency(trades.flatMap((t) => t.mistakes)), [trades]);
  const balance = emotionalBalance(trades);
  const reflectionRate = trades.length ? trades.filter((t) => t.reflection.learned.trim() && t.reflection.wentWell.trim() && t.reflection.improve.trim() && t.reflection.followedPlan).length / trades.length : null;
  const todayEmotions = useLedgr((s) => [...s.trades.filter((t) => t.date === today()).flatMap((t) => t.emotions), ...(s.dailyJournals.find((j) => j.date === today())?.mood ? [s.dailyJournals.find((j) => j.date === today())!.mood!] : [])]);

  const weekly = useMemo(() => {
    const m = new Map<string, typeof trades>();
    chronological(current).forEach((x) => { const k = weekStart(x.trade.date); m.set(k, [...(m.get(k) ?? []), x.trade]); });
    return [...m.entries()].map(([k, ts]) => ({ label: fmtDate(k, "day"), score: disciplineScore(ts, journals).score, strained: ts.flatMap((t) => t.emotions).length ? ts.flatMap((t) => t.emotions).filter((e) => STRAINED_EMOTIONS.includes(e)).length / ts.flatMap((t) => t.emotions).length : null, n: ts.length }));
  }, [current, journals]);

  const halves = useMemo(() => {
    const seq = chronological(current).map((x) => x.trade);
    if (seq.length < 10) return null;
    const mid = Math.floor(seq.length / 2);
    return { a: disciplineScore(seq.slice(0, mid), journals), b: disciplineScore(seq.slice(mid), journals) };
  }, [current, journals]);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Psychology & discipline" sub="Notice patterns in how you feel and decide. This is a private space for honest observation — not for judgement." actions={<ScopeControls />} />
      <PageVerse page="psychology" context={{ emotionsToday: todayEmotions }} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <SectionTitle title="Discipline score" sub="A process measure. Profit and loss are never used." />
          {disc.score === null ? <NotEnoughData note="Log trades to begin measuring your process." /> : (
            <>
              <div className="flex items-end gap-3">
                <span className="num text-[52px] font-medium leading-none">{fmtNum(disc.score, 0)}</span>
                <span className="mb-1.5 text-sm text-muted">/ 100 · {disc.sample} trades</span>
              </div>
              <ul className="mt-6 flex flex-col gap-4">
                {disc.components.map((c) => (
                  <li key={c.key}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                      <span className="text-text">{c.label} <span className="text-muted">· {Math.round(c.weight * 100)}%</span></span>
                      <span className="num text-text-2">{c.value === null ? "No data" : fmtNum(c.value, 0)}</span>
                    </div>
                    <Progress value={c.value ?? 0} />
                    <p className="mt-1 text-xs text-muted">{c.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-muted">Score = weighted average of available components. Components without data are left out and weights re-balanced. <Link href="/performance-score" className="text-accent hover:underline">See the performance score</Link></p>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Most reported emotion" value={emotions[0]?.key ?? "—"} hint={emotions[0] ? `${emotions[0].count} times` : undefined} />
            <Stat label="Most documented mistake" value={mistakes[0]?.key ?? "None"} hint={mistakes[0] ? `${mistakes[0].count} times` : undefined} />
            <Stat label="Calm, patient or confident" value={fmtPct(balance, 0)} hint="Share of recorded emotions" />
            <Stat label="Reflection completion" value={fmtPct(reflectionRate, 0)} hint="All four prompts answered" />
          </Card>
          <Card>
            <SectionTitle title="Emotion tracker" sub="How often each state was recorded on trades in range" />
            {emotions.length ? <CountBars data={EMOTIONS.map((e) => ({ label: e, value: emotions.find((x) => x.key === e)?.count ?? 0, tone: POSITIVE_EMOTIONS.includes(e) ? "pos" : STRAINED_EMOTIONS.includes(e) ? "neg" : undefined }))} xLabel="Emotion" /> : <NotEnoughData note="Record emotions on the Psychology tab of each trade." />}
          </Card>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Historical consistency" sub="Weekly discipline score" />
          {weekly.filter((w) => w.score !== null).length >= 2 ? <TrendLine data={weekly.map((w) => ({ label: w.label, value: w.score, n: w.n }))} name="Discipline" format={(v) => fmtNum(v, 0)} /> : <NotEnoughData note="Needs at least two weeks of trades." />}
        </Card>
        <Card>
          <SectionTitle title="Strained emotions over time" sub="Weekly share of frustrated, impatient or distracted entries" />
          {weekly.filter((w) => w.strained !== null).length >= 2 ? <TrendLine data={weekly.map((w) => ({ label: w.label, value: w.strained === null ? null : w.strained * 100, n: w.n }))} name="Strained share" format={(v) => `${fmtNum(v, 0)}%`} /> : <NotEnoughData note="Needs at least two weeks of recorded emotions." />}
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <MistakeTracker categories={mistakeCats} counts={mistakes} />
        <Card>
          <SectionTitle title="Changes over time" sub="Earlier half of your trades in range compared with the later half" />
          {halves ? (
            <table className="w-full text-[13px]">
              <thead className="text-left text-xs text-muted"><tr><th className="py-1 font-medium">Component</th><th className="py-1 text-right font-medium">Earlier</th><th className="py-1 text-right font-medium">Later</th></tr></thead>
              <tbody>
                {halves.a.components.map((c, i) => {
                  const b = halves.b.components[i];
                  const d = c.value !== null && b.value !== null ? b.value - c.value : null;
                  return <tr key={c.key} className="border-t border-line-soft"><td className="py-2 text-text-2">{c.label}</td><td className="num py-2 text-right">{fmtNum(c.value, 0)}</td><td className="num py-2 text-right">{fmtNum(b.value, 0)}{d !== null && Math.abs(d) >= 1 && <span className={`ml-2 text-xs ${d > 0 ? "pos" : "text-muted"}`}>{d > 0 ? "+" : "−"}{fmtNum(Math.abs(d), 0)}</span>}</td></tr>;
                })}
                <tr className="border-t border-line"><td className="py-2 font-medium">Overall</td><td className="num py-2 text-right">{fmtNum(halves.a.score, 0)}</td><td className="num py-2 text-right">{fmtNum(halves.b.score, 0)}</td></tr>
              </tbody>
            </table>
          ) : <NotEnoughData note="Needs at least ten trades in range." />}
          <p className="mt-4 text-xs leading-relaxed text-muted">Progress is rarely a straight line. A lower number is information to work with, not a verdict on you.</p>
        </Card>
      </div>
    </div>
  );
}

function MistakeTracker({ categories, counts }: { categories: string[]; counts: { key: string; count: number }[] }) {
  const [name, setName] = useState("");
  const { confirm } = useFeedback();
  const add = () => {
    const n = name.trim();
    if (!n || categories.includes(n)) return;
    updateSettings({ mistakeCategories: [...categories.filter((c) => c !== "Other"), n.slice(0, 40), ...(categories.includes("Other") ? ["Other"] : [])] });
    setName("");
  };
  return (
    <Card>
      <SectionTitle title="Mistake tracker" sub="Your categories. Used in the trade editor's Psychology tab." />
      <ul className="flex flex-col">
        {categories.map((c) => {
          const n = counts.find((x) => x.key === c)?.count ?? 0;
          const max = Math.max(1, ...counts.map((x) => x.count));
          return (
            <li key={c} className="group flex items-center gap-3 border-b border-line-soft py-2 last:border-0">
              <span className="w-44 shrink-0 truncate text-[13px] text-text">{c}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-card-2"><span className="block h-full rounded-full bg-neutral" style={{ width: `${(n / max) * 100}%` }} /></span>
              <span className="num w-8 text-right text-xs text-text-2">{n}</span>
              <button type="button" aria-label={`Remove category ${c}`} className="grid h-7 w-7 place-items-center rounded-md text-muted opacity-60 hover:bg-card-2 hover:text-neg group-hover:opacity-100" onClick={async () => { if (await confirm({ title: `Remove “${c}”?`, body: "Trades already tagged with it keep the label.", confirm: "Remove", danger: true })) updateSettings({ mistakeCategories: categories.filter((x) => x !== c) }); }}><X size={13} /></button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a category" maxLength={40} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button icon={<Plus size={14} />} onClick={add}>Add</Button>
      </div>
    </Card>
  );
}
