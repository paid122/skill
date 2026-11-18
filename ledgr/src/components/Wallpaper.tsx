"use client";
/**
 * The app's wallpaper: a live (animated) one drawn by LEDGR, or the trader's own video or image.
 * Sits fixed behind everything; a dim layer in the theme's background colour keeps text readable.
 * Animations stop while the tab is hidden and are frozen for reduced-motion users.
 */
import { useEffect, useRef } from "react";
import type { LiveWallpaper, Wallpaper as WallpaperSettings } from "@/lib/types";
import { useBlobUrl } from "./BlobImage";

export const LIVE_WALLPAPERS: { value: LiveWallpaper; name: string; sub: string }[] = [
  { value: "aurora", name: "Aurora", sub: "Slow drifting light" },
  { value: "candles", name: "Candles", sub: "A chart that keeps printing" },
  { value: "rays", name: "Morning light", sub: "Light from above" },
  { value: "particles", name: "Network", sub: "Connected points" },
  { value: "grid", name: "Horizon", sub: "A grid rolling forward" },
];

export function Wallpaper({ w }: { w: WallpaperSettings }) {
  if (w.kind === "none") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" style={{ filter: w.blur ? `blur(${w.blur}px)` : undefined, transform: w.blur ? "scale(1.06)" : undefined }}>
        {w.kind === "live" ? <Live kind={w.live} /> : <Upload kind={w.kind} blobId={w.blobId} />}
      </div>
      <div className="absolute inset-0" style={{ background: "var(--bg)", opacity: w.dim }} />
    </div>
  );
}

function Upload({ kind, blobId }: { kind: "image" | "video"; blobId: string | null }) {
  const { url } = useBlobUrl(blobId);
  if (!url) return null;
  return kind === "video"
    ? <video src={url} autoPlay muted loop playsInline className="h-full w-full object-cover" />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={url} alt="" className="h-full w-full object-cover" />;
}

export function Live({ kind }: { kind: LiveWallpaper }) {
  if (kind === "aurora") return <Aurora />;
  if (kind === "rays") return <Rays />;
  return <CanvasWallpaper kind={kind} />;
}

function Aurora() {
  return (
    <div className="absolute inset-0 bg-[#04060a]">
      <span className="wp-blob" style={{ background: "#1d8a6c", left: "-10%", top: "-15%", animationDuration: "26s" }} />
      <span className="wp-blob" style={{ background: "#2f55b0", right: "-15%", top: "10%", animationDuration: "32s", animationDelay: "-8s" }} />
      <span className="wp-blob" style={{ background: "#7a3aa6", left: "25%", bottom: "-25%", animationDuration: "38s", animationDelay: "-16s" }} />
      <span className="wp-blob" style={{ background: "#16708f", right: "20%", bottom: "-10%", width: "38vmax", height: "38vmax", animationDuration: "30s", animationDelay: "-4s" }} />
    </div>
  );
}

