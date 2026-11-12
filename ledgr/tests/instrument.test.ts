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
