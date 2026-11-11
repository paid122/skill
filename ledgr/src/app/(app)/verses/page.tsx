"use client";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { Card, Chips, EmptyState, Input, SectionTitle, Tabs, Textarea } from "@/components/ui";
import { VerseCard } from "@/components/VerseCard";
import { setVerseReflection } from "@/lib/actions";
import { useLedgr } from "@/lib/store";
import { fmtDate, fmtTime, today } from "@/lib/util";
import { PAGE_VERSES, TOPICS, TRANSLATIONS, VERSE_BY_ID, VERSES, verseOfTheDay, type VerseTopic } from "@/lib/verses";

export default function VersesPage() {
  return <Suspense><Library /></Suspense>;
}

function Library() {
  const params = useSearchParams();
  const focus = params.get("verse");
  const [tab, setTab] = useState<"browse" | "favourites" | "history">("browse");
  const [q, setQ] = useState("");
  const [topics, setTopics] = useState<VerseTopic[]>([]);
  const favourites = useLedgr((s) => s.favouriteVerses);
  const history = useLedgr((s) => s.verseHistory);
  const daily = verseOfTheDay(today());

  useEffect(() => {
    if (focus) setTimeout(() => document.getElementById(`v-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
  }, [focus]);

  const list = useMemo(() => VERSES.filter((v) => (!topics.length || topics.some((t) => v.topics.includes(t))) && (!q || `${v.reference} ${v.text} ${v.topics.join(" ")}`.toLowerCase().includes(q.toLowerCase()))), [q, topics]);
  const pageOf = (id: string) => Object.entries(PAGE_VERSES).filter(([, p]) => p.verseId === id).map(([k]) => k);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Verse library" sub="Scripture chosen for the work of reflection, discipline and learning. Text is the King James Version (public domain)." />
      <section>
        <p className="mb-2 text-xs text-muted">Verse of the day</p>
        <VerseCard verse={daily} page="verses" />
      </section>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: "browse", label: "Browse" }, { value: "favourites", label: `Favourites (${favourites.length})` }, { value: "history", label: "Previously shown" }]} />

      {tab === "browse" && (
        <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="flex flex-col gap-5 xl:sticky xl:top-24">
            <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text or reference" className="pl-9" aria-label="Search verses" /></div>
            <div><p className="mb-2 text-xs text-muted">Topics</p><Chips options={TOPICS} value={topics} onChange={setTopics} /></div>
            <div className="border-t border-line-soft pt-4">
              <p className="mb-2 text-xs text-muted">Translation</p>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {TRANSLATIONS.map((t) => <li key={t.code} className="flex justify-between gap-2"><span className={t.available ? "text-text" : "text-muted"}>{t.code}</span><span className="text-right text-xs text-muted">{t.available ? t.note : "Not licensed"}</span></li>)}
              </ul>
            </div>
          </Card>
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">{list.length} verse{list.length === 1 ? "" : "s"}</p>
            {list.map((v) => (
              <div key={v.id} id={`v-${v.id}`} className={focus === v.id ? "rounded-[16px] ring-2 ring-accent/50" : ""}>
                <VerseCard verse={v} compact reason={[...v.topics, ...pageOf(v.id).map((p) => `${p} page`)].join(" · ")} />
              </div>
            ))}
            {list.length === 0 && <p className="py-8 text-center text-[13px] text-muted">No verses match.</p>}
          </div>
        </div>
      )}

      {tab === "favourites" && (
        favourites.length === 0 ? <EmptyState title="No favourites yet" body="Select the heart on any verse to keep it here and write your own reflection." /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {[...favourites].reverse().map((f) => {
              const v = VERSE_BY_ID.get(f.verseId);
              if (!v) return null;
              return (
                <Card key={f.verseId} className="flex flex-col gap-3">
                  <VerseCard verse={v} compact className="border-0 bg-transparent px-0 py-0" />
                  <label className="label" htmlFor={`r-${v.id}`}>My reflection</label>
                  <Textarea id={`r-${v.id}`} defaultValue={f.reflection} onBlur={(e) => e.target.value !== f.reflection && setVerseReflection(v.id, e.target.value.slice(0, 2000))} placeholder="What does this mean for how you work?" />
                  <p className="text-xs text-muted">Saved {fmtDate(f.savedAt)}</p>
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === "history" && (
        <Card>
          <SectionTitle title="Previously shown" sub="Verses displayed across Ledgr, newest first" />
          {history.length === 0 ? <p className="text-[13px] text-muted">Nothing yet.</p> : (
            <ul className="divide-y divide-line-soft">
              {[...history].reverse().slice(0, 100).map((h, i) => {
                const v = VERSE_BY_ID.get(h.verseId);
                if (!v) return null;
                return (
                  <li key={i} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="w-40 shrink-0 text-xs text-muted">{fmtDate(h.at)} {fmtTime(h.at)} · {h.page}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{v.reference}</span>
                    <span className="verse-text truncate text-[14px] text-text-2">{v.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
