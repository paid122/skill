/**
 * Ledgr AI — context assembly and offline analyst.
 *
 * Only data the user has saved is sent, and only what is needed: aggregate statistics
 * plus compact rows for recent trades and journal entries. Citations use stable tokens
 * ([T#12] for trades, [D:2026-11-03] for daily entries) that the client validates against
 * real records before rendering, so fabricated references are never shown as links.
 */
import { chronological, closedOnly, computeStats, disciplineScore, frequency, groupStats, type EnrichedTrade } from "./calc";
import type { LedgrState } from "./types";
import { dayOfWeek, fmtMoney, fmtPct, fmtR, today, weekStart } from "./util";

export const SUGGESTED = [
  "Review my most recent trade",
  "Summarise this week's trades",
  "Which setups appear most in my records, and how have they gone?",
  "How do my recorded emotions line up with outcomes?",
  "What mistakes keep recurring?",
  "What reflection questions should I ask myself this week?",
];

export interface AIContext { text: string; tradeNumbers: Set<number>; journalDates: Set<string> }

export function buildContext(state: LedgrState, list: EnrichedTrade[]): AIContext {
  const cur = state.settings.baseCurrency;
  const s = computeStats(list);
  const d = disciplineScore(list.map((x) => x.trade), state.dailyJournals);
  const acct = new Map(state.accounts.map((a) => [a.id, a.name]));
  const lines: string[] = [];
  lines.push(`TODAY: ${today()} (${dayOfWeek(today())}). Base currency: ${cur}. All records are simulated or historical journal entries.`);
  lines.push(`OVERALL: ${s.total} records, ${s.closed} closed (${s.excludedDrafts} drafts, ${s.excludedOpen} open excluded). Net ${fmtMoney(s.net, cur)}. Win rate ${fmtPct(s.winRate)} (${s.wins}W/${s.losses}L/${s.breakeven}BE). Profit factor ${s.profitFactor?.toFixed(2) ?? "n/a"}. Avg R ${fmtR(s.avgR)} over ${s.rCoverage} trades with risk. Avg win ${fmtMoney(s.avgWin, cur)}, avg loss ${fmtMoney(s.avgLoss, cur)}. Max drawdown ${fmtMoney(s.maxDD.amount, cur)}. Discipline score ${d.score?.toFixed(0) ?? "n/a"} (${d.components.map((c) => `${c.label} ${c.value?.toFixed(0) ?? "n/a"}`).join("; ")}).`);
  const grp = (title: string, k: (x: EnrichedTrade) => string | string[] | null) => {
    const g = groupStats(list, k).slice(0, 10);
    if (g.length) lines.push(`BY ${title}: ` + g.map((x) => `${x.key}: n=${x.stats.closed}, win ${fmtPct(x.stats.winRate, 0)}, avgR ${fmtR(x.stats.avgR)}, net ${fmtMoney(x.stats.net, cur)}`).join(" | "));
  };
  grp("SETUP", (x) => x.trade.setup || null);
  grp("SESSION", (x) => x.trade.session);
  grp("EMOTION", (x) => x.trade.emotions);
  grp("WEEKDAY", (x) => dayOfWeek(x.trade.date));
  grp("PLAN ADHERENCE", (x) => x.trade.reflection.followedPlan);
  const mistakes = frequency(list.flatMap((x) => x.trade.mistakes));
  if (mistakes.length) lines.push(`MISTAKES: ${mistakes.map((m) => `${m.key} ×${m.count}`).join(", ")}`);

  const strategies = state.strategies.filter((x) => !x.archived);
  if (strategies.length) {
    lines.push("STRATEGIES (the user's own written rules; trades link by strategy or matching setup name):");
    for (const st of strategies) {
      lines.push(`- ${st.name} [${[st.market, st.timeframe].filter(Boolean).join(", ") || "-"}] entry: ${clip(st.entryCriteria, 220)} | exit: ${clip(st.exitCriteria, 160)} | invalidation: ${clip(st.invalidation, 140)} | confluences: ${st.confluences.join(", ") || "-"}`);
    }
  }

  const recent = chronological(list).slice(-120);
  lines.push(`TRADES (most recent ${recent.length}; format: [T#n] date | account | symbol dir | setup | session | status/result | net | R | grade | emotions | mistakes | followed plan | lesson):`);
  for (const x of recent) {
    const t = x.trade;
    lines.push(`[T#${t.number}] ${t.date} | ${acct.get(t.accountId ?? "") ?? "-"} | ${t.symbol} ${t.direction ?? "-"} | ${t.setup || "-"} | ${t.session ?? "-"} | ${x.m.status}${x.m.result ? "/" + x.m.result : ""} | ${x.m.net === null ? "-" : x.m.net.toFixed(2)} | ${x.m.r === null ? "-" : x.m.r.toFixed(2)} | ${t.grade ?? "-"} | ${t.emotions.join("+") || "-"} | ${t.mistakes.join("+") || "-"} | ${t.reflection.followedPlan ?? "-"} | ${clip(t.reflection.learned || t.exitNotes, 140)}`);
  }
  const journals = [...state.dailyJournals].sort((a, b) => a.date.localeCompare(b.date)).slice(-21);
  if (journals.length) {
    lines.push("DAILY JOURNAL (most recent; [D:date] intentions / learned / followed process / mood):");
    for (const j of journals) lines.push(`[D:${j.date}] ${clip(j.pre.intentions, 100)} / ${clip(j.post.learned || j.post.happened, 140)} / ${j.post.followedProcess ?? "-"} / ${j.mood ?? "-"}`);
  }
  return { text: lines.join("\n"), tradeNumbers: new Set(list.map((x) => x.trade.number)), journalDates: new Set(state.dailyJournals.map((j) => j.date)) };
}

