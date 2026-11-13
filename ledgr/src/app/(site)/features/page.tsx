import type { Metadata } from "next";
import { CtaLink } from "@/components/site/CtaLink";
import { DisciplineDemo, VerseDemo } from "@/components/site/Demos";
import { Reveal, SectionHeading, TiltCard } from "@/components/site/SiteChrome";

export const metadata: Metadata = { title: "Features", description: "Every part of Ledgr: trade journal, analytics, psychology, strategies, accounts, study room, verse library, MatrixX AI and reports." };

const GROUPS: { title: string; sub: string; shot?: string; items: [string, string][] }[] = [
  { title: "Trade journal", sub: "Record what happened — completely and honestly.", shot: "journal", items: [
    ["Quick Log", "Save a draft with only the essentials, finish it after the session."],
    ["Five-tab editor", "Trade, execution, psychology, reflection and attachments."],
    ["Multiple executions", "Scale in, take partials, edit history — averages and fees calculated transparently."],
    ["Search, filters & saved views", "Sort by any column, filter by account, setup, session or emotion, export CSV."],
    ["Trade detail", "Charts, executions, calculations, reflection and a full change history."],
    ["Showcase", "Pin trades worth remembering and export privacy-first share cards."],
  ]},
  { title: "Performance", sub: "Numbers you can trust, because you can see how they're made.", shot: "analytics", items: [
    ["Fourteen charts", "Equity, daily and monthly P&L, win-rate progression, R distribution, drawdown and more."],
    ["Breakdowns", "Compare setups, markets, sessions, weekdays, grades, emotions and plan adherence."],
    ["Fourteen pattern checks", "Configurable, sample-size aware, and silent when the data is too thin."],
    ["What-if analysis", "Replay your records under assumptions you choose — always labelled hypothetical."],
    ["Performance score", "Half process, half statistics, with every component shown."],
  ]},
  { title: "Psychology & discipline", sub: "Understand the decisions behind the results.", shot: "psychology", items: [
    ["Emotion tracker", "See which states you record most, and how they change over time."],
    ["Mistake tracker", "Your own categories, frequency and recurrence."],
    ["Discipline score", "Journal completion, plan adherence, reflection, consistency and awareness — never P&L."],
    ["Daily & weekly journal", "Pre-session intentions, post-session reflection, and a weekly review with your stats."],
  ]},
  { title: "Accounts & strategies", sub: "Structure for the way you practise.", items: [
    ["Account desk", "Separate simulated, backtest and evaluation-practice accounts with calculated balances."],
    ["Account history", "A running ledger of trades and virtual adjustments, exportable to CSV."],
    ["Practice rules", "Track progress against targets and limits you set — educational only."],
    ["Strategy library", "Entry, exit and invalidation criteria with linked-trade statistics and comparison."],
  ]},
  { title: "Learning & intelligence", sub: "Keep studying. Ask better questions.", shot: "ai", items: [
    ["Study room", "Folders, a block editor, YouTube notes with clickable timestamps, and draggable study boards."],
    ["Verse library", "King James verses by topic, favourites with your own reflections, and history."],
    ["MatrixX AI", "Reviews your recorded history with linked citations. No predictions, no advice."],
    ["Reports", "Six report types in five themes, exported as PNG or PDF."],
  ]},
];

export default function FeaturesPage() {
  return (
    <div className="pt-32">
      <section className="mx-auto max-w-[1200px] px-5 pb-10 sm:px-8">
        <Reveal><h1 className="max-w-3xl text-[48px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[72px]">Every feature, in one quiet place.</h1></Reveal>
        <Reveal delay={100}><p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink/60">Ledgr brings your journal, analytics, psychology and study together — so reviewing your process becomes a habit, not a chore.</p></Reveal>
      </section>
      {GROUPS.map((g, gi) => (
        <section key={g.title} className="mx-auto max-w-[1200px] border-t border-ink/10 px-5 py-20 sm:px-8">
          <div className={`grid items-start gap-12 ${g.shot ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" : ""}`}>
            <div>
              <Reveal><SectionHeading kicker={`0${gi + 1}`} title={g.title} sub={g.sub} /></Reveal>
              <ul className={`mt-10 grid gap-x-8 gap-y-7 ${g.shot ? "" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
                {g.items.map(([t, b], i) => (
                  <Reveal as="li" key={t} delay={i * 50}>
                    <p className="text-[15px] font-medium text-ink">{t}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink/55">{b}</p>
                  </Reveal>
                ))}
              </ul>
            </div>
            {g.shot && (
              <Reveal delay={120} className="lg:sticky lg:top-28">
                <TiltCard className="rounded-[18px]" max={5}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/site/${g.shot}.png`} alt={`${g.title} screen with simulated sample records`} width={1440} height={900} className="h-auto w-full rounded-[18px] border border-ink/15" />
                </TiltCard>
              </Reveal>
            )}
          </div>
        </section>
      ))}
      <section className="mx-auto max-w-[1200px] border-t border-ink/10 px-5 py-24 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal><SectionHeading kicker="Try it" title="A score you can see inside." sub="The discipline score combines five habits with fixed weights. Move the sliders to see exactly how it's built." /></Reveal>
          <Reveal delay={100}><DisciplineDemo /></Reveal>
        </div>
      </section>
      <section className="mx-auto max-w-[1200px] border-t border-ink/10 px-5 py-24 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Reveal><SectionHeading kicker="Scripture, chosen with care" title="The right verse for the moment." sub="Each page has its own King James verse. On your dashboard and daily journal, Ledgr notices how your day is going and responds." /></Reveal>
          <Reveal delay={100}><VerseDemo /></Reveal>
        </div>
      </section>
      <section className="border-t border-ink/10 px-5 py-24 text-center sm:px-8">
        <Reveal><h2 className="text-[36px] font-semibold tracking-[-0.03em] sm:text-[48px]">See it with your own records.</h2></Reveal>
        <Reveal delay={100}><CtaLink className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-7 text-[15px] font-medium text-paper">Start your journal</CtaLink></Reveal>
      </section>
    </div>
  );
}
