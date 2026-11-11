"use client";
import { ExternalLink, FileText, GripHorizontal, ImageIcon, NotebookPen, Plus, SquareLibrary, StickyNote, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { saveBoard } from "@/lib/actions";
import { getBlob, putBlob, useLedgr, validateUpload } from "@/lib/store";
import type { BoardCard, BoardCardKind, StudyBoard } from "@/lib/types";
import { cx, fmtDate, safeUrl, uid, youtubeId } from "@/lib/util";
import { BlobImage } from "../BlobImage";
import { Button, Field, IconButton, Input, Modal, Select, Textarea } from "../ui";

const KINDS: { kind: BoardCardKind; label: string; icon: React.ReactNode }[] = [
  { kind: "text", label: "Text card", icon: <StickyNote size={14} /> },
  { kind: "note", label: "Study note", icon: <FileText size={14} /> },
  { kind: "strategy", label: "Strategy", icon: <SquareLibrary size={14} /> },
  { kind: "trade", label: "Journal record", icon: <NotebookPen size={14} /> },
  { kind: "video", label: "Video reference", icon: <Video size={14} /> },
  { kind: "image", label: "Image", icon: <ImageIcon size={14} /> },
  { kind: "pdf", label: "PDF", icon: <FileText size={14} /> },
];

export function Board({ board }: { board: StudyBoard }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState<BoardCardKind | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; card: BoardCard } | null>(null);
  const [live, setLive] = useState<Record<string, { x: number; y: number }>>({});
  const update = (cards: BoardCard[]) => saveBoard({ ...board, cards });

  const onDown = (e: React.PointerEvent, c: BoardCard) => {
    const rect = canvas.current!.getBoundingClientRect();
    drag.current = { id: c.id, dx: e.clientX - rect.left + canvas.current!.scrollLeft - c.x, dy: e.clientY - rect.top + canvas.current!.scrollTop - c.y, card: c };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const rect = canvas.current!.getBoundingClientRect();
    const x = Math.max(0, Math.round((e.clientX - rect.left + canvas.current!.scrollLeft - d.dx) / 8) * 8);
    const y = Math.max(0, Math.round((e.clientY - rect.top + canvas.current!.scrollTop - d.dy) / 8) * 8);
    setLive({ [d.id]: { x, y } });
  };
  const onUp = () => {
    const d = drag.current;
    if (d && live[d.id]) update(board.cards.map((c) => (c.id === d.id ? { ...c, ...live[d.id] } : c)));
    drag.current = null;
    setLive({});
  };
  const nudge = (c: BoardCard, e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 8;
    const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!m[e.key]) return;
    e.preventDefault();
    update(board.cards.map((x) => (x.id === c.id ? { ...x, x: Math.max(0, x.x + m[e.key][0]), y: Math.max(0, x.y + m[e.key][1]) } : x)));
  };

  const height = Math.max(560, ...board.cards.map((c) => c.y + 320));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {KINDS.map((k) => <Button key={k.kind} size="sm" icon={k.icon} onClick={() => setAdding(k.kind)}>{k.label}</Button>)}
      </div>
      <p className="mb-3 text-xs text-muted">Drag cards by their handle to arrange them. With a handle focused, use the arrow keys (Shift for larger steps).</p>
      <div ref={canvas} className="relative overflow-auto rounded-2xl border border-line-soft bg-bg-2/60 scroll-thin" style={{ height: "70vh", backgroundImage: "radial-gradient(var(--grid) 1px, transparent 1px)", backgroundSize: "24px 24px" }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div style={{ height, width: Math.max(1200, ...board.cards.map((c) => c.x + c.w + 40)) }} className="relative">
          {board.cards.length === 0 && <p className="absolute inset-x-0 top-24 text-center text-[13px] text-muted">This board is empty. Add notes, strategies, journal records, videos, images or PDFs above.</p>}
          {board.cards.map((c) => {
            const pos = live[c.id] ?? { x: c.x, y: c.y };
            return (
              <div key={c.id} className={cx("absolute rounded-xl border border-line bg-card shadow-xl", live[c.id] && "z-10 ring-1 ring-accent/50")} style={{ left: pos.x, top: pos.y, width: c.w }}>
                <div className="flex items-center gap-1 border-b border-line-soft px-2 py-1">
                  <button type="button" aria-label={`Move ${c.title}`} className="grid h-7 flex-1 cursor-grab touch-none place-items-start rounded text-muted active:cursor-grabbing" onPointerDown={(e) => onDown(e, c)} onKeyDown={(e) => nudge(c, e)}><GripHorizontal size={14} /></button>
                  <span className="text-[10.5px] text-muted">{KINDS.find((k) => k.kind === c.kind)?.label}</span>
                  <IconButton label="Remove card" className="h-7 w-7" onClick={() => update(board.cards.filter((x) => x.id !== c.id))}><Trash2 size={12} /></IconButton>
                </div>
                <CardBody c={c} />
              </div>
            );
          })}
        </div>
      </div>
      {adding && <AddCard kind={adding} onClose={() => setAdding(null)} onAdd={(card) => { const sx = canvas.current?.scrollLeft ?? 0, sy = canvas.current?.scrollTop ?? 0; update([...board.cards, { ...card, x: sx + 24 + (board.cards.length % 5) * 24, y: sy + 24 + (board.cards.length % 5) * 24 }]); setAdding(null); }} />}
    </div>
  );
}

