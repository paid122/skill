/**
 * Weekly and monthly recaps for shareable recap cards.
 * Only closed trades with a result count. Days are the trade's journal date; weeks start on Monday.
 * `value` is the currency net, or the R-multiple when amounts are hidden.
 */
import type { EnrichedTrade } from "./calc";
import { parseISODate, toISODate } from "./util";

export type RecapKind = "week" | "month";

export interface RecapDay { date: string; value: number; trades: number }

export interface Recap {
  kind: RecapKind;
  /** ISO date of the period's first day (Monday for weeks, the 1st for months). */
  start: string;
  end: string;
  total: number;
  trades: number;
  wins: number;
  /** wins ÷ trades, 0–1 (null with no trades) */
  winRate: number | null;
  /** days with at least one trade, in date order */
  days: RecapDay[];
  greenDays: number;
  best: RecapDay | null;
  /** running total after each trading day, starting at 0 */
  curve: { date: string; value: number }[];
}

export function weekStart(date: string): string {
  const d = parseISODate(date);
  const back = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - back);
  return toISODate(d);
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function periodEnd(kind: RecapKind, start: string): string {
  const d = parseISODate(start);
  if (kind === "week") d.setDate(d.getDate() + 6);
  else { d.setMonth(d.getMonth() + 1); d.setDate(0); }
  return toISODate(d);
}

const resultOf = (x: EnrichedTrade, amounts: boolean) => (amounts ? x.m.net : x.m.r);

/** Periods that have at least one closed trade with a result, newest first. */
export function recapPeriods(all: EnrichedTrade[], kind: RecapKind, amounts: boolean): string[] {
  const set = new Set<string>();
  for (const x of all) {
    if (x.m.status !== "closed" || resultOf(x, amounts) === null || !x.trade.date) continue;
    set.add(kind === "week" ? weekStart(x.trade.date) : monthStart(x.trade.date));
  }
  return Array.from(set).sort().reverse();
}

export function buildRecap(all: EnrichedTrade[], kind: RecapKind, start: string, amounts: boolean): Recap {
  const end = periodEnd(kind, start);
  const byDay = new Map<string, RecapDay>();
  let trades = 0, wins = 0;
  for (const x of all) {
    const v = resultOf(x, amounts);
    const d = x.trade.date;
    if (x.m.status !== "closed" || v === null || !d || d < start || d > end) continue;
    trades++;
    if (v > 0) wins++;
    const day = byDay.get(d) ?? { date: d, value: 0, trades: 0 };
    day.value += v;
    day.trades++;
    byDay.set(d, day);
  }
  const days = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  const curve = [{ date: start, value: 0 }, ...days.map((d) => ({ date: d.date, value: (run += d.value) }))];
  const best = days.reduce<RecapDay | null>((b, d) => (!b || d.value > b.value ? d : b), null);
  return {
    kind, start, end,
    total: run,
    trades, wins,
    winRate: trades ? wins / trades : null,
    days,
    greenDays: days.filter((d) => d.value > 0).length,
    best,
    curve,
  };
}

/** Monday–Friday of the week, plus any weekend day that has trades, with that day's result (or null). */
export function weekRows(r: Recap): { date: string; label: string; day: RecapDay | null }[] {
  const out: { date: string; label: string; day: RecapDay | null }[] = [];
  const d = parseISODate(r.start);
  for (let i = 0; i < 7; i++) {
    const iso = toISODate(d);
    const day = r.days.find((x) => x.date === iso) ?? null;
    if (i < 5 || day) out.push({ date: iso, label: d.toLocaleDateString("en-US", { weekday: "short" }), day });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
