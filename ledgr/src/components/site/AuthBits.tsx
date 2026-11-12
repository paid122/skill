"use client";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { supabase, supabaseConfigured, authMessage } from "@/lib/supabase";
import { cx } from "@/lib/util";

export function AuthField({ label, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  const id = rest.id ?? rest.name;
  const isPassword = rest.type === "password";
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-ink/70">{label}</label>
      <div className="relative">
        <input id={id} {...rest} type={isPassword && show ? "text" : rest.type} className={cx("h-11 w-full rounded-xl border border-ink/15 bg-ink/[0.03] px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-ink/60", isPassword && "pr-11", rest.className)} />
        {isPassword && (
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink/45 hover:text-ink">
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[12px] text-ink/40">{hint}</p>}
    </div>
  );
}

export function AuthButton({ children, busy, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return <button {...rest} disabled={busy || rest.disabled} className="h-11 w-full rounded-xl bg-ink text-[15px] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50">{busy ? "Please wait…" : children}</button>;
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl border border-[#f0646b]/40 bg-[#f0646b]/10 px-3.5 py-2.5 text-[13.5px] text-[#ff9aa0]">{message}</p>;
}

export function GoogleButton({ label }: { label: string }) {
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setError(null);
    if (!supabaseConfigured) return;
    const { error: e } = await supabase()!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (e) setError(authMessage(e));
  };
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={go} disabled={!supabaseConfigured} className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-ink/15 text-[15px] text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-50">
        <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        {label}
      </button>
      <AuthError message={error} />
    </div>
  );
}

export function Divider() {
  return <div className="my-6 flex items-center gap-3 text-[12px] text-ink/35"><span className="h-px flex-1 bg-ink/10" />or<span className="h-px flex-1 bg-ink/10" /></div>;
}

/** Shown above the auth forms when this deployment has no Supabase project configured. */
export function NotConfigured() {
  if (supabaseConfigured) return null;
  return (
    <div role="status" className="mb-8 rounded-2xl border border-ink/15 bg-ink/[0.03] p-4 text-[13.5px] leading-relaxed">
      <p className="font-medium text-ink">Accounts aren't connected yet</p>
      <p className="mt-1 text-ink/60">Sign-up and log-in start working once this copy of Ledgr is linked to Supabase (add <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code className="font-mono text-[12px]">.env.local</code>). Until then your journal saves privately in this browser.</p>
      <Link href="/dashboard" className="mt-3 inline-flex text-[13.5px] font-medium text-ink underline underline-offset-4">Continue without an account</Link>
    </div>
  );
}
