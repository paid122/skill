"use client";
import { useState } from "react";
import { saveAccount, ValidationError } from "@/lib/actions";
import { firmSizes, presetRules, PROP_FIRM_RULES, PROP_RULES_CHECKED, type PropStage } from "@/lib/propRules";
import { ACCOUNT_TYPES, PROP_FIRMS, type Account, type AccountType } from "@/lib/types";
import { Button, Field, Input, Modal, NumberInput, Select, Textarea } from "./ui";

const COLORS = ["#F5F5F5", "#A3A3A3", "#525252", "#3987e5", "#199e70", "#d95926", "#d55181"];

export function AccountEditor({ initial, onClose }: { initial: Account; onClose: () => void }) {
  const [a, setA] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<Account>) => setA((x) => ({ ...x, ...p }));
  const setRule = (p: Partial<Account["rules"]>) => setA((x) => ({ ...x, rules: { ...x.rules, ...p } }));
  const real = a.type === "Live" || a.type === "Funded";
  const funded = a.type === "Funded";
  // Funded: picking firm, plan, size or stage fills in that account's rules (still editable).
  const applyPreset = (p: Partial<Account>) => {
    setA((x) => {
      const next = { ...x, ...p };
      const firm = next.propFirm ?? PROP_FIRMS[0];
      const plans = PROP_FIRM_RULES[firm];
      if (plans && !plans.some((pl) => pl.name === next.propPlan)) next.propPlan = plans[0].name;
      if (plans && next.accountSize && !firmSizes(firm).includes(next.accountSize)) next.accountSize = 50000;
      if (next.accountSize) next.startingBalance = next.accountSize;
      const pre = presetRules(firm, next.propPlan, next.accountSize, (next.propStage ?? "evaluation") as PropStage, next.propDailyLimit ?? true);
      if (pre) next.rules = { ...next.rules, ...pre.rules };
      return next;
    });
  };
  const setType = (type: AccountType) => (type === "Funded"
    ? applyPreset({ type, propFirm: a.propFirm ?? PROP_FIRMS[1], accountSize: a.accountSize ?? 50000, propStage: a.propStage ?? "evaluation", propDailyLimit: a.propDailyLimit ?? true })
    : set({ type }));
  const plans = funded ? PROP_FIRM_RULES[a.propFirm ?? ""] : undefined;
  const plan = plans?.find((p) => p.name === a.propPlan) ?? plans?.[0];
  const preset = funded ? presetRules(a.propFirm, a.propPlan, a.accountSize, (a.propStage ?? "evaluation") as PropStage, a.propDailyLimit ?? true) : null;
  const save = () => {
    try { saveAccount({ ...a, name: a.name.trim(), currency: a.currency.toUpperCase() }); onClose(); }
    catch (e) { setError(e instanceof ValidationError ? e.message : "Could not save the account."); }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={initial.name ? `Edit ${initial.name}` : "New account"} description={real ? "Log this account's trades yourself or import a CSV. LEDGR never connects to a broker or a prop firm." : "Simulated and historical records only. LEDGR never connects to a broker."} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={save}>Save account</Button></>}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <Field label="Account name"><Input value={a.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Type"><Select value={a.type} onChange={(e) => setType(e.target.value as AccountType)}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        {funded && (
          <>
            <Field label="Prop firm"><Select value={a.propFirm ?? PROP_FIRMS[0]} onChange={(e) => applyPreset({ propFirm: e.target.value })}>{PROP_FIRMS.map((f) => <option key={f}>{f}</option>)}</Select></Field>
            <Field label="Account size" hint="Sets the starting balance">
              <Select value={String(a.accountSize ?? 50000)} onChange={(e) => applyPreset({ accountSize: Number(e.target.value) })}>
                {firmSizes(a.propFirm).map((n) => <option key={n} value={n}>{n / 1000}K</option>)}
              </Select>
            </Field>
            {plans && (
              <Field label="Plan" hint={plan?.note}>
                <Select value={plan?.name} onChange={(e) => applyPreset({ propPlan: e.target.value })}>{plans.map((p) => <option key={p.name}>{p.name}</option>)}</Select>
              </Field>
            )}
            <Field label="Stage" hint={(a.propStage ?? "evaluation") === "evaluation" ? "Passing the evaluation: has a profit target" : "Funded (performance) account: no profit target"}>
              <Select value={a.propStage ?? "evaluation"} onChange={(e) => applyPreset({ propStage: e.target.value as PropStage })}>
                <option value="evaluation">Evaluation</option><option value="funded">Funded</option>
              </Select>
            </Field>
            {plan?.optionalDailyLimit && (
              <label className="flex items-center gap-2 text-[13px] text-text-2 md:col-span-2">
                <input type="checkbox" checked={a.propDailyLimit ?? true} onChange={(e) => applyPreset({ propDailyLimit: e.target.checked })} className="accent-[var(--accent)]" />
                My account has the daily loss limit add-on
              </label>
            )}
          </>
        )}
        <Field label={real ? "Starting balance" : "Virtual starting balance"}><NumberInput value={a.startingBalance} allowEmpty={false} onChange={(n) => set({ startingBalance: n ?? 0 })} /></Field>
        <Field label="Currency" hint="Three-letter code"><Input value={a.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} /></Field>
        <Field label="Status"><Select value={a.status} onChange={(e) => set({ status: e.target.value as Account["status"] })}><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></Select></Field>
        <Field label="Colour">
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={a.color === c} onClick={() => set({ color: c })} className={`h-8 w-8 rounded-full border-2 ${a.color === c ? "border-text" : "border-transparent"}`} style={{ background: c }} />)}</div>
        </Field>
        <Field label="Personal goals" className="md:col-span-2"><Textarea value={a.goals} onChange={(e) => set({ goals: e.target.value })} placeholder="What do you want to practise with this account?" /></Field>
        <div className="md:col-span-2">
          <p className="label mb-1">{funded ? "Your account's rules" : real ? "Your risk rules" : "Practice rules"}</p>
          <p className="mb-3 text-xs text-muted">{funded
            ? preset
              ? `Filled in for a ${a.propFirm} ${(a.accountSize ?? 0) / 1000}K ${plan?.name ?? ""} account (max ${preset.maxContracts}), from rules checked ${PROP_RULES_CHECKED}. Firms change their rules, so check these against your dashboard and edit anything that's different.`
              : "Copy your account's current rules from your firm's dashboard. LEDGR only tracks your journal against what you enter."
            : real ? "Optional limits you set for yourself. LEDGR tracks your journal against them."
            : "Optional limits used by the progress tracker. For hypothetical evaluation practice only — they do not represent any firm's rules or a verified status."}</p>
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
