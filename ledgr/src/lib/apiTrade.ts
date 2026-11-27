/**
 * The LEDGR API's trade formats (shared by the server and the app):
 *  - parseApiTrade: checks a trade sent to POST /api/v1/trades and turns it into a clean ApiTradeInput
 *  - apiTradeToTrade: what the app adds to the journal from an inbox row
 *  - publicTrade / publicAccount: what GET endpoints return (a stable shape, not LEDGR's internal one)
 */
import { accountSummary } from "./accounts";
import type { EnrichedTrade } from "./calc";
import { cleanSymbol, defaultPointValue } from "./csvImport";
import { blankTrade } from "./defaults";
import type { Account, BalanceAdjustment, Direction, ExecutionKind, Market, Strategy, Trade } from "./types";
import { nowISO, uid } from "./util";

const MARKETS: Market[] = ["Forex", "Futures", "Stocks", "Crypto", "Indices", "Options", "Commodities", "Other"];

export interface ApiExecution { kind: ExecutionKind; price: number; quantity: number; time: string; fees: number }
export interface ApiTradeInput {
  symbol: string;
  market: Market;
  direction: Direction;
  accountId: string | null;
  executions: ApiExecution[];
  pointValue: number;
  pnl: number | null;
  fees: number;
  stopPrice: number | null;
  targetPrice: number | null;
  setup: string;
  notes: string;
  tags: string[];
  externalId: string | null;
}

type Body = Record<string, unknown>;
const num = (v: unknown, field: string, opts: { min?: number; positive?: boolean } = {}): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`${field} must be a number.`);
  if (opts.positive && n <= 0) throw new Error(`${field} must be greater than zero.`);
  if (opts.min !== undefined && n < opts.min) throw new Error(`${field} cannot be below ${opts.min}.`);
  return n;
};
const time = (v: unknown, field: string): string | null => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : String(v));
  if (Number.isNaN(d.getTime())) throw new Error(`${field} must be a date and time, e.g. 2026-11-27T14:30:00Z.`);
  return d.toISOString();
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Checks one trade from the API. Throws an Error with a message meant for the developer. */
export function parseApiTrade(b: Body, accounts: Pick<Account, "id" | "name" | "status">[]): ApiTradeInput {
  if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error("Send one trade as a JSON object.");
  const rawSymbol = text(b.symbol, 40);
  if (!rawSymbol) throw new Error("symbol is required, e.g. \"NQ\" or \"EURUSD\".");
  const cleaned = cleanSymbol(rawSymbol);
  if (!/^[A-Za-z0-9.\-/_:! ]+$/.test(cleaned.symbol)) throw new Error("symbol contains unsupported characters.");
  const market = typeof b.market === "string" && (MARKETS as string[]).includes(b.market) ? (b.market as Market) : cleaned.market;

  const dir = String(b.direction ?? b.side ?? "").toLowerCase();
  const direction: Direction | null = ["long", "buy", "b"].includes(dir) ? "long" : ["short", "sell", "s"].includes(dir) ? "short" : null;
  if (!direction) throw new Error("direction must be \"long\" or \"short\".");

  let accountId: string | null = null;
  const acct = text(b.account ?? b.accountId, 80);
  if (acct) {
    const live = accounts.filter((a) => a.status !== "archived");
    const hit = live.find((a) => a.id === acct) ?? live.find((a) => a.name.toLowerCase() === acct.toLowerCase());
    if (!hit) throw new Error(`No account called "${acct}". GET /api/v1/accounts lists them.`);
    accountId = hit.id;
  } else {
    // Like a new trade in the app: the first active account.
    accountId = accounts.find((a) => a.status === "active")?.id ?? null;
  }

  let executions: ApiExecution[] = [];
  if (Array.isArray(b.executions)) {
    if (b.executions.length > 200) throw new Error("A trade can have up to 200 executions.");
    executions = b.executions.map((e: Body, i: number) => {
      const kind = String(e?.kind ?? "").toLowerCase();
      if (kind !== "entry" && kind !== "exit") throw new Error(`executions[${i}].kind must be "entry" or "exit".`);
      return {
        kind,
        price: num(e.price, `executions[${i}].price`, { min: 0 }) ?? (() => { throw new Error(`executions[${i}].price is required.`); })(),
        quantity: num(e.quantity, `executions[${i}].quantity`, { positive: true }) ?? (() => { throw new Error(`executions[${i}].quantity is required.`); })(),
        time: time(e.time, `executions[${i}].time`) ?? nowISO(),
        fees: num(e.fees, `executions[${i}].fees`, { min: 0 }) ?? 0,
      } as ApiExecution;
    });
  } else {
    const qty = num(b.quantity ?? b.qty, "quantity", { positive: true });
    const entry = num(b.entryPrice, "entryPrice", { min: 0 });
    const exit = num(b.exitPrice, "exitPrice", { min: 0 });
    const entryTime = time(b.entryTime, "entryTime") ?? nowISO();
    const exitTime = time(b.exitTime, "exitTime") ?? (exit !== null ? entryTime : null);
    if (entry !== null) {
      if (qty === null) throw new Error("quantity is required with entryPrice.");
      executions.push({ kind: "entry", price: entry, quantity: qty, time: entryTime, fees: 0 });
      if (exit !== null) executions.push({ kind: "exit", price: exit, quantity: qty, time: exitTime!, fees: 0 });
    } else if (exit !== null) throw new Error("entryPrice is required with exitPrice.");
  }
  const entryQty = executions.filter((e) => e.kind === "entry").reduce((s, e) => s + e.quantity, 0);
  const exitQty = executions.filter((e) => e.kind === "exit").reduce((s, e) => s + e.quantity, 0);
  if (executions.length && !entryQty) throw new Error("Add at least one entry execution.");
  if (exitQty - entryQty > 1e-9) throw new Error("Exited quantity cannot be more than the entered quantity.");

  const pnl = num(b.pnl ?? b.netPnl, "pnl");
  if (!executions.length && pnl === null) throw new Error("Send entryPrice and quantity (and exitPrice when closed), executions, or pnl.");

  const pv = num(b.pointValue, "pointValue", { positive: true }) ?? defaultPointValue(cleaned.symbol, market, entryQty || 1);
  const tags = Array.isArray(b.tags) ? b.tags.filter((t) => typeof t === "string").map((t) => (t as string).trim().slice(0, 30)).filter(Boolean).slice(0, 20) : [];
  const externalId = text(b.externalId ?? b.id, 100) || null;

  return {
    symbol: cleaned.symbol.slice(0, 24), market, direction, accountId, executions, pointValue: pv, pnl,
    fees: num(b.fees ?? b.commission, "fees", { min: 0 }) ?? 0,
    stopPrice: num(b.stopPrice ?? b.stop, "stopPrice", { min: 0 }),
    targetPrice: num(b.targetPrice ?? b.target, "targetPrice", { min: 0 }),
    setup: text(b.setup, 60), notes: text(b.notes, 4000), tags, externalId,
  };
}

const localDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** The journal trade made from an inbox row. importKey stops the same trade being added twice. */
export function apiTradeToTrade(x: ApiTradeInput, inboxId: string): Trade {
  const t = blankTrade(0, x.accountId);
  const first = x.executions[0]?.time;
  return {
    ...t,
    id: uid("trd"),
    symbol: x.symbol, market: x.market, direction: x.direction,
    date: first ? localDate(first) : t.date,
    executions: x.executions.map((e) => ({ id: uid("ex"), ...e })),
    pointValue: x.pointValue, manualNet: x.executions.length ? null : x.pnl, fees: x.fees,
    stopPrice: x.stopPrice, targetPrice: x.targetPrice, setup: x.setup, entryNotes: x.notes, tags: x.tags,
    isDraft: false,
    importKey: `api:${x.externalId ?? inboxId}`,
    activity: [{ at: nowISO(), message: "Added through the LEDGR API" }],
  };
}

/** A trade as the API returns it. */
export function publicTrade({ trade: t, m }: EnrichedTrade, strategies: Pick<Strategy, "id" | "name">[]) {
  return {
    id: t.id, number: t.number, accountId: t.accountId, symbol: t.symbol, market: t.market, direction: t.direction,
    date: t.date, session: t.session, status: m.status, result: m.result,
    quantity: m.entryQty || null, entryPrice: m.avgEntry, exitPrice: m.avgExit, stopPrice: t.stopPrice, targetPrice: t.targetPrice,
    pointValue: t.pointValue, gross: m.gross, fees: m.totalFees, net: m.net, risk: m.risk, r: m.r,
    durationMinutes: m.durationMinutes, openedAt: m.firstTime,
    strategy: strategies.find((s) => s.id === t.strategyId)?.name ?? null, setup: t.setup || null, grade: t.grade,
    rating: t.reflection.rating ?? null, emotions: t.emotions, mistakes: t.mistakes, tags: t.tags,
    notes: { entry: t.entryNotes, exit: t.exitNotes },
    review: { wentWell: t.reflection.wentWell, wentWrong: t.reflection.wentWrong ?? "", improve: t.reflection.improve, learned: t.reflection.learned, followedPlan: t.reflection.followedPlan },
    executions: t.executions.map((e) => ({ kind: e.kind, price: e.price, quantity: e.quantity, time: e.time, fees: e.fees })),
    copyOf: t.copyOf ?? null, externalId: t.importKey?.startsWith("api:") ? t.importKey.slice(4) : null,
    createdAt: t.createdAt, updatedAt: t.updatedAt,
  };
}

/** An account as the API returns it, with its balance worked out from the journal. */
export function publicAccount(a: Account, trades: EnrichedTrade[], adjustments: BalanceAdjustment[]) {
  const s = accountSummary(a, trades, adjustments);
  return {
    id: a.id, name: a.name, type: a.type, status: a.status, currency: a.currency,
    startingBalance: a.startingBalance, balance: s.balance, netPnl: s.tradeNet, returnPct: s.returnPct,
    maxDrawdown: s.maxDD, tradingDays: s.tradingDays, closedTrades: s.closedCount,
    propFirm: a.propFirm ?? null, accountSize: a.accountSize ?? null, propStage: a.propStage ?? null,
    copyOf: a.copyOf ?? null, createdAt: a.createdAt,
  };
}
