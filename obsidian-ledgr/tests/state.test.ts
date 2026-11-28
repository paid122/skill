import { describe, expect, it } from "vitest";
import { money, num, pct, r, tone } from "../src/format";
import { ago, STALE_AFTER_MS, viewState } from "../src/state";
import type { Snapshot } from "../src/types";

const NOW = 10_000_000;
const snap = (age = 0): Snapshot => ({ fetchedAt: NOW - age, data: { me: {}, stats: {}, stats30: {}, accounts: [] } as unknown as Snapshot["data"] });

describe("viewState", () => {
  it("asks to connect without a key", () => {
    expect(viewState(false, snap(), null, false, NOW).kind).toBe("connect");
  });
  it("shows loading the first time", () => {
    expect(viewState(true, null, null, true, NOW).kind).toBe("loading");
  });
  it("locks on a bad key or no Pro, even with saved data", () => {
    const s = viewState(true, snap(), { ok: false, at: NOW, errorKind: "not_pro", message: "LEDGR Pro has ended." }, false, NOW);
    expect(s).toMatchObject({ kind: "locked", reason: "not_pro", message: "LEDGR Pro has ended." });
    expect(viewState(true, snap(), { ok: false, at: NOW, errorKind: "invalid_key" }, false, NOW)).toMatchObject({ kind: "locked", reason: "invalid_key" });
  });
  it("shows live data after a good fetch", () => {
    expect(viewState(true, snap(1000), { ok: true, at: NOW }, false, NOW)).toMatchObject({ kind: "data", live: true, stale: false, warning: null });
  });
  it("keeps showing saved data offline, marked stale", () => {
    const s = viewState(true, snap(60_000), { ok: false, at: NOW, errorKind: "offline" }, false, NOW);
    expect(s).toMatchObject({ kind: "data", live: false, stale: true, warning: "Offline: showing saved data." });
  });
  it("marks old data stale even without an error (e.g. just opened)", () => {
    expect(viewState(true, snap(STALE_AFTER_MS + 1), null, true, NOW)).toMatchObject({ kind: "data", stale: true, warning: null });
  });
  it("shows an error only when there's nothing saved", () => {
    expect(viewState(true, null, { ok: false, at: NOW, errorKind: "offline", message: "Can't reach LEDGR." }, false, NOW)).toEqual({ kind: "error", message: "Can't reach LEDGR." });
  });
  it("explains a journal that was never synced", () => {
    expect(viewState(true, null, { ok: false, at: NOW, errorKind: "no_journal", message: "x" }, false, NOW).kind).toBe("no_journal");
  });
});

describe("format", () => {
  it("formats money with signs", () => {
    expect(money(1234.5)).toBe("$1,234.50");
    expect(money(-80, "USD")).toBe("-$80.00");
    expect(money(80, "USD", { sign: true })).toBe("+$80.00");
    expect(money(0, "USD", { sign: true })).toBe("$0.00");
    expect(money(null)).toBe("—");
    expect(money(5, "EUR")).toBe("€5.00");
  });
  it("formats rates, R and tone", () => {
    expect(pct(0.625)).toBe("62.5%");
    expect(pct(null)).toBe("—");
    expect(num(1.456)).toBe("1.46");
    expect(r(1.5)).toBe("+1.50R");
    expect(r(-0.5)).toBe("-0.50R");
    expect([tone(1), tone(-1), tone(0), tone(null)]).toEqual(["pos", "neg", "", ""]);
  });
  it("says how long ago", () => {
    expect(ago(NOW - 10_000, NOW)).toBe("just now");
    expect(ago(NOW - 4 * 60_000, NOW)).toBe("4 min ago");
    expect(ago(NOW - 3 * 3_600_000, NOW)).toBe("3 h ago");
    expect(ago(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
  });
});
