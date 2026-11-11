"use client";
import { useMemo, useSyncExternalStore } from "react";
import { enrich, type EnrichedTrade } from "./calc";
import { useLedgr } from "./store";
import type { ISODate, LedgrState, Notification } from "./types";
import { addDays, inRange, today, weekStart } from "./util";

// ---------------------------------------------------------------------------
// UI preferences (account scope, date range) — persisted per browser
// ---------------------------------------------------------------------------

export type RangePreset = "7d" | "30d" | "90d" | "ytd" | "all" | "custom";
export interface UIPrefs {
  accountId: string; // "all" or account id
  range: RangePreset;
  from: ISODate;
  to: ISODate;
}
const UI_KEY = "ledgr.ui";
const defaultUI: UIPrefs = { accountId: "all", range: "all", from: "", to: "" };
let ui: UIPrefs = defaultUI;
let uiLoaded = false;
const uiListeners = new Set<() => void>();

function loadUI() {
  if (uiLoaded || typeof window === "undefined") return;
  uiLoaded = true;
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) ui = { ...defaultUI, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
}

export function setUI(patch: Partial<UIPrefs>) {
  ui = { ...ui, ...patch };
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch {
    /* ignore */
  }
  uiListeners.forEach((l) => l());
}

export function useUI(): UIPrefs {
  return useSyncExternalStore(
    (l) => { uiListeners.add(l); return () => uiListeners.delete(l); },
    () => { loadUI(); return ui; },
    () => defaultUI,
  );
}

export function rangeBounds(p: UIPrefs): { from: ISODate | ""; to: ISODate | "" } {
  const t = today();
  switch (p.range) {
    case "7d": return { from: addDays(t, -6), to: t };
    case "30d": return { from: addDays(t, -29), to: t };
    case "90d": return { from: addDays(t, -89), to: t };
    case "ytd": return { from: `${t.slice(0, 4)}-01-01`, to: t };
    case "custom": return { from: p.from, to: p.to };
    default: return { from: "", to: "" };
  }
}

/** Previous period of equal length, for KPI comparisons. Null when range is "all". */
export function previousBounds(p: UIPrefs): { from: ISODate; to: ISODate } | null {
  const b = rangeBounds(p);
  if (!b.from || !b.to) return null;
  const len = Math.round((new Date(b.to).getTime() - new Date(b.from).getTime()) / 86400000) + 1;
  return { from: addDays(b.from, -len), to: addDays(b.from, -1) };
}

// ---------------------------------------------------------------------------
// Data selectors
// ---------------------------------------------------------------------------

export function useEnriched(): EnrichedTrade[] {
  const trades = useLedgr((s) => s.trades);
  const threshold = useLedgr((s) => s.settings.breakevenThreshold);
  return useMemo(() => enrich(trades, { breakevenThreshold: threshold }), [trades, threshold]);
}

/** Trades in the globally selected account and date range. */
export function useScoped(opts: { ignoreRange?: boolean } = {}) {
  const all = useEnriched();
  const prefs = useUI();
  return useMemo(() => {
    const b = opts.ignoreRange ? { from: "" as const, to: "" as const } : rangeBounds(prefs);
    const inAcct = (x: EnrichedTrade) => prefs.accountId === "all" || x.trade.accountId === prefs.accountId;
    const current = all.filter((x) => inAcct(x) && inRange(x.trade.date, b.from, b.to));
    const pb = opts.ignoreRange ? null : previousBounds(prefs);
    const previous = pb ? all.filter((x) => inAcct(x) && inRange(x.trade.date, pb.from, pb.to)) : null;
    return { current, previous, bounds: b, prefs };
  }, [all, prefs, opts.ignoreRange]);
}

export function useAccount(id: string | null | undefined) {
  return useLedgr((s) => s.accounts.find((a) => a.id === id) ?? null);
}

export function useCurrency() {
  const prefs = useUI();
  const accounts = useLedgr((s) => s.accounts);
  const base = useLedgr((s) => s.settings.baseCurrency);
  return prefs.accountId === "all" ? base : accounts.find((a) => a.id === prefs.accountId)?.currency ?? base;
}

// ---------------------------------------------------------------------------
// Notifications — derived from records, never fabricated
// ---------------------------------------------------------------------------

export function deriveNotifications(s: LedgrState): Notification[] {
  const t = today();
  const out: Notification[] = [];
  const drafts = s.trades.filter((x) => x.isDraft);
  if (drafts.length) out.push({ id: `drafts-${drafts.length}-${t}`, title: `${drafts.length} draft trade${drafts.length > 1 ? "s" : ""} to complete`, body: "Finish the essential fields so they count in your statistics.", href: "/journal?result=draft" });
  const todaysTrades = s.trades.filter((x) => x.date === t && !x.isDraft);
  const dj = s.dailyJournals.find((j) => j.date === t);
  if (todaysTrades.length && !(dj && (dj.post.happened || dj.post.learned))) out.push({ id: `post-${t}`, title: "Today's post-session entry is open", body: `You logged ${todaysTrades.length} trade${todaysTrades.length > 1 ? "s" : ""} today. Record what you learned.`, href: "/daily-journal" });
  const noReflection = s.trades.filter((x) => !x.isDraft && !x.reflection.learned.trim()).length;
  if (noReflection >= 3) out.push({ id: `refl-${noReflection}`, title: `${noReflection} trades without a lesson recorded`, body: "Add “What did I learn?” to complete their reflections.", href: "/journal" });
  const ws = weekStart(t);
  const lastWeek = addDays(ws, -7);
  const hadTradesLastWeek = s.trades.some((x) => x.date >= lastWeek && x.date < ws);
  if (hadTradesLastWeek && !s.weeklyJournals.some((w) => w.weekStart === lastWeek)) out.push({ id: `weekly-${lastWeek}`, title: "Last week's review is ready to write", body: "Your statistics for the week are prepared.", href: `/weekly-review?week=${lastWeek}` });
  if (!s.accounts.length) out.push({ id: "no-accounts", title: "Create your first account", body: "Trades are recorded against a simulated account.", href: "/accounts" });
  return out.filter((n) => !s.dismissedNotifications.includes(n.id));
}

export function useNotifications() {
  const s = useLedgr((x) => x);
  return useMemo(() => deriveNotifications(s), [s]);
}
