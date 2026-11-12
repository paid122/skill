"use client";
/**
 * Full-screen cinematic scenes, drawn in code (no stock photography):
 * layered mountain ridges in fog, drifting mist, light snow and a lone walker.
 * <ScrollScene> pins the scene while the page scrolls and swaps large lines of text.
 */
import { useEffect, useRef, type ReactNode } from "react";
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

// Ridge paths are computed once, not on every frame.
const PATHS = LAYERS.map((l) => ridgePath(l.seed, l.base, l.amp));

/**
 * The landscape itself. Parallax reads the CSS variable --p (0–1) set by an ancestor,
 * so scrolling never re-renders React — the browser only moves composited layers.
 */
export function Landscape({ walker = true, className }: { walker?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cx("absolute inset-0 overflow-hidden", className)} style={{ background: "linear-gradient(180deg,var(--sc-sky1) 0%,var(--sc-sky2) 45%,var(--sc-sky3) 70%)" }}>
      {/* sun glow (a soft gradient — no blur filter to repaint) */}
      <div className="absolute left-1/2 top-[8%] h-[80vmin] w-[80vmin] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side,var(--sc-glow),transparent)" }} />
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="fogband" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--sc-fog)", stopOpacity: 0 }} /><stop offset=".55" style={{ stopColor: "var(--sc-fog)", stopOpacity: "var(--sc-fog-o)" }} /><stop offset="1" style={{ stopColor: "var(--sc-fog)", stopOpacity: 0 }} /></linearGradient>
          <linearGradient id="snowfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--sc-snow1)" }} /><stop offset="1" style={{ stopColor: "var(--sc-snow2)" }} /></linearGradient>
        </defs>
        {LAYERS.map((l, i) => (
          <g key={l.seed} className="scene-layer" style={{ transform: `translate3d(0, calc(var(--p, 0) * ${(-l.speed * 260).toFixed(1)}px), 0)` }}>
            <path d={PATHS[i]} style={{ fill: i === LAYERS.length - 1 ? "url(#snowfade)" : l.fill }} />
            {i < LAYERS.length - 1 && <rect x="0" y={l.base - 40} width="1600" height="160" fill="url(#fogband)" opacity={0.75 - i * 0.08} />}
          </g>
        ))}
        {walker && (
          <g className="scene-layer" style={{ transform: "translate3d(0, calc(var(--p, 0) * -78px), 0)" }}>
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
      {/* drifting mist (soft gradients, GPU-moved; no blur filters) */}
      <div className="mist absolute -left-1/4 top-[44%] h-[26%] w-[150%]" style={{ background: "radial-gradient(closest-side,var(--sc-mist),transparent)" }} />
      <div className="mist mist-slow absolute -left-1/3 top-[60%] h-[30%] w-[160%]" style={{ background: "radial-gradient(closest-side,var(--sc-mist),transparent)" }} />
      {/* soft bottom fade into the page */}
      <div className="absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-b from-transparent to-paper" />
    </div>
  );
}

const smooth = (x: number) => x * x * (3 - 2 * x); // smoothstep easing
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Pinned full-screen scene; lines of text replace each other as the page scrolls.
 * Scroll sets a target; an animation loop eases toward it (inertia), and styles are
 * written straight to the DOM — so wheel steps and trackpads both feel smooth.
 */
export function ScrollScene({ lines, after }: { lines: ReactNode[]; after?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const lineRefs = useRef<(HTMLHeadingElement | null)[]>([]);
  const n = lines.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0, current = -1, raf = 0;

    const read = () => {
      const r = el.getBoundingClientRect();
      target = clamp01(-r.top / Math.max(1, r.height - window.innerHeight));
    };
    const paint = (p: number) => {
      el.style.setProperty("--p", p.toFixed(4));
      lineRefs.current.forEach((h, i) => {
        if (!h) return;
        const start = i / n, end = (i + 1) / n, mid = (start + end) / 2, half = (end - start) / 2;
        // fully visible for the middle 40% of its slice, easing out toward the edges
        let o = 1 - clamp01((Math.abs(p - mid) / half - 0.4) / 0.6);
        if ((i === 0 && p < mid) || (i === n - 1 && p > mid)) o = 1;
        const e = smooth(o);
        const dir = p > mid ? -1 : 1;
        h.style.opacity = e.toFixed(3);
        h.style.transform = `translate3d(0, ${((1 - e) * 36 * dir).toFixed(1)}px, 0) scale(${(0.96 + e * 0.04).toFixed(4)})`;
        h.setAttribute("aria-hidden", e < 0.5 ? "true" : "false");
      });
    };
    const tick = () => {
      const next = reduce ? target : current < 0 ? target : current + (target - current) * 0.09;
      if (Math.abs(next - current) > 0.0002) { current = next; paint(current); raf = requestAnimationFrame(tick); }
      else { current = target; paint(current); raf = 0; }
    };
    const onScroll = () => { read(); if (!raf) raf = requestAnimationFrame(tick); };
    read(); current = target; paint(current);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [n]);

  return (
    <>
      <section ref={ref} className="relative" style={{ height: `${(n + 1) * 100}vh` }}>
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          <Landscape />
          <div className="absolute inset-0 grid place-items-center px-6">
            {lines.map((line, i) => (
              <h2 key={i} ref={(h) => { lineRefs.current[i] = h; }} aria-hidden={i !== 0}
                className="scene-text col-start-1 row-start-1 max-w-[16ch] text-center text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-white will-change-transform sm:text-[72px] lg:text-[104px]"
                style={{ opacity: i === 0 ? 1 : 0 }}>
                {line}
              </h2>
            ))}
          </div>
        </div>
      </section>
      {after && <div className="relative mx-auto -mt-[2vh] max-w-xl px-6 pb-10 text-center">{after}</div>}
    </>
  );
}
