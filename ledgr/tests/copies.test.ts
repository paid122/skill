import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/store", () => ({ deleteBlob: vi.fn(), getState: vi.fn(), setState: vi.fn() }));
import { withCopies } from "@/lib/actions";
import { blankTrade, emptyState } from "@/lib/defaults";
import type { Account } from "@/lib/types";

const acct = (id: string, copyOf: string | null = null): Account => ({ id, name: id, type: "Funded", currency: "USD", startingBalance: 50000, status: "active", color: "", goals: "", rules: { profitTarget: null, maxDrawdown: null, dailyLossLimit: null, minTradingDays: null }, copyOf, createdAt: "" });

describe("copy trading", () => {
  it("copies a lead trade to each follower and keeps copies in sync", () => {
    const s = { ...emptyState(), accounts: [acct("lead"), acct("f1", "lead"), acct("f2", "lead"), acct("other")] };
    const lead = { ...blankTrade(1, "lead"), isDraft: false, symbol: "MNQ" };
    const first = withCopies(s, [lead], [lead]);
    const copies = first.filter((x) => x.copyOf === lead.id);
    expect(copies.map((c) => c.accountId).sort()).toEqual(["f1", "f2"]);
    expect(new Set(first.map((x) => x.number)).size).toBe(3);
    // edit the lead: copies update in place (same ids and numbers), no new copies
    const edited = { ...lead, symbol: "NQ" };
    const second = withCopies(s, first.map((x) => (x.id === lead.id ? edited : x)), [edited]);
    expect(second).toHaveLength(3);
    expect(second.filter((x) => x.copyOf).every((x) => x.symbol === "NQ")).toBe(true);
    expect(second.filter((x) => x.copyOf).map((x) => x.id).sort()).toEqual(copies.map((c) => c.id).sort());
  });
  it("doesn't copy trades from accounts nobody copies, or copies of copies", () => {
    const s = { ...emptyState(), accounts: [acct("a"), acct("b", "a")] };
    const t = { ...blankTrade(1, "b"), isDraft: false };
    expect(withCopies(s, [t], [t])).toHaveLength(1);
  });
});
