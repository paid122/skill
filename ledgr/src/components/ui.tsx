"use client";
import { X } from "lucide-react";
import Link from "next/link";
import {
  cloneElement, isValidElement, type ReactElement,
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/util";

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
const variants: Record<Variant, string> = {
  primary: "bg-text text-bg hover:bg-ivory",
  accent: "bg-accent text-on-accent hover:brightness-110",
  secondary: "bg-card-2 text-text border border-line hover:border-muted/60",
  ghost: "text-text-2 hover:text-text hover:bg-card-2",
  danger: "text-neg border border-neg/30 hover:bg-neg/10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode }>(
  function Button({ variant = "secondary", size = "md", icon, className, children, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-[background,color,border-color,filter] duration-150 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
          size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm",
          variants[variant],
          className,
        )}
        {...rest}
      >
        {icon}
        {children}
      </button>
    );
  },
);

export function ButtonLink({ href, variant = "secondary", size = "md", icon, children, className }: { href: string; variant?: Variant; size?: "sm" | "md"; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors duration-150 whitespace-nowrap", size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm", variants[variant], className)}>
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip text={label}>
      <button type="button" aria-label={label} className={cx("grid h-9 w-9 place-items-center rounded-[10px] text-text-2 transition-colors duration-150 hover:bg-card-2 hover:text-text disabled:opacity-40", className)} {...rest}>
        {children}
      </button>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Tooltip — CSS only, appears on hover and keyboard focus
// ---------------------------------------------------------------------------

