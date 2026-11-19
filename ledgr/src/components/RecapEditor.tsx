"use client";
import { CalendarRange, Download, Film, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FitWidth } from "@/components/FitWidth";
import { finishCountUp } from "@/components/PosterCard";
import { RECAP_FORMATS, RecapCard, recapSize, recapValue, type RecapFormat } from "@/components/RecapCard";
import { Button, Card, EmptyState, Field, Input, SectionTitle, Segmented, Select, Toggle, useFeedback } from "@/components/ui";
import { isPick, updateSettings } from "@/lib/actions";
import { exportPng } from "@/lib/exporter";
import { freezeVideosForExport } from "@/lib/freezeVideo";
import { useEnriched } from "@/lib/hooks";
import { buildRecap, periodEnd, recapPeriods, type RecapKind } from "@/lib/recap";
import { deleteBlob, useLedgr } from "@/lib/store";
import { BUILTIN_PICKS, loadBuiltinPick, MediaPicks } from "./MediaPicks";
import { parseISODate } from "@/lib/util";
import { exportCardVideo, MAX_EXPORT_SECONDS, recordingFormat } from "@/lib/videoExport";

function periodLabel(kind: RecapKind, start: string) {
  const d = parseISODate(start);
  if (kind === "month") return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const e = parseISODate(periodEnd("week", start));
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

/** Weekly and monthly recap cards: pick a period, add your own background, export a PNG or a video. */
export function RecapEditor({ kind }: { kind: RecapKind }) {
  const all = useEnriched();
  const accounts = useLedgr((s) => s.accounts);
  const settings = useLedgr((s) => s.settings);
  const media = settings.recapMedia ?? null;
  const [accountId, setAccountId] = useState<string>("all");
  const [amounts, setAmounts] = useState(true);
  const [format, setFormat] = useState<RecapFormat>(kind === "week" ? "wide" : "square");
  const [handle, setHandle] = useState(settings.displayName);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState<{ at: number; total: number } | null>(null);
  const [sound, setSound] = useState(true);
  // Preview sound: browsers only allow sound after a click, so the card starts muted until you turn it on.
  const [hear, setHear] = useState(false);
  const [clipSeconds, setClipSeconds] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useFeedback();

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const currency = account?.currency ?? settings.baseCurrency ?? "USD";
  const trades = useMemo(() => (accountId === "all" ? all : all.filter((x) => x.trade.accountId === accountId)), [all, accountId]);
  const periods = useMemo(() => recapPeriods(trades, kind, amounts), [trades, kind, amounts]);
  const start = picked && periods.includes(picked) ? picked : periods[0] ?? null;
  const recap = useMemo(() => (start ? buildRecap(trades, kind, start, amounts) : null), [trades, kind, start, amounts]);
  const opts = { amounts, currency, handle: handle.trim().slice(0, 30), avatar: settings.avatar ?? null, media };

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
  }, [media?.kind, media?.blobId, start, format]);

  useEffect(() => {
    const v = ref.current?.querySelector<HTMLVideoElement>("video[data-poster-video]");
    if (!v) return;
    v.muted = !hear;
    if (hear) { v.volume = 1; v.play().catch(() => setHear(false)); }
  }, [hear, media?.blobId, clipSeconds, format, start]);

  const applyPick = (p: { blobId: string; kind: "image" | "video" }) => {
    if (media && media.blobId !== p.blobId && !isPick(media.blobId)) deleteBlob(media.blobId).catch(() => undefined);
    updateSettings({ recapNoBackground: false, recapMedia: { blobId: p.blobId, kind: p.kind, dim: media?.dim ?? 0.4, blur: media?.blur ?? 0, fit: media?.fit } });
  };
  // Recaps with no background start on your first pick, or LEDGR's first built-in pick.
  const defaulted = useRef(false);
  useEffect(() => {
    if (defaulted.current || media || settings.recapNoBackground) return;
    defaulted.current = true;
    const mine = settings.pnlPicks ?? [];
    if (mine.length) applyPick(mine[0]);
    else void loadBuiltinPick(BUILTIN_PICKS[0]).then(applyPick).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const removeMedia = async () => { if (media && !isPick(media.blobId)) await deleteBlob(media.blobId).catch(() => undefined); updateSettings({ recapMedia: null, recapNoBackground: true }); };

  const fileName = start ? `ledgr-${kind === "week" ? "week" : "month"}-${start}-${format === "wide" ? "16x9" : format === "story" ? "9x16" : "square"}` : "ledgr-recap";
  const exportCard = async () => {
    const node = ref.current;
    if (!node) return;
    finishCountUp(node);
    setBusy(true);
    const unfreeze = freezeVideosForExport(node);
    try { await new Promise((r) => setTimeout(r, 60)); await exportPng(node, fileName); toast("Card exported"); }
    catch { toast("Could not export the card", "error"); }
    unfreeze();
    setBusy(false);
  };
  const exportVideo = async () => {
    const node = ref.current;
    const v = node?.querySelector<HTMLVideoElement>("video[data-poster-video]");
    if (!node || !v || !media || !recap) return;
    finishCountUp(node);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRecording({ at: 0, total: Math.min(v.duration, MAX_EXPORT_SECONDS) });
    try {
      const { blob, ext } = await exportCardVideo({ card: node, videoUrl: v.src, dim: media.dim, blur: media.blur, fit: media.fit ?? "contain", shade: "even", sound, countUp: (q) => recapValue(recap.total, { amounts, currency }, q), signal: ctrl.signal, onProgress: (at, total) => setRecording({ at, total }) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${fileName}.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast("Video exported");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast(e instanceof Error ? e.message : "Could not export the video", "error");
    } finally { setRecording(null); abortRef.current = null; }
  };

  if (!recap) {
    return <EmptyState icon={<CalendarRange size={18} />} title={`No closed trades to recap yet`} body={`Close a trade and your ${kind === "week" ? "weekly" : "monthly"} recap card appears here.`} />;
  }
  const size = recapSize(kind, format);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto w-full" style={{ maxWidth: size.width }}>
        <div className="relative">
          <FitWidth width={size.width} height={size.height}>
            <RecapCard ref={ref} recap={recap} opts={opts} format={format} key={format} />
          </FitWidth>
          {media?.kind === "video" && (
            <button type="button" onClick={() => setHear(!hear)} aria-pressed={hear} aria-label={hear ? "Mute video" : "Play video sound"}
              className="absolute right-3 top-3 z-10 flex h-10 items-center gap-2 rounded-full bg-black/60 px-3.5 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/75">
              {hear ? <Volume2 size={16} /> : <VolumeX size={16} />}{hear ? "Sound on" : "Sound off"}
            </button>
          )}
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-text">My picks</p>
            {media && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={removeMedia}>No background</Button>}
          </div>
          <MediaPicks activeId={media?.blobId ?? null} onPick={applyPick} />
        </div>
      </div>

      <Card>
        <SectionTitle title={kind === "week" ? "Weekly recap" : "Monthly recap"} />
        <div className="grid gap-4">
          <Field label={kind === "week" ? "Week" : "Month"}>
            <Select value={start ?? ""} onChange={(e) => setPicked(e.target.value)}>
              {periods.map((p) => <option key={p} value={p}>{periodLabel(kind, p)}</option>)}
            </Select>
          </Field>
          <Field label="Size" hint={RECAP_FORMATS.find((f) => f.value === format)?.hint}>
            <Segmented value={format} onChange={setFormat} options={RECAP_FORMATS.map((f) => ({ value: f.value, label: f.label }))} ariaLabel="Card size" />
          </Field>
          {accounts.length > 1 && (
            <Field label="Account">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="all">All accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          )}
          {media && (
            <Field label="Picture" hint={(media.fit ?? "contain") === "contain" ? "Shows your whole picture, with a blurred copy filling the space around it" : "Zooms the picture to fill the card (the edges get cut off)"}>
              <Segmented value={media.fit ?? "contain"} onChange={(v) => updateSettings({ recapMedia: { ...media, fit: v } })} options={[{ value: "contain", label: "Fit (whole picture)" }, { value: "cover", label: "Fill" }]} ariaLabel="Background picture" />
            </Field>
          )}
          {media && (
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs text-text-2">Darkness<input type="range" min={0.1} max={0.85} step={0.05} value={media.dim} onChange={(e) => updateSettings({ recapMedia: { ...media, dim: Number(e.target.value) } })} className="mt-2 w-full accent-[var(--accent)]" /></label>
              <label className="text-xs text-text-2">Blur<input type="range" min={0} max={14} step={1} value={media.blur} onChange={(e) => updateSettings({ recapMedia: { ...media, blur: Number(e.target.value) } })} className="mt-2 w-full accent-[var(--accent)]" /></label>
            </div>
          )}
          <Field label="Name on the card"><Input value={handle} maxLength={30} onChange={(e) => setHandle(e.target.value)} placeholder="@yourname" /></Field>
          <div className="grid gap-3 border-t border-line-soft pt-4">
            <Toggle label="Show currency amounts" description="Otherwise results are shown in R" checked={amounts} onChange={setAmounts} />
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
            <Button variant="accent" icon={<Download size={14} />} onClick={exportCard} disabled={busy || !!recording}>{busy ? "Exporting…" : "Export PNG"}</Button>
            {media?.kind === "video" && (recording
              ? <Button icon={<X size={14} />} onClick={() => abortRef.current?.abort()}>Cancel · {Math.floor(recording.at)} / {Math.round(recording.total)} s</Button>
              : <Button icon={<Film size={14} />} onClick={exportVideo} disabled={busy || !clipSeconds || !recordingFormat()}>Export video{clipSeconds ? ` (${Math.round(Math.min(clipSeconds, MAX_EXPORT_SECONDS))} s)` : ""}</Button>)}
          </div>
          {media?.kind === "video" && (
            <div className="grid gap-2">
              <Toggle label="Include video sound" description="Keeps your clip's sound in the exported video." checked={sound} onChange={setSound} />
              {recording && <div className="h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(recording.at / recording.total) * 100}%` }} /></div>}
              <p className="text-xs text-muted">{recording ? "Recording in real time — keep this tab open." : "The video is as long as your clip. The amount counts up and the chart draws in at the start."}</p>
            </div>
          )}
          <p className="text-xs text-muted">Totals include closed trades only, by journal date. Not financial advice.</p>
        </div>
      </Card>
    </div>
  );
}
