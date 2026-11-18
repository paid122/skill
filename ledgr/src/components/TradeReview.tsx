"use client";
/** The trade review: a 1–10 rating and three prompts (went well, went wrong, to improve). */
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
