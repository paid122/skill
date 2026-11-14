import type { Metadata } from "next";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/contact";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 pb-28 pt-32 text-[15px] leading-relaxed text-ink/70 sm:px-8 [&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-ink [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4">
      <h1 className="text-[44px] font-semibold tracking-[-0.04em] text-ink">Privacy</h1>
      <p className="mt-4 text-[13px] text-ink/45">Last updated {LEGAL_UPDATED}</p>
      <p className="mt-6">This page explains, in plain language, what Ledgr stores and where.</p>
      <h2>Without an account</h2>
      <p className="mt-3">Your journal, images and settings are stored only in your browser on this device. Nothing is sent to us. Clearing your browser data deletes them, so download a backup from Settings → Data.</p>
      <h2>With an account</h2>
      <p className="mt-3">Your email, a copy of your journal (including your settings and profile photo, if you add one) and your uploaded files are stored with our database provider (Supabase) so you can sync devices. Database rules restrict each record and file to its owner. If you sign in with Google, we receive your name, email and profile picture from Google to create your account.</p>
      <h2>What the owners can see</h2>
      <p className="mt-3">To run Ledgr, the site owners can see account details such as your email, when you signed up and when you last signed in, plus overall counts (for example how many journals and trades exist). They don&apos;t browse the contents of your journal.</p>
      <h2>MatrixX AI</h2>
      <p className="mt-3">When you connect MatrixX (getmatrixx.com), a key for your MatrixX account is kept in your browser. When you ask a question or request a review, a summary of the records in your selected range is sent to MatrixX to generate the answer. Images are never sent. You can view exactly what is shared from the MatrixX AI page, and disconnect at any time.</p>
      <h2>Payments</h2>
      <p className="mt-3">LEDGR+ is paid by card through Ziina on its own secure page. Ledgr never sees or stores your card details. We only learn whether the payment went through, so LEDGR+ can be added to your MatrixX account.</p>
      <h2>Reviews and sign-ups</h2>
      <p className="mt-3">Reviews show the name you choose. Community and affiliate sign-ups store your name, email and the details you provide, used only to respond to you.</p>
      <h2>Your choices</h2>
      <p className="mt-3">You can export or delete your local data at any time in Settings. To delete your account and its cloud data, or for any privacy question, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </article>
  );
}
