import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse } from "../src/api";
import { pollConnect, startConnect, waitForKey, type DeviceCode, type Poll } from "../src/connect";

const code: DeviceCode = { device_code: "dev", user_code: "K7QX-3MRT", verification_uri: "https://www.ledgrjournal.app/connect", verification_uri_complete: "https://www.ledgrjournal.app/connect?code=K7QX-3MRT", expires_in: 900, interval: 5 };
const answer = (status: number, json: unknown) => async (_r: HttpRequest): Promise<HttpResponse> => ({ status, headers: {}, json });
const err = (status: number, c: string, message: string) => answer(status, { error: { code: c, message } });

describe("Connect with LEDGR", () => {
  it("asks LEDGR for a code with the app's name", async () => {
    const seen: HttpRequest[] = [];
    const c = await startConnect(async (r) => { seen.push(r); return { status: 200, headers: {}, json: code }; }, "Obsidian (Trading)");
    expect(c.user_code).toBe("K7QX-3MRT");
    expect(seen[0]).toMatchObject({ url: "https://www.ledgrjournal.app/api/v1/device/code", method: "POST" });
    expect(JSON.parse(seen[0].body!)).toEqual({ client: "Obsidian (Trading)" });
    await expect(startConnect(err(429, "rate_limited", "Too many connection attempts."), "x")).rejects.toThrow("Too many connection attempts.");
    await expect(startConnect(async () => { throw new Error("offline"); }, "x")).rejects.toThrow(/internet/);
  });

  it("reads LEDGR's answers while waiting", async () => {
    expect(await pollConnect(err(428, "authorization_pending", "Waiting"), "dev")).toEqual({ kind: "pending" });
    expect(await pollConnect(async () => { throw new Error("blip"); }, "dev")).toEqual({ kind: "pending" });
    expect(await pollConnect(answer(200, { key: "ledgr_sk_x", name: "Obsidian" }), "dev")).toEqual({ kind: "ok", key: "ledgr_sk_x" });
    expect(await pollConnect(err(403, "access_denied", "The connection was declined."), "dev")).toEqual({ kind: "failed", message: "The connection was declined." });
    expect(await pollConnect(err(410, "expired_token", "The code expired."), "dev")).toMatchObject({ kind: "failed" });
  });

  it("waits until approved, at LEDGR's pace", async () => {
    let t = 0, n = 0;
    const answers: Poll[] = [{ kind: "pending" }, { kind: "pending" }, { kind: "ok", key: "ledgr_sk_x" }];
    const key = await waitForKey({ code, poll: async () => answers[n++], sleep: async (ms) => { t += ms; }, now: () => t, cancelled: () => false });
    expect(key).toBe("ledgr_sk_x");
    expect(t).toBe(15_000);
  });

  it("stops when cancelled, declined or expired", async () => {
    let t = 0;
    const base = { code, sleep: async (ms: number) => { t += ms; }, now: () => t };
    expect(await waitForKey({ ...base, poll: async () => ({ kind: "pending" }), cancelled: () => true })).toBeNull();
    await expect(waitForKey({ ...base, poll: async () => ({ kind: "failed", message: "The connection was declined." }), cancelled: () => false })).rejects.toThrow("declined");
    t = 0;
    await expect(waitForKey({ ...base, poll: async () => ({ kind: "pending" }), cancelled: () => false })).rejects.toThrow("expired");
  });
});
