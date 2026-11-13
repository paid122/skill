"use client";
import { Download, Film, Volume2, VolumeX, ImagePlus, Pin, PinOff, Plus, Trash2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BlobImage } from "@/components/BlobImage";
import { PageIntro } from "@/components/blocks";
import { FitWidth } from "@/components/FitWidth";
import { PosterCard } from "@/components/PosterCard";
import { CARD_THEMES, ShareSurface, themeColors } from "@/components/ShareCard";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Segmented, Textarea, Toggle, useFeedback } from "@/components/ui";
import { dayWindow, guessSource, pickWindow, timesUnknown, type Bar, type TradeChart } from "@/lib/candles";
import { PageVerse } from "@/components/VerseCard";
import { patchTrade } from "@/lib/actions";
import { fillTimes } from "@/lib/autoTimes";
import type { EnrichedTrade } from "@/lib/calc";
import { exportPng } from "@/lib/exporter";
import { exportCardVideo, MAX_EXPORT_SECONDS, recordingFormat } from "@/lib/videoExport";
import { useEnriched } from "@/lib/hooks";
import { deleteBlob, getState, putBlob, useLedgr, validateUpload } from "@/lib/store";
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
  const [privacy, setPrivacy] = useState<Privacy>({ amounts: true, account: false, image: true, reflection: true });
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

  // Real price chart, loaded automatically once per trade and saved with it (no button).
  // Trades logged without times get their times worked out from price data first.
  const [chartState, setChartState] = useState<"idle" | "loading" | "none">("idle");
  const tried = useRef<Set<string>>(new Set());
  const timesKey = t.executions.map((e) => e.time).join("|");
  useEffect(() => {
    setChartState("idle");
    if (layout !== "poster" || !t.symbol) return;
    const times = t.executions.map((e) => e.time);
    const unknown = timesUnknown(times);
    if (unknown && !tried.current.has(`fill:${t.id}`)) {
      tried.current.add(`fill:${t.id}`);
      setChartState("loading");
      void fillTimes(t.id).then((ok) => { if (!ok) setChartState("idle"); }); // success re-runs this effect with the new times
      return;
    }
    // Re-fetch once if a trade without times still has a short (non full-day) chart saved.
    const needsChart = !sc.chart?.bars.length || (unknown && sc.chart.interval !== "15m") || (!unknown && sc.chart.interval === "15m" && t.executions.some((e) => e.estimated));
    const key = `chart:${t.id}:${timesKey}`;
    if (!needsChart || tried.current.has(key)) return;
    const win = unknown ? dayWindow(times[0]) : pickWindow(times);
    if (!win) return;
    tried.current.add(key);
    const { provider, dataSymbol } = guessSource(t);
    const q = new URLSearchParams({ provider, symbol: dataSymbol, interval: win.interval, from: String(win.from), to: String(win.to) });
    let live = true;
    setChartState("loading");
    fetch(`/api/candles?${q}`)
      .then((r) => r.json())
      .then((j: { bars?: Bar[]; interval?: TradeChart["interval"] }) => {
        if (!live) return;
        if (!j.bars?.length) return setChartState("none");
        const cur = getState().trades.find((x) => x.id === t.id)?.showcase;
        if (!cur) return;
        patchTrade(t.id, { showcase: { ...cur, chart: { provider, dataSymbol, interval: j.interval ?? win.interval, bars: j.bars, fetchedAt: new Date().toISOString() } } });
        setChartState("idle");
      })
      .catch(() => { if (live) setChartState("none"); });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.id, layout, sc.chart?.bars.length, timesKey]);

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
  const removeMedia = async () => { if (media) await deleteBlob(media.blobId).catch(() => undefined); setShowcase({ media: null }); };

  // Video export: same length as the uploaded clip (capped at MAX_EXPORT_SECONDS).
  const [clipSeconds, setClipSeconds] = useState<number | null>(null);
  const [recording, setRecording] = useState<{ at: number; total: number } | null>(null);
  const [sound, setSound] = useState(true);
  // Preview sound: browsers only allow sound after a click, so it starts muted until the user turns it on.
  const [hear, setHear] = useState(false);
  useEffect(() => {
    const v = ref.current?.querySelector<HTMLVideoElement>("video[data-poster-video]");
    if (!v) return;
    v.muted = !hear;
    if (hear) { v.volume = 1; v.play().catch(() => setHear(false)); }
  }, [hear, media?.blobId, clipSeconds]);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    setClipSeconds(null);
    if (media?.kind !== "video") return;
    let tries = 0;
    const id = setInterval(() => {
      const v = ref.current?.querySelector<HTMLVideoElement>("video[data-poster-video]");
      if (v && Number.isFinite(v.duration) && v.duration > 0) { setClipSeconds(v.duration); clearInterval(id); }
      else if (++tries > 40) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [media?.kind, media?.blobId]);

  const exportVideo = async () => {
    const node = ref.current;
    const v = node?.querySelector<HTMLVideoElement>("video[data-poster-video]");
    if (!node || !v || !media) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRecording({ at: 0, total: Math.min(v.duration, MAX_EXPORT_SECONDS) });
    try {
      const { blob, ext } = await exportCardVideo({ card: node, videoUrl: v.src, dim: media.dim, blur: media.blur, sound, signal: ctrl.signal, onProgress: (at, total) => setRecording({ at, total }) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `ledgr-${t.symbol}-${t.number}.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast("Video exported");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast(e instanceof Error ? e.message : "Could not export the video", "error");
    }
    abortRef.current = null;
    setRecording(null);
  };

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
          <div className="relative">
            <FitWidth width={960} height={504}>
              <PosterCard ref={ref} trade={t} m={x.m} opts={{ amounts: privacy.amounts, account: privacy.account && account ? account.name : null, handle: handle.trim().slice(0, 30), currency: account?.currency ?? "USD" }} />
            </FitWidth>
            {media?.kind === "video" && (
              <button type="button" onClick={() => setHear(!hear)} aria-pressed={hear} aria-label={hear ? "Mute video" : "Play video sound"}
                className="absolute right-3 top-3 z-10 flex h-10 items-center gap-2 rounded-full bg-black/60 px-3.5 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/75">
                {hear ? <Volume2 size={16} /> : <VolumeX size={16} />}{hear ? "Sound on" : "Sound off"}
              </button>
            )}
          </div>
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
            <Field label="Your background" hint="Any image (PNG, JPEG, WebP, GIF up to 8 MB) or video (MP4, WebM, MOV up to 40 MB). Only use media you have the right to share.">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" icon={<ImagePlus size={14} />} onClick={() => fileRef.current?.click()}>{media ? "Replace" : "Upload image or video"}</Button>
                {media && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={removeMedia}>Remove</Button>}
                <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov" onChange={(e) => upload(e.target.files?.[0])} />
              </div>
              {uploadError && <p className="mt-2 text-xs text-neg">{uploadError}</p>}
            </Field>
          )}
          {layout === "poster" && chartState === "loading" && <p className="text-xs text-muted">Loading the price chart…</p>}
          {layout === "poster" && chartState === "none" && <p className="text-xs text-muted">Price history isn't available for this trade, so the card shows the line between your entry and exit.</p>}
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
            <Button variant="accent" icon={<Download size={14} />} onClick={exportCard} disabled={busy || !!recording}>{busy ? "Exporting…" : "Export PNG"}</Button>
            {layout === "poster" && media?.kind === "video" && (recording
              ? <Button icon={<X size={14} />} onClick={() => abortRef.current?.abort()}>Cancel · {Math.floor(recording.at)} / {Math.round(recording.total)} s</Button>
              : <Button icon={<Film size={14} />} onClick={exportVideo} disabled={busy || !clipSeconds || !recordingFormat()}>Export video{clipSeconds ? ` (${Math.round(Math.min(clipSeconds, MAX_EXPORT_SECONDS))} s)` : ""}</Button>)}
            <Button icon={<PinOff size={14} />} onClick={() => patchTrade(t.id, { showcase: { ...sc, pinned: false } }, "Removed from showcase")}>Unpin</Button>
          </div>
          {layout === "poster" && media?.kind === "video" && (
            <div className="grid gap-2">
              <Toggle label="Include video sound" description="Only in the exported video. The card itself plays muted." checked={sound} onChange={setSound} />
              {recording && <div className="h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(recording.at / recording.total) * 100}%` }} /></div>}
              <p className="text-xs text-muted">
                {recording ? "Recording in real time — keep this tab open." : `The video export is as long as your clip${clipSeconds && clipSeconds > MAX_EXPORT_SECONDS ? ` (up to ${MAX_EXPORT_SECONDS} s)` : ""}. PNG export uses the frame showing at that moment.`}
              </p>
            </div>
          )}
          {x.m.status !== "closed" && <Badge tone="neutral">This trade is not closed</Badge>}
        </div>
      </Card>
    </div>
  );
}
