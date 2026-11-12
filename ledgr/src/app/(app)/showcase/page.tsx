"use client";
import { CandlestickChart, Download, ImagePlus, Pin, PinOff, Plus, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { PageIntro } from "@/components/blocks";
import { FitWidth } from "@/components/FitWidth";
import { PosterCard } from "@/components/PosterCard";
import { CARD_THEMES, ShareSurface, themeColors } from "@/components/ShareCard";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Segmented, Select, Textarea, Toggle, useFeedback } from "@/components/ui";
import { guessSource, pickWindow, PROVIDERS, type Bar, type CandleProvider } from "@/lib/candles";
import { PageVerse } from "@/components/VerseCard";
import { patchTrade } from "@/lib/actions";
import type { EnrichedTrade } from "@/lib/calc";
import { exportPng } from "@/lib/exporter";
import { useEnriched } from "@/lib/hooks";
import { deleteBlob, putBlob, useLedgr, validateUpload } from "@/lib/store";
import { cx, fmtDate, fmtMoney, fmtR, uid } from "@/lib/util";

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
  const displayName = useLedgr((s) => s.settings.displayName);
  const [desc, setDesc] = useState(t.showcase?.description ?? "");
  const [privacy, setPrivacy] = useState<Privacy>({ amounts: false, account: false, image: true, reflection: true });
  const [handle, setHandle] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useFeedback();
  const sc = t.showcase!;
  const bg = sc.background ?? "ledger";
  const layout = sc.layout ?? "poster";
  const media = sc.media ?? null;
  const c = themeColors(bg);
  const image = t.attachments.find((a) => a.role === "after") ?? t.attachments[0];
  const setShowcase = (p: Partial<NonNullable<typeof t.showcase>>) => patchTrade(t.id, { showcase: { ...sc, ...p } });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateUpload(file, ["image", "video"]);
    if (problem) { setUploadError(problem); return; }
    setUploadError(null);
    const blobId = uid("blob");
    await putBlob(blobId, file);
    if (media) await deleteBlob(media.blobId).catch(() => undefined);
    setShowcase({ layout: "poster", media: { blobId, kind: file.type.startsWith("video/") ? "video" : "image", dim: media?.dim ?? 0.45, blur: media?.blur ?? 0 } });
    if (fileRef.current) fileRef.current.value = "";
  };
  const iconRef = useRef<HTMLInputElement>(null);
  const uploadIcon = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateUpload(file, ["image"]);
    if (problem) { setUploadError(problem); return; }
    if (file.size > 2 * 1024 * 1024) { setUploadError("Icon must be under 2 MB."); return; }
    setUploadError(null);
    const blobId = uid("blob");
    await putBlob(blobId, file);
    if (sc.icon) await deleteBlob(sc.icon).catch(() => undefined);
    setShowcase({ icon: blobId });
    if (iconRef.current) iconRef.current.value = "";
  };
  const removeIcon = async () => { if (sc.icon) await deleteBlob(sc.icon).catch(() => undefined); setShowcase({ icon: null }); };
  const removeMedia = async () => { if (media) await deleteBlob(media.blobId).catch(() => undefined); setShowcase({ media: null }); };

  const exportCard = async () => {
    const node = ref.current;
    if (!node) return;
    setBusy(true);
    // Videos can't be captured directly: freeze the current frame as an image for the export.
    const swaps: (() => void)[] = [];
    node.querySelectorAll<HTMLVideoElement>("video[data-poster-video]").forEach((v) => {
      try {
        if (!v.videoWidth) return; // no decoded frame yet; export falls back to the dark overlay
        const cv = document.createElement("canvas");
        cv.width = v.videoWidth; cv.height = v.videoHeight;
        cv.getContext("2d")!.drawImage(v, 0, 0);
        const img = document.createElement("img");
        img.src = cv.toDataURL("image/jpeg", 0.92);
        img.className = v.className;
        img.setAttribute("style", v.getAttribute("style") ?? "");
        v.after(img);
        swaps.push(() => img.remove());
      } catch { /* leave it; videos are excluded from the export itself */ }
    });
    try { await new Promise((r) => setTimeout(r, 60)); await exportPng(node, `ledgr-${t.symbol}-${t.number}`); toast("Card exported"); }
    catch { toast("Could not export the card", "error"); }
    swaps.forEach((f) => f());
    setBusy(false);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-x-auto pb-2">
        {layout === "poster" ? (
          <FitWidth width={960} height={504}>
            <PosterCard ref={ref} trade={t} m={x.m} opts={{ amounts: privacy.amounts, account: privacy.account && account ? account.name : null, handle: handle.trim().slice(0, 30), currency: account?.currency ?? "USD" }} />
          </FitWidth>
        ) : (
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
        )}
      </div>

      <Card>
        <SectionTitle title="Card settings" action={<Link href={`/journal/${t.id}`} className="text-[13px] text-text-2 hover:text-text">Open trade</Link>} />
        <div className="grid gap-4">
          <Field label="Layout">
            <Segmented value={layout} onChange={(v) => setShowcase({ layout: v })} options={[{ value: "poster", label: "Poster" }, { value: "classic", label: "Classic" }]} ariaLabel="Card layout" />
          </Field>
          {layout === "poster" && (
            <Field label="Your background" hint="Your own image or short video (MP4/WebM, up to 40 MB). Only use media you have the right to share.">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" icon={<ImagePlus size={14} />} onClick={() => fileRef.current?.click()}>{media ? "Replace" : "Upload image or video"}</Button>
                {media && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={removeMedia}>Remove</Button>}
                <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" onChange={(e) => upload(e.target.files?.[0])} />
              </div>
              {uploadError && <p className="mt-2 text-xs text-neg">{uploadError}</p>}
            </Field>
          )}
          {layout === "poster" && (
            <Field label="Market icon" hint={sc.icon ? "Your uploaded icon." : "The symbol's logo when one is available (company, index owner, coin or flags), otherwise a drawn badge. Upload your own square image to replace it."}>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" icon={<ImagePlus size={14} />} onClick={() => iconRef.current?.click()}>{sc.icon ? "Replace icon" : "Upload icon"}</Button>
                {sc.icon && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={removeIcon}>Use default</Button>}
                <input ref={iconRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => uploadIcon(e.target.files?.[0])} aria-label="Upload market icon" />
              </div>
            </Field>
          )}
          {layout === "poster" && <ChartSource key={t.id} x={x} onSave={(chart) => setShowcase({ chart })} />}
          {layout === "poster" && media && (
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs text-text-2">Darkness<input type="range" min={0.1} max={0.85} step={0.05} value={media.dim} onChange={(e) => setShowcase({ media: { ...media, dim: Number(e.target.value) } })} className="mt-2 w-full accent-[var(--accent)]" /></label>
              <label className="text-xs text-text-2">Blur<input type="range" min={0} max={14} step={1} value={media.blur} onChange={(e) => setShowcase({ media: { ...media, blur: Number(e.target.value) } })} className="mt-2 w-full accent-[var(--accent)]" /></label>
            </div>
          )}
          {(layout === "classic" || !media) && (
            <Field label="Theme">
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(CARD_THEMES).map(([k, v]) => (
                  <button key={k} type="button" aria-label={v.name} aria-pressed={bg === k} onClick={() => setShowcase({ background: k })} className={cx("aspect-square rounded-lg border-2 transition-colors", bg === k ? "border-accent" : "border-transparent")} style={{ background: v.gradient ? `${v.gradient}, ${v.bg}` : v.bg, outline: `1px solid ${v.line}` }} title={v.name} />
                ))}
              </div>
            </Field>
          )}
          {layout === "poster" && <Field label="Name on the card"><Input value={handle} maxLength={30} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname" /></Field>}
          {layout === "classic" && (
            <Field label="Description" hint="Saved with the trade">
              <Textarea value={desc} maxLength={400} onChange={(e) => setDesc(e.target.value)} onBlur={() => setShowcase({ description: desc })} placeholder="What made this a good example of your process?" />
            </Field>
          )}
          <div className="grid gap-3 border-t border-line-soft pt-4">
            <p className="text-xs text-muted">Privacy — off by default. Only what you enable appears on the card.</p>
            <Toggle label="Show currency amount" description="Otherwise only R is shown" checked={privacy.amounts} onChange={(v) => setPrivacy({ ...privacy, amounts: v })} />
            <Toggle label="Show account name" checked={privacy.account} onChange={(v) => setPrivacy({ ...privacy, account: v })} />
            {layout === "classic" && <Toggle label="Include chart image" checked={privacy.image} onChange={(v) => setPrivacy({ ...privacy, image: v })} />}
            {layout === "classic" && <Toggle label="Include lesson" checked={privacy.reflection} onChange={(v) => setPrivacy({ ...privacy, reflection: v })} />}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
            <Button variant="accent" icon={<Download size={14} />} onClick={exportCard} disabled={busy}>{busy ? "Exporting…" : "Export PNG"}</Button>
            <Button icon={<PinOff size={14} />} onClick={() => patchTrade(t.id, { showcase: { ...sc, pinned: false } }, "Removed from showcase")}>Unpin</Button>
          </div>
          {media?.kind === "video" && <p className="text-xs text-muted">PNG export uses the video frame showing at that moment.</p>}
          {x.m.status !== "closed" && <Badge tone="neutral">This trade is not closed</Badge>}
        </div>
      </Card>
    </div>
  );
}

