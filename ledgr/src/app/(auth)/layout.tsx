import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-black text-white lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden border-r border-white/10 lg:block">
        <div aria-hidden className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 39px, #fff 39px 40px)" }} />
        <div aria-hidden className="absolute -left-24 top-1/3 h-[520px] w-[520px] rounded-full bg-white/[0.06] blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5 text-white"><LogoMark size={28} /><Wordmark className="text-white" /></Link>
          <figure className="max-w-md">
            <blockquote className="verse-text text-[30px] leading-snug text-white">A false balance is abomination to the LORD: but a just weight is his delight.</blockquote>
            <figcaption className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">Proverbs 11:1 · KJV</figcaption>
            <p className="mt-6 text-[14px] leading-relaxed text-white/50">Keep an honest ledger. Accurate records are a form of integrity.</p>
          </figure>
          <p className="text-[12px] text-white/35">For simulated and historical records only. No broker connection.</p>
        </div>
      </aside>
      <main className="flex min-h-screen flex-col px-6 py-10 sm:px-12">
        <Link href="/" className="flex items-center gap-2.5 text-white lg:hidden"><LogoMark size={26} /><Wordmark className="text-white" /></Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</div>
      </main>
    </div>
  );
}
