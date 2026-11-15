"use client";
import { DoorOpen, FileText, Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLedgr } from "@/lib/store";
import { today } from "@/lib/util";
import { verseOfTheDay } from "@/lib/verses";
import { Button } from "../ui";
import { useFocusTimer, useStudyWeek } from "./FocusTimer";
import { HourglassArt } from "./StudyHome";

/** Full-screen focus mode: the timer, today's verse and your notes, nothing else. Starts timing on entry; Esc leaves. */
export function FocusRoom({ onClose, onOpenNote }: { onClose: () => void; onOpenNote: (id: string) => void }) {
  const { running, elapsed, start, pause, finish, clock } = useFocusTimer();
  const { today: todayMin } = useStudyWeek();
  const notes = useLedgr((s) => s.studyNotes);
  const verse = useMemo(() => verseOfTheDay(today()), []);
  const recent = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Start timing once, on entry (not on every re-render, so a pause sticks).
  useEffect(() => {
    start();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rendered on <body> so it covers the whole app (top bar and side panel included).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Focus mode" className="animate-fade fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-bg">
      <div className="flex items-center justify-between px-6 py-4">
        <p className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-muted">Focus mode · {Math.round(todayMin)} min today</p>
        <Button size="sm" icon={<DoorOpen size={14} />} onClick={onClose}>Leave</Button>
      </div>
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center gap-8 px-6 pb-16 text-center">
        <HourglassArt size={200} />
        <p className="num text-[72px] font-light leading-none tracking-tight text-text sm:text-[96px]" aria-live="off">{clock}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {running ? <Button icon={<Pause size={15} />} onClick={pause}>Pause</Button> : <Button variant="accent" icon={<Play size={15} />} onClick={start}>{elapsed ? "Resume" : "Start"}</Button>}
          {elapsed > 0 && <Button icon={<Square size={14} />} onClick={() => { finish(); onClose(); }}>Finish & log</Button>}
        </div>
        <figure className="max-w-[520px]">
          <blockquote className="text-[18px] leading-relaxed text-text-2">{verse.text}</blockquote>
          <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{verse.reference} · KJV</figcaption>
        </figure>
        {recent.length > 0 && (
          <div className="w-full max-w-[420px] text-left">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Pick up a note</p>
            <ul className="divide-y divide-line-soft rounded-xl border border-line-soft">
              {recent.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => onOpenNote(n.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] text-text transition-colors hover:bg-card-2/60">
                    <FileText size={14} className="shrink-0 text-muted" /><span className="truncate">{n.title || "Untitled"}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-center text-[11.5px] text-muted">The timer keeps running while you write.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