const clip = (s: string, n: number) => (s ? (s.length > n ? s.slice(0, n - 1) + "…" : s).replace(/\s+/g, " ") : "-");

/** Extracts citations and drops any that do not match a real record. */
export function extractCitations(text: string, ctx: Pick<AIContext, "tradeNumbers" | "journalDates">) {
  const out = new Set<string>();
  for (const m of text.matchAll(/\[T#(\d+)\]/g)) if (ctx.tradeNumbers.has(Number(m[1]))) out.add(`T#${m[1]}`);
  for (const m of text.matchAll(/\[D:(\d{4}-\d{2}-\d{2})\]/g)) if (ctx.journalDates.has(m[1])) out.add(`D:${m[1]}`);
  return [...out];
}

// ---------------------------------------------------------------------------
// Offline analyst — deterministic answers from the calculation engine
// ---------------------------------------------------------------------------

export function offlineAnswer(question: string, state: LedgrState, list: EnrichedTrade[]): string {
  const q = question.toLowerCase();
  const cur = state.settings.baseCurrency;
  const closed = chronological(closedOnly(list));
  if (!list.length) return "There are no saved journal records to analyse yet. Log a few trades and I can summarise them.";

  const numMatch = q.match(/#?(\d+)/);
  const wantsTrade = /trade|review/.test(q) && (/(recent|last|latest)/.test(q) || (numMatch && /#/.test(q)));
  if (wantsTrade) {
    const target = numMatch && /#/.test(q) ? list.find((x) => x.trade.number === Number(numMatch[1])) : chronological(list).slice(-1)[0];
    if (!target) return `I couldn't find trade #${numMatch?.[1]} in your records.`;
    const t = target.trade, m = target.m;
    const strengths = [t.reflection.followedPlan === "yes" && "you recorded that you followed your written plan", t.emotions.some((e) => ["Calm", "Patient"].includes(e)) && `you noted feeling ${t.emotions.join(" and ").toLowerCase()}`, t.grade && ["A+", "A"].includes(t.grade) && `you graded the execution ${t.grade}`, t.reflection.wentWell && `you wrote: “${t.reflection.wentWell}”`].filter(Boolean);
    const improve = [t.reflection.followedPlan && t.reflection.followedPlan !== "yes" && "your reflection says the plan was not fully followed", t.mistakes.length && `you documented: ${t.mistakes.join(", ").toLowerCase()}`, !t.reflection.learned && "the “What did I learn?” prompt is still empty", t.reflection.improve && `you noted: “${t.reflection.improve}”`].filter(Boolean);
    return [
      `**Trade [T#${t.number}] — ${t.symbol} ${t.direction ?? ""}, ${t.date}**`,
      `Status: ${m.status}${m.result ? ` (${m.result})` : ""}. Net ${fmtMoney(m.net, cur)}, ${fmtR(m.r)}. Setup: ${t.setup || "not recorded"}.`,
      strengths.length ? `**Documented strengths:** ${strengths.join("; ")}.` : "**Documented strengths:** none recorded yet.",
      improve.length ? `**Possible improvements (from your notes):** ${improve.join("; ")}.` : "**Possible improvements:** nothing flagged in your notes.",
      "**Reflection questions:**\n- What did you see that made this entry fit your written criteria?\n- If you took this trade again, which single decision would you keep, and which would you change?\n- How did your emotional state affect the timing of entry or exit?",
    ].join("\n\n");
  }

  if (/week/.test(q)) {
    const ws = weekStart(today());
    const wk = list.filter((x) => x.trade.date >= ws);
    const s = computeStats(wk);
    const mistakes = frequency(wk.flatMap((x) => x.trade.mistakes));
    const lessons = wk.filter((x) => x.trade.reflection.learned).slice(-3).map((x) => `- [T#${x.trade.number}] ${x.trade.reflection.learned}`);
    return [
      `**This week (since ${ws})**`,
      `${s.closed} closed trades, net ${fmtMoney(s.net, cur)}, win rate ${fmtPct(s.winRate)}, average ${fmtR(s.avgR)}.${s.excludedDrafts ? ` ${s.excludedDrafts} drafts are excluded until completed.` : ""}`,
      mistakes.length ? `**Recurring documented behaviours:** ${mistakes.map((m) => `${m.key} (${m.count})`).join(", ")}.` : "**Recurring documented behaviours:** no mistakes documented this week.",
      lessons.length ? `**Lessons you recorded:**\n${lessons.join("\n")}` : "No lessons recorded on this week's trades yet.",
      s.closed < 5 ? "_With fewer than five trades, these figures say little about any pattern._" : "",
    ].filter(Boolean).join("\n\n");
  }

  const groupAnswer = (title: string, k: (x: EnrichedTrade) => string | string[] | null) => {
    const g = groupStats(list, k);
    if (!g.length) return `There isn't enough data recorded for ${title.toLowerCase()} yet.`;
    return [`**${title} in your records** (closed trades only):`, ...g.slice(0, 8).map((x) => `- ${x.key}: ${x.stats.closed} trades, win rate ${fmtPct(x.stats.winRate, 0)}, average ${fmtR(x.stats.avgR)}, net ${fmtMoney(x.stats.net, cur)}`), "", "These describe past records only. Groups with few trades vary a lot by chance, and a difference between groups does not show that one caused the other."].join("\n");
  };
  if (/setup|strateg/.test(q)) return groupAnswer("Setups", (x) => x.trade.setup || null);
  if (/emotion|feel|psych/.test(q)) return groupAnswer("Recorded emotions", (x) => x.trade.emotions) + "\n\nTrades with several emotions appear in each group.";
  if (/session|time of day/.test(q)) return groupAnswer("Sessions", (x) => x.trade.session);
  if (/mistake|error|recurr/.test(q)) {
    const f = frequency(list.flatMap((x) => x.trade.mistakes));
    if (!f.length) return "No mistakes are documented in your records.";
    const recent = chronological(list).slice(-20).flatMap((x) => x.trade.mistakes);
    return ["**Documented mistakes**", ...f.map((m) => `- ${m.key}: ${m.count} total, ${recent.filter((r) => r === m.key).length} in the last 20 trades`), "", "Consider: what usually happens just before the most frequent one?"].join("\n");
  }
  if (/question|reflect/.test(q)) {
    return ["Some questions to take into your weekly review:", "- Which trade this week best matched your written plan, and what made it easy to follow?", "- When did you feel most rushed? What were you looking at in that moment?", "- Which rule did you find hardest to keep, and why?", "- What is one habit you want to practise next week, and how will you know you did it?"].join("\n");
  }
  const s = computeStats(list);
  return [`**Summary of ${s.closed} closed trades**`, `Net ${fmtMoney(s.net, cur)} · win rate ${fmtPct(s.winRate)} · profit factor ${s.profitFactor?.toFixed(2) ?? "n/a"} · average ${fmtR(s.avgR)} · maximum drawdown ${fmtMoney(s.maxDD.amount, cur)}.`, `Most recent trade: [T#${closed[closed.length - 1]?.trade.number ?? "-"}].`, "Ask about a specific trade (e.g. “review trade #12”), this week, setups, emotions, sessions or mistakes."].join("\n\n");
}

export const SYSTEM_PROMPT = `You are Ledgr AI, a historical journal analyst and learning assistant inside Ledgr, a private trading journal.

You work only from the JOURNAL CONTEXT supplied with each conversation. It contains the user's own saved, simulated or historical records.

How to answer:
- Ground every factual statement in the context. When you refer to a trade, cite it exactly as [T#n]; when you refer to a daily journal entry, cite it as [D:YYYY-MM-DD]. Only cite records that appear in the context.
- If the context does not contain what is needed, say so plainly and suggest what the user could record. Never invent trades, numbers, dates, emotions or notes.
- Describe patterns as observations about past records. Never claim that one factor caused an outcome; note when samples are small (under about 20 trades in a group) and that differences may be chance.
- When STRATEGIES are present, compare trades with the user's own written rules for that setup (entry criteria, exits, invalidation) and point out where their notes suggest a rule was or was not followed. Quote their rules; do not invent new ones.
- You may summarise execution, highlight strengths the user documented, point out possible improvements drawn from their own notes and rules, explain statistics, and suggest reflection questions.
- Do not give financial advice. Do not recommend instruments, entries, exits, position sizes or strategies, and do not predict markets or results. If asked, explain that you can only help the user review their own records and process.
- Be warm, direct and concise. Use short paragraphs and lists. Use the user's currency formatting from the context.`;
