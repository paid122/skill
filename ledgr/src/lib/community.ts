"use client";
/**
 * LEDGR community: profiles, posts, replies, likes, stories, crews, follows, messages, blocks and
 * reports, stored in Supabase (see supabase/migrations/0004_community.sql). Row-level security in the
 * database decides who can read and write what; these helpers just call it.
 */
import { supabase } from "./supabase";
import { uid } from "./util";

export const MEDIA_BUCKET = "ledgr-community";
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export interface Profile { user_id: string; handle: string; display_name: string; bio: string; avatar_path: string | null; public_stats: PublicStats; dm_policy: "mutual" | "nobody" }
export interface PublicStats { updatedAt?: string; show?: Partial<Record<StatKey, boolean>>; values?: Partial<Record<StatKey, number | string | null>> }
export type StatKey = "trades" | "winRate" | "avgR" | "profitFactor" | "discipline" | "weekStreak" | "bestR" | "net";
export const STAT_LABELS: Record<StatKey, string> = {
  trades: "Trades journaled", winRate: "Win rate", avgR: "Average R", profitFactor: "Profit factor",
  discipline: "Discipline score", weekStreak: "Weekly review streak", bestR: "Best trade", net: "Net P&L",
};
export interface Media { path: string; kind: "image" | "video" }
export interface SharedTrade { symbol: string; direction: string | null; date: string; result: string | null; r: number | null; net?: number | null; currency?: string; setup?: string; rating?: number | null }
export interface Post { id: string; user_id: string; crew_id: string | null; body: string; media: Media[]; trade: SharedTrade | null; created_at: string }
export interface Reply { id: string; post_id: string; user_id: string; body: string; created_at: string }
export interface Story { id: string; user_id: string; media_path: string; kind: "image" | "video"; caption: string; created_at: string; expires_at: string }
export interface Crew { id: string; owner_id: string; name: string; description: string; is_private: boolean; created_at: string; member_count: number }
export interface Message { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }

const sb = () => {
  const c = supabase();
  if (!c) throw new Error("The community needs LEDGR's cloud (Supabase) to be set up.");
  return c;
};
const ok = <T,>(r: { data: T | null; error: { message: string; code?: string } | null }): T => {
  if (r.error) throw new Error(friendly(r.error));
  return r.data as T;
};
function friendly(e: { message: string; code?: string }): string {
  const m = e.message || "";
  if (e.code === "42P01" || /relation .* does not exist|schema cache/i.test(m)) return "The community isn't switched on yet: the owner needs to run the community SQL in Supabase.";
  if (e.code === "23505" && /handle/.test(m)) return "That handle is taken. Try another.";
  if (/reserved for LEDGR/.test(m)) return "That handle is reserved for LEDGR. Pick another one.";
  if (/row-level security/i.test(m)) return "You can't do that here.";
  return m;
}

export const mediaUrl = (path: string | null | undefined) => (path ? sb().storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl : null);

export async function uploadMedia(userId: string, file: File): Promise<Media> {
  const video = file.type.startsWith("video/") || /\.mov$/i.test(file.name);
  const image = file.type.startsWith("image/");
  if (!video && !image) throw new Error(`${file.name}: use a picture (PNG, JPEG, WebP, GIF) or a video (MP4, WebM, MOV).`);
  if (file.size > 40 * 1024 * 1024) throw new Error(`${file.name}: files must be under 40 MB.`);
  const ext = (file.name.split(".").pop() || (video ? "mp4" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const path = `${userId}/${uid("m")}.${ext}`;
  ok(await sb().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }));
  return { path, kind: video ? "video" : "image" };
}

