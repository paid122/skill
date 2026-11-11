/**
 * Ledgr calculation engine.
 *
 * Every number shown in the interface is derived here from saved records.
 * Formulas are documented inline and in /docs/CALCULATIONS.md.
 *
 * Inclusion rule: a trade contributes to performance statistics only when it is
 *   (a) not a draft, and (b) closed — either all entered quantity has been exited,
 *   or (with no executions) a manual net result is recorded.
 * Drafts and open trades are counted separately and reported as "excluded" so
 * no metric is silently calculated from incomplete records.
 */
import type { DailyJournal, Emotion, ISODate, Settings, Trade } from "./types";
import { POSITIVE_EMOTIONS } from "./types";

export type TradeStatus = "draft" | "open" | "closed";
export type TradeResult = "win" | "loss" | "breakeven";

export interface TradeMetrics {
  status: TradeStatus;
  entryQty: number;
  exitQty: number;
  avgEntry: number | null;
  avgExit: number | null;
  gross: number | null;
  totalFees: number;
  net: number | null;
  risk: number | null;
  r: number | null;
  result: TradeResult | null;
  missing: string[];
  durationMinutes: number | null;
  firstTime: string | null;
}

const EPS = 1e-9;

export function round(n: number, dp = 2) {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Fields required before a trade can leave draft status. */
export function missingFields(t: Trade): string[] {
  const m: string[] = [];
  if (!t.symbol.trim()) m.push("Symbol");
  if (!t.direction) m.push("Direction");
  if (!t.accountId) m.push("Account");
  if (!t.date) m.push("Date");
  const hasEntries = t.executions.some((e) => e.kind === "entry");
  if (!hasEntries && t.manualNet === null) m.push("Executions or net result");
  return m;
}

/**
 * Per-trade metrics.
 *  avgEntry  = Σ(entry price × qty) / Σ entry qty
 *  avgExit   = Σ(exit price × qty) / Σ exit qty
 *  gross     = (avgExit − avgEntry) × exitQty × pointValue          (long)
 *              (avgEntry − avgExit) × exitQty × pointValue          (short)
 *  totalFees = trade fees + Σ execution fees
 *  net       = gross − totalFees, or manualNet when no executions exist
 *  risk      = plannedRisk, else |avgEntry − stop| × entryQty × pointValue
 *  R         = net / risk  (only when risk > 0)
 */
export function tradeMetrics(t: Trade, settings?: Pick<Settings, "breakevenThreshold">): TradeMetrics {
  const entries = t.executions.filter((e) => e.kind === "entry");
  const exits = t.executions.filter((e) => e.kind === "exit");
  const entryQty = entries.reduce((s, e) => s + Math.abs(e.quantity), 0);
  const exitQty = exits.reduce((s, e) => s + Math.abs(e.quantity), 0);
  const avgEntry = entryQty > 0 ? entries.reduce((s, e) => s + e.price * Math.abs(e.quantity), 0) / entryQty : null;
  const avgExit = exitQty > 0 ? exits.reduce((s, e) => s + e.price * Math.abs(e.quantity), 0) / exitQty : null;
  const execFees = t.executions.reduce((s, e) => s + (Number.isFinite(e.fees) ? e.fees : 0), 0);
  const totalFees = (Number.isFinite(t.fees) ? t.fees : 0) + execFees;
  const pv = t.pointValue > 0 ? t.pointValue : 1;
  const missing = missingFields(t);

  let gross: number | null = null;
  let net: number | null = null;
  let closed = false;

  if (t.executions.length > 0) {
    if (avgEntry !== null && avgExit !== null && t.direction) {
      const sign = t.direction === "long" ? 1 : -1;
      gross = (avgExit - avgEntry) * Math.min(exitQty, entryQty) * pv * sign;
      net = gross - totalFees;
    }
    closed = entryQty > 0 && Math.abs(exitQty - entryQty) < EPS;
  } else if (t.manualNet !== null && Number.isFinite(t.manualNet)) {
    net = t.manualNet;
    gross = t.manualNet + totalFees;
    closed = true;
  }

  let risk: number | null = null;
  if (t.plannedRisk !== null && t.plannedRisk > 0) risk = t.plannedRisk;
  else if (t.stopPrice !== null && avgEntry !== null && entryQty > 0) {
    const r = Math.abs(avgEntry - t.stopPrice) * entryQty * pv;
    risk = r > EPS ? r : null;
  }

  const status: TradeStatus = t.isDraft || missing.length > 0 ? "draft" : closed ? "closed" : "open";
  const r = status === "closed" && net !== null && risk ? net / risk : null;
  const threshold = settings?.breakevenThreshold ?? 0;
  const result: TradeResult | null =
    status !== "closed" || net === null ? null : Math.abs(net) <= threshold ? "breakeven" : net > 0 ? "win" : "loss";

  const times = t.executions.map((e) => new Date(e.time).getTime()).filter((n) => Number.isFinite(n));
  const durationMinutes = closed && times.length >= 2 ? (Math.max(...times) - Math.min(...times)) / 60000 : null;
  const firstTime = times.length ? new Date(Math.min(...times)).toISOString() : null;

  return { status, entryQty, exitQty, avgEntry, avgExit, gross, totalFees, net, risk, r, result, missing, durationMinutes, firstTime };
}

export interface EnrichedTrade {
  trade: Trade;
  m: TradeMetrics;
}

export function enrich(trades: Trade[], settings?: Pick<Settings, "breakevenThreshold">): EnrichedTrade[] {
  return trades.map((trade) => ({ trade, m: tradeMetrics(trade, settings) }));
}

/** Chronological order: date, then first execution time, then trade number. */
export function chronological(list: EnrichedTrade[]): EnrichedTrade[] {
  return [...list].sort((a, b) => {
    if (a.trade.date !== b.trade.date) return a.trade.date < b.trade.date ? -1 : 1;
    const at = a.m.firstTime ?? "";
    const bt = b.m.firstTime ?? "";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.trade.number - b.trade.number;
  });
}

export function closedOnly(list: EnrichedTrade[]) {
  return list.filter((x) => x.m.status === "closed" && x.m.net !== null);
}

export interface EquityPoint {
  index: number;
  date: ISODate;
  tradeId: string;
  net: number;
  equity: number;
  peak: number;
  drawdown: number; // ≤ 0, currency
}

/** Cumulative net equity starting at `start` (0 for P&L curves, starting balance for account curves). */
export function equityCurve(list: EnrichedTrade[], start = 0): EquityPoint[] {
  let eq = start;
  let peak = start;
  return chronological(closedOnly(list)).map((x, i) => {
    eq += x.m.net as number;
    peak = Math.max(peak, eq);
    return { index: i + 1, date: x.trade.date, tradeId: x.trade.id, net: x.m.net as number, equity: eq, peak, drawdown: eq - peak };
  });
}

/**
 * Maximum drawdown = largest peak-to-trough decline of cumulative equity.
 * Percent is relative to the peak equity at that point (start + cumulative P&L).
 * When start is 0, percent is not meaningful and is returned as null.
 */
export function maxDrawdown(curve: EquityPoint[], start = 0): { amount: number; pct: number | null } {
  let worst = 0;
  let worstPct: number | null = null;
  for (const p of curve) {
    if (p.drawdown < worst) {
      worst = p.drawdown;
      worstPct = p.peak > 0 && start > 0 ? (p.drawdown / p.peak) * 100 : null;
    }
  }
  return { amount: worst, pct: worstPct };
}

export interface Stats {
  total: number; // all records in scope
  closed: number;
  excludedDrafts: number;
  excludedOpen: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null; // wins / (wins + losses)
  grossProfit: number; // Σ net of winning trades
  grossLoss: number; // Σ |net| of losing trades
  profitFactor: number | null; // grossProfit / grossLoss; null when no losses
  net: number;
  avgWin: number | null;
  avgLoss: number | null; // negative
  avgR: number | null;
  rCoverage: number; // closed trades with a defined R
  expectancy: number | null; // net / closed
  maxDD: { amount: number; pct: number | null };
  fees: number;
  avgGrade: number | null;
  largestWin: number | null;
  largestLoss: number | null;
}

export function computeStats(list: EnrichedTrade[], start = 0): Stats {
  const closed = closedOnly(list);
  const wins = closed.filter((x) => x.m.result === "win");
  const losses = closed.filter((x) => x.m.result === "loss");
  const be = closed.filter((x) => x.m.result === "breakeven");
  const grossProfit = wins.reduce((s, x) => s + (x.m.net as number), 0);
  const grossLoss = Math.abs(losses.reduce((s, x) => s + (x.m.net as number), 0));
  const net = closed.reduce((s, x) => s + (x.m.net as number), 0);
  const rs = closed.map((x) => x.m.r).filter((r): r is number => r !== null);
  const grades = closed.map((x) => x.trade.grade).filter(Boolean) as NonNullable<Trade["grade"]>[];
  const gp: Record<string, number> = { "A+": 4.3, A: 4, B: 3, C: 2, D: 1, F: 0 };
  const curve = equityCurve(list, start);
  const nets = closed.map((x) => x.m.net as number);
  return {
    total: list.length,
    closed: closed.length,
    excludedDrafts: list.filter((x) => x.m.status === "draft").length,
    excludedOpen: list.filter((x) => x.m.status === "open").length,
    wins: wins.length,
    losses: losses.length,
    breakeven: be.length,
    winRate: wins.length + losses.length > 0 ? wins.length / (wins.length + losses.length) : null,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    net,
    avgWin: wins.length ? grossProfit / wins.length : null,
    avgLoss: losses.length ? -grossLoss / losses.length : null,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    rCoverage: rs.length,
    expectancy: closed.length ? net / closed.length : null,
    maxDD: maxDrawdown(curve, start),
    fees: closed.reduce((s, x) => s + x.m.totalFees, 0),
    avgGrade: grades.length ? grades.reduce((s, g) => s + gp[g], 0) / grades.length : null,
    largestWin: nets.length ? Math.max(...nets) : null,
    largestLoss: nets.length ? Math.min(...nets) : null,
  };
}

/** Group closed trades and compute stats for each group. Trades may belong to multiple groups (e.g. emotions). */
export function groupStats(list: EnrichedTrade[], key: (x: EnrichedTrade) => string | string[] | null): { key: string; stats: Stats }[] {
  const groups = new Map<string, EnrichedTrade[]>();
  for (const x of closedOnly(list)) {
    const k = key(x);
    const ks = k === null ? [] : Array.isArray(k) ? k : [k];
    for (const g of ks) {
      if (!g) continue;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(x);
    }
  }
  return [...groups.entries()].map(([k, v]) => ({ key: k, stats: computeStats(v) })).sort((a, b) => b.stats.closed - a.stats.closed);
}

export function dailyPnl(list: EnrichedTrade[]): Map<ISODate, { net: number; count: number }> {
  const map = new Map<ISODate, { net: number; count: number }>();
  for (const x of closedOnly(list)) {
    const d = map.get(x.trade.date) ?? { net: 0, count: 0 };
    d.net += x.m.net as number;
    d.count += 1;
    map.set(x.trade.date, d);
  }
  return map;
}

export function streaks(list: EnrichedTrade[]) {
  const seq = chronological(closedOnly(list)).map((x) => x.m.result);
  let maxW = 0, maxL = 0, cw = 0, cl = 0;
  const lossRuns: number[] = [];
  const winRuns: number[] = [];
  for (const r of seq) {
    if (r === "win") { cw++; if (cl) lossRuns.push(cl); cl = 0; }
    else if (r === "loss") { cl++; if (cw) winRuns.push(cw); cw = 0; }
    else { if (cw) winRuns.push(cw); if (cl) lossRuns.push(cl); cw = 0; cl = 0; }
    maxW = Math.max(maxW, cw); maxL = Math.max(maxL, cl);
  }
  if (cw) winRuns.push(cw);
  if (cl) lossRuns.push(cl);
  const current = seq.length ? { kind: seq[seq.length - 1], length: seq[seq.length - 1] === "win" ? cw : seq[seq.length - 1] === "loss" ? cl : 0 } : null;
  return { maxWin: maxW, maxLoss: maxL, winRuns, lossRuns, current };
}

// ---------------------------------------------------------------------------
// Discipline score
// ---------------------------------------------------------------------------

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number; // 0-1
  value: number | null; // 0-100
  detail: string;
}

