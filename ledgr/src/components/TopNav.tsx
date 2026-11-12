"use client";
import { ChevronDown, Eye, EyeOff, PanelRightOpen, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setUI, useUI } from "@/lib/hooks";
import { openImport, openQuickLog, setPalette } from "@/lib/overlays";
import { useLedgr } from "@/lib/store";
import { cx } from "@/lib/util";
import { LogoMark } from "./Logo";
import { ALL_NAV, isActive, type NavItem } from "./nav";
import { Button, IconButton } from "./ui";
import { NotificationsButton } from "./AppShell";

const find = (href: string) => ALL_NAV.find((i) => i.href === href)!;

/**
 * Flat sections either side of the centred wordmark. Each has a "tier": tier-2 items show from
 * 1280px, tier-3 from 1536px; below that they move into the "More" menu so the bar always fits.
 */
type Entry = { label: string; item: NavItem; tier: 1 | 2 | 3 };
const LEFT: Entry[] = [
  { label: "Dashboard", item: find("/dashboard"), tier: 1 },
  { label: "Journal", item: find("/journal"), tier: 1 },
  { label: "Daily", item: find("/daily-journal"), tier: 2 },
  { label: "Showcase", item: find("/showcase"), tier: 3 },
  { label: "Strategy", item: find("/strategies"), tier: 3 },
  { label: "Study", item: find("/study"), tier: 2 },
];
const RIGHT: Entry[] = [
  { label: "Analytics", item: find("/analytics"), tier: 1 },
  { label: "Psychology", item: find("/psychology"), tier: 3 },
  { label: "Accounts", item: find("/accounts"), tier: 2 },
  { label: "AI", item: find("/ai"), tier: 1 },
  { label: "Reports", item: find("/reports"), tier: 3 },
];
const SHOW = { 1: "flex", 2: "hidden xl:flex", 3: "hidden 2xl:flex" } as const;
const IN_MORE = { 1: "hidden", 2: "flex xl:hidden", 3: "flex 2xl:hidden" } as const;
const MORE: { item: NavItem; className: string }[] = [
  ...[...LEFT, ...RIGHT].filter((e) => e.tier > 1).map((e) => ({ item: e.item, className: IN_MORE[e.tier] })),
  ...[find("/weekly-review"), find("/performance-score"), find("/account-history"), find("/verses")].map((item) => ({ item, className: "flex" })),
];

export function TopNav() {
  const pathname = usePathname();
  const prefs = useUI();
  const name = useLedgr((s) => s.settings.displayName);
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-bg/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-5">
        <Link href="/dashboard" className="shrink-0 text-text" aria-label="Ledgr home"><LogoMark size={28} /></Link>

        <nav aria-label="Primary" className="mx-auto flex min-w-0 items-center gap-0.5 rounded-full border border-line-soft bg-card/80 p-1 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.6)]">
          {LEFT.map((e) => <TopLink key={e.item.href} item={e.item} label={e.label} active={isActive(pathname, e.item)} className={SHOW[e.tier]} />)}
          <Link href="/dashboard" aria-label="Ledgr" className="mx-1.5 whitespace-nowrap px-1 text-[15px] font-semibold tracking-[0.2em] text-text xl:mx-2.5 xl:text-[16px]">LEDGR</Link>
          {RIGHT.map((e) => <TopLink key={e.item.href} item={e.item} label={e.label} active={isActive(pathname, e.item)} className={SHOW[e.tier]} />)}
          <TopMenu label="More" entries={MORE} pathname={pathname} />
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Search (Ctrl K)" onClick={() => setPalette(true)}><Search size={17} /></IconButton>
          <IconButton label={prefs.hideMoney ? "Show amounts" : "Hide amounts (R stays visible)"} aria-pressed={prefs.hideMoney} onClick={() => setUI({ hideMoney: !prefs.hideMoney })}>
            {prefs.hideMoney ? <EyeOff size={17} /> : <Eye size={17} />}
          </IconButton>
          <NotificationsButton />
          {!prefs.rail && <IconButton label="Show today's session panel" className="hidden xl:grid" onClick={() => setUI({ rail: true })}><PanelRightOpen size={17} /></IconButton>}
          <Button size="sm" icon={<Upload size={15} />} onClick={openImport} className="ml-1 h-9 rounded-full" aria-label="Import CSV trades"><span className="hidden 2xl:inline">Import CSV</span></Button>
          <Button variant="accent" size="sm" icon={<Plus size={15} />} onClick={openQuickLog} className="ml-1 h-9 rounded-full" aria-keyshortcuts="n" aria-label="Quick Log"><span className="hidden xl:inline">Quick Log</span></Button>
          <Link href="/settings" aria-label="Settings and profile" className="ml-1 flex items-center gap-2.5 rounded-full py-1 pl-2 pr-1 transition-colors hover:bg-card-2">
            <span className="hidden max-w-[120px] truncate text-[13.5px] font-medium text-text 2xl:inline">{name || "Your profile"}</span>
            <span className={cx("grid h-8 w-8 place-items-center rounded-full border text-[13px] font-semibold", pathname.startsWith("/settings") ? "border-accent bg-accent text-on-accent" : "border-line bg-card-2 text-text")}>{(name || "L").slice(0, 1).toUpperCase()}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function TopLink({ item, label, active, className }: { item: NavItem; label: string; active: boolean; className?: string }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} data-active={active || undefined}
      className={cx(className ?? "flex", "h-9 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[13.5px] transition-colors", active ? "bg-card-2 text-text shadow-sm" : "text-text-2 hover:text-text")}>
      <Icon size={15} strokeWidth={1.75} className={cx("hidden min-[1800px]:block", active ? "text-text" : "text-muted")} />
      {label}
    </Link>
  );
}

function TopMenu({ label, entries, pathname }: { label: string; entries: { item: NavItem; className: string }[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedBy = useRef<"hover" | "click" | null>(null);
  // Highlight only for pages that always live in this menu (others have their own link at wide widths).
  const active = entries.some((e) => e.className === "flex" && isActive(pathname, e.item));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const hoverOpen = () => { if (timer.current) clearTimeout(timer.current); if (!open) openedBy.current = "hover"; setOpen(true); };
  // A click after hovering keeps the menu open (and pins it); a second click closes it.
  const onClick = () => {
    if (!open || openedBy.current === "hover") { openedBy.current = "click"; setOpen(true); }
    else { openedBy.current = null; setOpen(false); }
  };
  const hoverClose = () => { timer.current = setTimeout(() => setOpen(false), 140); };

  return (
    <div ref={ref} className="relative" onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
      <button type="button" aria-expanded={open} aria-haspopup="true" data-active={active || undefined} onClick={onClick}
        className={cx("flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13.5px] transition-colors", active ? "bg-card-2 text-text shadow-sm" : "text-text-2 hover:text-text")}>
        {label}
        <ChevronDown size={13} className={cx("text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-modal absolute right-0 top-11 z-50 w-60 rounded-2xl border border-line bg-card p-1.5 shadow-2xl" role="menu">
          {entries.map(({ item: i, className }) => {
            const I = i.icon;
            const on = isActive(pathname, i);
            return (
              <Link key={i.href} href={i.href} role="menuitem" aria-current={on ? "page" : undefined}
                className={cx(className, "items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors", on ? "bg-card-2 text-text" : "text-text-2 hover:bg-card-2/60 hover:text-text")}>
                <I size={16} strokeWidth={1.75} className={on ? "text-text" : "text-muted"} />{i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
