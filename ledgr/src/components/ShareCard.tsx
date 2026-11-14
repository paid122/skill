"use client";
import { forwardRef, type ReactNode } from "react";
import { cx } from "@/lib/util";
import { LogoMark } from "./Logo";
import { SITE_HOST } from "@/lib/contact";

/** Visual themes for shareable cards and reports. Fixed colours so exports look identical everywhere. */
export const CARD_THEMES: Record<string, { name: string; bg: string; fg: string; sub: string; line: string; accent: string; pos: string; neg: string; ruled?: boolean; gradient?: string }> = {
  ledger: { name: "Black", bg: "#050505", fg: "#F5F5F5", sub: "#A3A3A3", line: "#262626", accent: "#FFFFFF", pos: "#3FBF7F", neg: "#F0646B", ruled: true },
  paper: { name: "White", bg: "#FFFFFF", fg: "#0A0A0A", sub: "#525252", line: "#E5E5E5", accent: "#0A0A0A", pos: "#1F8A57", neg: "#C8373F", ruled: true },
  graphite: { name: "Graphite", bg: "#18181A", fg: "#F6F6F7", sub: "#BDBDC2", line: "#3A3A3F", accent: "#FFFFFF", pos: "#4FC08D", neg: "#F0767C" },
  noir: { name: "Spotlight", bg: "#000000", fg: "#FFFFFF", sub: "#A8A8A8", line: "#2A2A2A", accent: "#FFFFFF", pos: "#3FBF7F", neg: "#F0646B", gradient: "radial-gradient(110% 80% at 85% 0%, rgba(255,255,255,0.16) 0%, rgba(0,0,0,0) 60%)" },
  fog: { name: "Fog", bg: "#F2F2F2", fg: "#111111", sub: "#5C5C5C", line: "#DADADA", accent: "#111111", pos: "#1F8A57", neg: "#C8373F", gradient: "linear-gradient(160deg, rgba(0,0,0,0.06) 0%, rgba(242,242,242,0) 55%)" },
};

export type CardTheme = keyof typeof CARD_THEMES;

export const ShareSurface = forwardRef<HTMLDivElement, { theme: string; font?: "sans" | "serif"; width?: number; children: ReactNode; showLogo?: boolean; footer?: ReactNode; className?: string }>(
  function ShareSurface({ theme, font = "sans", width = 640, children, showLogo = true, footer, className }, ref) {
    const t = CARD_THEMES[theme] ?? CARD_THEMES.ledger;
    return (
      <div
        ref={ref}
        className={cx("relative overflow-hidden rounded-[20px]", className)}
        style={{
          width,
          maxWidth: "100%",
          background: t.bg,
          color: t.fg,
          fontFamily: font === "serif" ? "Newsreader, Georgia, serif" : "'Inter Variable', Inter, system-ui, sans-serif",
          backgroundImage: [t.gradient, t.ruled ? `repeating-linear-gradient(to bottom, transparent 0 31px, ${t.line}55 31px 32px)` : null].filter(Boolean).join(", ") || undefined,
          border: `1px solid ${t.line}`,
          ["--c-accent" as string]: t.accent,
        }}
      >
        <div style={{ padding: 36 }}>
          {children}
          {(showLogo || footer) && (
            <div className="mt-8 flex items-center justify-between gap-4 pt-5" style={{ borderTop: `1px solid ${t.line}` }}>
              <span className="text-[11px]" style={{ color: t.sub }}>{footer}</span>
              {showLogo && (
                <span className="inline-flex flex-col items-end gap-1" style={{ color: t.fg }}>
                  <span className="inline-flex items-center gap-2"><LogoMark size={20} /><span className="text-[11px] font-semibold tracking-[0.28em]">LEDGR</span></span>
                  <span className="text-[10.5px] font-medium" style={{ color: t.sub }}>{SITE_HOST}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

export function themeColors(theme: string) {
  return CARD_THEMES[theme] ?? CARD_THEMES.ledger;
}

/** Minimal inline SVG equity line for exports (no external chart dependencies). */
export function MiniCurve({ values, color, line, height = 90 }: { values: number[]; color: string; line: string; height?: number }) {
  if (values.length < 2) return null;
  const w = 560;
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - ((v - min) / span) * (height - 8) - 4]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const zero = height - ((0 - min) / span) * (height - 8) - 4;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2={w} y1={zero} y2={zero} stroke={line} strokeDasharray="4 4" />
      <path d={`${d} L${w},${zero} L0,${zero} Z`} fill={color} opacity="0.14" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
