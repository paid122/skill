import { describe, expect, it } from "vitest";
import { aggregate, fillsMatch, guessSource, parseBinance, parseDatabento, parseTwelveData, pickWindow } from "../src/lib/candles";

describe("guessSource", () => {
  it("maps crypto to Binance USDT pairs", () => {
    expect(guessSource({ symbol: "BTCUSD", market: "Crypto" })).toEqual({ provider: "binance", dataSymbol: "BTCUSDT" });
    expect(guessSource({ symbol: "ETH/USDT", market: "Crypto" })).toEqual({ provider: "binance", dataSymbol: "ETHUSDT" });
    expect(guessSource({ symbol: "SOL", market: null })).toEqual({ provider: "binance", dataSymbol: "SOLUSDT" });
  });
  it("maps futures to the most-traded continuous contract", () => {
    expect(guessSource({ symbol: "NQ", market: "Futures" })).toEqual({ provider: "databento", dataSymbol: "NQ.v.0" });
    expect(guessSource({ symbol: "MNQZ6", market: "Futures" })).toEqual({ provider: "databento", dataSymbol: "MNQ.v.0" });
  });
  it("maps stocks and forex to Twelve Data", () => {
    expect(guessSource({ symbol: "AAPL", market: "Stocks" })).toEqual({ provider: "twelvedata", dataSymbol: "AAPL" });
    expect(guessSource({ symbol: "EURUSD", market: "Forex" })).toEqual({ provider: "twelvedata", dataSymbol: "EUR/USD" });
  });
});

describe("pickWindow", () => {
  const now = Date.parse("2026-11-12T20:00:00Z");
  it("uses 1m candles for a short trade, padded both sides", () => {
    const w = pickWindow(["2026-11-12T14:31:00Z", "2026-11-12T14:52:00Z"], now)!;
    expect(w.interval).toBe("1m");
    expect(w.from).toBeLessThan(Date.parse("2026-11-12T14:31:00Z"));
    expect(w.to).toBeGreaterThan(Date.parse("2026-11-12T14:52:00Z"));
    expect((w.to - w.from) / 60e3).toBeGreaterThanOrEqual(40);
  });
  it("uses larger candles for longer trades", () => {
    expect(pickWindow(["2026-11-10T14:00:00Z", "2026-11-10T18:00:00Z"], now)!.interval).toBe("5m");
    expect(pickWindow(["2026-11-01T14:00:00Z", "2026-11-04T18:00:00Z"], now)!.interval).toBe("1h");
  });
  it("never asks for the future and handles no times", () => {
    expect(pickWindow(["2026-11-12T19:59:00Z"], now)!.to).toBeLessThanOrEqual(now);
    expect(pickWindow([], now)).toBeNull();
  });
});

describe("parsers", () => {
  it("parses Binance klines", () => {
    const bars = parseBinance([[1794462660000, "73610.76", "73610.77", "73600.00", "73605.00", "1.0", 0]]);
    expect(bars).toEqual([{ t: 1794462660000, o: 73610.76, h: 73610.77, l: 73600, c: 73605 }]);
  });
  it("parses Twelve Data (newest first) into ascending UTC bars", () => {
    const bars = parseTwelveData({ status: "ok", values: [
      { datetime: "2026-11-12 14:32:00", open: "2", high: "3", low: "1", close: "2.5" },
      { datetime: "2026-11-12 14:31:00", open: "1", high: "2", low: "0.5", close: "2" },
    ] });
    expect(bars.map((b) => b.t)).toEqual([Date.parse("2026-11-12T14:31:00Z"), Date.parse("2026-11-12T14:32:00Z")]);
    expect(() => parseTwelveData({ status: "error", message: "Invalid API key" })).toThrow("Invalid API key");
  });
  it("parses Databento JSON lines with nanosecond or ISO timestamps", () => {
    const text = [
      '{"hd":{"ts_event":"2026-11-12T14:31:00.000000000Z","rtype":33},"open":"21036.25","high":"21040.00","low":"21030.50","close":"21038.75","volume":"812"}',
      '{"hd":{"ts_event":"1794493920000000000","rtype":33},"open":"21038.75","high":"21041.50","low":"21035.00","close":"21041.00","volume":"640"}',
    ].join("\n");
    const bars = parseDatabento(text);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({ t: Date.parse("2026-11-12T14:31:00Z"), o: 21036.25, h: 21040, l: 21030.5, c: 21038.75 });
    expect(bars[1].t).toBe(1794493920000);
  });
});

describe("aggregate and fillsMatch", () => {
  const t0 = Date.parse("2026-11-12T14:30:00Z");
  const ones = [0, 1, 2, 3, 4, 5].map((i) => ({ t: t0 + i * 60e3, o: 100 + i, h: 102 + i, l: 99 + i, c: 101 + i }));
  it("aggregates 1m bars into 5m bars", () => {
    const five = aggregate(ones, 300e3);
    expect(five).toHaveLength(2);
    expect(five[0]).toEqual({ t: t0, o: 100, h: 106, l: 99, c: 105 });
  });
  it("flags fills that sit outside the feed's candles", () => {
    expect(fillsMatch(ones, "1m", [{ time: "2026-11-12T14:31:20Z", price: 101.5 }])).toBe(true);
    expect(fillsMatch(ones, "1m", [{ time: "2026-11-12T14:31:20Z", price: 140 }])).toBe(false);
  });
});
