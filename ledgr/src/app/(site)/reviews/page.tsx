"use client";
import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthButton, AuthError, AuthField } from "@/components/site/AuthBits";
import { Reveal } from "@/components/site/SiteChrome";
import { supabase, supabaseConfigured, useSession } from "@/lib/supabase";
import { cx, fmtDate } from "@/lib/util";

interface Review { id: string; user_id: string; display_name: string; rating: number; title: string; body: string; status: string; created_at: string }

function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return <span className="inline-flex gap-0.5" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= n ? "fill-white text-white" : "text-white/25"} />)}</span>;
}

export default function ReviewsPage() {
  const session = useSession();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    const sb = supabase();
    if (!sb) { setReviews([]); return; }
    const { data, error: e } = await sb.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
    if (e) { setError("Reviews couldn't be loaded right now."); setReviews([]); } else setReviews(data as Review[]);
  };
  useEffect(() => { void load(); }, [session?.user.id]);
  const approved = (reviews ?? []).filter((r) => r.status === "approved");
  const mine = (reviews ?? []).find((r) => r.user_id === session?.user.id);
  const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : null;

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-28 pt-32 sm:px-8">
      <Reveal>
        <h1 className="text-[48px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[72px]">Reviews</h1>
        <p className="mt-6 max-w-xl text-[17px] text-white/60">Written by people who use Ledgr. Every review comes from a signed-in account and is checked before it appears — we never write or edit them.</p>
      </Reveal>
      <div className="mt-14 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Published reviews">
          {reviews === null ? <div className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" /> : approved.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/20 px-8 py-16 text-center">
              <p className="text-[20px] font-semibold">No reviews yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-[15px] text-white/55">Ledgr is new. If you've used it, yours could be the first.</p>
              {error && <p className="mt-3 text-[13px] text-white/40">{error}</p>}
            </div>
          ) : (
            <>
              <div className="mb-8 flex items-center gap-4"><p className="font-mono text-[44px]">{avg!.toFixed(1)}</p><div><Stars n={Math.round(avg!)} size={18} /><p className="mt-1 text-[13px] text-white/50">{approved.length} review{approved.length === 1 ? "" : "s"}</p></div></div>
              <ul className="grid gap-4 md:grid-cols-2">
                {approved.map((r, i) => (
                  <Reveal as="li" key={r.id} delay={i * 40} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-6">
                    <Stars n={r.rating} />
                    {r.title && <p className="mt-4 text-[16px] font-semibold">{r.title}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-white/70">{r.body}</p>
                    <p className="mt-5 text-[12.5px] text-white/40">{r.display_name} · {fmtDate(r.created_at)}</p>
                  </Reveal>
                ))}
              </ul>
            </>
          )}
        </section>
        <aside className="rounded-[24px] border border-white/10 p-7 lg:sticky lg:top-24">
          <h2 className="text-[20px] font-semibold">Write a review</h2>
          {!supabaseConfigured ? <p className="mt-3 text-[14px] text-white/55">Reviews open once this site is connected to its database.</p>
            : session === undefined ? null
              : !session ? <div className="mt-3"><p className="text-[14px] text-white/55">Log in to share your experience. One review per account.</p><Link href="/login" className="mt-5 flex h-11 items-center justify-center rounded-xl bg-white text-[15px] font-medium text-black">Log in</Link></div>
                : mine ? <p className="mt-3 text-[14px] text-white/60">{mine.status === "approved" ? "Thanks — your review is published." : mine.status === "pending" ? "Thanks — your review is waiting to be checked." : "Your review wasn't published."}</p>
                  : <ReviewForm defaultName={(session.user.user_metadata?.display_name as string) || ""} userId={session.user.id} onDone={load} />}
        </aside>
      </div>
    </div>
  );
}

function ReviewForm({ defaultName, userId, onDone }: { defaultName: string; userId: string; onDone: () => void }) {
  const [name, setName] = useState(defaultName);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError("Choose a rating.");
    if (!name.trim()) return setError("Add the name to show with your review.");
    if (body.trim().length < 10) return setError("Write at least a sentence (10 characters).");
    setBusy(true);
    const { error: err } = await supabase()!.from("reviews").insert({ user_id: userId, display_name: name.trim().slice(0, 40), rating, title: title.trim().slice(0, 80), body: body.trim().slice(0, 1200) });
    setBusy(false);
    if (err) return setError(err.code === "23505" ? "You've already written a review." : "Couldn't submit your review. Try again.");
    onDone();
  };
  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[13px] text-white/70">Rating</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => setRating(i)} className="p-1"><Star size={24} className={cx(i <= rating ? "fill-white text-white" : "text-white/30")} /></button>)}
        </div>
      </div>
      <AuthField label="Name shown" name="display" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <AuthField label="Title (optional)" name="title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-body" className="text-[13px] text-white/70">Your review</label>
        <textarea id="review-body" rows={5} maxLength={1200} value={body} onChange={(e) => setBody(e.target.value)} className="rounded-xl border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-[15px] text-white outline-none focus:border-white/60" />
      </div>
      <AuthError message={error} />
      <AuthButton type="submit" busy={busy}>Submit review</AuthButton>
      <p className="text-[12px] text-white/40">Reviews are checked before they appear.</p>
    </form>
  );
}
