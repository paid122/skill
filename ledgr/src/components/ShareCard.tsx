"use client";
import { forwardRef, type ReactNode } from "react";
import { cx } from "@/lib/util";
import { LogoMark } from "./Logo";

/** Visual themes for shareable cards and reports. Fixed colours so exports look identical everywhere. */
export const CARD_THEMES: Record<string, { name: string; bg: string; fg: string; sub: string; line: string; accent: string; pos: string; neg: string; ruled?: boolean; gradient?: string }> = {
  ledger: { name: "Ledger", bg: "#0B0D10", fg: "#F1F2F0", sub: "#A4AAB1", line: "#262D36", accent: "#C5A66D", pos: "#42B883", neg: "#E36E73", ruled: true },
  graphite: { name: "Graphite", bg: "#1B1F24", fg: "#F4F5F6", sub: "#B9C0C7", line: "#3A424C", accent: "#C5A66D", pos: "#5CC796", neg: "#EE8186" },
  ivory: { name: "Ivory", bg: "#F3EFE6", fg: "#1A1712", sub: "#5E574B", line: "#DCD4C3", accent: "#8E6F33", pos: "#2E7D57", neg: "#B4434A", ruled: true },
  gilt: { name: "Gilt", bg: "#12100C", fg: "#F5EEDF", sub: "#C2B79F", line: "#3A3224", accent: "#D9B877", pos: "#5FC193", neg: "#E57A7F", gradient: "radial-gradient(120% 90% at 100% 0%, rgba(197,166,109,0.28) 0%, rgba(18,16,12,0) 60%)" },
  slate: { name: "Slate", bg: "#0F1620", fg: "#EEF2F6", sub: "#9DAABA", line: "#243244", accent: "#9DB8D9", pos: "#4FC08D", neg: "#E77C80", gradient: "linear-gradient(160deg, rgba(57,135,229,0.16) 0%, rgba(15,22,32,0) 55%)" },
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
                <span className="inline-flex items-center gap-2" style={{ color: t.fg }}>
                  <LogoMark size={20} />
                  <span className="text-[11px] font-semibold tracking-[0.28em]">LEDGR</span>
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
