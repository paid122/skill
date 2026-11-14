"use client";
import { ArrowRight, CalendarCheck, Check, CreditCard, Lock, MessageSquare, Minus, ScanSearch, Smartphone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { MatrixXLogo } from "@/components/matrixx";
import { Button, useFeedback } from "@/components/ui";
import { getMatrixxKey } from "@/lib/matrixxClient";
import { PLUS } from "@/lib/plus";
import { cx, fmtDate } from "@/lib/util";

interface Plan { tier: string; title: string; paid: boolean; period_end: string | null; credits_left_usd: number }

const MX = "#3ee08a"; // the MatrixX green, used softly for glow and accents

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <ScanSearch size={18} />, title: "Trade reviews", body: "One click on any trade: what went well, what to improve against your own rules, your mindset, and one lesson." },
  { icon: <CalendarCheck size={18} />, title: "Weekly reviews", body: "Every week summed up: what worked, what kept going wrong, patterns, and your focus for next week." },
  { icon: <MessageSquare size={18} />, title: "AI chat", body: "Ask anything about your own records. Answers cite the trades they draw on." },
  { icon: <Smartphone size={18} />, title: "Works everywhere", body: `${PLUS.matrixxPlan} is on your MatrixX account, so it also works in the MatrixX app and on your phone.` },
];

const COMPARE: { label: string; free: boolean | string; plus: boolean | string }[] = [
  { label: "Journal, dashboard, analytics, reports", free: true, plus: true },
  { label: "Daily & weekly journal, study room, verses", free: true, plus: true },
  { label: "MatrixX AI with your own MatrixX account", free: true, plus: true },
  { label: `${PLUS.matrixxPlan} included`, free: false, plus: true },
  { label: "Stronger AI models", free: false, plus: true },
  { label: "Daily AI message cap", free: "25 a day", plus: "None" },
  { label: "AI credits each 30 days", free: false, plus: "$4" },
];

