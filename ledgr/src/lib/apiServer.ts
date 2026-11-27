/**
 * Server only: the LEDGR API (LEDGR Pro). Keys look like "ledgr_sk_…" and are stored only as SHA-256 hashes.
 * A key works while its owner has LEDGR Pro: LEDGR's owner and co-owners always (free), everyone else
 * until their MatrixX Plus period ends (opening Settings → API in the app after renewing refreshes it).
 */
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { enrich, type EnrichedTrade } from "./calc";
import { adminClient, ownerEmails } from "./ownerServer";
import { planFromMatrixx } from "./plus";
import { callMatrixx, customerKey } from "./plusServer";
import type { LedgrState } from "./types";

export const KEY_PREFIX = "ledgr_sk_";
export const MAX_KEYS = 5;

export const newKey = () => KEY_PREFIX + randomBytes(32).toString("base64url");
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const shownPrefix = (key: string) => key.slice(0, KEY_PREFIX.length + 6);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
/** JSON with CORS headers (API keys are sent in a header, never cookies, so any site or script may call it). */
export const apiJson = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { ...CORS, "Cache-Control": "no-store", ...headers } });
export const apiError = (status: number, code: string, message: string, headers: Record<string, string> = {}) => apiJson({ error: { code, message } }, status, headers);
export const preflight = () => new Response(null, { status: 204, headers: CORS });

// --------------------------------------------------------------------------- who is asking (the app)

/** The signed-in person behind the request's Supabase access token. */
export async function sessionUser(req: Request, sb: SupabaseClient): Promise<User | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user ?? null;
}

const isOwner = (u: Pick<User, "email" | "email_confirmed_at">) => !!u.email && !!u.email_confirmed_at && ownerEmails().includes(u.email.toLowerCase());

export type ProCheck = { ok: true; source: "owner" | "matrixx"; until: string | null } | { ok: false; message: string };

/** Whether this person has LEDGR Pro right now: owners always; others from their MatrixX plan (x-matrixx-key header). */
export async function proFor(req: Request, user: User): Promise<ProCheck> {
  if (isOwner(user)) return { ok: true, source: "owner", until: null };
  const key = customerKey(req);
  if (!key) return { ok: false, message: "The LEDGR API is part of LEDGR Pro. Sign in with MatrixX and get LEDGR Pro first." };
  const res = await callMatrixx("/apps/plan", key);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: String(j?.error ?? "Could not check your plan. Try again.") };
  if (planFromMatrixx(j) !== "pro") return { ok: false, message: "The LEDGR API is part of LEDGR Pro." };
  const until = typeof j?.period_end === "string" ? j.period_end : new Date(Date.now() + 30 * 86_400_000).toISOString();
  return { ok: true, source: "matrixx", until };
}

// --------------------------------------------------------------------------- who is asking (an API key)

export interface KeyRow { id: string; user_id: string; name: string; plan_source: "owner" | "matrixx"; pro_until: string | null; last_used_at: string | null }

const ownerCache = new Map<string, { ok: boolean; at: number }>();
const hits = new Map<string, { n: number; reset: number }>();
export const RATE_LIMIT = 120; // requests a minute, per key (per server instance)

