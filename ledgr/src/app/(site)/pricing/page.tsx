import { ArrowRight, Check, Lock, Minus, Plus as PlusIcon, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/site/CtaLink";
import { Magnetic } from "@/components/site/Interactive";
import { Mark } from "@/components/site/Mark";
import { Reveal, SectionHeading } from "@/components/site/SiteChrome";
import { FREE_INCLUDES, PLAN_COMPARE, PLUS, PRO } from "@/lib/plus";

export const metadata: Metadata = { title: "Pricing", description: "Journaling on LEDGR is free, no card. LEDGR+ ($14.99) and LEDGR Pro ($35.99) add analytics, copy trading, creator tools and MatrixX AI, 30 days at a time." };

const MX = "#3ee08a"; // MatrixX green, for the LEDGR+ glow

const FAQ: [string, string][] = [
  ["Is LEDGR really free?", "Yes. Everything listed under Free is free, with no trial period and no card: unlimited trades, the daily journal and dashboard, the prop tracker for one account, trade scores, paper trading, sharing cards and videos, CSV import and the community."],
  ["What are LEDGR+ and LEDGR Pro?", `Two optional plans, each one payment for ${PLUS.days} days. ${PLUS.name} ($${PLUS.priceUsd}) unlocks full analytics, the weekly review, unlimited prop accounts, copy trading and creator tools, with ${PLUS.matrixxPlan}. ${PRO.name} ($${PRO.priceUsd}) adds the AI coach with ${PRO.matrixxPlan}, reviews that fill themselves in and starting your own crews.`],
  ["Does LEDGR+ renew automatically?", `No. It's a one-time payment for ${PLUS.days} days. Buy another ${PLUS.days} days whenever you want; extra days are added on top.`],
  ["Can I get a refund?", "LEDGR+ purchases are final and not refundable, except where the law requires otherwise. If a payment went wrong, email us and we'll fix it. See the Terms for details."],
  ["Do I need MatrixX for the AI?", "Yes. The AI runs on MatrixX. A free MatrixX account works (25 messages a day); LEDGR+ adds Starter. Without MatrixX, the AI page still answers with offline analysis from your records."],
  ["Do I need an account to use LEDGR?", "No. LEDGR works fully in your browser. A free account only adds cloud backup and sync across devices."],
  ["Will the free features change?", "Journaling stays free. In November 2026 LEDGR moved to three plans: Free, LEDGR+ ($14.99) and LEDGR Pro ($35.99), each 30 days at a time. Some features that were free moved to the paid plans, as listed in the table: full analytics, psychology and the Performance Score, the weekly review, the price chart on trades, CSV export, more than 1 prop account, strategy or screenshot, copy trading, weekly recaps, your own backgrounds and wallpapers, community videos and profile links, review autofill and starting crews. Anything you already set up keeps working. Any future change will be announced here first."],
];

const STEPS: [string, string][] = [
  ["Connect MatrixX", "Sign in or create a free MatrixX account, then allow LEDGR."],
  ["Pay by card", "Pick LEDGR+ or LEDGR Pro on a secure Ziina page. Your plan starts as soon as it's paid."],
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
          <h1 className="text-[48px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[80px]">Free to journal. <Mark>Plus</Mark> when you want more.</h1>
          <p className="mx-auto mt-7 max-w-[34rem] text-[17px] leading-relaxed text-ink/60 sm:text-[19px]">Journaling is free, forever. LEDGR+ (${PLUS.priceUsd}) and LEDGR Pro (${PRO.priceUsd}) add more, 30 days at a time, only when you want it.</p>
        </Reveal>
      </section>

      {/* -------------------------------------------------------------- Plans */}
      <section className="px-5 sm:px-8">
        <div className="mx-auto grid max-w-[1180px] items-stretch gap-5 lg:grid-cols-3">
          <Reveal className="flex flex-col rounded-[30px] bg-ink p-8 text-paper sm:p-9">
            <div className="flex items-center justify-between"><p className="text-[15px] font-medium">Free</p><span className="rounded-full border border-paper/25 px-3 py-1 text-[12px] text-paper/70">Free forever</span></div>
            <p className="mt-5 flex items-end gap-2"><span className="text-[64px] font-semibold leading-none tracking-[-0.045em]">$0</span><span className="mb-2 text-paper/50">forever</span></p>
            <p className="mt-3 text-[14.5px] text-paper/60">For new traders, paper traders and one prop account.</p>
            <CtaLink className="mt-7 flex h-[52px] items-center justify-center rounded-full bg-paper text-[15px] font-medium text-ink transition-transform hover:scale-[1.02]">Start your journal</CtaLink>
            <ul className="mt-8 grid gap-3">
              {FREE_INCLUDES.map((f) => <li key={f} className="flex gap-3 text-[14px]"><Check size={16} className="mt-0.5 shrink-0 text-paper/70" />{f}</li>)}
            </ul>
          </Reveal>
          {[PLUS, PRO].map((plan, i) => (
            <Reveal key={plan.id} delay={120 * (i + 1)} className="relative flex flex-col overflow-hidden rounded-[30px] border border-ink/10 bg-paper p-8 site-shadow sm:p-9">
              <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: plan.id === "pro" ? "#a58bff" : MX }} />
              <div className="relative flex items-center justify-between"><p className="text-[15px] font-medium">{plan.name}</p><span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 text-[12px] font-medium text-ink/75"><Sparkles size={12} /> {plan.id === "pro" ? "AI coach" : "Most popular"}</span></div>
              <p className="relative mt-5 flex items-end gap-2"><span className="text-[64px] font-semibold leading-none tracking-[-0.045em]">${plan.priceUsd}</span><span className="mb-2 text-ink/50">for {plan.days} days</span></p>
              <p className="relative mt-3 text-[14.5px] text-ink/60">{plan.tagline}</p>
              <Link href={`/plus?plan=${plan.id}`} className="relative mt-7 flex h-[52px] items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-paper transition-transform hover:scale-[1.02]">Get {plan.name} <ArrowRight size={16} /></Link>
              <ul className="relative mt-8 grid gap-3">
                {plan.includes.map((f, j) => <li key={f} className={`flex gap-3 text-[14px] ${j === 0 ? "font-medium" : "text-ink/80"}`}>{j === 0 ? <PlusIcon size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" style={{ color: plan.id === "pro" ? "#7d62e8" : MX }} />}{f}</li>)}
              </ul>
              <p className="relative mt-auto flex items-center gap-1.5 pt-8 text-[12px] text-ink/45"><Lock size={13} /> Card payment with Ziina · one-time · no auto-renewal</p>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-xl text-center text-[13px] text-ink/45">MatrixX AI also works with your own MatrixX account, free or paid.</p>
      </section>

      {/* ------------------------------------------------------- Compare table */}
      <section className="mx-auto max-w-[1120px] px-5 pt-28 sm:px-8">
        <Reveal><SectionHeading center kicker="Compare" title={<>Every feature, <Mark>plan by plan</Mark></>} /></Reveal>
        <Reveal delay={100} className="mt-12 overflow-hidden rounded-[26px] border border-ink/10 bg-paper site-shadow">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] items-center border-b border-ink/10 px-4 py-4 text-[13px] sm:grid-cols-[minmax(0,1fr)_130px_130px_130px] sm:px-8 sm:text-[14px]">
            <span className="font-medium text-ink/50">Feature</span>
            <span className="text-center font-medium text-ink/60">Free</span>
            <span className="text-center font-semibold">{PLUS.name}</span>
            <span className="text-center font-semibold">{PRO.name}</span>
          </div>
          {PLAN_COMPARE.map((g) => (
            <div key={g.group}>
              <p className="bg-ink/[0.04] px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink/50 sm:px-8">{g.group}</p>
              {g.rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] items-center border-t border-ink/[0.06] px-4 py-3.5 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_130px_130px_130px] sm:px-8 sm:text-[14.5px]">
                  <span className="text-ink/75">{r.label}</span><Cell v={r.free} /><Cell v={r.plus} strong /><Cell v={r.pro} strong />
                </div>
              ))}
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
            <p className="mx-auto mt-5 max-w-[30rem] text-[16px] leading-relaxed text-paper/60 sm:text-[18px]">Journal for free, and add LEDGR+ whenever you&apos;re ready.</p>
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
