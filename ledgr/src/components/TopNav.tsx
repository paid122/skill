"use client";
import { ChevronDown, Eye, EyeOff, PanelRightOpen, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setUI, useUI } from "@/lib/hooks";
import { openQuickLog, setPalette } from "@/lib/overlays";
import { useLedgr } from "@/lib/store";
import { cx } from "@/lib/util";
import { LogoMark, Wordmark } from "./Logo";
import { ALL_NAV, isActive, type NavItem } from "./nav";
import { Button, IconButton, Tooltip } from "./ui";
import { NotificationsButton } from "./AppShell";

const find = (href: string) => ALL_NAV.find((i) => i.href === href)!;

/** Top navigation groups. Single items link directly; groups open a menu. */
const TOP: ({ label: string; items: NavItem[] })[] = [
  { label: "Dashboard", items: [find("/dashboard")] },
  { label: "Journal", items: [find("/journal"), find("/daily-journal"), find("/weekly-review"), find("/showcase")] },
  { label: "Performance", items: [find("/analytics"), find("/psychology"), find("/strategies"), find("/performance-score")] },
  { label: "Accounts", items: [find("/accounts"), find("/account-history")] },
  { label: "Learn", items: [find("/study"), find("/verses")] },
  { label: "Ledgr AI", items: [find("/ai")] },
  { label: "Reports", items: [find("/reports")] },
];

export function TopNav() {
  const pathname = usePathname();
  const prefs = useUI();
  const name = useLedgr((s) => s.settings.displayName);
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-bg/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-5">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 text-text" aria-label="Ledgr home">
          <LogoMark size={28} />
          <Wordmark className="hidden 2xl:inline" />
        </Link>

        <nav aria-label="Primary" className="mx-auto flex min-w-0 items-center gap-0.5 rounded-full border border-line-soft bg-card/80 p-1 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.6)]">
          {TOP.map((g) => g.items.length === 1
            ? <TopLink key={g.label} item={g.items[0]} label={g.label} active={isActive(pathname, g.items[0])} />
            : <TopMenu key={g.label} label={g.label} items={g.items} pathname={pathname} />)}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Search (Ctrl K)" onClick={() => setPalette(true)}><Search size={17} /></IconButton>
          <IconButton label={prefs.hideMoney ? "Show amounts" : "Hide amounts (R stays visible)"} aria-pressed={prefs.hideMoney} onClick={() => setUI({ hideMoney: !prefs.hideMoney })}>
            {prefs.hideMoney ? <EyeOff size={17} /> : <Eye size={17} />}
          </IconButton>
          <NotificationsButton />
          {!prefs.rail && <IconButton label="Show today's session panel" className="hidden xl:grid" onClick={() => setUI({ rail: true })}><PanelRightOpen size={17} /></IconButton>}
          <Button variant="accent" size="sm" icon={<Plus size={15} />} onClick={openQuickLog} className="ml-1 h-9 rounded-full" aria-keyshortcuts="n">Quick Log</Button>
          <Tooltip text={name ? `${name} · Settings` : "Settings"} side="bottom">
            <Link href="/settings" aria-label="Settings and profile" className={cx("ml-1 grid h-9 w-9 place-items-center rounded-full border text-[13px] font-semibold transition-colors", pathname.startsWith("/settings") ? "border-accent bg-accent text-on-accent" : "border-line bg-card-2 text-text hover:border-muted")}>
              {(name || "L").slice(0, 1).toUpperCase()}
            </Link>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

function TopLink({ item, label, active }: { item: NavItem; label: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} data-active={active || undefined}
      className={cx("flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13.5px] transition-colors", active ? "bg-card-2 text-text shadow-sm" : "text-text-2 hover:text-text")}>
      <Icon size={15} strokeWidth={1.75} className={active ? "text-text" : "text-muted"} />
      {label}
    </Link>
  );
}

function TopMenu({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedBy = useRef<"hover" | "click" | null>(null);
  const active = items.some((i) => isActive(pathname, i));
  const current = items.find((i) => isActive(pathname, i));
  const Icon = (current ?? items[0]).icon;

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
        <Icon size={15} strokeWidth={1.75} className={active ? "text-text" : "text-muted"} />
        {current && current.label !== label ? current.label.replace("Trade Journal", "Journal") : label}
        <ChevronDown size={13} className={cx("text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-modal absolute left-1/2 top-11 z-50 w-60 -translate-x-1/2 rounded-2xl border border-line bg-card p-1.5 shadow-2xl" role="menu">
          {items.map((i) => {
            const I = i.icon;
            const on = isActive(pathname, i);
            return (
              <Link key={i.href} href={i.href} role="menuitem" aria-current={on ? "page" : undefined}
                className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors", on ? "bg-card-2 text-text" : "text-text-2 hover:bg-card-2/60 hover:text-text")}>
                <I size={16} strokeWidth={1.75} className={on ? "text-text" : "text-muted"} />{i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