/** Checks the API key on a request. Returns the key and a service-role client, or an error Response. */
export async function keyAuth(req: Request): Promise<{ sb: SupabaseClient; key: KeyRow } | Response> {
  const sb = adminClient();
  if (!sb) return apiError(503, "unavailable", "The LEDGR API isn't set up on this server yet.");
  const raw = (req.headers.get("x-api-key") ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")).trim();
  if (!raw) return apiError(401, "missing_key", "Send your API key: Authorization: Bearer ledgr_sk_…");
  if (!raw.startsWith(KEY_PREFIX) || raw.length > 120) return apiError(401, "invalid_key", "That isn't a LEDGR API key. Keys start with ledgr_sk_.");

  const { data: key, error } = await sb.from("api_keys").select("id, user_id, name, plan_source, pro_until, last_used_at").eq("key_hash", hashKey(raw)).is("revoked_at", null).maybeSingle<KeyRow>();
  if (error) return apiError(500, "server_error", "Could not check the key. Try again.");
  if (!key) return apiError(401, "invalid_key", "This API key doesn't exist or was revoked.");

  const now = Date.now();
  const h = hits.get(key.id);
  if (!h || h.reset < now) hits.set(key.id, { n: 1, reset: now + 60_000 });
  else if (++h.n > RATE_LIMIT) return apiError(429, "rate_limited", `Up to ${RATE_LIMIT} requests a minute per key.`, { "Retry-After": String(Math.ceil((h.reset - now) / 1000)) });

  if (key.plan_source === "owner") {
    let c = ownerCache.get(key.user_id);
    if (!c || now - c.at > 10 * 60_000) {
      const { data } = await sb.auth.admin.getUserById(key.user_id);
      c = { ok: !!data?.user && isOwner(data.user), at: now };
      ownerCache.set(key.user_id, c);
    }
    if (!c.ok) return apiError(402, "pro_required", "The LEDGR API is part of LEDGR Pro.");
  } else if (!key.pro_until || new Date(key.pro_until).getTime() < now) {
    return apiError(402, "pro_ended", "LEDGR Pro has ended for this account. Renew it, then open Settings → API in LEDGR to switch your keys back on.");
  }

  if (!key.last_used_at || now - new Date(key.last_used_at).getTime() > 60_000) {
    void sb.from("api_keys").update({ last_used_at: new Date(now).toISOString() }).eq("id", key.id).then(() => undefined);
  }
  return { sb, key };
}

/** The key owner's journal, as last synced to the cloud. */
export async function journalFor(sb: SupabaseClient, userId: string): Promise<{ state: LedgrState; trades: EnrichedTrade[]; syncedAt: string } | null> {
  const { data } = await sb.from("user_snapshots").select("state, updated_at").eq("user_id", userId).maybeSingle<{ state: LedgrState; updated_at: string }>();
  if (!data?.state) return null;
  const s = data.state;
  const all = { ...s, accounts: s.accounts ?? [], trades: s.trades ?? [], adjustments: s.adjustments ?? [], strategies: s.strategies ?? [] };
  return { state: all, trades: enrich(all.trades, all.settings), syncedAt: data.updated_at };
}

export const NO_JOURNAL = () => apiError(404, "no_journal", "No journal in the cloud yet. Sign in to LEDGR with cloud sync on, then try again.");

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * The trades a GET asks for: ?from=YYYY-MM-DD&to=YYYY-MM-DD&account=<id or name>&symbol=NQ&status=open|closed|draft.
 * Without an account, copied trades and paper accounts are left out, like LEDGR's combined view.
 */
export function pickTrades(j: NonNullable<Awaited<ReturnType<typeof journalFor>>>, url: URL): { list: EnrichedTrade[]; error?: Response } {
  const q = url.searchParams;
  const from = q.get("from") ?? "", to = q.get("to") ?? "";
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return { list: [], error: apiError(400, "bad_date", "from and to are dates like 2026-11-01.") };
  const acct = (q.get("account") ?? "").trim();
  let accountId: string | null = null;
  if (acct) {
    const a = j.state.accounts.find((x) => x.id === acct) ?? j.state.accounts.find((x) => x.name.toLowerCase() === acct.toLowerCase());
    if (!a) return { list: [], error: apiError(404, "no_account", `No account called "${acct}".`) };
    accountId = a.id;
  }
  const paper = new Set(j.state.accounts.filter((a) => a.type === "Paper").map((a) => a.id));
  const symbol = (q.get("symbol") ?? "").trim().toUpperCase();
  const status = q.get("status");
  const list = j.trades.filter((x) => {
    const t = x.trade;
    if (accountId ? t.accountId !== accountId : t.copyOf || paper.has(t.accountId ?? "")) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (symbol && t.symbol.toUpperCase() !== symbol) return false;
    if (status && x.m.status !== status) return false;
    return true;
  });
  return { list };
}
