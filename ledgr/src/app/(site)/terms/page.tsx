import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 pb-28 pt-32 text-[15px] leading-relaxed text-ink/70 sm:px-8 [&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-ink">
      <h1 className="text-[44px] font-semibold tracking-[-0.04em] text-ink">Terms</h1>
      <h2>What Ledgr is</h2>
      <p className="mt-3">Ledgr is a journaling and analysis tool for simulated and historical trading records. It does not connect to brokerage accounts, execute trades, hold funds, or verify any account status.</p>
      <h2>Not financial advice</h2>
      <p className="mt-3">Nothing in Ledgr — including statistics, pattern insights, what-if analysis and Ledgr AI — is financial, investment or trading advice, or a prediction of future results. Decisions you make are your own.</p>
      <h2>Your content</h2>
      <p className="mt-3">You own what you record. You're responsible for keeping backups of data stored only in your browser.</p>
      <h2>Acceptable use</h2>
      <p className="mt-3">Don't use Ledgr to break the law, to impersonate others, or to share trade signals or profit promises through reviews, community or affiliate channels.</p>
      <h2>Availability</h2>
      <p className="mt-3">Ledgr is provided as-is. Features may change, and the service may be unavailable from time to time.</p>
    </article>
  );
}
