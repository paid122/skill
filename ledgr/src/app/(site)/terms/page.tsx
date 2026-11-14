import type { Metadata } from "next";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/contact";
import { PLUS } from "@/lib/plus";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 pb-28 pt-32 text-[15px] leading-relaxed text-ink/70 sm:px-8 [&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-ink [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4">
      <h1 className="text-[44px] font-semibold tracking-[-0.04em] text-ink">Terms</h1>
      <p className="mt-4 text-[13px] text-ink/45">Last updated {LEGAL_UPDATED}</p>
      <h2>What Ledgr is</h2>
      <p className="mt-3">Ledgr is a journaling and analysis tool for simulated and historical trading records. It does not connect to brokerage accounts, execute trades, hold funds, or verify any account status.</p>
      <h2>Not financial advice</h2>
      <p className="mt-3">Nothing in Ledgr — including statistics, pattern insights, what-if analysis and MatrixX AI — is financial, investment or trading advice, or a prediction of future results. Decisions you make are your own.</p>
      <h2>Your content</h2>
      <p className="mt-3">You own what you record. You&apos;re responsible for keeping backups of data stored only in your browser.</p>
      <h2>{PLUS.name} and payments</h2>
      <p className="mt-3">{PLUS.name} is an optional one-time purchase of ${PLUS.priceUsd} (USD) for {PLUS.days} days. It adds {PLUS.matrixxPlan} to the MatrixX account you connect, which MatrixX provides under its own terms. It does not renew automatically: you can buy another {PLUS.days} days whenever you choose. Card payments are processed by Ziina on its own secure page; Ledgr never sees or stores your card details. Everything else in Ledgr stays free.</p>
      <h2>Refunds</h2>
      <p className="mt-3">All sales of {PLUS.name} are final and we do not offer refunds, including for unused days or credits, except where the law requires otherwise. By completing a purchase you ask for {PLUS.name} to start straight away and accept that it begins as soon as the payment is confirmed. If a payment went wrong (for example you were charged twice, or {PLUS.name} didn&apos;t start), email us and we&apos;ll fix it.</p>
      <h2>Acceptable use</h2>
      <p className="mt-3">Don&apos;t use Ledgr to break the law, to impersonate others, or to share trade signals or profit promises through reviews, community or affiliate channels.</p>
      <h2>Availability</h2>
      <p className="mt-3">Ledgr is provided as-is. Features may change, and the service may be unavailable from time to time.</p>
      <h2>Contact</h2>
      <p className="mt-3">Questions about these terms or a payment: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </article>
  );
}
