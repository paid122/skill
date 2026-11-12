import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 pb-28 pt-32 text-[15px] leading-relaxed text-ink/70 sm:px-8 [&_h2]:mt-10 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:text-ink">
      <h1 className="text-[44px] font-semibold tracking-[-0.04em] text-ink">Privacy</h1>
      <p className="mt-6">This page explains, in plain language, what Ledgr stores and where.</p>
      <h2>Without an account</h2>
      <p className="mt-3">Your journal, images and settings are stored only in your browser on this device. Nothing is sent to us. Clearing your browser data deletes them, so download a backup from Settings → Data.</p>
      <h2>With an account</h2>
      <p className="mt-3">Your email, a copy of your journal and your uploaded files are stored with our database provider (Supabase) so you can sync devices. Database rules restrict each record and file to its owner.</p>
      <h2>Ledgr AI</h2>
      <p className="mt-3">When model analysis is enabled and you ask a question, a summary of the records in your selected range is sent to the AI provider to generate the answer. Images are never sent. You can view exactly what is shared from the Ledgr AI page.</p>
      <h2>Reviews and sign-ups</h2>
      <p className="mt-3">Reviews show the name you choose. Community and affiliate sign-ups store your name, email and the details you provide, used only to respond to you.</p>
      <h2>Your choices</h2>
      <p className="mt-3">You can export or delete your local data at any time in Settings. To delete your account and its cloud data, contact the site owner.</p>
    </article>
  );
}
