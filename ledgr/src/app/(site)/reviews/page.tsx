"use client";
import { BadgeCheck, PenLine, Quote, ShieldCheck, Star, UserCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthButton, AuthError, AuthField } from "@/components/site/AuthBits";
import { Mark } from "@/components/site/Mark";
import { Reveal } from "@/components/site/SiteChrome";
import { supabase, supabaseConfigured, useSession } from "@/lib/supabase";
import { cx, fmtDate } from "@/lib/util";

interface Review { id: string; user_id: string; display_name: string; rating: number; title: string; body: string; status: string; created_at: string }

const GOLD = "#f5b544"; // the star colour, used softly for the glow

function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= n ? "" : "text-ink/20"} style={i <= n ? { color: GOLD, fill: GOLD } : undefined} />)}
    </span>
  );
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
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: approved.filter((r) => r.rating === s).length }));

  return (
    <div className="pb-28">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden px-5 pb-10 pt-32 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-[440px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.16] blur-[110px]" style={{ background: `radial-gradient(closest-side, ${GOLD}, transparent)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at 50% 20%, black, transparent 65%)" }} />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur"><Stars n={5} size={12} /> Reviews</p>
          <h1 className="text-[48px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[80px]">What traders say about <Mark>LEDGR</Mark>.</h1>
          <p className="mx-auto mt-7 max-w-[34rem] text-[17px] leading-relaxed text-ink/60 sm:text-[19px]">Written by people who use LEDGR. Every review comes from a signed-in account and is checked before it appears. We never write or edit them.</p>
        </Reveal>
        <Reveal delay={150} className="relative mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-2.5">
          {[[UserCheck, "Signed-in accounts only"], [ShieldCheck, "Checked before publishing"], [BadgeCheck, "Never edited by us"]].map(([Icon, t]) => {
            const I = Icon as typeof UserCheck;
            return <span key={t as string} className="site-shadow inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-4 py-2 text-[13px] text-ink/70"><I size={14} /> {t as string}</span>;
          })}
        </Reveal>
      </section>

      {/* ------------------------------------------------------ Summary + list */}
      <section className="mx-auto max-w-[1160px] px-5 pt-8 sm:px-8" aria-label="Published reviews">
        {reviews === null ? (
          <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-48 animate-pulse rounded-[22px] bg-ink/[0.05]" />)}</div>
        ) : approved.length === 0 ? (
          <Reveal className="relative overflow-hidden rounded-[30px] border border-dashed border-ink/20 px-8 py-20 text-center">
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl" style={{ background: GOLD }} />
            <Quote size={34} className="relative mx-auto text-ink/20" />
            <p className="relative mt-4 text-[26px] font-semibold tracking-[-0.02em]">Be the first to review LEDGR.</p>
            <p className="relative mx-auto mt-3 max-w-md text-[15.5px] text-ink/55">LEDGR is new. If you&apos;ve journaled with it, your review helps other traders decide, and helps us improve.</p>
            <a href="#write" className="relative mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-paper"><PenLine size={16} /> Write the first review</a>
            {error && <p className="relative mt-4 text-[13px] text-ink/40">{error}</p>}
          </Reveal>
        ) : (
          <>
            <Reveal className="site-shadow mb-10 grid items-center gap-8 rounded-[30px] border border-ink/10 bg-paper p-8 sm:p-10 md:grid-cols-[auto_1fr]">
              <div className="text-center md:border-r md:border-ink/10 md:pr-12">
                <p className="num text-[72px] font-semibold leading-none tracking-[-0.04em]">{avg!.toFixed(1)}</p>
                <div className="mt-3 flex justify-center"><Stars n={Math.round(avg!)} size={20} /></div>
                <p className="mt-2 text-[13px] text-ink/50">{approved.length} review{approved.length === 1 ? "" : "s"}</p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {dist.map(({ s, n }) => (
                  <li key={s} className="grid grid-cols-[34px_1fr_32px] items-center gap-3 text-[13px]">
                    <span className="flex items-center gap-1 text-ink/60">{s}<Star size={12} style={{ color: GOLD, fill: GOLD }} /></span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-ink/[0.07]"><span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${(n / approved.length) * 100}%`, background: GOLD }} /></span>
                    <span className="num text-right text-ink/45">{n}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <ul className="columns-1 gap-4 md:columns-2 lg:columns-3">
              {approved.map((r, i) => (
                <Reveal as="li" key={r.id} delay={Math.min(i, 8) * 50} className="site-shadow mb-4 break-inside-avoid rounded-[22px] border border-ink/10 bg-paper p-7">
                  <div className="flex items-center justify-between"><Stars n={r.rating} /><Quote size={22} className="text-ink/15" /></div>
                  {r.title && <p className="mt-4 text-[17px] font-semibold leading-snug tracking-[-0.01em]">{r.title}</p>}
                  <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink/70">{r.body}</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-ink/10 pt-4">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-[14px] font-semibold text-paper">{r.display_name.charAt(0).toUpperCase()}</span>
                    <div><p className="text-[14px] font-medium">{r.display_name}</p><p className="text-[12px] text-ink/45">{fmtDate(r.created_at)}</p></div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* -------------------------------------------------------------- Write */}
      <section id="write" className="mx-auto max-w-[1160px] scroll-mt-24 px-5 pt-24 sm:px-8">
        <div className="grid items-start gap-10 rounded-[32px] bg-ink p-8 text-paper sm:p-12 lg:grid-cols-[1fr_460px]">
          <Reveal>
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-paper/50">Your turn</p>
            <h2 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[46px]">Used LEDGR? Tell other traders.</h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-paper/60">What changed in your trading since you started journaling? What do you love, and what would you improve? Honest reviews, good or bad, are welcome.</p>
            <ul className="mt-8 flex flex-col gap-3 text-[14.5px] text-paper/70">
              <li className="flex items-center gap-2.5"><BadgeCheck size={17} style={{ color: GOLD }} /> One review per account</li>
              <li className="flex items-center gap-2.5"><BadgeCheck size={17} style={{ color: GOLD }} /> Published after a quick check</li>
              <li className="flex items-center gap-2.5"><BadgeCheck size={17} style={{ color: GOLD }} /> No profit claims or trade signals, please</li>
            </ul>
          </Reveal>
          <Reveal delay={120} className="rounded-[24px] bg-paper p-7 text-ink">
            <h3 className="text-[20px] font-semibold">Write a review</h3>
            {!supabaseConfigured ? <p className="mt-3 text-[14px] text-ink/55">Reviews open once this site is connected to its database.</p>
              : session === undefined ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink/[0.05]" />
                : !session ? <div className="mt-3"><p className="text-[14px] text-ink/55">Log in to share your experience. One review per account.</p><Link href="/login" className="mt-5 flex h-12 items-center justify-center rounded-xl bg-ink text-[15px] font-medium text-paper">Log in to write a review</Link></div>
                  : mine ? <p className="mt-3 rounded-xl bg-ink/[0.04] p-4 text-[14px] text-ink/70">{mine.status === "approved" ? "Thanks! Your review is published." : mine.status === "pending" ? "Thanks! Your review is waiting to be checked." : "Your review wasn't published."}</p>
                    : <ReviewForm defaultName={(session.user.user_metadata?.display_name as string) || ""} userId={session.user.id} onDone={load} />}
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function ReviewForm({ defaultName, userId, onDone }: { defaultName: string; userId: string; onDone: () => void }) {
  const [name, setName] = useState(defaultName);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
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
  const shown = hover || rating;
  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[13px] text-ink/70">Rating</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} className="p-1 transition-transform hover:scale-110">
              <Star size={28} className={cx(i <= shown ? "" : "text-ink/25")} style={i <= shown ? { color: GOLD, fill: GOLD } : undefined} />
            </button>
          ))}
        </div>
      </div>
      <AuthField label="Name shown" name="display" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <AuthField label="Title (optional)" name="title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-body" className="text-[13px] text-ink/70">Your review</label>
        <textarea id="review-body" rows={5} maxLength={1200} value={body} onChange={(e) => setBody(e.target.value)} className="rounded-xl border border-ink/15 bg-ink/[0.03] px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-ink/60" />
        <p className="text-right text-[11.5px] text-ink/35">{body.length} / 1200</p>
      </div>
      <AuthError message={error} />
      <AuthButton type="submit" busy={busy}>Submit review</AuthButton>
      <p className="text-[12px] text-ink/40">Reviews are checked before they appear.</p>
    </form>
  );
}
