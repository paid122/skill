/** Server only: who may open the owner dashboard, and a Supabase client with the secret key. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']+|["']+$/g, "").trim();

/** LEDGR_OWNER_EMAILS: the owner first, then co-owners, separated by commas. */
export function ownerEmails(): string[] {
  return clean(process.env.LEDGR_OWNER_EMAILS).split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
}

/** The secret (service role) key: never NEXT_PUBLIC_, only in the host's server settings. */
export function adminClient(): SupabaseClient | null {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
  const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The signed-in person behind the request's Bearer token, if they're an owner. */
export async function ownerFor(req: Request, sb: SupabaseClient): Promise<{ email: string; role: "Owner" | "Co-owner" } | "signed-out" | "not-owner"> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return "signed-out";
  const { data, error } = await sb.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return "signed-out";
  const list = ownerEmails();
  const i = list.indexOf(email);
  if (i < 0 || !data.user!.email_confirmed_at) return "not-owner";
  return { email, role: i === 0 ? "Owner" : "Co-owner" };
}
