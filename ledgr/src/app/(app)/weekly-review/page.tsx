"use client";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PageIntro, Stat } from "@/components/blocks";
import { PnlBars } from "@/components/charts";
import { MatrixxReview } from "@/components/matrixx";
import { Button, Card, Field, IconButton, Input, SectionTitle, Textarea } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { blankWeekly, saveWeekly } from "@/lib/actions";
import { WEEK_REVIEW_PROMPT, buildContext } from "@/lib/ai";
import { computeStats, dailyPnl, disciplineScore, frequency } from "@/lib/calc";
import { useEnriched } from "@/lib/hooks";
import { getState, useLedgr } from "@/lib/store";
import type { WeeklyJournal } from "@/lib/types";
import { addDays, dayOfWeek, fmtDate, fmtMoney, fmtNum, fmtPct, fmtR, today, weekStart } from "@/lib/util";

export default function WeeklyReviewPage() {
  return <Suspense><Weekly /></Suspense>;
}

function Weekly() {
  const params = useSearchParams();
  const router = useRouter();
  const ws = weekStart(params.get("week") ?? today());
  const we = addDays(ws, 6);
  const all = useEnriched();
  const daily = useLedgr((s) => s.dailyJournals);
  const weeklies = useLedgr((s) => s.weeklyJournals);
  const currency = useLedgr((s) => s.settings.baseCurrency);
  const existing = weeklies.find((w) => w.weekStart === ws);
  const week = useMemo(() => all.filter((x) => x.trade.date >= ws && x.trade.date <= we), [all, ws, we]);
  const stats = useMemo(() => computeStats(week), [week]);
  const disc = useMemo(() => disciplineScore(week.map((x) => x.trade), daily), [week, daily]);
  const prevWeek = useMemo(() => computeStats(all.filter((x) => x.trade.date >= addDays(ws, -7) && x.trade.date < ws)), [all, ws]);
  const mistakes = frequency(week.flatMap((x) => x.trade.mistakes));
  const lessons = week.filter((x) => x.trade.reflection.learned.trim()).map((x) => ({ id: x.trade.id, n: x.trade.number, text: x.trade.reflection.learned }));
  const journalDays = daily.filter((d) => d.date >= ws && d.date <= we && (d.post.happened || d.post.learned)).length;
  const dpnl = dailyPnl(week);
  const bars = Array.from({ length: 7 }, (_, i) => { const d = addDays(ws, i); return { label: dayOfWeek(d).slice(0, 3), value: dpnl.get(d)?.net ?? 0, count: dpnl.get(d)?.count ?? 0 }; });

  const [w, setW] = useState<WeeklyJournal>(() => existing ?? blankWeekly(ws));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = useRef(false);
  const [obj, setObj] = useState("");
  useEffect(() => { setW(existing ?? blankWeekly(ws)); dirty.current = false; setSaved("idle"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ws]);
  useEffect(() => {
    if (!dirty.current) return;
    setSaved("saving");
    const t = setTimeout(() => { saveWeekly(w); setSaved("saved"); }, 600);
    return () => clearTimeout(t);
  }, [w]);
  const upd = (p: Partial<WeeklyJournal>) => { dirty.current = true; setW((x) => ({ ...x, ...p })); };
  const go = (d: string) => router.replace(`/weekly-review?week=${d}`);
  const byNumber = useMemo(() => new Map(all.map((y) => [y.trade.number, y.trade.id])), [all]);
  // MatrixX sees only this week: its trades and its daily journal entries
  const weekContext = () => {
    const st = getState();
    return buildContext({ ...st, dailyJournals: st.dailyJournals.filter((d) => d.date >= ws && d.date <= we) }, week).text;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Weekly review"
        sub={`${fmtDate(ws)} – ${fmtDate(we)}`}
        actions={<>
          <IconButton label="Previous week" onClick={() => go(addDays(ws, -7))}><ChevronLeft size={16} /></IconButton>
          {ws !== weekStart(today()) && <Button size="sm" onClick={() => go(weekStart(today()))}>This week</Button>}
          <IconButton label="Next week" onClick={() => go(addDays(ws, 7))}><ChevronRight size={16} /></IconButton>
        </>}
      />
      <PageVerse page="weekly" compact />

      <Card className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Net" value={fmtMoney(stats.net, currency, { sign: true })} tone={stats.net} hint={`Prior week ${fmtMoney(prevWeek.net, currency, { sign: true })}`} />
        <Stat label="Closed trades" value={fmtNum(stats.closed, 0)} hint={stats.excludedDrafts ? `${stats.excludedDrafts} drafts excluded` : undefined} />
        <Stat label="Win rate" value={fmtPct(stats.winRate)} />
        <Stat label="Average R" value={fmtR(stats.avgR)} />
        <Stat label="Discipline" value={disc.score === null ? "—" : fmtNum(disc.score, 0)} />
        <Stat label="Journal days" value={`${journalDays} / ${new Set(week.map((x) => x.trade.date)).size || 0}`} hint="Post-session entries / trading days" />
      </Card>

      <MatrixxReview
        title="MatrixX weekly review"
        sub="What worked, what kept going wrong, and your focus for next week"
        prompt={WEEK_REVIEW_PROMPT(fmtDate(ws), fmtDate(we))}
        context={weekContext}
        saved={w.aiReview}
        onSave={(r) => upd({ aiReview: r })}
        byNumber={byNumber}
        disabledReason={week.length ? undefined : "No trades this week yet. Log some, then MatrixX can review the week."}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <SectionTitle title="Your reflection" action={<span className="inline-flex items-center gap-1 text-xs text-muted">{saved === "saving" ? "Saving…" : saved === "saved" ? <><Check size={12} className="text-pos" /> Saved</> : "Saves automatically"}</span>} />
          <div className="grid gap-4">
            <Field label="Weekly reflection"><Textarea rows={4} value={w.reflection} onChange={(e) => upd({ reflection: e.target.value })} placeholder="How did the week go against your intentions?" /></Field>
            <Field label="Personal progress"><Textarea value={w.progress} onChange={(e) => upd({ progress: e.target.value })} /></Field>
            <Field label="Recurring mistakes" hint={mistakes.length ? `Documented this week: ${mistakes.map((m) => `${m.key} (${m.count})`).join(", ")}` : "No mistakes documented on this week's trades."}><Textarea value={w.recurringMistakes} onChange={(e) => upd({ recurringMistakes: e.target.value })} /></Field>
            <Field label="Lessons learned"><Textarea value={w.lessons} onChange={(e) => upd({ lessons: e.target.value })} /></Field>
            <Field label="Next week's learning objectives">
              <ul className="flex flex-col gap-1.5">
                {w.nextObjectives.map((o, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-bg-2/50 px-3 py-1.5 text-[13.5px]">
                    <span className="num text-xs text-muted">{i + 1}</span>
                    <span className="flex-1">{o}</span>
                    <IconButton label="Remove objective" className="h-7 w-7" onClick={() => upd({ nextObjectives: w.nextObjectives.filter((_, j) => j !== i) })}><Trash2 size={13} /></IconButton>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Input value={obj} maxLength={140} onChange={(e) => setObj(e.target.value)} placeholder="Add an objective" onKeyDown={(e) => { if (e.key === "Enter" && obj.trim()) { e.preventDefault(); upd({ nextObjectives: [...w.nextObjectives, obj.trim()] }); setObj(""); } }} />
                <Button icon={<Plus size={14} />} onClick={() => { if (obj.trim()) { upd({ nextObjectives: [...w.nextObjectives, obj.trim()] }); setObj(""); } }}>Add</Button>
              </div>
            </Field>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Daily net" sub="Closed trades, this week" />
            {stats.closed ? <PnlBars data={bars} currency={currency} height={180} /> : <p className="py-8 text-center text-[13px] text-muted">No closed trades this week.</p>}
          </Card>
          <Card>
            <SectionTitle title="Lessons from your trades" sub="From “What did I learn?”" />
            {lessons.length ? (
              <ul className="flex max-h-[320px] flex-col gap-3 overflow-y-auto pr-1 scroll-thin">
                {lessons.map((l) => <li key={l.id} className="text-[13px] text-text-2"><Link href={`/journal/${l.id}`} className="num mr-1.5 text-muted hover:text-accent">#{l.n}</Link>{l.text}</li>)}
              </ul>
            ) : <p className="text-[13px] text-muted">No lessons recorded on this week's trades.</p>}
          </Card>
          <Card>
            <SectionTitle title="Past reviews" />
            {weeklies.length ? (
              <ul className="flex flex-col">
                {[...weeklies].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 8).map((x) => (
                  <li key={x.id}><button type="button" onClick={() => go(x.weekStart)} className={`w-full rounded-lg px-2 py-2 text-left text-[13px] hover:bg-card-2 ${x.weekStart === ws ? "text-accent" : "text-text-2"}`}>Week of {fmtDate(x.weekStart)}</button></li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted">Your saved weekly reviews will appear here.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
