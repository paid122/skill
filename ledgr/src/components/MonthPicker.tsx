"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cx, parseISODate, toISODate, today } from "@/lib/util";

/** Month calendar for picking a date; marks dates that have entries. */
export function MonthPicker({ value, onChange, marked, partial }: { value: string; onChange: (d: string) => void; marked: Set<string>; partial?: Set<string> }) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const cells = useMemo(() => {
    const first = parseISODate(`${month}-01`);
    const out: (string | null)[] = Array((first.getDay() + 6) % 7).fill(null);
    const d = new Date(first);
    while (d.getMonth() === first.getMonth()) { out.push(toISODate(d)); d.setDate(d.getDate() + 1); }
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);
  const shift = (n: number) => { const d = parseISODate(`${month}-01`); d.setMonth(d.getMonth() + n); setMonth(toISODate(d).slice(0, 7)); };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-text"><ChevronLeft size={16} /></button>
        <span className="text-[13px] font-medium">{parseISODate(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-text"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] text-muted">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="pb-1">{d}</span>)}
        {cells.map((d, i) => d ? (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={d === value}
            aria-label={`${d}${marked.has(d) ? ", has entry" : ""}`}
            className={cx("relative grid aspect-square place-items-center rounded-lg text-[12px] transition-colors", d === value ? "bg-accent text-on-accent" : d === today() ? "border border-accent/50 text-text" : "text-text-2 hover:bg-card-2")}
          >
            {Number(d.slice(8))}
            {marked.has(d) && <span className={cx("absolute bottom-1 h-1 w-1 rounded-full", d === value ? "bg-on-accent" : partial?.has(d) ? "bg-neutral/60" : "bg-accent")} />}
          </button>
        ) : <span key={i} />)}
      </div>
    </div>
  );
}
