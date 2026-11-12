/**
 * "Continue with Tradovate" — server side only.
 *
 * Follows Tradovate's official OAuth example (github.com/tradovate/example-api-oauth):
 *   1. redirect to  {AUTH_URL}?response_type=code&client_id=…&redirect_uri=…
 *   2. POST {API_URL}/auth/oauthtoken  (form: grant_type, code, client_id, client_secret, redirect_uri)
 *   3. GET  {API_URL}/auth/me           (Bearer token) → userId, fullName, email, emailVerified
 *
 * Ledgr uses the token for step 3 only and then discards it: it never stores the token,
 * never reads trades or account data, and never places orders. Hosts are configurable
 * because Tradovate documents more than one (trader.tradovate.com / trader-d.tradovate.com).
 */
import { createClient } from "@supabase/supabase-js";

export const TV = {
  clientId: process.env.TRADOVATE_CLIENT_ID ?? "",
  clientSecret: process.env.TRADOVATE_CLIENT_SECRET ?? "",
  authUrl: process.env.TRADOVATE_AUTH_URL || "https://trader.tradovate.com/oauth",
  apiUrl: (process.env.TRADOVATE_API_URL || "https://live.tradovateapi.com").replace(/\/$/, ""),
  redirectUri: process.env.TRADOVATE_REDIRECT_URI || "",
};
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** What's missing for Tradovate sign-in to work on this deployment (empty when ready). */
export function tradovateMissing(): string[] {
  const m: string[] = [];
  if (!TV.clientId) m.push("TRADOVATE_CLIENT_ID");
  if (!TV.clientSecret) m.push("TRADOVATE_CLIENT_SECRET");
  if (!SUPABASE_URL) m.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SERVICE_KEY) m.push("SUPABASE_SERVICE_ROLE_KEY");
  return m;
}

export const redirectUriFor = (origin: string) => TV.redirectUri || `${origin}/api/auth/tradovate/callback`;

export function authorizeUrl(origin: string, state: string) {
  const u = new URL(TV.authUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", TV.clientId);
  u.searchParams.set("redirect_uri", redirectUriFor(origin));
  u.searchParams.set("state", state);
  return u.toString();
}

export interface TradovateIdentity { userId: string; fullName: string; email: string; emailVerified: boolean }

async function json(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: "invalid_response", error_description: text.slice(0, 200) }; }
}

/** Exchange the one-time code for a token, read the identity, and drop the token. */
export async function identityFromCode(code: string, origin: string): Promise<TradovateIdentity> {
  const form = new URLSearchParams({ grant_type: "authorization_code", code, client_id: TV.clientId, client_secret: TV.clientSecret, redirect_uri: redirectUriFor(origin) });
  const tok = await json(await fetch(`${TV.apiUrl}/auth/oauthtoken`, { method: "POST", body: form, headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15_000) }));
  if (!tok.access_token) throw new Error(tok.error_description || tok.error || "Tradovate didn't return a token.");
  const me = await json(await fetch(`${TV.apiUrl}/auth/me`, { headers: { Authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(15_000) }));
  // The token goes out of scope here; it is never stored or used again.
  if (!me || me.error || me.userId === undefined) throw new Error(me?.error_description || "Couldn't read your Tradovate profile.");
  return { userId: String(me.userId), fullName: String(me.fullName ?? ""), email: String(me.email ?? "").trim().toLowerCase(), emailVerified: me.emailVerified === true };
}

/**
 * Find or create the Ledgr account for this verified email and return a one-time
 * sign-in token for the browser to redeem (Supabase magic-link token hash).
 */
export async function signInTokenFor(id: TradovateIdentity): Promise<string> {
  if (!id.email) throw new Error("Your Tradovate profile has no email address, so Ledgr can't create an account from it.");
  if (!id.emailVerified) throw new Error("Verify your email address with Tradovate first, then try again.");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const meta = { full_name: id.fullName, tradovate_user_id: id.userId, signed_up_with: "tradovate" };
  const created = await admin.auth.admin.createUser({ email: id.email, email_confirm: true, user_metadata: meta });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) throw new Error(created.error.message);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: id.email });
  const hash = link.data?.properties?.hashed_token;
  if (link.error || !hash) throw new Error(link.error?.message || "Couldn't start your Ledgr session.");
  return hash;
}
