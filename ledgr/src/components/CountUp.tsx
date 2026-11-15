"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { COUNT_UP_SECONDS, countUpProgress } from "./PosterCard";

/**
 * A number that counts up to `value` (the same easing as the P&L cards), and glides from the old value
 * to the new one when it changes (e.g. a new date range). Written straight into the DOM, so nothing
 * re-renders per frame. Shows the final value at once for reduced-motion users.
 */
export function CountUp({ value, format, seconds = 1.8, className }: { value: number | null; format: (v: number | null) => string; seconds?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number>(0);
  const fmt = useRef(format);
  fmt.current = format;
  // Before the first paint: start from zero (or the real value when there's nothing to animate).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const still = value === null || !Number.isFinite(value) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.textContent = fmt.current(still ? value : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === null || !Number.isFinite(value) || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = fmt.current(value);
      if (value !== null) shown.current = value;
      return;
    }
    const from = shown.current, to = value;
    const speed = COUNT_UP_SECONDS / seconds;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const q = countUpProgress(((now - t0) / 1000) * speed);
      const v = q >= 1 ? to : from + (to - from) * q;
      shown.current = v;
      el.textContent = fmt.current(v);
      if (q < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); };
  }, [value, seconds]);
  // Text is written by the effects above; screen readers get the real value.
  return <span ref={ref} className={className} role="text" aria-label={format(value)} />;
}
