"use client";
/** "Your plan" in Settings: which plan you're on, what it unlocks, and the way up. */
import { Gem } from "lucide-react";
import Link from "next/link";
import { PLUS, PRO, planName } from "@/lib/plus";
import { usePlan } from "@/lib/usePlus";
import { PlusTag } from "./PlusGate";
import { Card } from "./ui";

export function PlanStatusCard() {
  const plan = usePlan();
  if (plan === null) return null;
  const next = plan === "free" ? PLUS : plan === "plus" ? PRO : null;
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-card-2 text-text"><Gem size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-text">Your plan: {planName(plan)} {plan !== "free" && <PlusTag level={plan} />}</p>
        <p className="text-[13px] text-text-2">
          {plan === "free" ? "Journal, dashboard, prop tracker for 1 account and the community are yours, free."
            : plan === "plus" ? "Analytics, weekly review, unlimited accounts, copy trading and your own backgrounds are on."
            : "Everything is on, including the MatrixX AI coach."}
        </p>
      </div>
      {next ? <Link href={`/plus?plan=${next.id}`} className="rounded-xl bg-accent px-4 py-2 text-[13.5px] font-semibold text-on-accent">Upgrade to {next.name} · ${next.priceUsd}</Link>
        : <Link href="/plus" className="rounded-xl border border-line px-4 py-2 text-[13.5px] text-text-2 hover:text-text">Manage plan</Link>}
    </Card>
  );
}
