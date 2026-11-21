import { describe, expect, it } from "vitest";
import { tradeMetrics } from "@/lib/calc";
import { blankTrade } from "@/lib/defaults";
const emptyTrade = () => blankTrade(1, "acc");
import { suggestReview } from "@/lib/review";

describe("suggestReview", () => {
  it("writes only from what the trade records", () => {
    const blank = emptyTrade();
    const s = suggestReview(blank, tradeMetrics(blank));
    expect(s.wentWell).toBe("");
    expect(s.wentWrong).toContain("No stop");
    expect(s.improve).toContain("stop before every entry");
  });
  it("covers plan, emotions and mistakes", () => {
    const t = { ...emptyTrade(), setup: "ORB", stopPrice: 100, emotions: ["Impatient" as const], mistakes: ["Impulsive decision"], reflection: { ...emptyTrade().reflection, followedPlan: "partial" as const } };
    const s = suggestReview(t, tradeMetrics(t));
    expect(s.wentWell).toContain("Had my risk defined");
    expect(s.wentWell).not.toContain("Traded my setup");
    expect(s.wentWrong).toContain("Impulsive decision.");
    expect(s.wentWrong).toContain("Felt impatient.");
    expect(s.improve).toContain("checklist");
  });
});

import { enrich } from "@/lib/calc";
import { suggestRating } from "@/lib/review";
const at = (n: number, time: string, entry: number, exit: number) => ({
  ...blankTrade(n, "acc"), symbol: "NQ", direction: "long" as const, isDraft: false, date: "2026-11-18", stopPrice: entry - 10, pointValue: 20,
  executions: [
    { id: `e${n}`, kind: "entry" as const, price: entry, quantity: 1, time: `2026-11-18T${time}:00.000Z`, fees: 0 },
    { id: `x${n}`, kind: "exit" as const, price: exit, quantity: 1, time: `2026-11-18T${time.slice(0, 3)}${String(Number(time.slice(3)) + 3).padStart(2, "0")}:00.000Z`, fees: 0 },
  ],
});
describe("review context", () => {
  it("flags a revenge entry and the 4th trade of the day", () => {
    const list = enrich([at(1, "14:00", 100, 105), at(2, "14:10", 100, 106), at(3, "14:20", 100, 90), at(4, "14:25", 100, 104)]);
    const me = list[3];
    const s = suggestReview(me.trade, me.m, { all: list });
    expect(s.wentWrong).toMatch(/after a loss/);
    expect(s.wentWrong).toContain("4th trade of the day");
    expect(s.improve).toContain("wait 15 minutes");
  });
  it("suggests a lower rating for a sloppy trade than a clean one", () => {
    const list = enrich([at(1, "14:00", 100, 105)]);
    const clean = { ...list[0].trade, grade: "A" as const, reflection: { ...list[0].trade.reflection, followedPlan: "yes" as const } };
    const sloppy = { ...list[0].trade, grade: "D" as const, mistakes: ["Impulsive decision"], reflection: { ...list[0].trade.reflection, followedPlan: "no" as const } };
    expect(suggestRating(clean, list[0].m)!).toBeGreaterThan(suggestRating(sloppy, list[0].m)!);
  });
});

import { tradeScore } from "@/lib/review";
describe("trade score", () => {
  it("scores a clean win above a sloppy one and skips open trades", () => {
    const list = enrich([at(1, "14:00", 100, 120)]);
    const clean = { ...list[0].trade, reflection: { ...list[0].trade.reflection, followedPlan: "yes" as const, rating: 9 } };
    const sloppy = { ...list[0].trade, mistakes: ["Impulsive decision", "Unplanned entry"], reflection: { ...list[0].trade.reflection, followedPlan: "no" as const, rating: 3 } };
    expect(tradeScore(clean, list[0].m)!.score).toBeGreaterThan(tradeScore(sloppy, list[0].m)!.score);
    expect(tradeScore(clean, { ...list[0].m, status: "open" })).toBeNull();
  });
});
