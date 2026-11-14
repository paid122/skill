import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Bento } from "@/components/site/Bento";
import { ScrollScene } from "@/components/site/Cinematic";
import { Compare, HomePricing, Install } from "@/components/site/HomeSections";
import { Mark } from "@/components/site/Mark";
import { CtaLink } from "@/components/site/CtaLink";
import { Faq } from "@/components/site/Faq";
import { Hero3D } from "@/components/site/Hero3D";
import { CommunityBand, MatrixxSection, PnlCardSection, ProductShot } from "@/components/site/HomeExtras";
import { LiveCalculator, Magnetic, ScrollStory, SplitHeadline, Spotlight, type StoryStep } from "@/components/site/Interactive";
import { Reveal, SectionHeading } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Ledgr — Discipline over impulse",
  description: "The free trading journal for disciplined traders: log trades, see your real numbers, and let MatrixX AI review your trades and your week.",
};

const STORY: StoryStep[] = [
  { key: "log", kicker: "Log", title: "Capture the trade before the feeling fades.", body: "Quick Log saves the essentials in seconds. Add executions, partial exits, fees and screenshots when the session ends.", shot: "journal" },
  { key: "review", kicker: "Review", title: "See the whole picture, calmly.", body: "Your key numbers at a glance, a P&L curve, a calendar of every trading day and your LEDGR score — on one quiet screen.", shot: "dashboard" },
  { key: "understand", kicker: "Understand", title: "Patterns, only when they're real.", body: "Fourteen charts and fourteen pattern checks. When the sample is too small, Ledgr says so instead of inventing a story.", shot: "analytics" },
  { key: "reflect", kicker: "Reflect", title: "Measure the process, not just the result.", body: "Emotions, documented mistakes and a discipline score you can read line by line — never calculated from profit.", shot: "psychology" },
  { key: "share", kicker: "Share", title: "Show your work, on your terms.", body: "Recap cards and PDFs that hide amounts and account names unless you choose to include them.", shot: "reports" },
];


const MARQUEE = ["Trade journal", "CSV import", "P&L calendar", "MatrixX trade reviews", "Weekly AI reviews", "Discipline score", "P&L cards", "Strategy library", "Psychology tracking", "Study room", "Verse library", "Prop-firm practice", "What-if analysis"];

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
            <p className="mt-8 max-w-[34rem] text-[17px] leading-relaxed text-ink/65 sm:text-[19px]">Track every lesson. Measure every step. LEDGR is the free trading journal for the decisions, habits and discipline behind your results — with an AI coach that reads it.</p>
          </Reveal>
          <Reveal delay={650}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Magnetic><CtaLink className="group inline-flex h-[52px] items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-paper shadow-[0_14px_30px_-12px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.03]">Start your journal <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></CtaLink></Magnetic>
              <Magnetic><a href="#matrixx" className="inline-flex h-[52px] items-center gap-2 rounded-full border border-ink/20 bg-paper/70 px-7 text-[15px] text-ink/85 backdrop-blur transition-colors hover:border-ink/50 hover:text-ink"><Sparkles size={15} /> Meet MatrixX AI</a></Magnetic>
            </div>
            <p className="mt-7 text-[12.5px] text-ink/40">For simulated and historical records. No broker connection, no trade execution, no financial advice.</p>
          </Reveal>
        </div>
        <div aria-hidden className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[11px] text-ink/40 lg:flex [@media(max-height:940px)]:!hidden">
          Scroll<span className="h-10 w-px overflow-hidden bg-ink/10"><span className="block h-4 w-px animate-[drift_2s_ease-in-out_infinite] bg-ink/60" /></span>
        </div>
      </section>

      {/* ------------------------------------------------- Insight cards */}
      <section aria-label="The LEDGR dashboard" className="relative z-10 -mt-6 overflow-x-clip px-5 pb-24 sm:px-8 lg:-mt-16">
        <Reveal><ProductShot /></Reveal>
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

      {/* ------------------------------------------------------ MatrixX AI */}
      <section id="matrixx" className="scroll-mt-20 px-5 pt-28 sm:px-8">
        <div className="mx-auto max-w-[1240px]"><MatrixxSection /></div>
      </section>

      {/* ------------------------------------------------------- P&L cards */}
      <section className="mx-auto max-w-[1200px] overflow-x-clip px-5 pt-28 sm:px-8">
        <PnlCardSection />
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

      {/* --------------------------------------------------------- Verse */}
      <section className="relative overflow-hidden border-y border-ink/10 px-5 py-32 sm:px-8">
        <div aria-hidden className="dot-grid dot-fade absolute inset-0 -z-10" />
        <Reveal className="mx-auto max-w-3xl text-center">
          <blockquote className="verse-text text-[30px] leading-snug text-ink sm:text-[44px]">Disclose thy way to the Lord, and hope in him; and he shall bring [it] to pass.</blockquote>
          <p className="mt-7 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink/50">Psalm 36:5 · Septuagint</p>
          <p className="mx-auto mt-8 max-w-lg text-[15px] leading-relaxed text-ink/55">Every page in Ledgr carries a verse chosen for the work it holds — honesty in the journal, wisdom in analytics, patience in psychology. Quietly, never preachy.</p>
        </Reveal>
      </section>

      {/* ------------------------------------------------------- Pricing */}
      <section id="pricing" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-28 sm:px-8">
        <Reveal><SectionHeading kicker="Pricing" title={<>Free. <Mark>Actually</Mark> free.</>} sub="Every journal feature, no card, no trial clock. Add MatrixX AI with LEDGR+ whenever you want." /></Reveal>
        <Reveal delay={100} className="mt-12"><HomePricing /></Reveal>
      </section>

      {/* ----------------------------------------------------- Community */}
      <section className="mx-auto max-w-[1200px] px-5 pb-28 sm:px-8">
        <CommunityBand />
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
          <p className="relative mx-auto mt-5 max-w-md text-[16px] text-paper/60">Free journal. MatrixX AI when you want it. Ready in under a minute.</p>
          <Magnetic><CtaLink className="relative mt-10 inline-flex h-[52px] items-center gap-2 rounded-full bg-paper px-8 text-[15px] font-medium text-ink transition-transform hover:scale-[1.03]">Start your journal <ArrowRight size={16} /></CtaLink></Magnetic>
          <ul className="relative mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13.5px] text-paper/60">
            {["No card to start", "Works in your browser", "Imports your Tradovate CSV"].map((x) => <li key={x} className="flex items-center gap-2"><Check size={15} className="text-paper" />{x}</li>)}
          </ul>
        </Reveal>
      </section>

    </>
  );
}
