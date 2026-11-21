import { describe, expect, it } from "vitest";
import { blankTrade } from "@/lib/defaults";
import { weeklyStreak, weekScore } from "@/lib/weekly";
import type { WeeklyJournal } from "@/lib/types";

const wk = (weekStart: string, done = true): WeeklyJournal => ({ id: weekStart, weekStart, reflection: done ? "ok" : "", progress: done ? "p" : "", recurringMistakes: "", lessons: "", nextObjectives: [], updatedAt: "" });

describe("weekly streak", () => {
  it("counts back from last week when this week isn't written yet", () => {
    const s = weeklyStreak([wk("2026-11-02"), wk("2026-11-09"), wk("2026-10-19")], "2026-11-18");
    expect(s).toEqual({ current: 2, best: 2, thisWeekDone: false });
  });
  it("includes this week once written, and ignores empty reviews", () => {
    const s = weeklyStreak([wk("2026-11-09"), wk("2026-11-16"), wk("2026-11-02", false)], "2026-11-18");
    expect(s.current).toBe(2);
    expect(s.thisWeekDone).toBe(true);
  });
});

describe("week score", () => {
  it("is null with nothing to score, and rewards a written review", () => {
    expect(weekScore([], [], undefined).score).toBeNull();
    const t = { ...blankTrade(1, "a"), isDraft: false, reflection: { ...blankTrade(1, "a").reflection, followedPlan: "yes" as const, rating: 8 } };
    const empty = weekScore([t], [], undefined).score!;
    const full = weekScore([t], [], { ...wk("2026-11-16"), recurringMistakes: "x", lessons: "y", nextObjectives: ["z"] }).score!;
    expect(full).toBeGreaterThan(empty);
  });
});
