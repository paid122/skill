import { ArrowUpRight, BookOpenCheck, Bug, CalendarCheck, Lightbulb, Megaphone, MessagesSquare, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Magnetic } from "@/components/site/Interactive";
import { Mark } from "@/components/site/Mark";
import { Reveal, SectionHeading } from "@/components/site/SiteChrome";
import { SignupForm } from "@/components/site/SignupForm";

export const metadata: Metadata = {
  title: "Community",
  description: "Join the LEDGR Discord: traders who journal, review their weeks and grow on process, not signals.",
};

const DISCORD = "https://discord.gg/7tunZnZav";
const GLOW = "#5865F2"; // a soft Discord-blue glow behind the invite

const INSIDE = [
  { icon: Megaphone, title: "First to know", body: "New features, fixes and early previews land in the Discord before anywhere else." },
  { icon: CalendarCheck, title: "Weekly accountability", body: "Share your weekly review, set next week's focus, and check in with people doing the same." },
  { icon: BookOpenCheck, title: "Lessons, not signals", body: "Post what you learned from a trade — the setup, the mistake, the fix. Never what to buy next." },
  { icon: Sparkles, title: "MatrixX AI tips", body: "See how others use trade reviews and weekly reviews to spot their own patterns faster." },
  { icon: Lightbulb, title: "Shape LEDGR", body: "Suggest features and vote on ideas. The best ones get built." },
  { icon: Bug, title: "Help from the team", body: "Stuck, or found a bug? Ask in the Discord and get an answer from the people who build LEDGR." },
];

const VALUES = [
  ["Process over P&L", "We talk about preparation, rules and reflection — not screenshots of wins."],
  ["Honest records", "Mistakes are information. Sharing them is how everyone improves."],
  ["No signals, no tips", "Nobody here tells anyone what to trade. That's a rule, not a suggestion."],
  ["Respect", "Different markets, faiths and experience levels are all welcome."],
];

const STEPS = [
  ["Open the invite", "Tap Join the Discord. It opens in the Discord app or your browser."],
  ["Accept and read the rules", "Takes a few seconds. The rules are short: they're the four values on this page."],
  ["Say hi", "Tell us what you trade and what you're working on. That's it — you're in."],
];

