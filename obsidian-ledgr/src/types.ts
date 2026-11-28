/**
 * The LEDGR API's answers, as implemented in the LEDGR app (src/app/api/v1/* in the LEDGR repo).
 * Money values are in the journal's currency; winRate is a fraction (0.62 = 62%).
 */

export interface MeResponse {
  key: { id: string; name: string };
  plan: { name: string; until: string | null }; // until: null for LEDGR's owner (never ends)
  journal: { displayName: string | null; currency: string; accounts: number; trades: number; syncedAt: string } | null;
}

export interface DayPnl { date: string; net: number | null; trades: number }

export interface StatsResponse {
  trades: number;
  closed: number;
  open: number;
  drafts: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  profitFactor: number | null;
  net: number | null;
  grossProfit: number | null;
  grossLoss: number | null;
  fees: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  largestWin: number | null;
  largestLoss: number | null;
  expectancy: number | null;
  avgR: number | null;
  maxDrawdown: number | null;
  streaks: { maxWin: number; maxLoss: number; current: { kind: string | null; length: number } | null };
  tradingDays: number;
  days: DayPnl[];
  syncedAt: string;
}

export interface AccountInfo {
  id: string;
  name: string;
  type: string;
  status: "active" | "paused" | "archived";
  currency: string;
  startingBalance: number;
  balance: number;
  netPnl: number;
  returnPct: number | null;
  maxDrawdown: number;
  tradingDays: number;
  closedTrades: number;
  propFirm: string | null;
  accountSize: number | null;
  propStage: "evaluation" | "funded" | null;
}

export interface AccountsResponse { accounts: AccountInfo[]; syncedAt: string }

/** Everything the command center shows, fetched together. */
export interface Dashboard {
  me: MeResponse;
  stats: StatsResponse; // all time
  stats30: StatsResponse; // last 30 days
  accounts: AccountInfo[];
}

/** The last good dashboard, saved in the plugin's data so the view works offline. Never contains the API key. */
export interface Snapshot { data: Dashboard; fetchedAt: number }
