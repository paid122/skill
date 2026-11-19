"use client";
/**
 * "My picks": the trader's saved backgrounds for share cards (P&L cards and recaps).
 * Upload several at once; tap one to use it; remove any. Files are kept while a card still uses them.
 */
import { Check, ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { updateSettings } from "@/lib/actions";
import { deleteBlob, getBlob, getState, putBlob, useLedgr, validateUpload } from "@/lib/store";
import { cx, uid } from "@/lib/util";
import { useBlobUrl } from "./BlobImage";

export type Pick = { blobId: string; kind: "image" | "video" };

/** LEDGR's built-in picks (the owner's own clips, with their sound), shown to everyone ahead of their own. */
export const BUILTIN_PICKS = [
  { id: "lp_night-drive-v2", name: "Night drive", src: "/picks/night-drive.mp4?v=2", poster: "/picks/night-drive.jpg" },
  { id: "lp_markets-v2", name: "Markets", src: "/picks/markets.mp4?v=2", poster: "/picks/markets.jpg" },
  { id: "lp_sunset-v2", name: "Sunset", src: "/picks/sunset.mp4?v=2", poster: "/picks/sunset.jpg" },
] as const;
export const isBuiltinPick = (id: string) => id.startsWith("lp_");

/** Copies a built-in pick into this device's files (once), so cards and exports use it like any upload. */
export async function loadBuiltinPick(b: (typeof BUILTIN_PICKS)[number]): Promise<Pick> {
  if (!(await getBlob(b.id).catch(() => undefined))) {
    const blob = await (await fetch(b.src)).blob();
    await putBlob(b.id, blob);
  }
  return { blobId: b.id, kind: "video" };
}

/** True when the blob is still used by a card or the recap, so removing the pick must keep the file. */
function inUse(id: string) {
  const s = getState();
  return s.trades.some((x) => x.showcase?.media?.blobId === id) || s.settings.recapMedia?.blobId === id;
}

export function MediaPicks({ activeId, onPick }: { activeId: string | null; onPick: (p: Pick) => void }) {
  const picks = useLedgr((s) => s.settings.pnlPicks) ?? [];
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null); setBusy(true);
    const added: Pick[] = [];
    for (const f of Array.from(files)) {
      const problem = validateUpload(f, ["image", "video"]);
      if (problem) { setErr(problem); continue; }
      const blobId = uid("pick");
      await putBlob(blobId, f);
      added.push({ blobId, kind: f.type.startsWith("video/") || /\.mov$/i.test(f.name) ? "video" : "image" });
    }
    if (added.length) {
      updateSettings({ pnlPicks: [...added, ...(getState().settings.pnlPicks ?? [])] });
      onPick(added[0]);
    }
    setBusy(false);
    if (file.current) file.current.value = "";
  };
  const remove = (id: string) => {
    updateSettings({ pnlPicks: picks.filter((x) => x.blobId !== id) });
    if (!inUse(id)) deleteBlob(id).catch(() => undefined);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BUILTIN_PICKS.map((b) => (
          <div key={b.id} className={cx("group relative aspect-video overflow-hidden rounded-xl border-2 bg-bg-2 transition-colors", activeId === b.id ? "border-accent" : "border-line-soft hover:border-line")}>
            <button type="button" aria-pressed={activeId === b.id} aria-label={`Use ${b.name}`} disabled={loading === b.id}
              onClick={async () => { setLoading(b.id); setErr(null); try { onPick(await loadBuiltinPick(b)); } catch { setErr(`Couldn't load ${b.name}. Check your connection and try again.`); } setLoading(null); }}
              className="absolute inset-0">
              <video src={b.src} poster={b.poster} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
            </button>
            <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[12px] font-medium text-white backdrop-blur">{loading === b.id ? "Loading…" : b.name}</span>
            {activeId === b.id && <span className="pointer-events-none absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-on-accent"><Check size={12} /></span>}
          </div>
        ))}
        {picks.map((p, i) => <PickThumb key={p.blobId} pick={p} n={i + 1} active={activeId === p.blobId} onPick={() => onPick(p)} onRemove={() => remove(p.blobId)} />)}
        <button type="button" disabled={busy} onClick={() => file.current?.click()} className="flex aspect-video flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line text-[13px] font-medium text-text-2 transition-colors hover:border-text-2 hover:text-text disabled:opacity-60">
          <ImagePlus size={20} />{busy ? "Saving…" : "Add"}
        </button>
      </div>
      <input ref={file} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov" onChange={(e) => upload(e.target.files)} />
      {err && <p className="mt-2 text-xs text-neg">{err}</p>}
    </div>
  );
}

function PickThumb({ pick, n, active, onPick, onRemove }: { pick: Pick; n: number; active: boolean; onPick: () => void; onRemove: () => void }) {
  const { url, missing } = useBlobUrl(pick.blobId);
  return (
    <div className={cx("group relative aspect-video overflow-hidden rounded-xl border-2 bg-bg-2 transition-colors", active ? "border-accent" : "border-line-soft hover:border-line")}>
      <button type="button" onClick={onPick} aria-pressed={active} aria-label={`Use pick ${n}`} className="absolute inset-0">
        {url && (pick.kind === "video"
          ? <video src={url} autoPlay muted loop playsInline className="h-full w-full object-cover" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={url} alt="" className="h-full w-full object-cover" />)}
        {missing && <span className="grid h-full place-items-center text-[11px] text-muted">Not on this device</span>}
      </button>
      {active && <span className="pointer-events-none absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-on-accent"><Check size={12} /></span>}
      <button type="button" onClick={onRemove} aria-label={`Remove pick ${n}`} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"><X size={12} /></button>
    </div>
  );
}
