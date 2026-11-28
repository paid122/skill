import { describe, expect, it } from "vitest";
import { toEvents } from "../src/cc/calendar";
import { prof, rootOf } from "../src/cc/instruments";
import { behaviour, brainLabels, closedOf, crossed, focusOf, guardState, GUARD_DEFAULT, instrumentsOf, newsClear, norm, S, sessOf, sizeFor, zone, type ApiTrade, type CalEvent, type Trade } from "../src/cc/logic";
import { EMPTY_CACHE, mergeWindow, needsFull, PAGE, syncTrades } from "../src/cc/sync";
import { chartUrl, embedUrl } from "../src/cc/tradingview";

const T0 = Date.UTC(2026, 10, 27, 14, 0); // Fri 27 Nov 2026 14:00 UTC
const api = (over: Partial<ApiTrade> = {}): ApiTrade => ({
  id: "t" + Math.random().toString(36).slice(2), symbol: "MGCZ6", direction: "long", status: "closed", date: "2026-11-27", quantity: 2, entryPrice: 2650, exitPrice: 2655,
  pointValue: 10, net: 100, r: 1, setup: "ORB", strategy: null, accountId: "a1", openedAt: new Date(T0).toISOString(),
  executions: [{ kind: "entry", time: new Date(T0).toISOString() }, { kind: "exit", time: new Date(T0 + 15 * 60e3).toISOString() }], ...over,
});
const tr = (net: number, minutes: number, extra: Partial<Trade> = {}): Trade => ({ ...norm(api({ net })), time: new Date(T0 + minutes * 60e3), ...extra });

describe("instruments", () => {
  it("finds the root of futures symbols", () => {
    expect(rootOf("MGCZ6")).toBe("MGC");
    expect(rootOf("COMEX:MGC1!")).toBe("MGC");
    expect(rootOf("mnqh27")).toBe("MNQ");
    expect(rootOf("EURUSD")).toBe("EURUSD");
  });
  it("uses the instrument's point value: MGC = $10/point, $1/tick", () => {
    const p = prof("MGC");
    expect([p.pv, p.tick, p.pv * p.tick, p.tv, p.px]).toEqual([10, 0.1, 1, "COMEX:MGC1!", "OANDA:XAUUSD"]);
    expect(prof("MGC", 12).pv).toBe(12); // the journal's own point value wins
    expect(prof("EURUSD").ccy).toEqual(["EUR", "USD"]);
  });
});

describe("trades from the API", () => {
  it("normalises real field names, closing time from the last exit", () => {
    const t = norm(api());
    expect([t.root, t.dir, t.qty, t.en, t.ex, t.pts, t.net, t.r, t.setup]).toEqual(["MGC", "long", 2, 2650, 2655, 5, 100, 1, "ORB"]);
    expect(+t.time!).toBe(T0 + 15 * 60e3);
    expect(+t.tin!).toBe(T0);
  });
  it("handles trades logged without times or prices", () => {
    const t = norm(api({ executions: [], openedAt: null, entryPrice: null, exitPrice: null, net: -40, direction: "short", setup: null, strategy: "Breakout" }));
    expect(t.time!.toISOString()).toBe("2026-11-27T12:00:00.000Z");
    expect([t.dir, isNaN(t.pts), t.setup]).toEqual(["short", true, "Breakout"]);
  });
  it("keeps only closed trades with a result, oldest first", () => {
    const c = closedOf([tr(50, 30), tr(10, 10), norm(api({ status: "open", net: null })), norm(api({ status: "draft", net: null }))]);
    expect(c.map((x) => x.net)).toEqual([10, 50]);
  });
});

