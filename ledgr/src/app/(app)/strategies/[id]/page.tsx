"use client";
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { RecentTrades, Stat } from "@/components/blocks";
import { CompareBars, EquityChart } from "@/components/charts";
import { StrategyEditor } from "@/components/StrategyEditor";
import { Badge, Button, ButtonLink, Card, EmptyState, NotEnoughData, SectionTitle, useFeedback } from "@/components/ui";
import { deleteStrategy, saveStrategy } from "@/lib/actions";
import { computeStats, equityCurve, groupStats, tradesForStrategy } from "@/lib/calc";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { fmtMoney, fmtNum, fmtPct, fmtR } from "@/lib/util";

export default function StrategyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const s = useLedgr((st) => st.strategies.find((x) => x.id === id) ?? null);
  const currency = useLedgr((st) => st.settings.baseCurrency);
  const all = useEnriched();
  const { confirm, toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const trades = useMemo(() => (s ? tradesForStrategy(all, s) : []), [all, s]);
  const stats = useMemo(() => computeStats(trades), [trades]);
  const curve = useMemo(() => equityCurve(trades).map((p, i) => ({ label: `${i + 1}`, date: p.date, value: p.equity, net: p.net })), [trades]);
  const byConf = useMemo(() => groupStats(trades, (x) => x.trade.confluences).map((g) => ({ label: g.key, value: g.stats.avgR ?? 0, n: g.stats.closed, extra: `${fmtPct(g.stats.winRate, 0)} win` })).filter((r) => r.n > 0), [trades]);

  if (!s) return <EmptyState title="Strategy not found" action={<ButtonLink href="/strategies">Back to strategies</ButtonLink>} />;
  const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/strategies" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text"><ArrowLeft size={14} /> Strategy library</Link>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-[26px] font-semibold tracking-tight">{s.name}</h2>{s.archived && <Badge tone="muted">Archived</Badge>}</div>
          <p className="mt-1 text-sm text-text-2">{[s.market, s.timeframe].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={s.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} onClick={() => saveStrategy({ ...s, archived: !s.archived })}>{s.archived ? "Restore" : "Archive"}</Button>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={async () => { if (await confirm({ title: `Delete ${s.name}?`, body: "Linked trades keep their setup name but lose the link.", confirm: "Delete strategy", danger: true })) { deleteStrategy(s.id); toast("Strategy deleted"); router.push("/strategies"); } }}>Delete</Button>
          <Button variant="accent" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit</Button>
        </div>
      </header>

      <Card className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Closed trades" value={fmtNum(stats.closed, 0)} />
        <Stat label="Net" value={fmtMoney(stats.net, currency, { sign: true })} tone={stats.net} />
        <Stat label="Win rate" value={fmtPct(stats.winRate)} />
        <Stat label="Profit factor" value={fmtNum(stats.profitFactor)} />
        <Stat label="Average R" value={fmtR(stats.avgR)} tone={stats.avgR} />
        <Stat label="Max drawdown" value={fmtMoney(stats.maxDD.amount, currency)} />
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Definition" />
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-text">{s.description || <span className="text-muted">No description.</span>}</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Criteria title="Entry criteria" items={lines(s.entryCriteria)} />
              <Criteria title="Exit criteria" items={lines(s.exitCriteria)} />
            </div>
            <div className="mt-5"><p className="mb-1.5 text-xs text-muted">Invalidation</p><p className="whitespace-pre-wrap text-[13.5px] text-text-2">{s.invalidation || "—"}</p></div>
            <div className="mt-5"><p className="mb-1.5 text-xs text-muted">Confluences</p><div className="flex flex-wrap gap-1.5">{s.confluences.length ? s.confluences.map((c) => <Badge key={c}>{c}</Badge>) : <span className="text-[13px] text-muted">None</span>}</div></div>
            {s.notes && <div className="mt-5"><p className="mb-1.5 text-xs text-muted">Notes</p><p className="whitespace-pre-wrap text-[13.5px] text-text-2">{s.notes}</p></div>}
          </Card>
          {s.screenshots.length > 0 && (
            <Card><SectionTitle title="Screenshots" /><div className="grid grid-cols-2 gap-2">{s.screenshots.map((ss) => <BlobImage key={ss.id} blobId={ss.blobId} alt={ss.name} className="aspect-video w-full rounded-lg" />)}</div></Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Equity with this strategy" sub="Recorded trades linked to it" />
            {curve.length >= 2 ? <EquityChart data={curve} currency={currency} height={240} /> : <NotEnoughData />}
          </Card>
          <Card>
            <SectionTitle title="Average R by recorded confluence" />
            {byConf.length ? <CompareBars data={byConf} format={(v) => fmtR(v)} valueLabel="Average R" /> : <NotEnoughData note="Record confluences on linked trades." />}
          </Card>
          <Card>
            <SectionTitle title="Linked trades" action={<Link href={`/journal?setup=${encodeURIComponent(s.name)}`} className="text-[13px] text-text-2 hover:text-text">Open in journal</Link>} />
            <RecentTrades list={trades} currency={currency} limit={10} />
          </Card>
        </div>
      </div>
      {editing && <StrategyEditor initial={s} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Criteria({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs text-muted">{title}</p>
      {items.length ? <ol className="flex flex-col gap-1.5">{items.map((c, i) => <li key={i} className="flex gap-2 text-[13.5px]"><span className="num text-muted">{i + 1}.</span><span>{c}</span></li>)}</ol> : <p className="text-[13px] text-muted">Not written yet.</p>}
    </div>
  );
}
