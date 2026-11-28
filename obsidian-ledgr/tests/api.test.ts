import { describe, expect, it } from "vitest";
import { errorFrom, isoDate, LedgrApiError, LedgrClient, RateLimiter, type HttpRequest, type HttpResponse } from "../src/api";

const KEY = "ledgr_sk_testtesttesttesttesttest";
const ok = (json: unknown): HttpResponse => ({ status: 200, headers: {}, json });
const fail = (status: number, code: string, message = "nope", headers: Record<string, string> = {}): HttpResponse => ({ status, headers, json: { error: { code, message } } });

function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; }, sleep: async (ms: number) => { t += ms; } };
}

function client(answer: (req: HttpRequest) => HttpResponse | Promise<HttpResponse>, key: string | null = KEY) {
  const clock = fakeClock();
  const calls: HttpRequest[] = [];
  const c = new LedgrClient({
    transport: async (req) => { calls.push(req); return answer(req); },
    getKey: () => key, now: clock.now, limiter: new RateLimiter(100, 60_000, clock.now, clock.sleep),
  });
  return { c, calls, clock };
}

describe("errorFrom", () => {
  it("maps LEDGR's answers to error kinds", () => {
    expect(errorFrom(fail(401, "invalid_key")).kind).toBe("invalid_key");
    expect(errorFrom(fail(402, "pro_ended", "LEDGR Pro has ended")).kind).toBe("not_pro");
    expect(errorFrom(fail(402, "pro_ended", "LEDGR Pro has ended")).message).toBe("LEDGR Pro has ended");
    expect(errorFrom(fail(404, "no_journal")).kind).toBe("no_journal");
    expect(errorFrom(fail(404, "no_account")).kind).toBe("server");
    expect(errorFrom(fail(500, "server_error")).kind).toBe("server");
    const rl = errorFrom(fail(429, "rate_limited", "slow down", { "retry-after": "12" }));
    expect([rl.kind, rl.retryAfterMs]).toEqual(["rate_limited", 12_000]);
    expect(errorFrom(fail(429, "rate_limited")).retryAfterMs).toBe(30_000);
    expect(errorFrom({ status: 502, headers: {}, json: null }).message).toMatch(/502/);
  });
});

describe("LedgrClient", () => {
  it("sends the key as a Bearer header to the LEDGR API", async () => {
    const { c, calls } = client(() => ok({ hi: 1 }));
    await c.get("/me");
    expect(calls[0].url).toBe("https://www.ledgrjournal.app/api/v1/me");
    expect(calls[0].headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("needs a key", async () => {
    const { c, calls } = client(() => ok({}), null);
    await expect(c.get("/me")).rejects.toMatchObject({ kind: "no_key" });
    expect(calls).toHaveLength(0);
  });

  it("caches answers for a minute, and fresh skips the cache", async () => {
    const { c, calls, clock } = client(() => ok({ n: calls.length }));
    await c.get("/stats"); await c.get("/stats");
    expect(calls).toHaveLength(1);
    clock.advance(61_000);
    await c.get("/stats");
    expect(calls).toHaveLength(2);
    await c.get("/stats", { fresh: true });
    expect(calls).toHaveLength(3);
  });

  it("shares one request between callers asking at the same time", async () => {
    const { c, calls } = client(() => ok({}));
    await Promise.all([c.get("/me"), c.get("/me"), c.get("/me")]);
    expect(calls).toHaveLength(1);
  });

  it("reports offline and server errors, and doesn't cache them", async () => {
    let down = true;
    const { c, calls } = client(() => { if (down) throw new Error("ENOTFOUND"); return ok({ fine: true }); });
    await expect(c.get("/me")).rejects.toMatchObject({ kind: "offline" });
    down = false;
    await expect(c.get("/me")).resolves.toEqual({ fine: true });
    expect(calls).toHaveLength(2);
  });

  it("pauses after a 429 for as long as LEDGR asks", async () => {
    let n = 0;
    const { c, clock } = client(() => (n++ === 0 ? fail(429, "rate_limited", "slow", { "Retry-After": "20" }) : ok({})));
    const t0 = clock.now();
    await expect(c.get("/me")).rejects.toBeInstanceOf(LedgrApiError);
    await c.get("/me", { fresh: true });
    expect(clock.now() - t0).toBeGreaterThanOrEqual(20_000);
  });

  it("loads the dashboard with 4 requests, the 30-day stats from 29 days back", async () => {
    const { c, calls } = client((req) => ok(req.url.includes("/accounts") ? { accounts: [{ id: "a" }] } : { url: req.url }));
    const d = await c.dashboard(new Date(2026, 10, 28, 12));
    expect(calls.map((x) => x.url.replace("https://www.ledgrjournal.app/api/v1", "")).sort()).toEqual(["/accounts?status=active", "/me", "/stats", "/stats?from=2026-10-30"]);
    expect(d.accounts).toEqual([{ id: "a" }]);
  });

  it("stops at /me when the key or plan is wrong", async () => {
    const { c, calls } = client(() => fail(402, "pro_required", "The LEDGR API is part of LEDGR Pro."));
    await expect(c.dashboard(new Date())).rejects.toMatchObject({ kind: "not_pro" });
    expect(calls).toHaveLength(1);
  });
});

describe("RateLimiter", () => {
  it("allows max requests a window, then waits", async () => {
    const clock = fakeClock();
    const l = new RateLimiter(3, 60_000, clock.now, clock.sleep);
    for (let i = 0; i < 3; i++) await l.acquire();
    expect(l.waitMs()).toBe(60_000);
    clock.advance(10_000);
    expect(l.waitMs()).toBe(50_000);
    await l.acquire();
    expect(clock.now()).toBe(1_000_000 + 60_000);
  });
});

it("isoDate uses local dates", () => {
  expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
});
