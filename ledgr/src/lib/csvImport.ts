/**
 * CSV trade import.
 *
 * Two shapes of file are understood:
 *  - "trades": one row per completed trade (entry/exit prices and times), e.g. Tradovate's
 *    Performance report (buyPrice, sellPrice, boughtTimestamp, soldTimestamp, pnl).
 *  - "fills": one row per execution (time, symbol, buy/sell, quantity, price), e.g. Tradovate
 *    Fills/Orders, NinjaTrader executions, TradingView, IBKR. Fills are stitched into trades
 *    per symbol: a trade starts when the position leaves flat and ends when it returns to flat
 *    (a fill that flips the position is split into a close and a new open).
 *
 * Columns are matched by name and can be changed by the user. Nothing is invented: rows that
 * can't be read are listed with the reason, and prices/quantities are taken exactly as written.
 */
import type { Direction, ExecutionKind, Market } from "./types";

// --------------------------------------------------------------------------- CSV parsing

/** RFC 4180-style parser: quotes, escaped quotes, newlines in quotes, BOM; delimiter auto-detected. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

// --------------------------------------------------------------------------- values

/** "$1,234.50", "(12.50)", "-12.5", "1.234,50" (when unambiguous) → number. */
export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.trim();
  if (!s || s === "-" || s === "—") return null;
  let neg = false;
  s = s.replace(/[$€£¥\s]|USD|EUR|GBP/gi, "");
  if (s.startsWith("-(") && s.endsWith(")")) s = s.slice(1);
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  // European decimal comma: "1.234,50" or "12,5"
  if (/^\d{1,3}(\.\d{3})*,\d+$/.test(s) || /^\d+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/**
 * Dates as brokers write them → ISO. Times without a zone are read as local time (that's how
 * platforms export them). "11/12/2026 09:31:05" is month-first unless the first part is > 12.
 */
export function parseDateTime(raw: string | undefined, dayFirst = false): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{10,13}$/.test(s)) { const n = Number(s); const d = new Date(s.length === 13 ? n : n * 1000); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  const m = s.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(AM|PM)?)?/i);
  if (!m) { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  let y: number, mo: number, da: number;
  const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[1].length === 4) { y = a; mo = b; da = c; }
  else {
    y = m[3].length === 2 ? 2000 + c : c;
    if (dayFirst || a > 12) { da = a; mo = b; } else { mo = a; da = b; }
  }
  let h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0), se = Number(m[6] ?? 0), ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, "0")) : 0;
  if (m[8]) { const pm = m[8].toUpperCase() === "PM"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  const d = new Date(y, mo - 1, da, h, mi, se, ms);
  if (Number.isNaN(d.getTime()) || d.getMonth() !== mo - 1) return null;
  return d.toISOString();
}

// --------------------------------------------------------------------------- columns

export type Mode = "fills" | "trades";
export type FillField = "symbol" | "side" | "qty" | "price" | "time" | "date" | "fees";
export type TradeField = "symbol" | "direction" | "qty" | "entryPrice" | "exitPrice" | "entryTime" | "exitTime" | "pnl" | "fees";
export type Mapping = Partial<Record<FillField | TradeField | "status", number>>;

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES: Record<FillField | TradeField, string[]> = {
  symbol: ["symbol", "instrument", "contract", "ticker", "product", "contractname", "securitysymbol", "market", "asset"],
  side: ["side", "action", "bs", "buysell", "buyorsell", "transactiontype", "type", "direction", "orderaction"],
  direction: ["direction", "side", "position", "type", "longshort", "marketpos", "marketposition"],
  qty: ["filledqty", "filledquantity", "fillqty", "qty", "quantity", "size", "contracts", "shares", "volume", "lots", "amount", "units", "fillqty"],
  price: ["avgfillprice", "fillprice", "executionprice", "price", "avgprice", "averageprice", "tradeprice", "fillpx", "execprice"],
  time: ["filltime", "executiontime", "exectime", "time", "datetime", "tradetime", "timestamp", "datetimeutc", "date/time", "transactiontime", "exectime"],
  date: ["date", "tradedate", "filldate"],
  fees: ["commission", "commissions", "fees", "fee", "comm", "commissionfee", "totalfees", "commfee"],
  entryPrice: ["entryprice", "openprice", "avgentryprice", "buyprice", "priceopen"],
  exitPrice: ["exitprice", "closeprice", "avgexitprice", "sellprice", "priceclose"],
  entryTime: ["entrytime", "opentime", "entrydate", "opendate", "boughttimestamp", "timeopen", "openedat"],
  exitTime: ["exittime", "closetime", "exitdate", "closedate", "soldtimestamp", "timeclose", "closedat"],
  pnl: ["pnl", "profit", "netpnl", "netprofit", "profitloss", "pl", "realizedpnl", "realizedpl", "grosspnl", "netpl"],
};

