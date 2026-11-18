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
    state,
  };
}
