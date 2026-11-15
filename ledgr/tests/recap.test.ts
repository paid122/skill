import { describe, expect, it } from "vitest";
import type { EnrichedTrade } from "@/lib/calc";
import { buildRecap, monthStart, periodEnd, recapPeriods, weekRows, weekStart } from "@/lib/recap";

const t = (date: string, net: number | null, r: number | null, status = "closed") =>
  ({ trade: { date, accountId: "a" }, m: { status, net, r } }) as unknown as EnrichedTrade;

describe("recap", () => {
  it("finds Monday-start weeks and month bounds", () => {
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sunday → previous Monday
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(periodEnd("week", "2026-11-09")).toBe("2026-11-15");
    expect(monthStart("2026-10-19")).toBe("2026-10-01");
    expect(periodEnd("month", "2026-02-01")).toBe("2026-02-28");
  });
  it("totals a week with win rate, green days and best day", () => {
    const all = [t("2026-11-09", 100, 1), t("2026-11-09", -40, -0.4), t("2026-11-11", -20, -0.2), t("2026-11-12", 300, 3), t("2026-11-16", 999, 9), t("2026-11-10", 50, 0.5, "open")];
    const r = buildRecap(all, "week", "2026-11-09", true);
    expect(r.total).toBe(340);
    expect(r.trades).toBe(4);
    expect(r.winRate).toBe(0.5);
    expect(r.greenDays).toBe(2);
    expect(r.days.length).toBe(3);
    expect(r.best?.date).toBe("2026-11-12");
    expect(r.curve.map((p) => p.value)).toEqual([0, 60, 40, 340]);
    expect(weekRows(r).map((x) => x.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });
  it("uses R when amounts are hidden and lists periods newest first", () => {
    const all = [t("2026-10-05", 100, 1), t("2026-11-02", 50, null), t("2026-11-03", 20, 0.2)];
    expect(buildRecap(all, "month", "2026-11-01", false).total).toBeCloseTo(0.2);
    expect(recapPeriods(all, "month", true)).toEqual(["2026-11-01", "2026-10-01"]);
  });
});
