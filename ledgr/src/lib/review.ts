/**
 * Suggested answers for the trade review (what went well, what went wrong, what to improve),
 * written only from what the trade records: R, stop, plan, emotions, mistakes, grade and setup.
 * Nothing is invented: a line appears only when the data behind it is there.
 */
import type { TradeMetrics } from "./calc";
import { POSITIVE_EMOTIONS, STRAINED_EMOTIONS, type Trade } from "./types";

export interface ReviewSuggestion { wentWell: string; wentWrong: string; improve: string }

const r1 = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(Math.abs(n) < 1 ? 2 : 1)}R`;
const IMPULSIVE = /impulsive|unplanned|ignored/i;

export function suggestReview(t: Trade, m: TradeMetrics): ReviewSuggestion {
  const well: string[] = [], wrong: string[] = [], improve: string[] = [];
  const r = m.r, win = m.result === "win", loss = m.result === "loss";
  const calm = t.emotions.filter((e) => POSITIVE_EMOTIONS.includes(e));
  const strained = t.emotions.filter((e) => STRAINED_EMOTIONS.includes(e));
  const setup = t.setup.trim();

  // What went well
  if (t.reflection.followedPlan === "yes") well.push("Followed my written plan.");
  if (setup && !t.mistakes.some((x) => IMPULSIVE.test(x))) well.push(`Traded my setup (${setup}).`);
  if (t.stopPrice !== null || t.plannedRisk !== null) well.push("Had my risk defined before entering.");
  if (win && r !== null && r >= 2) well.push(`Let the winner run to ${r1(r)}.`);
  else if (win && r !== null && r >= 1) well.push(`Took profit at ${r1(r)}.`);
  if (loss && r !== null && r >= -0.15) well.push(`Got out near breakeven (${r1(r)}).`);
  else if (loss && r !== null && r >= -1.05) well.push(`Kept the loss to 1R or less (${r1(r)}).`);
  if (calm.length) well.push(`Stayed ${calm.map((e) => e.toLowerCase()).join(" and ")}.`);
  if (t.grade && ["A+", "A"].includes(t.grade)) well.push(`Clean execution (graded ${t.grade}).`);

  // What went wrong, each with its fix
  if (loss && r !== null && r < -1.1) { wrong.push(`Lost more than planned (${r1(r)}).`); improve.push("Respect the stop: get out at 1R, never move it further away."); }
  if (t.stopPrice === null && t.plannedRisk === null) { wrong.push("No stop or planned risk was set."); improve.push("Set the stop before every entry."); }
  if (win && r !== null && r > 0 && r < 0.5) { wrong.push(`Cut the winner early (${r1(r)}).`); improve.push("Hold to the target unless the setup actually breaks."); }
  for (const x of t.mistakes) wrong.push(`${x}.`);
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
