/**
 * A small client for the LEDGR API. It has no Obsidian imports, so it can be tested on its own:
 * the HTTP call (Obsidian's requestUrl in the plugin) and the clock are passed in.
 */
import type { AccountsResponse, Dashboard, MeResponse, StatsResponse } from "./types";

export const API_BASE = "https://www.ledgrjournal.app/api/v1";
export const UPGRADE_URL = "https://www.ledgrjournal.app/plus?plan=pro";
export const KEYS_URL = "https://www.ledgrjournal.app/settings/api";

export interface HttpRequest { url: string; method: "GET" | "POST"; headers: Record<string, string>; body?: string }
export interface HttpResponse { status: number; headers: Record<string, string>; json: unknown }
export type Transport = (req: HttpRequest) => Promise<HttpResponse>;

export type ErrorKind =
  | "no_key" // nothing saved yet
  | "invalid_key" // wrong, revoked or malformed key (401)
  | "not_pro" // the key's account doesn't have LEDGR Pro, or it ended (402)
  | "no_journal" // signed in, but the journal was never synced to the cloud (404)
  | "rate_limited" // too many requests (429)
  | "offline" // no answer at all
  | "server"; // anything else

export class LedgrApiError extends Error {
  constructor(public kind: ErrorKind, message: string, public status = 0, public retryAfterMs = 0) {
    super(message);
    this.name = "LedgrApiError";
  }
}

/** Turns an HTTP answer from LEDGR into a LedgrApiError (the API answers { error: { code, message } }). */
export function errorFrom(res: HttpResponse): LedgrApiError {
  const body = res.json as { error?: { code?: string; message?: string } } | null;
  const code = body?.error?.code ?? "";
  const msg = body?.error?.message ?? `LEDGR answered ${res.status}.`;
  if (res.status === 401) return new LedgrApiError("invalid_key", msg, 401);
  if (res.status === 402) return new LedgrApiError("not_pro", msg, 402);
  if (res.status === 404 && code === "no_journal") return new LedgrApiError("no_journal", msg, 404);
  if (res.status === 429) {
    const header = Object.entries(res.headers ?? {}).find(([k]) => k.toLowerCase() === "retry-after")?.[1];
    const secs = Number(header);
    return new LedgrApiError("rate_limited", msg, 429, (Number.isFinite(secs) && secs > 0 ? secs : 30) * 1000);
  }
  return new LedgrApiError("server", msg, res.status);
}

/**
 * Keeps requests under LEDGR's limit (120 a minute per key) with room to spare.
 * acquire() waits for a free slot; pause() is used after a 429.
 */
export class RateLimiter {
  private stamps: number[] = [];
  private pausedUntil = 0;
  constructor(private max = 100, private windowMs = 60_000, private now: () => number = Date.now, private sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {}

  /** How long the next request would have to wait (0 = now). */
  waitMs(): number {
    const t = this.now();
    this.stamps = this.stamps.filter((s) => t - s < this.windowMs);
    const pause = Math.max(0, this.pausedUntil - t);
    const full = this.stamps.length >= this.max ? this.windowMs - (t - this.stamps[0]) : 0;
    return Math.max(pause, full);
  }

  async acquire(): Promise<void> {
    for (let w = this.waitMs(); w > 0; w = this.waitMs()) await this.sleep(w);
    this.stamps.push(this.now());
  }

  pause(ms: number) { this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms); }
}

export interface ClientOptions {
  transport: Transport;
  getKey: () => string | null;
  limiter?: RateLimiter;
  cacheMs?: number;
  now?: () => number;
  base?: string;
}

export class LedgrClient {
  private cache = new Map<string, { at: number; data: unknown }>();
  private inflight = new Map<string, Promise<unknown>>();
  private limiter: RateLimiter;
  private now: () => number;

  constructor(private o: ClientOptions) {
    this.now = o.now ?? Date.now;
    this.limiter = o.limiter ?? new RateLimiter(100, 60_000, this.now);
  }

  /** Forget cached answers (after a new key, or a manual refresh). */
  clear() { this.cache.clear(); }

  /** GET a path such as "/stats?from=2026-11-01". Answers are cached for cacheMs (60 s by default). */
  async get<T>(path: string, { fresh = false } = {}): Promise<T> {
    const key = this.o.getKey()?.trim();
    if (!key) throw new LedgrApiError("no_key", "Add your LEDGR API key in the plugin settings.");
    const hit = this.cache.get(path);
    if (!fresh && hit && this.now() - hit.at < (this.o.cacheMs ?? 60_000)) return hit.data as T;
    const running = this.inflight.get(path);
    if (running) return running as Promise<T>;

    const p = (async () => {
      await this.limiter.acquire();
      let res: HttpResponse;
      try {
        res = await this.o.transport({ url: (this.o.base ?? API_BASE) + path, method: "GET", headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
      } catch {
        throw new LedgrApiError("offline", "Can't reach LEDGR. Check your internet connection.");
      }
      if (res.status < 200 || res.status >= 300) {
        const err = errorFrom(res);
        if (err.kind === "rate_limited") this.limiter.pause(err.retryAfterMs);
        throw err;
      }
      this.cache.set(path, { at: this.now(), data: res.json });
      return res.json as T;
    })();
    this.inflight.set(path, p);
    try { return await p; } finally { this.inflight.delete(path); }
  }

  me(opts?: { fresh?: boolean }) { return this.get<MeResponse>("/me", opts); }

  /** Everything the command center needs: 4 requests. */
  async dashboard(today: Date, opts?: { fresh?: boolean }): Promise<Dashboard> {
    const me = await this.me(opts); // first, so a bad key or plan fails fast
    const from = isoDate(new Date(today.getTime() - 29 * 86_400_000));
    const [stats, stats30, acc] = await Promise.all([
      this.get<StatsResponse>("/stats", opts),
      this.get<StatsResponse>(`/stats?from=${from}`, opts),
      this.get<AccountsResponse>("/accounts?status=active", opts),
    ]);
    return { me, stats, stats30, accounts: acc.accounts };
  }
}

/** YYYY-MM-DD in local time. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
