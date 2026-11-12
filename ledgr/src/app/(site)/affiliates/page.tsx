import type { Metadata } from "next";
import { Reveal } from "@/components/site/SiteChrome";
import { SignupForm } from "@/components/site/SignupForm";

export const metadata: Metadata = { title: "Affiliates", description: "Apply to share Ledgr with your audience." };

export default function AffiliatesPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-28 pt-32 sm:px-8">
      <Reveal>
        <h1 className="max-w-3xl text-[48px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[72px]">Share Ledgr with your audience.</h1>
        <p className="mt-6 max-w-xl text-[17px] text-white/60">We're building an affiliate programme for educators, writers and communities who care about disciplined, reflective trading.</p>
      </Reveal>
      <div className="mt-16 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-6">
          <Reveal className="rounded-[20px] border border-white/10 bg-white/[0.03] p-7">
            <p className="text-[17px] font-semibold">Programme status</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">Commission, payout and tracking terms are still being finalised, and will be published here before anyone is enrolled. Applying now simply puts you first in line — there's no obligation.</p>
          </Reveal>
          <Reveal delay={80} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-7">
            <p className="text-[17px] font-semibold">Who it's for</p>
            <ul className="mt-3 flex flex-col gap-2 text-[14.5px] text-white/60">
              <li>Educators who teach journaling, risk and review habits</li>
              <li>Writers and creators focused on trading psychology</li>
              <li>Communities that value process over predictions</li>
            </ul>
          </Reveal>
          <Reveal delay={160} className="rounded-[20px] border border-white/10 bg-white/[0.03] p-7">
            <p className="text-[17px] font-semibold">Our standards</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">Affiliates may not promise profits, share trade signals, or present Ledgr as financial advice. Ledgr is a journal for simulated and historical records.</p>
          </Reveal>
        </div>
        <Reveal delay={120} className="rounded-[24px] border border-white/10 p-7">
          <h2 className="mb-6 text-[20px] font-semibold">Apply</h2>
          <SignupForm kind="affiliate" submitLabel="Send application" done="Application received. We'll email you when terms are published."
            fields={[
              { name: "link", label: "Where's your audience? (link)", placeholder: "https://", required: true },
              { name: "audience", label: "Approximate audience size", placeholder: "e.g. 5,000 newsletter readers" },
              { name: "message", label: "How would you share Ledgr?", multiline: true },
            ]} />
        </Reveal>
      </div>
    </div>
  );
}
