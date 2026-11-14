import { ArrowRight, Brain, Check, ChartNoAxesCombined, NotebookPen, Sparkles, SquareLibrary, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Bento } from "@/components/site/Bento";
import { ScrollScene } from "@/components/site/Cinematic";
import { Explorer } from "@/components/site/Explorer";
import { Compare, HomePricing, Install } from "@/components/site/HomeSections";
import { Mark } from "@/components/site/Mark";
import { CtaLink } from "@/components/site/CtaLink";
import { Faq } from "@/components/site/Faq";
import { Hero3D } from "@/components/site/Hero3D";
import { HeroInsights } from "@/components/site/HeroInsights";
import { CountUp, LiveCalculator, Magnetic, ScrollStory, SplitHeadline, Spotlight, type StoryStep } from "@/components/site/Interactive";
import { Reveal, SectionHeading, TiltCard } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Ledgr — Discipline over impulse",
  description: "A private trading journal for reflective, disciplined traders. Log trades, review your process, and measure the habits behind the numbers.",
};

const STORY: StoryStep[] = [
  { key: "log", kicker: "Log", title: "Capture the trade before the feeling fades.", body: "Quick Log saves the essentials in seconds. Add executions, partial exits, fees and screenshots when the session ends.", shot: "journal" },
  { key: "review", kicker: "Review", title: "See the whole picture, calmly.", body: "Your key numbers at a glance, a P&L curve, a calendar of every trading day and your LEDGR score — on one quiet screen.", shot: "dashboard" },
  { key: "understand", kicker: "Understand", title: "Patterns, only when they're real.", body: "Fourteen charts and fourteen pattern checks. When the sample is too small, Ledgr says so instead of inventing a story.", shot: "analytics" },
  { key: "reflect", kicker: "Reflect", title: "Measure the process, not just the result.", body: "Emotions, documented mistakes and a discipline score you can read line by line — never calculated from profit.", shot: "psychology" },
  { key: "share", kicker: "Share", title: "Show your work, on your terms.", body: "Recap cards and PDFs that hide amounts and account names unless you choose to include them.", shot: "reports" },
];

const FEATURES = [
  { icon: NotebookPen, title: "A journal that tells the truth", body: "Multiple entries, partial exits and fees, calculated in the open. Drafts never pollute your statistics." },
  { icon: ChartNoAxesCombined, title: "Analytics without guesswork", body: "Setups, sessions, weekdays and emotions compared — with sample sizes always shown." },
  { icon: Brain, title: "Psychology, measured kindly", body: "Emotion and mistake tracking with a transparent discipline score." },
  { icon: SquareLibrary, title: "Strategies you can hold yourself to", body: "Written entry, exit and invalidation rules, linked to the trades that used them." },
  { icon: Wallet, title: "Accounts kept apart", body: "Simulated, backtest and evaluation-practice accounts with their own balances and rules." },
  { icon: Sparkles, title: "An analyst for your own history", body: "MatrixX AI answers from your records and cites the trades it used." },
];

const MARQUEE = ["Trade journal", "Daily reflection", "Weekly review", "Equity curve", "Discipline score", "Strategy library", "Study room", "Verse library", "Shareable cards", "What-if analysis", "Account desk", "MatrixX AI"];

