"use client";
import { Plus } from "lucide-react";
import { useState } from "react";
import { cx } from "@/lib/util";

const QA = [
  ["Does Ledgr connect to my broker or place trades?", "No. Ledgr is a journal for simulated and historical records. It never connects to brokerage accounts, never executes trades and never gives financial advice."],
  ["Do I need an account?", "No. Ledgr works fully in your browser without one. An account adds cloud backup and lets you use the same journal on other devices."],
  ["How are my statistics calculated?", "From your closed trades only. Drafts and open positions are excluded and counted separately, and every formula — win rate, R, profit factor, drawdown — is shown in the app."],
  ["What does Ledgr AI do with my data?", "It reads a summary of the records in the range you select and answers questions about your own history, citing the trades it used. You can view exactly what is shared before asking."],
  ["Why are there Bible verses?", "Ledgr is built around discipline, honesty and patience. Each page carries a short King James verse chosen for its purpose. They never react to your profit or loss."],
  ["Can I export my data?", "Yes — download a full backup (including images) any time, export trades to CSV, and export reports as PNG or PDF."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {QA.map(([q, a], i) => (
        <div key={q}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-6 py-5 text-left text-[16px] font-medium text-ink">
            {q}
            <Plus size={18} className={cx("shrink-0 text-ink/60 transition-transform duration-200", open === i && "rotate-45")} />
          </button>
          <div className={cx("grid transition-[grid-template-rows] duration-300", open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <p className="overflow-hidden pb-0 text-[15px] leading-relaxed text-ink/60">{open === i && <span className="block pb-6">{a}</span>}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
