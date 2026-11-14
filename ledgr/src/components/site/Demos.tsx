"use client";
import { useState } from "react";
import { combineDiscipline, DISCIPLINE_LABELS, DISCIPLINE_WEIGHTS } from "@/lib/calc";
import { selectVerse, verseSource } from "@/lib/verses";
import { cx } from "@/lib/util";

/** Interactive discipline score — uses the app's own weights and combining function. */
export function DisciplineDemo() {
  const keys = Object.keys(DISCIPLINE_WEIGHTS) as (keyof typeof DISCIPLINE_WEIGHTS)[];
  const [v, setV] = useState<Record<string, number>>({ completion: 90, adherence: 70, reflection: 60, consistency: 50, awareness: 80 });
  const score = combineDiscipline(v) ?? 0;
  return (
    <div className="site-shadow grid gap-8 rounded-[26px] border border-ink/10 bg-paper p-7 sm:p-9 md:grid-cols-[minmax(0,1fr)_200px] md:items-center">
      <div className="flex flex-col gap-5">
        {keys.map((k) => (
          <label key={k} className="block">
            <span className="flex justify-between text-[13px]"><span className="text-ink/75">{DISCIPLINE_LABELS[k]} <span className="text-ink/40">· {Math.round(DISCIPLINE_WEIGHTS[k] * 100)}%</span></span><span className="font-mono text-ink">{v[k]}</span></span>
            <input type="range" min={0} max={100} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} className="mt-2 w-full accent-[var(--ink)]" aria-label={DISCIPLINE_LABELS[k]} />
          </label>
        ))}
      </div>
      <div className="flex flex-col items-center text-center">
        <p className="font-mono text-[72px] font-medium leading-none tracking-tight">{Math.round(score)}</p>
        <p className="mt-2 text-[13px] text-ink/50">Discipline score</p>
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink/45">Drag the sliders. Notice there's no slider for profit — it's never part of the score.</p>
      </div>
    </div>
  );
}

/** Context-aware verse demo — calls the same selection function the app uses. */
export function VerseDemo() {
  const [frustrated, setFrustrated] = useState(false);
  const [incomplete, setIncomplete] = useState(true);
  const choice = selectVerse("daily", { journalIncomplete: incomplete, emotionsToday: frustrated ? ["Frustrated"] : ["Calm"] });
  const Toggle = ({ on, set, label }: { on: boolean; set: (b: boolean) => void; label: string }) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={cx("flex h-11 items-center gap-3 rounded-full border px-4 text-[14px] transition-colors", on ? "border-ink bg-ink text-paper" : "border-ink/15 text-ink/70 hover:border-ink/40")}>
      <span className={cx("h-2.5 w-2.5 rounded-full", on ? "bg-paper" : "bg-ink/25")} />{label}
    </button>
  );
  return (
    <div className="site-shadow rounded-[26px] border border-ink/10 bg-paper p-7 sm:p-9">
      <p className="text-[13px] text-ink/50">Today in your daily journal…</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Toggle on={incomplete} set={setIncomplete} label="Journal not finished yet" />
        <Toggle on={frustrated} set={setFrustrated} label="I recorded frustration" />
      </div>
      <figure key={choice.verse.id} className="animate-fade mt-8 border-l-2 border-ink pl-5">
        <blockquote className="verse-text text-[24px] leading-snug text-ink sm:text-[28px]">{choice.verse.text}</blockquote>
        <figcaption className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink/55">{choice.verse.reference} · {verseSource(choice.verse) === "WEB" ? "WEB" : "Septuagint"}</figcaption>
        <p className="mt-2 text-[13px] text-ink/50">{choice.reason}</p>
      </figure>
      <p className="mt-6 text-[12.5px] leading-relaxed text-ink/45">Verses respond to how you're working — finished entries, recorded emotions — and never to profit or loss.</p>
    </div>
  );
}