export default function LandingPage() {
  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden lg:flex-row lg:items-center">
        <div aria-hidden className="dot-grid dot-fade absolute inset-0 -z-20" />
        <Spotlight />
        <Hero3D className="relative mt-16 h-[300px] w-full sm:h-[380px] lg:absolute lg:inset-0 lg:-z-10 lg:mt-0 lg:h-auto" />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-[radial-gradient(70%_60%_at_18%_45%,var(--paper),transparent_70%)] lg:block" />
        <div className="mx-auto w-full max-w-[1200px] px-5 pb-20 pt-4 sm:px-8 lg:pt-32">
          <Reveal>
            <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink/40" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ink" /></span>
              Free journal · AI by MatrixX
            </p>
          </Reveal>
          <SplitHeadline text="Discipline over impulse." className="max-w-[12ch] text-[54px] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[88px] lg:text-[112px]" />
          <Reveal delay={500}>
            <p className="mt-8 max-w-[34rem] text-[17px] leading-relaxed text-ink/65 sm:text-[19px]">Track every lesson. Measure every step. Ledgr is a private journal for the decisions, habits and discipline behind your results.</p>
          </Reveal>
          <Reveal delay={650}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Magnetic><CtaLink className="group inline-flex h-[52px] items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-paper shadow-[0_14px_30px_-12px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.03]">Start your journal <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></CtaLink></Magnetic>
              <Magnetic><Link href="#try" className="inline-flex h-[52px] items-center rounded-full border border-ink/20 bg-paper/70 px-7 text-[15px] text-ink/85 backdrop-blur transition-colors hover:border-ink/50 hover:text-ink">Try the calculator</Link></Magnetic>
            </div>
            <p className="mt-7 text-[12.5px] text-ink/40">For simulated and historical records. No broker connection, no trade execution, no financial advice.</p>
          </Reveal>
        </div>
        <div aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] text-ink/40 lg:flex [@media(max-height:940px)]:!hidden">
          Scroll<span className="h-10 w-px overflow-hidden bg-ink/10"><span className="block h-4 w-px animate-[drift_2s_ease-in-out_infinite] bg-ink/60" /></span>
        </div>
      </section>

      {/* ------------------------------------------------- Insight cards */}
      <section aria-label="Example insights" className="relative z-10 -mt-10 px-5 pb-20 sm:px-8 lg:-mt-24">
        <HeroInsights />
      </section>

      {/* ------------------------------------------------------- Marquee */}
      <div className="overflow-hidden border-y border-ink/10 py-5" aria-hidden>
        <div className="marquee flex w-max gap-10 whitespace-nowrap text-[15px] text-ink/40">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i} className="flex items-center gap-10">{m}<span className="h-1 w-1 rounded-full bg-ink/25" /></span>)}
        </div>
      </div>

      {/* ------------------------------------------------ Cinematic scene */}
      <ScrollScene
        lines={["Discipline is quiet.", "It shows up in the record.", "Write it down. Read it back. Do better."]}
        after={<p className="text-[17px] leading-relaxed text-ink/60">Most trading mistakes repeat because nobody wrote them down. Ledgr keeps the honest record — every entry, every emotion, every lesson — so the next session starts wiser than the last.</p>}
      />

      {/* --------------------------------------------------- Scroll story */}
      <section id="showcase" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 pt-28 sm:px-8">
        <Reveal><SectionHeading kicker="How Ledgr works" title={<>Five habits. One <Mark>honest</Mark> record.</>} sub="Scroll through the loop that turns a trading session into a lesson you keep." /></Reveal>
        <div className="mt-6"><ScrollStory steps={STORY} /></div>
      </section>

      {/* ------------------------------------------------------- Explorer */}
      <section id="explore" className="mx-auto max-w-[1280px] scroll-mt-20 px-3 pt-28 sm:px-6">
        <div className="px-2 sm:px-2"><Reveal><SectionHeading kicker="Look inside" title={<>Every part of Ledgr, <Mark>before</Mark> you sign up.</>} sub="Pick a part to see it in the app. Shown with simulated sample records." /></Reveal></div>
        <Reveal delay={100} className="mt-12"><Explorer /></Reveal>
      </section>

      {/* ------------------------------------------------- Live calculator */}
      <section id="try" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-28 sm:px-8">
        <Reveal><SectionHeading kicker="Try it — no account needed" title={<>Watch Ledgr do the <Mark>maths</Mark>.</>} sub="Change any number. This is the same calculation engine that runs inside the app, shown in the open." /></Reveal>
        <Reveal delay={120} className="mt-12"><LiveCalculator /></Reveal>
      </section>

      {/* --------------------------------------------------------- Bento */}
      <section className="mx-auto max-w-[1200px] px-5 pb-28 sm:px-8">
        <Reveal><SectionHeading kicker="Inside the app" title={<>Built for the <Mark>review</Mark>, not the rush.</>} /></Reveal>
        <div className="mt-12"><Bento /></div>
      </section>

      {/* ----------------------------------------------------- Comparison */}
      <section className="mx-auto max-w-[1200px] px-5 pb-28 sm:px-8">
        <Reveal><SectionHeading kicker="Honest comparison" title={<>Still journaling in a <Mark>spreadsheet</Mark>?</>} sub="What most traders use today, next to what Ledgr does for you." /></Reveal>
        <Reveal delay={100} className="mt-12"><Compare /></Reveal>
      </section>

      {/* ------------------------------------------------------ Features */}
      <section className="border-y border-ink/10 bg-paper-2">
        <div className="mx-auto max-w-[1200px] px-5 py-24 sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <Reveal><SectionHeading kicker="Everything included" title={<>A complete journal. <Mark>Free</Mark>.</>} /></Reveal>
            <Reveal delay={100}><Link href="/features" className="inline-flex items-center gap-2 text-[14px] text-ink/70 hover:text-ink">Every feature <ArrowRight size={14} /></Link></Reveal>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <TiltCard className="h-full rounded-[22px]">
                  <div className="site-shadow h-full rounded-[22px] border border-ink/10 bg-paper p-7">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-paper shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)]"><f.icon size={19} strokeWidth={1.6} /></span>
                    <h3 className="mt-6 text-[18px] font-semibold tracking-tight">{f.title}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{f.body}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Facts */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
        {([[14, "analytics charts", ""], [14, "pattern checks", ""], [60, "KJV verses, chosen by page", "+"], [0, "broker connections", ""]] as [number, string, string][]).map(([v, l, suf], i) => (
          <Reveal key={l} delay={i * 60} className="border-ink/10 py-16 text-center [&:not(:last-child)]:lg:border-r">
            <p className="font-mono text-[52px] font-medium tracking-tight"><CountUp to={v} suffix={suf} /></p>
            <p className="mt-1 text-[13px] text-ink/50">{l}</p>
          </Reveal>
        ))}
      </section>

      {/* --------------------------------------------------------- Verse */}
      <section className="relative overflow-hidden border-y border-ink/10 px-5 py-32 sm:px-8">
        <div aria-hidden className="dot-grid dot-fade absolute inset-0 -z-10" />
        <Reveal className="mx-auto max-w-3xl text-center">
          <blockquote className="verse-text text-[30px] leading-snug text-ink sm:text-[44px]">Commit thy works unto the LORD, and thy thoughts shall be established.</blockquote>
          <p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink/50">Proverbs 16:3 · KJV</p>
          <p className="mx-auto mt-8 max-w-lg text-[15px] leading-relaxed text-ink/55">Every page in Ledgr carries a verse chosen for the work it holds — honesty in the journal, wisdom in analytics, patience in psychology. Quietly, never preachy.</p>
        </Reveal>
      </section>

      {/* ------------------------------------------------------- Pricing */}
      <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-28 sm:px-8">
        <Reveal><SectionHeading kicker="Pricing" title={<>Free. <Mark>Actually</Mark> free.</>} sub="Every journal feature, no card, no trial clock. Add MatrixX AI with LEDGR+ whenever you want." /></Reveal>
        <Reveal delay={100} className="mt-12"><HomePricing /></Reveal>
      </section>

      {/* ------------------------------------------------------- Install */}
      <section id="install" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 sm:px-8">
        <Reveal><Install /></Reveal>
      </section>

      {/* ----------------------------------------------------------- FAQ */}
      <section className="mx-auto max-w-3xl px-5 py-28 sm:px-8">
        <Reveal><SectionHeading center title="Questions, answered." /></Reveal>
        <Reveal delay={100} className="mt-12"><Faq /></Reveal>
      </section>

      {/* ----------------------------------------------------------- CTA */}
      <section className="px-5 pb-10 sm:px-8">
        <Reveal className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[36px] bg-ink px-8 py-24 text-center text-paper sm:px-16">
          <div aria-hidden className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--paper) 31px 32px)" }} />
          <h2 className="relative mx-auto max-w-2xl text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[64px]">Start keeping an honest record.</h2>
          <p className="relative mx-auto mt-5 max-w-md text-[16px] text-paper/60">Free. Private. Ready in under a minute.</p>
          <Magnetic><CtaLink className="relative mt-10 inline-flex h-[52px] items-center gap-2 rounded-full bg-paper px-8 text-[15px] font-medium text-ink transition-transform hover:scale-[1.03]">Start your journal <ArrowRight size={16} /></CtaLink></Magnetic>
          <ul className="relative mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13.5px] text-paper/60">
            {["No card to start", "Works in your browser", "Free forever"].map((x) => <li key={x} className="flex items-center gap-2"><Check size={15} className="text-paper" />{x}</li>)}
          </ul>
        </Reveal>
      </section>

    </>
  );
}
