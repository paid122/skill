import { describe, expect, it } from "vitest";
import { chooseModel } from "../src/lib/matrixxConnect";

describe("chooseModel", () => {
  const data = [{ id: "a/first:free", free: true }, { id: "nvidia/nemotron:free", free: true, recommended: true }, { id: "paid/x", free: false }];
  it("uses the plan's recommended smart model", () => {
    expect(chooseModel({ data, recommended: { smart: ["gone/model", "nvidia/nemotron:free"], fast: [] } })).toBe("nvidia/nemotron:free");
  });
  it("falls back to a flagged, then a free, then the first model", () => {
    expect(chooseModel({ data })).toBe("nvidia/nemotron:free");
    expect(chooseModel({ data: [{ id: "paid/x", free: false }, { id: "b:free", free: true }] })).toBe("b:free");
    expect(chooseModel({ data: [{ id: "paid/x" }] })).toBe("paid/x");
    expect(chooseModel({ data: [] })).toBeNull();
    expect(chooseModel(null)).toBeNull();
  });
});

import { buildTradeContext, TRADE_REVIEW_PROMPT } from "../src/lib/ai";
import { enrich } from "../src/lib/calc";
import { emptyState } from "../src/lib/defaults";
import { buildSampleState } from "../src/lib/sample";

describe("trade review context", () => {
  it("puts the trade under review first, with its fills, notes and strategy rules", () => {
    const state = buildSampleState(emptyState());
    const all = enrich(state.trades);
    const x = all.find((y) => !y.trade.isDraft && y.trade.executions.length && y.trade.strategyId)!;
    const ctx = buildTradeContext(state, x, all);
    expect(ctx.text.startsWith(`TRADE UNDER REVIEW [T#${x.trade.number}]`)).toBe(true);
    expect(ctx.text).toContain("Executions: entry");
    expect(ctx.text).toContain("STRATEGY FOR THIS TRADE");
    expect(ctx.text).toContain("OVERALL:");
    expect(ctx.tradeNumbers.has(x.trade.number)).toBe(true);
    expect(TRADE_REVIEW_PROMPT(x.trade.number)).toContain(`[T#${x.trade.number}]`);
  });
});
