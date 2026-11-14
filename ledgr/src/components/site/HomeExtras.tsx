/* eslint-disable @next/next/no-img-element */
import { ArrowRight, ArrowUpRight, CalendarCheck, Download, EyeOff, Image as ImageIcon, LineChart, MessageSquare, MessagesSquare, ScanSearch, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { Magnetic } from "./Interactive";
import { Mark } from "./Mark";
import { Reveal, SectionHeading, TiltCard } from "./SiteChrome";
import { PLUS } from "@/lib/plus";

const MX = "#3ee08a";
const DISCORD_BLUE = "#5865F2";
export const DISCORD_URL = "https://discord.gg/7tunZnZav";

/* ------------------------------------------------------------- Product shot */
/** The real dashboard in a browser frame, with a glow and a few floating chips. */
export function ProductShot() {
  return (
    <div className="relative mx-auto max-w-[1180px]">
      <div aria-hidden className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 rounded-[48px] opacity-[0.16] blur-[80px]" style={{ background: "radial-gradient(closest-side, currentColor, transparent)" }} />
      <TiltCard className="relative rounded-[22px]" max={3}>
        <div className="overflow-hidden rounded-[22px] border border-ink/15 bg-[#0b0b0b] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-white/15" /><span className="h-3 w-3 rounded-full bg-white/15" /><span className="h-3 w-3 rounded-full bg-white/15" />
            <span className="mx-auto rounded-md bg-white/[0.06] px-10 py-1 text-[11.5px] text-white/45">ledgrjournal.app/dashboard</span>
          </div>
          <img src="/site/dashboard.png" alt="The LEDGR dashboard with simulated sample records" width={1440} height={900} className="block h-auto w-full" />
        </div>
      </TiltCard>
      {/* floating chips */}
      <div className="pointer-events-none absolute -left-4 top-[22%] hidden animate-[float-y_6s_ease-in-out_infinite] lg:block">
        <div className="site-shadow rounded-2xl border border-ink/10 bg-paper px-4 py-3">
          <p className="text-[11.5px] text-ink/50">Net P&amp;L · sample</p>
          <p className="num mt-0.5 text-[22px] font-semibold" style={{ color: "#1f8a57" }}>+$2,685.85</p>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-5 top-[58%] hidden animate-[float-y_7s_ease-in-out_infinite] [animation-delay:-2s] lg:block">
        <div className="site-shadow flex items-center gap-3 rounded-2xl border border-ink/10 bg-paper px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${MX}26`, color: "#1f8a57" }}><Sparkles size={17} /></span>
          <div><p className="text-[13.5px] font-semibold">Review with MatrixX</p><p className="text-[11.5px] text-ink/50">Your AI trading coach</p></div>
        </div>
      </div>
      <p className="relative mt-4 text-center text-[12px] text-ink/40">The real dashboard, shown with simulated sample records</p>
    </div>
  );
}

/* ---------------------------------------------------------------- MatrixX AI */
const AI_POINTS: [typeof ScanSearch, string, string][] = [
  [ScanSearch, "Trade reviews", "What went well, what to improve against your own rules, and one lesson."],
  [CalendarCheck, "Weekly reviews", "What worked, what kept going wrong, and next week's focus."],
  [MessageSquare, "Ask anything", "Questions about your own history, answered with the trades it used."],
  [Trophy, "A coach, not a tipster", "No predictions, no signals, no financial advice. Ever."],
];

export function MatrixxSection() {
  return (
    <div className="relative overflow-hidden rounded-[40px] bg-ink px-6 py-16 text-paper sm:px-12 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-1/3 h-[460px] w-[460px] rounded-full opacity-25 blur-[110px]" style={{ background: MX }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(ellipse at 20% 40%, black, transparent 70%)" }} />
      <div className="relative grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-paper/15 px-3 py-1 text-[12.5px] text-paper/70"><img src="/matrixx-logo.png" alt="" width={16} height={16} className="h-4 w-4 rounded" /> MatrixX AI</p>
            <h2 className="mt-6 text-[40px] font-semibold leading-[1.0] tracking-[-0.045em] sm:text-[60px]">Your AI trading coach. It read your journal.</h2>
            <p className="mt-6 max-w-md text-[16.5px] leading-relaxed text-paper/60">MatrixX reviews your trades and your weeks from what you actually recorded — your fills, notes, emotions and your own rules.</p>
          </Reveal>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {AI_POINTS.map(([Icon, t, b], i) => (
              <Reveal as="li" key={t} delay={i * 70}>
                <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${MX}26`, color: MX }}><Icon size={17} /></span>
                <p className="mt-3 text-[15.5px] font-semibold">{t}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-paper/55">{b}</p>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={200} className="mt-10 flex flex-wrap items-center gap-3">
            <Magnetic><Link href="/pricing" className="inline-flex h-[52px] items-center gap-2 rounded-full bg-paper px-7 text-[15px] font-medium text-ink transition-transform hover:scale-[1.03]" style={{ boxShadow: `0 16px 44px -14px ${MX}` }}>Get {PLUS.name} · ${PLUS.priceUsd} <ArrowRight size={16} /></Link></Magnetic>
            <span className="text-[13px] text-paper/50">or use a free MatrixX account</span>
          </Reveal>
        </div>

        {/* An example review, in the app's own look */}
        <Reveal delay={150}>
          <div className="relative rounded-[26px] border border-paper/10 bg-paper/[0.04] p-6 backdrop-blur sm:p-8">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2.5 text-[15px] font-semibold"><img src="/matrixx-logo.png" alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-md" /> MatrixX trade review</p>
              <span className="rounded-full border border-paper/15 px-2.5 py-0.5 text-[11px] text-paper/50">Example</span>
            </div>
            <p className="mt-1 text-[12.5px] text-paper/45">NQ #41 · Long · Opening range break</p>
            <div className="mt-6 flex flex-col gap-5 text-[14.5px] leading-relaxed text-paper/80">
              <div><p className="font-semibold text-paper">What went well</p><p className="mt-1 text-paper/65">You waited for the 15-minute range to break and close outside it, exactly as your strategy says. Your stop sat under the range low.</p></div>
              <div><p className="font-semibold text-paper">What to improve</p><p className="mt-1 text-paper/65">You exited at 1.2R, before your 2R target. Your note says &ldquo;nervous after the pullback&rdquo; — the same reason as your last two early exits.</p></div>
              <div><p className="font-semibold text-paper">One lesson</p><p className="mt-1 text-paper/65">Let the plan finish the trade: set the target order the moment you enter.</p></div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-paper/10 pt-4 text-[12px] text-paper/40">
              <span>From your own records · not financial advice</span>
              <span className="inline-flex items-center gap-1.5" style={{ color: MX }}><Sparkles size={13} /> Saved to the trade</span>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ P&L cards */
export function PnlCardSection() {
  return (
    <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
      <Reveal className="relative">
        <div aria-hidden className="pointer-events-none absolute -inset-8 rounded-[40px] opacity-[0.18] blur-[60px]" style={{ background: "radial-gradient(closest-side, #3fbf7f, transparent)" }} />
        <TiltCard className="relative rounded-[22px]" max={6}>
          <img src="/site/pnl-card.png" alt="A LEDGR P&L card for a BTCUSD trade, with the real price line and entry and exit marked (simulated sample record)" width={1432} height={754} className="block h-auto w-full rounded-[22px] border border-ink/15 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.6)]" />
        </TiltCard>
        <p className="mt-3 text-center text-[12px] text-ink/40">A real P&amp;L card, made from a simulated sample trade</p>
      </Reveal>
      <div>
        <Reveal><SectionHeading kicker="P&L cards" title={<>Share the trade. <Mark>Beautifully</Mark>.</>} sub="Turn any trade into a card worth posting — with the real price chart, not a drawing." /></Reveal>
        <ul className="mt-9 flex flex-col gap-5">
          {([
            [LineChart, "Real price charts", "The market's actual price line, with your entry and exit pinned exactly where they happened."],
            [EyeOff, "Private by choice", "Show dollars, R or points. Hide amounts and account names whenever you want."],
            [ImageIcon, "Your look", "Your own background image or video, and your profile photo next to your name."],
            [Download, "Ready to post", "Export as an image or a video for Discord, X or TikTok."],
          ] as [typeof LineChart, string, string][]).map(([Icon, t, b], i) => (
            <Reveal as="li" key={t} delay={i * 60} className="grid grid-cols-[44px_1fr] gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-paper"><Icon size={19} /></span>
              <div><p className="text-[16px] font-semibold">{t}</p><p className="mt-1 text-[14.5px] leading-relaxed text-ink/60">{b}</p></div>
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Community */
export function CommunityBand() {
  return (
    <div className="relative overflow-hidden rounded-[36px] border border-ink/10 bg-paper px-6 py-14 site-shadow sm:px-12 sm:py-16">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-25 blur-3xl" style={{ background: DISCORD_BLUE }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-15 blur-3xl" style={{ background: DISCORD_BLUE }} />
      <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-3 py-1 text-[12.5px] text-ink/65">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: DISCORD_BLUE }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: DISCORD_BLUE }} /></span>
            Community
          </p>
          <h2 className="mt-5 text-[36px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[52px]">Don&apos;t journal alone.</h2>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-ink/60">Join traders who share lessons, post their weekly reviews and hold each other to the process. No signals, ever.</p>
        </Reveal>
        <Reveal delay={120} className="flex flex-col items-start gap-4 lg:items-end">
          <Magnetic>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="group inline-flex h-[58px] items-center gap-2.5 rounded-full bg-ink px-8 text-[16px] font-medium text-paper transition-transform hover:scale-[1.03]" style={{ boxShadow: `0 18px 50px -14px ${DISCORD_BLUE}` }}>
              <MessagesSquare size={19} /> Join the Discord <ArrowUpRight size={17} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </Magnetic>
          <Link href="/community" className="text-[14px] text-ink/60 underline-offset-4 hover:text-ink hover:underline">More about the community</Link>
        </Reveal>
      </div>
    </div>
  );
}
