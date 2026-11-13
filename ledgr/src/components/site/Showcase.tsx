"use client";
import { useState } from "react";
import { cx } from "@/lib/util";
import { TiltCard } from "./SiteChrome";

export const SHOTS = [
  { key: "dashboard", label: "Dashboard", caption: "Your key numbers at a glance, a P&L curve, a calendar of every trading day and your LEDGR score — in one calm view." },
  { key: "journal", label: "Journal", caption: "Every trade with its executions, setup, emotions and lessons. Drafts never pollute your statistics." },
  { key: "analytics", label: "Analytics", caption: "Fourteen charts and fourteen pattern checks, each built only from what you recorded." },
  { key: "psychology", label: "Psychology", caption: "A discipline score you can read line by line — process, never profit." },
  { key: "ai", label: "MatrixX AI", caption: "Ask about your own history. Every answer links back to the trades it used." },
  { key: "reports", label: "Reports", caption: "Clean recap cards and PDFs, with only the details you choose to share." },
] as const;

export function Showcase() {
  const [active, setActive] = useState<(typeof SHOTS)[number]["key"]>("dashboard");
  const shot = SHOTS.find((s) => s.key === active)!;
  return (
    <div>
      <div role="tablist" aria-label="Product views" className="mx-auto mb-8 flex max-w-full gap-1 overflow-x-auto rounded-full border border-ink/10 bg-ink/[0.03] p-1 sm:w-fit">
        {SHOTS.map((s) => (
          <button key={s.key} role="tab" type="button" aria-selected={active === s.key} onClick={() => setActive(s.key)}
            className={cx("shrink-0 rounded-full px-4 py-2 text-[13px] transition-colors", active === s.key ? "bg-ink text-paper" : "text-ink/60 hover:text-ink")}>
            {s.label}
          </button>
        ))}
      </div>
      <TiltCard className="mx-auto max-w-[1080px] rounded-[22px]" max={4}>
        <div className="overflow-hidden rounded-[22px] border border-ink/15 bg-paper-2 p-1.5 site-shadow">
          <div className="flex items-center gap-1.5 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-ink/15" /><span className="h-2.5 w-2.5 rounded-full bg-ink/15" /><span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
            <span className="ml-3 truncate text-[11px] text-ink/35">ledgr · {shot.label.toLowerCase()}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={shot.key} src={`/site/${shot.key}.png`} alt={`Ledgr ${shot.label} screen with simulated sample records`} width={1440} height={900} className="animate-fade block h-auto w-full rounded-[16px]" />
        </div>
      </TiltCard>
      <p className="mx-auto mt-6 max-w-xl text-center text-[14px] text-ink/55">{shot.caption}</p>
    </div>
  );
}
