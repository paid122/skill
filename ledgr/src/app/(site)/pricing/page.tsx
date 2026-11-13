import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/site/CtaLink";
import { INCLUDED } from "@/components/site/included";
import { Reveal, SectionHeading } from "@/components/site/SiteChrome";
import { PLUS } from "@/lib/plus";

export const metadata: Metadata = { title: "Pricing", description: "Ledgr is free. Every feature, no card required. LEDGR+ adds MatrixX AI." };


export default function PricingPage() {
  return (
    <div className="px-5 pb-28 pt-32 sm:px-8">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h1 className="text-[48px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[72px]">Simple. Free.</h1>
        <p className="mt-6 text-[17px] text-ink/60">Every journal feature is free. No card, no trial clock. Add MatrixX AI with LEDGR+ when you want it.</p>
      </Reveal>
      <div className="mx-auto mt-16 grid max-w-[980px] items-start gap-5 md:grid-cols-[1.35fr_1fr]">
        <Reveal className="rounded-[28px] bg-ink p-9 text-paper">
          <p className="text-[14px] font-medium">Free</p>
          <p className="mt-4 flex items-end gap-2"><span className="text-[64px] font-semibold leading-none tracking-[-0.04em]">$0</span><span className="mb-2 text-paper/50">forever for the features below</span></p>
          <CtaLink className="mt-8 flex h-12 items-center justify-center rounded-full bg-paper text-[15px] font-medium text-ink">Start your journal</CtaLink>
          <ul className="mt-9 grid gap-3">
            {INCLUDED.map((f) => <li key={f} className="flex gap-3 text-[14.5px]"><Check size={17} className="mt-0.5 shrink-0" />{f}</li>)}
          </ul>
        </Reveal>
        <Reveal delay={120} className="flex flex-col site-shadow rounded-[28px] border border-ink/10 bg-paper-2 p-9">
          <p className="text-[14px] font-medium text-ink/80">{PLUS.name}</p>
          <p className="mt-4 flex items-end gap-2"><span className="text-[64px] font-semibold leading-none tracking-[-0.04em]">${PLUS.priceUsd}</span><span className="mb-2 text-ink/50">for {PLUS.days} days</span></p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink/60">Everything in Free, plus MatrixX AI included. A one-time card payment; buy another {PLUS.days} days whenever you want.</p>
          <Link href="/plus" className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-medium text-paper transition-opacity hover:opacity-90">Get {PLUS.name}</Link>
          <ul className="mt-9 grid gap-3">
            {PLUS.includes.map((f) => <li key={f} className="flex gap-3 text-[14.5px] text-ink/80"><Check size={17} className="mt-0.5 shrink-0" />{f}</li>)}
          </ul>
        </Reveal>
      </div>
      <p className="mx-auto mt-10 max-w-xl text-center text-[13px] text-ink/40">MatrixX AI also works with your own MatrixX account, free or paid. Without MatrixX, the AI page answers with offline analysis calculated from your records.</p>
      <section className="mx-auto mt-28 max-w-3xl">
        <Reveal><SectionHeading center title="Pricing questions" /></Reveal>
        <dl className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
          {[
            ["Is Ledgr really free?", "Yes. Every feature listed under Free is free. There's no trial period and no card to enter."],
            ["What is LEDGR+?", `LEDGR with MatrixX AI included: $${PLUS.priceUsd} buys ${PLUS.days} days of ${PLUS.matrixxPlan} on your MatrixX account, for trade reviews, weekly reviews and AI chat. It doesn't renew by itself.`],
            ["Will the free features change?", "No. The features listed under Free stay free. Any change would be announced on this page first."],
            ["Do I need an account to use it?", "No. Ledgr works fully in your browser. A free account only adds cloud backup and sync across devices."],
            ["What does MatrixX AI need?", "A connected MatrixX account (a free one works), or LEDGR+. Without it, the AI page still answers using offline analysis calculated from your records."],
          ].map(([q, a]) => (
            <div key={q} className="py-6"><dt className="text-[16px] font-medium">{q}</dt><dd className="mt-2 text-[15px] leading-relaxed text-ink/60">{a}</dd></div>
          ))}
        </dl>
      </section>
    </div>
  );
}
