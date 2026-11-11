"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/util";

export function SettingsNav() {
  const p = usePathname();
  const items = [{ href: "/settings", label: "General" }, { href: "/settings/appearance", label: "Appearance" }];
  return (
    <nav className="flex gap-1 border-b border-line-soft" aria-label="Settings sections">
      {items.map((i) => <Link key={i.href} href={i.href} aria-current={p === i.href ? "page" : undefined} className={cx("-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium", p === i.href ? "border-accent text-text" : "border-transparent text-muted hover:text-text-2")}>{i.label}</Link>)}
    </nav>
  );
}
