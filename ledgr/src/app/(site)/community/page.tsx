import type { Metadata } from "next";
import { Reveal } from "@/components/site/SiteChrome";
import { SignupForm } from "@/components/site/SignupForm";

export const metadata: Metadata = { title: "Community", description: "Join the Ledgr community list for updates, study sessions and product news." };

const VALUES = [
  ["Process over P&L", "We talk about preparation, rules and reflection — not screenshots of wins."],
  ["Honest records", "Mistakes are information. Sharing them is how everyone improves."],
  ["No signals, no tips", "Nobody here tells anyone what to trade. That's a rule, not a suggestion."],
  ["Respect", "Different markets, faiths and experience levels are all welcome."],
];

export default function CommunityPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-28 pt-32 sm:px-8">
      <Reveal>
        <h1 className="max-w-3xl text-[48px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[72px]">Grow alongside people who journal.</h1>
        <p className="mt-6 max-w-xl text-[17px] text-ink/60">The Ledgr community is just getting started. Join the list and we'll invite you to study sessions, feature previews and the community space when it opens.</p>
      </Reveal>
      <div className="mt-16 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
        <ul className="grid gap-4 sm:grid-cols-2">
          {VALUES.map(([t, b], i) => (
            <Reveal as="li" key={t} delay={i * 70} className="rounded-[20px] site-shadow border border-ink/10 bg-paper p-6">
              <p className="text-[17px] font-semibold">{t}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink/60">{b}</p>
            </Reveal>
          ))}
        </ul>
        <Reveal delay={120} className="site-shadow rounded-[24px] border border-ink/10 bg-paper p-7">
          <h2 className="mb-6 text-[20px] font-semibold">Join the list</h2>
          <SignupForm kind="community" submitLabel="Join the community list" done="You're on the list. We'll be in touch."
            fields={[{ name: "interests", label: "What would you like from the community? (optional)", multiline: true, placeholder: "Study sessions, journaling accountability, feature ideas…" }]} />
        </Reveal>
      </div>
    </div>
  );
}
