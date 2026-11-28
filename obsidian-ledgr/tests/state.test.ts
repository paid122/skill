import { describe, expect, it } from "vitest";
import { money, num, pct, r, tone } from "../src/format";
import { ago, mode } from "../src/state";

const NOW = 10_000_000;

describe("mode", () => {
  it("asks to connect without a key", () => { expect(mode(false, null).kind).toBe("connect"); });
  it("shows the command center when connected, and offline (cached trades, marked stale inside)", () => {
    expect(mode(true, null).kind).toBe("cc");
    expect(mode(true, { ok: true, at: NOW }).kind).toBe("cc");
    expect(mode(true, { ok: false, at: NOW, errorKind: "offline", message: "x" }).kind).toBe("cc");
    expect(mode(true, { ok: false, at: NOW, errorKind: "rate_limited" }).kind).toBe("cc");
  });
  it("locks on a bad key or no Pro", () => {
    expect(mode(true, { ok: false, at: NOW, errorKind: "not_pro", message: "LEDGR Pro has ended." })).toEqual({ kind: "locked", reason: "not_pro", message: "LEDGR Pro has ended." });
    expect(mode(true, { ok: false, at: NOW, errorKind: "invalid_key" })).toMatchObject({ kind: "locked", reason: "invalid_key" });
  });
  it("explains a journal that was never synced", () => {
    expect(mode(true, { ok: false, at: NOW, errorKind: "no_journal", message: "x" }).kind).toBe("no_journal");
  });
});

describe("format", () => {
  it("formats money with signs", () => {
    expect(money(1234.5)).toBe("$1,234.50");
    expect(money(-80, "USD")).toBe("-$80.00");
    expect(money(80, "USD", { sign: true })).toBe("+$80.00");
    expect(money(null)).toBe("—");
  });
  it("formats rates, R and tone", () => {
    expect(pct(0.625)).toBe("62.5%");
    expect(num(1.456)).toBe("1.46");
    expect(r(-0.5)).toBe("-0.50R");
    expect([tone(1), tone(-1), tone(0), tone(null)]).toEqual(["pos", "neg", "", ""]);
  });
  it("says how long ago", () => {
    expect(ago(NOW - 10_000, NOW)).toBe("just now");
    expect(ago(NOW - 4 * 60_000, NOW)).toBe("4 min ago");
    expect(ago(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
  });
});
