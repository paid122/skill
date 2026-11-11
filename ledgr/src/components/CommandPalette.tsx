"use client";
import { BookOpen, FileText, NotebookPen, Plus, Search, SquareLibrary } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { openQuickLog, setPalette } from "@/lib/overlays";
import { useLedgr } from "@/lib/store";
import { cx, fmtDate } from "@/lib/util";
import { VERSES } from "@/lib/verses";
import { ALL_NAV } from "./nav";

interface Result { id: string; group: string; label: string; sub?: string; icon: ReactNode; run: () => void }

export function CommandPalette() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const trades = useLedgr((s) => s.trades);
  const strategies = useLedgr((s) => s.strategies);
  const notes = useLedgr((s) => s.studyNotes);
  const close = () => setPalette(false);
  const go = (href: string) => { close(); router.push(href); };

  useEffect(() => { input.current?.focus(); }, []);

  const results = useMemo<Result[]>(() => {
    const t = q.trim().toLowerCase();
    const out: Result[] = [];
    out.push({ id: "quick", group: "Actions", label: "Quick Log a trade", sub: "N", icon: <Plus size={15} />, run: () => { close(); openQuickLog(); } });
    ALL_NAV.filter((n) => !t || n.label.toLowerCase().includes(t)).forEach((n) => {
      const Icon = n.icon;
      out.push({ id: n.href, group: "Pages", label: n.label, icon: <Icon size={15} />, run: () => go(n.href) });
    });
    if (t) {
      trades
        .filter((x) => x.symbol.toLowerCase().includes(t) || x.setup.toLowerCase().includes(t) || `#${x.number}` === t || String(x.number) === t || x.tags.some((g) => g.toLowerCase().includes(t)))
        .slice(0, 8)
        .forEach((x) => out.push({ id: x.id, group: "Trades", label: `#${x.number} ${x.symbol || "Untitled"} ${x.direction ?? ""}`, sub: `${fmtDate(x.date)}${x.setup ? " · " + x.setup : ""}${x.isDraft ? " · Draft" : ""}`, icon: <NotebookPen size={15} />, run: () => go(`/journal/${x.id}`) }));
      strategies.filter((s) => s.name.toLowerCase().includes(t)).slice(0, 5).forEach((s) => out.push({ id: s.id, group: "Strategies", label: s.name, sub: s.timeframe, icon: <SquareLibrary size={15} />, run: () => go(`/strategies/${s.id}`) }));
      notes.filter((n) => n.title.toLowerCase().includes(t) || n.blocks.some((b) => b.text.toLowerCase().includes(t))).slice(0, 5).forEach((n) => out.push({ id: n.id, group: "Study notes", label: n.title, icon: <FileText size={15} />, run: () => go(`/study?note=${n.id}`) }));
      VERSES.filter((v) => v.reference.toLowerCase().includes(t) || v.text.toLowerCase().includes(t) || v.topics.some((x) => x.toLowerCase().includes(t))).slice(0, 5).forEach((v) => out.push({ id: v.id, group: "Verses", label: v.reference, sub: v.text.slice(0, 70) + (v.text.length > 70 ? "…" : ""), icon: <BookOpen size={15} />, run: () => go(`/verses?verse=${v.id}`) }));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, trades, strategies, notes]);

  useEffect(() => setIdx(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") close();
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    if (e.key === "Enter") { e.preventDefault(); results[idx]?.run(); }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={close} />
      <div role="dialog" aria-label="Search" className="animate-modal relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line-soft px-4">
          <Search size={16} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search trades, strategies, notes, verses…"
            className="h-12 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={results[idx]?.id}
          />
        </div>
        <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto py-2 scroll-thin">
          {results.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">No matches for “{q}”.</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <li key={r.group + r.id}>
                {header && <p className="px-4 pb-1 pt-3 text-[11px] font-medium text-muted">{header}</p>}
                <button
                  id={r.id}
                  role="option"
                  aria-selected={i === idx}
                  type="button"
                  onMouseEnter={() => setIdx(i)}
                  onClick={r.run}
                  className={cx("flex w-full items-center gap-3 px-4 py-2 text-left", i === idx ? "bg-card-2" : "")}
                >
                  <span className="text-muted">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-text">{r.label}</span>
                    {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
