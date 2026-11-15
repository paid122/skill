import { describe, expect, it } from "vitest";
import type { EnrichedTrade } from "@/lib/calc";
import { buildStudyPlan, youtubeSearchUrl } from "@/lib/studyPlan";

let n = 0;
const t = (o: { net: number; r: number; mistakes?: string[]; followed?: "yes" | "partial" | "no"; emotions?: string[]; setup?: string; date?: string }) => ({
  trade: { id: `t${++n}`, date: o.date ?? `2026-11-${String((n % 20) + 1).padStart(2, "0")}`, mistakes: o.mistakes ?? [], emotions: o.emotions ?? [], setup: o.setup ?? "", reflection: { followedPlan: o.followed ?? null }, executions: [] },
  m: { status: "closed", net: o.net, r: o.r, risk: 100, result: o.net > 0 ? "win" : o.net < 0 ? "loss" : "breakeven", durationMinutes: null },
}) as unknown as EnrichedTrade;

describe("study plan", () => {
  it("needs at least 5 closed trades", () => {
    expect(buildStudyPlan([t({ net: 10, r: 0.1 })]).focus).toEqual([]);
  });
  it("puts the most documented mistake first, with evidence and searches", () => {
    const list = [
      ...Array.from({ length: 4 }, () => t({ net: -50, r: -0.5, mistakes: ["Revenge trade"] })),
      ...Array.from({ length: 6 }, () => t({ net: 80, r: 0.8 })),
    ];
    const plan = buildStudyPlan(list);
    expect(plan.focus[0].title).toBe("Revenge trading");
    expect(plan.focus[0].why).toContain("4 of your last 10");
    expect(plan.focus[0].queries[0]).toContain("revenge");
  });
  it("flags plan adherence and bigger losses than wins", () => {
    const list = [
      ...Array.from({ length: 4 }, () => t({ net: -200, r: -2, followed: "no" })),
      ...Array.from({ length: 4 }, () => t({ net: 50, r: 0.5, followed: "yes" })),
    ];
    const keys = buildStudyPlan(list).focus.map((f) => f.key);
    expect(keys).toContain("plan");
    expect(keys).toContain("payoff");
  });
  it("falls back to a review habit when nothing stands out", () => {
    const list = Array.from({ length: 6 }, () => t({ net: 100, r: 1 }));
    expect(buildStudyPlan(list).focus.map((f) => f.key)).toEqual(["review"]);
  });
  it("builds real YouTube search links", () => {
    expect(youtubeSearchUrl("stop overtrading")).toBe("https://www.youtube.com/results?search_query=stop%20overtrading");
  });
});
