"use client";
import { useMemo } from "react";
import { PageIntro, ScopeControls } from "@/components/blocks";
import { TrendLine } from "@/components/charts";
import { Card, NotEnoughData, Progress, SectionTitle } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { chronological, computeStats, disciplineScore, performanceScore } from "@/lib/calc";
import { useScoped } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { fmtNum } from "@/lib/util";

function Ring({ value, label }: { value: number | null; label: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${label}: ${value === null ? "not enough data" : Math.round(v)}`}>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--card-2)" strokeWidth="8" />
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 66 66)" style={{ transition: "stroke-dasharray 600ms ease" }} />
        <text x="66" y="72" textAnchor="middle" className="num" fontSize="28" fill="var(--text)">{value === null ? "—" : Math.round(v)}</text>
      </svg>
      <span className="text-[13px] text-text-2">{label}</span>
    </div>
  );
}

export default function PerformanceScorePage() {
  const { current } = useScoped();
  const journals = useLedgr((s) => s.dailyJournals);
  const minSample = useLedgr((s) => s.settings.insights.minSample);
  const stats = useMemo(() => computeStats(current), [current]);
  const disc = useMemo(() => disciplineScore(current.map((x) => x.trade), journals), [current, journals]);
  const perf = useMemo(() => performanceScore(stats, disc, minSample), [stats, disc, minSample]);

  // Rolling score over windows of `minSample` trades.
  const rolling = useMemo(() => {
    const seq = chronological(current);
    const out: { label: string; value: number | null }[] = [];
    for (let i = minSample; i <= seq.length; i += Math.max(1, Math.floor(minSample / 2))) {
      const w = seq.slice(i - minSample, i);
      const p = performanceScore(computeStats(w), disciplineScore(w.map((x) => x.trade), journals), minSample);
      out.push({ label: `#${w[w.length - 1].trade.number}`, value: p.total });
    }
    return out;
  }, [current, journals, minSample]);

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Performance score" sub="One number that balances how you work with what your records show. Every part is shown, so you can see exactly how it is built." actions={<ScopeControls />} />
      <PageVerse page="score" compact />

      <Card className="flex flex-col items-center justify-around gap-8 py-10 sm:flex-row">
        <Ring value={perf.total} label="Performance score" />
        <Ring value={disc.score} label="Discipline (50%)" />
        <Ring value={perf.quality} label="Statistical quality (50%)" />
      </Card>
      {!perf.enough && <p className="-mt-2 text-[13px] text-text-2">Not enough journal data yet. Statistical quality needs at least {minSample} closed trades in range (you have {stats.closed}). The threshold can be changed in Analytics → Pattern insights → Configure.</p>}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Discipline components" sub="Process — never uses P&L" />
          <ul className="flex flex-col gap-4">
            {disc.components.map((c) => (
              <li key={c.key}>
                <div className="mb-1.5 flex justify-between text-[13px]"><span>{c.label} <span className="text-muted">· {Math.round(c.weight * 100)}%</span></span><span className="num text-text-2">{c.value === null ? "No data" : fmtNum(c.value, 0)}</span></div>
                <Progress value={c.value ?? 0} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle title="Statistical quality components" sub="Equal weights, each scaled to 0–100" />
          <ul className="flex flex-col gap-4">
            {perf.parts.map((c) => (
              <li key={c.key}>
                <div className="mb-1.5 flex justify-between text-[13px]"><span>{c.label}</span><span className="num text-text-2">{c.value === null ? "No data" : fmtNum(c.value, 0)}</span></div>
                <Progress value={c.value ?? 0} />
                <p className="mt-1 text-xs text-muted">{c.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Score over time" sub={`Rolling windows of ${minSample} closed trades`} />
        {rolling.filter((r) => r.value !== null).length >= 2 ? <TrendLine data={rolling} name="Performance score" format={(v) => fmtNum(v, 0)} /> : <NotEnoughData note={`Needs at least ${minSample + Math.floor(minSample / 2)} closed trades.`} />}
      </Card>

      <Card>
        <SectionTitle title="Formula" />
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-bg-2/60 p-4 font-mono text-xs leading-relaxed text-text-2">{`Performance score = 0.5 × Discipline + 0.5 × Statistical quality

Discipline = weighted mean of available components
  25% journal completion · 25% plan adherence · 20% reflection completion
  15% documentation consistency · 15% emotional awareness

Statistical quality = mean of
  min(profit factor ÷ 2, 1) × 100
  win rate × 100
  clamp((average R + 1) ÷ 2, 0, 1) × 100
  100 − min(|max drawdown| ÷ gross profit, 1) × 100`}</pre>
        <p className="mt-3 text-xs text-muted">The score summarises recorded history. It is not a forecast and does not indicate future results.</p>
      </Card>
    </div>
  );
}