const FAQ: [string, string][] = [
  ["Does it renew automatically?", `No. ${PLUS.name} is a one-time payment for ${PLUS.days} days. Buy another ${PLUS.days} days whenever you want; extra days are added on top.`],
  ["What happens when it ends?", "Your MatrixX account goes back to Free. Everything in LEDGR stays, and the AI keeps working on MatrixX's free plan."],
  ["Who handles the payment?", "Ziina, the card payment provider, on its own secure page. LEDGR never sees your card."],
  ["Why do I need a MatrixX account?", `${PLUS.name} adds ${PLUS.matrixxPlan} to your MatrixX account. A free account takes a minute, with email or Google.`],
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
          if (res === "applied") setNote({ tone: "pos", text: `Thank you! ${PLUS.name} is active: ${PLUS.matrixxPlan} is on your MatrixX account.` });
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

  const buy = async () => {
    if (!key) return;
    setBusy(true);
    const r = await fetch("/api/plus/checkout", { method: "POST", headers: headers(key) }).then((x) => x.json()).catch(() => ({ error: "Could not reach LEDGR. Try again." }));
    if (r.url) { window.location.href = r.url; return; }
    setNote({ tone: "neg", text: r.error ?? "The payment page couldn't be opened." });
    setBusy(false);
  };

  const active = !!(plan?.paid && plan.period_end && new Date(plan.period_end).getTime() > Date.now());
  const label = available === false ? "Coming soon" : available === null ? "Checking…" : busy ? "Opening…" : active ? `Add ${PLUS.days} days · $${PLUS.priceUsd}` : `Get ${PLUS.name} · $${PLUS.priceUsd}`;
  const why = available === false ? `${PLUS.name} isn't switched on for this site yet.` : !key ? "Connect MatrixX first (step 1 below)." : null;
  const connect = <a href="/api/matrixx/connect?back=%2Fplus" className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-text px-4 text-[13.5px] font-semibold text-bg transition-opacity hover:opacity-90"><MatrixXLogo size={20} /> Sign in with MatrixX</a>;

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-8 pb-10">
      {note && (
        <div role="status" className={cx("rounded-2xl border px-5 py-3.5 text-[14px]", note.tone === "pos" ? "border-pos/40 bg-pos/10 text-pos" : note.tone === "neg" ? "border-neg/40 bg-neg/10 text-neg" : "border-line bg-card text-text-2")}>{note.text}</div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-card">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full opacity-[0.16] blur-3xl" style={{ background: `radial-gradient(circle, ${MX}, transparent 65%)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)", backgroundSize: "32px 32px", maskImage: "radial-gradient(ellipse at 80% 0%, black, transparent 70%)" }} />
        <div className="relative grid gap-10 p-7 sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2.5 text-text">
              <LogoMark size={30} />
              <span className="text-[18px] text-muted">+</span>
              <MatrixXLogo size={30} />
              <span className="ml-1 rounded-full border border-line px-2.5 py-0.5 text-[11.5px] font-medium tracking-wide text-text-2">{PLUS.name}</span>
            </div>
            <h1 className="mt-6 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-text sm:text-[44px]">Your AI trading coach, inside your journal.</h1>
            <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-text-2">MatrixX reviews your trades and your weeks from your own records, and answers your questions about them. Everything else in LEDGR stays free.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Trade reviews", "Weekly reviews", "AI chat", "No daily cap"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-card-2 px-3 py-1 text-[12.5px] text-text-2"><Sparkles size={12} style={{ color: MX }} /> {t}</span>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-line bg-bg/60 p-6 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-medium text-text-2">{PLUS.name}</p>
              {active ? <StatusPill tone="pos">Active until {fmtDate(plan!.period_end!)}</StatusPill> : key ? <StatusPill tone="muted">MatrixX connected</StatusPill> : null}
            </div>
            <p className="mt-3 flex items-end gap-2"><span className="num text-[56px] font-semibold leading-none tracking-[-0.04em] text-text">${PLUS.priceUsd}</span><span className="mb-1.5 text-[14px] text-muted">for {PLUS.days} days</span></p>
            <p className="mt-2 text-[13px] text-text-2">Includes {PLUS.matrixxPlan}: stronger models, no daily cap, $4 of AI credits.</p>
            {active && plan && <p className="mt-2 text-[12.5px] text-muted">Credits left: <span className="num text-text">${plan.credits_left_usd.toFixed(2)}</span></p>}
            <div className="mt-6">
              {!key && available !== false ? connect : (
                <Button variant="primary" className="h-11 w-full text-[14.5px]" onClick={buy} disabled={!key || busy || available !== true}>{label}{!busy && available === true && <ArrowRight size={15} />}</Button>
              )}
              {why && key && <p className="mt-2 text-center text-[12px] text-muted">{why}</p>}
              {!key && available !== false && <p className="mt-2 text-[12px] text-muted">Then pay ${PLUS.priceUsd} by card. A free MatrixX account works.</p>}
            </div>
            <p className="mt-5 flex items-center gap-1.5 border-t border-line-soft pt-4 text-[11.5px] text-muted"><Lock size={12} /> Secure card payment with Ziina · one-time · doesn&apos;t renew by itself</p>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted">What you get</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-[20px] border border-line bg-card p-6 transition-colors hover:border-text-2/40">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-card-2" style={{ color: MX }}>{f.icon}</span>
              <h3 className="mt-4 text-[16px] font-semibold text-text">{f.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="rounded-[24px] border border-line bg-card p-7 sm:p-8">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-text">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          <Step n={1} done={!!key} title="Connect MatrixX" body="Sign in or create a free MatrixX account, then allow LEDGR." action={key ? undefined : connect} />
          <Step n={2} done={active} title={`Pay $${PLUS.priceUsd} by card`} body={`Secure Ziina page. ${PLUS.matrixxPlan} starts as soon as it's paid.`} action={key && !active && available === true ? <Button variant="primary" size="sm" onClick={buy} disabled={busy}>{busy ? "Opening…" : `Pay $${PLUS.priceUsd}`}</Button> : undefined} />
          <Step n={3} done={false} title="Start reviewing" body="Open any trade or your weekly review and click Review with MatrixX." action={active ? <div className="flex flex-wrap gap-2"><Link href="/journal" className="text-[13px] font-medium text-text underline-offset-4 hover:underline">Your trades →</Link><Link href="/weekly-review" className="text-[13px] font-medium text-text underline-offset-4 hover:underline">Weekly review →</Link></div> : undefined} />
        </ol>
      </section>

      {/* Free vs LEDGR+ */}
      <section className="overflow-hidden rounded-[24px] border border-line bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center border-b border-line-soft px-6 py-4 text-[13px] sm:grid-cols-[minmax(0,1fr)_120px_120px]">
          <span className="text-[20px] font-semibold tracking-[-0.01em] text-text">Free vs {PLUS.name}</span>
          <span className="text-center font-medium text-text-2">Free</span>
          <span className="text-center font-semibold text-text">{PLUS.name}</span>
        </div>
        {COMPARE.map((r, i) => (
          <div key={r.label} className={cx("grid grid-cols-[minmax(0,1fr)_88px_88px] items-center px-6 py-3.5 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_120px_120px]", i % 2 === 1 && "bg-card-2/40")}>
            <span className="text-text-2">{r.label}</span>
            <Cell v={r.free} />
            <Cell v={r.plus} strong />
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
