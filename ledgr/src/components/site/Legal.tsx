"use client";
import { ArrowUp, Mail } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { smoothScrollToTop } from "@/lib/smoothScroll";
import { cx } from "@/lib/util";

export interface LegalSection { id: string; title: string; icon: ReactNode; body: ReactNode }

/**
 * A legal page people can actually read: a header, a short summary, a table of contents that follows you (and shows
 * where you are), numbered sections, and a contact card.
 */
export function LegalPage({ kicker, title, intro, updated, summary, sections, email, other }: {
  kicker: ReactNode;
  title: ReactNode;
  intro: string;
  updated: string;
  summary: { icon: ReactNode; title: string; body: string }[];
  sections: LegalSection[];
  email: string;
  other: { href: string; label: string };
}) {
  const [active, setActive] = useState(sections[0]?.id);
  // The section you're reading: the last one whose top has passed a line 35% down the screen (the first one at the top).
  useEffect(() => {
    let raf = 0;
    const pick = () => {
      raf = 0;
      const line = window.innerHeight * 0.35;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = document.getElementById(`s-${s.id}`);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      // at the very bottom, the last section is the one being read
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1]?.id;
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [sections]);

  return (
    <div className="pb-28">
      {/* Header */}
      <section className="relative overflow-hidden px-5 pb-14 pt-32 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-20 h-[420px] w-[760px] -translate-x-1/2 rounded-full opacity-[0.09] blur-[110px]" style={{ background: "radial-gradient(closest-side, currentColor, transparent)" }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "26px 26px", maskImage: "radial-gradient(ellipse at 50% 20%, black, transparent 65%)" }} />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1 text-[12.5px] text-ink/70 backdrop-blur">{kicker}</p>
          <h1 className="text-[46px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[72px]">{title}</h1>
          <p className="mx-auto mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink/60">{intro}</p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink/[0.05] px-3.5 py-1.5 text-[12.5px] text-ink/60"><span className="h-1.5 w-1.5 rounded-full bg-ink/40" /> Last updated {updated}</p>
        </div>
      </section>

      {/* The short version */}
      <section className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <div className="rounded-[28px] border border-ink/10 bg-paper p-6 site-shadow sm:p-8">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/45">The short version</p>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {summary.map((s) => (
              <li key={s.title}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-paper">{s.icon}</span>
                <p className="mt-3 text-[15.5px] font-semibold tracking-[-0.01em]">{s.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink/60">{s.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Contents + sections */}
      <section className="mx-auto mt-14 grid max-w-[1100px] gap-10 px-5 sm:px-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-28">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-ink/45">On this page</p>
            <ol className="flex flex-col gap-0.5 border-l border-ink/10">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#s-${s.id}`} className={cx("-ml-px flex gap-2 border-l py-1.5 pl-4 text-[13.5px] transition-colors", active === s.id ? "border-ink font-medium text-ink" : "border-transparent text-ink/50 hover:text-ink")}>
                    <span className="num w-5 shrink-0 text-ink/35">{String(i + 1).padStart(2, "0")}</span>{s.title}
                  </a>
                </li>
              ))}
            </ol>
            <a href="#top" onClick={(e) => { e.preventDefault(); smoothScrollToTop(); }} className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] text-ink/45 hover:text-ink"><ArrowUp size={13} /> Back to top</a>
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {sections.map((s, i) => (
            <article key={s.id} id={`s-${s.id}`} className="scroll-mt-28 rounded-[24px] border border-ink/10 bg-paper p-6 site-shadow sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink/12 bg-ink/[0.03]">{s.icon}</span>
                <div className="min-w-0">
                  <p className="num text-[12px] text-ink/40">{String(i + 1).padStart(2, "0")}</p>
                  <h2 className="text-[21px] font-semibold leading-tight tracking-[-0.02em]">{s.title}</h2>
                </div>
              </div>
              <div className="legal-body mt-5 flex flex-col gap-3 text-[15px] leading-relaxed text-ink/70 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">{s.body}</div>
            </article>
          ))}

          {/* Contact */}
          <div className="relative mt-4 overflow-hidden rounded-[28px] bg-ink p-7 text-paper sm:p-9">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-paper opacity-[0.06] blur-2xl" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[22px] font-semibold tracking-[-0.02em]">Questions? Just ask.</p>
                <p className="mt-1.5 text-[14.5px] text-paper/60">We reply to every message, usually within a few days.</p>
              </div>
              <a href={`mailto:${email}`} className="inline-flex h-12 items-center gap-2 self-start rounded-full bg-paper px-6 text-[15px] font-medium text-ink transition-transform hover:scale-[1.03] sm:self-auto"><Mail size={16} /> {email}</a>
            </div>
          </div>
          <p className="mt-2 text-center text-[13px] text-ink/45">Also read our <a href={other.href} className="text-ink underline underline-offset-4">{other.label}</a>.</p>
        </div>
      </section>
    </div>
  );
}
