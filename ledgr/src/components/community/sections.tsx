"use client";
/** Community sections: feed, crews, messages and your profile. */
import { ArrowLeft, Copy, Lock, LogOut, Plus, Send, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, EmptyState, Field, Input, Modal, Segmented, Textarea, useFeedback } from "@/components/ui";
import {
  ago, createCrew, crewInvite, crews as loadCrews, deleteCrew, feed, HANDLE_RE, inbox, joinCrew, joinCrewByCode, leaveCrew, liveStories, markRead,
  myCrewIds, postStats, profilesFor, saveProfile, sendMessage, STAT_LABELS, thread, uploadMedia, type Crew, type Message, type Post, type Profile, type StatKey, type Story,
} from "@/lib/community";
import { useEnriched } from "@/lib/hooks";
import { DEFAULT_SHOW, formatStat, journalStats } from "@/lib/publicStats";
import { useLedgr } from "@/lib/store";
import { cx } from "@/lib/util";
import { CAvatar, Composer, Name, PostCard, StoriesBar } from "./parts";

// ------------------------------------------------------------------ feed
export function Feed({ me, profile, crewId }: { me: string; profile: Profile; crewId?: string | null }) {
  const { toast } = useFeedback();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [stats, setStats] = useState<Awaited<ReturnType<typeof postStats>>>({ likes: new Map(), mine: new Set(), replies: new Map() });
  const [more, setMore] = useState(true);

  const load = useCallback(async (before?: string) => {
    try {
      const [page, st] = await Promise.all([feed({ crewId: crewId ?? null, before }), before || crewId ? Promise.resolve(null) : liveStories()]);
      const next = before ? [...(posts ?? []), ...page] : page;
      setPosts(next);
      setMore(page.length === 20);
      if (st) setStories(st);
      const ids = [...next.map((p) => p.user_id), ...(st ?? []).map((s) => s.user_id), me];
      const [profs, s] = await Promise.all([profilesFor(ids), postStats(next.map((p) => p.id), me)]);
      setProfiles(profs); setStats(s);
    } catch (e) { toast((e as Error).message, "error"); setPosts((p) => p ?? []); }
  }, [crewId, me, posts, toast]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPosts(null); void load(); }, [crewId]);
  // Pick up replies' authors lazily: refresh profiles when a reply comes from someone new.
  const allProfiles = useMemo(() => new Map([...profiles, [me, profile]]), [profiles, me, profile]);

  return (
    <div className="flex flex-col gap-4">
      {!crewId && <Card><StoriesBar me={me} stories={stories} profiles={allProfiles} onChange={() => void liveStories().then(setStories)} /></Card>}
      <Composer me={me} profile={profile} crewId={crewId} onPosted={(p) => setPosts([p, ...(posts ?? [])])} />
      {posts === null ? <p className="py-10 text-center text-[13px] text-muted">Loading the feed…</p>
        : posts.length === 0 ? <EmptyState icon={<Users size={18} />} title={crewId ? "No posts in this crew yet" : "Be the first to post"} body="Share a lesson from today, a chart, or how you handled a loss." />
        : posts.map((p) => (
          <PostCard key={p.id} post={p} author={allProfiles.get(p.user_id)} me={me} profiles={allProfiles} liked={stats.mine.has(p.id)} likeCount={stats.likes.get(p.id) ?? 0} replyCount={stats.replies.get(p.id) ?? 0}
            onDeleted={() => setPosts(posts.filter((x) => x.id !== p.id))} onBlocked={(u) => setPosts(posts.filter((x) => x.user_id !== u))} />
        ))}
      {posts && posts.length > 0 && more && <Button onClick={() => void load(posts[posts.length - 1].created_at)} className="self-center">Load more</Button>}
    </div>
  );
}

