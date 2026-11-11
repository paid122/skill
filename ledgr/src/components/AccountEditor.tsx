"use client";
import { useState } from "react";
import { saveAccount, ValidationError } from "@/lib/actions";
import { ACCOUNT_TYPES, type Account, type AccountType } from "@/lib/types";
import { Button, Field, Input, Modal, NumberInput, Select, Textarea } from "./ui";

const COLORS = ["#C5A66D", "#3987e5", "#199e70", "#d95926", "#d55181", "#9C8FD1", "#A4AAB1"];

export function AccountEditor({ initial, onClose }: { initial: Account; onClose: () => void }) {
  const [a, setA] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Account>) => setA((x) => ({ ...x, ...p }));
  const setRule = (p: Partial<Account["rules"]>) => setA((x) => ({ ...x, rules: { ...x.rules, ...p } }));
  const save = () => {
    try { saveAccount({ ...a, name: a.name.trim(), currency: a.currency.toUpperCase() }); onClose(); }
    catch (e) { setError(e instanceof ValidationError ? e.message : "Could not save the account."); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={initial.name ? `Edit ${initial.name}` : "New account"} description="Simulated and historical records only. Ledgr never connects to a broker." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save}>Save account</Button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Account name"><Input value={a.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Type"><Select value={a.type} onChange={(e) => set({ type: e.target.value as AccountType })}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Virtual starting balance"><NumberInput value={a.startingBalance} allowEmpty={false} onChange={(n) => set({ startingBalance: n ?? 0 })} /></Field>
        <Field label="Currency" hint="Three-letter code"><Input value={a.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="Status"><Select value={a.status} onChange={(e) => set({ status: e.target.value as Account["status"] })}><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></Select></Field>
        <Field label="Colour">
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={a.color === c} onClick={() => set({ color: c })} className={`h-8 w-8 rounded-full border-2 ${a.color === c ? "border-text" : "border-transparent"}`} style={{ background: c }} />)}</div>
        </Field>
        <Field label="Personal goals" className="md:col-span-2"><Textarea value={a.goals} onChange={(e) => set({ goals: e.target.value })} placeholder="What do you want to practise with this account?" /></Field>
        <div className="md:col-span-2">
          <p className="label mb-1">Practice rules</p>
          <p className="mb-3 text-xs text-muted">Optional limits used by the progress tracker. For hypothetical evaluation practice only — they do not represent any firm's rules or a verified status.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Profit target"><NumberInput value={a.rules.profitTarget} onChange={(n) => setRule({ profitTarget: n && n > 0 ? n : null })} /></Field>
            <Field label="Max drawdown"><NumberInput value={a.rules.maxDrawdown} onChange={(n) => setRule({ maxDrawdown: n && n > 0 ? n : null })} /></Field>
            <Field label="Daily loss limit"><NumberInput value={a.rules.dailyLossLimit} onChange={(n) => setRule({ dailyLossLimit: n && n > 0 ? n : null })} /></Field>
            <Field label="Min trading days"><NumberInput value={a.rules.minTradingDays} onChange={(n) => setRule({ minTradingDays: n && n > 0 ? Math.round(n) : null })} /></Field>
          </div>
        </div>
        {error && <p className="text-[13px] text-neg md:col-span-2">{error}</p>}
      </div>
    </Modal>
  );
}
