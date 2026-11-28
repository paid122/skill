/**
 * Trade sync for the command center. The first sync (and a manual SYNC, and once a day) downloads every trade;
 * after that only trades dated from the last sync onwards (?from=) are fetched and merged in by id.
 *
 * LEDGR's /trades filters by the trade's date, not by when it was edited, so an incremental sync re-reads a few
 * days back (OVERLAP_DAYS) and treats that window as complete (trades missing from it were deleted). Edits to
 * older trades show up on the next full sync.
 */
import type { ApiTrade } from "./logic";

export const PAGE = 500; // LEDGR's maximum page size
export const OVERLAP_DAYS = 3;
export const FULL_EVERY_MS = 24 * 3_600_000;

export interface TradeCache { trades: ApiTrade[]; lastSync: number; lastFull: number; syncedDay: string }
export const EMPTY_CACHE: TradeCache = { trades: [], lastSync: 0, lastFull: 0, syncedDay: "" };

export type GetJson = <T>(path: string) => Promise<T>;

const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Every trade from `from` onwards (or all), following LEDGR's paging. */
export async function fetchTrades(get: GetJson, from?: string): Promise<ApiTrade[]> {
  const out: ApiTrade[] = [];
  for (let offset = 0; offset < 100 * PAGE; offset += PAGE) {
    const q = `/trades?limit=${PAGE}&offset=${offset}${from ? `&from=${from}` : ""}`;
    const page = await get<{ trades: ApiTrade[]; total: number }>(q);
    out.push(...page.trades);
    if (page.trades.length < PAGE || out.length >= page.total) break;
  }
  return out;
}

/** The cache after an incremental fetch of trades dated `from` or later. */
export function mergeWindow(cached: ApiTrade[], fresh: ApiTrade[], from: string): ApiTrade[] {
  const keep = cached.filter((t) => t.date < from); // outside the window: unchanged
  return [...keep, ...fresh];
}

export function needsFull(c: TradeCache, now: number, force: boolean) {
  return force || !c.lastFull || !c.syncedDay || now - c.lastFull > FULL_EVERY_MS;
}

/** Runs one sync. today = YYYY-MM-DD (local), used for the next incremental window. */
export async function syncTrades(get: GetJson, cache: TradeCache, now: number, today: string, force = false): Promise<TradeCache> {
  if (needsFull(cache, now, force)) {
    const trades = await fetchTrades(get);
    return { trades, lastSync: now, lastFull: now, syncedDay: today };
  }
  const from = addDays(cache.syncedDay < today ? cache.syncedDay : today, -OVERLAP_DAYS);
  const fresh = await fetchTrades(get, from);
  return { trades: mergeWindow(cache.trades, fresh, from), lastSync: now, lastFull: cache.lastFull, syncedDay: today };
}
