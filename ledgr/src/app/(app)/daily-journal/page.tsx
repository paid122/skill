"use client";
import { Check, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PageIntro, RecentTrades } from "@/components/blocks";
import { MonthPicker } from "@/components/MonthPicker";
import { Button, Card, Chips, Field, SectionTitle, Segmented, Textarea, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { blankDaily, deleteDaily, saveDaily } from "@/lib/actions";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { EMOTIONS, type DailyJournal, type Emotion } from "@/lib/types";
import { addDays, fmtDate, today } from "@/lib/util";

export default function DailyJournalPage() {
  return <Suspense><Daily /></Suspense>;
}

const isFilled = (j: DailyJournal | undefined) => !!j && Object.values(j.pre).some((v) => String(v ?? "").trim()) || !!j && Object.values(j.post).some((v) => String(v ?? "").trim());
const isComplete = (j: DailyJournal | undefined) => !!j && !!j.pre.intentions.trim() && !!(j.post.happened.trim() || j.post.learned.trim());

function Daily() {
  const params = useSearchParams();
  const router = useRouter();
  const date = params.get("date") ?? today();
  const journals = useLedgr((s) => s.dailyJournals);
  const existing = journals.find((j) => j.date === date);
  const all = useEnriched();
  const dayTrades = useMemo(() => all.filter((x) => x.trade.date === date), [all, date]);
  const accountsCurrency = useLedgr((s) => s.settings.baseCurrency);
  const { confirm, toast } = useFeedback();

  const [j, setJ] = useState<DailyJournal>(() => existing ?? blankDaily(date));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    setJ(existing ?? blankDaily(date));
    dirty.current = false;
    setStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Autosave 600ms after the last change.
  useEffect(() => {
    if (!dirty.current) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveDaily(j); setStatus("saved"); }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [j]);

  const update = (fn: (x: DailyJournal) => DailyJournal) => { dirty.current = true; setJ((x) => fn(x)); };
  const setPre = (p: Partial<DailyJournal["pre"]>) => update((x) => ({ ...x, pre: { ...x.pre, ...p } }));
  const setPost = (p: Partial<DailyJournal["post"]>) => update((x) => ({ ...x, post: { ...x.post, ...p } }));
  const go = (d: string) => router.replace(`/daily-journal?date=${d}`);

  const emotionsToday = [...dayTrades.flatMap((x) => x.trade.emotions), ...(j.mood ? [j.mood] : [])];
  const marked = new Set(journals.filter(isFilled).map((x) => x.date));
  const partial = new Set(journals.filter((x) => isFilled(x) && !isComplete(x)).map((x) => x.date));

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title={date === today() ? "Today's journal" : fmtDate(date, "long")}
        sub="Set intentions before the session. Reflect honestly after it."
        actions={<>
          <Button size="sm" variant="ghost" onClick={() => go(addDays(date, -1))}>Previous day</Button>
          {date !== today() && <Button size="sm" onClick={() => go(today())}>Today</Button>}
          <Button size="sm" variant="ghost" onClick={() => go(addDays(date, 1))}>Next day</Button>
        </>}
      />
      <PageVerse page="daily" context={{ journalIncomplete: !isComplete(j), emotionsToday }} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Pre-session" sub="Before you begin" action={<SaveState status={status} />} />
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
              <Field label="What are my intentions?" className="md:col-span-2"><Textarea value={j.pre.intentions} onChange={(e) => setPre({ intentions: e.target.value })} placeholder="e.g. Trade only my written setups. Log every trade straight after." /></Field>
              <Field label="What am I learning today?"><Textarea value={j.pre.learning} onChange={(e) => setPre({ learning: e.target.value })} /></Field>
              <Field label="What habits do I want to practise?"><Textarea value={j.pre.habits} onChange={(e) => setPre({ habits: e.target.value })} /></Field>
              <Field label="What should I avoid?"><Textarea value={j.pre.avoid} onChange={(e) => setPre({ avoid: e.target.value })} /></Field>
              <Field label="What is my plan for reflection?"><Textarea value={j.pre.reflectionPlan} onChange={(e) => setPre({ reflectionPlan: e.target.value })} /></Field>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Post-session" sub="After the session" action={<SaveState status={status} />} />
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
              <Field label="What happened?" className="md:col-span-2"><Textarea rows={4} value={j.post.happened} onChange={(e) => setPost({ happened: e.target.value })} /></Field>
              <Field label="What did I learn?"><Textarea value={j.post.learned} onChange={(e) => setPost({ learned: e.target.value })} /></Field>
              <Field label="What was difficult?"><Textarea value={j.post.difficult} onChange={(e) => setPost({ difficult: e.target.value })} /></Field>
              <Field label="What could I improve?"><Textarea value={j.post.improve} onChange={(e) => setPost({ improve: e.target.value })} /></Field>
              <Field label="Did I follow my written process?">
                <Segmented value={j.post.followedProcess ?? ("" as never)} onChange={(v) => setPost({ followedProcess: v })} options={[{ value: "yes", label: "Yes" }, { value: "partial", label: "Partly" }, { value: "no", label: "No" }]} ariaLabel="Followed process" />
              </Field>
              <Field label="Overall mood" className="md:col-span-2" hint="Context-aware verses use this, never your P&L.">
                <Chips options={EMOTIONS} value={j.mood ? [j.mood] : []} onChange={(v) => update((x) => ({ ...x, mood: (v.filter((e) => e !== x.mood)[0] ?? null) as Emotion | null }))} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Entries" sub="Gold: complete · amber: in progress" />
            <MonthPicker value={date} onChange={go} marked={marked} partial={partial} />
          </Card>
          <Card>
            <SectionTitle title={`Trades on ${fmtDate(date, "day")}`} />
            <RecentTrades list={dayTrades} currency={accountsCurrency} limit={20} />
          </Card>
          {existing && (
            <Button variant="danger" icon={<Trash2 size={14} />} onClick={async () => { if (await confirm({ title: `Delete the entry for ${fmtDate(date)}?`, confirm: "Delete entry", danger: true })) { if (timer.current) clearTimeout(timer.current); dirty.current = false; deleteDaily(date); setJ(blankDaily(date)); toast("Entry deleted"); } }}>Delete this entry</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveState({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return <span className="text-xs text-muted">Saves automatically</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted" aria-live="polite">{status === "saving" ? "Saving…" : <><Check size={12} className="text-pos" /> Saved</>}</span>;
}
