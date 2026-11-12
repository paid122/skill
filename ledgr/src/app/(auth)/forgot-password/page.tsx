"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthButton, AuthError, AuthField, NotConfigured } from "@/components/site/AuthBits";
import { authMessage, supabase, supabaseConfigured } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supabaseConfigured) return <NotConfigured />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error: err } = await supabase()!.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    // Only surface rate limiting; never reveal whether an email has an account.
    if (err && /rate limit/i.test(err.message)) return setError(authMessage(err));
    setSent(true);
  };
  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Reset your password</h1>
      {sent ? (
        <p className="mt-4 text-[15px] leading-relaxed text-white/60">If an account exists for <span className="text-white">{email}</span>, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <AuthField label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <AuthError message={error} />
          <AuthButton type="submit" busy={busy}>Send reset link</AuthButton>
        </form>
      )}
      <Link href="/login" className="mt-8 inline-block text-[14px] text-white/60 hover:text-white">Back to log in</Link>
    </div>
  );
}