export interface DisciplineScore {
  score: number | null;
  components: ScoreComponent[];
  sample: number;
}

const reflectionComplete = (t: Trade) =>
  !!(t.reflection.wentWell.trim() && t.reflection.improve.trim() && t.reflection.learned.trim() && t.reflection.followedPlan);

/**
 * Discipline score (0–100) — a process measure, never an outcome measure.
 *   Journal completion        25%  non-draft trades / all trades
 *   Plan adherence            25%  (yes = 1, partial = 0.5, no = 0) averaged over trades that answered
 *   Reflection completion     20%  trades with all four reflection answers / all trades
 *   Documentation consistency 15%  trading days with a completed post-session daily entry / trading days
 *   Emotional awareness       15%  trades with ≥ 1 recorded emotion / all trades
 * Components with no data are excluded and remaining weights are re-normalised.
 * Profit and loss are never used.
 */
export function disciplineScore(trades: Trade[], journals: DailyJournal[]): DisciplineScore {
  const n = trades.length;
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
  const answered = trades.filter((t) => t.reflection.followedPlan);
  const adherence = answered.length
    ? (answered.reduce((s, t) => s + (t.reflection.followedPlan === "yes" ? 1 : t.reflection.followedPlan === "partial" ? 0.5 : 0), 0) / answered.length) * 100
    : null;
  const tradingDays = [...new Set(trades.map((t) => t.date))];
  const jByDate = new Map(journals.map((j) => [j.date, j]));
  const documentedDays = tradingDays.filter((d) => {
    const j = jByDate.get(d);
    return !!j && !!(j.post.happened.trim() || j.post.learned.trim());
  }).length;

  const components: ScoreComponent[] = [
    { key: "completion", label: "Journal completion", weight: 0.25, value: pct(trades.filter((t) => !t.isDraft && missingFields(t).length === 0).length, n), detail: "Trades saved with every required field, not left as drafts." },
    { key: "adherence", label: "Plan adherence (self-reported)", weight: 0.25, value: adherence, detail: `Average of your “Did I follow my written plan?” answers across ${answered.length} trades.` },
    { key: "reflection", label: "Reflection completion", weight: 0.2, value: pct(trades.filter(reflectionComplete).length, n), detail: "Trades where all four reflection prompts are answered." },
    { key: "consistency", label: "Documentation consistency", weight: 0.15, value: pct(documentedDays, tradingDays.length), detail: `${documentedDays} of ${tradingDays.length} trading days have a post-session daily journal entry.` },
    { key: "awareness", label: "Emotional awareness", weight: 0.15, value: pct(trades.filter((t) => t.emotions.length > 0).length, n), detail: "Trades with at least one recorded emotional state." },
  ];
  const usable = components.filter((c) => c.value !== null);
  const wsum = usable.reduce((s, c) => s + c.weight, 0);
  const score = n === 0 || wsum === 0 ? null : usable.reduce((s, c) => s + (c.value as number) * c.weight, 0) / wsum;
  return { score, components, sample: n };
}