describe("stats", () => {
  it("works out win rate, profit factor, drawdown and average R", () => {
    const s = S([tr(100, 0, { r: 1 }), tr(-50, 1, { r: -0.5 }), tr(-50, 2, { r: -0.5 }), tr(0, 3, { r: 0 }), tr(200, 4, { r: 2 })]);
    expect(s.n).toBe(5);
    expect(s.net).toBe(200);
    expect(s.win).toBeCloseTo(2 / 4); // breakeven doesn't count, like LEDGR
    expect(s.pf).toBeCloseTo(300 / 100);
    expect(s.dd).toBe(100);
    expect(s.avgR).toBeCloseTo(0.4);
    expect(S([tr(10, 0)]).pf).toBe(Infinity);
    expect(isNaN(S([]).win)).toBe(true);
  });
  it("puts sessions in UTC windows", () => {
    expect(sessOf(new Date(Date.UTC(2026, 0, 1, 3)))).toBe("ASIA");
    expect(sessOf(new Date(Date.UTC(2026, 0, 1, 8)))).toBe("LONDON");
    expect(sessOf(new Date(Date.UTC(2026, 0, 1, 14)))).toBe("NEW YORK");
    expect(sessOf(new Date(Date.UTC(2026, 0, 1, 22)))).toBe("ASIA");
  });
  it("spots quick re-entries after a loss and losses beyond -1.2R", () => {
    const c = [tr(-50, 0, { r: -1.5 }), tr(20, 10), tr(-30, 60, { r: -1 }), tr(40, 100)];
    expect(behaviour(c)).toEqual({ tilt: 1, bigL: 1 });
    const l = brainLabels(c);
    expect(l.PSYCHE).toBe("1 quick re-entries after losses");
    expect(l.RULES).toBe("1 losses beyond -1.2R");
    expect(brainLabels([]).STRATEGY).toBe("awaiting data");
  });
  it("builds the instrument menu from the journal", () => {
    const all = [norm(api({ symbol: "MNQZ6" })), norm(api({ symbol: "MGCZ6" })), norm(api({ symbol: "MGCG7" }))];
    const { list, cnt } = instrumentsOf(all);
    expect(list).toEqual(["MGC", "MNQ"]);
    expect(cnt.MGC).toBe(2);
    expect(focusOf(all, list, "AUTO").cur.code).toBe("MGC");
    expect(focusOf(all, list, "AUTO").trades).toHaveLength(2);
    expect(focusOf(all, list, "ALL").trades).toHaveLength(3);
    expect(focusOf(all, list, "MNQ").cur.pv).toBe(10); // from the journal's pointValue on that trade
  });
});

describe("time zone", () => {
  it("gives the local day in the user's zone", () => {
    const d = new Date(Date.UTC(2026, 10, 27, 21, 30)); // 21:30 UTC
    expect(zone("Asia/Dubai").dayKey(d)).toBe("2026-11-28"); // 01:30 Dubai
    expect(zone("America/New_York").dayKey(d)).toBe("2026-11-27");
    expect(zone("Asia/Dubai").tzOff(d)).toBe(4 * 3600e3);
  });
});

describe("risk guard", () => {
  const now = T0 + 120 * 60e3;
  it("is clear within the limits", () => {
    expect(guardState([tr(50, 0)], GUARD_DEFAULT, now)).toMatchObject({ lvl: "OK", why: [] });
  });
  it("stops at the daily loss limit, max trades or losses in a row", () => {
    expect(guardState([tr(-200, 0)], GUARD_DEFAULT, now)).toMatchObject({ lvl: "STOP", why: expect.arrayContaining(["daily loss limit hit"]) });
    expect(guardState([tr(10, 0), tr(10, 1), tr(10, 2), tr(10, 3)], GUARD_DEFAULT, now).why).toContain("max trades reached");
    expect(guardState([tr(-10, 0), tr(-10, 1)], GUARD_DEFAULT, now).why).toContain("2 losses in a row");
  });
  it("warns near the limits and during the cool-down after a loss", () => {
    expect(guardState([tr(-150, 0)], GUARD_DEFAULT, now).why).toContain("near loss limit");
    expect(guardState([tr(10, 0), tr(10, 1), tr(10, 2)], GUARD_DEFAULT, now).why).toContain("one trade left");
    const cool = guardState([tr(-10, 110)], GUARD_DEFAULT, now); // lost 10 minutes ago, 20-minute cool-down
    expect(cool.lvl).toBe("CAUTION");
    expect(cool.coolLeft).toBe(10 * 60e3);
    expect(cool.why).toContain("one more loss = stop");
  });
});

