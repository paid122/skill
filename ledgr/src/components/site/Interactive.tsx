"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { tradeMetrics } from "@/lib/calc";
import { blankTrade } from "@/lib/defaults";
import type { Direction } from "@/lib/types";
import { cx, fmtMoney, fmtNum, fmtR } from "@/lib/util";

// ---------------------------------------------------------------------------
// Headline that reveals word by word
// ---------------------------------------------------------------------------
export function SplitHeadline({ text, className }: { text: string; className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <h1 className={className} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className="inline-block transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)]" style={{ transform: on ? "translateY(0)" : "translateY(105%)", opacity: on ? 1 : 0, transitionDelay: `${120 + i * 110}ms` }}>{w}&nbsp;</span>
        </span>
      ))}
    </h1>
  );
}

// ---------------------------------------------------------------------------
// Soft spotlight that follows the cursor inside its parent
// ---------------------------------------------------------------------------
export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ref.current!.style.setProperty("--x", `${e.clientX - r.left}px`);
      ref.current!.style.setProperty("--y", `${e.clientY - r.top}px`);
      ref.current!.style.opacity = "1";
    };
    const leave = () => { if (ref.current) ref.current.style.opacity = "0"; };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);
  return <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500" style={{ background: "radial-gradient(420px circle at var(--x) var(--y), color-mix(in srgb, var(--ink) 7%, transparent), transparent 70%)" }} />;
}

// ---------------------------------------------------------------------------
// Buttons that lean toward the pointer
// ---------------------------------------------------------------------------
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} className="inline-block transition-transform duration-300 ease-out"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
      }}
      onPointerLeave={() => { if (ref.current) ref.current.style.transform = ""; }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Count up when scrolled into view
// ---------------------------------------------------------------------------
export function CountUp({ to, decimals = 0, prefix = "", suffix = "" }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - start) / 1400); setV(to * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{fmtNum(v, decimals)}{suffix}</span>;
}

// ---------------------------------------------------------------------------
// Live trade calculator — uses Ledgr's real calculation engine
// ---------------------------------------------------------------------------
const PRESETS = [
  { key: "ES", label: "ES futures", pv: 50, entry: 5900, exit: 5912.5, stop: 5894, qty: 1 },
  { key: "EURUSD", label: "EUR/USD", pv: 100000, entry: 1.085, exit: 1.0838, stop: 1.0862, qty: 0.5 },
  { key: "AAPL", label: "AAPL shares", pv: 1, entry: 228.4, exit: 231.9, stop: 226.9, qty: 100 },
];

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-ink/55">{label}</span>
      <input inputMode="decimal" step={step} value={text}
        onChange={(e) => { setText(e.target.value); const n = Number(e.target.value.replace(",", ".")); if (Number.isFinite(n) && e.target.value.trim() !== "") onChange(n); }}
        className="h-11 rounded-xl border border-ink/15 bg-paper px-3.5 font-mono text-[15px] text-ink outline-none transition-colors focus:border-ink/60" />
    </label>
  );
}

