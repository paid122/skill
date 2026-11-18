/**
 * Where a funded or evaluation account stands against its rules, from the journal:
 * the trailing max-loss floor, room left, today's loss against the daily limit, and progress to target.
 *
 * Estimates only: the floor trails the highest end-of-day balance (or the highest balance, for
 * intraday trailing plans) and stops rising at the starting balance plus the firm's lock
 * ($100 for Apex and Lucid, $0 for Topstep and Take Profit Trader). The firm's dashboard is the official number.
 */
import type { EnrichedTrade } from "./calc";
import { dailyPnl } from "./calc";
import { PROP_FIRM_RULES } from "./propRules";
import type { Account } from "./types";
import { today } from "./util";

export interface PropStatus {
  start: number;
  balance: number;
  /** Balance at which the account fails (null when no max loss is set). */
  floor: number | null;
  roomLeft: number | null;
  target: number | null;
  /** 0–1 progress from start to target. */
  progress: number | null;
  todayNet: number;
  dailyLimit: number | null;
  /** Today's loss as a share of the daily limit, 0–1. */
  dailyUsed: number | null;
  tradingDays: number;
  /** Minimum trading days the rules ask for (evaluation), or null. */
  minDays: number | null;
  /** Biggest winning day, and its share of total profit (0–1) against the firm's consistency cap. */
  bestDay: number | null;
  consistencyShare: number | null;
  consistencyLimit: number | null;
  /** End-of-day balances, oldest first, starting with the starting balance (for the sparkline). */
  path: number[];
  state: "passed" | "breached" | "daily-limit" | "active";
}

export function propStatus(a: Account, trades: EnrichedTrade[], ledger: { date: string; balance: number }[], balance: number): PropStatus {
  const start = a.startingBalance;
  const dd = a.rules.maxDrawdown;
  const plan = PROP_FIRM_RULES[a.propFirm ?? ""]?.find((p) => p.name === a.propPlan);
  const intraday = plan?.trailing === "Intraday trailing";
  const t = today();
  // Highest balance the floor trails: end of each finished day (EOD), or every trade (intraday).
  let peak = start;
  if (intraday) for (const e of ledger) peak = Math.max(peak, e.balance);
  else {
    const eod = new Map<string, number>();
    for (const e of ledger) if (e.date < t) eod.set(e.date, e.balance);
    for (const b of eod.values()) peak = Math.max(peak, b);
  }
  const floor = dd ? Math.min(peak - dd, start + (plan?.floorLock ?? 100)) : null;
  const target = a.rules.profitTarget ? start + a.rules.profitTarget : null;
  const own = trades.filter((x) => x.trade.accountId === a.id);
  const days = dailyPnl(own);
  const todayNet = days.get(t)?.net ?? 0;
  const dl = a.rules.dailyLossLimit;
  // Consistency: the best day's share of total profit, against the plan's cap (when it applies to this stage).
  const best = [...days.values()].reduce((m, d) => Math.max(m, d.net), 0);
  const profit = balance - start;
  const limit = consistencyLimit(plan?.consistency, a.propStage ?? "evaluation");
  const eodPath = new Map<string, number>();
  for (const e of ledger) eodPath.set(e.date, e.balance);
  const state: PropStatus["state"] =
    floor !== null && balance <= floor ? "breached"
    : target !== null && balance >= target ? "passed"
    : dl && todayNet <= -dl ? "daily-limit"
    : "active";
  return {
    start, balance, floor,
    roomLeft: floor === null ? null : balance - floor,
    target,
    progress: target === null ? null : Math.max(0, Math.min(1, (balance - start) / (target - start))),
    todayNet,
    dailyLimit: dl,
    dailyUsed: dl ? Math.max(0, Math.min(1, -todayNet / dl)) : null,
    tradingDays: days.size,
    minDays: a.rules.minTradingDays ?? null,
    bestDay: best > 0 ? best : null,
    consistencyShare: best > 0 && profit > 0 ? Math.min(1, best / profit) : null,
    consistencyLimit: limit,
    path: [start, ...eodPath.values()],
    state,
  };
}

/** The cap a plan's consistency text sets, as a fraction ("40% (50% option)" → 0.4), for this stage. */
export function consistencyLimit(text: string | undefined, stage: string): number | null {
  if (!text) return null;
  if (stage === "evaluation" && /none to pass/i.test(text)) return null;
  const m = text.match(/(\d+(?:\.\d+)?)%/);
  return m ? Number(m[1]) / 100 : null;
}
