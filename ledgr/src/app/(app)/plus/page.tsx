"use client";
import { Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PageIntro } from "@/components/blocks";
import { MatrixXLogo } from "@/components/matrixx";
import { Badge, Button, Card, SectionTitle, useFeedback } from "@/components/ui";
import { getMatrixxKey } from "@/lib/matrixxClient";
import { PLUS } from "@/lib/plus";
import { fmtDate } from "@/lib/util";

interface Plan { tier: string; title: string; paid: boolean; period_end: string | null; credits_left_usd: number }

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
          else if (res === "pending") setNote({ tone: "muted", text: "Your payment is still being confirmed. This page updates when you reload it in a minute." });
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

  const active = plan?.paid && plan.period_end && new Date(plan.period_end).getTime() > Date.now();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageIntro title={PLUS.name} sub={`MatrixX AI included. $${PLUS.priceUsd} for ${PLUS.days} days.`} />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[13px] text-text-2"><MatrixXLogo size={18} /> {PLUS.name}</p>
            <p className="mt-2 flex items-end gap-2"><span className="num text-[44px] font-semibold leading-none">${PLUS.priceUsd}</span><span className="mb-1 text-[13px] text-muted">for {PLUS.days} days · one-time card payment</span></p>
          </div>
          {active && <Badge tone="pos">Active until {fmtDate(plan!.period_end!)}</Badge>}
        </div>
        <ul className="mt-6 grid gap-2.5">
          {PLUS.includes.map((f) => <li key={f} className="flex gap-2.5 text-[14px] text-text"><Check size={16} className="mt-0.5 shrink-0 text-pos" />{f}</li>)}
        </ul>
        <p className="mt-5 text-[12px] text-muted">Everything else in LEDGR stays free. {PLUS.name} doesn&apos;t renew by itself: buy another {PLUS.days} days whenever you want.</p>
      </Card>

      <Card>
        <SectionTitle title="Get it in two steps" />
        <ol className="flex flex-col gap-5">
          <li className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-text">1. Connect MatrixX</p>
              <p className="text-[13px] text-muted">{key ? `Connected${plan ? ` · your MatrixX plan: ${plan.title}` : ""}` : "Sign in or create a free MatrixX account. LEDGR+ is added to it."}</p>
            </div>
            {key ? <Badge tone="pos"><Check size={12} /> Connected</Badge> : (
              <a href="/api/matrixx/connect?back=%2Fplus" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-text px-4 text-[13px] font-semibold text-bg hover:opacity-90"><MatrixXLogo size={20} /> Sign in with MatrixX</a>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5">
            <div>
              <p className="text-[14px] font-medium text-text">2. Pay ${PLUS.priceUsd} by card</p>
              <p className="text-[13px] text-muted">Secure card payment with Ziina. {PLUS.matrixxPlan} starts as soon as it&apos;s paid.</p>
            </div>
            <Button variant="primary" onClick={buy} disabled={!key || busy || available !== true}>
              {available === false ? "Coming soon" : busy ? "Opening…" : active ? `Add ${PLUS.days} days · $${PLUS.priceUsd}` : `Get ${PLUS.name} · $${PLUS.priceUsd}`}
            </Button>
          </li>
        </ol>
        {note && <p className={`mt-5 text-[13px] ${note.tone === "pos" ? "text-pos" : note.tone === "neg" ? "text-neg" : "text-muted"}`}>{note.text}</p>}
      </Card>
    </div>
  );
}
