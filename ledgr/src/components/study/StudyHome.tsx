"use client";
import { ChevronRight, FileText, LineChart, Link2, PlayCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { saveFolder, saveNote } from "@/lib/actions";
import { closedOnly } from "@/lib/calc";
import { useEnriched } from "@/lib/hooks";
import { getState, useLedgr } from "@/lib/store";
import type { NoteBlock } from "@/lib/types";
import { cx, fmtMoney, fmtR, nowISO, parseISODate, today, uid, youtubeId } from "@/lib/util";
import { verseOfTheDay } from "@/lib/verses";
import { FocusTimer, useStudyWeek } from "./FocusTimer";
import { StudyPlan } from "./StudyPlan";

/** Weekly focus goal for the ring, in minutes. */
const WEEK_GOAL = 150;

/** An hourglass drawn from broken horizontal scanlines (patience, time). Deterministic, so it never flickers. */
export function HourglassArt({ size = 230 }: { size?: number }) {
  const W = 220, H = 300, step = 5;
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const rows: { y: number; segs: { x: number; w: number; o: number }[] }[] = [];
  for (let y = 10; y < H - 10; y += step) {
    const t = (y - 10) / (H - 20); // 0 → 1
    const d = Math.abs(t - 0.5) * 2; // 1 at the ends, 0 at the neck
    const frame = t < 0.04 || t > 0.96;
    const half = frame ? W * 0.46 : 10 + Math.pow(d, 0.9) * (W * 0.4);
    // sand: the lower bulb fills from the bottom, the upper one empties toward the neck
    const sand = (t > 0.72 && !frame) || (t > 0.42 && t < 0.5);
    const segs: { x: number; w: number; o: number }[] = [];
    let x = W / 2 - half;
    const end = W / 2 + half;
    while (x < end) {
      const w = Math.min(end - x, 6 + rnd() * 40);
      if (rnd() > 0.12) segs.push({ x, w, o: frame ? 0.9 : sand ? 0.55 + rnd() * 0.35 : 0.18 + rnd() * 0.3 });
      x += w + (rnd() < 0.3 ? 2 + rnd() * 6 : 0);
    }
    rows.push({ y, segs });
  }
  // Grains falling through the neck, and a slow shimmer on some segments (both off for reduced motion).
  const neckY = 10 + (H - 20) * 0.5;
  const grains = Array.from({ length: 7 }, (_, i) => ({ x: W / 2 - 3 + (i % 3) * 2.5, delay: (i * 0.37) % 2.2 }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-auto text-text" style={{ height: size }} aria-hidden>
      <style>{`
        @keyframes hg-fall { 0% { transform: translateY(0); opacity: 0 } 15% { opacity: .9 } 100% { transform: translateY(${(H - 20) * 0.22}px); opacity: 0 } }
        @keyframes hg-shimmer { 0%, 100% { opacity: var(--o) } 50% { opacity: calc(var(--o) * 0.35) } }
        .hg-grain { animation: hg-fall 2.2s linear infinite }
        .hg-shim { animation: hg-shimmer 5s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .hg-grain, .hg-shim { animation: none } .hg-grain { opacity: 0 } }
      `}</style>
      {rows.map((r) => r.segs.map((sg, i) => {
        const shim = (r.y * 7 + i * 13) % 9 === 0;
        return <rect key={`${r.y}-${i}`} x={sg.x} y={r.y} width={sg.w} height={step - 1.5} fill="currentColor" opacity={sg.o}
          className={shim ? "hg-shim" : undefined} style={shim ? ({ "--o": sg.o, animationDelay: `${(r.y % 50) / 10}s` } as React.CSSProperties) : undefined} />;
      }))}
      {grains.map((g, i) => <rect key={i} className="hg-grain" x={g.x} y={neckY} width={2.2} height={3} fill="currentColor" style={{ animationDelay: `${g.delay}s` }} />)}
    </svg>
  );
}

function folderId(name: string) {
  const s = getState();
  const hit = s.studyFolders.find((f) => f.name === name)?.id;
  if (hit) return hit;
  const id = uid("fld");
  saveFolder({ id, name, createdAt: nowISO() });
  return id;
}

function words(blocks: NoteBlock[]) {
  return blocks.reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
}

/** The Study room's front page: a verse, quick ways to start studying, focus time, your plan and recent notes. */
export function StudyHome({ onOpen, onLibrary }: { onOpen: (id: string) => void; onLibrary: () => void }) {
  const notes = useLedgr((s) => s.studyNotes);
  const folders = useLedgr((s) => s.studyFolders);
  const all = useEnriched();
  const [tab, setTab] = useState<"video" | "trade">("video");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const verse = useMemo(() => verseOfTheDay(today()), []);
  const trades = useMemo(() => closedOnly(all).sort((a, b) => b.trade.date.localeCompare(a.trade.date)).slice(0, 30), [all]);
  const currency = useLedgr((s) => s.settings.baseCurrency) || "USD";

  const { days, week, today: todayMin } = useStudyWeek();
  const dayMax = Math.max(30, ...days.map((d) => d.min));
  const pct = Math.min(1, week / WEEK_GOAL);
  const recent = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  const fromVideo = () => {
    if (!youtubeId(url.trim())) { setErr("Paste a YouTube link (youtube.com or youtu.be)."); return; }
    const t = nowISO(), id = uid("note");
    saveNote({ id, folderId: folderId("Video lessons"), title: "Video notes", videoUrl: url.trim(), pinned: false, createdAt: t, updatedAt: t, blocks: [{ id: uid("b"), type: "paragraph", text: "" }] });
    setUrl(""); setErr(null); onOpen(id);
  };
  const fromTrade = (tradeId: string) => {
    const x = trades.find((y) => y.trade.id === tradeId);
    if (!x) return;
    const tr = x.trade, t = nowISO(), id = uid("note");
    const day = parseISODate(tr.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    saveNote({
      id, folderId: folderId("Trade studies"), title: `${tr.symbol} ${day}`, videoUrl: "", pinned: false, createdAt: t, updatedAt: t,
      blocks: [
        { id: uid("b"), type: "quote", text: `${tr.symbol} ${tr.direction ?? ""} · ${tr.setup || "No setup"} · ${fmtMoney(x.m.net, currency, { sign: true })} (${fmtR(x.m.r)})` },
        { id: uid("b"), type: "link", text: "Open the trade in the journal", url: `/journal/${tr.id}` },
        { id: uid("b"), type: "heading", level: 2, text: "What I planned" },
        { id: uid("b"), type: "paragraph", text: tr.entryNotes || "" },
        { id: uid("b"), type: "heading", level: 2, text: "What happened" },
        { id: uid("b"), type: "paragraph", text: tr.exitNotes || "" },
        { id: uid("b"), type: "heading", level: 2, text: "What I'd do differently" },
        { id: uid("b"), type: "check", text: tr.reflection.learned || "", checked: false },
      ],
    });
    onOpen(id);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Verse + art */}
      <section className="mx-auto grid w-full max-w-[860px] items-center gap-8 pt-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-text">{verse.topics[0]}.</p>
          <blockquote className="mt-5 max-w-[520px] text-[28px] font-normal leading-[1.22] tracking-[-0.015em] text-text sm:text-[32px]">{verse.text}</blockquote>
          <p className="mt-10 font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted">{verse.reference} · KJV</p>
        </div>
        <div className="hidden justify-center md:flex"><HourglassArt /></div>
      </section>

      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
        {/* Start studying */}
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([["video", "Video", PlayCircle], ["trade", "My trade", LineChart]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => { setTab(k); setErr(null); }} className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors", tab === k ? "bg-text text-bg" : "text-text-2 hover:text-text")}>
                <Icon size={14} /> {label}
              </button>
            ))}
            <span className="ml-2 text-[12.5px] text-muted">Study from a video, your own trade, or both.</span>
          </div>
          {tab === "video" ? (
            <form onSubmit={(e) => { e.preventDefault(); fromVideo(); }} className="flex items-center gap-2.5 rounded-xl bg-card-2 px-4">
              <Link2 size={15} className="shrink-0 text-muted" />
              <input value={url} onChange={(e) => { setUrl(e.target.value); setErr(null); }} placeholder="What video are these notes from? Paste a YouTube link" aria-label="YouTube link" className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-muted" />
              {url && <button type="submit" className="shrink-0 text-[13px] font-medium text-text">Start notes →</button>}
            </form>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-card-2 px-4">
              <LineChart size={15} className="shrink-0 text-muted" />
              <select defaultValue="" onChange={(e) => e.target.value && fromTrade(e.target.value)} aria-label="Trade to study" className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none">
                <option value="" disabled>{trades.length ? "Which trade do you want to study?" : "No closed trades yet"}</option>
                {trades.map((x) => <option key={x.trade.id} value={x.trade.id}>{x.trade.symbol} · {parseISODate(x.trade.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {fmtMoney(x.m.net, currency, { sign: true })} · {x.trade.setup || "No setup"}</option>)}
              </select>
            </div>
          )}
          {err && <p className="mt-2 text-xs text-neg">{err}</p>}
        </div>

        {/* This week */}
        <Card className="!p-5">
          <div className="flex flex-wrap items-center gap-5">
            <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden className="shrink-0 -rotate-90">
              <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth="5" className="text-text" />
              {pct > 0 && <circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${pct * 138.2} 138.2`} className="text-text" />}
            </svg>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">This week</p>
              <p className="text-[20px] font-semibold leading-tight text-text">{Math.round(week)} min</p>
              <p className="text-[12.5px] text-text-2">Today {Math.round(todayMin)} min · goal {WEEK_GOAL} min</p>
            </div>
            {/* Minutes per day, Monday to Sunday */}
            <div className="flex h-12 items-end gap-1.5" aria-label="Study minutes per day this week">
              {days.map((d) => (
                <div key={d.date} className="flex flex-col items-center gap-1" title={`${Math.round(d.min)} min`}>
                  <span className={cx("w-2.5 rounded-sm", d.date === today() ? "bg-text" : "bg-text/25")} style={{ height: Math.max(3, (d.min / dayMax) * 32) }} />
                  <span className={cx("font-mono text-[9.5px]", d.date === today() ? "text-text" : "text-muted")}>{parseISODate(d.date).toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                </div>
              ))}
            </div>
            <div className="ml-auto"><FocusTimer compact /></div>
          </div>
        </Card>

        <StudyPlan />

        {/* Recent notes */}
        <section>
          <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
            <p className="text-[14px] font-semibold text-text">Recent</p>
            <button type="button" onClick={onLibrary} className="inline-flex items-center gap-1 font-mono text-[12px] text-text-2 hover:text-text">{notes.length} note{notes.length === 1 ? "" : "s"} · All notes <ChevronRight size={13} /></button>
          </div>
          {recent.length === 0 ? <p className="py-6 text-center text-[13px] text-muted">No notes yet. Paste a video or pick a trade above to start.</p> : (
            <ul>
              {recent.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => onOpen(n.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-card-2/60">
                    <span className="grid h-8 w-10 shrink-0 place-items-center rounded-md bg-card-2 text-muted">{youtubeId(n.videoUrl) ? <PlayCircle size={15} /> : <FileText size={15} />}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-text">{n.title || "Untitled"}</span>
                    <span className="hidden w-32 truncate text-[12.5px] text-text-2 sm:block">{folders.find((f) => f.id === n.folderId)?.name ?? "Loose papers"}</span>
                    <span className="w-16 text-right font-mono text-[12px] text-muted">{parseISODate(n.updatedAt.slice(0, 10)).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    <span className="hidden w-20 text-right font-mono text-[12px] text-muted sm:block">{words(n.blocks)} words</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