/**
 * Performance score (0–100): 50% discipline (process) + 50% statistical quality.
 * Statistical quality averages four normalised parts:
 *   profit factor   min(PF / 2, 1) × 100        (PF 2.0 or better scores 100)
 *   win rate        win rate × 100
 *   average R       clamp((avgR + 1) / 2, 0, 1) × 100   (−1R → 0, +1R → 100)
 *   drawdown control  100 − min(|maxDD| / grossProfit, 1) × 100
 * Requires at least `minSample` closed trades.
 */
export function performanceScore(stats: Stats, discipline: DisciplineScore, minSample = 10) {
  const parts: ScoreComponent[] = [];
  const enough = stats.closed >= minSample;
  const pf = stats.profitFactor === null ? (stats.grossProfit > 0 ? 100 : null) : Math.min(stats.profitFactor / 2, 1) * 100;
  parts.push({ key: "pf", label: "Profit factor", weight: 0.25, value: enough ? pf : null, detail: "Gross profit ÷ gross loss; 2.0 or better scores 100." });
  parts.push({ key: "wr", label: "Win rate", weight: 0.25, value: enough && stats.winRate !== null ? stats.winRate * 100 : null, detail: "Wins ÷ (wins + losses). Break-even trades are excluded." });
  parts.push({ key: "r", label: "Average R", weight: 0.25, value: enough && stats.avgR !== null ? Math.max(0, Math.min(1, (stats.avgR + 1) / 2)) * 100 : null, detail: `Mapped so −1R scores 0 and +1R scores 100. Based on ${stats.rCoverage} trades with recorded risk.` });
  parts.push({ key: "dd", label: "Drawdown control", weight: 0.25, value: enough && stats.grossProfit > 0 ? 100 - Math.min(Math.abs(stats.maxDD.amount) / stats.grossProfit, 1) * 100 : null, detail: "Maximum drawdown relative to gross profit; smaller is better." });
  const usable = parts.filter((p) => p.value !== null);
  const quality = usable.length ? usable.reduce((s, p) => s + (p.value as number), 0) / usable.length : null;
  const total = quality !== null && discipline.score !== null ? quality * 0.5 + discipline.score * 0.5 : null;
  return { total, quality, parts, enough };
}

// ---------------------------------------------------------------------------
// Frequency helpers (psychology)
// ---------------------------------------------------------------------------

export function frequency<T extends string>(values: T[]): { key: T; count: number }[] {
  const m = new Map<T, number>();
  values.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function emotionalBalance(trades: Trade[]): number | null {
  const all = trades.flatMap((t) => t.emotions);
  if (!all.length) return null;
  return all.filter((e: Emotion) => POSITIVE_EMOTIONS.includes(e)).length / all.length;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
