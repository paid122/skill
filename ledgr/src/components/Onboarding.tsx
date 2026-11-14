"use client";
import { useState } from "react";
import { newAccount, saveAccount, updateSettings } from "@/lib/actions";
import { buildSampleState } from "@/lib/sample";
import { getState, replaceState } from "@/lib/store";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/types";
import { VERSE_BY_ID } from "@/lib/verses";
import { LogoMark, Wordmark } from "./Logo";
import { Button, Field, Input, NumberInput, Select } from "./ui";

export function Onboarding() {
  const [step, setStep] = useState<"welcome" | "account">("welcome");
  const [name, setName] = useState("");
  const [acct, setAcct] = useState({ name: "Main simulation", type: "Personal simulation" as AccountType, balance: 10000 as number | null, currency: "USD" });
  const [error, setError] = useState<string | null>(null);
  const verse = VERSE_BY_ID.get("PRO.16.3")!;

  const loadSample = async () => {
    const s = buildSampleState(getState());
    await replaceState({ ...s, settings: { ...s.settings, displayName: name.trim(), onboarded: true } });
  };
  const startEmpty = () => {
    try {
      const a = { ...newAccount(), name: acct.name.trim(), type: acct.type, startingBalance: acct.balance ?? 0, currency: acct.currency.toUpperCase() };
      saveAccount(a);
      updateSettings({ displayName: name.trim(), baseCurrency: a.currency, onboarded: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the account.");
    }
  };

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto bg-bg">
      <div className="ruled pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-12">
        <div className="flex items-center gap-3 text-text"><LogoMark size={34} /><Wordmark className="text-[15px]" /></div>
        {step === "welcome" ? (
          <div className="animate-fade">
            <h1 className="mt-10 text-[28px] font-semibold leading-tight tracking-tight">Discipline over impulse.</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-text-2">Ledgr is a private journal for your trading decisions. Track every lesson, measure every step, and review the habits behind the numbers.</p>
            <figure className="mt-8 border-l-2 border-accent/50 pl-4">
              <blockquote className="verse-text text-[17px] text-ivory">{verse.text}</blockquote>
              <figcaption className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{verse.reference} · KJV</figcaption>
            </figure>
            <Field label="What should Ledgr call you?" className="mt-10" htmlFor="ob-name">
              <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" maxLength={40} />
            </Field>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button variant="accent" className="sm:flex-1" onClick={() => setStep("account")}>Set up my journal</Button>
              <Button className="sm:flex-1" onClick={loadSample}>Explore with sample records</Button>
            </div>
            <p className="mt-4 text-xs text-muted">Ledgr records simulated and historical trades only. It never connects to a broker or places orders. Your data stays in this browser unless you export it.</p>
          </div>
        ) : (
          <div className="animate-fade">
            <h1 className="mt-10 text-[24px] font-semibold tracking-tight">Create your first account</h1>
            <p className="mt-2 text-sm text-text-2">Accounts keep records separated — for example a personal simulation, a backtest notebook, or a hypothetical evaluation.</p>
            <div className="mt-8 grid gap-4">
              <Field label="Account name" htmlFor="ob-acct"><Input id="ob-acct" value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} /></Field>
              <Field label="Type"><Select value={acct.type} onChange={(e) => setAcct({ ...acct, type: e.target.value as AccountType })}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Virtual starting balance"><NumberInput value={acct.balance} onChange={(n) => setAcct({ ...acct, balance: n })} /></Field>
                <Field label="Currency"><Input value={acct.currency} maxLength={3} onChange={(e) => setAcct({ ...acct, currency: e.target.value.toUpperCase() })} /></Field>
              </div>
              {error && <p className="text-sm text-neg">{error}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep("welcome")}>Back</Button>
                <Button variant="accent" className="flex-1" onClick={startEmpty}>Open my ledger</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
