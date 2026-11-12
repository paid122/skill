"use client";
import { useEffect, useRef } from "react";

/**
 * Optional decorative cursor: a dot that follows the pointer and a ring that trails it,
 * growing over links and buttons. The system cursor stays visible, and the effect is
 * skipped on touch devices and for people who prefer reduced motion.
 */
export function CursorRing() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pos = { x: -100, y: -100 }, trail = { x: -100, y: -100 };
    let scale = 1, target = 1, pressed = false, raf = 0, visible = false;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pos.x = e.clientX; pos.y = e.clientY;
      const el = e.target as Element | null;
      target = el?.closest("a,button,[role=button],[role=tab],[role=switch],[role=checkbox],select,input,textarea,label") ? 1.8 : 1;
      if (!visible) { visible = true; dot.current!.style.opacity = ring.current!.style.opacity = "1"; trail.x = pos.x; trail.y = pos.y; }
    };
    const leave = () => { visible = false; if (dot.current && ring.current) dot.current.style.opacity = ring.current.style.opacity = "0"; };
    const down = () => { pressed = true; };
    const up = () => { pressed = false; };
    const tick = () => {
      trail.x += (pos.x - trail.x) * 0.18;
      trail.y += (pos.y - trail.y) * 0.18;
      scale += ((pressed ? target * 0.8 : target) - scale) * 0.2;
      if (dot.current) dot.current.style.transform = `translate3d(${pos.x - 3}px, ${pos.y - 3}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${trail.x - 16}px, ${trail.y - 16}px, 0) scale(${scale})`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  return (
    <>
      <div ref={ring} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[400] h-8 w-8 rounded-full border border-[color:var(--ink,var(--text))] opacity-0 mix-blend-difference transition-opacity duration-200" style={{ borderColor: "#fff" }} />
      <div ref={dot} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[400] h-1.5 w-1.5 rounded-full opacity-0 mix-blend-difference" style={{ background: "#fff" }} />
    </>
  );
}
