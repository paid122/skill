import { apiJson, journalFor, keyAuth, NO_JOURNAL, pickTrades, preflight } from "@/lib/apiServer";
import { computeStats, dailyPnl, streaks } from "@/lib/calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/** GET /api/v1/stats: win rate, P&L, profit factor, R, drawdown and daily P&L. Same filters as /trades. */
export async function GET(req: Request) {
  const a = await keyAuth(req);
  if (a instanceof Response) return a;
  const j = await journalFor(a.sb, a.key.user_id);
  if (!j) return NO_JOURNAL();
  const { list, error } = pickTrades(j, new URL(req.url));
  if (error) return error;
  const s = computeStats(list);
  const days = [...dailyPnl(list).entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, d]) => ({ date, net: r2(d.net), trades: d.count }));
  return apiJson({
    trades: s.total, closed: s.closed, open: s.excludedOpen, drafts: s.excludedDrafts,
    wins: s.wins, losses: s.losses, breakeven: s.breakeven,
    winRate: s.winRate, profitFactor: r2(s.profitFactor), net: r2(s.net), grossProfit: r2(s.grossProfit), grossLoss: r2(s.grossLoss),
    fees: r2(s.fees), avgWin: r2(s.avgWin), avgLoss: r2(s.avgLoss), largestWin: r2(s.largestWin), largestLoss: r2(s.largestLoss),
    expectancy: r2(s.expectancy), avgR: r2(s.avgR), maxDrawdown: r2(s.maxDD.amount),
    streaks: streaks(list), tradingDays: days.length, days,
    syncedAt: j.syncedAt,
  });
}

export const OPTIONS = preflight;
