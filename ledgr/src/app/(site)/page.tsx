import { ArrowRight, BookOpen, Brain, ChartNoAxesCombined, Lock, NotebookPen, ShieldCheck, Sparkles, SquareLibrary, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/site/Faq";
import { Hero3D } from "@/components/site/Hero3D";
import { HeroInsights } from "@/components/site/HeroInsights";
import { CtaLink } from "@/components/site/CtaLink";
import { Reveal, SectionHeading, TiltCard } from "@/components/site/SiteChrome";
import { Showcase } from "@/components/site/Showcase";

export const metadata: Metadata = {
  title: "Ledgr — Discipline over impulse",
  description: "A private trading journal for reflective, disciplined traders. Log trades, review your process, and measure the habits behind the numbers.",
};

const FEATURES = [
  { icon: NotebookPen, title: "A journal that tells the truth", body: "Multiple entries, partial exits, fees and R — calculated in the open. Drafts and open positions are kept out of your numbers until they're complete." },
  { icon: ChartNoAxesCombined, title: "Analytics without guesswork", body: "Equity, drawdown, R distribution, setups, sessions, weekdays and emotions. When there isn't enough data, Ledgr says so instead of inventing a pattern." },
  { icon: Brain, title: "Psychology, measured kindly", body: "Track emotions and documented mistakes, and see a discipline score built from your process — journal completion, plan adherence, reflection." },
  { icon: SquareLibrary, title: "Strategies you can hold yourself to", body: "Write down entry, exit and invalidation rules, then see how the trades you linked to each one have actually gone." },
  { icon: Wallet, title: "Accounts kept apart", body: "Separate simulated, backtest and evaluation-practice accounts, each with its own balance, rules and history." },
  { icon: Sparkles, title: "An analyst for your own history", body: "Ledgr AI reviews what you recorded, cites the exact trades it used, and never tells you what to buy or sell." },
];

const STEPS = [
  { n: "1", title: "Log", body: "Capture a trade in seconds with Quick Log, then fill in the full record when the session ends." },
  { n: "2", title: "Reflect", body: "Answer four short questions per trade and a few before and after each session." },
  { n: "3", title: "Review", body: "Weekly reviews, analytics and pattern checks turn your notes into lessons you can act on." },
];

const FACTS = [
  { v: "14", l: "analytics charts" },
  { v: "14", l: "pattern checks" },
  { v: "60+", l: "KJV verses, chosen by page" },
  { v: "0", l: "broker connections" },
];

const MARQUEE = ["Trade journal", "Daily reflection", "Weekly review", "Equity curve", "Discipline score", "Strategy library", "Study room", "Verse library", "Shareable cards", "What-if analysis", "Account desk", "Ledgr AI"];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden lg:flex-row lg:items-center">
        <div aria-hidden className="dot-grid dot-fade absolute inset-0 -z-20" />
        <Hero3D className="relative mt-16 h-[300px] w-full sm:h-[380px] lg:absolute lg:inset-0 lg:-z-10 lg:mt-0 lg:h-auto" />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-[radial-gradient(80%_60%_at_20%_40%,var(--paper),transparent_70%)] lg:block" />
        <div className="mx-auto w-full max-w-[1200px] px-5 pb-20 pt-4 sm:px-8 lg:pt-32">
          <Reveal>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-ink/[0.04] px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" /> Free to use · Private by default
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="max-w-[12ch] text-[52px] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-[84px] lg:text-[104px]">Discipline over impulse.</h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-7 max-w-[34rem] text-[17px] leading-relaxed text-ink/65 sm:text-[19px]">Track every lesson. Measure every step. Ledgr is a private journal for the decisions, habits and discipline behind your results.</p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <CtaLink className="group inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-paper transition-transform hover:scale-[1.02]">Start your journal <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></CtaLink>
              <Link href="#showcase" className="inline-flex h-12 items-center rounded-full border border-ink/20 px-6 text-[15px] text-ink/85 transition-colors hover:border-ink/50 hover:text-ink">See it in action</Link>
            </div>
            <p className="mt-6 text-[12.5px] text-ink/40">For simulated and historical records. No broker connection, no trade execution, no financial advice.</p>
          </Reveal>
        </div>
      </section>

      {/* Example insights, overlapping the hero */}
      <section aria-label="Example insights" className="relative z-10 -mt-10 px-5 pb-20 sm:px-8 lg:-mt-24">
        <HeroInsights />
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-ink/10 py-5" aria-hidden>
        <div className="marquee flex w-max gap-10 whitespace-nowrap text-[15px] text-ink/40">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i} className="flex items-center gap-10">{m}<span className="h-1 w-1 rounded-full bg-ink/25" /></span>)}
        </div>
      </div>

      {/* Showcase */}
      <section id="showcase" className="scroll-mt-20 px-5 py-28 sm:px-8">
        <Reveal><SectionHeading center kicker="Inside Ledgr" title="Built for the review, not the rush." sub="Every screen is designed to slow you down in the right places — and show you exactly how each number was calculated." /></Reveal>
        <Reveal delay={120} className="mt-14"><Showcase /></Reveal>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
        <Reveal><SectionHeading kicker="What you get" title="Everything a serious journal needs. Nothing it doesn't." /></Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <TiltCard className="h-full rounded-[20px]">
                <div className="site-shadow h-full rounded-[22px] border border-ink/10 bg-paper p-7">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-paper shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)]"><f.icon size={19} strokeWidth={1.6} /></span>
                  <h3 className="mt-6 text-[18px] font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{f.body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10"><Link href="/features" className="inline-flex items-center gap-2 text-[14px] text-ink/80 hover:text-ink">Explore every feature <ArrowRight size={14} /></Link></Reveal>
      </section>

      {/* Curve + steps */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <div className="site-shadow relative overflow-hidden rounded-[24px] border border-ink/10 bg-paper p-8">
            <p className="text-[12px] text-ink/45">Cumulative P&L · sample records</p>
            <svg viewBox="0 0 520 220" className="mt-6 w-full" aria-hidden>
              {[40, 90, 140, 190].map((y) => <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="currentColor" strokeOpacity=".08" />)}
              <path className="draw-path" style={{ ["--len" as string]: 900 }} d="M0,170 C40,160 60,120 95,128 S150,150 185,110 S240,60 280,92 S330,140 365,96 S420,40 455,52 S505,30 520,24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-ink/10 pt-5 text-[12px] text-ink/45">
              <div>Win rate<p className="mt-1 font-mono text-[16px] text-ink">wins ÷ (W+L)</p></div>
              <div>Average R<p className="mt-1 font-mono text-[16px] text-ink">net ÷ risk</p></div>
              <div>Profit factor<p className="mt-1 font-mono text-[16px] text-ink">gains ÷ losses</p></div>
            </div>
          </div>
        </Reveal>
        <div>
          <Reveal><SectionHeading kicker="How it works" title="Three habits. Repeated daily." /></Reveal>
          <ol className="mt-10 flex flex-col gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} as="li" delay={i * 90} className="flex gap-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-ink/20 font-mono text-[14px]">{s.n}</span>
                <div><h3 className="text-[18px] font-semibold">{s.title}</h3><p className="mt-1 text-[15px] leading-relaxed text-ink/60">{s.body}</p></div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Facts */}
      <section className="border-y border-ink/10">
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <Reveal key={f.l} delay={i * 60} className="border-ink/10 py-12 text-center [&:not(:last-child)]:lg:border-r">
              <p className="font-mono text-[44px] font-medium tracking-tight">{f.v}</p>
              <p className="mt-1 text-[13px] text-ink/50">{f.l}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Verse */}
      <section className="relative overflow-hidden px-5 py-32 sm:px-8">
        <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/[0.04] blur-3xl" />
        <Reveal className="mx-auto max-w-3xl text-center">
          <BookOpen size={20} className="mx-auto text-ink/50" />
          <blockquote className="verse-text mt-8 text-[28px] leading-snug text-ink sm:text-[40px]">Commit thy works unto the LORD, and thy thoughts shall be established.</blockquote>
          <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink/50">Proverbs 16:3 · KJV</p>
          <p className="mx-auto mt-8 max-w-lg text-[15px] leading-relaxed text-ink/55">Every page in Ledgr carries a verse chosen for the work it holds — honesty in the journal, wisdom in analytics, patience in psychology. Quietly, never preachy.</p>
        </Reveal>
      </section>

      {/* Privacy */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
        <div className="site-shadow grid gap-12 rounded-[28px] border border-ink/10 bg-paper p-8 sm:p-14 lg:grid-cols-2">
          <Reveal><SectionHeading kicker="Private by default" title="Your journal is yours." sub="Ledgr works fully in your browser with no account. Create one only if you want cloud backup and sync across devices." /></Reveal>
          <ul className="flex flex-col gap-5">
            {[
              [Lock, "Owner-only access", "With an account, database rules ensure only you can read or change your records and files."],
              [ShieldCheck, "Nothing shared without you", "Shareable cards hide amounts and account names unless you switch them on."],
              [Sparkles, "AI sees only what you allow", "Ledgr AI receives a summary of the records in your selected range — never your images — and you can inspect it first."],
            ].map(([Icon, t, b], i) => {
              const I = Icon as typeof Lock;
              return (
                <Reveal key={t as string} as="li" delay={i * 80} className="flex gap-4">
                  <I size={20} className="mt-0.5 shrink-0 text-ink/70" strokeWidth={1.6} />
                  <div><p className="font-medium">{t as string}</p><p className="mt-1 text-[14.5px] leading-relaxed text-ink/55">{b as string}</p></div>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <Reveal><SectionHeading center title="Questions, answered." /></Reveal>
        <Reveal delay={100} className="mt-12"><Faq /></Reveal>
      </section>

      {/* CTA */}
      <section className="px-5 pb-28 sm:px-8">
        <Reveal className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[32px] bg-ink px-8 py-20 text-center text-paper sm:px-16">
          <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--paper) 31px 32px)" }} />
          <h2 className="relative mx-auto max-w-2xl text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[54px]">Start keeping an honest record.</h2>
          <p className="relative mx-auto mt-5 max-w-md text-[16px] text-paper/60">Free. Private. Ready in under a minute.</p>
          <CtaLink className="relative mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-paper px-7 text-[15px] font-medium text-ink transition-transform hover:scale-[1.02]">Start your journal <ArrowRight size={16} /></CtaLink>
        </Reveal>
      </section>
    </>
  );
}
