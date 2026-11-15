"use client";
import { Droplet, Flame } from "lucide-react";
import { useState } from "react";
import { marketGlyph, symbolImage } from "@/lib/instrument";
import type { Market } from "@/lib/types";

/**
 * Small round picture for a symbol: index/exchange logo for futures (MNQ, MES…), bullion for metals
 * (MGC, GC…), coin icons, currency flags or company logos. Falls back to a drawn badge.
 */
export function SymbolIcon({ symbol, market, size = 24, className }: { symbol: string; market: Market | null; size?: number; className?: string }) {
  const pic = symbolImage(symbol, market);
  const key = pic ? (pic.kind === "single" ? pic.src : pic.a + pic.b) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const showPic = pic && failed !== key;
  const g = marketGlyph(symbol, market);
  if (!symbol.trim()) return null;
  /* eslint-disable @next/next/no-img-element */
  if (showPic && pic.kind === "pair") {
    const d = Math.round(size * 0.72);
    return (
      <span className={`relative inline-block shrink-0 ${className ?? ""}`} style={{ width: size, height: size }} aria-hidden>
        <img src={pic.a} alt="" onError={() => setFailed(key)} className="absolute left-0 top-0 rounded-full object-cover ring-1 ring-white/80" style={{ width: d, height: d }} />
        <img src={pic.b} alt="" onError={() => setFailed(key)} className="absolute bottom-0 right-0 rounded-full object-cover ring-1 ring-white/80" style={{ width: d, height: d }} />
      </span>
    );
  }
  const own = showPic && pic.kind === "single" && pic.src.startsWith("/symbols/");
  return (
    <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${showPic && !own ? "bg-white" : showPic ? "" : "bg-bg-2 text-text-2 ring-1 ring-line"} ${className ?? ""}`} style={{ width: size, height: size }} aria-hidden>
      {showPic && pic.kind === "single" ? <img src={pic.src} alt="" onError={() => setFailed(key)} className={own ? "h-full w-full" : "h-[64%] w-[64%] object-contain"} />
        : g.icon === "oil" ? <Droplet size={size * 0.5} strokeWidth={2.4} />
        : g.icon === "gas" ? <Flame size={size * 0.5} strokeWidth={2.4} />
        : <span className="font-bold leading-none tracking-tight" style={{ fontSize: size * (g.text && g.text.length > 2 ? 0.3 : 0.4) }}>{g.text}</span>}
    </span>
  );
}
