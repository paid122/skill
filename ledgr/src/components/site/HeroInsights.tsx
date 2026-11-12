import { computeStats, disciplineScore, enrich, frequency, groupStats } from "@/lib/calc";
import { buildSampleState } from "@/lib/sample";
import { fmtMoney, fmtNum, fmtPct, fmtR } from "@/lib/util";

/**
 * Floating insight cards for the landing hero. Every figure is computed by Ledgr's own
 * calculation engine from the simulated sample journal — and labelled as such.
 */
function sampleInsights() {
  const s = buildSampleState();
  const list = enrich(s.trades);
  const setups = groupStats(list, (x) => x.trade.setup || null).filter((g) => g.stats.closed >= 10 && g.stats.avgR !== null);
  const best = [...setups].sort((a, b) => (b.stats.avgR as number) - (a.stats.avgR as number))[0];
  // The documented mistake whose trades lost the most in total. If none lost money, fall back to the most repeated one.
  const mistakes = frequency(list.flatMap((x) => x.trade.mistakes)).map((m) => ({ ...m, stats: computeStats(list.filter((x) => x.trade.mistakes.includes(m.key))) }));
  const costliest = [...mistakes].filter((m) => m.stats.net < 0).sort((a, b) => a.stats.net - b.stats.net)[0];
  const topMistake = costliest ?? mistakes[0];
  const withMistake = topMistake?.stats ?? null;
  const mistakeIsCost = !!costliest;
  const disc = disciplineScore(s.trades, s.dailyJournals);
  const followed = computeStats(list.filter((x) => x.trade.reflection.followedPlan === "yes"));
  return { best, topMistake, withMistake, mistakeIsCost, disc, followed };
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values.map(Math.abs), 1);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => <span key={i} className={`w-[5px] rounded-full ${v >= 0 ? "bg-ink" : "bg-ink/25"}`} style={{ height: `${Math.max(12, (Math.abs(v) / max) * 100)}%` }} />)}
    </div>
  );
}

export function HeroInsights() {
  const { best, topMistake, withMistake, mistakeIsCost, disc, followed } = sampleInsights();
  const cards = [
    best && {
      key: "setup", title: "Strongest setup", line: `${best.key} · ${fmtPct(best.stats.winRate, 0)} win rate over ${best.stats.closed} trades`,
      value: fmtR(best.stats.avgR), sub: "average R", visual: <Bars values={[0.8, -0.6, 1.4, 1.1, -0.9, 2.1, 0.7, 1.6, -0.4, 1.9]} />, pos: "md:-rotate-[1.5deg]",
    },
    topMistake && withMistake && {
      key: "habit", title: mistakeIsCost ? "Costliest habit" : "Most repeated mistake", line: `${topMistake.key} · recorded ${topMistake.count} times`,
      value: mistakeIsCost ? fmtMoney(withMistake.net, "USD", { sign: true }) : `${topMistake.count}×`, sub: mistakeIsCost ? "net on those trades" : "times documented", visual: <Bars values={[-0.7, 0.4, -1.1, -0.8, 0.3, -1.4, -0.6, -0.9]} />, pos: "md:translate-y-10 md:rotate-[1.2deg]",
    },
    disc.score !== null && {
      key: "discipline", title: "Discipline score", line: `Plan followed on ${followed.closed} trades · ${fmtPct(followed.winRate, 0)} win rate`,
      value: fmtNum(disc.score, 0), sub: "out of 100", visual: (
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-ink" style={{ width: `${disc.score}%` }} /></div>
      ), pos: "md:-translate-y-2 md:-rotate-[0.8deg]",
    },
  ].filter(Boolean) as { key: string; title: string; line: string; value: string; sub: string; visual: React.ReactNode; pos: string }[];

  return (
    <div className="relative mx-auto mt-16 max-w-[1080px]">
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => (
          <div key={c.key} className={`drift ${c.pos}`} style={{ animationDelay: `${i * 0.9}s` }}>
            <div className="site-shadow rounded-[22px] border border-ink/10 bg-paper p-6 text-left">
              <p className="text-[19px] font-semibold tracking-tight">{c.title}</p>
              <p className="mt-1.5 text-[13.5px] leading-snug text-ink/55">{c.line}</p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[26px] font-medium leading-none">{c.value}</p>
                  <p className="mt-1.5 text-[11.5px] text-ink/45">{c.sub}</p>
                </div>
                <div className="w-28">{c.visual}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-[11.5px] text-ink/40">Examples calculated by Ledgr from simulated sample records — not real trading results.</p>
    </div>
  );
}
