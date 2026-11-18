"use client";
import { Check, Film, ImagePlus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useBlobUrl } from "@/components/BlobImage";
import { Live, LIVE_WALLPAPERS } from "@/components/Wallpaper";
import { ALLOWED_VIDEO_TYPES, deleteBlob, MAX_VIDEO_BYTES, putBlob } from "@/lib/store";
import { useRef, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { SettingsNav } from "@/components/SettingsNav";
import { Button, Card, Field, IconButton, Input, SectionTitle, Segmented, Select, useFeedback } from "@/components/ui";
import { updateAppearance } from "@/lib/actions";
import { defaultAppearance } from "@/lib/defaults";
import { useLedgr } from "@/lib/store";
import type { Appearance, ThemeName, Wallpaper } from "@/lib/types";
import { contrast, cx, fmtMoney, isHex, uid } from "@/lib/util";

const THEMES: { value: ThemeName; name: string; bg: string; card: string; text: string; sub: string }[] = [
  { value: "midnight", name: "Midnight", bg: "#050505", card: "#0F0F0F", text: "#F5F5F5", sub: "#A3A3A3" },
  { value: "onyx", name: "Onyx", bg: "#000000", card: "#0A0A0A", text: "#FFFFFF", sub: "#A8A8A8" },
  { value: "platinum", name: "Platinum", bg: "#18181A", card: "#222225", text: "#F6F6F7", sub: "#BDBDC2" },
  { value: "light", name: "Light", bg: "#FFFFFF", card: "#FFFFFF", text: "#0A0A0A", sub: "#525252" },
];
const ACCENTS = ["#FFFFFF", "#D4D4D4", "#A3A3A3", "#0A0A0A", "#404040", "#3987E5", "#3FBF7F"];
const MIN_CONTRAST = 3; // WCAG non-text / large-text minimum against the card surface

export default function AppearancePage() {
  const a = useLedgr((s) => s.settings.appearance);
  const { toast, confirm } = useFeedback();
  const [accentText, setAccentText] = useState(a.accent);
  const [error, setError] = useState<string | null>(null);
  const [themeName, setThemeName] = useState("");
  const bgFile = useRef<HTMLInputElement>(null);
  const card = THEMES.find((t) => t.value === a.theme)!.card;

  /** Applies a colour only if it stays readable on the current theme's card surface. */
  const trySet = (patch: Partial<Appearance>, label: string, color: string, theme = a.theme) => {
    if (!isHex(color)) { setError(`${label}: enter a hex colour such as #FFFFFF.`); return false; }
    const surface = THEMES.find((t) => t.value === theme)!.card;
    const ratio = contrast(color, surface);
    if (ratio < MIN_CONTRAST) { setError(`${label} ${color} has ${ratio.toFixed(2)}:1 contrast on this theme. Choose a colour with at least ${MIN_CONTRAST}:1 so it stays readable.`); return false; }
    setError(null);
    updateAppearance(patch);
    return true;
  };

  const setTheme = (theme: ThemeName) => {
    const surface = THEMES.find((t) => t.value === theme)!.card;
    const patch: Partial<Appearance> = { theme };
    // Keep the accent readable when switching themes.
    if (contrast(a.accent, surface) < MIN_CONTRAST) { patch.accent = theme === "light" ? "#0A0A0A" : defaultAppearance.accent; setAccentText(patch.accent); }
    if (contrast(a.positiveColor, surface) < MIN_CONTRAST) patch.positiveColor = defaultAppearance.positiveColor;
    if (contrast(a.negativeColor, surface) < MIN_CONTRAST) patch.negativeColor = defaultAppearance.negativeColor;
    updateAppearance(patch);
  };

  const uploadBg = (f: File | undefined) => {
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) { setError("Background must be PNG, JPEG or WebP."); return; }
    if (f.size > 1.5 * 1024 * 1024) { setError("Background image must be under 1.5 MB."); return; }
    const r = new FileReader();
    r.onload = () => { updateAppearance({ backgroundImage: r.result as string }); setError(null); };
    r.readAsDataURL(f);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Appearance" sub="Make Ledgr feel like yours. Colour choices are checked so text and charts stay readable." actions={<Button variant="ghost" icon={<RotateCcw size={14} />} onClick={async () => { if (await confirm({ title: "Reset appearance to defaults?", confirm: "Reset" })) { updateAppearance({ ...defaultAppearance, savedThemes: a.savedThemes }); setAccentText(defaultAppearance.accent); toast("Appearance reset"); } }}>Reset to default</Button>} />
      <SettingsNav />
      {error && <p role="alert" className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}

      <Card>
        <SectionTitle title="Theme" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {THEMES.map((t) => (
            <button key={t.value} type="button" onClick={() => setTheme(t.value)} aria-pressed={a.theme === t.value} className={cx("overflow-hidden rounded-xl border-2 text-left transition-colors", a.theme === t.value ? "border-accent" : "border-line-soft hover:border-line")}>
              <div className="p-3" style={{ background: t.bg }}>
                <div className="rounded-lg p-3" style={{ background: t.card }}>
                  <div className="h-2 w-12 rounded" style={{ background: t.text }} />
                  <div className="mt-2 h-1.5 w-20 rounded" style={{ background: t.sub, opacity: 0.6 }} />
                  <div className="mt-3 h-1.5 w-8 rounded" style={{ background: a.accent }} />
                </div>
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-[13px]">{t.name}{a.theme === t.value && <Check size={14} className="text-accent" />}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Colour" />
          <div className="grid gap-5">
            <Field label="Accent colour" hint={`Contrast on this theme: ${contrast(a.accent, card).toFixed(2)}:1`}>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENTS.map((c) => <button key={c} type="button" aria-label={`Accent ${c}`} aria-pressed={a.accent === c} onClick={() => { if (trySet({ accent: c }, "Accent", c)) setAccentText(c); }} className={cx("h-8 w-8 rounded-full border-2", a.accent === c ? "border-text" : "border-transparent")} style={{ background: c }} />)}
                <Input value={accentText} onChange={(e) => setAccentText(e.target.value)} onBlur={() => trySet({ accent: accentText }, "Accent", accentText)} onKeyDown={(e) => e.key === "Enter" && trySet({ accent: accentText }, "Accent", accentText)} className="h-8 w-28 font-mono text-xs" aria-label="Custom accent hex" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Positive (gains)" value={a.positiveColor} onCommit={(c) => trySet({ positiveColor: c }, "Positive colour", c)} />
              <ColorField label="Negative (losses)" value={a.negativeColor} onCommit={(c) => trySet({ negativeColor: c }, "Negative colour", c)} />
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-bg-2/60 px-3 py-2 text-[13px]"><span className="text-muted">Preview</span><span className="num pos">{fmtMoney(1240.5, "USD", { sign: true })}</span><span className="num neg">{fmtMoney(-380.25, "USD")}</span><span className="text-accent">Accent</span></div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Layout & type" />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <Field label="Font"><Select value={a.font} onChange={(e) => updateAppearance({ font: e.target.value as Appearance["font"] })}><option value="inter">Inter</option><option value="system">System interface</option><option value="serif-accent">Inter with serif headings</option></Select></Field>
            <Field label="Number format"><Select value={a.numberFormat} onChange={(e) => updateAppearance({ numberFormat: e.target.value as Appearance["numberFormat"] })}><option value="en-US">1,234.56 (US)</option><option value="en-GB">1,234.56 (UK)</option><option value="de-DE">1.234,56 (DE)</option><option value="fr-FR">1 234,56 (FR)</option></Select></Field>
            <Field label="Card density"><Segmented value={a.density} onChange={(density) => updateAppearance({ density })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></Field>
            <Field label="Cursor" hint="Ring adds a trailing ring and dot; your normal cursor stays."><Segmented value={a.cursor ?? "system"} onChange={(cursor) => updateAppearance({ cursor })} options={[{ value: "system", label: "Standard" }, { value: "ring", label: "Ring" }]} /></Field>
            <Field label="Navigation"><Segmented value={a.nav ?? "top"} onChange={(nav) => updateAppearance({ nav })} options={[{ value: "top", label: "Top bar" }, { value: "side", label: "Sidebar" }]} /></Field>
            <Field label="Sidebar style"><Segmented value={a.sidebar} onChange={(sidebar) => updateAppearance({ sidebar })} options={[{ value: "solid", label: "Solid" }, { value: "translucent", label: "Translucent" }]} /></Field>
            <Field label="Background image" hint="Shown faintly behind pages. Opacity is capped to protect readability." className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" icon={<ImagePlus size={14} />} onClick={() => bgFile.current?.click()}>{a.backgroundImage ? "Replace" : "Upload"}</Button>
                <input ref={bgFile} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { uploadBg(e.target.files?.[0]); e.target.value = ""; }} />
                {a.backgroundImage && <>
                  <label className="flex items-center gap-2 text-xs text-text-2">Opacity<input type="range" min={0.03} max={0.3} step={0.01} value={a.backgroundOpacity} onChange={(e) => updateAppearance({ backgroundOpacity: Number(e.target.value) })} className="accent-[var(--accent)]" /></label>
                  <Button size="sm" variant="ghost" onClick={() => updateAppearance({ backgroundImage: "" })}>Remove</Button>
                </>}
              </div>
            </Field>
          </div>
        </Card>
      </div>

      <WallpaperCard />

      <Card>
        <SectionTitle title="Saved themes" sub="Save the current combination to switch back to it later." />
        <div className="flex flex-wrap gap-2">
          <Input value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Theme name" maxLength={30} className="max-w-xs" />
          <Button icon={<Save size={14} />} disabled={!themeName.trim()} onClick={() => { const { savedThemes, ...values } = a; updateAppearance({ savedThemes: [...savedThemes, { id: uid("thm"), name: themeName.trim(), values }] }); setThemeName(""); toast("Theme saved"); }}>Save current</Button>
        </div>
        {a.savedThemes.length > 0 && (
          <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {a.savedThemes.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-line-soft px-3 py-2">
                <span className="h-6 w-6 rounded-full" style={{ background: THEMES.find((x) => x.value === t.values.theme)?.bg, border: `3px solid ${t.values.accent}` }} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{t.name}</span>
                <Button size="sm" onClick={() => { updateAppearance({ ...t.values }); setAccentText(t.values.accent); toast(`Applied ${t.name}`); }}>Apply</Button>
                <IconButton label={`Delete ${t.name}`} onClick={() => updateAppearance({ savedThemes: a.savedThemes.filter((x) => x.id !== t.id) })}><Trash2 size={13} /></IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit: (c: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={isHex(v) && v.length === 7 ? v : value} onChange={(e) => { setV(e.target.value); onCommit(e.target.value); }} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" aria-label={`${label} picker`} />
        <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onCommit(v)} className="h-8 font-mono text-xs" aria-label={`${label} hex`} />
      </div>
    </Field>
  );
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Live wallpapers, or the trader's own video or image, behind the whole app. */
function WallpaperCard() {
  const w = useLedgr((s) => s.settings.appearance.wallpaper) ?? defaultAppearance.wallpaper!;
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { url } = useBlobUrl(w.blobId);
  const set = (patch: Partial<Wallpaper>) => updateAppearance({ wallpaper: { ...w, ...patch } });

  const upload = async (f: File | undefined) => {
    if (!f) return;
    const video = ALLOWED_VIDEO_TYPES.includes(f.type), image = IMAGE_TYPES.includes(f.type);
    if (!video && !image) { setErr("Use an MP4, WebM or MOV video, or a PNG, JPEG, WebP or GIF image."); return; }
    if (f.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) { setErr(video ? `Videos must be under ${MAX_VIDEO_BYTES / 1024 / 1024} MB. Trim it or export at 1080p.` : "Images must be under 10 MB."); return; }
    setBusy(true); setErr(null);
    try {
      const id = uid("wp");
      await putBlob(id, f);
      const old = w.blobId;
      set({ kind: video ? "video" : "image", blobId: id, blobKind: video ? "video" : "image" });
      if (old) deleteBlob(old).catch(() => undefined);
    } catch { setErr("Couldn't save that file on this device. Try a smaller one."); }
    setBusy(false);
  };

  const Tile = ({ on, onClick, label, sub, children }: { on: boolean; onClick: () => void; label: string; sub: string; children: React.ReactNode }) => (
    <button type="button" onClick={onClick} aria-pressed={on} className={cx("group overflow-hidden rounded-xl border-2 text-left transition-all duration-200", on ? "border-accent" : "border-line-soft hover:-translate-y-0.5 hover:border-line")}>
      <div className="relative aspect-video overflow-hidden bg-bg-2">{children}</div>
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <span className="min-w-0"><span className="block truncate text-[13px] text-text">{label}</span><span className="block truncate text-[11.5px] text-muted">{sub}</span></span>
        {on && <Check size={14} className="mt-0.5 shrink-0 text-accent" />}
      </div>
    </button>
  );

  return (
    <Card>
      <SectionTitle title="Wallpaper" sub="A live wallpaper or your own video behind LEDGR. Dim and blur keep your numbers readable." />
      {err && <p role="alert" className="mb-3 rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{err}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile on={w.kind === "none"} onClick={() => set({ kind: "none" })} label="None" sub="Plain theme background"><div className="absolute inset-0 bg-bg" /></Tile>
        {LIVE_WALLPAPERS.map((l) => (
          <Tile key={l.value} on={w.kind === "live" && w.live === l.value} onClick={() => set({ kind: "live", live: l.value })} label={l.name} sub={`Live · ${l.sub}`}><Live kind={l.value} /></Tile>
        ))}
        <Tile on={w.kind === "video" || w.kind === "image"} onClick={() => (w.blobId && url ? set({ kind: w.blobKind ?? "video" }) : file.current?.click())}
          label={w.blobId ? "Your wallpaper" : "Your own video or image"} sub={busy ? "Saving…" : w.blobId ? "Tap Replace to change it" : "MP4, MOV, WebM, PNG, JPEG, GIF"}>
          {url && w.blobId
            ? (w.blobKind === "image" ? <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */
              : <video src={url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />)
            : <span className="absolute inset-0 grid place-items-center text-text-2"><span className="flex flex-col items-center gap-1.5 text-[12px]"><Film size={20} />Upload</span></span>}
        </Tile>
      </div>
      <input ref={file} type="file" hidden accept={[...ALLOWED_VIDEO_TYPES, ...IMAGE_TYPES].join(",")} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-end gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={`Dim · ${Math.round(w.dim * 100)}%`}><input type="range" min={0} max={0.9} step={0.05} value={w.dim} onChange={(e) => set({ dim: Number(e.target.value) })} className="w-full accent-[var(--accent)]" aria-label="Dim" /></Field>
        <Field label={`Blur · ${w.blur}px`}><input type="range" min={0} max={24} step={1} value={w.blur} onChange={(e) => set({ blur: Number(e.target.value) })} className="w-full accent-[var(--accent)]" aria-label="Blur" /></Field>
        <Field label="Cards" hint="Glass lets the wallpaper show through."><Segmented value={w.glass ? "glass" : "solid"} onChange={(v) => set({ glass: v === "glass" })} options={[{ value: "glass", label: "Glass" }, { value: "solid", label: "Solid" }]} /></Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<ImagePlus size={14} />} disabled={busy} onClick={() => file.current?.click()}>{w.blobId ? "Replace video / image" : "Upload video / image"}</Button>
          {w.blobId && <Button size="sm" variant="ghost" onClick={() => { const id = w.blobId!; set({ blobId: null, blobKind: undefined, kind: w.kind === "video" || w.kind === "image" ? "none" : w.kind }); deleteBlob(id).catch(() => undefined); }}>Remove</Button>}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted">Live wallpapers pause when LEDGR isn&apos;t on screen, and stay still if your device is set to reduce motion. Your video stays muted.</p>
    </Card>
  );
}
