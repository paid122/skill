"use client";
import { BookOpen, Check, Copy, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { recordVerseView, toggleFavourite } from "@/lib/actions";
import { useLedgr } from "@/lib/store";
import { selectVerse, type PageKey, type Verse, type VerseContext } from "@/lib/verses";
import { cx } from "@/lib/util";
import { IconButton } from "./ui";

export function VerseCard({ verse, reason, compact = false, className, page }: { verse: Verse; reason?: string; compact?: boolean; className?: string; page?: string }) {
  const fav = useLedgr((s) => s.favouriteVerses.some((f) => f.verseId === verse.id));
  const translation = useLedgr((s) => s.settings.translation);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (page) recordVerseView(verse.id, page);
  }, [verse.id, page]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`“${verse.text}” — ${verse.reference} (${translation})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <figure
      className={cx("relative rounded-[14px] border bg-card-2/70 text-text", compact ? "px-4 py-3.5" : "px-5 py-5 sm:px-6", className)}
      style={{ borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)" }}
    >
      <div className="flex items-start gap-4">
        <span aria-hidden className="mt-1 hidden shrink-0 text-accent sm:block">
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none"><path d="M7 1v16M2 6h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <blockquote className={cx("verse-text text-ivory", compact ? "text-[15px]" : "text-[17px] sm:text-[19px]")}>{verse.text}</blockquote>
          <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{verse.reference}</span>
            <span className="text-[11px] text-muted">{translation}</span>
            {reason && <span className="text-[11px] text-muted">· {reason}</span>}
          </figcaption>
          {!compact && verse.reflection && <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-text-2">{verse.reflection}</p>}
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center">
          <IconButton label={copied ? "Copied" : "Copy verse and reference"} onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </IconButton>
          <IconButton label={fav ? "Remove from favourites" : "Save to favourites"} onClick={() => toggleFavourite(verse.id)} aria-pressed={fav}>
            <Heart size={15} className={fav ? "fill-accent text-accent" : ""} />
          </IconButton>
        </div>
      </div>
    </figure>
  );
}

/** Page verse with context-aware selection (process signals only — never P&L). */
export function PageVerse({ page, context, compact, className }: { page: PageKey; context?: VerseContext; compact?: boolean; className?: string }) {
  const choice = selectVerse(page, context);
  return <VerseCard verse={choice.verse} reason={choice.reason} compact={compact} className={className} page={page} />;
}

export function VerseIcon() {
  return <BookOpen size={15} />;
}