export function Tooltip({ text, children, side = "top", className }: { text: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom"; className?: string }) {
  const pos = side === "right" ? "left-full top-1/2 -translate-y-1/2 ml-2" : side === "bottom" ? "top-full left-1/2 -translate-x-1/2 mt-2" : "bottom-full left-1/2 -translate-x-1/2 mb-2";
  return (
    <span className={cx("group/tt relative inline-flex", className)}>
      {children}
      <span role="tooltip" className={cx("pointer-events-none absolute z-50 w-max max-w-[260px] hidden rounded-lg border border-line bg-card-2 px-2.5 py-1.5 text-xs font-normal leading-snug text-text shadow-xl animate-fade group-hover/tt:block group-focus-within/tt:block", pos)}>
        {text}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ children, className, pad = true, ...rest }: { children: ReactNode; className?: string; pad?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("card", pad && "card-pad", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub, action, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "pos" | "neg" | "neutral" | "accent" | "muted"; className?: string }) {
  const tones = {
    default: "bg-card-2 text-text-2 border-line",
    pos: "bg-pos/10 text-pos border-pos/25",
    neg: "bg-neg/10 text-neg border-neg/25",
    neutral: "bg-neutral/10 text-neutral border-neutral/25",
    accent: "bg-accent/10 text-accent border-accent/30",
    muted: "bg-transparent text-muted border-line",
  };
  return <span className={cx("inline-flex h-[22px] items-center gap-1 rounded-md border px-2 text-[11.5px] font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center", className)}>
      {icon && <div className="grid h-10 w-10 place-items-center rounded-full bg-card-2 text-muted">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-text">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function NotEnoughData({ note }: { note?: string }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 text-center">
      <p className="text-[13px] text-text-2">Not enough journal data yet.</p>
      {note && <p className="max-w-xs text-xs text-muted">{note}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const LABELABLE = new Set<unknown>(["input", "select", "textarea"]);

/** Labelled form field. A single input-like child is associated with the label automatically. */
export function Field({ label, hint, error, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string }) {
  const autoId = useId();
  let id = htmlFor;
  let content = children;
  if (!id && isValidElement(children)) {
    const el = children as ReactElement<{ id?: string }>;
    if (LABELABLE.has(el.type) || el.type === Input || el.type === Textarea || el.type === Select || el.type === NumberInput) {
      id = el.props.id ?? autoId;
      content = cloneElement(el, { id });
    }
  }
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {id ? <label className="label" htmlFor={id}>{label}</label> : <span className="label">{label}</span>}
      {content}
      {error ? <p className="text-xs text-neg">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx("input h-9", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx("input", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("input h-9", className)} {...rest}>
      {children}
    </select>
  );
}

/** Number input that keeps the raw text while typing and reports a parsed number or null. */
export function NumberInput({ value, onChange, allowEmpty = true, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null; onChange: (n: number | null) => void; allowEmpty?: boolean }) {
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value === null || value === undefined ? "" : String(value));
      last.current = value;
    }
  }, [value]);
  return (
    <input
      inputMode="decimal"
      className={cx("input h-9 num", className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        setText(e.target.value);
        if (t.trim() === "" || t === "-") {
          if (allowEmpty) { last.current = null; onChange(null); }
          return;
        }
        const n = Number(t);
        if (Number.isFinite(n)) { last.current = n; onChange(n); }
      }}
      {...rest}
    />
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm text-text">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150", checked ? "border-accent bg-accent" : "border-line bg-card-2")}
      >
        <span className={cx("absolute top-[2px] h-3.5 w-3.5 rounded-full transition-[left,background] duration-150", checked ? "left-[18px] bg-on-accent" : "left-[2px] bg-muted")} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md", className, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md"; className?: string; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx("inline-flex rounded-[10px] border border-line bg-bg-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("rounded-[8px] font-medium transition-colors duration-150", size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]", value === o.value ? "bg-card-2 text-text shadow-sm" : "text-muted hover:text-text-2")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange, tone }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; tone?: (o: T) => "pos" | "neg" | "default" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        const t = tone?.(o) ?? "default";
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cx(
              "h-8 rounded-full border px-3 text-[13px] transition-colors duration-150",
              on ? (t === "pos" ? "border-pos/50 bg-pos/10 text-pos" : t === "neg" ? "border-neg/50 bg-neg/10 text-neg" : "border-accent/60 bg-accent/10 text-accent") : "border-line text-text-2 hover:border-muted/70 hover:text-text",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: ReactNode; badge?: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("flex gap-1 overflow-x-auto border-b border-line-soft scroll-thin", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            const i = tabs.findIndex((x) => x.value === value);
            if (e.key === "ArrowRight") onChange(tabs[(i + 1) % tabs.length].value);
            if (e.key === "ArrowLeft") onChange(tabs[(i - 1 + tabs.length) % tabs.length].value);
          }}
          className={cx(
            "relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors duration-150",
            value === t.value ? "border-accent text-text" : "border-transparent text-muted hover:text-text-2",
          )}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({ open, onClose, title, children, footer, size = "md", description }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus],input,textarea,select,button")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" className={cx("animate-modal relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl sm:rounded-2xl", widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scroll-thin">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-bg-2/40 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Toasts & confirmation
// ---------------------------------------------------------------------------

interface Toast { id: number; message: string; tone: "default" | "error" }
interface ConfirmReq { title: string; body?: string; confirm: string; danger?: boolean; resolve: (v: boolean) => void }
const FeedbackCtx = createContext<{ toast: (m: string, tone?: Toast["tone"]) => void; confirm: (o: Omit<ConfirmReq, "resolve">) => Promise<boolean> } | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const toast = useCallback((message: string, tone: Toast["tone"] = "default") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const confirm = useCallback((o: Omit<ConfirmReq, "resolve">) => new Promise<boolean>((resolve) => setReq({ ...o, resolve })), []);
  const close = (v: boolean) => { req?.resolve(v); setReq(null); };
  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2 lg:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("animate-modal rounded-xl border px-4 py-2.5 text-[13px] shadow-2xl", t.tone === "error" ? "border-neg/40 bg-card-2 text-neg" : "border-line bg-card-2 text-text")}>
            {t.message}
          </div>
        ))}
      </div>
      <Modal
        open={!!req}
        onClose={() => close(false)}
        title={req?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
            <Button variant={req?.danger ? "danger" : "primary"} onClick={() => close(true)} data-autofocus>{req?.confirm}</Button>
          </>
        }
      >
        <p className="text-sm text-text-2">{req?.body}</p>
      </Modal>
    </FeedbackCtx.Provider>
  );
}

export function useFeedback() {
  const c = useContext(FeedbackCtx);
  if (!c) throw new Error("useFeedback outside provider");
  return c;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function Progress({ value, tone = "accent", className }: { value: number; tone?: "accent" | "pos" | "neg"; className?: string }) {
  const c = tone === "pos" ? "bg-pos" : tone === "neg" ? "bg-neg" : "bg-accent";
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-card-2", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-bg-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">{children}</kbd>;
}

/** Animates a number from its previous value. */
export function useAnimatedNumber(target: number | null, duration = 450) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (target === null || from.current === null || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - (1 - p) ** 3;
      setV(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}
