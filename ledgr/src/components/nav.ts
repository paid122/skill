import {
  BarChart3, BookMarked, BookOpen, Brain, CalendarDays, ClipboardList, FileText, Gauge, GraduationCap, History,
  LayoutDashboard, type LucideIcon, NotebookPen, Settings, Sparkles, SquareLibrary, Trophy, Wallet,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; match?: string[] }
export interface NavGroup { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Journal",
    items: [
      { href: "/journal", label: "Trade Journal", icon: NotebookPen },
      { href: "/daily-journal", label: "Daily Journal", icon: CalendarDays },
      { href: "/weekly-review", label: "Weekly Review", icon: ClipboardList },
      { href: "/showcase", label: "Showcase", icon: Trophy },
    ],
  },
  {
    label: "Performance",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/psychology", label: "Psychology", icon: Brain },
      { href: "/strategies", label: "Strategies", icon: SquareLibrary },
      { href: "/performance-score", label: "Performance Score", icon: Gauge },
    ],
  },
  {
    label: "Accounts",
    items: [
      { href: "/accounts", label: "Account Desk", icon: Wallet, match: ["/accounts"] },
      { href: "/account-history", label: "Account History", icon: History },
    ],
  },
  {
    label: "Learning",
    items: [
      { href: "/study", label: "Study Room", icon: GraduationCap },
      { href: "/verses", label: "Verse Library", icon: BookOpen },
    ],
  },
  { label: "Intelligence", items: [{ href: "/ai", label: "Ledgr AI", icon: Sparkles }] },
  {
    label: "Personal",
    items: [
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
    ],
  },
];

export const ALL_NAV = NAV.flatMap((g) => g.items);

export const MOBILE_PRIMARY: NavItem[] = [
  ALL_NAV.find((i) => i.href === "/dashboard")!,
  ALL_NAV.find((i) => i.href === "/journal")!,
  ALL_NAV.find((i) => i.href === "/analytics")!,
  ALL_NAV.find((i) => i.href === "/daily-journal")!,
];

export function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  return (item.match ?? [item.href]).some((m) => pathname.startsWith(m + "/")) || pathname.startsWith(item.href + "/");
}

export function titleFor(pathname: string) {
  const item = ALL_NAV.find((i) => isActive(pathname, i));
  return item?.label ?? "Ledgr";
}

export { BookMarked };
