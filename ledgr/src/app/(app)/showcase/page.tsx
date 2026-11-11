"use client";
import { Download, Pin, PinOff, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { PageIntro } from "@/components/blocks";
import { CARD_THEMES, ShareSurface, themeColors } from "@/components/ShareCard";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Textarea, Toggle, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { patchTrade } from "@/lib/actions";
import type { EnrichedTrade } from "@/lib/calc";
import { exportPng } from "@/lib/exporter";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { cx, fmtDate, fmtMoney, fmtR } from "@/lib/util";

interface Privacy { amounts: boolean; account: boolean; image: boolean; reflection: boolean }

export default function ShowcasePage() {
  const all = useEnriched();
  const pinned = useMemo(() => all.filter((x) => x.trade.showcase?.pinned), [all]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const selected = pinned.find((x) => x.trade.id === selectedId) ?? pinned[0] ?? null;
  const candidates = useMemo(() => all.filter((x) => x.m.status === "closed" && !x.trade.showcase?.pinned && (!q || x.trade.symbol.toLowerCase().includes(q.toLowerCase()) || x.trade.setup.toLowerCase().includes(q.toLowerCase()))).slice(-60).reverse(), [all, q]);

  const pin = (x: EnrichedTrade) => {
    patchTrade(x.trade.id, { showcase: { pinned: true, description: x.trade.showcase?.description ?? "", background: x.trade.showcase?.background ?? "ledger" } }, "Pinned to showcase");
    setSelectedId(x.trade.id);
    setAdding(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Showcase" sub="A gallery of trades worth remembering — for the process, not just the result. Create a shareable card from any of them." actions={<Button variant="accent" icon={<Plus size={15} />} onClick={() => setAdding(true)}>Add a trade</Button>} />
      <PageVerse page="showcase" compact />

      {pinned.length === 0 ? (
        <EmptyState icon={<Trophy size={18} />} title="No trades in your showcase yet" body="Pin a closed trade to describe what made it a good example of your process." action={<Button variant="accent" onClick={() => setAdding(true)}>Choose a trade</Button>} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card pad={false} className="overflow-hidden">
            <ul className="max-h-[70vh] divide-y divide-line-soft overflow-y-auto scroll-thin">
              {pinned.map((x) => (
                <li key={x.trade.id}>
                  <button type="button" onClick={() => setSelectedId(x.trade.id)} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", selected?.trade.id === x.trade.id ? "bg-card-2" : "hover:bg-card-2/50")}>
                    <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: themeColors(x.trade.showcase?.background ?? "ledger").bg, border: `1px solid ${themeColors(x.trade.showcase?.background ?? "ledger").line}` }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{x.trade.symbol} <span className="text-muted">#{x.trade.number}</span></span>
                      <span className="block truncate text-xs text-muted">{fmtDate(x.trade.date)} · {x.trade.setup || "No setup"}</span>
                    </span>
                    <span className={cx("num text-xs", (x.m.r ?? 0) >= 0 ? "pos" : "neg")}>{fmtR(x.m.r)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected && <Editor x={selected} key={selected.trade.id} />}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a trade to your showcase" size="lg">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by symbol or setup" className="mb-4" />
        {candidates.length === 0 ? <p className="py-6 text-center text-[13px] text-muted">No closed trades to add.</p> : (
          <ul className="divide-y divide-line-soft">
            {candidates.map((x) => (
              <li key={x.trade.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px]">{x.trade.symbol} <span className="text-muted">#{x.trade.number}</span> · <span className="text-text-2">{x.trade.setup || "No setup"}</span></span>
                  <span className="block text-xs text-muted">{fmtDate(x.trade.date)} · grade {x.trade.grade ?? "—"} · {fmtR(x.m.r)}</span>
                </span>
                <Button size="sm" icon={<Pin size={13} />} onClick={() => pin(x)}>Pin</Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function Editor({ x }: { x: EnrichedTrade }) {
  const t = x.trade;
  const account = useLedgr((s) => s.accounts.find((a) => a.id === t.accountId) ?? null);
  const [desc, setDesc] = useState(t.showcase?.description ?? "");
  const [privacy, setPrivacy] = useState<Privacy>({ amounts: false, account: false, image: true, reflection: true });
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useFeedback();
  const bg = t.showcase?.background ?? "ledger";
  const c = themeColors(bg);
  const image = t.attachments.find((a) => a.role === "after") ?? t.attachments[0];

  const exportCard = async () => {
    if (!ref.current) return;
    setBusy(true);
    try { await exportPng(ref.current, `ledgr-${t.symbol}-${t.number}`); toast("Card exported"); }
    catch { toast("Could not export the card", "error"); }
    setBusy(false);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-x-auto">
        <ShareSurface ref={ref} theme={bg} footer={`${fmtDate(t.date)} · Simulated record`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: c.accent }}>{t.setup || "Trade review"}</p>
              <p className="mt-2 text-[34px] font-semibold leading-none tracking-tight">{t.symbol}</p>
              <p className="mt-2 text-[13px]" style={{ color: c.sub }}>{t.direction === "long" ? "Long" : "Short"}{t.session ? ` · ${t.session}` : ""}{privacy.account && account ? ` · ${account.name}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[34px] font-medium leading-none" style={{ color: (x.m.r ?? x.m.net ?? 0) >= 0 ? c.pos : c.neg }}>{privacy.amounts ? fmtMoney(x.m.net, account?.currency ?? "USD", { sign: true }) : fmtR(x.m.r)}</p>
              <p className="mt-2 text-[12px]" style={{ color: c.sub }}>Grade {t.grade ?? "—"}{privacy.amounts && x.m.r !== null ? ` · ${fmtR(x.m.r)}` : ""}</p>
            </div>
          </div>
          {privacy.image && image && <div className="mt-6 overflow-hidden rounded-xl" style={{ border: `1px solid ${c.line}` }}><BlobImage blobId={image.blobId} alt="Trade chart" className="aspect-video w-full" /></div>}
          {desc && <p className="mt-6 text-[15px] leading-relaxed">{desc}</p>}
          {privacy.reflection && t.reflection.learned && (
            <div className="mt-5 pl-4" style={{ borderLeft: `2px solid ${c.accent}` }}>
              <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: c.sub }}>Lesson</p>
              <p className="mt-1 text-[14px] leading-relaxed" style={{ fontFamily: "Newsreader, Georgia, serif" }}>{t.reflection.learned}</p>
            </div>
          )}
          {t.confluences.length > 0 && <div className="mt-5 flex flex-wrap gap-1.5">{t.confluences.map((cf) => <span key={cf} className="rounded-md px-2 py-0.5 text-[11px]" style={{ border: `1px solid ${c.line}`, color: c.sub }}>{cf}</span>)}</div>}
        </ShareSurface>
      </div>

      <Card>
        <SectionTitle title="Card settings" action={<Link href={`/journal/${t.id}`} className="text-[13px] text-text-2 hover:text-text">Open trade</Link>} />
        <div className="grid gap-4">
          <Field label="Description" hint="Saved with the trade">
            <Textarea value={desc} maxLength={400} onChange={(e) => setDesc(e.target.value)} onBlur={() => patchTrade(t.id, { showcase: { ...t.showcase!, description: desc } })} placeholder="What made this a good example of your process?" />
          </Field>
          <Field label="Background">
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(CARD_THEMES).map(([k, v]) => (
                <button key={k} type="button" aria-label={v.name} aria-pressed={bg === k} onClick={() => patchTrade(t.id, { showcase: { ...t.showcase!, background: k } })} className={cx("aspect-square rounded-lg border-2 transition-colors", bg === k ? "border-accent" : "border-transparent")} style={{ background: v.gradient ? `${v.gradient}, ${v.bg}` : v.bg, outline: `1px solid ${v.line}` }} title={v.name} />
              ))}
            </div>
          </Field>
          <div className="grid gap-3 border-t border-line-soft pt-4">
            <p className="text-xs text-muted">Privacy — off by default. Only what you enable appears on the card.</p>
            <Toggle label="Show currency amount" description="Otherwise only R is shown" checked={privacy.amounts} onChange={(v) => setPrivacy({ ...privacy, amounts: v })} />
            <Toggle label="Show account name" checked={privacy.account} onChange={(v) => setPrivacy({ ...privacy, account: v })} />
            <Toggle label="Include chart image" checked={privacy.image} onChange={(v) => setPrivacy({ ...privacy, image: v })} />
            <Toggle label="Include lesson" checked={privacy.reflection} onChange={(v) => setPrivacy({ ...privacy, reflection: v })} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
            <Button variant="accent" icon={<Download size={14} />} onClick={exportCard} disabled={busy}>{busy ? "Exporting…" : "Export PNG"}</Button>
            <Button icon={<PinOff size={14} />} onClick={() => patchTrade(t.id, { showcase: { ...t.showcase!, pinned: false } }, "Removed from showcase")}>Unpin</Button>
          </div>
          {x.m.status !== "closed" && <Badge tone="neutral">This trade is not closed</Badge>}
        </div>
      </Card>
    </div>
  );
}

