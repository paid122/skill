"use client";
/** "Pick a part": the app in a window over the landscape, with labelled buttons around it. */
import { Bot, Brain, ChartNoAxesCombined, FileText, LayoutDashboard, NotebookPen, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cx } from "@/lib/util";
import { Landscape } from "./Cinematic";

const PARTS: { key: string; label: string; icon: LucideIcon; side: "l" | "r"; title: string; line: string; points: string[] }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, side: "l", title: "Dashboard", line: "Where the day starts.", points: ["Net P&L, win rate, avg win/loss, profit factor and streaks", "P&L curve and a calendar of your days", "Your LEDGR score, checklist and today's verse"] },
  { key: "journal", label: "Journal", icon: NotebookPen, side: "l", title: "Journal", line: "Every trade, honestly recorded.", points: ["Multiple entries, partial exits and fees", "Drafts kept out of your statistics", "Search, filters and saved views"] },
  { key: "analytics", label: "Analytics", icon: ChartNoAxesCombined, side: "l", title: "Analytics", line: "Patterns, only when they're real.", points: ["Fourteen charts, fourteen pattern checks", "Sample sizes always shown", "What-if analysis on your own records"] },
  { key: "psychology", label: "Psychology", icon: Brain, side: "r", title: "Psychology", line: "Measure the process, not the result.", points: ["Emotion and mistake tracking", "Discipline score you can read line by line", "Never calculated from profit"] },
  { key: "ai", label: "MatrixX AI", icon: Bot, side: "r", title: "MatrixX AI", line: "Ask about your own history.", points: ["Answers from your saved trades", "Every answer links the trades it used", "No predictions, no signals"] },
  { key: "reports", label: "Reports", icon: FileText, side: "r", title: "Reports", line: "Show your work, on your terms.", points: ["Weekly and monthly recaps", "PNG and PDF export", "Amounts hidden unless you include them"] },
];

export function Explorer() {
  const [active, setActive] = useState("dashboard");
  const part = PARTS.find((p) => p.key === active)!;
  const Btn = ({ p }: { p: (typeof PARTS)[number] }) => (
    <button type="button" aria-pressed={active === p.key} onClick={() => setActive(p.key)} onMouseEnter={() => setActive(p.key)}
      className={cx("flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-[14px] font-medium shadow-[0_10px_30px_-12px_rgba(0,0,0,.35)] backdrop-blur-md transition-all",
        active === p.key ? "scale-[1.04] border-white bg-white text-[#0a0a0a]" : "border-white/50 bg-white/60 text-[#0a0a0a]/75 hover:bg-white/85")}>
      <span className={cx("grid h-8 w-8 place-items-center rounded-xl", active === p.key ? "bg-[#0a0a0a] text-white" : "bg-[#0a0a0a]/80 text-white")}><p.icon size={16} strokeWidth={1.8} /></span>
      {p.label}
    </button>
  );
  return (
    <div className="relative overflow-hidden rounded-[32px]">
      <Landscape walker={false} className="!absolute" />
      <div className="relative px-4 pb-10 pt-14 sm:px-8 lg:px-10 lg:pb-16">
        {/* mobile / tablet chips */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden">{PARTS.map((p) => <div key={p.key} className="shrink-0"><Btn p={p} /></div>)}</div>
        <div className="grid items-center gap-6 lg:grid-cols-[170px_minmax(0,1fr)_170px]">
          <div className="hidden flex-col items-start gap-5 lg:flex">{PARTS.filter((p) => p.side === "l").map((p, i) => <div key={p.key} style={{ marginLeft: i === 1 ? 0 : 18 }}><Btn p={p} /></div>)}</div>
          <div className="relative">
            <div className="overflow-hidden rounded-[18px] border border-white/60 bg-[#0b0b0b] p-1 shadow-[0_40px_80px_-30px_rgba(0,0,0,.6)]">
              <div className="flex items-center gap-1.5 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="ml-3 text-[11px] text-white/40">ledgr · {part.label.toLowerCase()}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img key={part.key} src={`/site/${part.key}.png`} alt={`Ledgr ${part.label} with simulated sample records`} width={1440} height={900} className="animate-fade block h-auto w-full rounded-[13px]" />
            </div>
            {/* description card */}
            <div key={part.key + "-card"} className="animate-fade relative z-10 mx-auto -mt-10 w-[min(92%,420px)] rounded-[20px] border border-[#0a0a0a]/10 bg-white p-5 text-[#0a0a0a] shadow-[0_24px_60px_-24px_rgba(0,0,0,.45)] lg:absolute lg:-bottom-8 lg:left-8 lg:mt-0 lg:w-[360px]">
              <p className="text-[18px] font-semibold tracking-tight">{part.title}</p>
              <p className="text-[14px] text-[#0a0a0a]/55">{part.line}</p>
              <ul className="mt-3 grid gap-1.5">{part.points.map((x) => <li key={x} className="flex gap-2 text-[13.5px]"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0a0a0a]" />{x}</li>)}</ul>
            </div>
          </div>
          <div className="hidden flex-col items-end gap-5 lg:flex">{PARTS.filter((p) => p.side === "r").map((p, i) => <div key={p.key} style={{ marginRight: i === 1 ? 0 : 18 }}><Btn p={p} /></div>)}</div>
        </div>
      </div>
    </div>
  );
}
