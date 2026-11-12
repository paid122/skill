import { BookOpen, Lock, Sparkles } from "lucide-react";
import { chronological, closedOnly, computeStats, dailyPnl, disciplineScore, enrich, equityCurve } from "@/lib/calc";
import { buildSampleState } from "@/lib/sample";
import { addDays, fmtMoney, fmtPct, fmtR, today, weekStart } from "@/lib/util";
import { DrawOnView, Ring } from "./Interactive";
import { Reveal } from "./SiteChrome";

/** Feature grid. Every number is calculated from the simulated sample journal. */
export function Bento() {
  const s = buildSampleState();
  const list = enrich(s.trades);
  const stats = computeStats(list);
  const curve = equityCurve(list).map((p) => p.equity);
  const disc = disciplineScore(s.trades, s.dailyJournals);
  const daily = dailyPnl(list);
  const best = chronological(closedOnly(list)).filter((x) => x.trade.reflection.learned).slice(-1)[0];

  // Equity path
  const W = 560, H = 160;
  const min = Math.min(0, ...curve), max = Math.max(...curve, 1);
  const path = curve.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, curve.length - 1)) * W).toFixed(1)},${(H - ((v - min) / (max - min)) * (H - 12) - 6).toFixed(1)}`).join(" ");

  // Five-week calendar heatmap ending this week
  const start = addDays(weekStart(today()), -28);
  const days = Array.from({ length: 35 }, (_, i) => addDays(start, i));
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(daily.get(d)?.net ?? 0)));

  const card = "site-shadow relative overflow-hidden rounded-[26px] border border-ink/10 bg-paper p-7";
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Reveal className="md:col-span-4">
        <div className={card + " h-full"}>
          <p className="text-[13px] text-ink/50">Equity curve</p>
          <p className="mt-2 text-[26px] font-semibold tracking-tight">Every closed trade, in order.</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full text-ink" aria-hidden>
            {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="currentColor" strokeOpacity=".07" />)}
            <DrawOnView d={path} />
          </svg>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink/55">
            <span>Net <b className="font-mono font-medium text-ink">{fmtMoney(stats.net, "USD", { sign: true })}</b></span>
            <span>Win rate <b className="font-mono font-medium text-ink">{fmtPct(stats.winRate)}</b></span>
            <span>Average <b className="font-mono font-medium text-ink">{fmtR(stats.avgR)}</b></span>
            <span>Max drawdown <b className="font-mono font-medium text-ink">{fmtMoney(stats.maxDD.amount, "USD")}</b></span>
          </div>
        </div>
      </Reveal>
      <Reveal delay={80} className="md:col-span-2">
        <div className={card + " flex h-full flex-col items-center text-center"}>
          <p className="self-start text-[13px] text-ink/50">Discipline score</p>
          <div className="relative mt-4 text-ink">
            <Ring value={disc.score ?? 0} />
            <span className="absolute inset-0 grid place-items-center font-mono text-[34px] font-medium">{Math.round(disc.score ?? 0)}</span>
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-ink/60">Built from journal completion, plan adherence and reflection. Never from profit.</p>
        </div>
      </Reveal>
      <Reveal delay={60} className="md:col-span-2">
        <div className={card + " h-full"}>
          <p className="text-[13px] text-ink/50">Calendar</p>
          <div className="mt-5 grid grid-cols-7 gap-1.5" aria-hidden>
            {days.map((d) => {
              const v = daily.get(d)?.net ?? 0;
              const a = v ? 0.12 + (Math.abs(v) / maxAbs) * 0.75 : 0;
              return <span key={d} className="aspect-square rounded-[6px] border border-ink/[0.06]" style={{ background: v > 0 ? `rgba(31,138,87,${a})` : v < 0 ? `rgba(200,55,63,${a})` : "transparent" }} />;
            })}
          </div>
          <p className="mt-5 text-[14px] leading-relaxed text-ink/60">Five weeks at a glance. Click any day in the app to open its trades.</p>
        </div>
      </Reveal>
      <Reveal delay={120} className="md:col-span-4">
        <div className={card + " h-full"}>
          <p className="flex items-center gap-2 text-[13px] text-ink/50"><Sparkles size={14} /> Ledgr AI</p>
          <div className="mt-5 flex flex-col gap-3">
            <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[14px] text-paper">What did my most recent lesson say?</p>
            <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-ink/10 bg-paper-2 px-4 py-3 text-[14px] leading-relaxed text-ink/80">
              {best ? <>On <span className="rounded border border-ink/25 px-1 font-mono text-[12px]">#{best.trade.number}</span> ({best.trade.symbol}, {best.trade.setup || "no setup"}) you wrote: “{best.trade.reflection.learned}” — and you rated the execution {best.trade.grade ?? "ungraded"}.</> : "Ask about any trade, week or habit."}
            </div>
          </div>
          <p className="mt-5 text-[14px] leading-relaxed text-ink/60">Answers come from your own records and link to the trades they cite. No predictions, no advice.</p>
        </div>
      </Reveal>
      <Reveal delay={60} className="md:col-span-3">
        <div className={card + " h-full"}>
          <p className="flex items-center gap-2 text-[13px] text-ink/50"><BookOpen size={14} /> Verse on every page</p>
          <blockquote className="verse-text mt-5 text-[22px] leading-snug text-ink">He that is slow to wrath is of great understanding: but he that is hasty of spirit exalteth folly.</blockquote>
          <p className="mt-4 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink/50">Proverbs 14:29 · KJV · Psychology page</p>
        </div>
      </Reveal>
      <Reveal delay={120} className="md:col-span-3">
        <div className="site-shadow relative h-full overflow-hidden rounded-[26px] border border-ink/10 bg-ink p-7 text-paper">
          <p className="flex items-center gap-2 text-[13px] text-paper/60"><Lock size={14} /> Private by design</p>
          <p className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">Works without an account. Syncs only if you want it to.</p>
          <p className="mt-4 text-[14px] leading-relaxed text-paper/65">Your journal lives in your browser. With an account, database rules make every record readable by you alone.</p>
        </div>
      </Reveal>
      <p className="md:col-span-6 text-center text-[11.5px] text-ink/40">Figures above are calculated from simulated sample records.</p>
    </div>
  );
}
