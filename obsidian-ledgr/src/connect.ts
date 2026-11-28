/**
 * "Connect with LEDGR": sign the plugin in without pasting an API key (device flow, see LEDGR's
 * src/lib/deviceConnect.ts). The plugin asks for a code, the user approves it at ledgrjournal.app/connect,
 * and the plugin receives its own API key, kept in Obsidian's secret storage. Pure: no Obsidian imports.
 */
import { API_BASE, type Transport } from "./api";

export interface DeviceCode { device_code: string; user_code: string; verification_uri: string; verification_uri_complete: string; expires_in: number; interval: number }

const post = (transport: Transport, path: string, body: unknown) =>
  transport({ url: API_BASE + path, method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });

const message = (json: unknown, fallback: string) => (json as { error?: { message?: string } } | null)?.error?.message ?? fallback;

export async function startConnect(transport: Transport, client: string): Promise<DeviceCode> {
  let res;
  try { res = await post(transport, "/device/code", { client }); } catch { throw new Error("Can't reach LEDGR. Check your internet connection."); }
  if (res.status !== 200) throw new Error(message(res.json, `LEDGR answered ${res.status}.`));
  return res.json as DeviceCode;
}

export type Poll = { kind: "pending" } | { kind: "ok"; key: string } | { kind: "failed"; message: string };

export async function pollConnect(transport: Transport, deviceCode: string): Promise<Poll> {
  let res;
  try { res = await post(transport, "/device/token", { device_code: deviceCode }); } catch { return { kind: "pending" }; } // offline for a moment: keep waiting
  if (res.status === 200) {
    const key = (res.json as { key?: string } | null)?.key;
    return key ? { kind: "ok", key } : { kind: "failed", message: "LEDGR didn't send a key. Try again." };
  }
  if (res.status === 428 || res.status === 429 || res.status >= 500) return { kind: "pending" };
  return { kind: "failed", message: message(res.json, `LEDGR answered ${res.status}.`) };
}

/** Polls until approved, declined, expired or cancelled. Returns the key, or null when cancelled. */
export async function waitForKey(o: {
  code: DeviceCode; poll: (deviceCode: string) => Promise<Poll>; sleep: (ms: number) => Promise<void>; now: () => number; cancelled: () => boolean;
}): Promise<string | null> {
  const until = o.now() + o.code.expires_in * 1000, every = Math.max(2, o.code.interval) * 1000;
  while (o.now() < until) {
    await o.sleep(every);
    if (o.cancelled()) return null;
    const r = await o.poll(o.code.device_code);
    if (r.kind === "ok") return r.key;
    if (r.kind === "failed") throw new Error(r.message);
  }
  throw new Error("The code expired. Start again.");
}
