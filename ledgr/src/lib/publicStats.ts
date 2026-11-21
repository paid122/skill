/**
 * The stats a trader can choose to show on their public profile, worked out from their own journal.
 * Paper accounts and copied trades are left out (the same as "All accounts"), and net P&L is only
 * shared when they switch it on.
 */
import { closedOnly, computeStats, disciplineScore, type EnrichedTrade } from "./calc";
import type { StatKey } from "./community";
import type { Account, DailyJournal, WeeklyJournal } from "./types";
import { today } from "./util";
import { weeklyStreak } from "./weekly";

export const DEFAULT_SHOW: Record<StatKey, boolean> = { trades: true, winRate: true, avgR: true, profitFactor: false, discipline: true, weekStreak: true, bestR: false, net: false };

export function journalStats(all: EnrichedTrade[], accounts: Account[], daily: DailyJournal[], weeklies: WeeklyJournal[]): Record<StatKey, number | null> {
  const paper = new Set(accounts.filter((a) => a.type === "Paper").map((a) => a.id));
  const mine = all.filter((x) => !x.trade.copyOf && !paper.has(x.trade.accountId ?? ""));
  const st = computeStats(mine);
  const rs = closedOnly(mine).map((x) => x.m.r).filter((r): r is number => r !== null);
  return {
    trades: st.closed,
    winRate: st.winRate === null ? null : Math.round(st.winRate * 1000) / 10,
    avgR: st.avgR === null ? null : Math.round(st.avgR * 100) / 100,
    profitFactor: st.profitFactor === null ? null : Math.round(st.profitFactor * 100) / 100,
    discipline: (() => { const d = disciplineScore(mine.map((x) => x.trade), daily).score; return d === null ? null : Math.round(d); })(),
    weekStreak: weeklyStreak(weeklies, today()).current,
    bestR: rs.length ? Math.round(Math.max(...rs) * 100) / 100 : null,
    net: Math.round(st.net * 100) / 100,
  };
}

export function formatStat(k: StatKey, v: number | string | null | undefined, currency = "USD"): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  switch (k) {
    case "winRate": return `${n}%`;
    case "avgR": case "bestR": return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}R`;
    case "profitFactor": return n.toFixed(2);
    case "weekStreak": return `${n} week${n === 1 ? "" : "s"}`;
    case "net": return new Intl.NumberFormat("en-US", { style: "currency", currency, signDisplay: "always", maximumFractionDigits: 0 }).format(n);
    default: return String(n);
  }
}
