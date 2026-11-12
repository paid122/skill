"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { AuthButton, AuthError, AuthField } from "./AuthBits";

/** Saves a community or affiliate sign-up to the site owner's Supabase project (write-only). */
export function SignupForm({ kind, fields, submitLabel, done }: { kind: "community" | "affiliate"; fields: { name: string; label: string; placeholder?: string; type?: string; required?: boolean; multiline?: boolean }[]; submitLabel: string; done: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  if (!supabaseConfigured) return <p className="rounded-2xl border border-ink/10 p-5 text-[14px] text-ink/55">Sign-ups open once this site is connected to its database.</p>;
  if (sent) return <p className="flex items-center gap-3 rounded-2xl border border-ink/15 bg-ink/[0.04] p-5 text-[15px]"><Check size={18} /> {done}</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = (values.name ?? "").trim(), email = (values.email ?? "").trim();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter your name and a valid email address.");
    for (const f of fields) if (f.required && !(values[f.name] ?? "").trim()) return setError(`${f.label} is required.`);
    const details = Object.fromEntries(Object.entries(values).filter(([k]) => k !== "name" && k !== "email").map(([k, v]) => [k, v.slice(0, 1000)]));
    setBusy(true);
    const { error: err } = await supabase()!.from("site_signups").insert({ kind, name: name.slice(0, 80), email: email.slice(0, 254), details });
    setBusy(false);
    if (err) return setError(err.code === "23505" ? "You've already signed up with this email." : "Couldn't send that. Please try again.");
    setSent(true);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <AuthField label="Name" name="name" autoComplete="name" required maxLength={80} value={values.name ?? ""} onChange={(e) => setValues({ ...values, name: e.target.value })} />
      <AuthField label="Email" name="email" type="email" autoComplete="email" required value={values.email ?? ""} onChange={(e) => setValues({ ...values, email: e.target.value })} />
      {fields.map((f) => f.multiline ? (
        <div key={f.name} className="flex flex-col gap-1.5">
          <label htmlFor={`f-${f.name}`} className="text-[13px] text-ink/70">{f.label}</label>
          <textarea id={`f-${f.name}`} rows={4} maxLength={1000} placeholder={f.placeholder} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="rounded-xl border border-ink/15 bg-ink/[0.03] px-3.5 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink/30 focus:border-ink/60" />
        </div>
      ) : (
        <AuthField key={f.name} label={f.label} name={`f-${f.name}`} type={f.type ?? "text"} placeholder={f.placeholder} maxLength={300} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
      ))}
      <AuthError message={error} />
      <AuthButton type="submit" busy={busy}>{submitLabel}</AuthButton>
      <p className="text-[12px] text-ink/40">We use your email only to reply about this request.</p>
    </form>
  );
}
