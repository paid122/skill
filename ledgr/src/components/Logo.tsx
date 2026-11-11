import { cx } from "@/lib/util";

/**
 * Ledgr mark: an abstract L built from a ledger page — a strong vertical spine,
 * a heavy baseline, and two ruled entry lines stepping down toward the base.
 */
export function LogoMark({ size = 28, className, animated = false }: { size?: number; className?: string; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M9 7.5V24.5H23.5" stroke="var(--accent)" strokeWidth="3" strokeLinecap="square" />
      <path
        d="M13.5 13H20.5M13.5 18.5H23"
        stroke="currentColor"
        strokeOpacity="0.75"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={animated ? "30" : undefined}
        style={animated ? { animation: "ledger-draw 1.6s ease-in-out infinite" } : undefined}
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("font-semibold tracking-[0.28em] text-[13px] text-text", className)} style={{ fontFeatureSettings: '"ss01"' }}>
      LEDGR
    </span>
  );
}

export function FullLogo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-3 text-text", className)}>
      <LogoMark size={size} />
      <Wordmark />
    </span>
  );
}

export function LoadingScreen({ label = "Opening your ledger" }: { label?: string }) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-text">
        <LogoMark size={44} animated />
        <span className="text-xs text-muted">{label}…</span>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cx("inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin", className)} role="status" aria-label="Loading" />
  );
}