function find(headers: string[], field: FillField | TradeField, taken: Set<number>): number | undefined {
  const hs = headers.map(norm);
  for (const alias of ALIASES[field]) {
    const i = hs.findIndex((h, j) => !taken.has(j) && h === norm(alias));
    if (i >= 0) return i;
  }
  for (const alias of ALIASES[field]) {
    const i = hs.findIndex((h, j) => !taken.has(j) && h.includes(norm(alias)) && norm(alias).length >= 4);
    if (i >= 0) return i;
  }
  return undefined;
}

/** buySell: the file has buy/sell price and time columns (Tradovate Performance); the earlier side is the entry. */
export interface Detected { mode: Mode; format: string; mapping: Mapping; buySell: boolean }

/** Guess the file shape and match columns. */
export function detect(headers: string[]): Detected {
  const hs = headers.map(norm);
  const has = (h: string) => hs.includes(h);
  const guess = (fields: (FillField | TradeField)[]) => {
    const taken = new Set<number>();
    const m: Mapping = {};
    for (const f of fields) { const i = find(headers, f, taken); if (i !== undefined) { m[f] = i; taken.add(i); } }
    return m;
  };
  if (has("buyprice") && has("sellprice") && (has("boughttimestamp") || has("soldtimestamp"))) {
    return { mode: "trades", format: "Tradovate Performance report", buySell: true, mapping: guess(["symbol", "qty", "entryPrice", "exitPrice", "entryTime", "exitTime", "pnl", "fees"]) };
  }
  const tradeLike = ["entryprice", "exitprice", "openprice", "closeprice", "avgentryprice", "avgexitprice"].filter(has).length >= 2;
  if (tradeLike) return { mode: "trades", format: "Completed trades", buySell: false, mapping: guess(["symbol", "direction", "qty", "entryPrice", "exitPrice", "entryTime", "exitTime", "pnl", "fees"]) };
  const format = has("bs") && has("contract") ? "Tradovate fills/orders" : has("marketpos") || (has("instrument") && has("action") && has("ex")) ? "NinjaTrader executions" : "Fills (one row per execution)";
  const mapping = guess(["time", "date", "symbol", "side", "qty", "price", "fees"]);
  const st = hs.indexOf("status");
  if (st >= 0) mapping.status = st;
  return { mode: "fills", format, buySell: false, mapping };
}

// --------------------------------------------------------------------------- instruments

const FUTURES_PV: Record<string, number> = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5, EMD: 100,
  CL: 1000, MCL: 100, QM: 500, NG: 10000, QG: 2500, RB: 42000, HO: 42000,
  GC: 100, MGC: 10, SI: 5000, SIL: 1000, HG: 25000, MHG: 2500, PL: 50, PA: 100,
  ZB: 1000, UB: 1000, ZN: 1000, ZF: 1000, ZT: 2000, "6E": 125000, M6E: 12500, "6J": 12500000, "6B": 62500, "6A": 100000, "6C": 100000,
  ZC: 50, ZS: 50, ZW: 50, ZL: 600, ZM: 100, LE: 400, HE: 400, BTC: 5, MBT: 0.1, ETH: 50, MET: 0.1, VX: 1000,
};
const CRYPTO = /^(BTC|ETH|SOL|XRP|DOGE|BNB|ADA|AVAX|LTC|LINK|DOT|MATIC|TRX|BCH|XLM|ATOM|UNI|SHIB)/;
const CCY = "EUR|GBP|USD|JPY|AUD|NZD|CAD|CHF|CNH|MXN|ZAR|SEK|NOK|SGD|HKD|TRY";

