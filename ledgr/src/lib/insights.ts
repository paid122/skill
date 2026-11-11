/**
 * Pattern detection. Each module is computed only from saved records and reports its
 * sample size. When the sample is below the configured minimum, the module returns
 * "insufficient" and the interface shows "Not enough journal data yet."
 * Wording is descriptive ("in your records…"), never causal or predictive.
 */
import { chronological, closedOnly, computeStats, frequency, groupStats, median, streaks, type EnrichedTrade } from "./calc";
import { dayOfWeek, fmtPct, fmtR } from "./util";

export interface Insight {
  key: string;
  title: string;
  description: string;
  status: "ok" | "insufficient";
  headline?: string;
  detail?: string;
  sample: number;
  rows?: { label: string; value: string; n: number }[];
}

export const INSIGHT_META: Record<string, { title: string; description: string }> = {
  setupConsistency: { title: "Setup consistency", description: "How results vary across your recorded setups." },
  sessionPerformance: { title: "Session performance", description: "Results grouped by the session you recorded." },
  dayOfWeek: { title: "Day-of-week patterns", description: "Results grouped by weekday." },
  emotionPatterns: { title: "Emotion patterns", description: "Outcomes alongside the emotions you recorded." },
  tradeDuration: { title: "Trade duration", description: "Holding time of winning and losing records." },
  rProgression: { title: "Average R progression", description: "Average R in the earlier and later halves of your records." },
  losingStreaks: { title: "Losing streak frequency", description: "How often consecutive losing records occur." },
  winningStreaks: { title: "Winning streak frequency", description: "How often consecutive winning records occur." },
  riskConsistency: { title: "Risk consistency", description: "How much your recorded risk per trade varies." },
  tradeNumberOfDay: { title: "Trade number of the day", description: "Results by the order of the trade within its day." },
  setupSession: { title: "Setup and session combinations", description: "Which setup–session pairs appear most in your records." },
  confluenceFrequency: { title: "Confluence frequency", description: "How often each confluence is recorded, and alongside which results." },
  exitBehaviour: { title: "Exit behaviour", description: "How exits compare with recorded targets and stops." },
  mistakeRecurrence: { title: "Mistake recurrence", description: "Which documented mistakes repeat, and how recently." },
};

const rowFromGroup = (g: { key: string; stats: ReturnType<typeof computeStats> }) => ({
  label: g.key,
  value: `${fmtPct(g.stats.winRate, 0)} win rate · ${fmtR(g.stats.avgR)} avg`,
  n: g.stats.closed,
});

function compareGroups(title: string, groups: { key: string; stats: ReturnType<typeof computeStats> }[], minGroup: number) {
  const usable = groups.filter((g) => g.stats.closed >= minGroup && g.stats.avgR !== null);
  if (usable.length < 2) return null;
  const sorted = [...usable].sort((a, b) => (b.stats.avgR as number) - (a.stats.avgR as number));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  return {
    headline: `${best.key} has the highest average R in your records (${fmtR(best.stats.avgR)} over ${best.stats.closed} trades); ${worst.key} the lowest (${fmtR(worst.stats.avgR)} over ${worst.stats.closed}).`,
    detail: `${title} comparison includes groups with at least ${minGroup} closed trades. This describes past records only and does not show cause.`,
    rows: sorted.map(rowFromGroup),
  };
}

