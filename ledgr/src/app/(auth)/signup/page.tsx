"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthButton, AuthError, AuthField, Divider, GoogleButton, NotConfigured, OAuthNote, TradovateButton } from "@/components/site/AuthBits";
import { authMessage, supabase, supabaseConfigured } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  if (!supabaseConfigured) return <NotConfigured />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (!agree) return setError("Please accept the terms and privacy policy to continue.");
    setBusy(true);
    const { data, error: err } = await supabase()!.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim().slice(0, 40) }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (err) return setError(authMessage(err));
    if (data.session) router.push("/dashboard");
    else setSent(true);
  };

  if (sent) {
    return (
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/60">We sent a confirmation link to <span className="text-ink">{email}</span>. Open it on this device to finish creating your account.</p>
        <Link href="/login" className="mt-8 inline-block text-[14px] text-ink underline-offset-4 hover:underline">Back to log in</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Create your account</h1>
      <p className="mt-2 text-[15px] text-ink/55">Free. Back up your journal and use it anywhere.</p>
      <div className="mt-8 grid gap-2.5"><GoogleButton label="Continue with Google" /><TradovateButton label="Continue with Tradovate" /></div>
      <OAuthNote />
      <Divider />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AuthField label="Name" name="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="What should Ledgr call you?" />
        <AuthField label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <AuthField label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
        <label className="flex items-start gap-3 text-[13px] text-ink/60">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
          <span>I agree to the <Link href="/terms" className="text-ink underline-offset-2 hover:underline">terms</Link> and <Link href="/privacy" className="text-ink underline-offset-2 hover:underline">privacy policy</Link>.</span>
        </label>
        <AuthError message={error} />
        <AuthButton type="submit" busy={busy}>Create account</AuthButton>
      </form>
      <p className="mt-8 text-[14px] text-ink/55">Already have an account? <Link href="/login" className="text-ink underline-offset-4 hover:underline">Log in</Link></p>
      <p className="mt-3 text-[13px] text-ink/40"><Link href="/dashboard" className="hover:text-ink/70">Continue without an account</Link></p>
    </div>
  );
}
