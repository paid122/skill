"use client";
import { useState } from "react";
import { cx } from "@/lib/util";
import { TiltCard } from "./SiteChrome";

export const SHOTS = [
  { key: "dashboard", label: "Dashboard", caption: "Six honest numbers, a zoomable equity curve, your calendar and today's checklist — in one calm view." },
  { key: "journal", label: "Journal", caption: "Every trade with its executions, setup, emotions and lessons. Drafts never pollute your statistics." },
  { key: "analytics", label: "Analytics", caption: "Fourteen charts and fourteen pattern checks, each built only from what you recorded." },
  { key: "psychology", label: "Psychology", caption: "A discipline score you can read line by line — process, never profit." },
  { key: "ai", label: "Ledgr AI", caption: "Ask about your own history. Every answer links back to the trades it used." },
  { key: "reports", label: "Reports", caption: "Clean recap cards and PDFs, with only the details you choose to share." },
] as const;

export function Showcase() {
  const [active, setActive] = useState<(typeof SHOTS)[number]["key"]>("dashboard");
  const shot = SHOTS.find((s) => s.key === active)!;
  return (
    <div>
      <div role="tablist" aria-label="Product views" className="mx-auto mb-8 flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1 sm:w-fit">
        {SHOTS.map((s) => (
          <button key={s.key} role="tab" type="button" aria-selected={active === s.key} onClick={() => setActive(s.key)}
            className={cx("shrink-0 rounded-full px-4 py-2 text-[13px] transition-colors", active === s.key ? "bg-white text-black" : "text-white/60 hover:text-white")}>
            {s.label}
          </button>
        ))}
      </div>
      <TiltCard className="mx-auto max-w-[1080px] rounded-[22px]" max={4}>
        <div className="overflow-hidden rounded-[22px] border border-white/15 bg-[#0b0b0b] p-1.5 shadow-[0_40px_120px_-40px_rgba(255,255,255,0.25)]">
          <div className="flex items-center gap-1.5 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="ml-3 truncate text-[11px] text-white/35">ledgr · {shot.label.toLowerCase()}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={shot.key} src={`/site/${shot.key}.png`} alt={`Ledgr ${shot.label} screen with simulated sample records`} width={1440} height={900} className="animate-fade block h-auto w-full rounded-[16px]" />
        </div>
      </TiltCard>
      <p className="mx-auto mt-6 max-w-xl text-center text-[14px] text-white/55">{shot.caption}</p>
    </div>
  );
}
