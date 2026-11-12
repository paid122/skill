"use client";
import { Check, Folder, FolderPlus, LayoutGrid, Pencil, Pin, Plus, Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { Board } from "@/components/study/Board";
import { FocusTimer } from "@/components/study/FocusTimer";
import { NoteEditor } from "@/components/study/NoteEditor";
import { Button, Card, EmptyState, Field, IconButton, Input, Modal, Segmented, Select, useFeedback } from "@/components/ui";
import { PageVerse } from "@/components/VerseCard";
import { deleteBoard, deleteFolder, deleteNote, newNote, saveBoard, saveFolder, saveNote, ValidationError } from "@/lib/actions";
import { useLedgr } from "@/lib/store";
import type { StudyNote } from "@/lib/types";
import { cx, fmtDate, nowISO, uid, youtubeId } from "@/lib/util";

export default function StudyPage() {
  return <Suspense><Study /></Suspense>;
}

function Study() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<"notes" | "boards">(params.get("board") ? "boards" : "notes");
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="Study room" sub="Your personal library: notes, video lessons and visual boards." actions={<Segmented ariaLabel="Study view" value={mode} onChange={(m) => { setMode(m); router.replace("/study"); }} options={[{ value: "notes", label: "Notes" }, { value: "boards", label: "Boards" }]} />} />
      <PageVerse page="study" compact />
      <FocusTimer />
      {mode === "notes" ? <Notes /> : <Boards />}
    </div>
  );
}

function Notes() {
  const params = useSearchParams();
  const router = useRouter();
  const folders = useLedgr((s) => s.studyFolders);
  const notes = useLedgr((s) => s.studyNotes);
  const { confirm, toast } = useFeedback();
  const [folderId, setFolderId] = useState<string | "all">("all");
  const [q, setQ] = useState("");
  const [folderEdit, setFolderEdit] = useState<{ id: string | null; name: string } | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const selectedId = params.get("note");
  const stored = notes.find((n) => n.id === selectedId) ?? null;
  const [draft, setDraft] = useState<StudyNote | null>(stored);
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const dirty = useRef(false);

  useEffect(() => { setDraft(stored); dirty.current = false; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedId]);
  useEffect(() => {
    if (!dirty.current || !draft) return;
    setStatus("saving");
    const t = setTimeout(() => { saveNote(draft); setStatus("saved"); }, 500);
    return () => clearTimeout(t);
  }, [draft]);

  const visible = useMemo(() => notes
    .filter((n) => (folderId === "all" || n.folderId === folderId) && (!q || n.title.toLowerCase().includes(q.toLowerCase()) || n.blocks.some((b) => b.text.toLowerCase().includes(q.toLowerCase()))))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [notes, folderId, q]);

  const open = (id: string) => router.replace(`/study?note=${id}`);
  const create = () => {
    const fid = folderId === "all" ? folders[0]?.id : folderId;
    if (!fid) { toast("Create a folder first", "error"); return; }
    const n = newNote(fid);
    saveNote(n);
    open(n.id);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card pad={false} className="p-2">
          <div className="flex items-center justify-between px-2 py-1.5"><span className="text-xs font-medium text-muted">Folders</span><IconButton label="New folder" className="h-7 w-7" onClick={() => { setFolderError(null); setFolderEdit({ id: null, name: "" }); }}><FolderPlus size={14} /></IconButton></div>
          <button type="button" onClick={() => setFolderId("all")} className={cx("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]", folderId === "all" ? "bg-card-2 text-text" : "text-text-2 hover:bg-card-2/60")}><LayoutGrid size={14} className="text-muted" /> All notes <span className="ml-auto text-xs text-muted">{notes.length}</span></button>
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center">
              <button type="button" onClick={() => setFolderId(f.id)} className={cx("flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]", folderId === f.id ? "bg-card-2 text-text" : "text-text-2 hover:bg-card-2/60")}><Folder size={14} className="shrink-0 text-muted" /><span className="truncate">{f.name}</span><span className="ml-auto text-xs text-muted">{notes.filter((n) => n.folderId === f.id).length}</span></button>
              <IconButton label={`Rename ${f.name}`} className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => { setFolderError(null); setFolderEdit({ id: f.id, name: f.name }); }}><Pencil size={12} /></IconButton>
            </div>
          ))}
        </Card>
        <Card pad={false} className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line-soft p-2">
            <div className="relative flex-1"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" className="h-8 pl-8 text-[13px]" /></div>
            <IconButton label="New note" className="h-8 w-8" onClick={create}><Plus size={15} /></IconButton>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto scroll-thin">
            {visible.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted">No notes here yet.</li>}
            {visible.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => open(n.id)} className={cx("w-full border-b border-line-soft px-3 py-2.5 text-left last:border-0", selectedId === n.id ? "bg-card-2" : "hover:bg-card-2/50")}>
                  <span className="flex items-center gap-1.5 text-[13px] text-text">{n.pinned && <Pin size={11} className="text-accent" />}<span className="truncate">{n.title || "Untitled"}</span></span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">{fmtDate(n.updatedAt)}{youtubeId(n.videoUrl) ? " · Video" : ""} · {folders.find((f) => f.id === n.folderId)?.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {draft ? (
        <Card className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line-soft pb-4">
            <Select aria-label="Folder" value={draft.folderId} onChange={(e) => { dirty.current = true; setDraft({ ...draft, folderId: e.target.value }); }} className="h-8 w-44 text-[13px]">{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
            <Input value={draft.videoUrl} onChange={(e) => { dirty.current = true; setDraft({ ...draft, videoUrl: e.target.value }); }} placeholder="Paste a YouTube URL to study alongside" className="h-8 min-w-[220px] flex-1 text-[13px]" aria-label="Video URL" />
            {draft.videoUrl && !youtubeId(draft.videoUrl) && <span className="text-xs text-neg">Only YouTube links can be embedded.</span>}
            <IconButton label={draft.pinned ? "Unpin note" : "Pin note"} onClick={() => { dirty.current = true; setDraft({ ...draft, pinned: !draft.pinned }); }}><Pin size={15} className={draft.pinned ? "text-accent" : ""} /></IconButton>
            <IconButton label="Delete note" onClick={async () => { if (await confirm({ title: `Delete “${draft.title}”?`, confirm: "Delete note", danger: true })) { await deleteNote(draft.id); router.replace("/study"); toast("Note deleted"); } }}><Trash2 size={15} /></IconButton>
            <span className="inline-flex items-center gap-1 text-xs text-muted">{status === "saving" ? "Saving…" : <><Check size={12} className="text-pos" /> Saved</>}</span>
          </div>
          <NoteEditor note={draft} onChange={(n) => { dirty.current = true; setDraft(n); }} />
        </Card>
      ) : (
        <EmptyState title="Select a note or start a new one" body="Use headings, lists, checklists, quotes, images and links. Paste a YouTube link to take timestamped notes." action={<Button variant="accent" icon={<Plus size={14} />} onClick={create}>New note</Button>} />
      )}

      <Modal open={!!folderEdit} onClose={() => setFolderEdit(null)} size="sm" title={folderEdit?.id ? "Rename folder" : "New folder"}
        footer={<>
          {folderEdit?.id && <Button variant="danger" className="mr-auto" onClick={async () => { try { if (await confirm({ title: "Delete this folder?", confirm: "Delete folder", danger: true })) { deleteFolder(folderEdit.id!); setFolderId("all"); setFolderEdit(null); } } catch (e) { setFolderError(e instanceof ValidationError ? e.message : "Could not delete."); } }}>Delete</Button>}
          <Button variant="ghost" onClick={() => setFolderEdit(null)}>Cancel</Button>
          <Button variant="accent" onClick={() => { try { const f = folders.find((x) => x.id === folderEdit?.id); saveFolder(f ? { ...f, name: folderEdit!.name.trim() } : { id: uid("fld"), name: folderEdit!.name.trim(), createdAt: nowISO() }); setFolderEdit(null); } catch (e) { setFolderError(e instanceof ValidationError ? e.message : "Could not save."); } }}>Save folder</Button>
        </>}>
        <Field label="Name" error={folderError}><Input value={folderEdit?.name ?? ""} maxLength={40} onChange={(e) => setFolderEdit((f) => (f ? { ...f, name: e.target.value } : f))} /></Field>
      </Modal>
    </div>
  );
}

