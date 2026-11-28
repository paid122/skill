import { describe, expect, it } from "vitest";
import { hashKey, KEY_PREFIX, newKey, pickTrades, shownPrefix } from "../src/lib/apiServer";
import { apiTradeToTrade, parseApiTrade, publicTrade } from "../src/lib/apiTrade";
import { validateTrade } from "../src/lib/actions";
import { enrich, tradeMetrics } from "../src/lib/calc";
import { emptyState } from "../src/lib/defaults";
import type { Account } from "../src/lib/types";

const accounts = [{ id: "acc_1", name: "Apex 50K", status: "active" }, { id: "acc_old", name: "Old", status: "archived" }] as Pick<Account, "id" | "name" | "status">[];

describe("API keys", () => {
  it("makes long random keys and stores only a hash", () => {
    const a = newKey(), b = newKey();
    expect(a.startsWith(KEY_PREFIX)).toBe(true);
    expect(a.length).toBeGreaterThan(KEY_PREFIX.length + 40);
    expect(a).not.toBe(b);
    expect(hashKey(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(a)).toBe(hashKey(a));
    expect(shownPrefix(a)).toBe(a.slice(0, KEY_PREFIX.length + 6));
  });
});

describe("parseApiTrade", () => {
  it("takes a simple closed futures trade and works out the point value", () => {
    const x = parseApiTrade({ symbol: "nqz6", direction: "long", quantity: 2, entryPrice: 21050.25, exitPrice: 21082.5, entryTime: "2026-11-27T14:31:00Z", exitTime: "2026-11-27T14:48:00Z", fees: 4.2, account: "apex 50k", externalId: "abc" }, accounts);
    expect(x.symbol).toBe("NQ");
    expect(x.market).toBe("Futures");
    expect(x.pointValue).toBe(20);
    expect(x.accountId).toBe("acc_1");
    expect(x.executions).toHaveLength(2);
    const t = apiTradeToTrade(x, "inbox-1");
    validateTrade(t);
    const m = tradeMetrics(t);
    expect(m.status).toBe("closed");
    expect(m.net).toBeCloseTo((21082.5 - 21050.25) * 2 * 20 - 4.2, 6);
    expect(t.importKey).toBe("api:abc");
  });

  it("accepts buy/sell, executions for scaling, and pnl-only trades", () => {
    expect(parseApiTrade({ symbol: "EURUSD", side: "sell", pnl: -45 }, accounts).direction).toBe("short");
    const scaled = parseApiTrade({ symbol: "ES", direction: "short", executions: [
      { kind: "entry", price: 6000, quantity: 2, time: "2026-11-27T15:00:00Z" },
      { kind: "exit", price: 5995, quantity: 1, time: "2026-11-27T15:05:00Z" },
      { kind: "exit", price: 5990, quantity: 1, time: "2026-11-27T15:10:00Z" },
    ] }, accounts);
    expect(tradeMetrics(apiTradeToTrade(scaled, "i")).net).toBeCloseTo((5 + 10) * 50, 6);
    const open = parseApiTrade({ symbol: "MNQ", direction: "long", quantity: 1, entryPrice: 21000 }, accounts);
    expect(tradeMetrics(apiTradeToTrade(open, "i")).status).toBe("open");
    expect(apiTradeToTrade(open, "inbox-9").importKey).toBe("api:inbox-9");
  });

  it("explains what's wrong", () => {
    expect(() => parseApiTrade({ direction: "long" }, accounts)).toThrow(/symbol is required/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "up" }, accounts)).toThrow(/direction/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "long" }, accounts)).toThrow(/entryPrice/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "long", entryPrice: 1 }, accounts)).toThrow(/quantity is required/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "long", quantity: -1, entryPrice: 1 }, accounts)).toThrow(/greater than zero/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "long", quantity: 1, entryPrice: 1, entryTime: "soon" }, accounts)).toThrow(/date and time/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "long", pnl: 5, account: "Nope" }, accounts)).toThrow(/No account/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "long", pnl: 5, account: "Old" }, accounts)).toThrow(/No account/);
    expect(() => parseApiTrade({ symbol: "NQ", direction: "long", executions: [{ kind: "entry", price: 1, quantity: 1 }, { kind: "exit", price: 2, quantity: 3 }] }, accounts)).toThrow(/Exited quantity/);
    expect(() => parseApiTrade([] as unknown as Record<string, unknown>, accounts)).toThrow(/JSON object/);
  });
});

describe("reading the journal", () => {
  const state = emptyState();
  state.accounts = [
    { id: "a1", name: "Main", type: "Funded", status: "active" } as Account,
    { id: "p1", name: "Paper", type: "Paper", status: "active" } as Account,
  ];
  const mk = (id: string, accountId: string, date: string, extra = {}) => ({ ...apiTradeToTrade(parseApiTrade({ symbol: "NQ", direction: "long", quantity: 1, entryPrice: 100, exitPrice: 101, entryTime: `${date}T15:00:00Z` }, state.accounts), id), accountId, date, ...extra });
  state.trades = [mk("1", "a1", "2026-11-01"), mk("2", "a1", "2026-11-20"), mk("3", "p1", "2026-11-20"), mk("4", "a1", "2026-11-20", { copyOf: "x" })];
  const j = { state, trades: enrich(state.trades), syncedAt: "" };

  it("leaves out paper and copied trades unless an account is asked for", () => {
    expect(pickTrades(j, new URL("http://x/?")).list).toHaveLength(2);
    expect(pickTrades(j, new URL("http://x/?account=Paper")).list).toHaveLength(1);
    expect(pickTrades(j, new URL("http://x/?from=2026-11-10")).list).toHaveLength(1);
    expect(pickTrades(j, new URL("http://x/?from=nov")).error?.status).toBe(400);
    expect(pickTrades(j, new URL("http://x/?account=nope")).error?.status).toBe(404);
  });

  it("returns a clean public trade", () => {
    const p = publicTrade(j.trades[0], []);
    expect(p).toMatchObject({ symbol: "NQ", direction: "long", status: "closed", result: "win", net: 20, quantity: 1, entryPrice: 100, exitPrice: 101 });
    expect(p).not.toHaveProperty("activity");
  });
});

describe("Connect with LEDGR codes", async () => {
  const { newUserCode, normalizeUserCode, cleanClient, newDeviceCode } = await import("../src/lib/deviceConnect");
  it("makes readable user codes and accepts them however they're typed", () => {
    for (let i = 0; i < 50; i++) expect(newUserCode()).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    expect(normalizeUserCode("k7qx 3mrt")).toBe("K7QX-3MRT");
    expect(normalizeUserCode("K7QX-3MRT")).toBe("K7QX-3MRT");
    expect(normalizeUserCode("K7QX-3MR")).toBeNull();
    expect(normalizeUserCode("K0QX-3MRT")).toBeNull(); // 0 isn't used
  });
  it("makes long secret device codes and cleans app names", () => {
    expect(newDeviceCode().length).toBeGreaterThan(40);
    expect(newDeviceCode()).not.toBe(newDeviceCode());
    expect(cleanClient("Obsidian <script>")).toBe("Obsidian script");
    expect(cleanClient("")).toBe("App");
  });
});
