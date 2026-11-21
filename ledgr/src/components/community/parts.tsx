"use client";
/** Community building blocks: avatar, post card (likes, replies, menu), composer and the stories row. */
import { Flag, Heart, ImagePlus, MessageCircle, MoreHorizontal, Plus, Send, ShieldOff, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Modal, Textarea, useFeedback } from "@/components/ui";
import { addStory, ago, block, createPost, deletePost, deleteReply, deleteStory, mediaUrl, reply, replies as loadReplies, report, setLike, uploadMedia, type Media, type Post, type Profile, type Reply, type SharedTrade, type Story } from "@/lib/community";
import { useEnriched } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { cx, fmtDate, fmtMoney, fmtR } from "@/lib/util";

export function CAvatar({ p, size = 40, ring }: { p: Profile | undefined; size?: number; ring?: boolean }) {
  const url = mediaUrl(p?.avatar_path);
  return (
    <span className={cx("inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-card-2 font-semibold text-text", ring && "ring-2 ring-accent ring-offset-2 ring-offset-bg")} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (p?.display_name || p?.handle || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function Name({ p }: { p: Profile | undefined }) {
  if (!p) return <span className="text-muted">Trader</span>;
  return <Link href={`/u/${p.handle}`} className="font-semibold text-text hover:underline">{p.display_name || p.handle}<span className="ml-1.5 font-normal text-muted">@{p.handle}</span></Link>;
}

function MediaGrid({ media }: { media: Media[] }) {
  const [open, setOpen] = useState<Media | null>(null);
  if (!media.length) return null;
  return (
    <>
      <div className={cx("mt-3 grid gap-1.5 overflow-hidden rounded-xl", media.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {media.map((m) => (
          <button key={m.path} type="button" onClick={() => setOpen(m)} className={cx("relative overflow-hidden bg-bg-2", media.length === 1 ? "max-h-[520px]" : "aspect-square")}>
            {m.kind === "video"
              ? <video src={mediaUrl(m.path) ?? undefined} muted loop playsInline autoPlay className="h-full w-full object-cover" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={mediaUrl(m.path) ?? undefined} alt="" className="h-full w-full object-cover" loading="lazy" />}
          </button>
        ))}
      </div>
      {open && createPortal(
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/90 p-4" onClick={() => setOpen(null)}>
          {open.kind === "video"
            ? <video src={mediaUrl(open.path) ?? undefined} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={mediaUrl(open.path) ?? undefined} alt="" className="max-h-full max-w-full rounded-xl" />}
        </div>, document.body)}
    </>
  );
}

export function TradeChip({ t }: { t: SharedTrade }) {
  const up = (t.r ?? t.net ?? 0) >= 0;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-line-soft bg-bg-2/50 px-4 py-3">
      <span className={cx("grid h-9 w-9 place-items-center rounded-lg", up ? "bg-pos/15 pos" : "bg-neg/15 neg")}>{up ? <TrendingUp size={17} /> : <TrendingDown size={17} />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-text">{t.symbol} <span className="font-normal text-muted">{t.direction === "short" ? "Short" : t.direction === "long" ? "Long" : ""}{t.setup ? ` · ${t.setup}` : ""}</span></p>
        <p className="text-[12px] text-muted">{fmtDate(t.date)}{t.rating ? ` · rated ${t.rating}/10` : ""}</p>
      </div>
      <div className="text-right">
        {t.net !== undefined && t.net !== null && <p className={cx("num text-[15px] font-semibold", up ? "pos" : "neg")}>{fmtMoney(t.net, t.currency ?? "USD", { sign: true })}</p>}
        {t.r !== null && <p className={cx("num", t.net !== undefined && t.net !== null ? "text-[12px] text-muted" : cx("text-[15px] font-semibold", up ? "pos" : "neg"))}>{fmtR(t.r)}</p>}
      </div>
    </div>
  );
}

/** One post with likes, replies and a menu (delete own; report / block others). */
export function PostCard({ post, author, me, profiles, liked, likeCount, replyCount, onDeleted, onBlocked }: {
  post: Post; author: Profile | undefined; me: string; profiles: Map<string, Profile>; liked: boolean; likeCount: number; replyCount: number;
  onDeleted: () => void; onBlocked: (userId: string) => void;
}) {
  const { toast, confirm } = useFeedback();
  const [like, setLikeState] = useState({ on: liked, n: likeCount });
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Reply[] | null>(null);
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [count, setCount] = useState(replyCount);
  const mine = post.user_id === me;
  useEffect(() => setLikeState({ on: liked, n: likeCount }), [liked, likeCount]);

  const toggleLike = async () => {
    const on = !like.on;
    setLikeState({ on, n: like.n + (on ? 1 : -1) });
    try { await setLike(post.id, me, on); } catch (e) { setLikeState(like); toast((e as Error).message, "error"); }
  };
  const openReplies = async () => {
    setOpen(!open);
    if (!list) try { setList(await loadReplies(post.id)); } catch (e) { toast((e as Error).message, "error"); }
  };
  const send = async () => {
    const b = text.trim();
    if (!b) return;
    try { const r = await reply(post.id, me, b); setList([...(list ?? []), r]); setText(""); setCount(count + 1); } catch (e) { toast((e as Error).message, "error"); }
  };
  const doReport = async (type: "post" | "reply", id: string) => {
    const reason = window.prompt("What's wrong with it? (spam, abuse, scam…)")?.trim();
    if (!reason) return;
    try { await report(me, type, id, reason); toast("Reported. Thanks, we'll take a look."); } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <article className="card card-pad prop-rise">
      <header className="flex items-start gap-3">
        <Link href={author ? `/u/${author.handle}` : "#"}><CAvatar p={author} /></Link>
        <div className="min-w-0 flex-1 text-[14px] leading-tight"><Name p={author} /><p className="mt-0.5 text-[12px] text-muted">{ago(post.created_at)}</p></div>
        <div className="relative">
          <button type="button" aria-label="Post options" onClick={() => setMenu(!menu)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-card-2 hover:text-text"><MoreHorizontal size={16} /></button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-card shadow-xl" onMouseLeave={() => setMenu(false)}>
              {mine ? (
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] neg hover:bg-card-2" onClick={async () => { setMenu(false); if (await confirm({ title: "Delete this post?", confirm: "Delete", danger: true })) { try { await deletePost(post); onDeleted(); } catch (e) { toast((e as Error).message, "error"); } } }}><Trash2 size={14} />Delete post</button>
              ) : (
                <>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-2 hover:bg-card-2" onClick={() => { setMenu(false); void doReport("post", post.id); }}><Flag size={14} />Report post</button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text-2 hover:bg-card-2" onClick={async () => { setMenu(false); if (await confirm({ title: `Block @${author?.handle ?? "this trader"}?`, body: "You won't see each other's posts, stories or replies, and they can't message you.", confirm: "Block", danger: true })) { try { await block(me, post.user_id); onBlocked(post.user_id); toast("Blocked"); } catch (e) { toast((e as Error).message, "error"); } } }}><ShieldOff size={14} />Block @{author?.handle}</button>
                </>
              )}
            </div>
          )}
        </div>
      </header>
      {post.body && <p className="mt-3 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-text">{post.body}</p>}
      {post.trade && <TradeChip t={post.trade} />}
      <MediaGrid media={post.media} />
      <footer className="mt-3 flex items-center gap-1 text-[13px] text-text-2">
        <button type="button" onClick={toggleLike} aria-pressed={like.on} className={cx("flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-card-2", like.on && "neg")}><Heart size={16} fill={like.on ? "currentColor" : "none"} className={cx("transition-transform", like.on && "scale-110")} />{like.n || ""}</button>
        <button type="button" onClick={openReplies} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-card-2"><MessageCircle size={16} />{count || ""}</button>
      </footer>
      {open && (
        <div className="mt-2 border-t border-line-soft pt-3">
          {list === null ? <p className="text-[12.5px] text-muted">Loading…</p> : (
            <ul className="flex flex-col gap-3">
              {list.map((r) => {
                const p = profiles.get(r.user_id);
                return (
                  <li key={r.id} className="flex gap-2.5">
                    <CAvatar p={p} size={28} />
                    <div className="min-w-0 flex-1 rounded-xl bg-card-2 px-3 py-2 text-[13.5px]">
                      <div className="flex items-center justify-between gap-2 text-[12.5px]"><Name p={p} /><span className="flex items-center gap-2 text-muted">{ago(r.created_at)}
                        {(r.user_id === me || mine) ? <button type="button" aria-label="Delete reply" className="hover:text-text" onClick={async () => { try { await deleteReply(r.id); setList(list.filter((x) => x.id !== r.id)); setCount(count - 1); } catch (e) { toast((e as Error).message, "error"); } }}><Trash2 size={12} /></button>
                          : <button type="button" aria-label="Report reply" className="hover:text-text" onClick={() => void doReport("reply", r.id)}><Flag size={12} /></button>}</span></div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-text">{r.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Write a reply…" className="input h-10 flex-1" aria-label="Reply" />
            <Button variant="accent" icon={<Send size={14} />} onClick={send} disabled={!text.trim()}>Reply</Button>
          </div>
        </div>
      )}
    </article>
  );
}

/** Write a post: text, up to 10 pictures/videos, and optionally one of your trades. */
export function Composer({ me, profile, crewId, onPosted }: { me: string; profile: Profile; crewId?: string | null; onPosted: (p: Post) => void }) {
  const { toast } = useFeedback();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [trade, setTrade] = useState<SharedTrade | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const post = async () => {
    if (!body.trim() && !files.length && !trade) return;
    setBusy(true);
    try {
      const media: Media[] = [];
      for (const f of files) media.push(await uploadMedia(me, f));
      const p = await createPost({ user_id: me, body: body.trim().slice(0, 2000), media, trade, crew_id: crewId ?? null });
      onPosted(p); setBody(""); setFiles([]); setTrade(null);
    } catch (e) { toast((e as Error).message, "error"); }
    setBusy(false);
  };

  return (
    <div className="card card-pad">
      <div className="flex gap-3">
        <CAvatar p={profile} />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={crewId ? "Share with your crew…" : "How did today go? Share a lesson, a win or a loss…"} style={{ background: "transparent", border: 0, padding: "8px 0", boxShadow: "none", resize: "none" }} />
      </div>
      {previews.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 pl-[52px]">
          {previews.map(({ f, url }) => (
            <span key={url} className="relative h-20 w-20 overflow-hidden rounded-lg bg-bg-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.type.startsWith("video/") ? <video src={url} muted className="h-full w-full object-cover" /> : <img src={url} alt="" className="h-full w-full object-cover" />}
              <button type="button" aria-label="Remove" onClick={() => setFiles(files.filter((x) => x !== f))} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      {trade && <div className="relative pl-[52px]"><TradeChip t={trade} /><button type="button" aria-label="Remove trade" onClick={() => setTrade(null)} className="absolute right-2 top-5 text-muted hover:text-text"><X size={14} /></button></div>}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-3 pl-[52px]">
        <div className="flex gap-1">
          <button type="button" onClick={() => input.current?.click()} disabled={files.length >= 10} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-text-2 hover:bg-card-2 hover:text-text disabled:opacity-40"><ImagePlus size={16} />Photo / video</button>
          <button type="button" onClick={() => setPicking(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-text-2 hover:bg-card-2 hover:text-text"><TrendingUp size={16} />Share a trade</button>
        </div>
        <Button variant="accent" onClick={post} disabled={busy || (!body.trim() && !files.length && !trade)}>{busy ? "Posting…" : "Post"}</Button>
      </div>
      <input ref={input} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 10)); e.target.value = ""; }} />
      {picking && <TradePicker onClose={() => setPicking(false)} onPick={(t) => { setTrade(t); setPicking(false); }} />}
    </div>
  );
}

/** Choose one of your journal trades to share. The amount is hidden unless you switch it on. */
function TradePicker({ onClose, onPick }: { onClose: () => void; onPick: (t: SharedTrade) => void }) {
  const all = useEnriched();
  const accounts = useLedgr((s) => s.accounts);
  const [showAmount, setShowAmount] = useState(false);
  const list = useMemo(() => all.filter((x) => x.m.status === "closed" && !x.trade.copyOf).slice(-40).reverse(), [all]);
  return (
    <Modal open onClose={onClose} title="Share a trade" description="Only what you see here is shared: symbol, direction, date, setup, R and your rating." size="md">
      <label className="mb-3 flex items-center gap-2 text-[13px] text-text-2"><input type="checkbox" checked={showAmount} onChange={(e) => setShowAmount(e.target.checked)} className="accent-[var(--accent)]" />Also show the dollar amount</label>
      {list.length === 0 ? <p className="py-6 text-center text-[13px] text-muted">No closed trades yet.</p> : (
        <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">
          {list.map((x) => {
            const cur = accounts.find((a) => a.id === x.trade.accountId)?.currency ?? "USD";
            return (
              <li key={x.trade.id}>
                <button type="button" className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-card-2/50" onClick={() => onPick({
                  symbol: x.trade.symbol, direction: x.trade.direction, date: x.trade.date, result: x.m.result, r: x.m.r === null ? null : Math.round(x.m.r * 100) / 100,
                  setup: x.trade.setup || undefined, rating: x.trade.reflection.rating ?? null, ...(showAmount ? { net: x.m.net, currency: cur } : {}),
                })}>
                  <span className="min-w-0 flex-1 text-[13.5px]"><span className="font-semibold">{x.trade.symbol}</span> <span className="text-muted">#{x.trade.number} · {fmtDate(x.trade.date)}</span></span>
                  <span className={cx("num text-[13px]", (x.m.net ?? 0) >= 0 ? "pos" : "neg")}>{showAmount ? fmtMoney(x.m.net, cur, { sign: true }) : fmtR(x.m.r)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Stories row: your "add" bubble, then everyone's live stories grouped by person. */
export function StoriesBar({ me, stories, profiles, onChange }: { me: string; stories: Story[]; profiles: Map<string, Profile>; onChange: () => void }) {
  const { toast } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const byUser = useMemo(() => {
    const m = new Map<string, Story[]>();
    for (const s of [...stories].reverse()) m.set(s.user_id, [...(m.get(s.user_id) ?? []), s]);
    return [...m.entries()].sort((a, b) => (a[0] === me ? -1 : b[0] === me ? 1 : 0));
  }, [stories, me]);
  const add = async (f: File | undefined) => {
    if (!f) return;
    const caption = (window.prompt("Caption for your story (optional)") ?? "").slice(0, 200);
    setBusy(true);
    try { const m = await uploadMedia(me, f); await addStory(me, m, caption); toast("Story posted for 24 hours"); onChange(); } catch (e) { toast((e as Error).message, "error"); }
    setBusy(false);
  };
  return (
    <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-[11.5px] text-text-2">
        <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-line text-text-2 transition-colors hover:border-text-2">{busy ? "…" : <Plus size={20} />}</span>Your story
      </button>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov" onChange={(e) => { void add(e.target.files?.[0]); e.target.value = ""; }} />
      {byUser.map(([u, list]) => (
        <button key={u} type="button" onClick={() => setViewing(u)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-[11.5px] text-text-2">
          <span className="rounded-full bg-gradient-to-tr from-[#f2a65a] via-[#e05a8a] to-[#7c6cff] p-[2.5px]"><span className="block rounded-full bg-bg p-[2px]"><CAvatar p={profiles.get(u)} size={56} /></span></span>
          <span className="w-full truncate text-center">{u === me ? "You" : profiles.get(u)?.handle ?? "trader"}</span>
          <span className="sr-only">{list.length} stories</span>
        </button>
      ))}
      {viewing && <StoryViewer list={byUser.find(([u]) => u === viewing)?.[1] ?? []} profile={profiles.get(viewing)} mine={viewing === me} me={me} onClose={() => setViewing(null)} onDeleted={onChange} />}
    </div>
  );
}

function StoryViewer({ list, profile, mine, me, onClose, onDeleted }: { list: Story[]; profile: Profile | undefined; mine: boolean; me: string; onClose: () => void; onDeleted: () => void }) {
  const { toast } = useFeedback();
  const [i, setI] = useState(0);
  const s = list[i];
  useEffect(() => {
    if (!s || s.kind === "video") return;
    const t = setTimeout(() => (i + 1 < list.length ? setI(i + 1) : onClose()), 6000);
    return () => clearTimeout(t);
  }, [i, s, list.length, onClose]);
  if (!s) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95" onClick={onClose}>
      <div className="relative h-full max-h-[92vh] w-full max-w-[460px] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
        <div className="absolute inset-x-3 top-3 z-10 flex gap-1">{list.map((x, j) => <span key={x.id} className={cx("h-0.5 flex-1 rounded-full", j <= i ? "bg-white" : "bg-white/30")} />)}</div>
        <div className="absolute inset-x-3 top-6 z-10 flex items-center gap-2 text-[13px] text-white">
          <CAvatar p={profile} size={30} /><span className="font-semibold">{profile?.handle ?? "trader"}</span><span className="text-white/60">{ago(s.created_at)}</span>
          <span className="flex-1" />
          {mine ? <button type="button" aria-label="Delete story" onClick={async () => { try { await deleteStory(s); onDeleted(); onClose(); } catch (e) { toast((e as Error).message, "error"); } }}><Trash2 size={16} /></button>
            : <button type="button" aria-label="Report story" onClick={async () => { const reason = window.prompt("What's wrong with it?")?.trim(); if (reason) { try { await report(me, "story", s.id, reason); toast("Reported"); } catch (e) { toast((e as Error).message, "error"); } } }}><Flag size={16} /></button>}
          <button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        {s.kind === "video"
          ? <video key={s.id} src={mediaUrl(s.media_path) ?? undefined} autoPlay playsInline className="h-full w-full object-contain" onEnded={() => (i + 1 < list.length ? setI(i + 1) : onClose())} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={s.id} src={mediaUrl(s.media_path) ?? undefined} alt="" className="h-full w-full object-contain" />}
        {s.caption && <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-6 pt-12 text-center text-[15px] text-white">{s.caption}</p>}
        <button type="button" aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={() => setI(Math.max(0, i - 1))} />
        <button type="button" aria-label="Next" className="absolute inset-y-0 right-0 w-1/3" onClick={() => (i + 1 < list.length ? setI(i + 1) : onClose())} />
      </div>
    </div>, document.body);
}