// ------------------------------------------------------------------ crews
export function Crews({ me, profile }: { me: string; profile: Profile }) {
  const { toast, confirm } = useFeedback();
  const [list, setList] = useState<Crew[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Crew | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const refresh = useCallback(async () => {
    try { const [c, m] = await Promise.all([loadCrews(), myCrewIds(me)]); setList(c); setMine(m); return c; } catch (e) { toast((e as Error).message, "error"); setList([]); return []; }
  }, [me, toast]);
  useEffect(() => { void refresh(); }, [refresh]);

  if (open) return <CrewView crew={open} me={me} profile={profile} isMember={mine.has(open.id)} onBack={() => { setOpen(null); void refresh(); }}
    onLeave={async () => { if (await confirm({ title: `Leave ${open.name}?`, confirm: "Leave" })) { try { await leaveCrew(open.id, me); setOpen(null); void refresh(); } catch (e) { toast((e as Error).message, "error"); } } }}
    onDelete={async () => { if (await confirm({ title: `Delete ${open.name}?`, body: "Its posts are deleted too.", confirm: "Delete crew", danger: true })) { try { await deleteCrew(open.id); setOpen(null); void refresh(); } catch (e) { toast((e as Error).message, "error"); } } }} />;

  const sorted = [...(list ?? [])].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || b.member_count - a.member_count);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" icon={<Plus size={14} />} onClick={() => setCreating(true)}>Start a crew</Button>
        <span className="flex-1" />
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" className="h-9 w-40" aria-label="Invite code" />
        <Button disabled={!code.trim()} onClick={async () => { try { const id = await joinCrewByCode(code); setCode(""); const c = await refresh(); const crew = c.find((x) => x.id === id); if (crew) setOpen(crew); toast("Joined"); } catch (e) { toast((e as Error).message, "error"); } }}>Join with code</Button>
      </div>
      {list === null ? <p className="py-10 text-center text-[13px] text-muted">Loading crews…</p> : sorted.length === 0
        ? <EmptyState icon={<Users size={18} />} title="No crews yet" body="Start one for your trading friends or a strategy you all trade." />
        : <div className="grid gap-3 sm:grid-cols-2">{sorted.map((c) => (
            <button key={c.id} type="button" onClick={() => setOpen(c)} className="card card-pad prop-rise text-left transition-transform hover:-translate-y-0.5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-card-2 text-[18px] font-bold text-text">{c.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 truncate text-[15px] font-semibold text-text">{c.name}{c.is_private && <Lock size={12} className="text-muted" />}</p><p className="text-[12px] text-muted">{c.member_count} member{c.member_count === 1 ? "" : "s"}{mine.has(c.id) ? " · joined" : ""}</p></div>
              </div>
              {c.description && <p className="mt-2 line-clamp-2 text-[13px] text-text-2">{c.description}</p>}
            </button>
          ))}</div>}
      {creating && <CreateCrew me={me} onClose={() => setCreating(false)} onCreated={async (id) => { setCreating(false); const c = await refresh(); const crew = c.find((x) => x.id === id); if (crew) setOpen(crew); }} />}
    </div>
  );
}

function CreateCrew({ me, onClose, onCreated }: { me: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { toast } = useFeedback();
  const [name, setName] = useState(""), [desc, setDesc] = useState(""), [priv, setPriv] = useState(false), [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title="Start a crew" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" disabled={busy || name.trim().length < 2} onClick={async () => { setBusy(true); try { const r = await createCrew(me, name.trim().slice(0, 40), desc.trim().slice(0, 280), priv); onCreated(r.id); } catch (e) { toast((e as Error).message, "error"); } setBusy(false); }}>Create crew</Button></>}>
      <div className="grid gap-4">
        <Field label="Name"><Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="NQ Scalpers, Funded by Friday…" /></Field>
        <Field label="What's it about?"><Textarea value={desc} maxLength={280} onChange={(e) => setDesc(e.target.value)} rows={3} /></Field>
        <Field label="Who can join?"><Segmented value={priv ? "private" : "public"} onChange={(v) => setPriv(v === "private")} options={[{ value: "public", label: "Anyone" }, { value: "private", label: "Invite code only" }]} /></Field>
      </div>
    </Modal>
  );
}

function CrewView({ crew, me, profile, isMember, onBack, onLeave, onDelete }: { crew: Crew; me: string; profile: Profile; isMember: boolean; onBack: () => void; onLeave: () => void; onDelete: () => void }) {
  const { toast } = useFeedback();
  const [member, setMember] = useState(isMember);
  const [invite, setInvite] = useState<string | null>(null);
  useEffect(() => { if (member && crew.is_private) void crewInvite(crew.id).then(setInvite).catch(() => undefined); }, [member, crew]);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back to crews" className="grid h-9 w-9 place-items-center rounded-full hover:bg-card-2"><ArrowLeft size={17} /></button>
        <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-[17px] font-semibold text-text">{crew.name}{crew.is_private && <Lock size={13} className="text-muted" />}</p><p className="text-[12.5px] text-muted">{crew.member_count} member{crew.member_count === 1 ? "" : "s"}{crew.description ? ` · ${crew.description}` : ""}</p></div>
        {invite && <button type="button" onClick={() => { void navigator.clipboard?.writeText(invite); toast("Invite code copied"); }} className="flex items-center gap-1.5 rounded-full bg-card-2 px-3 py-1.5 text-[12.5px] text-text-2 hover:text-text"><Copy size={13} />Invite code: <span className="num">{invite}</span></button>}
        {member ? (crew.owner_id === me ? <Button variant="ghost" onClick={onDelete}>Delete crew</Button> : <Button variant="ghost" icon={<LogOut size={14} />} onClick={onLeave}>Leave</Button>)
          : <Button variant="accent" onClick={async () => { try { await joinCrew(crew.id, me); setMember(true); toast(`Joined ${crew.name}`); } catch (e) { toast((e as Error).message, "error"); } }}>Join crew</Button>}
      </Card>
      {member ? <Feed me={me} profile={profile} crewId={crew.id} /> : <EmptyState icon={<Users size={18} />} title="Join to see the crew's posts" />}
    </div>
  );
}