/** Clean a broker symbol: "MNQZ6" → "MNQ", "MNQ DEC26" → "MNQ", "/ESZ25" → "ES", "EUR/USD" → "EURUSD". */
export function cleanSymbol(raw: string): { symbol: string; market: Market } {
  const s = raw.trim().toUpperCase().replace(/^\//, "");
  const compact = s.replace(/[^A-Z0-9]/g, "");
  const fx = compact.match(new RegExp(`^(${CCY})(${CCY})$`));
  if (fx) return { symbol: compact, market: "Forex" };
  if (/^(XAU|XAG|XPT|XPD)(USD|EUR)$/.test(compact)) return { symbol: compact, market: "Commodities" };
  // futures: ROOT + month code + 1–4 digit year, or "ROOT MON YY"
  const spaced = s.match(/^([A-Z0-9]{1,4})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{2,4}$/);
  if (spaced && FUTURES_PV[spaced[1]] !== undefined) return { symbol: spaced[1], market: "Futures" };
  const nt = s.match(/^([A-Z0-9]{1,4})\s+\d{2}-\d{2}$/); // NinjaTrader "MNQ 12-26"
  if (nt && FUTURES_PV[nt[1]] !== undefined) return { symbol: nt[1], market: "Futures" };
  const coded = compact.match(/^([A-Z0-9]{1,4}?)([FGHJKMNQUVXZ])(\d{1,4})$/);
  if (coded && FUTURES_PV[coded[1]] !== undefined) return { symbol: coded[1], market: "Futures" };
  if (FUTURES_PV[compact] !== undefined && !CRYPTO.test(compact)) return { symbol: compact, market: "Futures" };
  if (CRYPTO.test(compact) && /(USD|USDT|USDC|EUR|BTC)$/.test(compact)) return { symbol: compact.replace(/USDT$|USDC$/, "USD"), market: "Crypto" };
  return { symbol: compact.slice(0, 24) || s.slice(0, 24), market: "Stocks" };
}

/** Default contract multiplier when the CSV doesn't tell us. */
export function defaultPointValue(symbol: string, market: Market, sampleQty: number): number {
  if (market === "Futures") return FUTURES_PV[symbol] ?? 1;
  if (market === "Forex") return sampleQty >= 1000 ? 1 : 100000; // units vs lots
  if (market === "Commodities" && symbol.startsWith("XAU")) return sampleQty >= 10 ? 1 : 100;
  return 1;
}

// --------------------------------------------------------------------------- building trades

export interface ImportedExecution { kind: ExecutionKind; price: number; quantity: number; time: string; fees: number }
export interface ImportedTrade {
  key: string;
  symbol: string;
  market: Market;
  direction: Direction;
  executions: ImportedExecution[];
  open: boolean; // position not yet closed in this file
  csvPnl: number | null; // P&L as written in the file (if any)
}
export interface ImportProblem { row: number; reason: string }
export interface BuildResult { trades: ImportedTrade[]; problems: ImportProblem[] }

const sideOf = (raw: string): 1 | -1 | null => {
  const s = raw.trim().toLowerCase();
  if (/^(b|buy|bot|bought|long|buy to open|buy to cover|buytocover|buytoopen|cover|1)$/.test(s) || s.startsWith("buy")) return 1;
  if (/^(s|sell|sld|sold|short|sell short|sellshort|sell to close|selltoclose|-1)$/.test(s) || s.startsWith("sell")) return -1;
  return null;
};

function keyOf(t: Omit<ImportedTrade, "key">) {
  const e = t.executions;
  return [t.symbol, t.direction, e[0]?.time, e[e.length - 1]?.time, e.reduce((q, x) => q + (x.kind === "entry" ? x.quantity : 0), 0), e[0]?.price, e[e.length - 1]?.price].join("|");
}

export function buildTrades(rows: string[][], mode: Mode, m: Mapping, opts: { dayFirst?: boolean; buySell?: boolean } = {}): BuildResult {
  const problems: ImportProblem[] = [];
  const cell = (r: string[], f: FillField | TradeField) => (m[f] === undefined ? undefined : r[m[f]!]);
  const trades: ImportedTrade[] = [];

  if (mode === "trades") {
    rows.forEach((r, i) => {
      const line = i + 2;
      const symRaw = cell(r, "symbol");
      const qty = parseNumber(cell(r, "qty"));
      const ep = parseNumber(cell(r, "entryPrice")), xp = parseNumber(cell(r, "exitPrice"));
      const et = parseDateTime(cell(r, "entryTime"), opts.dayFirst), xt = parseDateTime(cell(r, "exitTime"), opts.dayFirst) ?? et;
      if (!symRaw) return problems.push({ row: line, reason: "No symbol" });
      if (qty === null || qty === 0) return problems.push({ row: line, reason: "No quantity" });
      if (ep === null || xp === null) return problems.push({ row: line, reason: "Missing entry or exit price" });
      if (!et && !xt) return problems.push({ row: line, reason: "Unreadable date/time" });
      const { symbol, market } = cleanSymbol(symRaw);
      let direction: Direction;
      const dirCell = cell(r, "direction");
      const sd = dirCell ? sideOf(dirCell) : null;
      if (sd) direction = sd === 1 ? "long" : "short";
      else if (opts.buySell && et && xt) {
        // Tradovate Performance: buy/sell columns, earlier timestamp is the entry
        direction = (et ?? "") <= (xt ?? "") ? "long" : "short";
      } else direction = qty < 0 ? "short" : "long";
      let entryPrice = ep, exitPrice = xp, entryTime = et ?? xt!, exitTime = xt ?? et!;
      if (opts.buySell && direction === "short") { entryPrice = xp; exitPrice = ep; [entryTime, exitTime] = [exitTime, entryTime]; }
      const fees = Math.abs(parseNumber(cell(r, "fees")) ?? 0);
      const q = Math.abs(qty);
      const t: Omit<ImportedTrade, "key"> = {
        symbol, market, direction, open: false, csvPnl: parseNumber(cell(r, "pnl")),
        executions: [
          { kind: "entry", price: entryPrice, quantity: q, time: entryTime, fees: fees / 2 },
          { kind: "exit", price: exitPrice, quantity: q, time: exitTime, fees: fees / 2 },
        ],
      };
      trades.push({ ...t, key: keyOf(t) });
    });
    return { trades: trades.sort((a, b) => a.executions[0].time.localeCompare(b.executions[0].time)), problems };
  }

  // ---- fills → trades
  const statusCol = m.status;
  interface Fill { line: number; symbol: string; market: Market; side: 1 | -1; qty: number; price: number; time: string; fees: number }
  const fills: Fill[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    if (statusCol !== undefined && /cancel|reject|expire|working|pending|suspend/i.test(r[statusCol] ?? "")) return problems.push({ row: line, reason: `Not filled (${r[statusCol]})` });
    const symRaw = cell(r, "symbol");
    const sideCell = cell(r, "side");
    let qty = parseNumber(cell(r, "qty"));
    const price = parseNumber(cell(r, "price"));
    const timeRaw = m.date !== undefined && m.time !== undefined && m.date !== m.time ? `${cell(r, "date")} ${cell(r, "time")}` : cell(r, "time") ?? cell(r, "date");
    const time = parseDateTime(timeRaw, opts.dayFirst);
    if (!symRaw) return problems.push({ row: line, reason: "No symbol" });
    let side = sideCell ? sideOf(sideCell) : null;
    if (!side && qty !== null && qty !== 0 && m.side === undefined) side = qty > 0 ? 1 : -1; // signed quantities
    if (!side) return problems.push({ row: line, reason: `Unknown side "${sideCell ?? ""}"` });
    if (qty === null || qty === 0) return problems.push({ row: line, reason: "Nothing filled" });
    if (price === null) return problems.push({ row: line, reason: "No price" });
    if (!time) return problems.push({ row: line, reason: "Unreadable date/time" });
    qty = Math.abs(qty);
    const { symbol, market } = cleanSymbol(symRaw);
    fills.push({ line, symbol, market, side, qty, price, time, fees: Math.abs(parseNumber(cell(r, "fees")) ?? 0) });
  });
  fills.sort((a, b) => a.time.localeCompare(b.time) || a.line - b.line);

  const bySymbol = new Map<string, Fill[]>();
  fills.forEach((f) => { if (!bySymbol.has(f.symbol)) bySymbol.set(f.symbol, []); bySymbol.get(f.symbol)!.push(f); });
  for (const [symbol, list] of bySymbol) {
    let pos = 0;
    let cur: Omit<ImportedTrade, "key"> | null = null;
    const close = () => { if (cur) { trades.push({ ...cur, key: keyOf(cur) }); cur = null; } };
    for (const f of list) {
      let remaining = f.qty;
      const feePerUnit = f.fees / f.qty;
      while (remaining > 1e-12) {
        if (pos === 0) {
          cur = { symbol, market: f.market, direction: f.side === 1 ? "long" : "short", executions: [], open: true, csvPnl: null };
          cur.executions.push({ kind: "entry", price: f.price, quantity: remaining, time: f.time, fees: feePerUnit * remaining });
          pos = f.side * remaining;
          remaining = 0;
        } else if (Math.sign(pos) === f.side) {
          cur!.executions.push({ kind: "entry", price: f.price, quantity: remaining, time: f.time, fees: feePerUnit * remaining });
          pos += f.side * remaining;
          remaining = 0;
        } else {
          const q = Math.min(Math.abs(pos), remaining);
          cur!.executions.push({ kind: "exit", price: f.price, quantity: q, time: f.time, fees: feePerUnit * q });
          pos += f.side * q;
          remaining -= q;
          if (Math.abs(pos) < 1e-12) { pos = 0; cur!.open = false; close(); }
        }
      }
    }
    close(); // anything left is still open
  }
  return { trades: trades.sort((a, b) => a.executions[0].time.localeCompare(b.executions[0].time)), problems };
}

