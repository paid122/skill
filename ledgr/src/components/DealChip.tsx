"use client";
/** "Affiliate · Code X": copies the code, and links to the firm with your affiliate link. */
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { PropDeal } from "@/lib/propDeals";
import { cx } from "@/lib/util";

export function DealChip({ deal, className }: { deal: PropDeal; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cx("rounded-2xl bg-black/35 px-3 py-2 ring-1 ring-white/15", className)}>
      <div className="flex items-center gap-2 whitespace-nowrap text-[12px]">
        <span className="text-white/55">Affiliate · Code</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(deal.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-bold tracking-wide text-black" title="Copy code">
          {deal.code}{copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
        <span className="flex-1" />
        <a href={deal.url} target="_blank" rel="sponsored noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-white/75 hover:text-white">Get account <ExternalLink size={11} /></a>
      </div>
      {deal.offer && <p className="mt-1 truncate text-[11.5px] text-white/60">{deal.offer}</p>}
    </div>
  );
}

export const DEAL_DISCLOSURE = "Affiliate codes and links: LEDGR earns a commission when you buy with them, at no extra cost to you.";
