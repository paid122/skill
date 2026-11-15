/**
 * Study plan: reads the user's own records and picks the areas most worth studying next,
 * each with the evidence from their journal and YouTube searches to learn from.
 * Descriptive only ("in your records…"); never a prediction or financial advice.
 */
import { chronological, closedOnly, computeStats, frequency, groupStats, streaks, type EnrichedTrade } from "./calc";
import { fmtPct, fmtR } from "./util";

export interface StudyFocus {
  key: string;
  title: string;
  /** What in the user's records points here. */
  why: string;
  /** What to look for while watching. */
  watchFor: string;
  /** YouTube search queries, best first. */
  queries: string[];
  /** Higher = more pressing. */
  score: number;
}

/** Only recent records count, so the plan follows how you trade now. */
const RECENT = 60;
const MIN_TRADES = 5;

function mistakeTopic(m: string): Omit<StudyFocus, "why" | "score" | "key"> {
  const s = m.toLowerCase();
  if (/revenge/.test(s)) return { title: "Revenge trading", watchFor: "A rule for what you do after a loss, before the next trade.", queries: ["how to stop revenge trading", "trading after a loss psychology"] };
  if (/fomo|chas/.test(s)) return { title: "Chasing entries (FOMO)", watchFor: "How to wait for your entry instead of chasing a move.", queries: ["how to stop FOMO trading", "stop chasing trades wait for entry"] };
  if (/over ?trad|too many/.test(s)) return { title: "Overtrading", watchFor: "A daily trade limit and what counts as an A setup.", queries: ["how to stop overtrading day trading", "trade less quality setups only"] };
  if (/stop/.test(s)) return { title: "Respecting your stop", watchFor: "Why moving or removing a stop turns small losses into big ones.", queries: ["never move your stop loss trading discipline", "stop loss discipline day trading"] };
  if (/impuls|unplanned/.test(s)) return { title: "Impulsive and unplanned entries", watchFor: "A pre-trade checklist you run before every entry.", queries: ["pre trade checklist day trading", "how to stop impulsive trading"] };
  if (/rule|plan/.test(s)) return { title: "Following your written rules", watchFor: "How other traders make their rules easy to follow in the moment.", queries: ["how to follow your trading plan discipline", "trading rules discipline psychology"] };
  if (/prepar/.test(s)) return { title: "Pre-market preparation", watchFor: "A short routine: levels, news, bias and what you will not trade.", queries: ["pre market preparation routine day trading", "day trading morning routine game plan"] };
  if (/reflect|review|journal/.test(s)) return { title: "Reviewing your trades", watchFor: "A simple weekly review you can repeat in LEDGR.", queries: ["how to review your trades trading journal", "weekly trading review process"] };
  if (/size|risk|lot/.test(s)) return { title: "Position sizing", watchFor: "Sizing from a fixed risk per trade, not from feel.", queries: ["position sizing risk per trade explained", "risk management position size day trading"] };
  if (/exit|early|winner/.test(s)) return { title: "Exits and letting winners run", watchFor: "Planning the exit before the entry.", queries: ["how to let winners run trade management", "when to take profit trading exits"] };
  return { title: `"${m}"`, watchFor: "What causes it and one rule that prevents it.", queries: [`${m} trading mistake how to fix`, "common trading mistakes discipline"] };
}

