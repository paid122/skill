import { Ban, Baby, Cloud, Cookie, CreditCard, Database, Eye, FileClock, HardDrive, KeyRound, LineChart, Lock, RefreshCw, ShieldCheck, Sparkles, Trash2, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/site/Legal";
import { Mark } from "@/components/site/Mark";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/contact";

export const metadata: Metadata = { title: "Privacy", description: "What LEDGR stores, where it's kept, who it's shared with, and the choices you have — in plain language." };

const I = (Icon: typeof Lock) => <Icon size={18} />;

const SECTIONS: LegalSection[] = [
  { id: "no-account", title: "Using LEDGR without an account", icon: I(HardDrive), body: <>
    <p>You can use LEDGR without signing up. Your journal, images and settings are then stored <strong>only in your browser, on this device</strong> (in its local storage). Nothing is sent to us.</p>
    <p>Clearing your browser data deletes them, so download a backup from <strong>Settings → Data</strong> from time to time.</p>
  </> },
  { id: "account", title: "With an account", icon: I(Cloud), body: <>
    <p>A free account adds backup and sync across devices. When you have one, we store with our database provider, <strong>Supabase</strong>:</p>
    <ul>
      <li>your email address and sign-in details (passwords are handled by Supabase and are never visible to us);</li>
      <li>a copy of your journal, including your settings and profile photo if you add one;</li>
      <li>files you upload, such as trade screenshots.</li>
    </ul>
    <p>Database rules restrict each record and file to its owner. If you sign in with <strong>Google</strong>, Google shares your name, email and profile picture with us to create your account.</p>
  </> },
  { id: "matrixx", title: "MatrixX AI", icon: I(Sparkles), body: <>
    <p>LEDGR&apos;s AI runs on <strong>MatrixX</strong> (getmatrixx.com), a separate service with its own terms and privacy policy.</p>
    <ul>
      <li>When you connect MatrixX, a key for your MatrixX account is kept <strong>in your browser</strong>.</li>
      <li>When you ask a question or request a trade or weekly review, a <strong>summary of the records</strong> in the range you chose is sent to MatrixX to write the answer. Images are never sent.</li>
      <li>You can see exactly what is shared on the MatrixX AI page, and disconnect at any time.</li>
    </ul>
    <p>Without MatrixX connected, the AI page answers with offline analysis calculated in your browser, and nothing is sent.</p>
  </> },
  { id: "payments", title: "Payments", icon: I(CreditCard), body: <>
    <p>LEDGR+ is paid by card through <strong>Ziina</strong>, on its own secure page. LEDGR <strong>never sees or stores your card details</strong>.</p>
    <p>We only learn whether the payment went through, so LEDGR+ can be added to your MatrixX account.</p>
  </> },
  { id: "market-data", title: "Charts and market data", icon: I(LineChart), body: <>
    <p>To draw real price charts on P&amp;L cards, LEDGR&apos;s server asks public market-data providers for prices. It sends only the <strong>symbol and time range</strong>, never anything about you.</p>
    <p>Logos for some symbols are loaded from a third-party image service, which, like any website, can see your device&apos;s IP address when the image loads.</p>
  </> },
  { id: "owners", title: "What the owners can see", icon: I(Eye), body: <>
    <p>To run LEDGR, the site owners can see account details such as your <strong>email, when you signed up and when you last signed in</strong>, plus overall counts (for example how many journals and trades exist).</p>
    <p>We don&apos;t browse the contents of your journal, and we never sell your data.</p>
  </> },
  { id: "cookies", title: "Cookies and tracking", icon: I(Cookie), body: <>
    <p><strong>LEDGR uses no advertising or analytics trackers.</strong></p>
    <ul>
      <li>Your journal and sign-in session are kept in your browser&apos;s storage so the app works and stays signed in.</li>
      <li>Two short-lived cookies are set only while you connect MatrixX, to complete the sign-in safely. They expire within 10 minutes.</li>
    </ul>
  </> },
  { id: "providers", title: "Services we rely on", icon: I(Database), body: <>
    <p>We share the minimum needed with a few providers who help run LEDGR:</p>
    <ul>
      <li><strong>Vercel</strong> hosts the website. Like any host, it processes requests and keeps technical logs (such as IP addresses).</li>
      <li><strong>Supabase</strong> stores accounts, synced journals and uploaded files.</li>
      <li><strong>Google</strong> provides Google sign-in, and our confirmation emails are sent through Gmail.</li>
      <li><strong>MatrixX</strong> provides the AI, and <strong>Ziina</strong> processes LEDGR+ payments.</li>
    </ul>
    <p>Our server briefly uses your IP address to limit abuse (for example, too many requests in a minute).</p>
  </> },
  { id: "security", title: "Security", icon: I(ShieldCheck), body: <>
    <p>All traffic uses HTTPS. Each user&apos;s cloud records are protected by database rules so only they can read them, and secret keys stay on the server.</p>
    <p>No system is perfectly secure, so keep your password private and download backups of anything important.</p>
  </> },
  { id: "retention", title: "How long we keep data", icon: I(FileClock), body: <>
    <p>Local data stays in your browser until you delete it. Account data is kept while your account exists. When you ask us to delete your account, we delete its cloud data.</p>
  </> },
  { id: "choices", title: "Your choices and rights", icon: I(UserRound), body: <>
    <ul>
      <li><strong>See and export</strong> your data at any time: Settings → Data, plus CSV exports of trades.</li>
      <li><strong>Correct</strong> anything directly in the app.</li>
      <li><strong>Delete</strong> local data in Settings, or your whole account by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
      <li><strong>Disconnect</strong> MatrixX at any time.</li>
    </ul>
    <p>Depending on where you live, you may have further rights under data protection law. Email us and we&apos;ll help.</p>
  </> },
  { id: "children", title: "Children", icon: I(Baby), body: <>
    <p>LEDGR is meant for adults and isn&apos;t intended for anyone under 18. If you believe a child has created an account, email us and we&apos;ll delete it.</p>
  </> },
  { id: "changes", title: "Changes to this policy", icon: I(RefreshCw), body: <>
    <p>If this policy changes, we&apos;ll update the date at the top of this page, and announce important changes on the website first.</p>
  </> },
];

const SUMMARY = [
  { icon: I(Lock), title: "Private by default", body: "Without an account, your journal never leaves your browser." },
  { icon: I(Ban), title: "No trackers, no selling", body: "No advertising or analytics trackers. We never sell your data." },
  { icon: I(KeyRound), title: "You're in control", body: "Export everything, disconnect MatrixX, or delete your account any time." },
  { icon: I(Trash2), title: "Easy to leave", body: "Ask us to delete your account and its cloud data is removed." },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker={<span className="inline-flex items-center gap-2"><Lock size={13} /> Privacy</span>}
      title={<>Your data. <Mark>Your</Mark> rules.</>}
      intro="What LEDGR stores, where it's kept, who it's shared with, and the choices you have — in plain language."
      updated={LEGAL_UPDATED}
      summary={SUMMARY}
      sections={SECTIONS}
      email={CONTACT_EMAIL}
      other={{ href: "/terms", label: "Terms" }}
    />
  );
}