describe("position size", () => {
  const mgc = prof("MGC");
  it("sizes MGC from the point value and fees", () => {
    // $5,000 × 1% = $50; stop 4 points × $10 = $40 + $1.24 fees = $41.24 per contract → 1 contract
    const r = sizeFor(mgc, { acc: 5000, pct: 1, fee: 1.24, max: 10 }, 2650, 2646)!;
    expect([r.contracts, r.dir, r.dist, r.ticks]).toEqual([1, "LONG", 4, 40]);
    expect(r.perContract).toBeCloseTo(41.24);
    expect(r.target(1)).toBe(2654);
    expect(r.target(3)).toBe(2662);
    expect(r.reward(2)).toBe(80);
  });
  it("handles shorts, caps at max contracts and refuses a missing stop", () => {
    const s = sizeFor(mgc, { acc: 100000, pct: 2, fee: 0, max: 5 }, 2650, 2652)!;
    expect([s.dir, s.raw, s.contracts, s.capped, s.target(1)]).toEqual(["SHORT", 100, 5, true, 2648]);
    expect(sizeFor(mgc, { acc: 5000, pct: 1, fee: 0, max: 5 }, 2650, 2650)).toBeNull();
    expect(sizeFor(mgc, { acc: 5000, pct: 1, fee: 0, max: 5 }, NaN, 2650)).toBeNull();
    expect(sizeFor(mgc, { acc: 500, pct: 1, fee: 0, max: 5 }, 2650, 2600)!.contracts).toBe(0);
  });
});

describe("news", () => {
  const ev = (minutes: number, country = "USD", impact = "High"): CalEvent => toEvents({ events: [{ title: "CPI", country, impact, date: new Date(T0 + minutes * 60e3).toISOString() }] })[0];
  it("is clear only without high-impact news for the instrument's currencies in the next 30 minutes", () => {
    expect(newsClear(null, ["USD"], T0)).toBeNull();
    expect(newsClear([], ["USD"], T0)).toBe(true);
    expect(newsClear([ev(20)], ["USD"], T0)).toBe(false);
    expect(newsClear([ev(-3)], ["USD"], T0)).toBe(false);
    expect(newsClear([ev(45)], ["USD"], T0)).toBe(true);
    expect(newsClear([ev(20, "EUR")], ["USD"], T0)).toBe(true);
    expect(newsClear([ev(20, "USD", "Medium")], ["USD"], T0)).toBe(true);
  });
  it("alerts at 15, 5 and 1 minutes and at release", () => {
    expect(crossed(undefined, 14 * 60e3)).toEqual([]);
    expect(crossed(15 * 60e3 + 500, 15 * 60e3 - 500)).toEqual([15]);
    expect(crossed(60e3 + 10, 60e3 - 10)).toEqual([1]);
    expect(crossed(500, -500)).toEqual([0]);
  });
});

describe("trade sync", () => {
  const page = (n: number, date = "2026-11-27") => Array.from({ length: n }, (_, i) => api({ id: `p${date}-${i}`, date }));
  it("downloads everything the first time, page by page", async () => {
    const calls: string[] = [];
    const all = page(PAGE + 20);
    const get = async <T,>(p: string) => { calls.push(p); const off = +new URLSearchParams(p.split("?")[1]).get("offset")!; return { trades: all.slice(off, off + PAGE), total: all.length } as T; };
    const c = await syncTrades(get, EMPTY_CACHE, T0, "2026-11-27");
    expect(calls).toEqual([`/trades?limit=${PAGE}&offset=0`, `/trades?limit=${PAGE}&offset=${PAGE}`]);
    expect(c.trades).toHaveLength(PAGE + 20);
    expect(c.lastFull).toBe(T0);
  });
  it("then fetches only changed trades, and mirrors edits and deletions exactly", async () => {
    const old = [api({ id: "a", date: "2026-10-01" }), api({ id: "b", date: "2026-10-02", net: 1 }), api({ id: "gone", date: "2026-11-26" })];
    const cache = { trades: old, lastSync: T0, lastFull: T0, syncedDay: "2026-11-27" };
    const calls: string[] = [];
    const get = async <T,>(p: string) => { calls.push(p); return { trades: [api({ id: "b", date: "2026-10-02", net: 99 }), api({ id: "new", date: "2026-11-28" })], total: 2, ids: ["a", "b", "new"] } as T; };
    const c = await syncTrades(get, cache, T0 + 3600e3, "2026-11-28");
    expect(calls).toEqual([`/trades?limit=${PAGE}&offset=0&updatedSince=${encodeURIComponent(new Date(T0 - 10 * 60e3).toISOString())}`]);
    expect(c.trades.map((t) => t.id).sort()).toEqual(["a", "b", "new"]); // "gone" was deleted in LEDGR
    expect(c.trades.find((t) => t.id === "b")!.net).toBe(99); // an edit to an old trade comes straight through
    expect(c.lastFull).toBe(T0);
  });
  it("treats an older LEDGR's answer (no ids) as the full journal", async () => {
    const cache = { trades: [api({ id: "x" })], lastSync: T0, lastFull: T0, syncedDay: "2026-11-27" };
    const get = async <T,>() => ({ trades: [api({ id: "y" })], total: 1 }) as T;
    const c = await syncTrades(get, cache, T0 + 3600e3, "2026-11-28");
    expect(c.trades.map((t) => t.id)).toEqual(["y"]);
    expect(c.lastFull).toBe(T0 + 3600e3);
  });
  it("does a full sync when asked, or once a day", () => {
    const c = { trades: [], lastSync: T0, lastFull: T0, syncedDay: "2026-11-27" };
    expect(needsFull(c, T0 + 3600e3, false)).toBe(false);
    expect(needsFull(c, T0 + 3600e3, true)).toBe(true);
    expect(needsFull(c, T0 + 25 * 3600e3, false)).toBe(true);
    expect(mergeWindow([api({ id: "x", date: "2026-11-01" })], [], "2026-11-20")).toHaveLength(1);
  });
});

