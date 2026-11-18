"use client";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Plus, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      <PageIntro title="Prop firms" sub="Your prop firm accounts (Apex, Lucid, Topstep, Take Profit Trader, Tradeify, TradeDay, MyFundedFutures) against their rules: room left before the max loss, today's loss against the daily limit, and progress to target. Estimated from your journal — your firm's dashboard is the official record."
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
const LOGO_KEY: Record<string, string> = {
  "Apex Trader Funding": "apex", "Lucid Trading": "lucid", Topstep: "topstep", "Take Profit Trader": "takeprofittrader",
  Tradeify: "tradeify", TradeDay: "tradeday", MyFundedFutures: "myfundedfutures",
};

/** The firm's logo on a white tile (to identify it next to your accounts); its first letter if the logo can't load. */
function FirmLogo({ firm, size = 40, round = false, fallback, fallbackStyle }: { firm: string; size?: number; round?: boolean; fallback?: string; fallbackStyle?: React.CSSProperties }) {
  const [failed, setFailed] = useState(false);
  const key = LOGO_KEY[firm];
  const shape = round ? "rounded-full" : "rounded-xl";
  if (!key || failed) {
    return <span className={cx("grid shrink-0 place-items-center font-bold", shape, fallback ?? "border border-line bg-card-2 text-text")} style={{ width: size, height: size, fontSize: size * 0.42, ...fallbackStyle }}>{firm.charAt(0) || "?"}</span>;
  }
  return (
    <span className={cx("grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-white/10", shape)} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/firm-logo?f=${key}`} alt={`${firm} logo`} onError={() => setFailed(true)} className="h-full w-full object-cover" />
    </span>
  );
}
const FirmBadge = FirmLogo;

/* ------------------------------------------------------------------ add account */

/** Each firm's card colour (our own palette, not the firms' branding). */
const FIRM_TONE: Record<string, { from: string; to: string; accent: string; button: string }> = {
  "Apex Trader Funding": { from: "#3a2410", to: "#120c07", accent: "#f2a65a", button: "#f2a65a" },
  "Lucid Trading": { from: "#10243f", to: "#070c14", accent: "#7cb7ff", button: "#7cb7ff" },
  Topstep: { from: "#0f2e22", to: "#06100c", accent: "#5fd6a0", button: "#5fd6a0" },
  "Take Profit Trader": { from: "#2b1440", to: "#0d0714", accent: "#c79bff", button: "#c79bff" },
  Tradeify: { from: "#0e2a33", to: "#060f12", accent: "#5ed1e6", button: "#5ed1e6" },
  TradeDay: { from: "#33280c", to: "#110d05", accent: "#f2d061", button: "#f2d061" },
  MyFundedFutures: { from: "#251a40", to: "#0b0814", accent: "#9b8cff", button: "#9b8cff" },
};
const tone = (f: string) => FIRM_TONE[f] ?? { from: "#222", to: "#0c0c0c", accent: "#ddd", button: "#fff" };

function AddAccount({ onDone }: { onDone: () => void }) {
  const [firm, setFirm] = useState<string | null>(null);
  const { toast } = useFeedback();
  return (
    <div className="flex flex-col items-center">
      <div className="prop-rise mb-8 mt-2 flex flex-col items-center text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-card-2 text-text-2"><ShieldCheck size={24} /></span>
        <p className="mt-5 text-[24px] font-semibold tracking-tight text-text">Track your prop firm challenges</p>
        <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-text-2">Pick a firm below to add your account. LEDGR fills in its rules and tracks it from your journal.</p>
      </div>
      <div className="grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FIRMS.map((f, i) => {
          const plans = PROP_FIRM_RULES[f], sizes = firmSizes(f), t = tone(f);
          return (
            <div key={f} style={{ "--i": i + 1, background: `radial-gradient(120% 120% at 0% 0%, ${t.from}, ${t.to} 70%)` } as React.CSSProperties}
              className="prop-rise group relative overflow-hidden rounded-[22px] border border-white/10 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] transition-all duration-300 hover:-translate-y-1 hover:border-white/20">
              <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70" style={{ background: t.accent }} />
              <div className="relative flex items-center gap-4">
                <span className="shrink-0 transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110"><FirmLogo firm={f} size={56} fallback="bg-black/40 text-white ring-1 ring-white/15" /></span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: t.accent }}>Futures</p>
                  <p className="text-[20px] font-semibold text-white">{f}</p>
                  <p className="text-[13px] text-white/60">{plans.length} plan{plans.length === 1 ? "" : "s"} · {k(sizes[0])} to {k(sizes[sizes.length - 1])}</p>
                </div>
              </div>
              <div className="relative mt-5 flex flex-wrap gap-2">{plans.map((p) => <span key={p.name} className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/80">{p.name}</span>)}</div>
              <button type="button" onClick={() => setFirm(f)} className="relative mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-black transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]" style={{ background: t.button }}>
                <Plus size={15} /> Log your account
              </button>
            </div>
          );
        })}
      </div>
      <p className="prop-rise mt-6 max-w-2xl text-center text-[12px] text-muted" style={{ "--i": FIRMS.length + 1 } as React.CSSProperties}>Only rules that public sources agree on are filled in; where they disagree we leave it for you to enter. Using another firm, like Alpha Futures or Elite Trader Funding? Add a Funded account on the Account desk and enter its rules yourself.</p>
      {firm && <FirmPicker firm={firm} onClose={() => setFirm(null)} onAdded={(name) => { toast(`${name} added`); setFirm(null); onDone(); }} />}
    </div>
  );
}

/** Full-screen picker: plan tabs, daily-loss switch and a carousel of account sizes, like the firm's own checkout. */
function FirmPicker({ firm, onClose, onAdded }: { firm: string; onClose: () => void; onAdded: (name: string) => void }) {
  const plans = PROP_FIRM_RULES[firm];
  const [planName, setPlanName] = useState(plans[0].name);
  const [daily, setDaily] = useState(false);
  const [stage, setStage] = useState<PropStage>("evaluation");
  const [unit, setUnit] = useState<"$" | "%">("$");
  const [active, setActive] = useState(1);
  const [mounted, setMounted] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  const accounts = useLedgr((s) => s.accounts);
  const plan = plans.find((p) => p.name === planName) ?? plans[0];
  const sizes = firmSizes(firm, plan.name);
  const t = tone(firm);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // Keep the chosen card centred in the carousel.
  const centre = (i: number, smooth = true) => {
    const el = row.current?.children[i] as HTMLElement | undefined;
    if (el && row.current) row.current.scrollTo({ left: el.offsetLeft - (row.current.clientWidth - el.clientWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  };
  // A plan with fewer sizes: keep the selection in range (prefer 50K).
  useEffect(() => { setActive((i) => (i < sizes.length ? i : Math.max(0, sizes.indexOf(50000)))); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [planName]);
  useEffect(() => { if (mounted) requestAnimationFrame(() => centre(active, false)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mounted, planName, stage, daily]);
  const onScroll = () => {
    const r = row.current;
    if (!r) return;
    const mid = r.scrollLeft + r.clientWidth / 2;
    let best = 0, dist = Infinity;
    Array.from(r.children).forEach((c, i) => { const el = c as HTMLElement; const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - mid); if (d < dist) { dist = d; best = i; } });
    if (best !== active) setActive(best);
  };
  const go = (d: number) => { const i = Math.max(0, Math.min(sizes.length - 1, active + d)); setActive(i); centre(i); };

  const add = (size: number) => {
    const pre = presetRules(firm, plan.name, size, stage, daily)!;
    const n = accounts.filter((a) => a.propFirm === firm && a.accountSize === size).length;
    const name = `${short(firm)} ${k(size)}${n ? ` #${n + 1}` : ""}`;
    saveAccount({ ...newAccount(), name, type: "Funded", currency: "USD", startingBalance: size, propFirm: firm, accountSize: size, propPlan: plan.name, propStage: stage, propDailyLimit: daily, rules: pre.rules } as Account);
    onAdded(name);
  };
  const money = (v: number | null, size: number) => (v === null ? "None" : unit === "%" ? `${+((v / size) * 100).toFixed(2)}%` : usd0(v));

  if (!mounted) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${firm} accounts`} className="animate-fade fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pb-10 pt-5 sm:px-8">
        {/* Top bar */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Back to firms" className="grid h-10 w-10 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"><ArrowLeft size={18} /></button>
            <div className="flex rounded-full bg-white/10 p-1" role="radiogroup" aria-label="Show values in">
              {(["$", "%"] as const).map((u) => <button key={u} type="button" role="radio" aria-checked={unit === u} onClick={() => setUnit(u)} className={cx("h-8 w-9 rounded-full text-[14px] font-semibold transition-colors", unit === u ? "bg-black text-white" : "text-white/60 hover:text-white")}>{u}</button>)}
            </div>
          </div>
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-center">
            <p className="flex items-center justify-center gap-3 text-[24px] font-semibold text-white sm:text-[28px]">
              <FirmLogo firm={firm} size={38} round fallback="text-black" fallbackStyle={{ background: t.accent }} />{firm}
            </p>
            <p className="mt-0.5 text-[13px] text-white/55">Futures · pick the account you bought</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"><X size={18} /></button>
        </div>

        {/* Plans */}
        <div className="mt-16 flex flex-wrap justify-center gap-3">
          {plans.map((p) => {
            const on = p.name === plan.name;
            return (
              <button key={p.name} type="button" onClick={() => setPlanName(p.name)} aria-pressed={on}
                className={cx("min-w-[170px] rounded-2xl px-6 py-3.5 text-center transition-all duration-300", on ? "scale-[1.04] bg-gradient-to-b from-white/25 to-white/10 shadow-[0_18px_40px_-20px_rgba(255,255,255,0.35)] ring-1 ring-white/30" : "bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/10")}>
                <span className="block text-[17px] font-semibold text-white">{p.name}</span>
                <span className="block text-[12.5px] text-white/55">{p.tagline}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] text-white/75">
          {plan.optionalDailyLimit && (
            <span className="flex items-center gap-3">Daily loss limit
              <Pill options={["Off", "On"]} value={daily ? "On" : "Off"} onChange={(v) => setDaily(v === "On")} />
            </span>
          )}
          <span className="flex items-center gap-3">Stage
            <Pill options={["Evaluation", "Funded"]} value={stage === "evaluation" ? "Evaluation" : "Funded"} onChange={(v) => setStage(v === "Funded" ? "funded" : "evaluation")} />
          </span>
        </div>

        {/* Carousel of sizes */}
        <div className="relative mt-8">
          <div ref={row} onScroll={onScroll} key={`${plan.name}-${stage}-${daily}`} className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-[calc(50%-190px)] pb-6 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sizes.map((size, i) => {
              const pre = presetRules(firm, plan.name, size, stage, daily)!;
              const s = plan.sizes[size];
              const fail = size - pre.rules.maxDrawdown!, target = pre.rules.profitTarget ? size + pre.rules.profitTarget : null;
              const hi = target ?? size + pre.rules.maxDrawdown!;
              const at = `${((size - fail) / (hi - fail)) * 100}%`;
              const on = i === active;
              return (
                <div key={size} onClick={() => { if (!on) { setActive(i); centre(i); } }} style={{ "--i": i } as React.CSSProperties}
                  className={cx("prop-rise relative w-[380px] shrink-0 snap-center overflow-hidden rounded-[26px] p-6 ring-1 transition-all duration-500",
                    on ? "scale-[1.04] bg-gradient-to-b from-[#5a5a5a] via-[#2a2a2a] to-[#141414] ring-white/25 shadow-[0_40px_90px_-40px_rgba(0,0,0,1)]" : "cursor-pointer scale-95 bg-gradient-to-b from-[#3a3a3a] via-[#1d1d1d] to-[#121212] opacity-60 ring-white/10 hover:opacity-80")}>
                  <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.18),rgba(255,255,255,0.02)_60%,transparent_70%)]" />
                  <div className="relative flex items-start justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/50">Account size</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/75">{stage === "evaluation" ? "Evaluation" : "Funded"}</span>
                  </div>
                  <p className="relative mt-1 text-[64px] font-bold leading-none tracking-[-0.04em] text-white">{k(size)}</p>
                  <p className="relative mt-1 text-[14px] text-white/55">{firm} · {plan.name}</p>
                  <div className="relative mt-6 h-2 rounded-full bg-black/40">
                    <div className="prop-grow absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-black/30 via-white/40 to-white" style={{ width: "100%", "--i": i } as React.CSSProperties} />
                    <span className="prop-pop absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white" style={{ left: at, "--i": i } as React.CSSProperties} />
                  </div>
                  <div className="relative mt-2.5 flex justify-between text-[12px]">
                    <span><span className="num block font-semibold text-white">{usd0(fail)}</span><span className="text-white/50">Fail below</span></span>
                    <span className="text-center"><span className="num block font-semibold text-white">{usd0(size)}</span><span className="text-white/50">Start</span></span>
                    <span className="text-right"><span className="num block font-semibold text-white">{target === null ? "—" : usd0(target)}</span><span className="text-white/50">{target === null ? "No target" : "Target"}</span></span>
                  </div>
                  <dl className="relative mt-5 divide-y divide-white/10 text-[14px]">
                    {[
                      ["Profit target", money(pre.rules.profitTarget, size)],
                      ["Max loss", <span key="m">{money(pre.rules.maxDrawdown, size)} <span className="text-[12px] text-white/45">{plan.trailing.replace("trailing", "Trailing")}</span></span>],
                      ["Daily loss", money(pre.rules.dailyLossLimit, size)],
                      ["Contracts", s.maxContracts.replace("/", "OR")],
                      ["Min days", pre.rules.minTradingDays ? `${pre.rules.minTradingDays} days` : "None"],
                      ["Consistency", plan.consistency],
                    ].map(([l, v]) => (
                      <div key={l as string} className="flex items-baseline justify-between gap-3 py-2.5"><dt className="text-white/55">{l}</dt><dd className="text-right font-semibold text-white">{v}</dd></div>
                    ))}
                  </dl>
                  <button type="button" onClick={(e) => { e.stopPropagation(); add(size); }} className={cx("relative mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-all duration-200", on ? "bg-white text-black hover:scale-[1.02] active:scale-[0.98]" : "bg-white/15 text-white")}>
                    <Check size={15} /> Add this account
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => go(-1)} disabled={active === 0} aria-label="Smaller account" className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/15 backdrop-blur transition-opacity hover:bg-black/80 disabled:opacity-0"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => go(1)} disabled={active === sizes.length - 1} aria-label="Bigger account" className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/15 backdrop-blur transition-opacity hover:bg-black/80 disabled:opacity-0"><ChevronRight size={20} /></button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[12px] text-white/45">{plan.note} Rules checked {PROP_RULES_CHECKED} from public summaries; firms change them, so compare with your dashboard. You can edit any rule on the Account desk.</p>
      </div>
    </div>,
    document.body,
  );
}

function Pill({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <span className="flex rounded-full bg-white/10 p-1" role="radiogroup">
      {options.map((o) => <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={cx("rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors", value === o ? "bg-black text-white" : "text-white/60 hover:text-white")}>{o}</button>)}
    </span>
  );
}
