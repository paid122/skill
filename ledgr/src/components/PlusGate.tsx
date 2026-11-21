"use client";
/** LEDGR+ helpers: a small tag, and a prompt that explains the feature and links to /plus. */
import { Gem } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { PLUS } from "@/lib/plus";
import { usePlus } from "@/lib/usePlus";
import { cx } from "@/lib/util";
import { Modal } from "./ui";

export function PlusTag({ className }: { className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-[#3ee08a] to-[#2bb3a0] px-1.5 py-[1px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-black", className)}><Gem size={10} strokeWidth={2.5} />Plus</span>;
}

const Ctx = createContext<(feature: string) => void>(() => undefined);

/** Wrap the app once; then call useUpsell()(feature) to show the LEDGR+ prompt. */
export function UpsellProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<string | null>(null);
  const show = useCallback((f: string) => setFeature(f), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {feature && (
        <Modal open onClose={() => setFeature(null)} title={<span className="flex items-center gap-2">{feature} <PlusTag /></span>} size="sm"
          footer={<><button type="button" onClick={() => setFeature(null)} className="rounded-xl px-4 py-2 text-[13.5px] text-text-2 hover:text-text">Not now</button><Link href="/plus" onClick={() => setFeature(null)} className="rounded-xl bg-accent px-4 py-2 text-[13.5px] font-semibold text-on-accent">See {PLUS.name}</Link></>}>
          <p className="text-[14px] leading-relaxed text-text-2">{feature} is part of <b className="text-text">{PLUS.name}</b>: ${PLUS.priceUsd} for {PLUS.days} days, one payment, no subscription. It also includes {PLUS.matrixxPlan} for MatrixX AI.</p>
          <p className="mt-3 text-[13px] text-muted">Your journal, analytics, prop firm tracker and the community stay free.</p>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

/**
 * Returns [hasPlus, gate]. gate(feature, action) runs the action with LEDGR+, otherwise shows the
 * prompt. While the check is still running it lets the action through, so paying users never wait.
 */
export function usePlusGate(): [boolean | null, (feature: string, action: () => void) => void] {
  const plus = usePlus();
  const upsell = useContext(Ctx);
  return [plus, (feature, action) => (plus === false ? upsell(feature) : action())];
}
