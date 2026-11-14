import { ArrowRight, Ban, BookOpen, CalendarCheck, FileCheck, Megaphone, PenTool, Plus as PlusIcon, Send, Share2, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import { Magnetic } from "@/components/site/Interactive";
import { Mark } from "@/components/site/Mark";
import { Reveal, SectionHeading } from "@/components/site/SiteChrome";
import { SignupForm } from "@/components/site/SignupForm";

export const metadata: Metadata = { title: "Affiliates", description: "Apply to share LEDGR with your audience: educators, creators and communities who value disciplined, reflective trading." };

const GLOW = "#a78bfa"; // a soft violet glow for this page

const WHO = [
  { icon: BookOpen, title: "Educators", body: "You teach journaling, risk management or review habits, and want a tool your students will actually use." },
  { icon: PenTool, title: "Writers & creators", body: "You make content about trading psychology, discipline and process, not hype or signals." },
  { icon: Users, title: "Communities", body: "You run a Discord, group or newsletter where members hold each other accountable." },
];

const STEPS = [
  { icon: Send, title: "Apply", body: "Tell us where your audience is and how you'd share LEDGR. Takes two minutes." },
  { icon: FileCheck, title: "We review and publish terms", body: "Commission, payout and tracking terms are published before anyone is enrolled. No obligation until then." },
  { icon: Share2, title: "Share your link", body: "Once accepted, you get your own link and everything you need to introduce LEDGR to your audience." },
];

const GIVE = [
  { icon: CalendarCheck, title: "A free journal", body: "Every journal feature is free. Your audience can start without a card or a trial." },
  { icon: Sparkles, title: "MatrixX AI", body: "AI trade reviews and weekly reviews from their own records, with LEDGR+ or a MatrixX account." },
  { icon: Megaphone, title: "Something to share", body: "Clean P&L cards with real price charts, made to share process, not just profits." },
];

const RULES = [
  "No promises of profits or returns",
  "No trade signals or tips",
  "Never present LEDGR as financial advice",
  "Always disclose that it's an affiliate link",
];

const FAQ: [string, string][] = [
  ["How much will I earn?", "Commission and payout terms are still being finalised. They'll be published before anyone is enrolled, and you can decide then."],
  ["Does applying commit me to anything?", "No. Applying only puts you first in line. There's no obligation."],
  ["Do I need a big audience?", "No. We care more about the fit (disciplined, process-first trading) than the size of your audience."],
  ["How will I hear back?", "We'll email you at the address you apply with when terms are published."],
];

export default function AffiliatesPage() {
  return (
    <div className="pb-28">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden px-5 pb-16 pt-32 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[460px] w-[780px] -translate-x-1/2 rounded-full opacity-[0.18] blur-[110px]" style={{ background: `radial-gradient(closest-side, ${GLOW}, transparent)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at 50% 20%, black, transparent 65%)" }} />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: GLOW }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: GLOW }} /></span>
            Applications open · terms coming soon
          </p>
          <h1 className="text-[48px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[80px]">Share LEDGR. <Mark>Grow</Mark> together.</h1>
          <p className="mx-auto mt-7 max-w-[34rem] text-[17px] leading-relaxed text-ink/60 sm:text-[19px]">An affiliate programme for educators, creators and communities who care about disciplined, reflective trading.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Magnetic><a href="#apply" className="inline-flex h-[56px] items-center gap-2 rounded-full bg-ink px-8 text-[16px] font-medium text-paper transition-transform hover:scale-[1.03]" style={{ boxShadow: `0 18px 50px -16px ${GLOW}` }}>Apply now <ArrowRight size={16} /></a></Magnetic>
            <a href="#how" className="inline-flex h-[56px] items-center rounded-full border border-ink/20 bg-paper/70 px-8 text-[16px] text-ink/80 backdrop-blur transition-colors hover:border-ink/50 hover:text-ink">How it works</a>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------ Who */}
      <section className="mx-auto max-w-[1100px] px-5 py-12 sm:px-8">
        <Reveal><SectionHeading kicker="Who it's for" title={<>Made for people who teach <Mark>process</Mark>.</>} /></Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {WHO.map((c, i) => (
            <Reveal key={c.title} delay={i * 70} className="group site-shadow relative overflow-hidden rounded-[22px] border border-ink/10 bg-paper p-7 transition-transform duration-300 hover:-translate-y-1">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30" style={{ background: GLOW }} />
              <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-ink text-paper"><c.icon size={19} /></span>
              <p className="relative mt-5 text-[18px] font-semibold tracking-[-0.01em]">{c.title}</p>
              <p className="relative mt-2 text-[14.5px] leading-relaxed text-ink/60">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ How */}
      <section id="how" className="mx-auto max-w-[1100px] scroll-mt-24 px-5 py-16 sm:px-8">
        <Reveal><SectionHeading kicker="How it works" title="Three steps, no surprises." /></Reveal>
        <ol className="relative mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 90} className="site-shadow relative rounded-[24px] border border-ink/10 bg-paper p-7">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-ink/15"><s.icon size={18} /></span>
                <span className="num text-[40px] font-semibold leading-none text-ink/12">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <p className="mt-5 text-[18px] font-semibold tracking-[-0.01em]">{s.title}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------- What your audience gets + rules */}
      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Reveal className="site-shadow rounded-[28px] border border-ink/10 bg-paper p-8 sm:p-10">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/45">What your audience gets</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">An easy yes.</h2>
            <ul className="mt-8 flex flex-col gap-6">
              {GIVE.map((g) => (
                <li key={g.title} className="grid grid-cols-[44px_1fr] gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink/[0.05]"><g.icon size={19} /></span>
                  <div><p className="text-[16px] font-semibold">{g.title}</p><p className="mt-1 text-[14.5px] leading-relaxed text-ink/60">{g.body}</p></div>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120} className="rounded-[28px] bg-ink p-8 text-paper sm:p-10">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-paper/50">Our standards</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Non-negotiable.</h2>
            <ul className="mt-8 flex flex-col gap-4">
              {RULES.map((r) => <li key={r} className="flex items-start gap-3 text-[15px] text-paper/80"><Ban size={18} className="mt-0.5 shrink-0 text-paper/40" />{r}</li>)}
            </ul>
            <p className="mt-8 text-[13.5px] leading-relaxed text-paper/50">LEDGR is a journal for simulated and historical records. Affiliates who break these rules are removed from the programme.</p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ Apply */}
      <section id="apply" className="mx-auto max-w-[1100px] scroll-mt-24 px-5 py-16 sm:px-8">
        <div className="relative overflow-hidden rounded-[34px] border border-ink/10 bg-paper p-8 site-shadow sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full opacity-20 blur-3xl" style={{ background: GLOW }} />
          <div className="relative grid items-start gap-10 lg:grid-cols-[1fr_440px]">
            <Reveal>
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/45">Apply</p>
              <h2 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[46px]">Get first in line.</h2>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink/60">Applying takes two minutes and doesn&apos;t commit you to anything. We&apos;ll email you when the programme terms are published.</p>
              <div className="mt-10 flex flex-col gap-3">
                {FAQ.map(([q, a]) => (
                  <details key={q} className="group rounded-[18px] border border-ink/10 bg-paper px-5 py-4 open:pb-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                      {q}
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/15 transition-transform duration-300 group-open:rotate-45"><PlusIcon size={14} /></span>
                    </summary>
                    <p className="mt-2.5 pr-8 text-[14.5px] leading-relaxed text-ink/60">{a}</p>
                  </details>
                ))}
              </div>
            </Reveal>
            <Reveal delay={120} className="rounded-[24px] border border-ink/10 bg-paper p-7">
              <h3 className="mb-6 text-[20px] font-semibold">Your application</h3>
              <SignupForm kind="affiliate" submitLabel="Send application" done="Application received. We'll email you when terms are published."
                fields={[
                  { name: "link", label: "Where's your audience? (link)", placeholder: "https://", required: true },
                  { name: "audience", label: "Approximate audience size", placeholder: "e.g. 5,000 newsletter readers" },
                  { name: "message", label: "How would you share LEDGR?", multiline: true },
                ]} />
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
