/**
 * "Connect with LEDGR" (device flow), server only.
 *   1. The app calls POST /api/v1/device/code → a secret device_code (kept by the app) and a user_code like "K7QX-3MRT".
 *   2. The user opens ledgrjournal.app/connect?code=K7QX-3MRT, signs in and approves (needs LEDGR Pro).
 *   3. The app polls POST /api/v1/device/token with its device_code and, once approved, receives its own API key.
 * Codes last 15 minutes and are single use. Only a hash of the device code is stored.
 */
import { randomBytes, randomInt } from "node:crypto";
import { hashKey } from "./apiServer";

export const CODE_TTL_S = 15 * 60;
export const POLL_INTERVAL_S = 5;
/** No 0/O, 1/I/L: easy to read and type. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const newDeviceCode = () => randomBytes(32).toString("base64url");
export const deviceHash = (code: string) => hashKey(code);

export function newUserCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** What the user typed → the stored form ("k7qx 3mrt" → "K7QX-3MRT"), or null. */
export function normalizeUserCode(raw: string): string | null {
  const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 8 || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** The app's name as shown on the approval page. */
export const cleanClient = (v: unknown) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} ._()'-]/gu, "").trim().slice(0, 40) : "") || "App";

/** Simple per-IP limit for the unauthenticated code endpoint (per server instance). */
const ipHits = new Map<string, { n: number; reset: number }>();
export function ipLimited(req: Request, max = 10, windowMs = 10 * 60_000): boolean {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now(), h = ipHits.get(ip);
  if (!h || h.reset < now) { ipHits.set(ip, { n: 1, reset: now + windowMs }); return false; }
  return ++h.n > max;
}
