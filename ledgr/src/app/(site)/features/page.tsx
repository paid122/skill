import {
  ArrowRight, BarChart3, BookMarked, BookOpen, Brain, CalendarDays, CalendarCheck, ClipboardList, FileDown, FileText, Filter, FlaskConical, Gauge,
  GraduationCap, History, Image as ImageIcon, LayoutDashboard, Layers, ListChecks, MessageSquare, NotebookPen, PieChart, ScanSearch, Search, Sparkles,
  SquareStack, Target, TrendingUp, Trophy, Upload, Wallet, Zap, type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/site/CtaLink";
import { DisciplineDemo, VerseDemo } from "@/components/site/Demos";
import { Magnetic } from "@/components/site/Interactive";
import { Mark } from "@/components/site/Mark";
import { Reveal, SectionHeading, TiltCard } from "@/components/site/SiteChrome";
import { PLUS } from "@/lib/plus";

export const metadata: Metadata = { title: "Features", description: "Every part of LEDGR: dashboard, trade journal, CSV import, analytics, psychology, strategies, accounts, MatrixX AI reviews, study room, verses and reports." };

const MX = "#3ee08a";

type Item = [LucideIcon, string, string];
const GROUPS: { id: string; nav: string; title: string; sub: string; shot?: string; items: Item[] }[] = [
  { id: "dashboard", nav: "Dashboard", title: "A dashboard that tells the truth.", sub: "Your key numbers, your P&L curve and every trading day — on one calm screen.", shot: "dashboard", items: [
    [Gauge, "Key numbers at a glance", "Net P&L, win rate, average win/loss, profit factor and current streaks."],
    [TrendingUp, "P&L curve", "Cumulative P&L by trade, day, week or month."],
    [CalendarDays, "Trading calendar", "Every day coloured by result, with weekly totals and notes."],
    [Target, "LEDGR score", "One score built from win rate, profit factor, discipline and consistency."],
  ]},
  { id: "journal", nav: "Journal", title: "Record what happened. Honestly.", sub: "Fast to log, complete when it matters.", shot: "journal", items: [
    [Zap, "Quick Log", "Save the essentials in seconds and finish the trade after the session."],
    [Upload, "CSV import", "Bring in your trades from a broker CSV, including Tradovate. Duplicates are skipped."],
    [NotebookPen, "Five-tab editor", "Trade, execution, psychology, reflection and attachments."],
    [Layers, "Multiple executions", "Scale in, take partials — averages and fees calculated transparently."],
    [Search, "Search, filters & saved views", "Filter by account, setup, session or emotion, and export to CSV."],
    [ImageIcon, "P&L cards", "Shareable cards with real price charts, entry and exit marked — amounts optional."],
  ]},
  { id: "performance", nav: "Performance", title: "Numbers you can trust.", sub: "Because you can see exactly how they're made.", shot: "analytics", items: [
    [BarChart3, "Fourteen charts", "Equity, daily and monthly P&L, win-rate progression, R distribution, drawdown and more."],
    [PieChart, "Breakdowns", "Compare setups, markets, sessions, weekdays, grades, emotions and plan adherence."],
    [ScanSearch, "Fourteen pattern checks", "Sample-size aware, and silent when the data is too thin."],
    [FlaskConical, "What-if analysis", "Replay your records under assumptions you choose — always labelled hypothetical."],
  ]},
  { id: "psychology", nav: "Psychology", title: "Understand the decisions behind the results.", sub: "The habits that move your P&L, made visible.", shot: "psychology", items: [
    [Brain, "Emotion tracker", "See which states you record most, and how they line up with outcomes."],
    [ListChecks, "Mistake tracker", "Your own categories, their frequency and how often they come back."],
    [Gauge, "Discipline score", "Journaling, plan adherence, reflection, consistency and awareness — never P&L."],
    [CalendarCheck, "Daily & weekly journal", "Pre-session intentions, post-session reflection and a weekly review."],
  ]},
  { id: "accounts", nav: "Accounts", title: "Structure for the way you practise.", sub: "Separate accounts, clear rules, your own strategies.", items: [
    [Wallet, "Account desk", "Simulated, backtest and evaluation-practice accounts with calculated balances."],
    [History, "Account history", "A running ledger of trades and adjustments, exportable to CSV."],
    [ClipboardList, "Practice rules", "Track progress against targets and daily limits you set — educational only."],
    [BookMarked, "Strategy library", "Entry, exit and invalidation rules, with linked-trade statistics."],
  ]},
];

const AI: Item[] = [
  [ScanSearch, "Trade reviews", "One click on any trade: what went well, what to improve against your own rules, your mindset, and one lesson."],
  [CalendarCheck, "Weekly reviews", "Your week summed up: what worked, what kept going wrong, patterns, and next week's focus."],
  [MessageSquare, "AI chat", "Ask anything about your own records. Answers cite the trades they draw on."],
  [Trophy, "Your coach, not a tipster", "MatrixX only reviews what you recorded. No predictions, no signals, no financial advice."],
];

const LEARN: Item[] = [
  [GraduationCap, "Study room", "Folders, a block editor, YouTube notes with clickable timestamps, and study boards."],
  [BookOpen, "Verse library", "Orthodox Bible verses by topic, favourites with your own reflections, and history."],
  [FileText, "Reports", "Six report types in five themes."],
  [FileDown, "Export everything", "Reports as PNG or PDF, trades as CSV, and a full backup of your data any time."],
];

const STATS: [string, string][] = [["14", "analytics charts"], ["14", "pattern checks"], ["6", "report types"], ["$0", "for every journal feature"]];

function ItemCard({ item: [Icon, t, b], i }: { item: Item; i: number }) {
  return (
    <Reveal as="li" delay={i * 50} className="group site-shadow rounded-[20px] border border-ink/10 bg-paper p-6 transition-transform duration-300 hover:-translate-y-0.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-paper"><Icon size={18} /></span>
      <p className="mt-4 text-[16px] font-semibold tracking-[-0.01em]">{t}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink/60">{b}</p>
    </Reveal>
  );
}

export default function FeaturesPage() {
  return (
    <div className="pb-28">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden px-5 pb-12 pt-32 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-20 h-[480px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.10] blur-[110px]" style={{ background: "radial-gradient(closest-side, currentColor, transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at 50% 20%, black, transparent 65%)" }} />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur"><LayoutDashboard size={13} /> Features</p>
          <h1 className="text-[48px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[80px]">Every feature, in one <Mark>quiet</Mark> place.</h1>
          <p className="mx-auto mt-7 max-w-[36rem] text-[17px] leading-relaxed text-ink/60 sm:text-[19px]">Your journal, analytics, psychology, AI reviews and study, together — so reviewing your process becomes a habit, not a chore.</p>
        </Reveal>
        <Reveal delay={150} className="relative mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
          {[...GROUPS.map((g) => [g.id, g.nav]), ["ai", "MatrixX AI"], ["learn", "Study & reports"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="site-shadow rounded-full border border-ink/10 bg-paper px-4 py-2 text-[13.5px] text-ink/70 transition-colors hover:border-ink/40 hover:text-ink">{label}</a>
          ))}
        </Reveal>
      </section>

      {/* --------------------------------------------------------------- Stats */}
      <section className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <Reveal className="grid grid-cols-2 overflow-hidden rounded-[26px] border border-ink/10 bg-paper site-shadow md:grid-cols-4">
          {STATS.map(([n, l], i) => (
            <div key={l} className={`px-6 py-7 text-center ${i % 2 ? "border-l border-ink/10" : ""} ${i > 1 ? "border-t border-ink/10 md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
              <p className="num text-[40px] font-semibold leading-none tracking-[-0.03em]">{n}</p>
              <p className="mt-2 text-[13.5px] text-ink/55">{l}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* -------------------------------------------------------------- Groups */}
      {GROUPS.map((g, gi) => (
        <section key={g.id} id={g.id} className="mx-auto max-w-[1200px] scroll-mt-24 overflow-x-clip px-5 pt-28 sm:px-8">
          <div className={`grid items-start gap-12 ${g.shot ? "lg:grid-cols-2" : ""}`}>
            <div className={g.shot && gi % 2 ? "lg:order-2" : ""}>
              <Reveal><SectionHeading kicker={`0${gi + 1} · ${g.nav}`} title={g.title} sub={g.sub} /></Reveal>
              <ul className={`mt-10 grid gap-4 ${g.shot ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
                {g.items.map((it, i) => <ItemCard key={it[1]} item={it} i={i} />)}
              </ul>
            </div>
            {g.shot && (
              <Reveal delay={120} className={`lg:sticky lg:top-28 ${gi % 2 ? "lg:order-1" : ""}`}>
                <div className="relative">
                  <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[32px] opacity-[0.12] blur-2xl" style={{ background: "radial-gradient(closest-side, currentColor, transparent)" }} />
                  <TiltCard className="relative rounded-[18px]" max={5}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/site/${g.shot}.png`} alt={`${g.nav} screen with simulated sample records`} width={1440} height={900} className="h-auto w-full rounded-[18px] border border-ink/15" />
                  </TiltCard>
                </div>
                <p className="mt-3 text-center text-[12px] text-ink/40">Simulated sample records</p>
              </Reveal>
            )}
          </div>
        </section>
      ))}

      {/* ------------------------------------------------------------ MatrixX AI */}
      <section id="ai" className="scroll-mt-24 px-5 pt-28 sm:px-8">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[36px] bg-ink px-6 py-14 text-paper sm:px-12 sm:py-16">
          <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full opacity-30 blur-[100px]" style={{ background: MX }} />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at 80% 0%, black, transparent 70%)" }} />
          <div className="relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.14em] text-paper/50"><Sparkles size={14} style={{ color: MX }} /> 06 · MatrixX AI</p>
              <h2 className="mt-4 text-[38px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[52px]">Your AI trading coach, inside your journal.</h2>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-paper/60">MatrixX reads your own records — trades, notes, emotions and rules — and reviews them like a coach would. Works with a free MatrixX account, or get {PLUS.matrixxPlan} included with {PLUS.name}.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pricing" className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 text-[15px] font-medium text-ink transition-transform hover:scale-[1.03]" style={{ boxShadow: `0 14px 40px -14px ${MX}` }}>See {PLUS.name} <ArrowRight size={15} /></Link>
              </div>
            </Reveal>
            <ul className="grid gap-4 sm:grid-cols-2">
              {AI.map(([Icon, t, b], i) => (
                <Reveal as="li" key={t} delay={i * 70} className="rounded-[20px] border border-paper/10 bg-paper/[0.04] p-6 backdrop-blur">
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${MX}26`, color: MX }}><Icon size={18} /></span>
                  <p className="mt-4 text-[16px] font-semibold">{t}</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-paper/60">{b}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Study & reports */}
      <section id="learn" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 pt-28 sm:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <Reveal><SectionHeading kicker="07 · Study & reports" title="Keep studying. Share your progress." sub="Notes, scripture and reports that turn your records into lessons." /></Reveal>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">{LEARN.map((it, i) => <ItemCard key={it[1]} item={it} i={i} />)}</ul>
          </div>
          <Reveal delay={120} className="lg:sticky lg:top-28">
            <TiltCard className="rounded-[18px]" max={5}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/reports.png" alt="Reports screen with simulated sample records" width={1440} height={900} className="h-auto w-full rounded-[18px] border border-ink/15" />
            </TiltCard>
            <p className="mt-3 text-center text-[12px] text-ink/40">Simulated sample records</p>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------------- Demos */}
      <section className="mx-auto max-w-[1200px] px-5 pt-28 sm:px-8">
        <Reveal><SectionHeading center kicker="Try it here" title={<>See how it <Mark>works</Mark>.</>} sub="Two small parts of LEDGR you can play with right now." /></Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal className="site-shadow rounded-[28px] border border-ink/10 bg-paper p-7 sm:p-9">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/45">Discipline score</p>
            <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">A score you can see inside.</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">Five habits with fixed weights. Move the sliders to see exactly how it&apos;s built.</p>
            <div className="mt-7"><DisciplineDemo /></div>
          </Reveal>
          <Reveal delay={100} className="site-shadow rounded-[28px] border border-ink/10 bg-paper p-7 sm:p-9">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/45">Scripture, chosen with care</p>
            <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.02em]">The right verse for the moment.</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">Each page has its own verse from the Orthodox Bible. On your dashboard and daily journal, LEDGR notices how your day is going and responds.</p>
            <div className="mt-7"><VerseDemo /></div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ Final CTA */}
      <section className="px-5 pt-28 sm:px-8">
        <Reveal className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[36px] bg-ink px-6 py-16 text-center text-paper sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)" }} />
          <div className="relative">
            <SquareStack size={28} className="mx-auto text-paper/40" />
            <h2 className="mx-auto mt-5 max-w-[16ch] text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px]">See it with your own records.</h2>
            <p className="mx-auto mt-5 max-w-[30rem] text-[16px] leading-relaxed text-paper/60 sm:text-[18px]">Free to start. No card, no trial clock — just your journal.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Magnetic><CtaLink className="inline-flex h-[56px] items-center gap-2 rounded-full bg-paper px-8 text-[16px] font-medium text-ink transition-transform hover:scale-[1.03]">Start your journal <ArrowRight size={16} /></CtaLink></Magnetic>
              <Magnetic><Link href="/pricing" className="inline-flex h-[56px] items-center rounded-full border border-paper/25 px-8 text-[16px] text-paper/85 transition-colors hover:border-paper/60 hover:text-paper">See pricing</Link></Magnetic>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
