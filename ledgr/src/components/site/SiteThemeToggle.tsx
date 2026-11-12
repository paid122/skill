"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Light / dark switch for the public website. Remembered per browser. */
export function SiteThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.siteTheme === "dark"), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.siteTheme = next ? "dark" : "light";
    try { localStorage.setItem("ledgr.siteTheme", next ? "dark" : "light"); } catch { /* ignore */ }
    window.dispatchEvent(new Event("ledgr:site-theme"));
  };
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode" onClick={toggle}
      className="relative flex h-8 w-[58px] items-center rounded-full border border-ink/15 bg-ink/[0.04] px-1 transition-colors hover:border-ink/30">
      <span className={`grid h-6 w-6 place-items-center rounded-full bg-ink text-paper shadow transition-transform duration-300 ${dark ? "translate-x-[26px]" : "translate-x-0"}`}>
        {dark ? <Moon size={13} /> : <Sun size={13} />}
      </span>
    </button>
  );
}
