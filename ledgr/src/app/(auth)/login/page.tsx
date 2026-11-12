"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthButton, AuthError, AuthField, Divider, GoogleButton, NotConfigured } from "@/components/site/AuthBits";
import { authMessage, supabase, supabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supabaseConfigured) return <NotConfigured />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase()!.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError(authMessage(err));
    router.push("/dashboard");
  };

  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Welcome back</h1>
      <p className="mt-2 text-[15px] text-white/55">Log in to sync your journal.</p>
      <div className="mt-8"><GoogleButton label="Log in with Google" /></div>
      <Divider />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <AuthField label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthField label="Password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="-mt-1 text-right"><Link href="/forgot-password" className="text-[13px] text-white/55 hover:text-white">Forgot password?</Link></div>
        <AuthError message={error} />
        <AuthButton type="submit" busy={busy}>Log in</AuthButton>
      </form>
      <p className="mt-8 text-[14px] text-white/55">New to Ledgr? <Link href="/signup" className="text-white underline-offset-4 hover:underline">Create an account</Link></p>
    </div>
  );
}
