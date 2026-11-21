"use client";
/** A trader's public profile: picture, bio, the stats they chose to share, and their posts. */
import { BadgeCheck, MessageCircle, UserCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { feed, followCounts, followState, mediaUrl, profileByHandle, setFollow, STAT_LABELS, ago, type Post, type Profile, type StatKey } from "@/lib/community";
import { formatStat } from "@/lib/publicStats";
import { RoleTag } from "@/components/community/Badge";
import { supabaseConfigured, useSession } from "@/lib/supabase";
import { fmtDate, fmtMoney, fmtR } from "@/lib/util";

export default function PublicProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const session = useSession();
  const me = session?.user.id ?? null;
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [rel, setRel] = useState({ iFollow: false, followsMe: false });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) { setP(null); return; }
    profileByHandle(handle).then(async (prof) => {
      setP(prof);
      if (!prof) return;
      const [ps, c] = await Promise.all([feed({ userId: prof.user_id, limit: 30 }), followCounts(prof.user_id)]);
      setPosts(ps); setCounts(c);
    }).catch((e: Error) => { setErr(e.message); setP(null); });
  }, [handle]);
  useEffect(() => { if (me && p && me !== p.user_id) void followState(me, p.user_id).then(setRel).catch(() => undefined); }, [me, p]);

  const toggleFollow = async () => {
    if (!me || !p) return;
    const on = !rel.iFollow;
    setRel({ ...rel, iFollow: on }); setCounts({ ...counts, followers: counts.followers + (on ? 1 : -1) });
    try { await setFollow(me, p.user_id, on); } catch { setRel(rel); setCounts(counts); }
  };

  if (p === undefined) return <div className="px-5 pb-28 pt-40 text-center text-ink/50">Loading…</div>;
  if (!p) return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-40 text-center">
      <h1 className="text-[34px] font-semibold tracking-tight">No trader here</h1>
      <p className="mt-3 text-ink/60">{err ?? `There's no LEDGR profile called @${handle}.`}</p>
      <Link href="/feed" className="mt-8 inline-block rounded-full bg-ink px-5 py-2.5 text-[14px] text-paper">Explore the community</Link>
    </div>
  );
  const values = (p.public_stats.values ?? {}) as Partial<Record<StatKey | "currency", number | string | null>>;
  const shown = (Object.keys(STAT_LABELS) as StatKey[]).filter((k) => p.public_stats.show?.[k] && values[k] !== undefined);
  const avatar = mediaUrl(p.avatar_path);
  const isMe = me === p.user_id;

  return (
    <div className="pb-28">
      <section className="mx-auto max-w-[900px] px-5 pt-32 sm:px-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
          <span className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full bg-ink/10 text-[44px] font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (p.display_name || p.handle).charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[36px] font-semibold leading-tight tracking-[-0.03em]">{p.display_name || p.handle}<RoleTag userId={p.user_id} className="ml-3 px-2 py-0.5 text-[13px]" /></h1>
            <p className="text-[15px] text-ink/55">@{p.handle} · <b className="text-ink">{counts.followers}</b> followers · <b className="text-ink">{counts.following}</b> following</p>
            {p.bio && <p className="mt-3 max-w-xl whitespace-pre-wrap text-[16px] leading-relaxed text-ink/75">{p.bio}</p>}
            {p.public_stats.link && /^https:\/\//.test(p.public_stats.link) && <a href={p.public_stats.link} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2 inline-block text-[14.5px] font-medium text-ink underline underline-offset-4">{p.public_stats.link.replace(/^https:\/\/(www\.)?/, "").slice(0, 60)}</a>}
          </div>
          <div className="flex gap-2">
            {isMe ? <Link href="/feed?tab=profile" className="rounded-full border border-ink/20 px-5 py-2.5 text-[14px]">Edit profile</Link>
              : me ? <>
                  <button type="button" onClick={toggleFollow} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] ${rel.iFollow ? "border border-ink/20" : "bg-ink text-paper"}`}>{rel.iFollow ? <><UserCheck size={15} />Following</> : <><UserPlus size={15} />{rel.followsMe ? "Follow back" : "Follow"}</>}</button>
                  {rel.iFollow && rel.followsMe && p.dm_policy === "mutual" && <Link href={`/feed?dm=${p.user_id}`} className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-2.5 text-[14px]"><MessageCircle size={15} />Message</Link>}
                </>
              : <Link href="/signup" className="rounded-full bg-ink px-5 py-2.5 text-[14px] text-paper">Join LEDGR to follow</Link>}
          </div>
        </div>

        {shown.length > 0 && (
          <div className="mt-10">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-4">
              {shown.map((k) => <div key={k} className="bg-paper px-5 py-4"><p className="text-[12.5px] text-ink/50">{STAT_LABELS[k]}</p><p className="mt-1 text-[24px] font-semibold tracking-tight">{formatStat(k, values[k], String(values.currency ?? "USD"))}</p></div>)}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink/45"><BadgeCheck size={13} />From {p.display_name || p.handle}&apos;s own LEDGR journal{p.public_stats.updatedAt ? `, updated ${fmtDate(p.public_stats.updatedAt.slice(0, 10))}` : ""}. Self-recorded, not broker-verified.</p>
          </div>
        )}

        <h2 className="mt-12 text-[20px] font-semibold tracking-tight">Posts</h2>
        {posts.length === 0 ? <p className="mt-3 text-ink/55">No posts yet.</p> : (
          <ul className="mt-4 flex flex-col gap-4">
            {posts.map((post) => (
              <li key={post.id} className="site-shadow rounded-2xl border border-ink/10 bg-paper p-5">
                <p className="text-[12.5px] text-ink/45">{ago(post.created_at)}</p>
                {post.body && <p className="mt-1.5 whitespace-pre-wrap break-words text-[15.5px] leading-relaxed">{post.body}</p>}
                {post.trade && <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-[13.5px]"><b>{post.trade.symbol}</b>{post.trade.direction && <span className="text-ink/55">{post.trade.direction}</span>}{post.trade.net !== undefined && post.trade.net !== null && <b>{fmtMoney(post.trade.net, post.trade.currency ?? "USD", { sign: true })}</b>}{post.trade.r !== null && <span>{fmtR(post.trade.r)}</span>}<span className="text-ink/45">{fmtDate(post.trade.date)}</span></p>}
                {post.media.length > 0 && (
                  <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${post.media.length > 1 ? "grid-cols-2" : ""}`}>
                    {post.media.map((m) => m.kind === "video"
                      ? <video key={m.path} src={mediaUrl(m.path) ?? undefined} controls playsInline className="max-h-[460px] w-full bg-black object-contain" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img key={m.path} src={mediaUrl(m.path) ?? undefined} alt="" className="max-h-[460px] w-full object-cover" loading="lazy" />)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
