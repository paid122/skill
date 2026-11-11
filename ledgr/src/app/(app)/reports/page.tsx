"use client";
import { Download, FileDown, Save, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { PageIntro } from "@/components/blocks";
import { CARD_THEMES, MiniCurve, ShareSurface, themeColors } from "@/components/ShareCard";
import { Button, Card, Field, IconButton, Input, SectionTitle, Segmented, Select, Textarea, Toggle, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { deleteReport, saveReport } from "@/lib/actions";
import { chronological, closedOnly, computeStats, disciplineScore, equityCurve, tradesForStrategy, type EnrichedTrade } from "@/lib/calc";
import { exportPdf, exportPng } from "@/lib/exporter";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import type { ReportDoc } from "@/lib/types";
import { addDays, cx, fmtDate, fmtMoney, fmtNum, fmtPct, fmtR, monthKey, nowISO, today, uid, weekStart } from "@/lib/util";

const TYPES: { value: ReportDoc["type"]; label: string }[] = [
  { value: "trade", label: "Trade card" }, { value: "daily", label: "Daily summary" }, { value: "weekly", label: "Weekly recap" },
  { value: "monthly", label: "Monthly recap" }, { value: "strategy", label: "Strategy report" }, { value: "overview", label: "Performance overview" },
];
const STATS: { key: string; label: string }[] = [
  { key: "net", label: "Net P&L" }, { key: "trades", label: "Closed trades" }, { key: "winRate", label: "Win rate" }, { key: "avgR", label: "Average R" },
  { key: "pf", label: "Profit factor" }, { key: "dd", label: "Max drawdown" }, { key: "avgWin", label: "Average winner" }, { key: "avgLoss", label: "Average loser" }, { key: "discipline", label: "Discipline score" },
];

function blank(): ReportDoc {
  return { id: uid("rpt"), name: "Weekly recap", type: "weekly", theme: "ledger", refId: weekStart(today()), stats: ["net", "trades", "winRate", "avgR", "discipline"], reflection: "", font: "sans", showLogo: true, showChart: true, createdAt: nowISO() };
}

export default function ReportsPage() {
  const all = useEnriched();
  const saved = useLedgr((s) => s.reports);
  const strategies = useLedgr((s) => s.strategies);
  const journals = useLedgr((s) => s.dailyJournals);
  const currency = useLedgr((s) => s.settings.baseCurrency);
  const [r, setR] = useState<ReportDoc>(blank);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast, confirm } = useFeedback();
  const set = (p: Partial<ReportDoc>) => setR((x) => ({ ...x, ...p }));

  const setType = (type: ReportDoc["type"]) => {
    const defaults: Record<ReportDoc["type"], string | null> = {
      trade: chronological(closedOnly(all)).slice(-1)[0]?.trade.id ?? null, daily: today(), weekly: weekStart(today()), monthly: monthKey(today()), strategy: strategies[0]?.id ?? null, overview: null,
    };
    set({ type, refId: defaults[type], name: TYPES.find((t) => t.value === type)!.label });
  };

  const scope = useMemo((): { list: EnrichedTrade[]; title: string; subtitle: string } => {
    switch (r.type) {
      case "trade": { const x = all.find((y) => y.trade.id === r.refId); return { list: x ? [x] : [], title: x ? `${x.trade.symbol} ${x.trade.direction === "short" ? "short" : "long"}` : "Choose a trade", subtitle: x ? `Trade #${x.trade.number} · ${fmtDate(x.trade.date)}` : "" }; }
      case "daily": return { list: all.filter((x) => x.trade.date === r.refId), title: "Daily summary", subtitle: fmtDate(r.refId ?? today(), "long") };
      case "weekly": { const ws = r.refId ?? weekStart(today()); return { list: all.filter((x) => x.trade.date >= ws && x.trade.date <= addDays(ws, 6)), title: "Weekly recap", subtitle: `${fmtDate(ws)} – ${fmtDate(addDays(ws, 6))}` }; }
      case "monthly": return { list: all.filter((x) => monthKey(x.trade.date) === r.refId), title: "Monthly recap", subtitle: new Date(`${r.refId ?? monthKey(today())}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
      case "strategy": { const s = strategies.find((y) => y.id === r.refId); return { list: s ? tradesForStrategy(all, s) : [], title: s?.name ?? "Choose a strategy", subtitle: s ? [s.market, s.timeframe].filter(Boolean).join(" · ") || "Strategy report" : "" }; }
      default: return { list: all, title: "Performance overview", subtitle: `All records to ${fmtDate(today())}` };
    }
  }, [r.type, r.refId, all, strategies]);

  const stats = computeStats(scope.list);
  const disc = disciplineScore(scope.list.map((x) => x.trade), journals);
  const curve = equityCurve(scope.list).map((p) => p.equity);
  const c = themeColors(r.theme);
  const value = (k: string): { v: string; tone?: number | null } => {
    switch (k) {
      case "net": return { v: fmtMoney(stats.net, currency, { sign: true }), tone: stats.net };
      case "trades": return { v: fmtNum(stats.closed, 0) };
      case "winRate": return { v: fmtPct(stats.winRate) };
      case "avgR": return { v: fmtR(stats.avgR), tone: stats.avgR };
      case "pf": return { v: stats.profitFactor === null ? "—" : fmtNum(stats.profitFactor) };
      case "dd": return { v: fmtMoney(stats.maxDD.amount, currency) };
      case "avgWin": return { v: fmtMoney(stats.avgWin, currency) };
      case "avgLoss": return { v: fmtMoney(stats.avgLoss, currency) };
      default: return { v: disc.score === null ? "—" : fmtNum(disc.score, 0) };
    }
  };
  const trade = r.type === "trade" ? scope.list[0] : null;
  const image = trade?.trade.attachments.find((a) => a.role === "after") ?? trade?.trade.attachments[0];

  const doExport = async (kind: "png" | "pdf") => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const name = `ledgr-${r.type}-${(r.refId ?? "all").replace(/[^\w-]/g, "")}`;
      if (kind === "png") await exportPng(ref.current, name); else await exportPdf(ref.current, name);
      toast(`Exported ${kind.toUpperCase()}`);
    } catch { toast("Export failed", "error"); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Reports" sub="Shareable summaries built only from your saved records. Choose what to include — nothing private is added unless you select it." />
      <PageVerse page="reports" compact />

      <div className="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Build" />
            <div className="grid gap-4">
              <Field label="Report type"><Select value={r.type} onChange={(e) => setType(e.target.value as ReportDoc["type"])}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
              {r.type === "trade" && <Field label="Trade"><Select value={r.refId ?? ""} onChange={(e) => set({ refId: e.target.value })}>{chronological(closedOnly(all)).reverse().slice(0, 200).map((x) => <option key={x.trade.id} value={x.trade.id}>#{x.trade.number} {x.trade.symbol} · {x.trade.date}</option>)}</Select></Field>}
              {r.type === "daily" && <Field label="Date"><Input type="date" value={r.refId ?? ""} onChange={(e) => set({ refId: e.target.value })} /></Field>}
              {r.type === "weekly" && <Field label="Week containing"><Input type="date" value={r.refId ?? ""} onChange={(e) => e.target.value && set({ refId: weekStart(e.target.value) })} /></Field>}
              {r.type === "monthly" && <Field label="Month"><Input type="month" value={r.refId ?? ""} onChange={(e) => set({ refId: e.target.value })} /></Field>}
              {r.type === "strategy" && <Field label="Strategy"><Select value={r.refId ?? ""} onChange={(e) => set({ refId: e.target.value })}><option value="">Choose…</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
              <Field label="Theme">
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(CARD_THEMES).map(([k, v]) => <button key={k} type="button" title={v.name} aria-label={v.name} aria-pressed={r.theme === k} onClick={() => set({ theme: k })} className={cx("aspect-square rounded-lg border-2", r.theme === k ? "border-accent" : "border-transparent")} style={{ background: v.gradient ? `${v.gradient}, ${v.bg}` : v.bg, outline: `1px solid ${v.line}` }} />)}
                </div>
              </Field>
              <Field label="Typography"><Segmented value={r.font} onChange={(font) => set({ font })} options={[{ value: "sans", label: "Modern sans" }, { value: "serif", label: "Editorial serif" }]} /></Field>
              <Field label="Statistics">
                <div className="grid grid-cols-2 gap-1.5">
                  {STATS.map((s) => <label key={s.key} className="flex items-center gap-2 text-[13px] text-text-2"><input type="checkbox" className="accent-[var(--accent)]" checked={r.stats.includes(s.key)} onChange={() => set({ stats: r.stats.includes(s.key) ? r.stats.filter((x) => x !== s.key) : [...r.stats, s.key] })} />{s.label}</label>)}
                </div>
              </Field>
              <Toggle label="Equity chart" checked={r.showChart} onChange={(v) => set({ showChart: v })} />
              <Toggle label="Ledgr logo" checked={r.showLogo} onChange={(v) => set({ showLogo: v })} />
              <Field label="Personal reflection"><Textarea value={r.reflection} maxLength={600} onChange={(e) => set({ reflection: e.target.value })} placeholder="What did this period teach you?" /></Field>
              <Field label="Report name"><Input value={r.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" icon={<Download size={14} />} disabled={busy} onClick={() => doExport("png")}>PNG</Button>
                <Button icon={<FileDown size={14} />} disabled={busy} onClick={() => doExport("pdf")}>PDF</Button>
                <Button variant="ghost" icon={<Save size={14} />} onClick={() => { saveReport({ ...r, name: r.name.trim() || "Untitled report" }); toast("Report saved"); }}>Save</Button>
              </div>
            </div>
          </Card>
          {saved.length > 0 && (
            <Card>
              <SectionTitle title="Saved reports" />
              <ul className="flex flex-col">
                {[...saved].reverse().map((s) => (
                  <li key={s.id} className="group flex items-center">
                    <button type="button" onClick={() => setR(s)} className={cx("min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-[13px]", s.id === r.id ? "text-accent" : "text-text-2 hover:text-text")}>{s.name} <span className="text-muted">· {TYPES.find((t) => t.value === s.type)?.label}</span></button>
                    <IconButton label="Delete report" className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={async () => { if (await confirm({ title: `Delete “${s.name}”?`, confirm: "Delete", danger: true })) deleteReport(s.id); }}><Trash2 size={12} /></IconButton>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="overflow-x-auto pb-2">
          <ShareSurface ref={ref} theme={r.theme} font={r.font} width={720} showLogo={r.showLogo} footer={`Generated ${fmtDate(today())} from saved journal records · Simulated results`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: c.accent }}>{TYPES.find((t) => t.value === r.type)?.label}</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">{scope.title}</h2>
            <p className="mt-1 text-[13px]" style={{ color: c.sub }}>{scope.subtitle}</p>
            {scope.list.length === 0 ? (
              <p className="mt-8 text-[14px]" style={{ color: c.sub }}>No saved records for this selection.</p>
            ) : (
              <>
                {r.stats.length > 0 && (
                  <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-xl" style={{ background: c.line, border: `1px solid ${c.line}` }}>
                    {r.stats.map((k) => { const { v, tone } = value(k); return (
                      <div key={k} className="px-4 py-3.5" style={{ background: c.bg }}>
                        <p className="text-[11px]" style={{ color: c.sub }}>{STATS.find((s) => s.key === k)?.label}</p>
                        <p className="mt-1 font-mono text-[19px]" style={{ color: tone ? (tone > 0 ? c.pos : c.neg) : c.fg }}>{v}</p>
                      </div>
                    ); })}
                  </div>
                )}
                {r.showChart && curve.length >= 2 && <div className="mt-6"><MiniCurve values={curve} color={curve[curve.length - 1] >= 0 ? c.pos : c.neg} line={c.line} height={110} /></div>}
                {r.showChart && image && <div className="mt-6 overflow-hidden rounded-xl" style={{ border: `1px solid ${c.line}` }}><BlobImage blobId={image.blobId} alt="Trade chart" className="aspect-video w-full" /></div>}
                {trade && (trade.trade.setup || trade.trade.reflection.learned) && (
                  <div className="mt-6 grid gap-3 text-[13.5px]">
                    {trade.trade.setup && <p><span style={{ color: c.sub }}>Setup · </span>{trade.trade.setup}</p>}
                    {trade.trade.reflection.learned && <p><span style={{ color: c.sub }}>Lesson · </span>{trade.trade.reflection.learned}</p>}
                  </div>
                )}
                {stats.excludedDrafts + stats.excludedOpen > 0 && <p className="mt-4 text-[11px]" style={{ color: c.sub }}>{stats.excludedDrafts + stats.excludedOpen} incomplete record(s) excluded.</p>}
              </>
            )}
            {r.reflection && (
              <div className="mt-7 pl-4" style={{ borderLeft: `2px solid ${c.accent}` }}>
                <p className="text-[15px] leading-relaxed" style={{ fontFamily: "Newsreader, Georgia, serif" }}>{r.reflection}</p>
              </div>
            )}
          </ShareSurface>
        </div>
      </div>
    </div>
  );
}
