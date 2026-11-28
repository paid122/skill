/**
 * Trade sync for the command center and the notes. The first sync (and a manual SYNC, and once a day) downloads
 * every trade. After that:
 *   - LEDGR with ?updatedSince (current): only trades created or edited since the last sync, plus the list of all
 *     trade ids, so edits to old trades and deletions come through straight away;
 *   - older LEDGR ignores updatedSince and sends everything, which is then used as a full sync.
 * Edits saved to LEDGR's cloud long after they were made (e.g. offline) arrive with the daily full sync.
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

export const EDIT_MARGIN_MS = 10 * 60_000; // re-read a little before the last sync (device clocks differ)

/** Every trade matching the query (all, from a date, or changed since a time), following LEDGR's paging. */
export async function fetchTrades(get: GetJson, q: { from?: string; updatedSince?: string } = {}): Promise<{ trades: ApiTrade[]; ids: string[] | null }> {
  const out: ApiTrade[] = [];
  let ids: string[] | null = null;
  const extra = (q.from ? `&from=${q.from}` : "") + (q.updatedSince ? `&updatedSince=${encodeURIComponent(q.updatedSince)}` : "");
  for (let offset = 0; offset < 100 * PAGE; offset += PAGE) {
    const page = await get<{ trades: ApiTrade[]; total: number; ids?: string[] }>(`/trades?limit=${PAGE}&offset=${offset}${extra}`);
    if (offset === 0 && Array.isArray(page.ids)) ids = page.ids;
    out.push(...page.trades);
    if (page.trades.length < PAGE || out.length >= page.total) break;
  }
  return { trades: out, ids };
}

/** The cache after fetching changed trades: drop trades no longer in LEDGR, replace or add the changed ones. */
export function mergeChanged(cached: ApiTrade[], changed: ApiTrade[], ids: string[]): ApiTrade[] {
  const keep = new Set(ids), fresh = new Map(changed.map((t) => [t.id, t]));
  return [...cached.filter((t) => keep.has(t.id) && !fresh.has(t.id)), ...changed];
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
    const { trades } = await fetchTrades(get);
    return { trades, lastSync: now, lastFull: now, syncedDay: today };
  }
  const since = new Date(cache.lastSync - EDIT_MARGIN_MS).toISOString();
  const changed = await fetchTrades(get, { updatedSince: since });
  if (changed.ids) return { trades: mergeChanged(cache.trades, changed.trades, changed.ids), lastSync: now, lastFull: cache.lastFull, syncedDay: today };
  // Older LEDGR ignores updatedSince and sends every trade: that is the complete journal.
  return { trades: changed.trades, lastSync: now, lastFull: now, syncedDay: today };
}
