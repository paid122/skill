/**
 * Suggested answers for the trade review (what went well, what went wrong, what to improve) and a
 * suggested process rating, written only from what the journal records: R, stop, target, plan,
 * emotions, mistakes, grade, setup, timing, and the trader's other trades that day and month.
 * Nothing is invented: a line appears only when the data behind it is there.
 */
import type { EnrichedTrade, TradeMetrics } from "./calc";
import { POSITIVE_EMOTIONS, STRAINED_EMOTIONS, type Trade } from "./types";

export interface ReviewSuggestion { wentWell: string; wentWrong: string; improve: string }
export interface ReviewContext {
  /** Every trade in the journal (enriched), to compare this one against its day and month. */
  all: EnrichedTrade[];
}

const r1 = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(Math.abs(n) < 1 ? 2 : 1)}R`;
const IMPULSIVE = /impulsive|unplanned|ignored/i;
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const lastTime = (t: Trade) => Math.max(...t.executions.map((e) => new Date(e.time).getTime()).filter(Number.isFinite));
const daysBetween = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;

/** Facts about the trade's day and history that the review lines draw on. */
export function reviewFacts(t: Trade, m: TradeMetrics, ctx?: ReviewContext) {
  const others = (ctx?.all ?? []).filter((x) => x.trade.id !== t.id && !x.trade.isDraft);
  const day = others.filter((x) => x.trade.date === t.date && x.m.firstTime).sort((a, b) => (a.m.firstTime! < b.m.firstTime! ? -1 : 1));
  const start = m.firstTime ? new Date(m.firstTime).getTime() : null;
  const before = start === null ? [] : day.filter((x) => new Date(x.m.firstTime!).getTime() < start);
  const prev = before[before.length - 1];
  const prevEnd = prev ? lastTime(prev.trade) : NaN;
  const minsAfterLoss = prev && prev.m.result === "loss" && start !== null && Number.isFinite(prevEnd) ? (start - prevEnd) / 60000 : null;
  // Planned reward:risk from the target and stop, when both are set.
  const plannedR = t.targetPrice !== null && t.stopPrice !== null && m.avgEntry !== null && Math.abs(m.avgEntry - t.stopPrice) > 0
    ? Math.abs(t.targetPrice - m.avgEntry) / Math.abs(m.avgEntry - t.stopPrice) : null;
  // How often each of this trade's mistakes shows up in the last 30 days.
  const recent = others.filter((x) => daysBetween(x.trade.date, t.date) <= 30);
  const repeats = t.mistakes.map((name) => ({ name, count: recent.filter((x) => x.trade.mistakes.includes(name)).length + 1 })).filter((x) => x.count >= 3);
  const rated = others.filter((x) => x.trade.reflection.rating).slice(-30);
  const avgRating = rated.length >= 3 ? rated.reduce((s, x) => s + (x.trade.reflection.rating ?? 0), 0) / rated.length : null;
  return { tradeOfDay: before.length + 1, minsAfterLoss, plannedR, repeats, avgRating };
}

export function suggestReview(t: Trade, m: TradeMetrics, ctx?: ReviewContext): ReviewSuggestion {
  const well: string[] = [], wrong: string[] = [], improve: string[] = [];
  const f = reviewFacts(t, m, ctx);
  const r = m.r, win = m.result === "win", loss = m.result === "loss";
  const calm = t.emotions.filter((e) => POSITIVE_EMOTIONS.includes(e));
  const strained = t.emotions.filter((e) => STRAINED_EMOTIONS.includes(e));
  const setup = t.setup.trim();
  const mins = m.durationMinutes;

  // What went well
  if (t.reflection.followedPlan === "yes") well.push("Followed my written plan.");
  if (setup && !t.mistakes.some((x) => IMPULSIVE.test(x))) well.push(`Traded my setup (${setup}).`);
  if (t.stopPrice !== null || t.plannedRisk !== null) well.push("Had my risk defined before entering.");
  if (win && r !== null && f.plannedR !== null && r >= f.plannedR * 0.9) well.push(`Hit my target (${r1(r)} of a planned ${r1(f.plannedR)}).`);
  else if (win && r !== null && r >= 2) well.push(`Let the winner run to ${r1(r)}.`);
  else if (win && r !== null && r >= 1) well.push(`Took profit at ${r1(r)}.`);
  if (loss && r !== null && r >= -0.15) well.push(`Got out near breakeven (${r1(r)}).`);
  else if (loss && r !== null && r >= -1.05) well.push(`Kept the loss to 1R or less (${r1(r)}).`);
  if (calm.length) well.push(`Stayed ${calm.map((e) => e.toLowerCase()).join(" and ")}.`);
  if (t.grade && ["A+", "A"].includes(t.grade)) well.push(`Clean execution (graded ${t.grade}).`);
  if (f.minsAfterLoss !== null && f.minsAfterLoss >= 15) well.push(`Waited ${Math.round(f.minsAfterLoss)} minutes after my last loss before this entry.`);

  // What went wrong, each with its fix
  if (loss && r !== null && r < -1.1) { wrong.push(`Lost more than planned (${r1(r)}).`); improve.push("Respect the stop: get out at 1R, never move it further away."); }
  if (t.stopPrice === null && t.plannedRisk === null) { wrong.push("No stop or planned risk was set."); improve.push("Set the stop before every entry."); }
  if (win && r !== null && f.plannedR !== null && r < f.plannedR * 0.6) { wrong.push(`Exited before my target (${r1(r)} of a planned ${r1(f.plannedR)}).`); improve.push("Let it reach the target unless the setup actually breaks."); }
  else if (win && r !== null && r > 0 && r < 0.5) { wrong.push(`Cut the winner early (${r1(r)}).`); improve.push("Hold to the target unless the setup actually breaks."); }
  if (f.minsAfterLoss !== null && f.minsAfterLoss >= 0 && f.minsAfterLoss < 10) { wrong.push(`Entered ${Math.max(1, Math.round(f.minsAfterLoss))} min after a loss (possible revenge trade).`); improve.push("After a loss, wait 15 minutes and re-read the plan before the next entry."); }
  if (f.tradeOfDay >= 4) { wrong.push(`This was my ${ord(f.tradeOfDay)} trade of the day.`); improve.push("Set a daily trade limit (for example 3) and stop when it's reached."); }
  if (loss && mins !== null && mins < 2) { wrong.push(`In and out in under 2 minutes.`); improve.push("Give the trade room: decide the exit before the entry, not during it."); }
  for (const x of t.mistakes) wrong.push(`${x}.`);
  for (const x of f.repeats) wrong.push(`“${x.name}” has now happened ${x.count} times in 30 days.`);
  if (t.mistakes.some((x) => IMPULSIVE.test(x))) improve.push("Only enter when every item on the checklist is ticked.");
  if (t.mistakes.some((x) => /preparation/i.test(x))) improve.push("Finish the pre-market plan before the first trade.");
  if (strained.length) { wrong.push(`Felt ${strained.map((e) => e.toLowerCase()).join(" and ")}.`); improve.push(`When I feel ${strained[0].toLowerCase()}, step away for 5 minutes before the next entry.`); }
  if (t.reflection.followedPlan === "no") { wrong.push("Didn't follow my plan."); improve.push("Write the plan before the session and trade only what's on it."); }
  else if (t.reflection.followedPlan === "partial") { wrong.push("Only partly followed my plan."); improve.push("Go through the plan step by step, not just the entry."); }
  if (t.grade && ["D", "F"].includes(t.grade)) wrong.push(`Poor execution (graded ${t.grade}).`);

  if (!wrong.length && well.length >= 2) { wrong.push("No mistakes recorded on this trade."); improve.push("Keep repeating this: same setup, same risk, same patience."); }

  // One point per line, so it reads as a list.
  const uniq = (a: string[]) => [...new Set(a)].join("\n");
  return { wentWell: uniq(well), wentWrong: uniq(wrong), improve: uniq(improve) };
}

/**
 * A suggested 1–10 rating of the process (not the P&L), from the same facts. Starts at 5 and moves
 * for each thing done right or wrong; null when the trade records too little to judge.
 */
export function suggestRating(t: Trade, m: TradeMetrics, ctx?: ReviewContext): number | null {
  const f = reviewFacts(t, m, ctx);
  const signals = [t.reflection.followedPlan, t.stopPrice ?? t.plannedRisk, m.r, t.grade, t.emotions.length || null, t.mistakes.length || null].filter((x) => x !== null && x !== undefined).length;
  if (signals < 2) return null;
  let s = 5;
  s += t.reflection.followedPlan === "yes" ? 1.5 : t.reflection.followedPlan === "partial" ? -1 : t.reflection.followedPlan === "no" ? -2.5 : 0;
  s += t.stopPrice !== null || t.plannedRisk !== null ? 0.5 : -2;
  if (m.r !== null) s += m.r < -1.1 ? -2 : 0.5;
  s -= Math.min(3, t.mistakes.length * 1.25);
  if (t.emotions.some((e) => STRAINED_EMOTIONS.includes(e))) s -= 1;
  if (t.emotions.some((e) => POSITIVE_EMOTIONS.includes(e))) s += 0.5;
  if (t.grade) s += { "A+": 1.5, A: 1, B: 0.25, C: -0.5, D: -1.5, F: -2.5 }[t.grade];
  if (f.minsAfterLoss !== null && f.minsAfterLoss >= 0 && f.minsAfterLoss < 10) s -= 1;
  if (f.tradeOfDay >= 4) s -= 0.5;
  return Math.max(1, Math.min(10, Math.round(s)));
}

export interface TradeScore { score: number; parts: { label: string; value: number; weight: number }[] }

/**
 * LEDGR trade score (0–100), one number per trade:
 *   Execution   35%  your 1–10 rating × 10 (or the suggested rating when you haven't rated)
 *   Risk        25%  stop or planned risk set, and the loss kept to about 1R
 *   Result      20%  R multiple: −1R → 0, +2R or better → 100 (P&L only counts here)
 *   Discipline  20%  followed the plan, no documented mistakes, no revenge entry or overtrading
 * Null when the trade isn't closed yet.
 */
export function tradeScore(t: Trade, m: TradeMetrics, ctx?: ReviewContext): TradeScore | null {
  if (m.status !== "closed") return null;
  const f = reviewFacts(t, m, ctx);
  const rating = t.reflection.rating ?? suggestRating(t, m, ctx);
  const hasRisk = t.stopPrice !== null || t.plannedRisk !== null;
  const risk = !hasRisk ? 0 : m.r !== null && m.r < -1.1 ? Math.max(0, 100 - (Math.abs(m.r) - 1) * 100) : 100;
  const result = m.r !== null ? Math.max(0, Math.min(1, (m.r + 1) / 3)) * 100 : m.result === "win" ? 70 : m.result === "loss" ? 20 : 45;
  let discipline = t.reflection.followedPlan === "yes" ? 100 : t.reflection.followedPlan === "partial" ? 60 : t.reflection.followedPlan === "no" ? 20 : 70;
  discipline -= Math.min(60, t.mistakes.length * 20);
  if (f.minsAfterLoss !== null && f.minsAfterLoss >= 0 && f.minsAfterLoss < 10) discipline -= 20;
  if (f.tradeOfDay >= 4) discipline -= 10;
  const parts = [
    { label: "Execution", value: rating ? rating * 10 : 50, weight: 0.35 },
    { label: "Risk", value: risk, weight: 0.25 },
    { label: "Result", value: result, weight: 0.2 },
    { label: "Discipline", value: Math.max(0, discipline), weight: 0.2 },
  ];
  return { score: Math.round(parts.reduce((s, p) => s + p.value * p.weight, 0)), parts };
}