// --------------------------------------------------------------------------- point values

/**
 * When the file has its own P&L, work out the contract multiplier from it:
 * pnl ≈ (exit − entry) × qty × pointValue × (long ? 1 : −1). Snapped to a clean value.
 */
export function inferPointValue(trades: ImportedTrade[]): number | null {
  const est: number[] = [];
  for (const t of trades) {
    if (t.csvPnl === null || t.open) continue;
    const en = t.executions.filter((e) => e.kind === "entry"), ex = t.executions.filter((e) => e.kind === "exit");
    const q = en.reduce((s, e) => s + e.quantity, 0);
    const avg = (xs: ImportedExecution[]) => xs.reduce((s, e) => s + e.price * e.quantity, 0) / xs.reduce((s, e) => s + e.quantity, 0);
    const move = (avg(ex) - avg(en)) * (t.direction === "long" ? 1 : -1) * q;
    if (Math.abs(move) < 1e-9 || Math.abs(t.csvPnl) < 1e-9) continue;
    const pv = t.csvPnl / move;
    if (pv > 0 && Number.isFinite(pv)) est.push(pv);
  }
  if (est.length === 0) return null;
  est.sort((a, b) => a - b);
  const med = est[Math.floor(est.length / 2)];
  const nice = [0.1, 0.5, 1, 2, 5, 10, 12.5, 20, 25, 50, 100, 125, 250, 400, 500, 600, 1000, 2000, 2500, 5000, 10000, 12500, 25000, 42000, 62500, 100000, 125000];
  const snap = nice.find((n) => Math.abs(n - med) / n < 0.06);
  return snap ?? Number(med.toPrecision(4));
}
