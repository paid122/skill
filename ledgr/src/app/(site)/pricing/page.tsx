import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/site/CtaLink";
import { Reveal } from "@/components/site/SiteChrome";

export const metadata: Metadata = { title: "Pricing", description: "Ledgr is free. Every feature, no card required." };

const INCLUDED = [
  "Unlimited trades, accounts and strategies",
  "Quick Log and the full five-tab trade editor",
  "14 analytics charts and 14 pattern checks",
  "What-if analysis and performance score",
  "Psychology, discipline score and mistake tracker",
  "Daily journal, weekly review and checklist",
  "Study room with video notes and boards",
  "Verse library with favourites and reflections",
  "Ledgr AI (offline analysis; model analysis where enabled)",
  "Reports and share cards — PNG and PDF",
  "Cloud backup and sync with a free account",
  "Full data export at any time",
];

export default function PricingPage() {
  return (
    <div className="px-5 pb-28 pt-32 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="text-[48px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[72px]">Simple. Free.</h1>
        <p className="mt-6 text-[17px] text-white/60">Every feature is included. No card, no trial clock.</p>
      </Reveal>
      <div className="mx-auto mt-16 grid max-w-[980px] gap-5 md:grid-cols-[1.35fr_1fr]">
        <Reveal className="rounded-[28px] bg-white p-9 text-black">
          <p className="text-[14px] font-medium">Free</p>
          <p className="mt-4 flex items-end gap-2"><span className="text-[64px] font-semibold leading-none tracking-[-0.04em]">$0</span><span className="mb-2 text-black/50">forever for the features below</span></p>
          <CtaLink className="mt-8 flex h-12 items-center justify-center rounded-full bg-black text-[15px] font-medium text-white">Start your journal</CtaLink>
          <ul className="mt-9 grid gap-3">
            {INCLUDED.map((f) => <li key={f} className="flex gap-3 text-[14.5px]"><Check size={17} className="mt-0.5 shrink-0" />{f}</li>)}
          </ul>
        </Reveal>
        <Reveal delay={120} className="flex flex-col rounded-[28px] border border-white/15 bg-white/[0.03] p-9">
          <p className="text-[14px] font-medium text-white/80">Pro</p>
          <p className="mt-4 text-[34px] font-semibold tracking-[-0.03em]">Coming later</p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">We're not selling a paid plan yet. If one arrives, everything listed under Free stays free.</p>
          <Link href="/community" className="mt-auto inline-flex h-12 items-center justify-center rounded-full border border-white/25 text-[15px] text-white transition-colors hover:border-white/60">Get updates</Link>
        </Reveal>
      </div>
      <p className="mx-auto mt-10 max-w-xl text-center text-[13px] text-white/40">Model-backed Ledgr AI requires the site owner to configure an AI provider; without it, Ledgr AI answers with offline analysis calculated from your records.</p>
    </div>
  );
}
