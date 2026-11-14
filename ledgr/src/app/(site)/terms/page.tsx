import { AlertTriangle, BadgeCheck, Ban, BookOpen, CircleDollarSign, FileSignature, Gavel, Handshake, LogOut, MessageSquareQuote, PenLine, Power, RefreshCw, Scale, Sparkles, UserRound, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/site/Legal";
import { Mark } from "@/components/site/Mark";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/contact";
import { PLUS } from "@/lib/plus";

export const metadata: Metadata = { title: "Terms", description: "The rules for using LEDGR and LEDGR+, in plain language: what LEDGR is, payments, refunds, and what we each promise." };

const I = (Icon: typeof Scale) => <Icon size={18} />;

const SECTIONS: LegalSection[] = [
  { id: "agreement", title: "Agreeing to these terms", icon: I(FileSignature), body: <>
    <p>By using LEDGR (the website and the app at ledgrjournal.app) you agree to these terms and to our <Link href="/privacy">Privacy policy</Link>. If you don&apos;t agree, please don&apos;t use LEDGR.</p>
  </> },
  { id: "what", title: "What LEDGR is", icon: I(BookOpen), body: <>
    <p>LEDGR is a <strong>journaling and analysis tool</strong> for simulated and historical trading records. It helps you record trades, review your process and see your own statistics.</p>
    <p>LEDGR <strong>does not</strong> connect to brokerage accounts to trade, execute trades, hold funds, or verify any account&apos;s status. Imports (such as CSV files) are only read to fill your journal.</p>
  </> },
  { id: "advice", title: "Not financial advice", icon: I(AlertTriangle), body: <>
    <p>Nothing in LEDGR — statistics, pattern insights, what-if analysis, P&amp;L cards or MatrixX AI reviews — is <strong>financial, investment or trading advice</strong>, or a prediction of future results.</p>
    <p>Trading involves risk, and past results don&apos;t guarantee future ones. Every decision you make is your own.</p>
  </> },
  { id: "eligibility", title: "Who can use LEDGR", icon: I(UserRound), body: <>
    <p>You must be at least 18 years old. If you create an account, keep your sign-in details private — you&apos;re responsible for what happens under your account.</p>
  </> },
  { id: "content", title: "Your content", icon: I(PenLine), body: <>
    <p><strong>You own what you record.</strong> You give us permission to store and process it only to run LEDGR for you (for example, to sync it between your devices or send a summary to MatrixX when you ask).</p>
    <p>You&apos;re responsible for keeping backups of data stored only in your browser.</p>
  </> },
  { id: "plus", title: `${PLUS.name} and payments`, icon: I(Wallet), body: <>
    <p>{PLUS.name} is an optional <strong>one-time purchase of ${PLUS.priceUsd} (USD) for {PLUS.days} days</strong>. It adds {PLUS.matrixxPlan} to the MatrixX account you connect.</p>
    <ul>
      <li>It <strong>does not renew automatically</strong>. Buy another {PLUS.days} days whenever you choose; extra days are added on top.</li>
      <li>Card payments are processed by <strong>Ziina</strong> on its own secure page. LEDGR never sees or stores your card details.</li>
      <li>Everything else in LEDGR stays free. Prices may change in the future; any change won&apos;t affect days you&apos;ve already paid for.</li>
    </ul>
  </> },
  { id: "refunds", title: "Refunds", icon: I(CircleDollarSign), body: <>
    <p>All sales of {PLUS.name} are <strong>final</strong>, and we do not offer refunds, including for unused days or credits, <strong>except where the law requires otherwise</strong>.</p>
    <p>By completing a purchase you ask for {PLUS.name} to start straight away and accept that it begins as soon as the payment is confirmed.</p>
    <p>If a payment went wrong — for example you were charged twice, or {PLUS.name} didn&apos;t start — email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we&apos;ll fix it.</p>
  </> },
  { id: "matrixx", title: "MatrixX AI", icon: I(Sparkles), body: <>
    <p>The AI in LEDGR is provided by <strong>MatrixX</strong>, a separate service. Using it also means following MatrixX&apos;s own terms. Your MatrixX plan, messages and credits are managed by MatrixX.</p>
    <p>AI answers are generated automatically from your records and <strong>can be wrong</strong>. Always check them against your journal.</p>
  </> },
  { id: "use", title: "Acceptable use", icon: I(Ban), body: <>
    <p>Please don&apos;t use LEDGR to:</p>
    <ul>
      <li>break the law, or impersonate someone else;</li>
      <li>share trade signals, tips or promises of profit — in reviews, the community or as an affiliate;</li>
      <li>attack, overload or try to break into LEDGR or other people&apos;s accounts;</li>
      <li>copy or resell LEDGR, or use it to build a competing service.</li>
    </ul>
  </> },
  { id: "reviews", title: "Reviews and community", icon: I(MessageSquareQuote), body: <>
    <p>Reviews are written by signed-in users and checked before they appear. We never write or edit them, but we may decline ones that break these terms. The LEDGR Discord follows these terms and its own house rules.</p>
  </> },
  { id: "availability", title: "Availability and changes", icon: I(Power), body: <>
    <p>We work to keep LEDGR running well, but it&apos;s provided <strong>as-is</strong>. Features may change, and the service may sometimes be unavailable.</p>
  </> },
  { id: "liability", title: "Limits of our responsibility", icon: I(Scale), body: <>
    <p>To the fullest extent the law allows, LEDGR isn&apos;t responsible for trading decisions or losses, for data lost from your browser, or for services run by others (such as MatrixX, Ziina, Google or brokers).</p>
    <p>Where we are responsible, our total liability is limited to the amount you paid us in the 12 months before the issue. Nothing here limits rights you have that the law doesn&apos;t allow us to limit.</p>
  </> },
  { id: "ending", title: "Ending your use", icon: I(LogOut), body: <>
    <p>You can stop using LEDGR at any time and ask us to delete your account. We may suspend or close accounts that seriously or repeatedly break these terms.</p>
  </> },
  { id: "updates", title: "Changes to these terms", icon: I(RefreshCw), body: <>
    <p>If these terms change, we&apos;ll update the date at the top of this page, and announce important changes on the website first. Continuing to use LEDGR after a change means you accept the new terms.</p>
  </> },
];

const SUMMARY = [
  { icon: I(BookOpen), title: "A journal, not a broker", body: "LEDGR records and analyses trades. It never places them or holds money." },
  { icon: I(Gavel), title: "Not financial advice", body: "Stats and AI reviews describe your past records. Decisions are yours." },
  { icon: I(BadgeCheck), title: "Free, with an optional extra", body: `Every journal feature is free. ${PLUS.name} is $${PLUS.priceUsd} for ${PLUS.days} days and doesn't auto-renew.` },
  { icon: I(Handshake), title: "Fair use", body: "No signals, no profit promises, no abuse. Treat others with respect." },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker={<span className="inline-flex items-center gap-2"><Scale size={13} /> Terms</span>}
      title={<>The rules, in <Mark>plain</Mark> words.</>}
      intro="What LEDGR is, what you can expect from us, and what we ask of you — written to be read, not skimmed past."
      updated={LEGAL_UPDATED}
      summary={SUMMARY}
      sections={SECTIONS}
      email={CONTACT_EMAIL}
      other={{ href: "/privacy", label: "Privacy policy" }}
    />
  );
}
