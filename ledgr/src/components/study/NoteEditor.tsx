"use client";
import { CheckSquare, Clock, Heading, ImagePlus, Link2, List, ListOrdered, Minus, Pilcrow, Quote, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { putBlob, validateUpload } from "@/lib/store";
import type { NoteBlock, NoteBlockType, StudyNote } from "@/lib/types";
import { cx, fmtTimestamp, parseTimestamp, safeUrl, uid, youtubeId } from "@/lib/util";
import { BlobImage } from "../BlobImage";
import { IconButton, Input, Tooltip } from "../ui";

const TOOLS: { type: NoteBlockType; label: string; icon: React.ReactNode }[] = [
  { type: "heading", label: "Heading", icon: <Heading size={15} /> },
  { type: "paragraph", label: "Paragraph", icon: <Pilcrow size={15} /> },
  { type: "bullet", label: "Bullet list", icon: <List size={15} /> },
  { type: "numbered", label: "Numbered list", icon: <ListOrdered size={15} /> },
  { type: "check", label: "Checklist", icon: <CheckSquare size={15} /> },
  { type: "quote", label: "Quote", icon: <Quote size={15} /> },
  { type: "divider", label: "Divider", icon: <Minus size={15} /> },
  { type: "link", label: "Embedded link", icon: <Link2 size={15} /> },
];

const TS_RE = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

export function NoteEditor({ note, onChange }: { note: StudyNote; onChange: (n: StudyNote) => void }) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [videoTime, setVideoTime] = useState(0);
  const iframe = useRef<HTMLIFrameElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const vid = youtubeId(note.videoUrl);
  const blocks = note.blocks;
  const setBlocks = (b: NoteBlock[]) => onChange({ ...note, blocks: b });
  const upd = (id: string, p: Partial<NoteBlock>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const insertAfter = (afterId: string | null, block: NoteBlock) => {
    const i = afterId ? blocks.findIndex((b) => b.id === afterId) : blocks.length - 1;
    const next = [...blocks];
    next.splice(i + 1, 0, block);
    setBlocks(next);
    setFocusId(block.id);
  };

  const addBlock = (type: NoteBlockType) => insertAfter(focusId, { id: uid("b"), type, text: "", ...(type === "heading" ? { level: 2 as const } : {}), ...(type === "check" ? { checked: false } : {}) });

  // YouTube IFrame API via postMessage: subscribe to time updates and seek on demand.
  useEffect(() => {
    if (!vid) return;
    const onMsg = (e: MessageEvent) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.info && typeof d.info.currentTime === "number") setVideoTime(d.info.currentTime);
      } catch { /* ignore */ }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [vid]);
  const listen = () => iframe.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
  const seek = (sec: number) => {
    const w = iframe.current?.contentWindow;
    if (!w) return;
    w.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [sec, true] }), "*");
    w.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
  };
  const timestamps = [...new Set(blocks.flatMap((b) => [...b.text.matchAll(TS_RE)].map((m) => m[1])))].map((t) => ({ t, s: parseTimestamp(t) })).filter((x) => x.s !== null).sort((a, b) => a.s! - b.s!);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>, b: NoteBlock) => {
    if (e.key === "Enter" && !e.shiftKey && b.type !== "paragraph" && b.type !== "quote") {
      e.preventDefault();
      if (!b.text && ["bullet", "numbered", "check"].includes(b.type)) { upd(b.id, { type: "paragraph" }); return; }
      insertAfter(b.id, { id: uid("b"), type: ["bullet", "numbered", "check"].includes(b.type) ? b.type : "paragraph", text: "", ...(b.type === "check" ? { checked: false } : {}) });
    }
    if (e.key === "Backspace" && !b.text && blocks.length > 1) {
      e.preventDefault();
      const i = blocks.findIndex((x) => x.id === b.id);
      setBlocks(blocks.filter((x) => x.id !== b.id));
      setFocusId(blocks[Math.max(0, i - 1)].id);
    }
  };

  const uploadImage = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const problem = validateUpload(f, ["image"]);
    if (problem) { setUploadError(problem); return; }
    setUploadError(null);
    const blobId = uid("blob");
    await putBlob(blobId, f);
    insertAfter(focusId, { id: uid("b"), type: "image", text: "", blobId });
    if (file.current) file.current.value = "";
  };

  let n = 0;
  return (
    <div className={cx("grid gap-6", vid && "2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
      <div className="min-w-0">
        <div className="sticky top-16 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-0.5 rounded-xl border border-line-soft bg-card/95 p-1 backdrop-blur lg:top-[72px]">
          {TOOLS.map((t) => <IconButton key={t.type} label={`Add ${t.label.toLowerCase()}`} onClick={() => addBlock(t.type)} className="h-8 w-8">{t.icon}</IconButton>)}
          <IconButton label="Add image" onClick={() => file.current?.click()} className="h-8 w-8"><ImagePlus size={15} /></IconButton>
          <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => uploadImage(e.target.files)} />
          {vid && <button type="button" onClick={() => insertAfter(focusId, { id: uid("b"), type: "bullet", text: `[${fmtTimestamp(videoTime)}] ` })} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-accent hover:bg-card-2"><Clock size={14} /> Timestamp {fmtTimestamp(videoTime)}</button>}
        </div>
        {uploadError && <p className="mb-3 text-[13px] text-neg">{uploadError}</p>}
        <input value={note.title} onChange={(e) => onChange({ ...note, title: e.target.value.slice(0, 120) })} className="mb-4 w-full bg-transparent text-[26px] font-semibold tracking-tight outline-none placeholder:text-muted" placeholder="Untitled note" aria-label="Note title" />
        <div className="flex flex-col gap-1">
          {blocks.map((b) => {
            n = b.type === "numbered" ? n + 1 : 0;
            return (
              <div key={b.id} className="group relative flex items-start gap-2" onFocus={() => setFocusId(b.id)}>
                <BlockView b={b} index={n} autoFocus={focusId === b.id} onChange={(p) => upd(b.id, p)} onKey={(e) => onKey(e, b)} onSeek={seek} />
                <button type="button" aria-label="Delete block" onClick={() => setBlocks(blocks.length > 1 ? blocks.filter((x) => x.id !== b.id) : [{ id: uid("b"), type: "paragraph", text: "" }])} className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded text-muted opacity-0 hover:bg-card-2 hover:text-neg focus:opacity-100 group-hover:opacity-100"><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      </div>
      {vid && (
        <aside className="min-w-0 2xl:sticky 2xl:top-24 2xl:self-start">
          <div className="overflow-hidden rounded-xl border border-line-soft bg-black">
            <iframe
              ref={iframe}
              title="Video"
              src={`https://www.youtube-nocookie.com/embed/${vid}?enablejsapi=1&rel=0&origin=${typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : ""}`}
              className="aspect-video w-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={listen}
            />
          </div>
          <div className="mt-3">
            <p className="mb-2 text-xs text-muted">Timestamps in this note — select to jump. Add one with the Timestamp button, or type [mm:ss].</p>
            <div className="flex flex-wrap gap-1.5">
              {timestamps.length ? timestamps.map((x) => <button key={x.t} type="button" onClick={() => seek(x.s!)} className="num rounded-md border border-line px-2 py-1 text-xs text-accent hover:bg-card-2">{x.t}</button>) : <span className="text-xs text-muted">None yet.</span>}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function AutoText({ value, onChange, className, placeholder, autoFocus, onKeyDown }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; autoFocus?: boolean; onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }, [value]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return <textarea ref={ref} rows={1} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} className={cx("w-full resize-none overflow-hidden bg-transparent leading-relaxed outline-none placeholder:text-muted/70", className)} />;
}

function BlockView({ b, index, autoFocus, onChange, onKey, onSeek }: { b: NoteBlock; index: number; autoFocus: boolean; onChange: (p: Partial<NoteBlock>) => void; onKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void; onSeek: (s: number) => void }) {
  const common = { value: b.text, onChange: (v: string) => onChange({ text: v }), autoFocus, onKeyDown: onKey };
  switch (b.type) {
    case "heading":
      return (
        <div className="flex w-full items-baseline gap-2">
          <select aria-label="Heading level" value={b.level ?? 2} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })} className="bg-transparent text-xs text-muted outline-none"><option value={1}>H1</option><option value={2}>H2</option><option value={3}>H3</option></select>
          <AutoText {...common} placeholder="Heading" className={cx("font-semibold tracking-tight", b.level === 1 ? "text-[22px]" : b.level === 3 ? "text-[15px]" : "text-[18px]")} />
        </div>
      );
    case "bullet":
      return <div className="flex w-full gap-2.5"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-text-2" /><AutoText {...common} placeholder="List item" className="text-[14.5px]" /><TsLinks text={b.text} onSeek={onSeek} /></div>;
    case "numbered":
      return <div className="flex w-full gap-2.5"><span className="num mt-[3px] w-5 shrink-0 text-right text-[13px] text-muted">{index}.</span><AutoText {...common} placeholder="List item" className="text-[14.5px]" /></div>;
    case "check":
      return (
        <div className="flex w-full gap-2.5">
          <input type="checkbox" aria-label="Done" checked={!!b.checked} onChange={(e) => onChange({ checked: e.target.checked })} className="mt-[5px] h-4 w-4 shrink-0 accent-[var(--accent)]" />
          <AutoText {...common} placeholder="To do" className={cx("text-[14.5px]", b.checked && "text-muted line-through")} />
        </div>
      );
    case "quote":
      return <div className="w-full border-l-2 border-accent/60 pl-4"><AutoText {...common} placeholder="Quote" className="verse-text text-[17px] text-ivory" /></div>;
    case "divider":
      return <hr className="my-3 w-full border-line" />;
    case "image":
      return (
        <figure className="w-full">
          {b.blobId && <BlobImage blobId={b.blobId} alt={b.text || "Note image"} className="max-h-[420px] w-full rounded-xl border border-line-soft object-contain" />}
          <AutoText {...common} placeholder="Caption" className="mt-1 text-center text-xs text-muted" />
        </figure>
      );
    case "link": {
      const url = b.url ? safeUrl(b.url) : null;
      return (
        <div className="w-full rounded-xl border border-line-soft bg-bg-2/40 p-3">
          <Input value={b.url ?? ""} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://" aria-label="Link URL" className="h-8" />
          <AutoText {...common} placeholder="Why is this link useful?" className="mt-2 text-[13px] text-text-2" />
          {url ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block truncate text-xs text-accent hover:underline">{new URL(url).hostname}{new URL(url).pathname !== "/" ? new URL(url).pathname : ""}</a> : b.url ? <p className="mt-1 text-xs text-neg">Enter a valid http(s) address.</p> : null}
        </div>
      );
    }
    default:
      return <div className="flex w-full"><AutoText {...common} placeholder="Write, or add a block from the toolbar…" className="text-[14.5px]" /><TsLinks text={b.text} onSeek={onSeek} /></div>;
  }
}

function TsLinks({ text, onSeek }: { text: string; onSeek: (s: number) => void }) {
  const ts = [...text.matchAll(TS_RE)].map((m) => m[1]);
  if (!ts.length) return null;
  return <span className="mt-0.5 flex shrink-0 gap-1">{ts.slice(0, 2).map((t) => <Tooltip key={t} text="Jump to this moment"><button type="button" onClick={() => onSeek(parseTimestamp(t)!)} className="num rounded border border-accent/40 px-1.5 text-[11px] text-accent hover:bg-accent/10">▶ {t}</button></Tooltip>)}</span>;
}