function JoinButton({ big = false }: { big?: boolean }) {
  return (
    <Magnetic>
      <a href={DISCORD} target="_blank" rel="noopener noreferrer"
        className={`group relative inline-flex items-center gap-2.5 rounded-full bg-ink font-medium text-paper transition-transform hover:scale-[1.03] ${big ? "h-[60px] px-9 text-[17px]" : "h-[52px] px-7 text-[15px]"}`}
        style={{ boxShadow: `0 18px 50px -14px ${GLOW}` }}>
        <MessagesSquare size={big ? 20 : 18} />
        Join the Discord
        <ArrowUpRight size={big ? 18 : 16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a>
    </Magnetic>
  );
}

export default function CommunityPage() {
  return (
    <div className="pb-28">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden px-5 pb-20 pt-32 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.22] blur-[110px]" style={{ background: `radial-gradient(closest-side, ${GLOW}, transparent)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at 50% 30%, black, transparent 70%)" }} />
        <div className="relative mx-auto max-w-[1000px] text-center">
          <Reveal>
            <p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: GLOW }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: GLOW }} /></span>
              The LEDGR Discord is open
            </p>
            <h1 className="mx-auto max-w-[15ch] text-[50px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[84px]">Grow alongside traders who <Mark>journal</Mark>.</h1>
            <p className="mx-auto mt-7 max-w-[36rem] text-[17px] leading-relaxed text-ink/60 sm:text-[19px]">A calm place to share lessons, review your weeks together, and build discipline with people who take the process seriously.</p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <JoinButton big />
              <a href="#updates" className="inline-flex h-[60px] items-center rounded-full border border-ink/20 bg-paper/70 px-8 text-[16px] text-ink/80 backdrop-blur transition-colors hover:border-ink/50 hover:text-ink">Get updates by email</a>
            </div>
            <p className="mt-5 text-[13px] text-ink/45">Free to join · No signals, ever · Built by the LEDGR team</p>
          </Reveal>
        </div>

        {/* Topic cloud: what people talk about */}
        <Reveal delay={320} className="relative mx-auto mt-16 max-w-[900px]">
          <div className="flex flex-wrap justify-center gap-2.5">
            {["Weekly reviews", "Lessons from losses", "Pre-market plans", "Prop-firm rules", "Psychology", "Feature ideas", "P&L cards", "MatrixX AI", "Study sessions", "Discipline streaks"].map((t, i) => (
              <span key={t} className="site-shadow rounded-full border border-ink/10 bg-paper px-4 py-2 text-[13.5px] text-ink/70" style={{ transform: `translateY(${[0, 6, -4, 8, -2, 4, -6, 2, 6, -3][i]}px)` }}>{t}</span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------- What's inside */}
      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8">
        <Reveal><SectionHeading kicker="Inside the Discord" title={<>More than a chat. A <Mark>practice</Mark>.</>} sub="Everything in the server is built around one idea: get a little better every week." /></Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INSIDE.map((c, i) => (
            <Reveal key={c.title} delay={i * 60} className="group site-shadow relative overflow-hidden rounded-[22px] border border-ink/10 bg-paper p-7 transition-transform duration-300 hover:-translate-y-1">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30" style={{ background: GLOW }} />
              <span className="relative grid h-11 w-11 place-items-center rounded-xl bg-ink text-paper"><c.icon size={19} /></span>
              <p className="relative mt-5 text-[18px] font-semibold tracking-[-0.01em]">{c.title}</p>
              <p className="relative mt-2 text-[14.5px] leading-relaxed text-ink/60">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- Values + How to join */}
      <section className="mx-auto max-w-[1100px] px-5 py-16 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <Reveal className="rounded-[28px] bg-ink p-8 text-paper sm:p-10">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-paper/50">The house rules</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">Four values. No exceptions.</h2>
            <ol className="mt-8 grid gap-6">
              {VALUES.map(([t, b], i) => (
                <li key={t} className="grid grid-cols-[44px_1fr] gap-4">
                  <span className="num text-[28px] font-semibold leading-none text-paper/30">{String(i + 1).padStart(2, "0")}</span>
                  <div><p className="text-[17px] font-semibold">{t}</p><p className="mt-1 text-[14.5px] leading-relaxed text-paper/60">{b}</p></div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={120} className="site-shadow flex flex-col rounded-[28px] border border-ink/10 bg-paper p-8 sm:p-10">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/45">How to join</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">In under a minute.</h2>
            <ol className="mt-8 flex flex-1 flex-col gap-6">
              {STEPS.map(([t, b], i) => (
                <li key={t} className="relative grid grid-cols-[40px_1fr] gap-4">
                  {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[19px] top-10 h-[calc(100%-8px)] w-px bg-ink/10" />}
                  <span className="relative grid h-10 w-10 place-items-center rounded-full border border-ink/15 bg-paper text-[14px] font-semibold">{i + 1}</span>
                  <div className="pt-1.5"><p className="text-[16px] font-semibold">{t}</p><p className="mt-1 text-[14px] leading-relaxed text-ink/60">{b}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-8"><JoinButton /></div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ Final CTA */}
      <section className="px-5 pt-10 sm:px-8">
        <Reveal className="relative mx-auto max-w-[1100px] overflow-hidden rounded-[36px] bg-ink px-6 py-16 text-center text-paper sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[640px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-[90px]" style={{ background: GLOW }} />
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)" }} />
          <div className="relative">
            <h2 className="mx-auto max-w-[14ch] text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[64px]">Pull up a chair.</h2>
            <p className="mx-auto mt-5 max-w-[32rem] text-[16px] leading-relaxed text-paper/60 sm:text-[18px]">Bring your journal, your questions and your worst trade of the week. We&apos;ll bring ours.</p>
            <div className="mt-9 flex justify-center">
              <Magnetic>
                <a href={DISCORD} target="_blank" rel="noopener noreferrer" className="group inline-flex h-[60px] items-center gap-2.5 rounded-full bg-paper px-9 text-[17px] font-medium text-ink transition-transform hover:scale-[1.03]">
                  <MessagesSquare size={20} /> Join the LEDGR Discord <ArrowUpRight size={18} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </Magnetic>
            </div>
            <p className="mt-5 text-[13px] text-paper/45">discord.gg/7tunZnZav</p>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------- Email updates */}
      <section id="updates" className="mx-auto max-w-[1100px] scroll-mt-24 px-5 pt-20 sm:px-8">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_440px]">
          <Reveal>
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/45">Not on Discord?</p>
            <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em] sm:text-[38px]">Get the updates by email instead.</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink/60">We&apos;ll email you about new features, study sessions and community events. No spam, and you can ask us to remove you any time.</p>
          </Reveal>
          <Reveal delay={120} className="site-shadow rounded-[24px] border border-ink/10 bg-paper p-7">
            <SignupForm kind="community" submitLabel="Send me updates" done="You're on the list. We'll be in touch."
              fields={[{ name: "interests", label: "What would you like from the community? (optional)", multiline: true, placeholder: "Study sessions, journaling accountability, feature ideas…" }]} />
          </Reveal>
        </div>
      </section>
    </div>
  );
}