describe("TradingView iframes", () => {
  it("builds the same embed URL as TradingView's script", () => {
    // Captured from embed-widget-single-quote.js with the prototype's config.
    expect(embedUrl("single-quote", { symbol: "OANDA:XAUUSD", width: "100%", isTransparent: false, colorTheme: "dark", locale: "en" })).toBe(
      "https://www.tradingview-widget.com/embed-widget/single-quote/?locale=en#" +
      encodeURIComponent(JSON.stringify({ symbol: "OANDA:XAUUSD", width: "100%", isTransparent: false, colorTheme: "dark", height: 101, utm_source: "", utm_medium: "widget", utm_campaign: "single-quote", "page-uri": "__NHTTP__" })));
    const tl = embedUrl("timeline", { feedMode: "symbol", symbol: "OANDA:XAUUSD", isTransparent: true, displayMode: "regular", width: "100%", height: "100%", colorTheme: "dark", locale: "en" });
    expect(tl.startsWith("https://www.tradingview-widget.com/embed-widget/timeline/?symbol=OANDA%3AXAUUSD#")).toBe(true);
    expect(JSON.parse(decodeURIComponent(tl.split("#")[1]))).not.toHaveProperty("feedMode");
    const tape = JSON.parse(decodeURIComponent(embedUrl("ticker-tape", { symbols: [], colorTheme: "dark", locale: "en" }).split("#")[1]));
    expect([tape.width, tape.height, tape.locale]).toEqual(["100%", 84, undefined]);
  });
  it("builds the CHART tab's widgetembed URL like tv.js", () => {
    const u = chartUrl({ symbol: "COMEX:MGC1!", interval: "5", timezone: "Asia/Dubai", theme: "dark", style: "1", locale: "en", backgroundColor: "rgba(12,12,12,1)", gridColor: "rgba(122,122,122,0.25)", hide_side_toolbar: false, allow_symbol_change: true, withdateranges: true, overrides: { a: "#fff" }, frameId: "tradingview_x" });
    expect(u.startsWith("https://s.tradingview.com/widgetembed/?hideideas=1&overrides=")).toBe(true);
    const h = JSON.parse(decodeURIComponent(u.split("#")[1]));
    expect([h.symbol, h.frameElementId, h.allow_symbol_change, h.timezone]).toEqual(["COMEX:MGC1!", "tradingview_x", "1", "Asia/Dubai"]);
  });
});

describe("canvas sizing", () => {
  it("keeps a fixed-height canvas the same size on a 2× screen, redraw after redraw", async () => {
    const { fit } = await import("../src/cc/canvas/fit");
    const attrs: Record<string, string> = { height: "70" };
    const parent = { clientWidth: 258, offsetHeight: 120, offsetTop: 0 }; // 260 wide with a 1px border
    const cv = {
      dataset: {} as Record<string, string>, style: {} as Record<string, string>, offsetTop: 30, nextElementSibling: null, parentElement: parent,
      ownerDocument: { defaultView: { devicePixelRatio: 2, getComputedStyle: () => ({ borderLeftWidth: "1px", borderRightWidth: "1px", paddingLeft: "12px", paddingRight: "12px" }) } },
      getAttribute: (k: string) => attrs[k] ?? null,
      set width(v: number) { attrs.width = String(v); }, set height(v: number) { attrs.height = String(v); },
      getContext: () => ({ setTransform: () => undefined }),
    } as unknown as HTMLCanvasElement;
    for (let i = 0; i < 5; i++) expect(fit(cv)).toMatchObject({ w: 234, h: 70 });
    expect(attrs.height).toBe("140");
  });
});
