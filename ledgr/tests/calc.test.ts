import { describe, expect, it } from "vitest";
import { computeStats, disciplineScore, enrich, equityCurve, maxDrawdown, tradeMetrics } from "@/lib/calc";
import { blankTrade, migrate } from "@/lib/defaults";
import { computeInsights } from "@/lib/insights";
import { buildSampleState } from "@/lib/sample";
import type { Trade } from "@/lib/types";
import { LEGACY_VERSE_IDS, selectVerse, verseSource, VERSES, PAGE_VERSES, VERSE_BY_ID } from "@/lib/verses";
import { toCSV } from "@/lib/util";

let n = 0;
function trade(p: Partial<Trade>): Trade {
  const t = blankTrade(++n, "acc1");
  return { ...t, symbol: "ES", direction: "long", isDraft: false, ...p };
}
const ex = (kind: "entry" | "exit", price: number, quantity: number, fees = 0, time = "2026-01-05T10:00:00Z") => ({ id: Math.random().toString(), kind, price, quantity, fees, time });

describe("tradeMetrics", () => {
  it("computes long P&L with fees and R", () => {
    const t = trade({ pointValue: 50, stopPrice: 99, executions: [ex("entry", 100, 2, 2), ex("exit", 102, 2, 2, "2026-01-05T10:30:00Z")], fees: 1 });
    const m = tradeMetrics(t);
    expect(m.gross).toBe(200);
    expect(m.totalFees).toBe(5);
    expect(m.net).toBe(195);
    expect(m.risk).toBe(100);
    expect(m.r).toBeCloseTo(1.95);
    expect(m.result).toBe("win");
    expect(m.status).toBe("closed");
    expect(m.durationMinutes).toBe(30);
  });

  it("computes short P&L", () => {
    const m = tradeMetrics(trade({ direction: "short", executions: [ex("entry", 50, 10), ex("exit", 48, 10)] }));
    expect(m.net).toBe(20);
  });

  it("handles scaling in and partial exits with weighted averages", () => {
    const t = trade({ executions: [ex("entry", 100, 1), ex("entry", 104, 1), ex("exit", 106, 1), ex("exit", 108, 1)] });
    const m = tradeMetrics(t);
    expect(m.avgEntry).toBe(102);
    expect(m.avgExit).toBe(107);
    expect(m.net).toBe(10);
  });

  it("treats partially exited trades as open and excludes them", () => {
    const t = trade({ executions: [ex("entry", 100, 2), ex("exit", 101, 1)] });
    expect(tradeMetrics(t).status).toBe("open");
    expect(tradeMetrics(t).result).toBeNull();
  });

  it("uses manual net when no executions exist", () => {
    const m = tradeMetrics(trade({ manualNet: -40, plannedRisk: 80 }));
    expect(m.net).toBe(-40);
    expect(m.r).toBe(-0.5);
    expect(m.result).toBe("loss");
  });

  it("classifies break-even within the threshold", () => {
    const m = tradeMetrics(trade({ manualNet: 3 }), { breakevenThreshold: 5 });
    expect(m.result).toBe("breakeven");
  });

  it("keeps drafts out of results and reports missing fields", () => {
    const t = { ...blankTrade(1, null), symbol: "NQ" };
    const m = tradeMetrics(t);
    expect(m.status).toBe("draft");
    expect(m.missing).toEqual(expect.arrayContaining(["Direction", "Account", "Executions or net result"]));
  });
});

