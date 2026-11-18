"use client";
/** The trade review: a 1–10 rating and three prompts (went well, went wrong, to improve). */
import { AlertTriangle, Pencil, Target, ThumbsUp } from "lucide-react";
import type { Trade } from "@/lib/types";
import { cx } from "@/lib/util";

export const REVIEW_PROMPTS = [
  { key: "wentWell", label: "What went well", placeholder: "Waited for my level, sized right, took profit at the plan…", dot: "bg-pos" },
  { key: "wentWrong", label: "What went wrong", placeholder: "Chased the entry, moved my stop, held through news…", dot: "bg-neg" },
  { key: "improve", label: "What to improve", placeholder: "Next time I'll wait for the candle close before entering…", dot: "bg-[#e0a83a]" },
] as const;

/** Red to amber to green across 1–10. */
export function ratingColor(n: number) {
  return n <= 3 ? "var(--neg)" : n <= 6 ? "#e0a83a" : "var(--pos)";
}
const WORD = ["", "Awful", "Bad", "Poor", "Weak", "OK", "Decent", "Good", "Great", "Excellent", "Perfect"];
export const ratingWord = (n: number) => WORD[n] ?? "";

export function RatingPicker({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-text">Trade rating</p>
        <p className="text-[13px] text-text-2">{value ? <><span className="num text-[18px] font-semibold" style={{ color: ratingColor(value) }}>{value}</span><span className="text-muted">/10 · {ratingWord(value)}</span></> : <span className="text-muted">How well did you trade it? Not the P&amp;L.</span>}</p>
      </div>
      <div role="radiogroup" aria-label="Trade rating" className="mt-2 grid grid-cols-10 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const on = !!value && n <= value;
          return (
            <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} out of 10`} onClick={() => onChange(value === n ? null : n)}
              className={cx("h-9 rounded-lg text-[13px] font-semibold transition-all duration-150 hover:-translate-y-0.5", on ? "text-black" : "bg-card-2 text-text-2 hover:text-text")}
              style={on ? { background: ratingColor(value!) } : undefined}>{n}</button>
          );
        })}
      </div>
    </div>
  );
}

/** A small rating ring for the trade page and lists. */
export function RatingBadge({ value, size = 44 }: { value: number; size?: number }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} title={`Rated ${value}/10`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-2)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ratingColor(value)} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 10)} />
      </svg>
      <span className="num absolute text-[14px] font-semibold text-text" style={{ fontSize: size * 0.32 }}>{value}</span>
    </span>
  );
}

const TONES = {
  wentWell: { icon: ThumbsUp, color: "var(--pos)" },
  wentWrong: { icon: AlertTriangle, color: "var(--neg)" },
  improve: { icon: Target, color: "#e0a83a" },
} as const;
const PLAN = { yes: "Followed the plan", partial: "Partly followed the plan", no: "Didn't follow the plan" } as const;

/** The review on the trade page: rating, then went well / went wrong / to improve as coloured cards. */
export function TradeReviewCard({ t, onEdit }: { t: Trade; onEdit: () => void }) {
  const r = t.reflection;
  const empty = !r.rating && REVIEW_PROMPTS.every((q) => !(r[q.key] ?? "").trim());
  return (
    <div className="card card-pad flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {r.rating ? <RatingBadge value={r.rating} size={56} /> : <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-line text-[13px] text-muted">–</span>}
          <div>
            <p className="text-[15px] font-semibold text-text">Trade review</p>
            <p className="text-[13px] text-text-2">
              {r.rating ? <><span style={{ color: ratingColor(r.rating) }}>{r.rating}/10 · {ratingWord(r.rating)}</span></> : "Not rated yet"}
              {r.followedPlan && <span className="text-muted"> · {PLAN[r.followedPlan]}</span>}
            </p>
          </div>
        </div>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-full bg-card-2 px-3 py-1.5 text-[12.5px] font-medium text-text-2 transition-colors hover:text-text"><Pencil size={12} />{empty ? "Review this trade" : "Edit"}</button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
        {REVIEW_PROMPTS.map((q) => {
          const tone = TONES[q.key], Icon = tone.icon, text = (r[q.key] ?? "").trim();
          return (
            <div key={q.key} className="relative overflow-hidden rounded-xl p-4" style={{ background: `color-mix(in srgb, ${tone.color} 9%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone.color} 22%, transparent)` }}>
              <p className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: tone.color }}><Icon size={14} />{q.label}</p>
              {text
                ? <ul className="mt-2.5 flex flex-col gap-1.5 text-[13.5px] leading-snug text-text">{text.split(/\n+|(?<=[.!?])\s+/).filter(Boolean).map((line, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: tone.color }} />{line}</li>)}</ul>
                : <p className="mt-2.5 text-[13px] text-muted">Nothing written yet</p>}
            </div>
          );
        })}
      </div>
      {r.learned.trim() && <p className="border-t border-line-soft pt-4 text-[13.5px] text-text-2"><span className="text-muted">Lesson · </span>{r.learned}</p>}
    </div>
  );
}
