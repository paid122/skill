"use client";
import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { addStudyMinutes } from "@/lib/actions";
import { useLedgr } from "@/lib/store";
import { addDays, cx, fmtNum, today, weekStart } from "@/lib/util";
import { Button } from "../ui";

const KEY = "ledgr.focus"; // { startedAt: number | null, carried: number (ms) }
type Saved = { startedAt: number | null; carried: number };
const read = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) ?? "") as Saved; } catch { return { startedAt: null, carried: 0 }; } };
const write = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

/** A study focus timer. Time survives reloads; finished sessions add minutes to today's study log. */
export function FocusTimer() {
  const log = useLedgr((s) => s.studyLog) ?? {};
  const [state, setState] = useState<Saved>({ startedAt: null, carried: 0 });
  const [now, setNow] = useState(Date.now());
  useEffect(() => setState(read()), []);
  useEffect(() => {
    if (!state.startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.startedAt]);

  const elapsed = state.carried + (state.startedAt ? now - state.startedAt : 0);
  const running = !!state.startedAt;
  const update = (s: Saved) => { setState(s); write(s); setNow(Date.now()); };
  const start = () => update({ startedAt: Date.now(), carried: state.carried });
  const pause = () => update({ startedAt: null, carried: elapsed });
  const finish = () => { addStudyMinutes(today(), elapsed / 60000); update({ startedAt: null, carried: 0 }); };

  const ws = weekStart(today());
  const week = Array.from({ length: 7 }, (_, i) => log[addDays(ws, i)] ?? 0).reduce((a, b) => a + b, 0);
  const todayMin = log[today()] ?? 0;
  const mm = Math.floor(elapsed / 60000), ss = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className={cx("h-2.5 w-2.5 rounded-full", running ? "animate-pulse bg-pos" : "bg-line")} aria-hidden />
        <span className="num text-[26px] leading-none" aria-live="off">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>
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
