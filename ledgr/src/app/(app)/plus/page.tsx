"use client";
import { ArrowRight, CalendarCheck, Check, Copy, Film, CreditCard, Lock, MessageSquare, Minus, ScanSearch, Smartphone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { MatrixXLogo } from "@/components/matrixx";
import { Button, useFeedback } from "@/components/ui";
import { getMatrixxKey } from "@/lib/matrixxClient";
import { FREE_INCLUDES, PLAN_COMPARE, PLUS, PRO, planName, type PlanId } from "@/lib/plus";
import { planFromMatrixx, refreshPlus } from "@/lib/usePlus";
import { cx, fmtDate } from "@/lib/util";

interface Plan { tier: string; title: string; paid: boolean; period_end: string | null; credits_left_usd: number }

const MX = "#3ee08a"; // the MatrixX green, used softly for glow and accents

const FAQ: [string, string][] = [
  ["Does it renew automatically?", "No. Each plan is a one-time payment for 30 days. Buy another 30 days whenever you want; extra days are added on top."],
  ["What happens when it ends?", "You go back to Free. Everything you logged stays, and anything you already set up keeps working."],
  ["Can I switch plans?", "Yes. Buy the other plan any time; it starts straight away on your MatrixX account."],
  ["Who handles the payment?", "Ziina, the card payment provider, on its own secure page. LEDGR never sees your card."],
  ["Why do I need a MatrixX account?", "Your plan lives on your MatrixX account, together with the AI it includes. A free account takes a minute, with email or Google."],
  ["Is the journal really free?", "Yes: unlimited trades, the daily journal, dashboard, prop tracker, trade scores, paper trading, sharing cards and videos, CSV import and the community."],
];

export default function PlusPage() {
  return <Suspense><Plus /></Suspense>;
}

function Plus() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useFeedback();
  const [key, setKey] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "pos" | "neg" | "muted"; text: string } | null>(null);

  const headers = useCallback((k: string): HeadersInit => ({ "Content-Type": "application/json", "x-matrixx-key": k }), []);

  const load = useCallback(async (k: string) => {
    const r = await fetch("/api/plus/status", { headers: k ? headers(k) : undefined, cache: "no-store" }).then((x) => x.json()).catch(() => ({ available: false }));
    setAvailable(!!r.available);
    setPlan(r.plan ?? null);
    refreshPlus();
    if (r.error) setNote({ tone: "neg", text: r.error });
  }, [headers]);

  // back from paying (?ref=) or from cancelling (?cancelled=1)
  useEffect(() => {
    const k = getMatrixxKey();
    setKey(k);
    const ref = params.get("ref");
    if (params.get("cancelled")) { toast("Payment cancelled. Nothing was charged."); router.replace("/plus"); }
    if (ref && k) {
      setBusy(true);
      setNote({ tone: "muted", text: "Checking your payment…" });
      fetch("/api/plus/confirm", { method: "POST", headers: headers(k), body: JSON.stringify({ ref }) })
        .then((x) => x.json())
        .then((r) => {
          const res = r.result as string | undefined;
          if (res === "applied") { refreshPlus(); setNote({ tone: "pos", text: `Thank you! ${planName(planFromMatrixx(r.plan))} is active on your account.` }); }
          else if (res === "pending") setNote({ tone: "muted", text: "Your payment is still being confirmed. Reload this page in a minute." });
          else setNote({ tone: "neg", text: r.error ?? "The payment didn't go through. Nothing was charged; you can try again." });
          if (r.plan) setPlan(r.plan);
        })
        .catch(() => setNote({ tone: "neg", text: "Couldn't check the payment. Reload this page in a minute." }))
        .finally(() => { setBusy(false); router.replace("/plus"); void load(k); });
    } else {
      void load(k);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async (which: "plus" | "pro") => {
    if (!key) return;
    setBusy(true);
    const r = await fetch("/api/plus/checkout", { method: "POST", headers: headers(key), body: JSON.stringify({ plan: which }) }).then((x) => x.json()).catch(() => ({ error: "Could not reach LEDGR. Try again." }));
    if (r.url) { window.location.href = r.url; return; }
    setNote({ tone: "neg", text: r.error ?? "The payment page couldn't be opened." });
    setBusy(false);
  };

  const current: PlanId = planFromMatrixx(plan);
  const active = current !== "free";
  const focus = params.get("plan") === "pro" ? "pro" : "plus";
  const connect = <a href="/api/matrixx/connect?back=%2Fplus" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-text px-4 text-[14px] font-semibold text-bg transition-opacity hover:opacity-90"><MatrixXLogo size={20} /> Sign in with MatrixX</a>;
  const button = (id: "plus" | "pro") => {
    const p = id === "pro" ? PRO : PLUS;
    if (available === false) return <Button className="h-11 w-full" disabled>Coming soon</Button>;
    if (!key) return connect;
    const same = current === id;
    return <Button variant={id === focus ? "primary" : "secondary"} className="h-11 w-full text-[14.5px]" onClick={() => buy(id)} disabled={busy || available !== true}>{busy ? "Opening…" : same ? `Add ${p.days} days · $${p.priceUsd}` : `Get ${p.name} · $${p.priceUsd}`}{!busy && <ArrowRight size={15} />}</Button>;
  };

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 pb-10">
      {note && (
        <div role="status" className={cx("rounded-2xl border px-5 py-3.5 text-[14px]", note.tone === "pos" ? "border-pos/40 bg-pos/10 text-pos" : note.tone === "neg" ? "border-neg/40 bg-neg/10 text-neg" : "border-line bg-card text-text-2")}>{note.text}</div>
      )}

      <section className="text-center">
        <div className="flex items-center justify-center gap-2.5 text-text"><LogoMark size={30} /><span className="text-[18px] text-muted">+</span><MatrixXLogo size={30} /></div>
        <h1 className="mt-5 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-text sm:text-[44px]">Free to journal. Go further when you want.</h1>
        <p className="mx-auto mt-3 max-w-[56ch] text-[15.5px] leading-relaxed text-text-2">One payment for 30 days, no subscription. Each paid plan also puts MatrixX AI on your account.</p>
        {active && plan?.period_end && <p className="mt-4"><StatusPill tone="pos">{planName(current)} active until {fmtDate(plan.period_end)}{plan.credits_left_usd ? ` · $${plan.credits_left_usd.toFixed(2)} AI credits left` : ""}</StatusPill></p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PlanCard name="Free" price="$0" per="forever" tagline="For new traders, paper traders and one prop account." items={[...FREE_INCLUDES]} current={current === "free"}
          action={<Link href="/journal" className="flex h-11 w-full items-center justify-center rounded-[11px] border border-line text-[14px] text-text-2 hover:text-text">{current === "free" ? "Your plan" : "Included"}</Link>} />
        <PlanCard name={PLUS.name} price={`$${PLUS.priceUsd}`} per={`${PLUS.days} days`} tagline={PLUS.tagline} items={[...PLUS.includes]} badge="Most popular" accent={MX} current={current === "plus"} action={button("plus")} highlight={focus === "plus"} />
        <PlanCard name={PRO.name} price={`$${PRO.priceUsd}`} per={`${PRO.days} days`} tagline={PRO.tagline} items={[...PRO.includes]} badge="AI coach" accent="#a58bff" current={current === "pro"} action={button("pro")} highlight={focus === "pro"} />
      </section>
      <p className="-mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-muted"><Lock size={12} /> Secure card payment with Ziina · one-time · doesn&apos;t renew by itself{!key && available !== false ? " · connect a free MatrixX account first" : ""}</p>

      <section className="overflow-hidden rounded-[24px] border border-line bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_72px] items-center border-b border-line-soft px-5 py-4 text-[12.5px] sm:grid-cols-[minmax(0,1fr)_120px_120px_120px] sm:px-6">
          <span className="text-[18px] font-semibold tracking-[-0.01em] text-text sm:text-[20px]">Every feature, plan by plan</span>
          <span className="text-center font-medium text-text-2">Free</span>
          <span className="text-center font-semibold text-text">{PLUS.name}</span>
          <span className="text-center font-semibold text-text">{PRO.name}</span>
        </div>
        {PLAN_COMPARE.map((g) => (
          <div key={g.group}>
            <p className="bg-card-2/60 px-5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted sm:px-6">{g.group}</p>
            {g.rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_72px_72px_72px] items-center border-t border-line-soft px-5 py-3 text-[13px] sm:grid-cols-[minmax(0,1fr)_120px_120px_120px] sm:px-6">
                <span className="text-text-2">{r.label}</span>
                <Cell v={r.free} />
                <Cell v={r.plus} strong />
                <Cell v={r.pro} strong />
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Questions */}
      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted">Questions</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="rounded-[20px] border border-line bg-card p-6">
              <p className="text-[14.5px] font-semibold text-text">{q}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">{a}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[12px] text-muted"><CreditCard size={13} /> MatrixX reviews your past records only. It can be wrong, and it is not financial advice.</p>
      </section>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "pos" | "muted"; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium", tone === "pos" ? "bg-pos/15 text-pos" : "bg-card-2 text-text-2")}><span className={cx("h-1.5 w-1.5 rounded-full", tone === "pos" ? "bg-pos" : "bg-text-2")} />{children}</span>;
}

function Step({ n, done, title, body, action }: { n: number; done: boolean; title: string; body: string; action?: ReactNode }) {
  return (
    <li className={cx("flex flex-col rounded-[18px] border p-5", done ? "border-pos/40 bg-pos/[0.06]" : "border-line bg-bg/40")}>
      <span className={cx("grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold", done ? "bg-pos text-bg" : "border border-line text-text")}>{done ? <Check size={15} /> : n}</span>
      <p className="mt-4 text-[15px] font-semibold text-text">{title}</p>
      <p className="mt-1 flex-1 text-[13px] leading-relaxed text-text-2">{body}</p>
      {action && <div className="mt-4">{action}</div>}
      {done && <p className="mt-4 text-[12.5px] font-medium text-pos">Done</p>}
    </li>
  );
}

function Cell({ v, strong }: { v: boolean | string; strong?: boolean }) {
  if (v === true) return <span className="flex justify-center"><Check size={17} className={strong ? "text-pos" : "text-text-2"} /></span>;
  if (v === false) return <span className="flex justify-center text-muted"><Minus size={16} /></span>;
  return <span className={cx("text-center text-[13px]", strong ? "font-semibold text-text" : "text-text-2")}>{v}</span>;
}

function PlanCard({ name, price, per, tagline, items, badge, accent, current, action, highlight }: { name: string; price: string; per: string; tagline: string; items: string[]; badge?: string; accent?: string; current?: boolean; action: ReactNode; highlight?: boolean }) {
  return (
    <div className={cx("relative flex flex-col overflow-hidden rounded-[24px] border bg-card p-6", highlight ? "border-text-2/60 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]" : "border-line")}>
      {accent && <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-[0.16] blur-3xl" style={{ background: accent }} />}
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[16px] font-semibold text-text">{name}</p>
        {current ? <StatusPill tone="pos">Your plan</StatusPill> : badge ? <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold text-black" style={{ background: accent }}>{badge}</span> : null}
      </div>
      <p className="relative mt-1 text-[13px] text-muted">{tagline}</p>
      <p className="relative mt-5 flex items-end gap-2"><span className="num text-[44px] font-semibold leading-none tracking-[-0.04em] text-text">{price}</span><span className="mb-1 text-[13.5px] text-muted">/ {per}</span></p>
      <div className="relative mt-5">{action}</div>
      <ul className="relative mt-6 flex flex-col gap-2.5 border-t border-line-soft pt-5">
        {items.map((it) => <li key={it} className="flex gap-2.5 text-[13.5px] leading-snug text-text-2"><Check size={15} className="mt-0.5 shrink-0" style={{ color: accent ?? "var(--text-2)" }} />{it}</li>)}
      </ul>
    </div>
  );
}
