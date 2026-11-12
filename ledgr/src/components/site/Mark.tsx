"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** A highlighted word in a heading: italic serif with a hand-drawn underline that draws in on view. */
export function Mark({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="mark-word" data-on={on ? "" : undefined}>
      {children}
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
        <path d="M2 6.5 C 22 2.5, 48 2.8, 66 5.2 S 92 7.6, 98 3.6" pathLength={1} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity=".55" />
      </svg>
    </span>
  );
}
