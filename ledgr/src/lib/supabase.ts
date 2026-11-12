"use client";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when this deployment has a Supabase project configured. */
export const supabaseConfigured = Boolean(URL && KEY);

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
