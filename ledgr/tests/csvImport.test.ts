import { describe, expect, it } from "vitest";
import { buildTrades, cleanSymbol, detect, inferPointValue, parseCsv, parseDateTime, parseNumber } from "../src/lib/csvImport";

const run = (csv: string) => {
  const [headers, ...rows] = parseCsv(csv);
  const d = detect(headers);
  return { d, ...buildTrades(rows, d.mode, d.mapping, { buySell: d.buySell }) };
};

describe("values", () => {
  it("parses broker number formats", () => {
    expect(parseNumber("$1,234.50")).toBe(1234.5);
    expect(parseNumber("$(25.00)")).toBe(-25);
    expect(parseNumber("(12.5)")).toBe(-12.5);
    expect(parseNumber("-0.75")).toBe(-0.75);
    expect(parseNumber("1.234,50")).toBe(1234.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
  it("parses dates in local time, month-first unless obvious", () => {
    const iso = parseDateTime("11/12/2026 09:31:05")!;
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 11, 12, 9, 31, 5]);
    const e = new Date(parseDateTime("25/11/2026 14:00")!);
    expect([e.getMonth() + 1, e.getDate()]).toEqual([11, 25]);
    expect(new Date(parseDateTime("2026-11-12 3:05:00 PM")!).getHours()).toBe(15);
    expect(parseDateTime("2026-11-12T14:31:00Z")).toBe("2026-11-12T14:31:00.000Z");
    expect(parseDateTime("not a date")).toBeNull();
  });
  it("cleans broker symbols", () => {
    expect(cleanSymbol("MNQZ6")).toEqual({ symbol: "MNQ", market: "Futures" });
    expect(cleanSymbol("/ESZ25")).toEqual({ symbol: "ES", market: "Futures" });
    expect(cleanSymbol("MNQ 12-26")).toEqual({ symbol: "MNQ", market: "Futures" });
    expect(cleanSymbol("NQ DEC26")).toEqual({ symbol: "NQ", market: "Futures" });
    expect(cleanSymbol("EUR/USD")).toEqual({ symbol: "EURUSD", market: "Forex" });
    expect(cleanSymbol("BTCUSDT")).toEqual({ symbol: "BTCUSD", market: "Crypto" });
    expect(cleanSymbol("AAPL")).toEqual({ symbol: "AAPL", market: "Stocks" });
  });
});

describe("Tradovate Performance report", () => {
  const csv = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
MNQZ6,-2,0,0.25,111,112,3,28367.75,28226.00,$(850.50),11/11/2026 10:05:10,11/11/2026 09:58:02,7min 8sec
MNQZ6,-2,0,0.25,113,114,2,28300.00,28310.50,$42.00,11/11/2026 11:00:00,11/11/2026 11:04:30,4min 30sec`;
  it("detects the format and directions from timestamps", () => {
    const r = run(csv);
    expect(r.d.format).toBe("Tradovate Performance report");
    expect(r.problems).toEqual([]);
    expect(r.trades).toHaveLength(2);
    const [short, long] = r.trades;
    expect(short.direction).toBe("short"); // sold first
    expect(short.executions[0]).toMatchObject({ kind: "entry", price: 28226, quantity: 3 });
    expect(short.executions[1]).toMatchObject({ kind: "exit", price: 28367.75 });
    expect(long.direction).toBe("long");
    expect(long.executions[0].price).toBe(28300);
  });
  it("infers the MNQ multiplier ($2/point) from the file's P&L", () => {
    expect(inferPointValue(run(csv).trades)).toBe(2);
  });
});

describe("Tradovate Orders export (fills)", () => {
  const csv = `orderId,Account,Order ID,B/S,Contract,Product,avgPrice,filledQty,Fill Time,Status,Timestamp,Quantity,Type
1,DEMO1,1,Buy,MNQZ6,MNQ,28300.25,2,11/11/2026 09:31:05,Filled,11/11/2026 09:31:04,2,Market
2,DEMO1,2,Sell,MNQZ6,MNQ,,0,,Canceled,11/11/2026 09:35:00,2,Limit
3,DEMO1,3,Sell,MNQZ6,MNQ,28310.75,1,11/11/2026 09:40:00,Filled,11/11/2026 09:39:58,1,Limit
4,DEMO1,4,Sell,MNQZ6,MNQ,28318.00,1,11/11/2026 09:44:12,Filled,11/11/2026 09:44:10,1,Limit`;
  it("skips cancelled orders and joins partial exits into one trade", () => {
    const r = run(csv);
    expect(r.d.mode).toBe("fills");
    expect(r.problems).toEqual([{ row: 3, reason: "Not filled (Canceled)" }]);
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect(t).toMatchObject({ symbol: "MNQ", market: "Futures", direction: "long", open: false });
    expect(t.executions.map((e) => [e.kind, e.price, e.quantity])).toEqual([["entry", 28300.25, 2], ["exit", 28310.75, 1], ["exit", 28318, 1]]);
  });
});

describe("NinjaTrader executions", () => {
  const csv = `Instrument,Action,Quantity,Price,Time,ID,E/X,Position,Order ID,Name,Commission,Rate,Account,Connection
MNQ 12-26,Sell,1,28250.5,11/12/2026 9:45:01 AM,a,Entry,1 S,x,Sell,$0.62,1,Sim101,Sim
MNQ 12-26,Buy,1,28240.25,11/12/2026 9:52:40 AM,b,Exit,-,y,Buy to cover,$0.62,1,Sim101,Sim`;
  it("reads shorts and commissions", () => {
    const r = run(csv);
    expect(r.trades).toHaveLength(1);
    const t = r.trades[0];
    expect(t.direction).toBe("short");
    expect(t.executions.map((e) => e.fees)).toEqual([0.62, 0.62]);
  });
});

describe("generic fills", () => {
  it("splits a fill that flips the position into a close and a new trade", () => {
    const csv = `Date,Time,Symbol,Side,Qty,Price,Fee
2026-11-12,10:00:00,ES,BUY,1,5900,1
2026-11-12,10:05:00,ES,SELL,3,5905,3
2026-11-12,10:15:00,ES,BUY,2,5895,2
2026-11-12,10:20:00,AAPL,BUY,100,228.10,0`;
    const r = run(csv);
    expect(r.problems).toEqual([]);
    const es = r.trades.filter((t) => t.symbol === "ES");
    expect(es).toHaveLength(2);
    expect(es[0]).toMatchObject({ direction: "long", open: false });
    expect(es[1]).toMatchObject({ direction: "short", open: false });
    expect(es[1].executions[0]).toMatchObject({ kind: "entry", quantity: 2, price: 5905 });
    const aapl = r.trades.find((t) => t.symbol === "AAPL")!;
    expect(aapl.open).toBe(true); // still holding at end of file
  });
  it("reports unreadable rows instead of guessing", () => {
    const r = run(`Time,Symbol,Side,Qty,Price\n2026-11-12 10:00,ES,HOLD,1,5900\nyesterday,ES,BUY,1,5900`);
    expect(r.problems.map((p) => p.reason)).toEqual(['Unknown side "HOLD"', "Unreadable date/time"]);
    expect(r.trades).toHaveLength(0);
  });
  it("gives identical trades the same key so re-imports are skipped", () => {
    const csv = `Time,Symbol,Side,Qty,Price\n2026-11-12 10:00,ES,BUY,1,5900\n2026-11-12 10:05,ES,SELL,1,5904`;
    expect(run(csv).trades[0].key).toBe(run(csv).trades[0].key);
  });
});
