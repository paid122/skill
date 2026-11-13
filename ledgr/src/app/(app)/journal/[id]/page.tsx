"use client";
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { MatrixxReview } from "@/components/matrixx";
import { ResultBadge, Stat } from "@/components/blocks";
import { Badge, Button, ButtonLink, Card, EmptyState, IconButton, Modal, SectionTitle, useFeedback } from "@/components/ui";
import { deleteTrade, duplicateTrade, patchTrade } from "@/lib/actions";
import { TRADE_REVIEW_PROMPT, buildTradeContext } from "@/lib/ai";
import { chronological } from "@/lib/calc";
import { useEnriched } from "@/lib/hooks";
import { openEditor } from "@/lib/overlays";
import { getState, useLedgr } from "@/lib/store";
import { cx, fmtDate, fmtMoney, fmtNum, fmtR, fmtTime } from "@/lib/util";

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const all = useEnriched();
  const { confirm, toast } = useFeedback();
  const ordered = useMemo(() => chronological(all), [all]);
  const idx = ordered.findIndex((x) => x.trade.id === id);
  const x = ordered[idx];
  const account = useLedgr((s) => s.accounts.find((a) => a.id === x?.trade.accountId) ?? null);
  const strategy = useLedgr((s) => s.strategies.find((a) => a.id === x?.trade.strategyId) ?? null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const byNumber = useMemo(() => new Map(all.map((y) => [y.trade.number, y.trade.id])), [all]);

  if (!x) {
    return <EmptyState title="Trade not found" body="It may have been deleted." action={<ButtonLink href="/journal">Back to journal</ButtonLink>} />;
  }
  const { trade: t, m } = x;
  const cur = account?.currency ?? "USD";
  const prev = ordered[idx - 1];
  const next = ordered[idx + 1];
  const images = [...t.attachments].sort((a, b) => ["before", "after", "additional"].indexOf(a.role) - ["before", "after", "additional"].indexOf(b.role));
  const hero = images.find((a) => a.role === "after") ?? images[0];

  const remove = async () => {
    if (await confirm({ title: `Delete trade #${t.number}?`, body: "This permanently removes the trade, its executions and attachments.", confirm: "Delete trade", danger: true })) {
      await deleteTrade(t.id);
      toast("Trade deleted");
      router.push("/journal");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/journal" className="inline-flex items-center gap-1.5 text-[13px] text-text-2 hover:text-text"><ArrowLeft size={14} /> Trade journal</Link>
        <div className="flex items-center gap-1">
          <IconButton label="Previous trade" disabled={!prev} onClick={() => prev && router.push(`/journal/${prev.trade.id}`)}><ChevronLeft size={16} /></IconButton>
          <IconButton label="Next trade" disabled={!next} onClick={() => next && router.push(`/journal/${next.trade.id}`)}><ChevronRight size={16} /></IconButton>
        </div>
      </div>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[28px] font-semibold tracking-tight">{t.symbol || "Untitled"}</h2>
            <span className="num text-lg text-muted">#{t.number}</span>
            {t.direction && <Badge tone={t.direction === "long" ? "pos" : "neg"}>{t.direction === "long" ? "Long" : "Short"}</Badge>}
            <ResultBadge x={x} />
            {t.showcase?.pinned && <Badge tone="accent">Showcased</Badge>}
          </div>
          <p className="mt-1 text-sm text-text-2">{fmtDate(t.date, "long")}{t.session ? ` · ${t.session}` : ""}{account ? ` · ${account.name}` : ""}{t.market ? ` · ${t.market}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={t.showcase?.pinned ? <PinOff size={14} /> : <Pin size={14} />} onClick={() => patchTrade(t.id, { showcase: { description: t.showcase?.description ?? "", background: t.showcase?.background ?? "ledger", pinned: !t.showcase?.pinned } }, t.showcase?.pinned ? "Removed from showcase" : "Pinned to showcase")}>{t.showcase?.pinned ? "Unpin" : "Pin to showcase"}</Button>
          <Button icon={<Copy size={14} />} onClick={() => { const nid = duplicateTrade(t.id); if (nid) { toast("Duplicated as draft"); router.push(`/journal/${nid}`); } }}>Duplicate</Button>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={remove}>Delete</Button>
          <Button variant="accent" icon={<Pencil size={14} />} onClick={() => openEditor(t.id)}>Edit trade</Button>
        </div>
      </header>

      {m.status !== "closed" && (
        <div className="rounded-xl border border-neutral/30 bg-neutral/5 px-4 py-3 text-[13px] text-text-2">
          {m.status === "draft"
            ? <>This record is a <span className="text-neutral">draft</span>{m.missing.length ? <> and still needs: {m.missing.join(", ")}</> : null}. It is excluded from statistics until completed. <button type="button" className="text-accent hover:underline" onClick={() => openEditor(t.id)}>Complete it</button></>
            : <>This position is <span className="text-text">open</span>: {fmtNum(m.exitQty, 4)} of {fmtNum(m.entryQty, 4)} units exited. It is excluded from statistics until fully closed.</>}
        </div>
      )}

      <Card className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Net result" value={fmtMoney(m.net, cur, { sign: true })} tone={m.status === "closed" ? m.net : null} />
        <Stat label="R multiple" value={fmtR(m.r)} tone={m.r} hint={m.risk ? `Risk ${fmtMoney(m.risk, cur)}` : "No stop or planned risk"} />
        <Stat label="Gross" value={fmtMoney(m.gross, cur)} />
        <Stat label="Fees" value={fmtMoney(m.totalFees, cur)} />
        <Stat label="Grade" value={t.grade ?? "—"} />
        <Stat label="Duration" value={m.durationMinutes === null ? "—" : m.durationMinutes >= 60 ? `${Math.floor(m.durationMinutes / 60)}h ${Math.round(m.durationMinutes % 60)}m` : `${Math.round(m.durationMinutes)} min`} />
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <SectionTitle title="Chart" sub={hero ? `${hero.role === "after" ? "After exit" : hero.role === "before" ? "Before entry" : "Additional"} · click to enlarge` : undefined} action={<Button size="sm" onClick={() => openEditor(t.id, "attachments")}>Manage images</Button>} />
            {hero ? (
              <button type="button" className="block w-full overflow-hidden rounded-xl border border-line-soft" onClick={() => setLightbox(hero.blobId)}>
                <BlobImage blobId={hero.blobId} alt={hero.name} className="aspect-video w-full" />
              </button>
            ) : (
              <EmptyState title="No chart images yet" body="Add before and after screenshots to review your decisions visually." action={<Button size="sm" onClick={() => openEditor(t.id, "attachments")}>Upload images</Button>} />
            )}
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((a) => (
                  <button key={a.id} type="button" onClick={() => setLightbox(a.blobId)} className="group overflow-hidden rounded-lg border border-line-soft text-left">
                    <BlobImage blobId={a.blobId} alt={a.name} className="aspect-video w-full transition-transform duration-200 group-hover:scale-[1.02]" />
                    <p className="truncate px-2 py-1 text-[11px] capitalize text-muted">{a.role}{a.annotation ? ` · ${a.annotation}` : ""}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle title="Entries & exits" sub={`Average entry ${fmtNum(m.avgEntry, 5)} · average exit ${fmtNum(m.avgExit, 5)}`} />
            {t.executions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-[13px]">
                  <thead className="text-left text-xs text-muted"><tr><th className="py-2 font-medium">Type</th><th className="py-2 font-medium">Time</th><th className="py-2 text-right font-medium">Price</th><th className="py-2 text-right font-medium">Quantity</th><th className="py-2 text-right font-medium">Fees</th></tr></thead>
                  <tbody>
                    {[...t.executions].sort((a, b) => a.time.localeCompare(b.time)).map((e) => (
                      <tr key={e.id} className="border-t border-line-soft">
                        <td className="py-2"><Badge tone={e.kind === "entry" ? "accent" : "default"}>{e.kind === "entry" ? "Entry" : "Exit"}</Badge></td>
                        <td className="py-2 text-text-2">{fmtDate(e.time, "day")} {fmtTime(e.time)}</td>
                        <td className="num py-2 text-right">{fmtNum(e.price, 5)}</td>
                        <td className="num py-2 text-right">{fmtNum(e.quantity, 4)}</td>
                        <td className="num py-2 text-right text-text-2">{fmtMoney(e.fees, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-[13px] text-muted">{t.manualNet !== null ? "Recorded with a net result only (no executions)." : "No executions recorded."}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line-soft pt-4 text-[13px] sm:grid-cols-4">
              <Stat label="Stop" value={fmtNum(t.stopPrice, 5)} />
              <Stat label="Target" value={fmtNum(t.targetPrice, 5)} />
              <Stat label="Point value" value={fmtNum(t.pointValue, 2)} />
              <Stat label="Planned risk" value={fmtMoney(t.plannedRisk, cur)} />
            </dl>
            <details className="mt-4 rounded-lg bg-bg-2/50 px-3 py-2 text-xs text-muted">
              <summary className="cursor-pointer text-text-2">How these figures are calculated</summary>
              <p className="mt-2 leading-relaxed">
                {t.executions.length
                  ? <>Gross = ({fmtNum(m.avgExit, 5)} − {fmtNum(m.avgEntry, 5)}) × {fmtNum(Math.min(m.exitQty, m.entryQty), 4)} × {fmtNum(t.pointValue, 2)}{t.direction === "short" ? " × −1 (short)" : ""} = {fmtMoney(m.gross, cur)}. Net = gross − fees {fmtMoney(m.totalFees, cur)} = {fmtMoney(m.net, cur)}.</>
                  : <>Net is the recorded result {fmtMoney(m.net, cur)}.</>}
                {m.r !== null && <> R = {fmtMoney(m.net, cur)} ÷ {fmtMoney(m.risk, cur)} = {fmtR(m.r)}.</>}
              </p>
            </details>
          </Card>

          <Card>
            <SectionTitle title="Execution notes" />
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2">
              <TextBlock label="Entry notes" text={t.entryNotes} />
              <TextBlock label="Exit notes" text={t.exitNotes} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <MatrixxReview
            title="MatrixX trade review"
            sub="Your coach's take on this trade"
            prompt={TRADE_REVIEW_PROMPT(t.number)}
            context={() => buildTradeContext(getState(), x, all).text}
            saved={t.aiReview}
            onSave={(r) => patchTrade(t.id, { aiReview: r }, "MatrixX reviewed this trade")}
            byNumber={byNumber}
            disabledReason={t.isDraft ? "Finish this draft first, then MatrixX can review it." : undefined}
          />
          <Card>
            <SectionTitle title="Setup" />
            <p className="text-[15px] text-text">{t.setup || <span className="text-muted">No setup recorded</span>}</p>
            {strategy && <Link href={`/strategies/${strategy.id}`} className="mt-1 inline-block text-[13px] text-accent hover:underline">View strategy: {strategy.name}</Link>}
            <p className="mb-2 mt-4 text-xs text-muted">Confluences</p>
            <div className="flex flex-wrap gap-1.5">{t.confluences.length ? t.confluences.map((c) => <Badge key={c}>{c}</Badge>) : <span className="text-[13px] text-muted">None recorded</span>}</div>
            {t.tags.length > 0 && <><p className="mb-2 mt-4 text-xs text-muted">Tags</p><div className="flex flex-wrap gap-1.5">{t.tags.map((c) => <Badge key={c} tone="muted">{c}</Badge>)}</div></>}
          </Card>

          <Card>
            <SectionTitle title="Psychology" />
            <div className="flex flex-wrap gap-1.5">{t.emotions.length ? t.emotions.map((e) => <Badge key={e} tone={["Calm", "Patient", "Confident"].includes(e) ? "pos" : ["Frustrated", "Impatient", "Distracted"].includes(e) ? "neg" : "default"}>{e}</Badge>) : <span className="text-[13px] text-muted">No emotions recorded</span>}</div>
            {t.emotionNote && <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-2">{t.emotionNote}</p>}
            <p className="mb-2 mt-4 text-xs text-muted">Documented mistakes</p>
            <div className="flex flex-wrap gap-1.5">{t.mistakes.length ? t.mistakes.map((e) => <Badge key={e} tone="neutral">{e}</Badge>) : <span className="text-[13px] text-muted">None documented</span>}</div>
          </Card>

          <Card>
            <SectionTitle title="Reflection" action={<Button size="sm" variant="ghost" onClick={() => openEditor(t.id, "reflection")}>Edit</Button>} />
            <div className="flex flex-col gap-4">
              <TextBlock label="What went well?" text={t.reflection.wentWell} />
              <TextBlock label="What could improve?" text={t.reflection.improve} />
              <div>
                <p className="text-xs text-muted">Did I follow my written plan?</p>
                <p className={cx("mt-1 text-[13.5px]", t.reflection.followedPlan === "yes" ? "pos" : t.reflection.followedPlan === "no" ? "neg" : t.reflection.followedPlan ? "neu" : "text-muted")}>{t.reflection.followedPlan === "yes" ? "Yes" : t.reflection.followedPlan === "partial" ? "Partly" : t.reflection.followedPlan === "no" ? "No" : "Not answered"}</p>
              </div>
              <TextBlock label="What did I learn?" text={t.reflection.learned} />
            </div>
          </Card>

          <Card>
            <SectionTitle title="History" />
            <ol className="relative flex flex-col gap-3 border-l border-line-soft pl-4">
              {[...t.activity].reverse().map((a, i) => (
                <li key={i} className="text-[13px]">
                  <span className="absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full border border-line bg-card-2" />
                  <p className="text-text-2">{a.message}</p>
                  <p className="text-xs text-muted">{fmtDate(a.at)} {fmtTime(a.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title={`${t.symbol} #${t.number}`} size="xl">
        {lightbox && <BlobImage blobId={lightbox} alt="Trade chart" className="max-h-[75vh] w-full object-contain" />}
        {lightbox && t.attachments.find((a) => a.blobId === lightbox)?.annotation && <p className="mt-3 text-[13px] text-text-2">{t.attachments.find((a) => a.blobId === lightbox)?.annotation}</p>}
      </Modal>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={cx("mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed", text ? "text-text" : "text-muted")}>{text || "Not written yet"}</p>
    </div>
  );
}
