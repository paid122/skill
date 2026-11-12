"use client";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// Trim stray spaces/quotes that are easy to paste into .env.local by accident.
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
const KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Why the Supabase settings can't be used (null when they look right). */
export const supabaseConfigProblem: string | null = !URL && !KEY ? null
  : !URL ? "NEXT_PUBLIC_SUPABASE_URL is missing."
  : !/^https?:\/\/[^\s/]+(\.[^\s/]+)+$/i.test(URL) ? `NEXT_PUBLIC_SUPABASE_URL must look like https://your-project-id.supabase.co (it's currently "${URL.slice(0, 60)}").`
  : !KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing."
  : null;

/** True when this deployment has a usable Supabase project configured. */
export const supabaseConfigured = Boolean(URL && KEY && !supabaseConfigProblem);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!supabaseConfigured || typeof window === "undefined") return null;
  if (!client) client = createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  return client;
}

export const ATTACHMENT_BUCKET = "ledgr-attachments";

/** Current auth session; `undefined` while loading, `null` when signed out. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(supabaseConfigured ? undefined : null);
  useEffect(() => {
    const sb = supabase();
    if (!sb) { setSession(null); return; }
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/** Turn Supabase auth errors into plain guidance. */
export function authMessage(err: { message?: string; code?: string } | null | undefined): string {
  const m = (err?.message ?? "").toLowerCase();
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Confirm your email first — check your inbox for the link we sent.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Log in instead.";
  if (m.includes("password") && m.includes("characters")) return "Use a password of at least 8 characters.";
  if (m.includes("provider is not enabled")) return "Google sign-in isn't enabled for this project yet. Use email and password.";
  if (m.includes("rate limit")) return "Too many attempts. Wait a minute and try again.";
  return err?.message || "Something went wrong. Try again.";
}
