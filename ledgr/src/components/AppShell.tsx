"use client";
import { Bell, ChevronsLeft, ChevronsRight, Eye, EyeOff, Menu, PanelRightOpen, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dismissNotification, updateSettings } from "@/lib/actions";
import { defaultAppearance } from "@/lib/defaults";
import { setUI, useNotifications, useUI } from "@/lib/hooks";
import { openQuickLog, setPalette, useOverlays } from "@/lib/overlays";
import { hydrate, useHydrated, useLedgr, useStorageError } from "@/lib/store";
import { contrast, cx, setHideMoney, setNumberLocale } from "@/lib/util";
import { CommandPalette } from "./CommandPalette";
import { LoadingScreen, LogoMark, Wordmark } from "./Logo";
import { ALL_NAV, isActive, MOBILE_PRIMARY, NAV, titleFor } from "./nav";
import { Onboarding } from "./Onboarding";
import { QuickLog } from "./QuickLog";
import { CursorRing } from "./CursorRing";
import { SessionRail } from "./SessionRail";
import { TopNav } from "./TopNav";
import { SyncManager } from "./SyncManager";
import { TradeEditor } from "./TradeEditor";
import { Button, FeedbackProvider, IconButton, Kbd, Tooltip } from "./ui";

function useApplyAppearance() {
  const a = useLedgr((s) => s.settings.appearance);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = a.theme;
    el.dataset.density = a.density;
    el.dataset.font = a.font;
    // Fall back to the theme's own accent if a saved accent would be unreadable on this theme.
    const card = getComputedStyle(el).getPropertyValue("--card").trim() || "#0f0f0f";
    if (contrast(a.accent, card) >= 3) el.style.setProperty("--accent", a.accent);
    else el.style.removeProperty("--accent");
    // Keep each theme's tuned semantic colours unless the user picked their own.
    if (a.positiveColor.toLowerCase() === defaultAppearance.positiveColor.toLowerCase()) el.style.removeProperty("--pos");
    else el.style.setProperty("--pos", a.positiveColor);
    if (a.negativeColor.toLowerCase() === defaultAppearance.negativeColor.toLowerCase()) el.style.removeProperty("--neg");
    else el.style.setProperty("--neg", a.negativeColor);
    setNumberLocale(a.numberFormat);
  }, [a]);
  return a;
}

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useHydrated();
  useEffect(() => { hydrate(); }, []);
  if (!ready) return <LoadingScreen />;
  return (
    <FeedbackProvider>
      <Shell>{children}</Shell>
    </FeedbackProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const appearance = useApplyAppearance();
  const collapsed = useLedgr((s) => s.settings.sidebarCollapsed);
  const prefs = useUI();
  const topNav = appearance.nav !== "side";
  // Apply "hide amounts" before children render, so every amount is masked consistently.
  setHideMoney(prefs.hideMoney);
  const onboarded = useLedgr((s) => s.settings.onboarded);
  const sample = useLedgr((s) => s.sampleData);
  const storageError = useStorageError();
  const overlays = useOverlays();
  const [mobileMore, setMobileMore] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); }
      else if (!typing && e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openQuickLog(); }
      else if ((e.metaKey || e.ctrlKey) && e.key === "\\") { e.preventDefault(); updateSettings({ sidebarCollapsed: !collapsed }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed]);

  useEffect(() => setMobileMore(false), [pathname]);

  return (
    <div className="min-h-screen bg-bg text-text">
      {appearance.backgroundImage && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${appearance.backgroundImage})`, opacity: appearance.backgroundOpacity }} />
      )}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      {!topNav && <Sidebar collapsed={collapsed} translucent={appearance.sidebar === "translucent"} />}
      {topNav && <div className="relative z-30 hidden lg:block"><TopNav /></div>}
      <div className={cx("relative z-10 flex min-h-screen flex-col transition-[padding] duration-200", !topNav && (collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]"), prefs.rail && "xl:pr-[300px]")}>
        <div className={topNav ? "lg:hidden" : ""}><Topbar title={titleFor(pathname)} /></div>
        {sample && (
          <div className="mx-4 mt-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-2 text-[12.5px] text-text-2 sm:mx-6 lg:mx-10">
            You are viewing <span className="text-text">simulated sample records</span>. Remove them any time in{" "}
            <Link href="/settings#data" className="text-accent underline-offset-2 hover:underline">Settings → Data</Link>.
          </div>
        )}
        {storageError && <div className="mx-4 mt-3 rounded-xl border border-neg/30 bg-neg/10 px-4 py-2 text-[12.5px] text-neg sm:mx-6 lg:mx-10">{storageError}</div>}
        <main id="main" className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-14 animate-fade" key={`${pathname}-${prefs.hideMoney}`}>
          {children}
        </main>
      </div>
      <MobileNav onMore={() => setMobileMore(true)} />
      {mobileMore && <MobileMore onClose={() => setMobileMore(false)} />}
      {overlays.palette && <CommandPalette />}
      <QuickLog />
      {overlays.editor && <TradeEditor key={overlays.editor.tradeId ?? "new"} />}
      {!onboarded && <Onboarding />}
      <SyncManager />
      {appearance.cursor === "ring" && <CursorRing />}
      {prefs.rail && <SessionRail belowTopNav={topNav} />}
    </div>
  );
}

function Sidebar({ collapsed, translucent }: { collapsed: boolean; translucent: boolean }) {
  const pathname = usePathname();
  const name = useLedgr((s) => s.settings.displayName);
  const accounts = useLedgr((s) => s.accounts.filter((a) => a.status === "active").length);
  const navRef = useRef<HTMLElement>(null);

  // Preserve sidebar scroll position across navigation.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem("ledgr.sidebarScroll");
    if (saved) el.scrollTop = Number(saved);
    const onScroll = () => sessionStorage.setItem("ledgr.sidebarScroll", String(el.scrollTop));
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line-soft transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-[248px]",
        translucent ? "bg-sidebar/70 backdrop-blur-xl" : "bg-sidebar",
      )}
    >
      <div className={cx("flex h-16 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
        <Link href="/dashboard" className="flex items-center gap-3 text-text" aria-label="Ledgr home">
          <LogoMark size={28} />
          {!collapsed && <Wordmark />}
        </Link>
        {!collapsed && (
          <IconButton label="Collapse sidebar (Ctrl+\)" onClick={() => updateSettings({ sidebarCollapsed: true })} className="h-8 w-8">
            <ChevronsLeft size={16} />
          </IconButton>
        )}
      </div>
      <nav ref={navRef} aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4 scroll-thin">
        {NAV.map((g) => (
          <div key={g.label} className="mt-4 first:mt-1">
            {!collapsed ? <p className="mb-1.5 px-3 text-[11px] font-medium text-muted">{g.label}</p> : <div className="mx-auto mb-2 h-px w-6 bg-line-soft" />}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "group relative flex h-9 items-center gap-3 rounded-[10px] text-[13.5px] transition-colors duration-150",
                      collapsed ? "w-11 justify-center" : "px-3",
                      active ? "bg-card-2 text-text" : "text-text-2 hover:bg-card/70 hover:text-text",
                    )}
                  >
                    {active && <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-accent" />}
                    <Icon size={16} strokeWidth={1.75} className={active ? "text-accent" : "text-muted group-hover:text-text-2"} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
                return <li key={item.href} className={collapsed ? "flex justify-center" : ""}>{collapsed ? <Tooltip text={item.label} side="right">{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className={cx("border-t border-line-soft p-3", collapsed && "flex flex-col items-center gap-2")}>
        {collapsed ? (
          <>
            <IconButton label="Expand sidebar (Ctrl+\)" onClick={() => updateSettings({ sidebarCollapsed: false })}>
              <ChevronsRight size={16} />
            </IconButton>
            <Tooltip text={name || "Profile"} side="right">
              <Link href="/settings" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-card-2 text-[12px] font-semibold text-accent">{(name || "L").slice(0, 1).toUpperCase()}</Link>
            </Tooltip>
          </>
        ) : (
          <Link href="/settings" className="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors hover:bg-card/70">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-line bg-card-2 text-[13px] font-semibold text-accent">{(name || "L").slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-text">{name || "Your profile"}</span>
              <span className="block text-[11.5px] text-muted">{accounts} active account{accounts === 1 ? "" : "s"}</span>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function Topbar({ title }: { title: string }) {
  const prefs = useUI();
  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:h-16 lg:px-10">
        <Link href="/dashboard" className="text-text lg:hidden" aria-label="Ledgr home"><LogoMark size={26} /></Link>
        <h1 className="page-title min-w-0 truncate text-[15px] font-semibold tracking-tight text-text lg:text-base">{title}</h1>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="hidden h-9 w-[240px] items-center gap-2 rounded-[10px] border border-line bg-bg-2 px-3 text-[13px] text-muted transition-colors hover:border-muted/60 hover:text-text-2 md:flex"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Search Ledgr</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <IconButton label="Search" onClick={() => setPalette(true)} className="md:hidden"><Search size={17} /></IconButton>
          <IconButton label={prefs.hideMoney ? "Show amounts" : "Hide amounts (R stays visible)"} aria-pressed={prefs.hideMoney} onClick={() => setUI({ hideMoney: !prefs.hideMoney })}>
            {prefs.hideMoney ? <EyeOff size={17} /> : <Eye size={17} />}
          </IconButton>
          <NotificationsButton />
          {!prefs.rail && <IconButton label="Show today's session panel" className="hidden xl:grid" onClick={() => setUI({ rail: true })}><PanelRightOpen size={17} /></IconButton>}
          <Button variant="accent" size="sm" icon={<Plus size={15} />} onClick={openQuickLog} className="h-9" aria-keyshortcuts="n">
            <span className="hidden sm:inline">Quick Log</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function NotificationsButton() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconButton label="Notifications" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Bell size={17} />
        {items.length > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />}
      </IconButton>
      {open && (
        <div className="animate-modal absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
          <div className="border-b border-line-soft px-4 py-3 text-[13px] font-semibold">Reminders</div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">You're up to date.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="group flex gap-3 border-b border-line-soft px-4 py-3 last:border-0 hover:bg-card-2/50">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setOpen(false); router.push(n.href); }}>
                    <p className="text-[13px] font-medium text-text">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{n.body}</p>
                  </button>
                  <IconButton label="Dismiss" onClick={() => dismissNotification(n.id)} className="h-7 w-7"><X size={14} /></IconButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="grid grid-cols-5">
        {MOBILE_PRIMARY.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[10.5px]", active ? "text-accent" : "text-muted")}>
                <Icon size={19} strokeWidth={1.75} />
                {item.label.replace("Trade ", "")}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMore} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[10.5px] text-muted">
            <Menu size={19} strokeWidth={1.75} />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

function MobileMore({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const items = useMemo(() => ALL_NAV.filter((i) => !MOBILE_PRIMARY.includes(i)), []);
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="animate-modal absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-line bg-card px-4 pb-8 pt-4" role="dialog" aria-label="All sections">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            return (
              <Link key={item.href} href={item.href} className={cx("flex flex-col items-center gap-2 rounded-xl border px-2 py-4 text-center text-[12px]", active ? "border-accent/40 bg-accent/5 text-accent" : "border-line-soft text-text-2")}>
                <Icon size={18} strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