type ProviderStatus = Record<CandleProvider, { configured: boolean }>;

/** Load real candles for the trade from a market-data provider and save them on the card. */
function ChartSource({ x, onSave }: { x: EnrichedTrade; onSave: (chart: NonNullable<NonNullable<EnrichedTrade["trade"]["showcase"]>["chart"]> | null) => void }) {
  const t = x.trade;
  const saved = t.showcase?.chart ?? null;
  const guess = useMemo(() => guessSource(t), [t]);
  const [provider, setProvider] = useState<CandleProvider>(saved?.provider ?? guess.provider);
  const [symbol, setSymbol] = useState(saved?.dataSymbol ?? guess.dataSymbol);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/candles").then((r) => r.json()).then((j) => live && setStatus(j.providers)).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const win = pickWindow(t.executions.map((e) => e.time));
  const needsKey = status && !status[provider].configured ? PROVIDERS[provider].env : null;

  const load = async () => {
    if (!win) return;
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams({ provider, symbol: symbol.trim(), interval: win.interval, from: String(win.from), to: String(win.to) });
      const r = await fetch(`/api/candles?${q}`);
      const j = (await r.json()) as { bars?: Bar[]; interval?: typeof win.interval; error?: string };
      if (!r.ok || !j.bars) throw new Error(j.error || "Could not load candles.");
      onSave({ provider, dataSymbol: symbol.trim(), interval: j.interval ?? win.interval, bars: j.bars, fetchedAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load candles.");
    }
    setLoading(false);
  };

  return (
    <Field label="Price chart" hint={saved ? `Showing ${saved.bars.length} × ${saved.interval} prices from ${PROVIDERS[saved.provider].name}, saved with the trade.` : "The real price line around your entry and exit. Without it the card shows a line joining your fills."}>
      <div className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-2">
          <Select aria-label="Data source" value={provider} onChange={(e) => { const p = e.target.value as CandleProvider; setProvider(p); if (p === guess.provider) setSymbol(guess.dataSymbol); setError(null); }}>
            {(Object.keys(PROVIDERS) as CandleProvider[]).map((p) => <option key={p} value={p}>{PROVIDERS[p].name}{status && !status[p].configured ? " · key needed" : ""}</option>)}
          </Select>
          <Input aria-label="Data symbol" value={symbol} maxLength={32} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol" />
        </div>
        <p className="text-xs text-muted">{PROVIDERS[provider].covers}{provider === "databento" ? " · NQ.v.0 = most-traded contract, or a contract like NQZ6" : provider === "yahoo" ? " · e.g. MNQ=F, EURUSD=X, AAPL, ^NDX" : ""}</p>
        {needsKey && <p className="text-xs text-text-2">Needs an API key from {PROVIDERS[provider].site}: add <code className="font-mono">{needsKey}=…</code> to <code className="font-mono">.env.local</code>, then restart Ledgr. The key stays on your computer&apos;s server, never in the browser.</p>}
        {!win && <p className="text-xs text-muted">Add execution times to this trade to load a chart.</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<CandlestickChart size={14} />} onClick={load} disabled={loading || !win || !symbol.trim() || !!needsKey}>{loading ? "Loading…" : saved ? "Reload chart" : "Load price chart"}</Button>
          {saved && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => onSave(null)}>Remove chart</Button>}
        </div>
        {error && <p className="text-xs text-neg" role="alert">{error}</p>}
      </div>
    </Field>
  );
}
