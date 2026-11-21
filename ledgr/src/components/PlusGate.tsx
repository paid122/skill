"use client";
/** Plan helpers: a small tag, the upgrade prompt, a gate for actions and a wall for whole pages. */
import { Gem, Lock } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { PLUS, PRO, type PlanId } from "@/lib/plus";
import { atLeast, usePlan } from "@/lib/usePlus";
import { cx } from "@/lib/util";
import { Modal } from "./ui";

export function PlusTag({ className, level = "plus" }: { className?: string; level?: Exclude<PlanId, "free"> }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-[1px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-black",
      level === "pro" ? "bg-gradient-to-r from-[#c9a7ff] to-[#8f7bff]" : "bg-gradient-to-r from-[#3ee08a] to-[#2bb3a0]", className)}>
      <Gem size={10} strokeWidth={2.5} />{level === "pro" ? "Pro" : "Plus"}
    </span>
  );
}

type Ask = { feature: string; level: Exclude<PlanId, "free"> };
const Ctx = createContext<(a: Ask) => void>(() => undefined);

/** Wrap the app once; then useUpsell / usePlusGate show the upgrade prompt. */
export function UpsellProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const show = useCallback((a: Ask) => setAsk(a), []);
  const plan = ask?.level === "pro" ? PRO : PLUS;
  return (
    <Ctx.Provider value={show}>
      {children}
      {ask && (
        <Modal open onClose={() => setAsk(null)} title={<span className="flex items-center gap-2">{ask.feature} <PlusTag level={ask.level} /></span>} size="sm"
          footer={<><button type="button" onClick={() => setAsk(null)} className="rounded-xl px-4 py-2 text-[13.5px] text-text-2 hover:text-text">Not now</button><Link href={`/plus?plan=${ask.level}`} onClick={() => setAsk(null)} className="rounded-xl bg-accent px-4 py-2 text-[13.5px] font-semibold text-on-accent">See {plan.name}</Link></>}>
          <p className="text-[14px] leading-relaxed text-text-2">{ask.feature} comes with <b className="text-text">{plan.name}</b>: ${plan.priceUsd} for {plan.days} days, one payment, no subscription. It also includes {plan.matrixxPlan} for MatrixX AI.</p>
          <p className="mt-3 text-[13px] text-muted">Your journal, dashboard, prop tracker and the community stay free.</p>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useUpsell() { return useContext(Ctx); }

/**
 * Returns [hasLevel, gate]. gate(feature, action) runs the action on the right plan, otherwise shows
 * the prompt. While the check is still running it lets the action through, so paying users never wait.
 */
export function usePlusGate(level: Exclude<PlanId, "free"> = "plus"): [boolean | null, (feature: string, action: () => void) => void] {
  const plan = usePlan();
  const upsell = useContext(Ctx);
  const has = plan === null ? null : atLeast(plan, level);
  return [has, (feature, action) => (has === false ? upsell({ feature, level }) : action())];
}

/** A whole page or section on a paid plan: shows a blurred preview and the upgrade card instead. */
export function PlanWall({ level = "plus", feature, sub, children }: { level?: Exclude<PlanId, "free">; feature: string; sub: string; children: ReactNode }) {
  const plan = usePlan();
  if (plan === null || atLeast(plan, level)) return <>{children}</>;
  const p = level === "pro" ? PRO : PLUS;
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none max-h-[640px] select-none overflow-hidden opacity-40 blur-[6px] [mask-image:linear-gradient(to_bottom,black,transparent)]">{children}</div>
      <div className="absolute inset-x-0 top-16 mx-auto flex max-w-md flex-col items-center rounded-2xl border border-line bg-card/95 p-7 text-center shadow-2xl backdrop-blur">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-card-2 text-text"><Lock size={20} /></span>
        <p className="mt-4 flex items-center gap-2 text-[18px] font-semibold text-text">{feature} <PlusTag level={level} /></p>
        <p className="mt-2 text-[14px] leading-relaxed text-text-2">{sub}</p>
        <Link href={`/plus?plan=${level}`} className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-[14px] font-semibold text-on-accent">Get {p.name}: ${p.priceUsd} / {p.days} days</Link>
        <p className="mt-2 text-[12px] text-muted">One payment, no subscription.</p>
      </div>
    </div>
  );
}
