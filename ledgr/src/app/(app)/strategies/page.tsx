"use client";
import { Archive, Plus, SquareLibrary } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { Sparkline } from "@/components/charts";
import { StrategyEditor } from "@/components/StrategyEditor";
import { Badge, Button, Card, EmptyState, SectionTitle, Toggle } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { newStrategy } from "@/lib/actions";
import { computeStats, equityCurve, tradesForStrategy } from "@/lib/calc";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import type { Strategy } from "@/lib/types";
import { cx, fmtMoney, fmtNum, fmtPct, fmtR } from "@/lib/util";

export default function StrategiesPage() {
  const strategies = useLedgr((s) => s.strategies);
  const currency = useLedgr((s) => s.settings.baseCurrency);
  const all = useEnriched();
  const [editing, setEditing] = useState<Strategy | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const rows = useMemo(() => strategies.filter((s) => showArchived || !s.archived).map((s) => { const ts = tradesForStrategy(all, s); return { s, stats: computeStats(ts), curve: equityCurve(ts).map((p) => p.equity) }; }), [strategies, all, showArchived]);
  const compared = rows.filter((r) => compare.includes(r.s.id));

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Strategy library" sub="Document each approach with clear criteria, then see how your recorded trades with it have gone." actions={<Button variant="accent" icon={<Plus size={15} />} onClick={() => setEditing(newStrategy())}>New strategy</Button>} />
      <PageVerse page="strategies" compact />

      {strategies.length === 0 ? (
        <EmptyState icon={<SquareLibrary size={18} />} title="No strategies documented yet" body="Write down your entry criteria, exits and invalidation so every trade can be measured against a plan." action={<Button variant="accent" onClick={() => setEditing(newStrategy())}>Document a strategy</Button>} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">Trades link to a strategy when selected in the editor, or when their setup name matches. Select up to four cards to compare.</p>
            <div className="w-56"><Toggle label="Show archived" checked={showArchived} onChange={setShowArchived} /></div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ s, stats, curve }) => {
              const on = compare.includes(s.id);
              return (
                <Card key={s.id} className={cx("flex flex-col transition-colors", on && "border-accent/50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/strategies/${s.id}`} className="block truncate text-[15px] font-semibold hover:text-accent">{s.name}</Link>
                      <p className="mt-0.5 text-xs text-muted">{[s.market, s.timeframe].filter(Boolean).join(" · ") || "No market or timeframe set"}</p>
                    </div>
                    {s.archived ? <Badge tone="muted"><Archive size={11} /> Archived</Badge> : <label className="flex items-center gap-1.5 text-xs text-text-2"><input type="checkbox" className="accent-[var(--accent)]" checked={on} disabled={!on && compare.length >= 4} onChange={() => setCompare(on ? compare.filter((x) => x !== s.id) : [...compare, s.id])} /> Compare</label>}
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[40px] text-[13px] text-text-2">{s.description || "No description."}</p>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
                    <div><p className="text-[11px] text-muted">Trades</p><p className="num text-[15px]">{stats.closed}</p></div>
                    <div><p className="text-[11px] text-muted">Win rate</p><p className="num text-[15px]">{fmtPct(stats.winRate, 0)}</p></div>
                    <div><p className="text-[11px] text-muted">Avg R</p><p className={cx("num text-[15px]", (stats.avgR ?? 0) > 0 ? "pos" : (stats.avgR ?? 0) < 0 ? "neg" : "")}>{fmtR(stats.avgR)}</p></div>
                  </div>
                  <div className="mt-3">{curve.length >= 2 ? <Sparkline data={curve} tone={stats.net >= 0 ? "pos" : "neg"} /> : <p className="h-9 text-xs leading-9 text-muted">Not enough journal data yet.</p>}</div>
                </Card>
              );
            })}
          </div>
          {compared.length >= 2 && (
            <Card>
              <SectionTitle title="Strategy comparison" sub="Recorded, closed trades only" action={<Button size="sm" variant="ghost" onClick={() => setCompare([])}>Clear</Button>} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead className="text-left text-xs text-muted"><tr><th className="py-2 font-medium">Measure</th>{compared.map((r) => <th key={r.s.id} className="py-2 text-right font-medium text-text">{r.s.name}</th>)}</tr></thead>
                  <tbody>
                    {([
                      ["Closed trades", (x: (typeof compared)[number]) => fmtNum(x.stats.closed, 0)],
                      ["Net", (x) => fmtMoney(x.stats.net, currency, { sign: true })],
                      ["Win rate", (x) => fmtPct(x.stats.winRate)],
                      ["Profit factor", (x) => fmtNum(x.stats.profitFactor)],
                      ["Average R", (x) => fmtR(x.stats.avgR)],
                      ["Average winner", (x) => fmtMoney(x.stats.avgWin, currency)],
                      ["Average loser", (x) => fmtMoney(x.stats.avgLoss, currency)],
                      ["Max drawdown", (x) => fmtMoney(x.stats.maxDD.amount, currency)],
                    ] as [string, (x: (typeof compared)[number]) => string][]).map(([label, f]) => (
                      <tr key={label} className="border-t border-line-soft"><td className="py-2 text-text-2">{label}</td>{compared.map((r) => <td key={r.s.id} className="num py-2 text-right">{f(r)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted">Strategies with fewer than 20 trades can differ by chance. This comparison describes your records and is not a recommendation.</p>
            </Card>
          )}
        </>
      )}
      {editing && <StrategyEditor initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