// ---------------------------------------------------------------- profiles
export async function myProfile(userId: string): Promise<Profile | null> {
  return ok(await sb().from("community_profiles").select("*").eq("user_id", userId).maybeSingle()) as Profile | null;
}
export async function profileByHandle(handle: string): Promise<Profile | null> {
  return ok(await sb().from("community_profiles").select("*").eq("handle", handle.toLowerCase()).maybeSingle()) as Profile | null;
}
export async function profilesFor(ids: string[]): Promise<Map<string, Profile>> {
  const uniq = [...new Set(ids)].filter(Boolean);
  if (!uniq.length) return new Map();
  const rows = ok(await sb().from("community_profiles").select("*").in("user_id", uniq)) as Profile[];
  return new Map(rows.map((p) => [p.user_id, p]));
}
export async function saveProfile(p: Partial<Profile> & { user_id: string }) {
  if (p.handle !== undefined && !HANDLE_RE.test(p.handle)) throw new Error("Handles are 3–20 characters: lowercase letters, numbers and _.");
  ok(await sb().from("community_profiles").upsert({ ...p, updated_at: new Date().toISOString() }));
}

// ---------------------------------------------------------------- posts
export async function feed(opts: { crewId?: string | null; userId?: string; before?: string; limit?: number } = {}): Promise<Post[]> {
  let q = sb().from("community_posts").select("*").order("created_at", { ascending: false }).limit(opts.limit ?? 20);
  q = opts.crewId ? q.eq("crew_id", opts.crewId) : q.is("crew_id", null);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.before) q = q.lt("created_at", opts.before);
  return ok(await q) as Post[];
}
export async function createPost(p: { user_id: string; body: string; media: Media[]; trade: SharedTrade | null; crew_id?: string | null }) {
  return ok(await sb().from("community_posts").insert({ ...p, crew_id: p.crew_id ?? null }).select().single()) as Post;
}
export async function deletePost(post: Post) {
  ok(await sb().from("community_posts").delete().eq("id", post.id));
  if (post.media.length) await sb().storage.from(MEDIA_BUCKET).remove(post.media.map((m) => m.path)).catch(() => undefined);
}
export async function replies(postId: string): Promise<Reply[]> {
  return ok(await sb().from("community_replies").select("*").eq("post_id", postId).order("created_at")) as Reply[];
}
export async function reply(postId: string, userId: string, body: string) {
  return ok(await sb().from("community_replies").insert({ post_id: postId, user_id: userId, body }).select().single()) as Reply;
}
export async function deleteReply(id: string) { ok(await sb().from("community_replies").delete().eq("id", id)); }
/** Like counts, reply counts and whether I liked, for a page of posts. */
export async function postStats(ids: string[], me: string | null) {
  if (!ids.length) return { likes: new Map<string, number>(), mine: new Set<string>(), replies: new Map<string, number>() };
  const [l, r] = await Promise.all([
    sb().from("community_likes").select("post_id,user_id").in("post_id", ids),
    sb().from("community_replies").select("post_id").in("post_id", ids),
  ]);
  const likes = new Map<string, number>(), mine = new Set<string>(), rep = new Map<string, number>();
  for (const x of (ok(l) as { post_id: string; user_id: string }[])) { likes.set(x.post_id, (likes.get(x.post_id) ?? 0) + 1); if (x.user_id === me) mine.add(x.post_id); }
  for (const x of (ok(r) as { post_id: string }[])) rep.set(x.post_id, (rep.get(x.post_id) ?? 0) + 1);
  return { likes, mine, replies: rep };
}
export async function setLike(postId: string, userId: string, on: boolean) {
  if (on) ok(await sb().from("community_likes").upsert({ post_id: postId, user_id: userId }));
  else ok(await sb().from("community_likes").delete().eq("post_id", postId).eq("user_id", userId));
}

// ---------------------------------------------------------------- stories
export async function liveStories(): Promise<Story[]> {
  return ok(await sb().from("community_stories").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(100)) as Story[];
}
export async function addStory(userId: string, media: Media, caption: string) {
  ok(await sb().from("community_stories").insert({ user_id: userId, media_path: media.path, kind: media.kind, caption }));
}
export async function deleteStory(s: Story) {
  ok(await sb().from("community_stories").delete().eq("id", s.id));
  await sb().storage.from(MEDIA_BUCKET).remove([s.media_path]).catch(() => undefined);
}