export function computeInsights(list: EnrichedTrade[], minSample: number): Insight[] {
  const closed = closedOnly(list);
  const n = closed.length;
  const minGroup = Math.max(3, Math.round(minSample / 3));
  const out: Insight[] = [];
  const base = (key: string): Insight => ({ key, ...INSIGHT_META[key], status: "insufficient", sample: n });

  const add = (key: string, fn: () => Partial<Insight> | null) => {
    const i = base(key);
    if (n < minSample) return out.push(i);
    const res = fn();
    out.push(res ? { ...i, ...res, status: "ok" } : i);
  };

  add("setupConsistency", () => compareGroups("Setup", groupStats(list, (x) => x.trade.setup || null), minGroup));
  add("sessionPerformance", () => compareGroups("Session", groupStats(list, (x) => x.trade.session), minGroup));
  add("dayOfWeek", () => compareGroups("Weekday", groupStats(list, (x) => dayOfWeek(x.trade.date)), minGroup));
  add("emotionPatterns", () => {
    const res = compareGroups("Emotion", groupStats(list, (x) => x.trade.emotions), minGroup);
    if (!res) return null;
    return { ...res, detail: "Trades can carry more than one emotion, so groups overlap. Emotions are self-reported. " + res.detail };
  });
  add("tradeDuration", () => {
    const w = closed.filter((x) => x.m.result === "win" && x.m.durationMinutes !== null).map((x) => x.m.durationMinutes as number);
    const l = closed.filter((x) => x.m.result === "loss" && x.m.durationMinutes !== null).map((x) => x.m.durationMinutes as number);
    if (w.length < minGroup || l.length < minGroup) return null;
    const mw = median(w) as number, ml = median(l) as number;
    return {
      headline: `Median holding time is ${Math.round(mw)} min for winning records and ${Math.round(ml)} min for losing records.`,
      detail: `Based on ${w.length + l.length} trades with at least two timed executions.`,
      rows: [{ label: "Winning", value: `${Math.round(mw)} min median`, n: w.length }, { label: "Losing", value: `${Math.round(ml)} min median`, n: l.length }],
    };
  });
  add("rProgression", () => {
    const seq = chronological(closed).filter((x) => x.m.r !== null);
    if (seq.length < minSample) return null;
    const half = Math.floor(seq.length / 2);
    const a = computeStats(seq.slice(0, half)), b = computeStats(seq.slice(half));
    const delta = (b.avgR ?? 0) - (a.avgR ?? 0);
    return {
      headline: `Average R moved from ${fmtR(a.avgR)} in your earlier ${half} trades to ${fmtR(b.avgR)} in the later ${seq.length - half}.`,
      detail: Math.abs(delta) < 0.1 ? "The change is small relative to normal trade-to-trade variation." : "Small samples vary a lot; treat this as a prompt for review, not a trend.",
      rows: [{ label: "Earlier half", value: fmtR(a.avgR), n: half }, { label: "Later half", value: fmtR(b.avgR), n: seq.length - half }],
    };
  });
  add("losingStreaks", () => {
    const s = streaks(list);
    const runs = frequency(s.lossRuns.map((x) => (x >= 4 ? "4+" : String(x))));
    return { headline: `Longest losing run: ${s.maxLoss}. Losing runs recorded: ${s.lossRuns.length}.`, detail: "Break-even trades end a streak.", rows: runs.map((r) => ({ label: `${r.key} in a row`, value: `${r.count}×`, n: r.count })) };
  });
  add("winningStreaks", () => {
    const s = streaks(list);
    const runs = frequency(s.winRuns.map((x) => (x >= 4 ? "4+" : String(x))));
    return { headline: `Longest winning run: ${s.maxWin}. Winning runs recorded: ${s.winRuns.length}.`, detail: "Break-even trades end a streak.", rows: runs.map((r) => ({ label: `${r.key} in a row`, value: `${r.count}×`, n: r.count })) };
  });
  add("riskConsistency", () => {
    const risks = closed.map((x) => x.m.risk).filter((r): r is number => r !== null);
    if (risks.length < minSample) return null;
    const mean = risks.reduce((a, b) => a + b, 0) / risks.length;
    const sd = Math.sqrt(risks.reduce((s, r) => s + (r - mean) ** 2, 0) / risks.length);
    const cv = sd / mean;
    return {
      headline: `Recorded risk per trade varies by ${fmtPct(cv, 0)} around its average (coefficient of variation).`,
      detail: `${risks.length} of ${n} closed trades have a stop or planned risk recorded. Lower variation means more uniform sizing.`,
      rows: [{ label: "Trades with risk recorded", value: `${risks.length}`, n: risks.length }],
    };
  });
  add("tradeNumberOfDay", () => {
    const byDay = new Map<string, EnrichedTrade[]>();
    chronological(closed).forEach((x) => byDay.set(x.trade.date, [...(byDay.get(x.trade.date) ?? []), x]));
    const ordinal = new Map<string, string>();
    byDay.forEach((xs) => xs.forEach((x, i) => ordinal.set(x.trade.id, i >= 2 ? "3rd or later" : i === 0 ? "1st of day" : "2nd of day")));
    return compareGroups("Trade-order", groupStats(list, (x) => ordinal.get(x.trade.id) ?? null), minGroup);
  });
  add("setupSession", () => {
    const groups = groupStats(list, (x) => (x.trade.setup && x.trade.session ? `${x.trade.setup} · ${x.trade.session}` : null)).filter((g) => g.stats.closed >= minGroup);
    if (!groups.length) return null;
    return { headline: `Most frequent combination: ${groups[0].key} (${groups[0].stats.closed} trades).`, detail: `Combinations with at least ${minGroup} trades.`, rows: groups.slice(0, 6).map(rowFromGroup) };
  });
  add("confluenceFrequency", () => {
    const groups = groupStats(list, (x) => x.trade.confluences);
    if (!groups.length) return null;
    const total = closed.filter((x) => x.trade.confluences.length).length;
    return { headline: `${groups[0].key} is your most recorded confluence (${groups[0].stats.closed} trades).`, detail: `${total} of ${n} closed trades list at least one confluence.`, rows: groups.slice(0, 6).map(rowFromGroup) };
  });
  add("exitBehaviour", () => {
    const withTarget = closed.filter((x) => x.trade.targetPrice !== null && x.m.avgExit !== null && x.m.avgEntry !== null && x.trade.direction);
    if (withTarget.length < minSample) return null;
    let reached = 0, beforeTarget = 0, atStop = 0;
    for (const x of withTarget) {
      const sign = x.trade.direction === "long" ? 1 : -1;
      const toTarget = (x.trade.targetPrice! - x.m.avgEntry!) * sign;
      const moved = (x.m.avgExit! - x.m.avgEntry!) * sign;
      if (toTarget > 0 && moved >= toTarget * 0.98) reached++;
      else if (x.trade.stopPrice !== null && moved <= (x.trade.stopPrice - x.m.avgEntry!) * sign * 0.98) atStop++;
      else beforeTarget++;
    }
    return {
      headline: `${fmtPct(reached / withTarget.length, 0)} of trades with a recorded target exited at or beyond it.`,
      detail: `Based on ${withTarget.length} trades with a target. Average exit price is compared with the target and stop.`,
      rows: [{ label: "At or beyond target", value: `${reached}`, n: reached }, { label: "Closed between stop and target", value: `${beforeTarget}`, n: beforeTarget }, { label: "At or beyond stop", value: `${atStop}`, n: atStop }],
    };
  });
  add("mistakeRecurrence", () => {
    const all = list.filter((x) => x.trade.mistakes.length);
    if (!all.length) return { headline: "No documented mistakes in these records.", detail: "Mistakes are recorded in the Psychology tab of the trade editor.", rows: [] };
    const freq = frequency(all.flatMap((x) => x.trade.mistakes));
    const recent = chronological(list).slice(-20).flatMap((x) => x.trade.mistakes);
    return {
      headline: `${freq[0].key} is the most documented mistake (${freq[0].count} times; ${recent.filter((m) => m === freq[0].key).length} in the last 20 trades).`,
      detail: `${all.length} of ${list.length} records note at least one mistake.`,
      rows: freq.slice(0, 6).map((f) => ({ label: f.key, value: `${f.count}×`, n: f.count })),
    };
  });
  return out;
}
