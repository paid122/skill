/**
 * Weekly score (0–100) and weekly streak. Process only, never profit:
 *   Discipline on the week's trades   50%  (disciplineScore: plan, reflections, emotions, completion, daily entries)
 *   Weekly review written             30%  (reflection, progress, mistakes, lessons, next objectives: 20% each)
 *   Trade ratings                     20%  (average of your 1–10 ratings × 10, when you rated any)
 * Missing parts are left out and the rest re-weighted. A week counts toward the streak when its
 * review is written (the reflection plus at least one other section).
 */
import { disciplineScore } from "./calc";
import type { DailyJournal, Trade, WeeklyJournal } from "./types";
import { addDays, weekStart } from "./util";

export function reviewCompleteness(w: WeeklyJournal | undefined): number {
  if (!w) return 0;
  const parts = [w.reflection, w.progress, w.recurringMistakes, w.lessons].map((x) => (x.trim() ? 1 : 0) as number);
  parts.push(w.nextObjectives.length ? 1 : 0);
  return (parts.reduce((a, b) => a + b, 0) / parts.length) * 100;
}

export const reviewWritten = (w: WeeklyJournal | undefined) =>
  !!w && !!w.reflection.trim() && (!!w.progress.trim() || !!w.recurringMistakes.trim() || !!w.lessons.trim() || w.nextObjectives.length > 0);

export interface WeekScore { score: number | null; parts: { label: string; value: number | null; weight: number }[] }

export function weekScore(trades: Trade[], daily: DailyJournal[], w: WeeklyJournal | undefined): WeekScore {
  const disc = trades.length ? disciplineScore(trades, daily).score : null;
  const rated = trades.filter((t) => t.reflection.rating);
  const ratings = rated.length ? (rated.reduce((s, t) => s + (t.reflection.rating ?? 0), 0) / rated.length) * 10 : null;
  const review = w ? reviewCompleteness(w) : trades.length ? 0 : null;
  const parts = [
    { label: "Discipline on your trades", value: disc, weight: 0.5 },
    { label: "Weekly review written", value: review, weight: 0.3 },
    { label: "Your trade ratings", value: ratings, weight: 0.2 },
  ];
  const usable = parts.filter((p) => p.value !== null);
  const wsum = usable.reduce((s, p) => s + p.weight, 0);
  return { score: wsum ? usable.reduce((s, p) => s + (p.value as number) * p.weight, 0) / wsum : null, parts };
}

/**
 * Consecutive weeks with a written review, counting back from this week. This week only
 * counts once it's written, so an unfinished current week doesn't break the streak yet.
 */
export function weeklyStreak(weeklies: WeeklyJournal[], now: string): { current: number; best: number; thisWeekDone: boolean } {
  const done = new Set(weeklies.filter(reviewWritten).map((w) => w.weekStart));
  const thisWeek = weekStart(now);
  let current = 0;
  let wk = done.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  while (done.has(wk)) { current++; wk = addDays(wk, -7); }
  let best = 0, run = 0, prev: string | null = null;
  for (const s of [...done].sort()) { run = prev && addDays(prev, 7) === s ? run + 1 : 1; best = Math.max(best, run); prev = s; }
  return { current, best: Math.max(best, current), thisWeekDone: done.has(thisWeek) };
}
