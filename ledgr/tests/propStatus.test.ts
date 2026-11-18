import { describe, expect, it, vi } from "vitest";
import type { EnrichedTrade } from "@/lib/calc";
import { consistencyLimit, propStatus } from "@/lib/propStatus";
import type { Account } from "@/lib/types";

vi.mock("@/lib/util", async (orig) => ({ ...(await orig<typeof import("@/lib/util")>()), today: () => "2026-11-18" }));

const acct = (p: Partial<Account> = {}): Account => ({
  id: "a1", name: "Apex 50K", type: "Funded", currency: "USD", startingBalance: 50000, status: "active", color: "#fff", goals: "",
  rules: { profitTarget: 3000, maxDrawdown: 2000, dailyLossLimit: 1000, minTradingDays: null }, createdAt: "2026-11-01T00:00:00Z",
  propFirm: "Apex Trader Funding", accountSize: 50000, propPlan: "EOD drawdown", propStage: "evaluation", ...p,
});
const tr = (date: string, net: number) => ({ trade: { id: `t${date}${net}`, accountId: "a1", date }, m: { status: "closed", net, result: net > 0 ? "win" : "loss" } }) as unknown as EnrichedTrade;

describe("prop account status", () => {
  it("trails the floor with the best end-of-day balance and stops at start + $100", () => {
    const trades = [tr("2026-11-10", 1500), tr("2026-11-11", 1500)];
    const ledger = [{ date: "2026-11-01", balance: 50000 }, { date: "2026-11-10", balance: 51500 }, { date: "2026-11-11", balance: 53000 }];
    const st = propStatus(acct(), trades, ledger, 53000);
    expect(st.floor).toBe(50100); // would be 51,000 but locks at start + 100
    expect(st.state).toBe("passed");
    expect(st.progress).toBe(1);
  });
  it("counts today's loss against the daily limit (today doesn't move an EOD floor)", () => {
    const trades = [tr("2026-11-17", 500), tr("2026-11-18", -800)];
    const ledger = [{ date: "2026-11-01", balance: 50000 }, { date: "2026-11-17", balance: 50500 }, { date: "2026-11-18", balance: 49700 }];
    const st = propStatus(acct(), trades, ledger, 49700);
    expect(st.floor).toBe(48500);
    expect(st.roomLeft).toBe(1200);
    expect(st.todayNet).toBe(-800);
    expect(st.dailyUsed).toBeCloseTo(0.8);
    expect(st.state).toBe("active");
  });
  it("flags a breach", () => {
    const st = propStatus(acct(), [tr("2026-11-12", -2100)], [{ date: "2026-11-01", balance: 50000 }, { date: "2026-11-12", balance: 47900 }], 47900);
    expect(st.state).toBe("breached");
  });
});

describe("consistencyLimit", () => {
  it("reads the cap for the stage", () => {
    expect(consistencyLimit("40% (50% option)", "evaluation")).toBe(0.4);
    expect(consistencyLimit("None to pass · 50% for payouts", "evaluation")).toBeNull();
    expect(consistencyLimit("None to pass · 50% for payouts", "funded")).toBe(0.5);
    expect(consistencyLimit("Best day < 55%", "evaluation")).toBe(0.55);
    expect(consistencyLimit("Check your dashboard", "evaluation")).toBeNull();
  });
});