// ---------------------------------------------------------------- crews
export async function crews(): Promise<Crew[]> {
  return ok(await sb().from("community_crews_public").select("*").order("created_at", { ascending: false }).limit(100)) as Crew[];
}
export async function myCrewIds(userId: string): Promise<Set<string>> {
  const rows = ok(await sb().from("community_crew_members").select("crew_id").eq("user_id", userId)) as { crew_id: string }[];
  return new Set(rows.map((r) => r.crew_id));
}
export async function createCrew(ownerId: string, name: string, description: string, isPrivate: boolean) {
  return ok(await sb().from("community_crews").insert({ owner_id: ownerId, name, description, is_private: isPrivate }).select("id").single()) as { id: string };
}
export async function joinCrew(crewId: string, userId: string) { ok(await sb().from("community_crew_members").insert({ crew_id: crewId, user_id: userId })); }
export async function leaveCrew(crewId: string, userId: string) { ok(await sb().from("community_crew_members").delete().eq("crew_id", crewId).eq("user_id", userId)); }
export async function joinCrewByCode(code: string): Promise<string> { return ok(await sb().rpc("community_join_crew", { code: code.trim() })) as string; }
export async function crewInvite(crewId: string): Promise<string | null> { return ok(await sb().rpc("community_crew_invite", { c: crewId })) as string | null; }
export async function deleteCrew(crewId: string) { ok(await sb().from("community_crews").delete().eq("id", crewId)); }

// ---------------------------------------------------------------- follows, blocks, reports
export async function followState(me: string, other: string) {
  const r = ok(await sb().from("community_follows").select("follower_id,followee_id").or(`and(follower_id.eq.${me},followee_id.eq.${other}),and(follower_id.eq.${other},followee_id.eq.${me})`)) as { follower_id: string; followee_id: string }[];
  return { iFollow: r.some((x) => x.follower_id === me), followsMe: r.some((x) => x.follower_id === other) };
}
export async function followCounts(userId: string) {
  const [a, b] = await Promise.all([
    sb().from("community_follows").select("*", { count: "exact", head: true }).eq("followee_id", userId),
    sb().from("community_follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0 };
}
export async function setFollow(me: string, other: string, on: boolean) {
  if (on) ok(await sb().from("community_follows").upsert({ follower_id: me, followee_id: other }));
  else ok(await sb().from("community_follows").delete().eq("follower_id", me).eq("followee_id", other));
}
export async function block(me: string, other: string) {
  ok(await sb().from("community_blocks").upsert({ blocker_id: me, blocked_id: other }));
  await sb().from("community_follows").delete().eq("follower_id", me).eq("followee_id", other);
}
export async function report(me: string, targetType: "post" | "reply" | "story" | "message" | "profile" | "crew", targetId: string, reason: string) {
  ok(await sb().from("community_reports").insert({ reporter_id: me, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500) }));
}

// ---------------------------------------------------------------- messages
export async function inbox(me: string): Promise<Message[]> {
  return ok(await sb().from("community_messages").select("*").or(`sender_id.eq.${me},recipient_id.eq.${me}`).order("created_at", { ascending: false }).limit(500)) as Message[];
}
export async function thread(me: string, other: string): Promise<Message[]> {
  return ok(await sb().from("community_messages").select("*").or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`).order("created_at").limit(500)) as Message[];
}
export async function sendMessage(me: string, to: string, body: string) {
  const r = await sb().from("community_messages").insert({ sender_id: me, recipient_id: to, body });
  if (r.error && /row-level security/i.test(r.error.message)) throw new Error("You can message someone once you both follow each other (and they allow messages).");
  ok(r);
}
export async function markRead(me: string, other: string) {
  await sb().from("community_messages").update({ read_at: new Date().toISOString() }).eq("recipient_id", me).eq("sender_id", other).is("read_at", null);
}

/** Short relative time: "now", "5m", "3h", "2d", then the date. */
export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------- badges
let badgePromise: Promise<Record<string, "Owner" | "Co-owner">> | null = null;
/** Owner / co-owner tags, set on the server from LEDGR_OWNER_EMAILS (can't be self-assigned). */
export function loadBadges() {
  badgePromise ??= fetch("/api/community/badges").then((r) => r.json()).then((j: { badges?: Record<string, "Owner" | "Co-owner"> }) => j.badges ?? {}).catch(() => ({}));
  return badgePromise;
}