function CardBody({ c }: { c: BoardCard }) {
  const note = useLedgr((s) => (c.kind === "note" ? s.studyNotes.find((n) => n.id === c.refId) : undefined));
  const strategy = useLedgr((s) => (c.kind === "strategy" ? s.strategies.find((n) => n.id === c.refId) : undefined));
  const trade = useLedgr((s) => (c.kind === "trade" ? s.trades.find((n) => n.id === c.refId) : undefined));
  const vid = c.kind === "video" ? youtubeId(c.url) : null;
  const openBlob = async () => { if (!c.blobId) return; const b = await getBlob(c.blobId); if (b) window.open(URL.createObjectURL(b), "_blank", "noopener"); };
  return (
    <div className="p-3 text-[13px]">
      {c.kind === "text" && <><p className="font-medium">{c.title}</p>{c.body && <p className="mt-1 whitespace-pre-wrap text-text-2">{c.body}</p>}</>}
      {c.kind === "note" && (note ? <Link href={`/study?note=${note.id}`} className="block"><p className="font-medium hover:text-accent">{note.title}</p><p className="mt-1 line-clamp-4 text-text-2">{note.blocks.map((b) => b.text).filter(Boolean).join(" · ")}</p></Link> : <p className="text-muted">Note was deleted.</p>)}
      {c.kind === "strategy" && (strategy ? <Link href={`/strategies/${strategy.id}`} className="block"><p className="font-medium hover:text-accent">{strategy.name}</p><p className="mt-1 line-clamp-3 text-text-2">{strategy.description}</p></Link> : <p className="text-muted">Strategy was deleted.</p>)}
      {c.kind === "trade" && (trade ? <Link href={`/journal/${trade.id}`} className="block"><p className="font-medium hover:text-accent">{trade.symbol} #{trade.number}</p><p className="mt-1 text-text-2">{fmtDate(trade.date)} · {trade.setup || "No setup"}</p>{trade.reflection.learned && <p className="mt-1 line-clamp-3 text-xs text-muted">{trade.reflection.learned}</p>}</Link> : <p className="text-muted">Record was deleted.</p>)}
      {c.kind === "video" && <>{vid ? <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" /> : null}<p className="font-medium">{c.title}</p>{safeUrl(c.url) && <a href={safeUrl(c.url)!} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">Open video <ExternalLink size={11} /></a>}</>}
      {c.kind === "image" && c.blobId && <><BlobImage blobId={c.blobId} alt={c.title} className="aspect-video w-full rounded-lg" />{c.title && <p className="mt-2 text-text-2">{c.title}</p>}</>}
      {c.kind === "pdf" && <button type="button" onClick={openBlob} className="flex w-full items-center gap-3 text-left"><span className="grid h-10 w-10 place-items-center rounded-lg bg-neg/10 text-[10px] font-semibold text-neg">PDF</span><span className="min-w-0"><span className="block truncate font-medium hover:text-accent">{c.title}</span><span className="text-xs text-muted">Open in new tab</span></span></button>}
    </div>
  );
}

function AddCard({ kind, onClose, onAdd }: { kind: BoardCardKind; onClose: () => void; onAdd: (c: BoardCard) => void }) {
  const notes = useLedgr((s) => s.studyNotes);
  const strategies = useLedgr((s) => s.strategies);
  const trades = useLedgr((s) => s.trades);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = { id: uid("card"), kind, refId: null, blobId: null, title: "", body: "", url: "", x: 0, y: 0, w: kind === "image" || kind === "video" ? 300 : 260 } as BoardCard;

  const add = async () => {
    setError(null);
    if (kind === "text") { if (!title.trim()) return setError("Add a title."); return onAdd({ ...base, title: title.trim(), body }); }
    if (["note", "strategy", "trade"].includes(kind)) { if (!ref) return setError("Choose an item."); return onAdd({ ...base, refId: ref, title: kind }); }
    if (kind === "video") { if (!safeUrl(url)) return setError("Enter a valid video URL."); return onAdd({ ...base, url, title: title.trim() || "Video reference" }); }
    if (!file) return setError("Choose a file.");
    const problem = validateUpload(file, [kind === "pdf" ? "pdf" : "image"]);
    if (problem) return setError(problem);
    const blobId = uid("blob");
    await putBlob(blobId, file);
    onAdd({ ...base, blobId, title: title.trim() || file.name });
  };

  return (
    <Modal open onClose={onClose} size="sm" title={`Add ${KINDS.find((k) => k.kind === kind)?.label.toLowerCase()}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" icon={<Plus size={14} />} onClick={add}>Add to board</Button></>}>
      <div className="grid gap-4">
        {kind === "note" && <Field label="Note"><Select value={ref} onChange={(e) => setRef(e.target.value)}><option value="">Choose a note</option>{notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</Select></Field>}
        {kind === "strategy" && <Field label="Strategy"><Select value={ref} onChange={(e) => setRef(e.target.value)}><option value="">Choose a strategy</option>{strategies.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</Select></Field>}
        {kind === "trade" && <Field label="Journal record"><Select value={ref} onChange={(e) => setRef(e.target.value)}><option value="">Choose a trade</option>{[...trades].reverse().slice(0, 200).map((n) => <option key={n.id} value={n.id}>#{n.number} {n.symbol} · {n.date}</option>)}</Select></Field>}
        {kind === "video" && <Field label="Video URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></Field>}
        {(kind === "image" || kind === "pdf") && <Field label="File" hint={kind === "pdf" ? "PDF up to 8 MB" : "PNG, JPEG, WebP or GIF up to 8 MB"}><input type="file" accept={kind === "pdf" ? "application/pdf" : "image/png,image/jpeg,image/webp,image/gif"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[13px] text-text-2" /></Field>}
        {["text", "video", "image", "pdf"].includes(kind) && <Field label="Title"><Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></Field>}
        {kind === "text" && <Field label="Text"><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></Field>}
        {error && <p className="text-[13px] text-neg">{error}</p>}
      </div>
    </Modal>
  );
}
