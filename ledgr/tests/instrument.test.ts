import { describe, expect, it } from "vitest";
import { marketGlyph } from "../src/lib/instrument";

describe("marketGlyph", () => {
  it("covers each market", () => {
    expect(marketGlyph("MNQ", "Futures")).toEqual({ text: "MNQ" });
    expect(marketGlyph("NQZ6", "Futures")).toEqual({ text: "NQ" });
    expect(marketGlyph("NAS100", "Indices")).toEqual({ text: "NQ" });
    expect(marketGlyph("BTCUSD", "Crypto")).toEqual({ text: "₿" });
    expect(marketGlyph("ETH/USDT", "Crypto")).toEqual({ text: "Ξ" });
    expect(marketGlyph("EURUSD", "Forex")).toEqual({ text: "€$" });
    expect(marketGlyph("GBP/JPY", "Forex")).toEqual({ text: "£¥" });
    expect(marketGlyph("XAUUSD", "Commodities")).toEqual({ text: "Au" });
    expect(marketGlyph("GC", "Futures")).toEqual({ text: "Au" });
    expect(marketGlyph("CL", "Futures")).toEqual({ icon: "oil" });
    expect(marketGlyph("USOIL", null)).toEqual({ icon: "oil" });
    expect(marketGlyph("AAPL", "Stocks")).toEqual({ text: "A" });
    expect(marketGlyph("", null)).toEqual({ text: "·" });
  });
});

import { symbolImage } from "../src/lib/instrument";
describe("symbolImage", () => {
  it("picks a picture per market", () => {
    expect(symbolImage("MNQ", "Futures")).toEqual({ kind: "single", src: "/api/logo?s=NDAQ" });
    expect(symbolImage("ESZ6", "Futures")).toEqual({ kind: "single", src: "/api/logo?s=SPGI" });
    expect(symbolImage("NAS100", "Indices")).toEqual({ kind: "single", src: "/api/logo?s=NDAQ" });
    expect(symbolImage("CL", "Futures")).toEqual({ kind: "single", src: "/api/logo?s=CME" });
    expect(symbolImage("BTCUSD", "Crypto")).toEqual({ kind: "single", src: "/symbols/crypto/btc.svg" });
    expect(symbolImage("EURUSD", "Forex")).toEqual({ kind: "pair", a: "/symbols/flags/eu.svg", b: "/symbols/flags/us.svg" });
    expect(symbolImage("AAPL", "Stocks")).toEqual({ kind: "single", src: "/api/logo?s=AAPL" });
    expect(symbolImage("XAUUSD", "Commodities")).toEqual({ kind: "single", src: "/symbols/metals/xau.svg" });
    expect(symbolImage("XAG/USD", "Forex")).toEqual({ kind: "single", src: "/symbols/metals/xag.svg" });
    expect(symbolImage("XAU", null)).toEqual({ kind: "single", src: "/symbols/metals/xau.svg" });
    expect(symbolImage("", null)).toBeNull();
  });
});
