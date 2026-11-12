"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthButton, AuthError, AuthField, NotConfigured } from "@/components/site/AuthBits";
import { authMessage, supabase, supabaseConfigured, useSession } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const session = useSession();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supabaseConfigured) return <NotConfigured />;
  if (session === undefined) return <p className="text-white/60">Checking your reset link…</p>;
  if (!session) return <div><h1 className="text-[28px] font-semibold">This link has expired</h1><p className="mt-3 text-white/60">Request a new password reset link and open it on this device.</p></div>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    setBusy(true);
    const { error: err } = await supabase()!.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(authMessage(err));
    router.push("/dashboard");
  };
  return (
    <div>
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">Choose a new password</h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <AuthField label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
        <AuthError message={error} />
        <AuthButton type="submit" busy={busy}>Save password</AuthButton>
      </form>
    </div>
  );
}