describe("computeStats", () => {
  it("returns empty-safe values with zero trades", () => {
    const s = computeStats([]);
    expect(s.winRate).toBeNull();
    expect(s.profitFactor).toBeNull();
    expect(s.avgR).toBeNull();
    expect(s.net).toBe(0);
    expect(s.maxDD.amount).toBe(0);
  });

  it("calculates win rate, profit factor and drawdown", () => {
    const list = enrich([
      trade({ date: "2026-01-01", manualNet: 100, plannedRisk: 50 }),
      trade({ date: "2026-01-02", manualNet: -50, plannedRisk: 50 }),
      trade({ date: "2026-01-03", manualNet: -30, plannedRisk: 50 }),
      trade({ date: "2026-01-04", manualNet: 0 }),
      trade({ date: "2026-01-05", manualNet: 60, plannedRisk: 50 }),
      { ...blankTrade(99, "acc1") }, // draft excluded
    ]);
    const s = computeStats(list);
    expect(s.closed).toBe(5);
    expect(s.excludedDrafts).toBe(1);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(2);
    expect(s.breakeven).toBe(1);
    expect(s.winRate).toBe(0.5);
    expect(s.profitFactor).toBeCloseTo(160 / 80);
    expect(s.net).toBe(80);
    expect(s.avgWin).toBe(80);
    expect(s.avgLoss).toBe(-40);
    expect(s.avgR).toBeCloseTo((2 - 1 - 0.6 + 1.2) / 4);
    expect(s.rCoverage).toBe(4);
    expect(s.maxDD.amount).toBe(-80);
  });

  it("computes drawdown percent from a starting balance", () => {
    const curve = equityCurve(enrich([trade({ date: "2026-01-01", manualNet: 1000 }), trade({ date: "2026-01-02", manualNet: -2200 })]), 10000);
    const dd = maxDrawdown(curve, 10000);
    expect(dd.amount).toBe(-2200);
    expect(dd.pct).toBeCloseTo(-20);
  });
});

describe("disciplineScore", () => {
  it("is null without trades", () => {
    expect(disciplineScore([], []).score).toBeNull();
  });
  it("never depends on P&L", () => {
    const a = trade({ manualNet: 500, emotions: ["Calm"], reflection: { wentWell: "a", improve: "b", learned: "c", followedPlan: "yes" } });
    const b = { ...a, manualNet: -500 };
    expect(disciplineScore([a], []).score).toBe(disciplineScore([b], []).score);
  });
});

describe("insights", () => {
  it("reports insufficient data instead of inventing insights", () => {
    const res = computeInsights(enrich([trade({ manualNet: 10 })]), 10);
    expect(res).toHaveLength(14);
    expect(res.every((i) => i.status === "insufficient")).toBe(true);
  });
  it("produces insights from sample records", () => {
    const s = buildSampleState();
    const res = computeInsights(enrich(s.trades), 10);
    expect(res.filter((i) => i.status === "ok").length).toBeGreaterThan(8);
  });
});

describe("verses", () => {
  it("has a verse for every page mapping", () => {
    for (const p of Object.values(PAGE_VERSES)) expect(VERSE_BY_ID.get(p.verseId)).toBeDefined();
  });
  it("maps every retired King James id to a verse that exists", () => {
    for (const id of Object.values(LEGACY_VERSE_IDS)) expect(VERSE_BY_ID.get(id)).toBeDefined();
  });
  it("labels Old Testament verses as Septuagint and New Testament as WEB", () => {
    expect(verseSource(VERSE_BY_ID.get("PSA.38.5")!)).toBe("LXX");
    expect(verseSource(VERSE_BY_ID.get("JAS.1.5")!)).toBe("WEB");
  });
  it("migrates old favourites and the KJV setting", () => {
    const m = migrate({ settings: { translation: "KJV" } as never, favouriteVerses: [{ verseId: "PRO.16.3", reflection: "x", savedAt: "2026-01-01" }], verseHistory: [{ verseId: "PSA.90.12", page: "daily", at: "2026-01-01" }] });
    expect(m.settings.translation).toBe("LXX+WEB");
    expect(m.favouriteVerses[0].verseId).toBe("PSA.36.5");
    expect(m.verseHistory[0].verseId).toBe("PSA.38.5");
  });
  it("has unique ids", () => {
    expect(new Set(VERSES.map((v) => v.id)).size).toBe(VERSES.length);
  });
  it("selects patience verse on strained emotions and diligence verse when incomplete", () => {
    expect(selectVerse("daily", { emotionsToday: ["Frustrated"] }).verse.id).toBe("PRO.14.29");
    expect(selectVerse("daily", { journalIncomplete: true }).verse.id).toBe("PRO.13.4");
    expect(selectVerse("analytics", { emotionsToday: ["Frustrated"] }).verse.id).toBe("JAS.1.5");
  });
});

describe("csv", () => {
  it("escapes and neutralises formulas", () => {
    expect(toCSV([["=SUM(A1)", 'a"b', -5]])).toBe(`'=SUM(A1),"a""b",-5`);
  });
});
