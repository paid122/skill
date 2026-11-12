"use client";
/**
 * Full-screen cinematic scenes, drawn in code (no stock photography):
 * layered mountain ridges in fog, drifting mist, light snow and a lone walker.
 * <ScrollScene> pins the scene while the page scrolls and swaps large lines of text.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/util";

/** Deterministic ridge line: a few summed sine octaves, sharpened into peaks. */
function ridgePath(seed: number, base: number, amp: number, w = 1600, h = 900, steps = 260) {
  const r = (n: number) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  const ph = [r(1) * 6.28, r(2) * 6.28, r(3) * 6.28, r(4) * 6.28];
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let v = Math.sin(t * 3.1 + ph[0]) * 0.5 + Math.sin(t * 7.3 + ph[1]) * 0.28 + Math.sin(t * 15.7 + ph[2]) * 0.14;
    v = Math.pow(1 - Math.abs(v), 1.6); // sharpen into ridges
    v += (Math.abs(Math.sin(t * 41.3 + ph[3])) * 0.07 + Math.abs(Math.sin(t * 97.1 + ph[0])) * 0.035) * (0.4 + v); // rocky detail
    pts.push(`${(t * w).toFixed(1)},${(base - v * amp).toFixed(1)}`);
  }
  return `M0,${h + 400} L${pts.join(" L")} L${w},${h + 400} Z`; // extends below so parallax never shows a gap
}

const LAYERS = [
  { seed: 1, base: 430, amp: 300, fill: "var(--sc-r1)", speed: 0.04 },
  { seed: 2, base: 520, amp: 240, fill: "var(--sc-r2)", speed: 0.08 },
  { seed: 3, base: 610, amp: 190, fill: "var(--sc-r3)", speed: 0.13 },
  { seed: 4, base: 700, amp: 150, fill: "var(--sc-r4)", speed: 0.2 },
  { seed: 5, base: 800, amp: 90, fill: "var(--sc-snow1)", speed: 0.3 }, // snowfield in front
];

/** The landscape itself. `progress` (0–1) drives parallax. */
export function Landscape({ progress = 0, walker = true, className }: { progress?: number; walker?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cx("absolute inset-0 overflow-hidden", className)} style={{ background: "linear-gradient(180deg,var(--sc-sky1) 0%,var(--sc-sky2) 45%,var(--sc-sky3) 70%)" }}>
      {/* sun glow */}
      <div className="absolute left-1/2 top-[18%] h-[60vmin] w-[60vmin] -translate-x-1/2 rounded-full blur-[90px]" style={{ background: "var(--sc-glow)" }} />
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="fogband" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--sc-fog)", stopOpacity: 0 }} /><stop offset=".55" style={{ stopColor: "var(--sc-fog)", stopOpacity: "var(--sc-fog-o)" }} /><stop offset="1" style={{ stopColor: "var(--sc-fog)", stopOpacity: 0 }} /></linearGradient>
          <linearGradient id="snowfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--sc-snow1)" }} /><stop offset="1" style={{ stopColor: "var(--sc-snow2)" }} /></linearGradient>
        </defs>
        {LAYERS.map((l, i) => (
          <g key={l.seed} style={{ transform: `translate3d(0, ${progress * l.speed * -260}px, 0)` }}>
            <path d={ridgePath(l.seed, l.base, l.amp)} style={{ fill: i === LAYERS.length - 1 ? "url(#snowfade)" : l.fill }} />
            {i < LAYERS.length - 1 && <rect x="0" y={l.base - 40} width="1600" height="160" fill="url(#fogband)" opacity={0.75 - i * 0.08} />}
          </g>
        ))}
        {walker && (
          <g style={{ transform: `translate3d(0, ${progress * 0.3 * -260}px, 0)` }}>
            {/* footprints trailing toward the viewer */}
            {Array.from({ length: 14 }, (_, i) => (
              <ellipse key={i} cx={800 + (i % 2 ? 7 : -7) + i * 1.2} cy={812 + i * 7.5} rx={2.2 + i * 0.35} ry={0.9 + i * 0.15} style={{ fill: "var(--sc-r2)" }} opacity={0.75 - i * 0.03} />
            ))}
            {/* the walker */}
            <g className="walker" transform="translate(800 790)">
              <ellipse cx="0" cy="20" rx="9" ry="2" fill="#000" opacity=".15" />
              <path d="M-4,-14 Q0,-20 4,-14 L5,4 L2,4 L1,19 L-1,19 L-2,4 L-5,4 Z" style={{ fill: "var(--sc-walker)" }} />
              <circle cx="0" cy="-19" r="4.2" style={{ fill: "var(--sc-walker)" }} />
            </g>
          </g>
        )}
      </svg>
      {/* drifting mist */}
      <div className="mist absolute -left-1/4 top-[46%] h-[22%] w-[150%] blur-2xl" style={{ background: "radial-gradient(closest-side,var(--sc-mist),transparent)" }} />
      <div className="mist mist-slow absolute -left-1/3 top-[62%] h-[26%] w-[160%] blur-3xl" style={{ background: "radial-gradient(closest-side,var(--sc-mist),transparent)" }} />
      {/* soft bottom fade into the page */}
      <div className="absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-b from-transparent to-paper" />
    </div>
  );
}

/** Pinned full-screen scene; lines of text replace each other as the page scrolls. */
export function ScrollScene({ lines, after }: { lines: ReactNode[]; after?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        setP(Math.min(1, Math.max(0, -r.top / Math.max(1, total))));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  const n = lines.length;
  return (
    <>
    <section ref={ref} className="relative" style={{ height: `${(n + 1) * 100}vh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Landscape progress={p} />
        <div className="absolute inset-0 grid place-items-center px-6">
          {lines.map((line, i) => {
            // each line owns an equal slice of the scroll; fade in, hold, fade out
            const start = i / n, end = (i + 1) / n, mid = (start + end) / 2;
            const d = Math.abs(p - mid) / ((end - start) / 2); // 0 at centre, 1 at edges
            const o = i === 0 && p < mid ? 1 : i === n - 1 && p > mid ? 1 : Math.max(0, 1 - Math.max(0, d - 0.35) / 0.65);
            return (
              <h2 key={i} aria-hidden={o < 0.5} className="scene-text col-start-1 row-start-1 max-w-[16ch] text-center text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-[72px] lg:text-[104px]"
                style={{ opacity: o, transform: `translateY(${(1 - o) * (p > mid ? -24 : 24)}px) scale(${0.97 + o * 0.03})`, filter: `blur(${(1 - o) * 8}px)` }}>
                {line}
              </h2>
            );
          })}
        </div>
      </div>
    </section>
    {after && <div className="relative mx-auto -mt-[2vh] max-w-xl px-6 pb-10 text-center">{after}</div>}
    </>
  );
}
