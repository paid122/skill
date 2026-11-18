import { describe, expect, it } from "vitest";
import { firmSizes, presetRules } from "@/lib/propRules";

describe("prop firm presets", () => {
  it("fills Apex 50K EOD evaluation rules", () => {
    const p = presetRules("Apex Trader Funding", "EOD drawdown", 50000, "evaluation")!;
    expect(p.rules).toEqual({ profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1000, minTradingDays: null });
    expect(p.maxContracts).toContain("6 minis");
  });
  it("has no daily limit on Apex intraday, and no profit target once funded", () => {
    const p = presetRules("Apex Trader Funding", "Intraday trailing", 100000, "funded")!;
    expect(p.rules).toEqual({ profitTarget: null, maxDrawdown: 3000, dailyLossLimit: null, minTradingDays: null });
  });
  it("fills Lucid and respects the optional daily loss limit", () => {
    expect(presetRules("Lucid Trading", "LucidPro", 150000, "evaluation")!.rules.maxDrawdown).toBe(4500);
    expect(presetRules("Lucid Trading", "LucidFlex", 50000, "evaluation", false)!.rules.dailyLossLimit).toBeNull();
    expect(presetRules("Lucid Trading", "LucidFlex", 50000, "evaluation", true)!.rules.dailyLossLimit).toBe(1200);
    expect(presetRules("Lucid Trading", "LucidFlex", 50000, "evaluation")!.rules.dailyLossLimit).toBeNull(); // off unless bought
  });
  it("has no preset for Other, and sells 25K-150K", () => {
    expect(presetRules("Other", null, 50000, "evaluation")).toBeNull();
    expect(firmSizes("Apex Trader Funding")).toEqual([25000, 50000, 100000, 150000]);
  });
});
