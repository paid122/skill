import { chronological, closedOnly, dailyPnl, type EnrichedTrade } from "./calc";
import type { Account, BalanceAdjustment } from "./types";

export interface LedgerEvent {
  id: string;
  date: string;
  kind: "trade" | "adjustment" | "start";
  label: string;
  amount: number;
  balance: number;
  refId?: string;
}

/**
 * Account ledger: starting balance, then closed-trade nets and virtual adjustments in date order.
 * Current balance = starting balance + Σ adjustments + Σ closed trade nets.
 */
export function accountLedger(account: Account, trades: EnrichedTrade[], adjustments: BalanceAdjustment[]): LedgerEvent[] {
  const own = chronological(closedOnly(trades.filter((x) => x.trade.accountId === account.id)));
  const events: Omit<LedgerEvent, "balance">[] = [
    ...own.map((x) => ({ id: x.trade.id, date: x.trade.date, kind: "trade" as const, label: `#${x.trade.number} ${x.trade.symbol} ${x.trade.direction ?? ""}`.trim(), amount: x.m.net as number, refId: x.trade.id })),
    ...adjustments.filter((a) => a.accountId === account.id).map((a) => ({ id: a.id, date: a.date, kind: "adjustment" as const, label: a.note || (a.amount > 0 ? "Virtual deposit" : "Virtual withdrawal"), amount: a.amount })),
  ];
  // Stable sort by date, adjustments before trades on the same day.
  events.sort((a, b) => (a.date === b.date ? (a.kind === b.kind ? 0 : a.kind === "adjustment" ? -1 : 1) : a.date < b.date ? -1 : 1));
  let bal = account.startingBalance;
  const out: LedgerEvent[] = [{ id: `${account.id}-start`, date: account.createdAt.slice(0, 10), kind: "start", label: "Virtual starting balance", amount: account.startingBalance, balance: bal }];
  for (const e of events) { bal += e.amount; out.push({ ...e, balance: bal }); }
  return out;
}

export function accountSummary(account: Account, trades: EnrichedTrade[], adjustments: BalanceAdjustment[]) {
  const ledger = accountLedger(account, trades, adjustments);
  const own = trades.filter((x) => x.trade.accountId === account.id);
  const tradeNet = ledger.filter((e) => e.kind === "trade").reduce((s, e) => s + e.amount, 0);
  const adj = ledger.filter((e) => e.kind === "adjustment").reduce((s, e) => s + e.amount, 0);
  const balance = account.startingBalance + adj + tradeNet;
  let peak = account.startingBalance, maxDD = 0;
  for (const e of ledger) { peak = Math.max(peak, e.balance); maxDD = Math.min(maxDD, e.balance - peak); }
  const days = dailyPnl(own);
  const worstDay = days.size ? Math.min(...[...days.values()].map((d) => d.net)) : null;
  return {
    ledger, balance, tradeNet, adjustments: adj,
    returnPct: account.startingBalance > 0 ? (tradeNet / account.startingBalance) * 100 : null,
    peak, currentDD: balance - peak, maxDD, worstDay, tradingDays: days.size,
    closedCount: ledger.filter((e) => e.kind === "trade").length,
  };
}
