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