function Rays() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,#3a3020,#0b0a08_55%,#050505)]">
      <div className="wp-rays absolute left-1/2 top-[-40vmax] h-[120vmax] w-[120vmax] -translate-x-1/2" />
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,236,190,0.22),transparent)]" />
      {Array.from({ length: 28 }, (_, i) => (
        <span key={i} className="wp-dust" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${-(i * 1.7) % 18}s`, animationDuration: `${14 + (i % 7) * 2}s` }} />
      ))}
    </div>
  );
}

/** Candles, Network and Horizon, drawn on a canvas at up to 30 fps. */
function CanvasWallpaper({ kind }: { kind: "candles" | "particles" | "grid" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0, last = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    window.addEventListener("resize", size);

    // Candles: a random walk that keeps printing new bars on the right.
    const bars: { o: number; h: number; l: number; c: number }[] = [];
    let price = 100, partial = 0;
    const next = () => {
      const o = price, c = o + (Math.random() - 0.48) * 2.4;
      bars.push({ o, c, h: Math.max(o, c) + Math.random() * 1.2, l: Math.min(o, c) - Math.random() * 1.2 });
      price = c;
    };
    for (let i = 0; i < 160; i++) next();

    // Network: drifting points joined when close.
    const pts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.00025, vy: (Math.random() - 0.5) * 0.00025 }));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      if (kind === "candles") {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#05070a"); g.addColorStop(1, "#020203");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const bw = 14, n = Math.ceil(W / bw) + 2, shown = bars.slice(-n);
        const hi = Math.max(...shown.map((b) => b.h)), lo = Math.min(...shown.map((b) => b.l));
        const y = (v: number) => H * 0.18 + (1 - (v - lo) / (hi - lo || 1)) * H * 0.64;
        const off = partial * bw;
        shown.forEach((b, i) => {
          const x = W - (shown.length - i) * bw - off + bw;
          const up = b.c >= b.o;
          ctx.globalAlpha = 0.18 + 0.5 * (i / shown.length);
          ctx.strokeStyle = ctx.fillStyle = up ? "#3fbf7f" : "#f0646b";
          ctx.beginPath(); ctx.moveTo(x + bw / 2, y(b.h)); ctx.lineTo(x + bw / 2, y(b.l)); ctx.lineWidth = 1; ctx.stroke();
          const top = y(Math.max(b.o, b.c)), h = Math.max(1.5, Math.abs(y(b.o) - y(b.c)));
          ctx.fillRect(x + 3, top, bw - 6, h);
        });
        ctx.globalAlpha = 0.55;
        const py = y(price);
        ctx.setLineDash([4, 6]); ctx.strokeStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        partial += 0.006;
        if (partial >= 1) { partial = 0; next(); if (bars.length > 600) bars.splice(0, 300); }
      } else if (kind === "grid") {
        // A floor grid rolling toward you under a glowing horizon.
        const hy = H * 0.42, vx = W / 2;
        const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#020203"); sky.addColorStop(0.42, "#0a1222"); sky.addColorStop(1, "#05070c");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        const glow = ctx.createRadialGradient(vx, hy, 0, vx, hy, W * 0.5); glow.addColorStop(0, "rgba(80,150,255,0.28)"); glow.addColorStop(1, "rgba(80,150,255,0)");
        ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#6aa8ff"; ctx.lineWidth = 1;
        for (let i = -24; i <= 24; i++) {
          ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(vx + i * 6, hy); ctx.lineTo(vx + i * W * 0.12, H); ctx.stroke();
        }
        const phase = (t / 2600) % 1;
        for (let k = 0; k < 18; k++) {
          const z = k + 1 - phase; // distance; shrinks as rows roll in
          const yy = hy + (H - hy) * (1 / z);
          if (yy > H || yy < hy) continue;
          ctx.globalAlpha = Math.min(0.55, 0.12 + (yy - hy) / (H - hy) * 0.6);
          ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
        }
        ctx.globalAlpha = 0.9; ctx.strokeStyle = "#9cc6ff"; ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#040507"; ctx.fillRect(0, 0, W, H);
        for (const p of pts) { p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1; }
        const max = Math.min(W, H) * 0.18;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], ax = a.x * W, ay = a.y * H;
          for (let j = i + 1; j < pts.length; j++) {
            const b = pts[j], d = Math.hypot(ax - b.x * W, ay - b.y * H);
            if (d < max) { ctx.globalAlpha = (1 - d / max) * 0.35; ctx.strokeStyle = "#8fb8ff"; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x * W, b.y * H); ctx.stroke(); }
          }
          ctx.globalAlpha = 0.8; ctx.fillStyle = "#cfe0ff"; ctx.beginPath(); ctx.arc(ax, ay, 1.6 + Math.sin(t / 900 + i) * 0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || t - last < 33) return;
      last = t;
      draw(t);
    };
    if (still) draw(0); else raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); };
  }, [kind]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
