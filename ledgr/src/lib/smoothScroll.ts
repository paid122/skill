"use client";
/**
 * Glide back to the top of the page: eases in, speeds up, and settles softly. Longer pages take a little longer
 * (0.6–1.4 s). Stops if the person scrolls or touches the screen themselves. Instant for people who reduce motion.
 */
export function smoothScrollToTop() {
  const start = window.scrollY;
  if (start <= 0) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, 0); return; }
  const duration = Math.min(1400, Math.max(600, 450 + start * 0.12));
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease-in-out (cubic)
  const t0 = performance.now();
  let raf = 0;
  const stop = () => { cancelAnimationFrame(raf); off(); };
  const off = () => ["wheel", "touchstart", "keydown"].forEach((e) => window.removeEventListener(e, stop));
  ["wheel", "touchstart", "keydown"].forEach((e) => window.addEventListener(e, stop, { passive: true, once: true }));
  const html = document.documentElement;
  const before = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto"; // (our own animation, not the browser's)
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, Math.round(start * (1 - ease(t))));
    if (t < 1) raf = requestAnimationFrame(step);
    else { off(); html.style.scrollBehavior = before; }
  };
  raf = requestAnimationFrame(step);
}