// ------------------------------------------------------------------ messages
export function Messages({ me, startWith }: { me: string; startWith?: string | null }) {
  const { toast } = useFeedback();
  const [all, setAll] = useState<Message[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [other, setOther] = useState<string | null>(startWith ?? null);
  const refresh = useCallback(async () => {
    try {
      const m = await inbox(me); setAll(m);
      setProfiles(await profilesFor([...m.flatMap((x) => [x.sender_id, x.recipient_id]), ...(startWith ? [startWith] : [])]));
    } catch (e) { toast((e as Error).message, "error"); setAll([]); }
  }, [me, startWith, toast]);
  useEffect(() => { void refresh(); }, [refresh]);
  const convos = useMemo(() => {
    const m = new Map<string, Message>();
    for (const x of all ?? []) { const o = x.sender_id === me ? x.recipient_id : x.sender_id; if (!m.has(o)) m.set(o, x); }
    if (startWith && !m.has(startWith)) m.set(startWith, { id: "new", sender_id: me, recipient_id: startWith, body: "New conversation", created_at: new Date().toISOString(), read_at: null });
    return [...m.entries()];
  }, [all, me, startWith]);
  const unread = (o: string) => (all ?? []).filter((x) => x.sender_id === o && x.recipient_id === me && !x.read_at).length;

  return (
    <div className="grid min-h-[520px] gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
      <Card pad={false} className={cx("overflow-hidden", other && "hidden md:block")}>
        <p className="border-b border-line-soft px-4 py-3 text-[13px] font-semibold text-text">Messages</p>
        {all === null ? <p className="p-4 text-[13px] text-muted">Loading…</p> : convos.length === 0
          ? <p className="p-4 text-[13px] leading-relaxed text-muted">No messages yet. You can message a trader once you both follow each other. Open their profile and tap Message.</p>
          : <ul>{convos.map(([o, last]) => (
              <li key={o}><button type="button" onClick={() => setOther(o)} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-card-2", other === o && "bg-card-2")}>
                <CAvatar p={profiles.get(o)} size={36} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold text-text">{profiles.get(o)?.display_name || profiles.get(o)?.handle || "Trader"}</span><span className="block truncate text-[12px] text-muted">{last.sender_id === me ? "You: " : ""}{last.body}</span></span>
                {unread(o) > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent">{unread(o)}</span>}
              </button></li>
            ))}</ul>}
      </Card>
      {other ? <Thread me={me} other={other} profile={profiles.get(other)} onBack={() => setOther(null)} onSent={refresh} /> : <Card className="hidden place-items-center text-[13px] text-muted md:grid">Pick a conversation</Card>}
    </div>
  );
}

function Thread({ me, other, profile, onBack, onSent }: { me: string; other: string; profile: Profile | undefined; onBack: () => void; onSent: () => void }) {
  const { toast } = useFeedback();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { try { setMsgs(await thread(me, other)); await markRead(me, other); } catch (e) { toast((e as Error).message, "error"); } }, [me, other, toast]);
  useEffect(() => { setMsgs(null); void load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs?.length]);
  const send = async () => {
    const b = text.trim(); if (!b) return;
    try { await sendMessage(me, other, b.slice(0, 2000)); setText(""); await load(); onSent(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Card pad={false} className="flex min-h-[520px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <button type="button" onClick={onBack} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full hover:bg-card-2 md:hidden"><ArrowLeft size={16} /></button>
        <CAvatar p={profile} size={32} /><span className="text-[14px]"><Name p={profile} /></span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {msgs === null ? <p className="text-[13px] text-muted">Loading…</p> : msgs.length === 0 ? <p className="text-center text-[13px] text-muted">Say hi. Be respectful: no financial advice, no selling signals.</p>
          : msgs.map((m) => (
            <div key={m.id} className={cx("flex", m.sender_id === me ? "justify-end" : "justify-start")}>
              <p className={cx("max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px]", m.sender_id === me ? "bg-accent text-on-accent" : "bg-card-2 text-text")}>{m.body}<span className={cx("ml-2 text-[10.5px]", m.sender_id === me ? "opacity-60" : "text-muted")}>{ago(m.created_at)}</span></p>
            </div>
          ))}
        <div ref={end} />
      </div>
      <div className="flex gap-2 border-t border-line-soft p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Message…" className="input h-10 flex-1" aria-label="Message" />
        <Button variant="accent" icon={<Send size={14} />} onClick={send} disabled={!text.trim()}>Send</Button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ profile
export function ProfileEditor({ me, profile, onSaved, first }: { me: string; profile: Profile | null; onSaved: (p: Profile) => void; first?: boolean }) {
  const { toast } = useFeedback();
  const all = useEnriched();
  const accounts = useLedgr((s) => s.accounts);
  const daily = useLedgr((s) => s.dailyJournals);
  const weeklies = useLedgr((s) => s.weeklyJournals);
  const currency = useLedgr((s) => s.settings.baseCurrency);
  const localName = useLedgr((s) => s.settings.displayName);
  const values = useMemo(() => journalStats(all, accounts, daily, weeklies), [all, accounts, daily, weeklies]);
  const [handle, setHandle] = useState(profile?.handle ?? (localName || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20));
  const [name, setName] = useState(profile?.display_name ?? localName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [show, setShow] = useState<Record<StatKey, boolean>>({ ...DEFAULT_SHOW, ...(profile?.public_stats.show ?? {}) } as Record<StatKey, boolean>);
  const [dm, setDm] = useState<"mutual" | "nobody">(profile?.dm_policy ?? "mutual");
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_path ?? null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const valid = HANDLE_RE.test(handle);

  const save = async () => {
    setBusy(true);
    try {
      const shown = Object.fromEntries((Object.keys(STAT_LABELS) as StatKey[]).filter((k) => show[k]).map((k) => [k, values[k]]));
      const p: Profile = { user_id: me, handle, display_name: name.trim().slice(0, 40), bio: bio.trim().slice(0, 280), avatar_path: avatar, dm_policy: dm,
        public_stats: { updatedAt: new Date().toISOString(), show, values: { ...shown, ...(show.net ? { currency } : {}) } as PublicStatsValues } };
      await saveProfile(p);
      onSaved(p);
      toast(first ? "Welcome to the community" : "Profile saved");
    } catch (e) { toast((e as Error).message, "error"); }
    setBusy(false);
  };

  return (
    <Card className="grid gap-5">
      {first && <div><p className="text-[18px] font-semibold text-text">Set up your trader profile</p><p className="mt-1 text-[13.5px] text-text-2">Pick a handle and what stats people see. Your journal stays private; only the numbers you tick are shared.</p></div>}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => file.current?.click()} className="group relative" aria-label="Change profile picture">
          <CAvatar p={{ ...(profile ?? { user_id: me, handle, display_name: name, bio, public_stats: {}, dm_policy: dm }), avatar_path: avatar } as Profile} size={72} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">Change</span>
        </button>
        <input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setAvatar((await uploadMedia(me, f)).path); } catch (err) { toast((err as Error).message, "error"); } }} />
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <Field label="Handle" error={handle && !valid ? "3–20 lowercase letters, numbers or _" : null}><Input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} placeholder="paid" /></Field>
          <Field label="Display name"><Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
      </div>
      <Field label="Bio"><Textarea value={bio} maxLength={280} rows={2} onChange={(e) => setBio(e.target.value)} placeholder="NQ futures · prop trader · building discipline" /></Field>
      <Field label="Stats on your profile" hint="Worked out from your journal (paper accounts and copied trades left out). They update when you save.">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(STAT_LABELS) as StatKey[]).map((k) => (
            <label key={k} className={cx("flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-[13.5px] transition-colors", show[k] ? "border-line bg-card-2" : "border-line-soft")}>
              <span className="flex items-center gap-2"><input type="checkbox" checked={!!show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} className="accent-[var(--accent)]" />{STAT_LABELS[k]}</span>
              <span className="num text-text-2">{formatStat(k, values[k], currency)}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Who can message you"><Segmented value={dm} onChange={setDm} options={[{ value: "mutual", label: "People we both follow" }, { value: "nobody", label: "Nobody" }]} /></Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {profile && <Link href={`/u/${profile.handle}`} className="text-[13px] text-text-2 hover:text-text">View public profile ↗</Link>}
        <Button variant="accent" onClick={save} disabled={busy || !valid}>{busy ? "Saving…" : first ? "Join the community" : "Save profile"}</Button>
      </div>
    </Card>
  );
}
type PublicStatsValues = Partial<Record<StatKey, number | string | null>>;
