import { ArrowRight, Check, Lock, Minus, Plus as PlusIcon, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/site/CtaLink";
import { INCLUDED } from "@/components/site/included";
import { Magnetic } from "@/components/site/Interactive";
import { Mark } from "@/components/site/Mark";
import { Reveal, SectionHeading } from "@/components/site/SiteChrome";
import { PLUS, PLUS_COMPARE } from "@/lib/plus";

export const metadata: Metadata = { title: "Pricing", description: "LEDGR is free: every journal feature, no card. LEDGR+ adds MatrixX AI for $15 per 30 days." };

const MX = "#3ee08a"; // MatrixX green, for the LEDGR+ glow

const FAQ: [string, string][] = [
  ["Is LEDGR really free?", "Yes. Every journal feature listed under Free is free, with no trial period and no card to enter."],
  ["What is LEDGR+?", `LEDGR with MatrixX AI included. $${PLUS.priceUsd} adds ${PLUS.days} days of ${PLUS.matrixxPlan} to your MatrixX account, for trade reviews, weekly reviews and AI chat.`],
  ["Does LEDGR+ renew automatically?", `No. It's a one-time payment for ${PLUS.days} days. Buy another ${PLUS.days} days whenever you want; extra days are added on top.`],
  ["Can I get a refund?", "LEDGR+ purchases are final and not refundable, except where the law requires otherwise. If a payment went wrong, email us and we'll fix it. See the Terms for details."],
  ["Do I need MatrixX for the AI?", "Yes. The AI runs on MatrixX. A free MatrixX account works (25 messages a day); LEDGR+ adds Starter. Without MatrixX, the AI page still answers with offline analysis from your records."],
  ["Do I need an account to use LEDGR?", "No. LEDGR works fully in your browser. A free account only adds cloud backup and sync across devices."],
  ["Will the free features change?", "No. The features listed under Free stay free. Any change would be announced on this page first."],
];

const STEPS: [string, string][] = [
  ["Connect MatrixX", "Sign in or create a free MatrixX account, then allow LEDGR."],
  [`Pay $${PLUS.priceUsd} by card`, `Secure Ziina page. ${PLUS.matrixxPlan} starts as soon as it's paid.`],
  ["Start reviewing", "Open any trade or your weekly review and click Review with MatrixX."],
];

function Cell({ v, strong }: { v: boolean | string; strong?: boolean }) {
  if (v === true) return <span className="flex justify-center"><Check size={18} className={strong ? "" : "text-ink/50"} style={strong ? { color: MX } : undefined} /></span>;
  if (v === false) return <span className="flex justify-center text-ink/25"><Minus size={16} /></span>;
  return <span className={`block text-center text-[14px] ${strong ? "font-semibold text-ink" : "text-ink/55"}`}>{v}</span>;
}

export default function PricingPage() {
  return (
    <div className="pb-28">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden px-5 pb-12 pt-32 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[460px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.14] blur-[110px]" style={{ background: `radial-gradient(closest-side, ${MX}, transparent)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at 50% 20%, black, transparent 65%)" }} />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur">Pricing</p>
          <h1 className="text-[48px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[80px]">Free to journal. <Mark>AI</Mark> when you want it.</h1>
          <p className="mx-auto mt-7 max-w-[34rem] text-[17px] leading-relaxed text-ink/60 sm:text-[19px]">Every journal feature is free, forever. Add MatrixX AI with LEDGR+ for ${PLUS.priceUsd}, only when you want it.</p>
        </Reveal>
      </section>

      {/* -------------------------------------------------------------- Plans */}
      <section className="px-5 sm:px-8">
        <div className="mx-auto grid max-w-[1040px] items-stretch gap-5 md:grid-cols-2">
          <Reveal className="flex flex-col rounded-[30px] bg-ink p-9 text-paper sm:p-10">
            <div className="flex items-center justify-between"><p className="text-[15px] font-medium">Free</p><span className="rounded-full border border-paper/25 px-3 py-1 text-[12px] text-paper/70">Every journal feature</span></div>
            <p className="mt-5 flex items-end gap-2"><span className="text-[72px] font-semibold leading-none tracking-[-0.045em]">$0</span><span className="mb-2.5 text-paper/50">forever</span></p>
            <p className="mt-3 text-[15px] text-paper/60">Everything you need to journal, review and improve.</p>
            <CtaLink className="mt-8 flex h-[52px] items-center justify-center rounded-full bg-paper text-[15px] font-medium text-ink transition-transform hover:scale-[1.02]">Start your journal</CtaLink>
            <ul className="mt-9 grid gap-3">
              {INCLUDED.map((f) => <li key={f} className="flex gap-3 text-[14.5px]"><Check size={17} className="mt-0.5 shrink-0 text-paper/70" />{f}</li>)}
            </ul>
          </Reveal>

          <Reveal delay={120} className="relative flex flex-col overflow-hidden rounded-[30px] border border-ink/10 bg-paper p-9 site-shadow sm:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: MX }} />
            <div className="relative flex items-center justify-between"><p className="text-[15px] font-medium">{PLUS.name}</p><span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 text-[12px] font-medium text-ink/75" style={{ background: `${MX}1f` }}><Sparkles size={12} style={{ color: MX }} /> MatrixX AI included</span></div>
            <p className="relative mt-5 flex items-end gap-2"><span className="text-[72px] font-semibold leading-none tracking-[-0.045em]">${PLUS.priceUsd}</span><span className="mb-2.5 text-ink/50">for {PLUS.days} days</span></p>
            <p className="relative mt-3 text-[15px] text-ink/60">Everything in Free, plus your AI trading coach.</p>
            <Link href="/plus" className="relative mt-8 flex h-[52px] items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-paper transition-transform hover:scale-[1.02]" style={{ boxShadow: `0 16px 40px -16px ${MX}` }}>Get {PLUS.name} <ArrowRight size={16} /></Link>
            <ul className="relative mt-9 grid gap-3">
              <li className="flex gap-3 text-[14.5px] font-medium"><PlusIcon size={17} className="mt-0.5 shrink-0" /> Everything in Free</li>
              {PLUS.includes.map((f) => <li key={f} className="flex gap-3 text-[14.5px] text-ink/80"><Check size={17} className="mt-0.5 shrink-0" style={{ color: MX }} />{f}</li>)}
            </ul>
            <p className="relative mt-auto flex items-center gap-1.5 pt-9 text-[12.5px] text-ink/45"><Lock size={13} /> Secure card payment with Ziina · one-time · no auto-renewal</p>
          </Reveal>
        </div>
        <p className="mx-auto mt-8 max-w-xl text-center text-[13px] text-ink/45">MatrixX AI also works with your own MatrixX account, free or paid.</p>
      </section>

      {/* ------------------------------------------------------- Compare table */}
      <section className="mx-auto max-w-[1040px] px-5 pt-28 sm:px-8">
        <Reveal><SectionHeading center kicker="Compare" title={<>Free vs <Mark>{PLUS.name}</Mark></>} /></Reveal>
        <Reveal delay={100} className="mt-12 overflow-hidden rounded-[26px] border border-ink/10 bg-paper site-shadow">
          <div className="grid grid-cols-[minmax(0,1fr)_84px_84px] items-center border-b border-ink/10 px-5 py-4 text-[14px] sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:px-8">
            <span className="font-medium text-ink/50">Feature</span>
            <span className="text-center font-medium text-ink/60">Free</span>
            <span className="text-center font-semibold">{PLUS.name}</span>
          </div>
          {PLUS_COMPARE.map((r, i) => (
            <div key={r.label} className={`grid grid-cols-[minmax(0,1fr)_84px_84px] items-center px-5 py-4 text-[14.5px] sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:px-8 ${i % 2 ? "bg-ink/[0.025]" : ""}`}>
              <span className="text-ink/75">{r.label}</span><Cell v={r.free} /><Cell v={r.plus} strong />
            </div>
          ))}
        </Reveal>
      </section>

      {/* -------------------------------------------------------- How it works */}
      <section className="mx-auto max-w-[1040px] px-5 pt-28 sm:px-8">
        <Reveal><SectionHeading center kicker={`How ${PLUS.name} works`} title="Three steps. About two minutes." /></Reveal>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map(([t, b], i) => (
            <Reveal as="li" key={t} delay={i * 90} className="relative rounded-[24px] border border-ink/10 bg-paper p-7 site-shadow">
              <span className="num text-[44px] font-semibold leading-none text-ink/15">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">{t}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{b}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      <section className="mx-auto max-w-3xl px-5 pt-28 sm:px-8">
        <Reveal><SectionHeading center kicker="Questions" title="Pricing, answered." /></Reveal>
        <Reveal delay={100} className="mt-12 flex flex-col gap-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-[20px] border border-ink/10 bg-paper px-6 py-5 site-shadow open:pb-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/15 transition-transform duration-300 group-open:rotate-45"><PlusIcon size={15} /></span>
              </summary>
              <p className="mt-3 pr-10 text-[15px] leading-relaxed text-ink/60">{a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      {/* ------------------------------------------------------------ Final CTA */}
      <section className="px-5 pt-28 sm:px-8">
        <Reveal className="relative mx-auto max-w-[1040px] overflow-hidden rounded-[36px] bg-ink px-6 py-16 text-center text-paper sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[340px] w-[620px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-35 blur-[90px]" style={{ background: MX }} />
          <div className="relative">
            <h2 className="mx-auto max-w-[16ch] text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px]">Start free today.</h2>
            <p className="mx-auto mt-5 max-w-[30rem] text-[16px] leading-relaxed text-paper/60 sm:text-[18px]">Journal for free, and add MatrixX AI whenever you&apos;re ready.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Magnetic><CtaLink className="inline-flex h-[56px] items-center gap-2 rounded-full bg-paper px-8 text-[16px] font-medium text-ink transition-transform hover:scale-[1.03]">Start your journal <ArrowRight size={16} /></CtaLink></Magnetic>
              <Magnetic><Link href="/plus" className="inline-flex h-[56px] items-center rounded-full border border-paper/25 px-8 text-[16px] text-paper/85 transition-colors hover:border-paper/60 hover:text-paper">Get {PLUS.name}</Link></Magnetic>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