export function buildStudyPlan(all: EnrichedTrade[], max = 4): { focus: StudyFocus[]; sample: number } {
  const closed = chronological(closedOnly(all)).slice(-RECENT);
  const n = closed.length;
  if (n < MIN_TRADES) return { focus: [], sample: n };
  const out: StudyFocus[] = [];
  const st = computeStats(closed);

  // 1. The mistake you document most.
  const mistakes = frequency(closed.flatMap((x) => x.trade.mistakes).filter((m) => m && m !== "Other"));
  if (mistakes.length && mistakes[0].count >= 2) {
    const m = mistakes[0];
    out.push({ key: `mistake:${m.key}`, ...mistakeTopic(m.key), why: `You noted "${m.key}" on ${m.count} of your last ${n} trades — your most documented mistake.`, score: 40 + (m.count / n) * 100 });
  }

  // 2. Plan adherence.
  const rated = closed.filter((x) => x.trade.reflection.followedPlan);
  const offPlan = rated.filter((x) => x.trade.reflection.followedPlan !== "yes");
  if (rated.length >= MIN_TRADES && offPlan.length / rated.length >= 0.3) {
    const off = computeStats(offPlan), on = computeStats(rated.filter((x) => x.trade.reflection.followedPlan === "yes"));
    const gap = on.avgR !== null && off.avgR !== null ? ` Off-plan trades averaged ${fmtR(off.avgR)} against ${fmtR(on.avgR)} on-plan.` : "";
    out.push({ key: "plan", title: "Following your plan", why: `You marked ${offPlan.length} of ${rated.length} reviewed trades as not (fully) following your plan.${gap}`, watchFor: "How to make your plan short and specific enough to follow live.", queries: ["how to follow your trading plan discipline", "trading discipline psychology"], score: 30 + (offPlan.length / rated.length) * 60 });
  }

  // 3. Strained emotions on losing trades.
  const strained = closed.filter((x) => x.trade.emotions.some((e) => e === "Frustrated" || e === "Impatient" || e === "Distracted"));
  if (strained.length >= 3) {
    const s = computeStats(strained);
    if ((s.avgR ?? 0) < (st.avgR ?? 0)) {
      const top = frequency(strained.flatMap((x) => x.trade.emotions).filter((e) => e === "Frustrated" || e === "Impatient" || e === "Distracted"))[0]?.key ?? "Frustrated";
      out.push({ key: "emotions", title: `Trading while ${top.toLowerCase()}`, why: `${strained.length} trades were logged feeling frustrated, impatient or distracted, averaging ${fmtR(s.avgR)} against your overall ${fmtR(st.avgR)}.`, watchFor: "A reset routine and when to stop for the day.", queries: [`${top.toLowerCase()} trading psychology how to stay calm`, "trading psychology emotional control"], score: 25 + strained.length });
    }
  }

  // 4. Losses bigger than wins.
  if (st.avgWin !== null && st.avgLoss !== null && st.avgWin < Math.abs(st.avgLoss) && st.wins >= 2 && st.losses >= 2) {
    const ratio = st.avgWin / Math.abs(st.avgLoss);
    out.push({ key: "payoff", title: "Bigger losses than wins", why: `Your average win is ${ratio.toFixed(2)}× your average loss over the last ${n} trades, so you need a high win rate to come out ahead.`, watchFor: "Cutting losers at the stop and planning targets before entry.", queries: ["risk reward ratio explained day trading", "how to let winners run and cut losers"], score: 20 + (1 - ratio) * 50 });
  }

  // 5. Weakest setup.
  const setups = groupStats(closed, (x) => x.trade.setup || null).filter((g) => g.stats.closed >= 3 && g.stats.avgR !== null);
  if (setups.length >= 2) {
    const worst = [...setups].sort((a, b) => (a.stats.avgR as number) - (b.stats.avgR as number))[0];
    if ((worst.stats.avgR as number) < 0) {
      out.push({ key: `setup:${worst.key}`, title: `Your "${worst.key}" setup`, why: `${worst.stats.closed} trades with this setup averaged ${fmtR(worst.stats.avgR)} (${fmtPct(worst.stats.winRate, 0)} win rate) — your weakest setup.`, watchFor: "The exact entry trigger and invalidation, then compare with your trades.", queries: [`${worst.key} trading strategy explained`, `${worst.key} entry rules`], score: 15 + Math.abs(worst.stats.avgR as number) * 20 });
    }
  }

  // 6. Late trades of the day.
  const byDay = new Map<string, number>();
  const order = closed.map((x) => { const k = byDay.get(x.trade.date) ?? 0; byDay.set(x.trade.date, k + 1); return { x, i: k }; });
  const late = order.filter((o) => o.i >= 2).map((o) => o.x);
  if (late.length >= 3) {
    const l = computeStats(late), early = computeStats(order.filter((o) => o.i < 2).map((o) => o.x));
    if ((l.avgR ?? 0) < 0 && (l.avgR ?? 0) < (early.avgR ?? 0)) {
      out.push({ key: "overtrading", title: "Overtrading late in the day", why: `Your 3rd and later trades of a day averaged ${fmtR(l.avgR)} (${late.length} trades), against ${fmtR(early.avgR)} for the first two.`, watchFor: "Setting a daily trade limit and a stop rule.", queries: ["how to stop overtrading day trading", "daily max loss rule trading"], score: 15 + late.length });
    }
  }

  // 7. Losing streaks.
  const s = streaks(closed);
  if (s.maxLoss >= 4) {
    out.push({ key: "streaks", title: "Handling losing streaks", why: `Your longest run of losses in these records is ${s.maxLoss} in a row.`, watchFor: "Reducing size after losses and when to take a break.", queries: ["how to handle a losing streak trading", "trading drawdown psychology"], score: 10 + s.maxLoss * 3 });
  }

  // 8. No stops recorded.
  const withRisk = closed.filter((x) => x.m.risk !== null).length;
  if (withRisk / n < 0.5) {
    out.push({ key: "stops", title: "Planning your stop before entry", why: `Only ${withRisk} of your last ${n} trades have a stop or planned risk recorded.`, watchFor: "Where to place a stop and sizing the trade from it.", queries: ["where to place stop loss day trading", "position sizing from stop loss"], score: 12 });
  }

  // Always useful when nothing stands out.
  if (!out.length) {
    out.push({ key: "review", title: "Reviewing your trades", why: `Nothing stands out as a weak spot in your last ${n} trades. A steady review habit keeps it that way.`, watchFor: "A short weekly review routine.", queries: ["how to review your trades trading journal", "weekly trading review process"], score: 1 });
  }
  return { focus: out.sort((a, b) => b.score - a.score).slice(0, max), sample: n };
}

export const youtubeSearchUrl = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
