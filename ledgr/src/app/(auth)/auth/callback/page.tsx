"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NotConfigured } from "@/components/site/AuthBits";
import { supabaseConfigured, useSession } from "@/lib/supabase";

/** Landing point for email confirmation and Google sign-in. The Supabase client exchanges the code automatically. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const session = useSession();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, "&"));
    const e = p.get("error_description");
    if (e) setError(e);
  }, []);
  useEffect(() => { if (session) router.replace("/dashboard"); }, [session, router]);
  if (!supabaseConfigured) return <NotConfigured />;
  if (error) return <div><h1 className="text-[28px] font-semibold">Sign-in didn't complete</h1><p className="mt-3 text-ink/60">{error}</p><Link href="/login" className="mt-6 inline-block text-ink underline">Try again</Link></div>;
  return <p className="text-ink/60">{session === null ? "Finishing sign-in… If nothing happens, open the link again on this device." : "Signing you in…"}</p>;
}
