"use client";
import { Check, ChevronDown, PanelRightClose } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { toggleChecklist } from "@/lib/actions";
import { tradeMetrics } from "@/lib/calc";
import { setUI } from "@/lib/hooks";
import { useLedgr } from "@/lib/store";
import { cx, fmtMoney, fmtR, today } from "@/lib/util";
import { IconButton, Progress } from "./ui";

/**
 * Session rail: today's plan, checklist, session so far, practice limits and recent trades.
 * Everything comes from saved records; nothing here places or blocks trades.
 */
export function SessionRail() {
  const t = today();
  const trades = useLedgr((s) => s.trades);
  const accounts = useLedgr((s) => s.accounts);
  const journal = useLedgr((s) => s.dailyJournals.find((j) => j.date === t));
  const checklist = useLedgr((s) => s.settings.checklist);
  const done = useLedgr((s) => s.checklistLog[t]) ?? [];
  const threshold = useLedgr((s) => s.settings.breakevenThreshold);

  const todays = useMemo(() => trades.filter((x) => x.date === t).map((trade) => ({ trade, m: tradeMetrics(trade, { breakevenThreshold: threshold }) })), [trades, t, threshold]);
  const closed = todays.filter((x) => x.m.status === "closed");
  const answered = todays.filter((x) => x.trade.reflection.followedPlan);
  const kept = answered.filter((x) => x.trade.reflection.followedPlan === "yes").length;
  const netR = closed.reduce((s, x) => s + (x.m.r ?? 0), 0);
  const rCount = closed.filter((x) => x.m.r !== null).length;
  const recent = useMemo(() => [...trades].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5), [trades]);
  const limits = accounts.filter((a) => a.status === "active" && a.rules.dailyLossLimit).map((a) => {
    const net = closed.filter((x) => x.trade.accountId === a.id).reduce((s, x) => s + (x.m.net ?? 0), 0);
    const used = Math.max(0, -net);
    return { a, net, used, pct: (used / (a.rules.dailyLossLimit as number)) * 100 };
  });

  return (
    <aside aria-label="Session" className="fixed inset-y-0 right-0 z-20 hidden w-[300px] flex-col border-l border-line-soft bg-sidebar xl:flex">
      <div className="flex h-16 items-center justify-between px-5">
        <span className="text-[13px] font-semibold">Today</span>
        <IconButton label="Hide session panel" onClick={() => setUI({ rail: false })}><PanelRightClose size={16} /></IconButton>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-6 scroll-thin">
        <Section title="The plan" action={<Link href="/daily-journal" className="text-[12px] text-text-2 hover:text-text">{journal?.pre.intentions ? "Edit" : "Write"}</Link>}>
          {journal?.pre.intentions ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-2">{journal.pre.intentions}</p>
          ) : (
            <Link href="/daily-journal" className="block rounded-xl border border-dashed border-line px-3 py-3 text-center text-[12.5px] text-muted hover:border-muted hover:text-text-2">No plan for today yet</Link>
          )}
        </Section>

        <Section title="Checklist" action={<span className="font-mono text-[12px] text-muted">{checklist.filter((c) => done.includes(c.id)).length}/{checklist.length}</span>}>
          <ul className="flex flex-col">
            {checklist.map((c) => {
              const on = done.includes(c.id);
              return (
                <li key={c.id}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => toggleChecklist(t, c.id)} className="flex w-full items-start gap-2.5 rounded-lg py-1.5 text-left text-[13px] hover:text-text">
                    <span className={cx("mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors", on ? "border-accent bg-accent text-on-accent" : "border-line")}>{on && <Check size={10} strokeWidth={3} />}</span>
                    <span className={on ? "text-muted line-through" : "text-text-2"}>{c.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Session">
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Trades" value={String(todays.length)} />
            <Mini label="Net R" value={rCount ? fmtR(netR) : "—"} tone={rCount ? netR : null} />
            <Mini label="Plan kept" value={answered.length ? `${kept}/${answered.length}` : "—"} />
          </dl>
          {todays.length === 0 && <p className="mt-3 text-[12px] text-muted">No trades logged today.</p>}
        </Section>

        {limits.length > 0 && (
          <Section title="Practice limits">
            <ul className="flex flex-col gap-3">
              {limits.map(({ a, used, pct }) => (
                <li key={a.id}>
                  <div className="mb-1.5 flex justify-between text-[12px]"><span className="truncate text-text-2">{a.name}</span><span className="num text-muted">{fmtMoney(used, a.currency)} / {fmtMoney(a.rules.dailyLossLimit, a.currency)}</span></div>
                  <Progress value={pct} tone={pct >= 80 ? "neg" : "accent"} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted">Today's losses against the daily limits you set. For awareness only.</p>
          </Section>
        )}

        <Section title="Recent trades" action={<Link href="/journal" className="text-[12px] text-text-2 hover:text-text">All</Link>}>
          {recent.length === 0 ? <p className="text-[12.5px] text-muted">Nothing logged yet.</p> : (
            <ul className="flex flex-col">
              {recent.map((tr) => {
                const m = tradeMetrics(tr, { breakevenThreshold: threshold });
                return (
                  <li key={tr.id}>
                    <Link href={`/journal/${tr.id}`} className="flex items-center justify-between gap-2 rounded-lg py-1.5 text-[13px] hover:text-text">
                      <span className="truncate text-text-2">{tr.symbol || "Untitled"} <span className="text-muted">#{tr.number}</span></span>
                      <span className={cx("num shrink-0 text-[12px]", m.status !== "closed" ? "text-muted" : (m.r ?? m.net ?? 0) > 0 ? "pos" : (m.r ?? m.net ?? 0) < 0 ? "neg" : "text-muted")}>{m.status === "closed" ? (m.r !== null ? fmtR(m.r) : fmtMoney(m.net, "USD", { sign: true })) : m.status === "draft" ? "Draft" : "Open"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-t border-line-soft py-4 first:border-t-0 first:pt-1">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted hover:text-text-2">
          <ChevronDown size={12} className={cx("transition-transform", !open && "-rotate-90")} />{title}
        </button>
        {action}
      </div>
      {open && children}
    </section>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="rounded-xl bg-card-2/60 px-2 py-2.5">
      <dd className={cx("num text-[15px]", tone !== undefined && tone !== null && (tone > 0 ? "pos" : tone < 0 ? "neg" : ""))}>{value}</dd>
      <dt className="mt-0.5 text-[10.5px] text-muted">{label}</dt>
    </div>
  );
}
