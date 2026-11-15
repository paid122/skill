"use client";
import { Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { addStudyMinutes } from "@/lib/actions";
import { useLedgr } from "@/lib/store";
import { addDays, cx, fmtNum, today, weekStart } from "@/lib/util";
import { Button } from "../ui";

const KEY = "ledgr.focus"; // { startedAt: number | null, carried: number (ms) }
const EVENT = "ledgr-focus";
type Saved = { startedAt: number | null; carried: number };
const read = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) ?? "") as Saved; } catch { return { startedAt: null, carried: 0 }; } };
const write = (s: Saved) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT)); // keep every timer on the page in step
};

/** Shared focus timer. Time survives reloads; finishing adds the minutes to today's study log. */
export function useFocusTimer() {
  const [state, setState] = useState<Saved>({ startedAt: null, carried: 0 });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const sync = () => { setState(read()); setNow(Date.now()); };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  useEffect(() => {
    if (!state.startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.startedAt]);
  const elapsed = state.carried + (state.startedAt ? now - state.startedAt : 0);
  const running = !!state.startedAt;
  const start = useCallback(() => { const s = read(); if (!s.startedAt) write({ startedAt: Date.now(), carried: s.carried }); }, []);
  const pause = useCallback(() => { const s = read(); if (s.startedAt) write({ startedAt: null, carried: s.carried + Date.now() - s.startedAt }); }, []);
  const finish = useCallback(() => {
    const s = read();
    const ms = s.carried + (s.startedAt ? Date.now() - s.startedAt : 0);
    addStudyMinutes(today(), ms / 60000);
    write({ startedAt: null, carried: 0 });
  }, []);
  const mm = Math.floor(elapsed / 60000), ss = Math.floor((elapsed % 60000) / 1000);
  return { elapsed, running, start, pause, finish, clock: `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` };
}

/** Study minutes logged for each day of this week (Mon → Sun), plus today's and the total. */
export function useStudyWeek() {
  const log = useLedgr((s) => s.studyLog) ?? {};
  const ws = weekStart(today());
  const days = Array.from({ length: 7 }, (_, i) => ({ date: addDays(ws, i), min: log[addDays(ws, i)] ?? 0 }));
  return { days, week: days.reduce((a, d) => a + d.min, 0), today: log[today()] ?? 0 };
}

export function FocusTimer({ compact = false }: { compact?: boolean } = {}) {
  const { elapsed, running, start, pause, finish, clock } = useFocusTimer();
  const { week, today: todayMin } = useStudyWeek();

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {(running || elapsed > 0) && <span className="num text-[18px] leading-none" aria-live="off">{clock}</span>}
        {running ? <Button size="sm" icon={<Pause size={14} />} onClick={pause}>Pause</Button> : <Button size="sm" variant="accent" icon={<Play size={14} />} onClick={start}>{elapsed ? "Resume" : "Start focus"}</Button>}
        {elapsed > 0 && <Button size="sm" icon={<Square size={13} />} onClick={finish}>Finish & log</Button>}
      </div>
    );
  }
  return (
    <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className={cx("h-2.5 w-2.5 rounded-full", running ? "animate-pulse bg-pos" : "bg-line")} aria-hidden />
        <span className="num text-[26px] leading-none" aria-live="off">{clock}</span>
        <span className="text-[12px] text-muted">{running ? "Focusing" : elapsed ? "Paused" : "Focus timer"}</span>
      </div>
      <div className="flex gap-2">
        {running ? <Button size="sm" icon={<Pause size={14} />} onClick={pause}>Pause</Button> : <Button size="sm" variant="accent" icon={<Play size={14} />} onClick={start}>{elapsed ? "Resume" : "Start focus"}</Button>}
        {elapsed > 0 && <Button size="sm" icon={<Square size={13} />} onClick={finish}>Finish & log</Button>}
      </div>
      <div className="ml-auto flex gap-6 text-[12px] text-muted">
        <span>Today <b className="num font-medium text-text">{fmtNum(todayMin, 0)} min</b></span>
        <span>This week <b className="num font-medium text-text">{fmtNum(week, 0)} min</b></span>
      </div>
    </div>
  );
}
