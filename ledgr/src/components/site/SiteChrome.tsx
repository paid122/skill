"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { supabaseConfigured, useSession } from "@/lib/supabase";
import { cx } from "@/lib/util";
import { LogoMark, Wordmark } from "../Logo";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/reviews", label: "Reviews" },
  { href: "/community", label: "Community" },
  { href: "/affiliates", label: "Affiliates" },
];

export function SiteHeader() {
  const path = usePathname();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 8); f(); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  useEffect(() => setOpen(false), [path]);
  const signedIn = !!session;
  return (
    <header className={cx("fixed inset-x-0 top-0 z-50 transition-[background,border-color] duration-200", scrolled || open ? "border-b border-white/10 bg-black/75 backdrop-blur-xl" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-white" aria-label="Ledgr home"><LogoMark size={26} /><Wordmark className="text-white" /></Link>
        <nav aria-label="Site" className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} className={cx("rounded-full px-3 py-1.5 text-[13.5px] transition-colors", path === l.href ? "text-white" : "text-white/60 hover:text-white")}>{l.label}</Link>)}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 text-[13.5px] font-medium text-black transition-opacity hover:opacity-90">Open Ledgr</Link>
          ) : (
            <>
              {supabaseConfigured && <Link href="/login" className="rounded-full px-4 py-2 text-[13.5px] text-white/70 hover:text-white">Log in</Link>}
              <Link href={supabaseConfigured ? "/signup" : "/dashboard"} className="rounded-full bg-white px-4 py-2 text-[13.5px] font-medium text-black transition-opacity hover:opacity-90">Start free</Link>
            </>
          )}
        </div>
        <button type="button" className="ml-auto grid h-10 w-10 place-items-center rounded-full text-white md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {open && (
        <div className="border-t border-white/10 px-5 pb-6 pt-2 md:hidden">
          {LINKS.map((l) => <Link key={l.href} href={l.href} className="block border-b border-white/5 py-3.5 text-[15px] text-white/80">{l.label}</Link>)}
          <div className="mt-5 flex gap-2">
            {!signedIn && supabaseConfigured && <Link href="/login" className="flex-1 rounded-full border border-white/20 py-2.5 text-center text-sm text-white">Log in</Link>}
            <Link href={signedIn ? "/dashboard" : supabaseConfigured ? "/signup" : "/dashboard"} className="flex-1 rounded-full bg-white py-2.5 text-center text-sm font-medium text-black">{signedIn ? "Open Ledgr" : "Start free"}</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 text-white"><LogoMark size={24} /><Wordmark className="text-white" /></Link>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/50">Discipline over impulse. A private journal for trading decisions, built on simulated and historical records.</p>
        </div>
        <FooterCol title="Product" links={[["Features", "/features"], ["Pricing", "/pricing"], ["Open the app", "/dashboard"]]} />
        <FooterCol title="People" links={[["Reviews", "/reviews"], ["Community", "/community"], ["Affiliates", "/affiliates"]]} />
        <FooterCol title="Legal" links={[["Privacy", "/privacy"], ["Terms", "/terms"]]} />
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-white/10 px-5 py-6 text-[12px] leading-relaxed text-white/40 sm:px-8">
        Ledgr is a journaling and analysis tool. It does not execute trades, connect to brokers, or provide financial advice. All statistics describe records you enter. Scripture quotations are from the King James Version (public domain).
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-white/40">{title}</p>
      <ul className="mt-3 flex flex-col gap-2">{links.map(([l, h]) => <li key={h}><Link href={h} className="text-[13.5px] text-white/70 hover:text-white">{l}</Link></li>)}</ul>
    </div>
  );
}

/** Fades and lifts content into view once, as it enters the viewport. */
export function Reveal({ children, delay = 0, className, as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const style: CSSProperties = { transitionDelay: `${delay}ms` };
  return <Tag ref={ref as never} style={style} className={cx("transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]", shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-6 opacity-0 blur-[2px]", className)}>{children}</Tag>;
}

/** 3D tilt that follows the pointer (disabled for touch and reduced motion). */
export function TiltCard({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1200px) rotateX(${-y * max}deg) rotateY(${x * max}deg)`;
    el.style.setProperty("--gx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--gy", `${(y + 0.5) * 100}%`);
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={reset} className={cx("relative transition-transform duration-300 ease-out will-change-transform [transform-style:preserve-3d]", className)}>
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60 mix-blend-overlay" style={{ background: "radial-gradient(600px circle at var(--gx,50%) var(--gy,0%), rgba(255,255,255,.18), transparent 40%)" }} />
    </div>
  );
}

export function SectionHeading({ kicker, title, sub, center }: { kicker?: string; title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <div className={cx("max-w-2xl", center && "mx-auto text-center")}>
      {kicker && <p className="mb-3 text-[13px] text-white/50">{kicker}</p>}
      <h2 className="text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[44px]">{title}</h2>
      {sub && <p className="mt-4 text-[16px] leading-relaxed text-white/60">{sub}</p>}
    </div>
  );
}