export function LiveCalculator() {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [dir, setDir] = useState<Direction>("long");
  const [entry, setEntry] = useState(PRESETS[0].entry);
  const [exit, setExit] = useState(PRESETS[0].exit);
  const [stop, setStop] = useState(PRESETS[0].stop);
  const [qty, setQty] = useState(PRESETS[0].qty);
  const [fees, setFees] = useState(4.2);

  const pick = (p: (typeof PRESETS)[number]) => {
    setPreset(p); setEntry(p.entry); setExit(p.exit); setStop(p.stop); setQty(p.qty);
    setDir(p.key === "EURUSD" ? "short" : "long");
  };

  const m = useMemo(() => {
    const t = blankTrade(1, "demo");
    const time = new Date().toISOString();
    return tradeMetrics({
      ...t, symbol: preset.key, direction: dir, isDraft: false, pointValue: preset.pv, stopPrice: stop, fees,
      executions: [{ id: "a", kind: "entry", price: entry, quantity: qty, time, fees: 0 }, { id: "b", kind: "exit", price: exit, quantity: qty, time, fees: 0 }],
    });
  }, [preset, dir, entry, exit, stop, qty, fees]);

  const r = m.r ?? 0;
  const pos = Math.max(0, Math.min(100, ((r + 2) / 5) * 100)); // scale −2R … +3R
  const stopWrongSide = (dir === "long" && stop >= entry) || (dir === "short" && stop <= entry);

  return (
    <div className="site-shadow grid overflow-hidden rounded-[28px] border border-ink/10 bg-paper lg:grid-cols-[1.05fr_1fr]">
      <div className="border-b border-ink/10 p-7 sm:p-9 lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => <button key={p.key} type="button" onClick={() => pick(p)} className={cx("h-9 rounded-full border px-4 text-[13px] transition-colors", preset.key === p.key ? "border-ink bg-ink text-paper" : "border-ink/15 text-ink/70 hover:border-ink/40")}>{p.label}</button>)}
        </div>
        <div className="mt-6 inline-flex rounded-full border border-ink/15 p-1" role="radiogroup" aria-label="Direction">
          {(["long", "short"] as Direction[]).map((d) => <button key={d} type="button" role="radio" aria-checked={dir === d} onClick={() => setDir(d)} className={cx("h-8 rounded-full px-5 text-[13px] capitalize transition-colors", dir === d ? "bg-ink text-paper" : "text-ink/60")}>{d}</button>)}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <NumField label="Entry price" value={entry} onChange={setEntry} />
          <NumField label="Exit price" value={exit} onChange={setExit} />
          <NumField label="Stop price" value={stop} onChange={setStop} />
          <NumField label={preset.key === "EURUSD" ? "Lots" : preset.key === "ES" ? "Contracts" : "Shares"} value={qty} onChange={setQty} />
          <NumField label="Fees" value={fees} onChange={setFees} />
          <div className="flex flex-col justify-end"><p className="text-[12px] text-ink/45">Point value</p><p className="mt-2 font-mono text-[15px]">{fmtNum(preset.pv, 0)}</p></div>
        </div>
        {stopWrongSide && <p className="mt-4 text-[12.5px] text-ink/60">Your stop is on the wrong side of entry for a {dir} trade, so risk can't be measured.</p>}
      </div>

      <div className="relative flex flex-col justify-between gap-8 bg-paper-2 p-7 sm:p-9">
        <div>
          <p className="text-[12px] text-ink/50">What Ledgr records</p>
          <p className="mt-3 font-mono text-[46px] font-medium leading-none tracking-tight transition-colors" style={{ color: (m.net ?? 0) > 0 ? "var(--pos-site, #1f8a57)" : (m.net ?? 0) < 0 ? "var(--neg-site, #c8373f)" : "var(--ink)" }}>{fmtMoney(m.net, "USD", { sign: true })}</p>
          <p className="mt-2 text-[14px] text-ink/60">{m.result === "win" ? "Winning trade" : m.result === "loss" ? "Losing trade" : m.result === "breakeven" ? "Break-even" : "—"} · {fmtR(m.r)}</p>
        </div>
        <div>
          <div className="relative h-14">
            <div className="absolute inset-x-0 top-6 h-[3px] rounded-full bg-ink/10" />
            {[-2, -1, 0, 1, 2, 3].map((t) => <div key={t} className="absolute top-[18px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${((t + 2) / 5) * 100}%` }}><span className={cx("h-4 w-px", t === 0 ? "bg-ink/60" : "bg-ink/20")} /><span className="mt-1.5 font-mono text-[10.5px] text-ink/45">{t > 0 ? `+${t}` : t}R</span></div>)}
            <div className="absolute top-[11px] -translate-x-1/2 transition-[left] duration-500 ease-[cubic-bezier(.16,1,.3,1)]" style={{ left: `${pos}%` }}>
              <span className="block h-[30px] w-[30px] rounded-full border-[6px] border-paper bg-ink shadow-lg" />
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-ink/10 pt-5 text-[12px] text-ink/50">
          <div>Gross<dd className="mt-1 font-mono text-[15px] text-ink">{fmtMoney(m.gross, "USD")}</dd></div>
          <div>Risk<dd className="mt-1 font-mono text-[15px] text-ink">{fmtMoney(m.risk, "USD")}</dd></div>
          <div>Fees<dd className="mt-1 font-mono text-[15px] text-ink">{fmtMoney(m.totalFees, "USD")}</dd></div>
        </dl>
        <p className="text-[11.5px] leading-relaxed text-ink/45">Net = (exit − entry) × size × point value{dir === "short" ? ", reversed for shorts" : ""}, minus fees. R = net ÷ (|entry − stop| × size × point value). The same engine runs inside the app.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll story: pinned product frame, steps take turns as you scroll
// ---------------------------------------------------------------------------
export interface StoryStep { key: string; kicker: string; title: string; body: string; shot: string }

export function ScrollStory({ steps }: { steps: StoryStep[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i)); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
      <div>
        {steps.map((s, i) => (
          <div key={s.key} ref={(el) => { refs.current[i] = el; }} data-i={i} className="flex min-h-[55vh] flex-col justify-center py-10 lg:min-h-[80vh]">
            <p className={cx("font-mono text-[13px] transition-colors duration-500", active === i ? "text-ink" : "text-ink/30")}>{String(i + 1).padStart(2, "0")} — {s.kicker}</p>
            <h3 className={cx("mt-4 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] transition-colors duration-500 sm:text-[42px]", active === i ? "text-ink" : "text-ink/25")}>{s.title}</h3>
            <p className={cx("mt-4 max-w-md text-[16px] leading-relaxed transition-colors duration-500", active === i ? "text-ink/65" : "text-ink/25")}>{s.body}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/site/${s.shot}.png`} alt="" className="site-shadow mt-8 w-full rounded-2xl border border-ink/10 lg:hidden" />
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-[14vh]">
          <div className="site-shadow relative aspect-[16/10] overflow-hidden rounded-[24px] border border-ink/10 bg-paper-2 p-1.5">
            {steps.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.key} src={`/site/${s.shot}.png`} alt={i === active ? `Ledgr ${s.kicker} screen with simulated sample records` : ""} aria-hidden={i !== active}
                className="absolute inset-1.5 h-[calc(100%-12px)] w-[calc(100%-12px)] rounded-[18px] object-cover object-top transition-[opacity,transform] duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
                style={{ opacity: i === active ? 1 : 0, transform: i === active ? "scale(1)" : "scale(1.03)" }} />
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-2" aria-hidden>
            {steps.map((s, i) => <span key={s.key} className={cx("h-1.5 rounded-full transition-all duration-500", i === active ? "w-8 bg-ink" : "w-1.5 bg-ink/20")} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated discipline ring
// ---------------------------------------------------------------------------
export function Ring({ value }: { value: number }) {
  const ref = useRef<SVGCircleElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const c = 2 * Math.PI * 42;
  return (
    <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90" aria-label={`Discipline score ${Math.round(value)} out of 100`}>
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="8" />
      <circle ref={ref} cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={on ? c * (1 - value / 100) : c} style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1)" }} />
    </svg>
  );
}

/** Draws an SVG path once it scrolls into view. */
export function DrawOnView({ d, className }: { d: string; className?: string }) {
  const ref = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(1000);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    setLen(p.getTotalLength());
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } });
    io.observe(p);
    return () => io.disconnect();
  }, [d]);
  return <path ref={ref} d={d} className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={on ? 0 : len} style={{ transition: "stroke-dashoffset 2.2s cubic-bezier(.16,1,.3,1)" }} />;
}