function Boards() {
  const params = useSearchParams();
  const router = useRouter();
  const boards = useLedgr((s) => s.studyBoards);
  const { confirm } = useFeedback();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const current = boards.find((b) => b.id === params.get("board")) ?? boards[0] ?? null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {boards.map((b) => <button key={b.id} type="button" onClick={() => router.replace(`/study?board=${b.id}`)} className={cx("h-8 rounded-full border px-3 text-[13px]", current?.id === b.id ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-text-2 hover:text-text")}>{b.name}</button>)}
        <Button size="sm" icon={<Plus size={14} />} onClick={() => { setName(""); setCreating(true); }}>New board</Button>
        {current && <Button size="sm" variant="ghost" className="ml-auto" icon={<Trash2 size={14} />} onClick={async () => { if (await confirm({ title: `Delete board “${current.name}”?`, body: "Cards are removed; the notes, strategies and records they point to are kept.", confirm: "Delete board", danger: true })) { deleteBoard(current.id); router.replace("/study?board=_"); } }}>Delete board</Button>}
      </div>
      {current ? <Board board={current} /> : <EmptyState icon={<LayoutGrid size={18} />} title="No study boards yet" body="Boards let you arrange notes, images, PDFs, strategies, videos and journal records visually." action={<Button variant="accent" onClick={() => setCreating(true)}>Create a board</Button>} />}
      <Modal open={creating} onClose={() => setCreating(false)} size="sm" title="New study board" footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button variant="accent" disabled={!name.trim()} onClick={() => { const b = { id: uid("brd"), name: name.trim().slice(0, 40), cards: [], createdAt: nowISO() }; saveBoard(b); setCreating(false); router.replace(`/study?board=${b.id}`); }}>Create board</Button></>}>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Opening range study" maxLength={40} /></Field>
      </Modal>
    </div>
  );
}
