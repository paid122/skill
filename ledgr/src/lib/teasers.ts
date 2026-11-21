"use client";
/**
 * Real numbers from the trader's own journal for the locked-page cards: a couple shown plainly,
 * and the answer the paid page gives kept blurred. Everything here is computed from their records.
 */
import { useMemo } from "react";
import type { Teaser } from "@/components/PlusGate";
import { closedOnly, computeStats, disciplineScore, frequency, groupStats } from "./calc";
import { useScoped } from "./hooks";
import { useLedgr } from "./store";
import { fmtNum, today, weekStart } from "./util";
import { weeklyStreak } from "./weekly";

const hide = (label: string, value: string): Teaser => ({ label, value, hidden: true });

export function useAnalyticsTeasers(): Teaser[] {
  const { current } = useScoped({ ignoreRange: true });
  return useMemo(() => {
    const closed = closedOnly(current);
    const setups = groupStats(closed, (x) => x.trade.setup.trim() || null);
    const best = [...setups].filter((g) => g.stats.closed >= 2).sort((a, b) => b.stats.net - a.stats.net)[0];
    return [
      { label: "Trades to analyse", value: fmtNum(closed.length, 0) },
      { label: "Setups traded", value: fmtNum(setups.length, 0) },
      hide("Your best setup", best?.key ?? "••••••••"),
    ];
  }, [current]);
}

export function usePsychologyTeasers(): Teaser[] {
  const { current } = useScoped({ ignoreRange: true });
  return useMemo(() => {
    const ts = current.map((x) => x.trade);
    const mistakes = frequency(ts.flatMap((t) => t.mistakes));
    return [
      { label: "Emotions logged", value: fmtNum(ts.reduce((n, t) => n + t.emotions.length, 0), 0) },
      { label: "Mistakes documented", value: fmtNum(mistakes.reduce((n, m) => n + m.count, 0), 0) },
      hide("Costliest habit", mistakes[0]?.key ?? "••••••••"),
    ];
  }, [current]);
}

export function useScoreTeasers(): Teaser[] {
  const { current } = useScoped({ ignoreRange: true });
  const journals = useLedgr((s) => s.dailyJournals);
  return useMemo(() => {
    const st = computeStats(current);
    const d = disciplineScore(current.map((x) => x.trade), journals).score;
    return [
      { label: "Closed trades", value: fmtNum(st.closed, 0) },
      { label: "Discipline", value: d === null ? "—" : fmtNum(d, 0) },
      hide("Your score", "••"),
    ];
  }, [current, journals]);
}

export function useWeeklyTeasers(): Teaser[] {
  const weeklies = useLedgr((s) => s.weeklyJournals);
  const { current } = useScoped({ ignoreRange: true });
  return useMemo(() => {
    const weeks = new Set(current.map((x) => weekStart(x.trade.date))).size;
    return [
      { label: "Weeks traded", value: fmtNum(weeks, 0) },
      { label: "Reviews written", value: fmtNum(weeklies.length, 0) },
      hide("Your streak", `${weeklyStreak(weeklies, today()).current} weeks`),
    ];
  }, [current, weeklies]);
}
