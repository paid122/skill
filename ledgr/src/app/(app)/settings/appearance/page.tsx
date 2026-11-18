"use client";
import { Check, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useBlobUrl } from "@/components/BlobImage";
import { PageIntro } from "@/components/blocks";
import { SettingsNav } from "@/components/SettingsNav";
import { Button, Card, Field, IconButton, Input, Segmented, Select, useFeedback } from "@/components/ui";
import { updateAppearance } from "@/lib/actions";
import { defaultAppearance } from "@/lib/defaults";
import { ALLOWED_VIDEO_TYPES, deleteBlob, MAX_VIDEO_BYTES, putBlob, useLedgr } from "@/lib/store";
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

/** A titled block of settings. */
function Section({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line-soft pt-8 first:border-t-0 first:pt-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {sub && <p className="mt-1 text-[13px] leading-relaxed text-muted">{sub}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** One setting: label on the left, control on the right. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line-soft py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0"><p className="text-[13.5px] text-text">{label}</p>{hint && <p className="text-[12px] text-muted">{hint}</p>}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function AppearancePage() {
  const a = useLedgr((s) => s.settings.appearance);
  const { toast, confirm } = useFeedback();
  const [accentText, setAccentText] = useState(a.accent);
  const [error, setError] = useState<string | null>(null);
  const [themeName, setThemeName] = useState("");
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

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Appearance" sub="Make LEDGR feel like yours." actions={<Button variant="ghost" icon={<RotateCcw size={14} />} onClick={async () => { if (await confirm({ title: "Reset appearance to defaults?", body: "Your uploaded wallpapers stay saved.", confirm: "Reset" })) { updateAppearance({ ...defaultAppearance, savedThemes: a.savedThemes, wallpaper: { ...defaultAppearance.wallpaper!, library: a.wallpaper?.library ?? [] } }); setAccentText(defaultAppearance.accent); toast("Appearance reset"); } }}>Reset</Button>} />
      <SettingsNav />
      {error && <p role="alert" className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{error}</p>}

      <Card className="flex flex-col gap-8">
        <Section title="Theme" sub="The base colours for every page.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        </Section>

        <Section title="Wallpaper" sub="Put your own video or picture behind LEDGR. Upload as many as you like and switch between them.">
          <WallpaperSection />
        </Section>

        <Section title="Colours" sub="Checked so text and charts stay readable on your theme.">
          <div>
            <Row label="Accent" hint={`${contrast(a.accent, card).toFixed(1)}:1 contrast`}>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {ACCENTS.map((c) => <button key={c} type="button" aria-label={`Accent ${c}`} aria-pressed={a.accent === c} onClick={() => { if (trySet({ accent: c }, "Accent", c)) setAccentText(c); }} className={cx("h-7 w-7 rounded-full border-2", a.accent === c ? "border-text" : "border-line-soft")} style={{ background: c }} />)}
                <Input value={accentText} onChange={(e) => setAccentText(e.target.value)} onBlur={() => trySet({ accent: accentText }, "Accent", accentText)} onKeyDown={(e) => e.key === "Enter" && trySet({ accent: accentText }, "Accent", accentText)} className="h-8 w-24 font-mono text-xs" aria-label="Custom accent hex" />
              </div>
            </Row>
            <Row label="Gains" hint={`Shown as ${fmtMoney(1240.5, "USD", { sign: true })}`}><ColorField label="Positive (gains)" value={a.positiveColor} onCommit={(c) => trySet({ positiveColor: c }, "Positive colour", c)} /></Row>
            <Row label="Losses" hint={`Shown as ${fmtMoney(-380.25, "USD")}`}><ColorField label="Negative (losses)" value={a.negativeColor} onCommit={(c) => trySet({ negativeColor: c }, "Negative colour", c)} /></Row>
          </div>
        </Section>

        <Section title="Layout & type">
          <div>
            <Row label="Navigation"><Segmented value={a.nav ?? "top"} onChange={(nav) => updateAppearance({ nav })} options={[{ value: "top", label: "Top bar" }, { value: "side", label: "Sidebar" }]} /></Row>
            {a.nav === "side" && <Row label="Sidebar"><Segmented value={a.sidebar} onChange={(sidebar) => updateAppearance({ sidebar })} options={[{ value: "solid", label: "Solid" }, { value: "translucent", label: "Translucent" }]} /></Row>}
            <Row label="Card spacing"><Segmented value={a.density} onChange={(density) => updateAppearance({ density })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} /></Row>
            <Row label="Font"><Select value={a.font} onChange={(e) => updateAppearance({ font: e.target.value as Appearance["font"] })} className="w-56" aria-label="Font"><option value="inter">Inter</option><option value="system">System interface</option><option value="serif-accent">Inter with serif headings</option></Select></Row>
            <Row label="Numbers"><Select value={a.numberFormat} onChange={(e) => updateAppearance({ numberFormat: e.target.value as Appearance["numberFormat"] })} className="w-56" aria-label="Number format"><option value="en-US">1,234.56 (US)</option><option value="en-GB">1,234.56 (UK)</option><option value="de-DE">1.234,56 (DE)</option><option value="fr-FR">1 234,56 (FR)</option></Select></Row>
            <Row label="Cursor" hint="Ring adds a trailing ring; your normal cursor stays."><Segmented value={a.cursor ?? "system"} onChange={(cursor) => updateAppearance({ cursor })} options={[{ value: "system", label: "Standard" }, { value: "ring", label: "Ring" }]} /></Row>
          </div>
        </Section>

        <Section title="Saved looks" sub="Save this combination to switch back to it later.">
          <div className="flex flex-wrap gap-2">
            <Input value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Name this look" maxLength={30} className="max-w-xs" aria-label="Look name" />
            <Button icon={<Save size={14} />} disabled={!themeName.trim()} onClick={() => { const { savedThemes, ...values } = a; updateAppearance({ savedThemes: [...savedThemes, { id: uid("thm"), name: themeName.trim(), values }] }); setThemeName(""); toast("Look saved"); }}>Save</Button>
          </div>
          {a.savedThemes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {a.savedThemes.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-full border border-line-soft py-1 pl-1.5 pr-1">
                  <span className="h-5 w-5 rounded-full" style={{ background: THEMES.find((x) => x.value === t.values.theme)?.bg, border: `3px solid ${t.values.accent}` }} />
                  <button type="button" className="text-[13px] text-text hover:underline" onClick={() => { updateAppearance({ ...t.values }); setAccentText(t.values.accent); toast(`Applied ${t.name}`); }}>{t.name}</button>
                  <IconButton label={`Delete ${t.name}`} onClick={() => updateAppearance({ savedThemes: a.savedThemes.filter((x) => x.id !== t.id) })}><Trash2 size={12} /></IconButton>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Card>
    </div>
  );
}

function ColorField({ label, value, onCommit }: { label: string; value: string; onCommit: (c: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Field label={<span className="sr-only">{label}</span>}>
      <div className="flex items-center gap-2">
        <input type="color" value={isHex(v) && v.length === 7 ? v : value} onChange={(e) => { setV(e.target.value); onCommit(e.target.value); }} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" aria-label={`${label} picker`} />
        <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onCommit(v)} className="h-8 w-24 font-mono text-xs" aria-label={`${label} hex`} />
      </div>
    </Field>
  );
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** The trader's own wallpapers: pick one, add more, remove any, and tune dim, blur and glass. */
function WallpaperSection() {
  const a = useLedgr((s) => s.settings.appearance);
  const w = a.wallpaper ?? defaultAppearance.wallpaper!;
  const lib = w.library ?? [];
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Wallpaper>) => updateAppearance({ wallpaper: { ...w, ...patch } });

  // Move an old-style background image (stored inline) into the wallpaper library.
  useEffect(() => {
    if (!a.backgroundImage) return;
    (async () => {
      try {
        const blob = await (await fetch(a.backgroundImage)).blob();
        const id = uid("wp");
        await putBlob(id, blob);
        updateAppearance({ backgroundImage: "", wallpaper: { ...w, kind: w.kind === "none" ? "image" : w.kind, blobId: w.kind === "none" ? id : w.blobId, blobKind: w.kind === "none" ? "image" : w.blobKind, library: [{ blobId: id, kind: "image" }, ...lib] } });
      } catch { /* leave it as it was */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.backgroundImage]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    let next = lib, pick: { blobId: string; kind: "image" | "video" } | null = null;
    for (const f of Array.from(files)) {
      const video = ALLOWED_VIDEO_TYPES.includes(f.type), image = IMAGE_TYPES.includes(f.type);
      if (!video && !image) { setErr(`${f.name}: use an MP4, WebM or MOV video, or a PNG, JPEG, WebP or GIF image.`); continue; }
      if (f.size > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) { setErr(video ? `${f.name}: videos must be under ${MAX_VIDEO_BYTES / 1024 / 1024} MB. Trim it or export at 1080p.` : `${f.name}: images must be under 10 MB.`); continue; }
      try {
        const id = uid("wp");
        await putBlob(id, f);
        pick = { blobId: id, kind: video ? "video" : "image" };
        next = [pick, ...next];
      } catch { setErr(`Couldn't save ${f.name} on this device. Try a smaller file.`); }
    }
    if (pick) set({ library: next, kind: pick.kind, blobId: pick.blobId, blobKind: pick.kind });
    setBusy(false);
  };
  const remove = (id: string) => {
    const rest = lib.filter((x) => x.blobId !== id);
    set(w.blobId === id ? { library: rest, kind: "none", blobId: null, blobKind: undefined } : { library: rest });
    deleteBlob(id).catch(() => undefined);
  };
  const on = w.kind !== "none" && !!w.blobId;

  return (
    <div className="flex flex-col gap-5">
      {err && <p role="alert" className="rounded-lg border border-neg/30 bg-neg/10 px-3 py-2 text-[13px] text-neg">{err}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <button type="button" onClick={() => set({ kind: "none" })} aria-pressed={!on} className={cx("relative aspect-video overflow-hidden rounded-xl border-2 bg-bg text-[13px] text-text-2 transition-colors", !on ? "border-accent" : "border-line-soft hover:border-line")}>
          None{!on && <Check size={14} className="absolute right-2 top-2 text-accent" />}
        </button>
        {lib.map((x, i) => (
          <Thumb key={x.blobId} item={x} n={i + 1} active={on && w.blobId === x.blobId} onPick={() => set({ kind: x.kind, blobId: x.blobId, blobKind: x.kind })} onRemove={() => remove(x.blobId)} />
        ))}
        <button type="button" disabled={busy} onClick={() => file.current?.click()} className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-[13px] text-text-2 transition-colors hover:border-text-2 hover:text-text disabled:opacity-60">
          <Plus size={18} />{busy ? "Saving…" : "Add video or picture"}
        </button>
      </div>
      <input ref={file} type="file" hidden multiple accept={[...ALLOWED_VIDEO_TYPES, ...IMAGE_TYPES].join(",")} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />

      {on && (
        <div className="rounded-xl border border-line-soft px-4 py-3">
          <Row label="Dim" hint={`${Math.round(w.dim * 100)}% — more keeps numbers easier to read`}><input type="range" min={0} max={0.9} step={0.05} value={w.dim} onChange={(e) => set({ dim: Number(e.target.value) })} className="w-44 accent-[var(--accent)]" aria-label="Dim" /></Row>
          <Row label="Blur" hint={`${w.blur}px`}><input type="range" min={0} max={24} step={1} value={w.blur} onChange={(e) => set({ blur: Number(e.target.value) })} className="w-44 accent-[var(--accent)]" aria-label="Blur" /></Row>
          <Row label="Cards" hint="Glass lets the wallpaper show through."><Segmented value={w.glass ? "glass" : "solid"} onChange={(v) => set({ glass: v === "glass" })} options={[{ value: "glass", label: "Glass" }, { value: "solid", label: "Solid" }]} /></Row>
        </div>
      )}
      <p className="text-[12px] text-muted">MP4, MOV or WebM up to {MAX_VIDEO_BYTES / 1024 / 1024} MB, or PNG, JPEG, WebP or GIF up to 10 MB. Videos loop muted.</p>
    </div>
  );
}

function Thumb({ item, n, active, onPick, onRemove }: { item: { blobId: string; kind: "image" | "video" }; n: number; active: boolean; onPick: () => void; onRemove: () => void }) {
  const { url, missing } = useBlobUrl(item.blobId);
  return (
    <div className={cx("group relative aspect-video overflow-hidden rounded-xl border-2 bg-bg-2 transition-colors", active ? "border-accent" : "border-line-soft hover:border-line")}>
      <button type="button" onClick={onPick} aria-pressed={active} aria-label={`Use wallpaper ${n}`} className="absolute inset-0">
        {url && (item.kind === "video"
          ? <video src={url} autoPlay muted loop playsInline className="h-full w-full object-cover" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={url} alt="" className="h-full w-full object-cover" />)}
        {missing && <span className="grid h-full place-items-center text-[12px] text-muted">Not on this device</span>}
      </button>
      {active && <span className="pointer-events-none absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-on-accent"><Check size={13} /></span>}
      <button type="button" onClick={onRemove} aria-label={`Remove wallpaper ${n}`} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
