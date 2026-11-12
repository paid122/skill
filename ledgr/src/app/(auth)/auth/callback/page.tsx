"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotConfigured } from "@/components/site/AuthBits";
import { supabase, supabaseConfigured, useSession } from "@/lib/supabase";

/**
 * Landing point for email confirmation, Google and Tradovate sign-in.
 * Google/email codes are exchanged by the Supabase client automatically; Tradovate
 * arrives with a one-time token hash from our server, redeemed here.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, "&"));
    const e = p.get("error_description");
    if (e) { setError(e); return; }
    const tokenHash = p.get("token_hash");
    const sb = supabase();
    if (tokenHash && sb) {
      (async () => {
        let r = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        if (r.error) r = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
        if (r.error) setError(r.error.message);
      })();
    }
  }, []);
  useEffect(() => { if (session) router.replace("/dashboard"); }, [session, router]);
  if (!supabaseConfigured) return <NotConfigured />;
  if (error) return <div><h1 className="text-[28px] font-semibold">Sign-in didn't complete</h1><p className="mt-3 text-ink/60">{error}</p><Link href="/login" className="mt-6 inline-block text-ink underline">Try again</Link></div>;
  return <p className="text-ink/60">{session === null ? "Finishing sign-in… If nothing happens, open the link again on this device." : "Signing you in…"}</p>;
}
