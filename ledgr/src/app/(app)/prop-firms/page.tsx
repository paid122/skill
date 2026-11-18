"use client";
import { ArrowLeft, Check, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { CountUp } from "@/components/CountUp";
import { Badge, Button, Card, EmptyState, Segmented, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { accountSummary } from "@/lib/accounts";
import { newAccount, saveAccount } from "@/lib/actions";
import { useEnriched } from "@/lib/hooks";
import { firmSizes, PROP_FIRM_RULES, PROP_RULES_CHECKED, presetRules, type PropStage } from "@/lib/propRules";
import { propStatus, type PropStatus } from "@/lib/propStatus";
import { useLedgr } from "@/lib/store";
import type { Account } from "@/lib/types";
import { cx, fmtMoney } from "@/lib/util";

const FIRMS = Object.keys(PROP_FIRM_RULES);
const short = (firm: string) => firm.split(" ")[0];
const k = (n: number) => `${n / 1000}K`;
const usd = (n: number | null, cur = "USD") => (n === null ? "—" : fmtMoney(n, cur));
/** Whole dollars for the fail / start / target labels, so big accounts still fit. */
const usd0 = (n: number | null, cur = "USD") => (n === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n));

export default function PropFirmsPage() {
  const [tab, setTab] = useState<"accounts" | "add">("accounts");
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Prop firms" sub="Your Apex and Lucid accounts against their rules: room left before the max loss, today's loss against the daily limit, and progress to target. Estimated from your journal — your firm's dashboard is the official record."
        actions={<Segmented ariaLabel="Prop firms view" value={tab} onChange={setTab} options={[{ value: "accounts", label: "Accounts" }, { value: "add", label: "Add account" }]} />} />
      <PageVerse page="prop" compact />
      <div key={tab}>{tab === "accounts" ? <Accounts onAdd={() => setTab("add")} /> : <AddAccount onDone={() => setTab("accounts")} />}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ accounts */

function Accounts({ onAdd }: { onAdd: () => void }) {
  const accounts = useLedgr((s) => s.accounts);
  const adjustments = useLedgr((s) => s.adjustments);
  const all = useEnriched();
  const funded = useMemo(() => accounts.filter((a) => a.type === "Funded" && a.status !== "archived").map((a) => {
    const s = accountSummary(a, all, adjustments);
    return { a, st: propStatus(a, all, s.ledger, s.balance) };
  }), [accounts, all, adjustments]);

  if (!funded.length) {
    return <EmptyState icon={<ShieldCheck size={18} />} title="No prop firm accounts yet" body="Add your Apex or Lucid account and LEDGR tracks it against the firm's rules from your journal." action={<Button variant="accent" icon={<Plus size={14} />} onClick={onAdd}>Add account</Button>} />;
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      {funded.map(({ a, st }, i) => <AccountCard key={a.id} a={a} st={st} i={i} />)}
      <button type="button" onClick={onAdd} style={{ "--i": funded.length } as React.CSSProperties} className="prop-rise grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-line text-[14px] text-text-2 transition-colors hover:border-text-2 hover:text-text">
        <span className="inline-flex items-center gap-2"><Plus size={16} /> Add another account</span>
      </button>
    </div>
  );
}

const STATE: Record<PropStatus["state"], { label: string; tone: "pos" | "neg" | "neutral" }> = {
  active: { label: "Active", tone: "neutral" },
  passed: { label: "Target reached", tone: "pos" },
  breached: { label: "Max loss hit", tone: "neg" },
  "daily-limit": { label: "Daily limit hit", tone: "neg" },
};

function AccountCard({ a, st, i }: { a: Account; st: PropStatus; i: number }) {
  const cur = a.currency;
  const lo = st.floor ?? st.start - (a.rules.maxDrawdown ?? st.start * 0.04);
  const hi = st.target ?? st.start + (a.rules.maxDrawdown ?? st.start * 0.04);
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  const room = st.roomLeft ?? 0;
  const roomTone = st.roomLeft === null ? "" : room <= (a.rules.maxDrawdown ?? 1) * 0.25 ? "neg" : room <= (a.rules.maxDrawdown ?? 1) * 0.5 ? "text-[#e0a83a]" : "pos";
  return (
    <Card className="prop-rise flex flex-col gap-5 transition-transform duration-300 hover:-translate-y-0.5" style={{ "--i": i } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <FirmBadge firm={a.propFirm ?? ""} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-text">{a.name}</p>
            <p className="truncate text-xs text-muted">{[a.propFirm, a.accountSize ? k(a.accountSize) : null, a.propPlan, a.propStage === "funded" ? "Funded" : "Evaluation"].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <span className="prop-pop" style={{ "--i": i } as React.CSSProperties}><Badge tone={STATE[st.state].tone}>{STATE[st.state].label}</Badge></span>
      </div>

      {/* Fail line → start → target, with the balance marked */}
      <div>
        <div className="relative h-2.5 rounded-full bg-card-2">
          <div className="prop-grow absolute inset-0 rounded-full" style={{ "--i": i } as React.CSSProperties}>
            <div className="absolute inset-y-0 left-0 rounded-l-full bg-neg/25" style={{ width: pos(st.start) }} />
            {st.target !== null && <div className="absolute inset-y-0 rounded-r-full bg-pos/25" style={{ left: pos(st.start), right: 0 }} />}
          </div>
          {/* The balance slides from the start line to where it is now */}
          <div className="prop-slide absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-text shadow" style={{ left: pos(st.balance), "--from": pos(st.start), "--i": i } as React.CSSProperties} title={`Balance ${usd(st.balance, cur)}`} />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px]">
          <span><span className="num block text-text-2">{usd0(st.floor, cur)}</span><span className="text-muted">Fail below</span></span>
          <span className="text-center"><span className="num block text-text-2">{usd0(st.start, cur)}</span><span className="text-muted">Start</span></span>
          <span className="text-right"><span className="num block text-text-2">{st.target === null ? "—" : usd0(st.target, cur)}</span><span className="text-muted">{st.target === null ? "No target" : "Target"}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Balance" value={<CountUp className="num" value={st.balance} format={(v) => usd(v, cur)} />} />
        <Stat label="Room left" value={st.roomLeft === null ? "Set max loss" : <CountUp className={cx("num", roomTone)} value={st.roomLeft} format={(v) => usd(v, cur)} />} />
        <Stat label="To target" value={st.target === null ? "—" : st.balance >= st.target ? "Reached" : <CountUp className="num" value={st.target - st.balance} format={(v) => usd(v, cur)} />} />
        <Stat label="Trading days" value={<span className="num">{st.tradingDays}</span>} />
      </div>

      {st.dailyLimit !== null && (
        <div>
          <div className="mb-1.5 flex justify-between text-[12px]">
            <span className="text-text-2">Today vs daily loss limit</span>
            <span className={cx("num", st.todayNet < 0 ? "neg" : "text-text-2")}>{fmtMoney(st.todayNet, cur, { sign: true })} of −{usd(st.dailyLimit, cur)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-card-2"><div className={cx("prop-grow h-full rounded-full", (st.dailyUsed ?? 0) >= 0.75 ? "bg-neg" : (st.dailyUsed ?? 0) >= 0.5 ? "bg-[#e0a83a]" : "bg-text-2")} style={{ width: `${(st.dailyUsed ?? 0) * 100}%`, "--i": i } as React.CSSProperties} /></div>
        </div>
      )}
      {st.progress !== null && (
        <div>
          <div className="mb-1.5 flex justify-between text-[12px]"><span className="text-text-2">Progress to target</span><span className="num text-text-2">{Math.round(st.progress * 100)}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-card-2"><div className="prop-grow h-full rounded-full bg-pos" style={{ width: `${st.progress * 100}%`, "--i": i } as React.CSSProperties} /></div>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-line-soft pt-3 text-[12px] text-muted">
        <span>Estimated from your journal · check your firm&apos;s dashboard</span>
        <Link href="/accounts" className="text-text-2 hover:text-text">Edit rules</Link>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><p className="text-[11.5px] text-muted">{label}</p><p className="mt-1 truncate text-[16px] font-semibold text-text">{value}</p></div>;
}

/** A drawn monogram for the firm (no third-party logos). */
function FirmBadge({ firm, size = 40 }: { firm: string; size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-xl border border-line bg-card-2 font-bold text-text" style={{ width: size, height: size, fontSize: size * 0.42 }}>{firm.charAt(0) || "?"}</span>;
}

/* ------------------------------------------------------------------ add account */

function AddAccount({ onDone }: { onDone: () => void }) {
  const [firm, setFirm] = useState<string | null>(null);
  const { toast } = useFeedback();
  if (!firm) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {FIRMS.map((f, i) => {
          const plans = PROP_FIRM_RULES[f], sizes = firmSizes(f);
          return (
            <button key={f} type="button" onClick={() => setFirm(f)} style={{ "--i": i } as React.CSSProperties} className="prop-rise group flex flex-col gap-5 rounded-2xl border border-line bg-card p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-text-2 hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] active:scale-[0.99]">
              <div className="flex items-center gap-4">
                <span className="transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110"><FirmBadge firm={f} size={52} /></span>
                <div>
                  <p className="text-[18px] font-semibold text-text">{f}</p>
                  <p className="text-[13px] text-muted">Futures · {plans.length} plans · {k(sizes[0])} to {k(sizes[sizes.length - 1])}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">{plans.map((p) => <span key={p.name} className="rounded-full border border-line-soft px-3 py-1 text-[12px] text-text-2">{p.name}</span>)}</div>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text">Log your account <span className="transition-transform group-hover:translate-x-0.5">→</span></span>
            </button>
          );
        })}
        <p className="text-[12px] text-muted md:col-span-2">More firms are coming. Using another firm? Add a Funded account on the Account desk and enter its rules yourself.</p>
      </div>
    );
  }
  return <FirmPicker firm={firm} onBack={() => setFirm(null)} onAdded={(name) => { toast(`${name} added`); onDone(); }} />;
}

function FirmPicker({ firm, onBack, onAdded }: { firm: string; onBack: () => void; onAdded: (name: string) => void }) {
  const plans = PROP_FIRM_RULES[firm];
  const [planName, setPlanName] = useState(plans[0].name);
  const [daily, setDaily] = useState(false);
  const [stage, setStage] = useState<PropStage>("evaluation");
  const accounts = useLedgr((s) => s.accounts);
  const plan = plans.find((p) => p.name === planName) ?? plans[0];
  const sizes = firmSizes(firm);

  const add = (size: number) => {
    const pre = presetRules(firm, plan.name, size, stage, daily)!;
    const n = accounts.filter((a) => a.propFirm === firm && a.accountSize === size).length;
    const name = `${short(firm)} ${k(size)}${n ? ` #${n + 1}` : ""}`;
    saveAccount({ ...newAccount(), name, type: "Funded", currency: "USD", startingBalance: size, propFirm: firm, accountSize: size, propPlan: plan.name, propStage: stage, propDailyLimit: daily, rules: pre.rules } as Account);
    onAdded(name);
  };

  return (
    <div className="prop-rise flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={onBack}>Firms</Button>
        <FirmBadge firm={firm} size={34} />
        <div><p className="text-[17px] font-semibold text-text">{firm}</p><p className="text-[12px] text-muted">Futures · pick the account you bought</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {plans.map((p) => (
          <button key={p.name} type="button" onClick={() => setPlanName(p.name)} aria-pressed={p.name === plan.name}
            className={cx("min-w-[150px] rounded-2xl border px-5 py-3 text-left transition-all duration-300", p.name === plan.name ? "scale-[1.03] border-text-2 bg-card-2 shadow-[0_16px_40px_-24px_rgba(255,255,255,0.25)]" : "border-line bg-card hover:-translate-y-0.5 hover:border-text-2/60")}>
            <span className="block text-[15px] font-semibold text-text">{p.name}</span>
            <span className="block text-[12px] text-muted">{p.tagline}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-[13px] text-text-2">Stage
          <Segmented ariaLabel="Stage" size="sm" value={stage} onChange={setStage} options={[{ value: "evaluation", label: "Evaluation" }, { value: "funded", label: "Funded" }]} />
        </label>
        {plan.optionalDailyLimit && (
          <label className="flex items-center gap-2 text-[13px] text-text-2">Daily loss limit
            <Segmented ariaLabel="Daily loss limit" size="sm" value={daily ? "on" : "off"} onChange={(v) => setDaily(v === "on")} options={[{ value: "off", label: "Off" }, { value: "on", label: "On" }]} />
          </label>
        )}
      </div>

      <div key={`${plan.name}-${stage}-${daily}`} className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sizes.map((size, i) => {
          const pre = presetRules(firm, plan.name, size, stage, daily)!;
          const s = plan.sizes[size];
          const fail = size - pre.rules.maxDrawdown!, target = pre.rules.profitTarget ? size + pre.rules.profitTarget : null;
          const hi = target ?? size + pre.rules.maxDrawdown!;
          const at = (v: number) => `${((v - fail) / (hi - fail)) * 100}%`;
          return (
            <div key={size} style={{ "--i": i } as React.CSSProperties} className="prop-rise group flex flex-col rounded-2xl border border-line bg-gradient-to-b from-card-2 to-card p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-text-2/70 hover:shadow-[0_30px_70px_-35px_rgba(0,0,0,0.9)]">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Account size</p>
                <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] text-text-2">{stage === "evaluation" ? "Evaluation" : "Funded"}</span>
              </div>
              <p className="mt-1 origin-left text-[44px] font-bold leading-none tracking-tight text-text transition-transform duration-300 group-hover:scale-105">{k(size)}</p>
              <p className="mt-1 text-[12.5px] text-muted">{short(firm)} · {plan.name}</p>
              <div className="relative mt-5 h-1.5 rounded-full bg-card">
                <div className="prop-grow absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-neg/40 via-text-2/40 to-pos/60" style={{ width: "100%", "--i": i } as React.CSSProperties} />
                <span className="prop-pop absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-text" style={{ left: at(size), "--i": i } as React.CSSProperties} />
              </div>
              <div className="mt-2 flex justify-between text-[11px]">
                <span><span className="num block text-text">{usd0(fail)}</span><span className="text-muted">Fail below</span></span>
                <span className="text-center"><span className="num block text-text">{usd0(size)}</span><span className="text-muted">Start</span></span>
                <span className="text-right"><span className="num block text-text">{target === null ? "—" : usd0(target)}</span><span className="text-muted">{target === null ? "No target" : "Target"}</span></span>
              </div>
              <dl className="mt-4 divide-y divide-line-soft text-[13px]">
                {[
                  ["Profit target", target === null ? "None" : usd0(pre.rules.profitTarget)],
                  ["Max loss", <span key="m">{usd0(pre.rules.maxDrawdown)} <span className="text-[11px] text-muted">{plan.trailing}</span></span>],
                  ["Daily loss", pre.rules.dailyLossLimit === null ? "None" : usd0(pre.rules.dailyLossLimit)],
                  ["Contracts", s.maxContracts],
                  ["Min days", "None"],
                  ["Consistency", plan.consistency],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex items-baseline justify-between gap-3 py-2"><dt className="text-muted">{l}</dt><dd className="text-right font-medium text-text">{v}</dd></div>
                ))}
              </dl>
              <Button variant="accent" className="mt-4" icon={<Check size={14} />} onClick={() => add(size)}>Add this account</Button>
            </div>
          );
        })}
      </div>
      <p className="text-[12px] text-muted">{plan.note} Rules checked {PROP_RULES_CHECKED} from public summaries; firms change them, so compare with your dashboard. You can edit any rule on the Account desk.</p>
    </div>
  );
}
