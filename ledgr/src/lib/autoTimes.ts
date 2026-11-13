"use client";
/**
 * Fill in entry and exit times for trades logged without them (e.g. Quick Log with prices only).
 * Uses that day's real price data: the entry is placed where the price first traded through the
 * entry price, the exit where it later traded through the exit price. Times found this way are
 * marked `estimated` and noted in the trade's activity; editing a time by hand replaces it.
 */
import { patchTrade } from "./actions";
import { dayWindow, guessSource, locateByPrice, timesUnknown, type Bar } from "./candles";
import { getState } from "./store";
import type { Trade } from "./types";

const inFlight = new Set<string>();

export async function estimateTimes(t: Trade): Promise<Trade["executions"] | null> {
  const times = t.executions.map((e) => e.time);
  if (!t.symbol || !timesUnknown(times)) return null;
  const entry = t.executions.find((e) => e.kind === "entry");
  const exit = [...t.executions].reverse().find((e) => e.kind === "exit");
  if (!entry || !exit) return null;
  const win = dayWindow(times[0]);
  const { provider, dataSymbol } = guessSource(t);
  const q = new URLSearchParams({ provider, symbol: dataSymbol, interval: win.interval, from: String(win.from), to: String(win.to) });
  const res = await fetch(`/api/candles?${q}`).then((r) => r.json()).catch(() => null) as { bars?: Bar[] } | null;
  const bars = res?.bars;
  if (!bars?.length) return null;
  const hit = locateByPrice(bars, entry.price, exit.price);
  if (!hit) return null;
  const iv = 900e3;
  const entryT = bars[hit.entry].t + iv * 0.25;
  const exitT = Math.max(bars[hit.exit].t + iv * 0.75, entryT + 60e3);
  return t.executions.map((e) => ({ ...e, time: new Date(e.kind === "entry" ? entryT : exitT).toISOString(), estimated: true }));
}

/** Estimate and save, once per trade at a time. Returns true when times were filled in. */
export async function fillTimes(tradeId: string): Promise<boolean> {
  if (inFlight.has(tradeId)) return false;
  inFlight.add(tradeId);
  try {
    const t = getState().trades.find((x) => x.id === tradeId);
    if (!t) return false;
    const executions = await estimateTimes(t);
    if (!executions) return false;
    const cur = getState().trades.find((x) => x.id === tradeId);
    if (!cur || !timesUnknown(cur.executions.map((e) => e.time))) return false; // changed meanwhile
    patchTrade(tradeId, { executions }, "Times estimated from price data");
    return true;
  } finally {
    inFlight.delete(tradeId);
  }
}
