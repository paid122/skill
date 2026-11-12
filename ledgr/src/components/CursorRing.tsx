"use client";
import { useEffect, useRef } from "react";

/**
 * Custom cursor (website, and optional in the app).
 *
 *  - No lag: position is written in the pointer event itself, and the system arrow is hidden
 *    while it's active, so there's never a drawn cursor trailing a real one.
 *  - Stretch: the ring squashes along the direction of travel, more at higher speed.
 *  - Snap: over small buttons and links the ring wraps the element like a highlight.
 *  - Text: over inputs it becomes a blinking text bar.
 *  - Click: the ring tightens and a ripple spreads out.
 * Skipped on touch screens and for people who prefer reduced motion (system cursor stays).
 */
const INTERACTIVE = "a,button,[role=button],[role=tab],[role=switch],[role=checkbox],[role=menuitem],select,summary,label[for]";
const TEXT = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]),textarea,[contenteditable=true]";

export function CursorRing() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const ripples = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const R = ring.current!, D = dot.current!, B = bar.current!, RP = ripples.current!;
    const root = document.documentElement;

    const p = { x: -200, y: -200 }; // pointer
    const v = { x: 0, y: 0 }; // smoothed velocity (px/frame)
    const box = { x: -200, y: -200, w: 34, h: 34, r: 17 }; // drawn ring (eases only when snapping)
    let snap: HTMLElement | null = null, text = false, pressed = false, visible = false, raf = 0, last = performance.now();

    const draw = () => {
      // ring: on the pointer, or wrapped around a snapped element
      let tx = p.x, ty = p.y, tw = 34, th = 34, tr = 17;
      if (snap && snap.isConnected) {
        const rc = snap.getBoundingClientRect();
        const pad = 6;
        // follow the pointer a little inside the element, so it still feels alive
        tx = rc.left + rc.width / 2 + (p.x - (rc.left + rc.width / 2)) * 0.12;
        ty = rc.top + rc.height / 2 + (p.y - (rc.top + rc.height / 2)) * 0.12;
        tw = rc.width + pad * 2; th = rc.height + pad * 2;
        const cs = getComputedStyle(snap).borderRadius;
        tr = Math.min(th / 2, (parseFloat(cs) || 10) + pad);
      }
      const k = snap ? 0.35 : 1; // snap morph eases; free movement is instant
      box.x += (tx - box.x) * k; box.y += (ty - box.y) * k;
      box.w += (tw - box.w) * 0.35; box.h += (th - box.h) * 0.35; box.r += (tr - box.r) * 0.35;

      const speed = Math.hypot(v.x, v.y);
      const stretch = snap || text ? 0 : Math.min(speed / 60, 0.45);
      const ang = snap || text ? 0 : Math.atan2(v.y, v.x); // a wrapped box stays upright
      const press = pressed ? 0.82 : 1;
      R.style.width = `${box.w.toFixed(1)}px`;
      R.style.height = `${box.h.toFixed(1)}px`;
      R.style.borderRadius = `${box.r.toFixed(1)}px`;
      R.style.transform = `translate3d(${(box.x - box.w / 2).toFixed(1)}px, ${(box.y - box.h / 2).toFixed(1)}px, 0) rotate(${ang}rad) scale(${((1 + stretch) * press).toFixed(3)}, ${((1 - stretch * 0.55) * press).toFixed(3)})`;
      R.style.opacity = visible && !text ? "1" : "0";
      R.dataset.snap = snap ? "1" : "";
      D.style.transform = `translate3d(${p.x - 3}px, ${p.y - 3}px, 0) scale(${snap ? 0 : pressed ? 1.6 : 1})`;
      D.style.opacity = visible && !text ? "1" : "0";
      B.style.transform = `translate3d(${p.x - 1}px, ${p.y - 11}px, 0)`;
      B.style.opacity = visible && text ? "1" : "0";
    };

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(64, now - last); last = now;
      const decay = Math.pow(0.82, dt / 16); // velocity settles when the pointer stops
      v.x *= decay; v.y *= decay;
      draw();
      raf = Math.hypot(v.x, v.y) > 0.05 || snap || Math.abs(box.w - (snap ? box.w : 34)) > 0.2 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (visible) { v.x = v.x * 0.5 + dx * 0.5; v.y = v.y * 0.5 + dy * 0.5; }
      p.x = e.clientX; p.y = e.clientY;
      const el = e.target as Element | null;
      text = !!el?.closest(TEXT);
      const hit = text ? null : (el?.closest(INTERACTIVE) as HTMLElement | null);
      const rc = hit?.getBoundingClientRect();
      snap = hit && rc && rc.width < 360 && rc.height < 90 ? hit : null;
      if (!visible) { visible = true; box.x = p.x; box.y = p.y; root.classList.add("cursor-custom"); }
      draw(); // write immediately — no frame of delay
      kick();
    };
    const leave = () => { visible = false; draw(); };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pressed = true; draw(); kick();
      const r = document.createElement("span");
      r.className = "cursor-ripple";
      r.style.left = `${e.clientX}px`; r.style.top = `${e.clientY}px`;
      RP.appendChild(r);
      r.addEventListener("animationend", () => r.remove());
    };
    const up = () => { pressed = false; draw(); kick(); };
    const scroll = () => { if (snap) kick(); };

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("cursor-custom");
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("scroll", scroll);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[400] mix-blend-difference">
      <div ref={ripples} />
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
      <div ref={bar} className="cursor-bar" />
    </div>
  );
}
