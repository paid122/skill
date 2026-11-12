"use client";
import { Check, Download, Minus, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CtaLink } from "./CtaLink";
import { INCLUDED } from "./included";

/* ------------------------------------------------------------------ Comparison */
type Cell = true | false | string;
const ROWS: [string, Cell, Cell, Cell][] = [
  ["P&L from your executions, partial exits and fees", "If you build the formulas", false, true],
  ["R-multiples and risk per trade", "Manual", false, true],
  ["Emotions, mistakes and a discipline score", "Manual", "Free text", true],
  ["Pattern checks with sample sizes", false, false, true],
  ["Equity curve, calendar and 14 charts", "Build your own", false, true],
  ["Screenshots on every trade", "Awkward", true, true],
  ["Daily journal, weekly review, checklist", false, "Free text", true],
  ["Price", "Free", "Free", "Free"],
];
function CellView({ v, strong }: { v: Cell; strong?: boolean }) {
  if (v === true) return <Check size={18} className={strong ? "text-paper" : "text-ink"} aria-label="Yes" />;
  if (v === false) return <Minus size={18} className={strong ? "text-paper/40" : "text-ink/25"} aria-label="No" />;
  return <span className={strong ? "text-paper" : "text-ink/60"}>{v}</span>;
}
export function Compare() {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-ink/10 bg-paper site-shadow">
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr>
            <th className="p-5 font-medium text-ink/45">What you get</th>
            <th className="p-5 font-medium">Spreadsheet</th>
            <th className="p-5 font-medium">Notes app</th>
            <th className="rounded-t-[18px] bg-ink p-5 font-semibold text-paper">Ledgr</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, a, b, c], i) => (
            <tr key={label} className="border-t border-ink/10">
              <td className="p-5 text-ink/80">{label}</td>
              <td className="p-5"><CellView v={a} /></td>
              <td className="p-5"><CellView v={b} /></td>
              <td className={`bg-ink p-5 ${i === ROWS.length - 1 ? "rounded-b-[18px]" : ""}`}><CellView v={c} strong /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- Home pricing */
export function HomePricing() {
  return (
    <div className="grid items-start gap-5 md:grid-cols-[1.25fr_1fr]">
      <div className="rounded-[28px] bg-ink p-8 text-paper sm:p-10">
        <div className="flex items-center justify-between"><p className="text-[14px] font-medium">Free</p><span className="rounded-full border border-paper/25 px-3 py-1 text-[12px] text-paper/70">Every feature</span></div>
        <p className="mt-4 flex items-end gap-2"><span className="text-[64px] font-semibold leading-none tracking-[-0.04em]">$0</span><span className="mb-2 text-paper/50">forever</span></p>
        <CtaLink className="mt-8 flex h-12 items-center justify-center rounded-full bg-paper text-[15px] font-medium text-ink transition-transform hover:scale-[1.02]">Start your journal</CtaLink>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">{INCLUDED.map((f) => <li key={f} className="flex gap-2.5 text-[14px]"><Check size={16} className="mt-0.5 shrink-0" />{f}</li>)}</ul>
      </div>
      <div className="grid gap-5">
        <div className="rounded-[28px] border border-ink/10 bg-paper-2 p-8">
          <p className="text-[14px] font-medium text-ink/70">No paid plan</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/60">There's nothing to upgrade to. If a paid plan ever arrives, everything listed under Free stays free — announced on the pricing page first.</p>
          <Link href="/pricing" className="mt-6 inline-flex text-[14px] font-medium underline underline-offset-4">Pricing details</Link>
        </div>
        <div className="rounded-[28px] border border-ink/10 bg-paper-2 p-8">
          <p className="text-[14px] font-medium text-ink/70">No card. No trial clock.</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/60">Ledgr works in your browser straight away. A free account only adds backup and sync between devices.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Install */
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
export function InstallButton() {
  const [ev, setEv] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEv(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", () => setDone(true));
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  if (done) return <p className="text-[14px] text-paper/70">Installed. Find Ledgr with your other apps.</p>;
  return ev
    ? <button type="button" onClick={async () => { await ev.prompt(); const c = await ev.userChoice; if (c.outcome === "accepted") setDone(true); }} className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-7 text-[15px] font-medium text-ink transition-transform hover:scale-[1.03]"><Download size={16} /> Install Ledgr</button>
    : <Link href="/dashboard" className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-7 text-[15px] font-medium text-ink transition-transform hover:scale-[1.03]"><Download size={16} /> Open Ledgr to install</Link>;
}

export function Install() {
  return (
    <div className="relative overflow-hidden rounded-[36px] bg-ink px-6 pt-16 text-paper sm:px-12 lg:px-16">
      <div aria-hidden className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-paper/10 blur-[110px]" />
      <div aria-hidden className="absolute -bottom-52 -left-24 h-[440px] w-[440px] rounded-full bg-paper/[0.07] blur-[100px]" />
      <div className="relative grid items-end gap-12 lg:grid-cols-[1fr_1.15fr]">
        <div className="pb-16">
          <h2 className="text-[40px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[60px]">Keep Ledgr one click away.</h2>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-paper/60">Install it like an app on your computer or phone — its own window and icon, opening straight to your journal. No app store, nothing to download first.</p>
          <div className="mt-8"><InstallButton /></div>
          <ul className="mt-8 grid gap-2.5 text-[13.5px] text-paper/60">
            <li className="flex items-center gap-2.5"><Monitor size={15} /> Chrome or Edge: the install icon in the address bar</li>
            <li className="flex items-center gap-2.5"><Smartphone size={15} /> iPhone: Share → Add to Home Screen</li>
            <li className="flex items-center gap-2.5"><Smartphone size={15} /> Android: menu → Install app</li>
          </ul>
        </div>
        {/* device mockups */}
        <div className="relative h-[300px] sm:h-[420px]">
          <div className="absolute bottom-0 left-0 w-[88%] rounded-t-[18px] border border-paper/15 bg-[#151515] p-2 pb-0 shadow-[0_-20px_80px_-20px_rgba(255,255,255,.12)]">
            <div className="flex items-center gap-1.5 px-2 pb-2"><span className="h-2 w-2 rounded-full bg-paper/25" /><span className="h-2 w-2 rounded-full bg-paper/25" /><span className="h-2 w-2 rounded-full bg-paper/25" /><span className="ml-2 text-[10px] text-paper/40">Ledgr</span></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/dashboard.png" alt="Ledgr installed as a desktop app, with simulated sample records" className="block w-full rounded-t-[10px]" />
          </div>
          <div className="absolute -bottom-6 right-0 w-[30%] min-w-[120px] rounded-[30px] border-[6px] border-[#1f1f1f] bg-black shadow-[0_30px_60px_-20px_rgba(0,0,0,.8)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/mobile.png" alt="Ledgr on a phone, with simulated sample records" className="block w-full rounded-[24px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
