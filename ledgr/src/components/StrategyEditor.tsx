"use client";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { saveStrategy, ValidationError } from "@/lib/actions";
import { putBlob, validateUpload } from "@/lib/store";
import type { Strategy } from "@/lib/types";
import { uid } from "@/lib/util";
import { BlobImage } from "./BlobImage";
import { Button, Field, IconButton, Input, Modal, Textarea } from "./ui";

export function StrategyEditor({ initial, onClose }: { initial: Strategy; onClose: (saved?: Strategy) => void }) {
  const [s, setS] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [conf, setConf] = useState(initial.confluences.join(", "));
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Strategy>) => setS((x) => ({ ...x, ...p }));

  const upload = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      const problem = validateUpload(f, ["image"]);
      if (problem) { setError(problem); continue; }
      const blobId = uid("blob");
      await putBlob(blobId, f);
      setS((x) => ({ ...x, screenshots: [...x.screenshots, { id: uid("ss"), blobId, name: f.name }] }));
    }
    if (file.current) file.current.value = "";
  };

  const save = () => {
    try {
      const next = { ...s, confluences: conf.split(",").map((c) => c.trim()).filter(Boolean) };
      saveStrategy(next);
      onClose(next);
    } catch (e) { setError(e instanceof ValidationError ? e.message : "Could not save."); }
  };

  return (
    <Modal open onClose={() => onClose()} size="lg" title={initial.name ? `Edit ${initial.name}` : "New strategy"} description="Document how you intend to trade it. Ledgr never suggests strategies." footer={<><Button variant="ghost" onClick={() => onClose()}>Cancel</Button><Button variant="accent" onClick={save}>Save strategy</Button></>}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Name" className="md:col-span-3"><Input value={s.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Opening range break" /></Field>
        <Field label="Description" className="md:col-span-3"><Textarea value={s.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Market"><Input value={s.market} maxLength={40} onChange={(e) => set({ market: e.target.value })} placeholder="Futures" /></Field>
        <Field label="Timeframe"><Input value={s.timeframe} maxLength={20} onChange={(e) => set({ timeframe: e.target.value })} placeholder="5m" /></Field>
        <Field label="Confluences" hint="Comma separated"><Input value={conf} onChange={(e) => setConf(e.target.value)} /></Field>
        <Field label="Entry criteria" hint="One per line" className="md:col-span-3 lg:col-span-1"><Textarea rows={5} value={s.entryCriteria} onChange={(e) => set({ entryCriteria: e.target.value })} /></Field>
        <Field label="Exit criteria" hint="One per line"><Textarea rows={5} value={s.exitCriteria} onChange={(e) => set({ exitCriteria: e.target.value })} /></Field>
        <Field label="Invalidation conditions"><Textarea rows={5} value={s.invalidation} onChange={(e) => set({ invalidation: e.target.value })} /></Field>
        <Field label="Notes" className="md:col-span-3"><Textarea value={s.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        <div className="md:col-span-3">
          <div className="mb-2 flex items-center justify-between"><span className="label">Screenshots</span><Button size="sm" icon={<ImagePlus size={14} />} onClick={() => file.current?.click()}>Upload</Button></div>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => upload(e.target.files)} />
          {s.screenshots.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {s.screenshots.map((ss) => (
                <div key={ss.id} className="relative overflow-hidden rounded-lg border border-line-soft">
                  <BlobImage blobId={ss.blobId} alt={ss.name} className="aspect-video w-full" />
                  <IconButton label="Remove screenshot" className="absolute right-1 top-1 h-7 w-7 bg-card/80" onClick={() => set({ screenshots: s.screenshots.filter((x) => x.id !== ss.id) })}><Trash2 size={13} /></IconButton>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted">Add reference charts that show the setup.</p>}
        </div>
        {error && <p className="text-[13px] text-neg md:col-span-3">{error}</p>}
      </div>
    </Modal>
  );
}
