"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { BP_LEVELS, bpLevel, type BpLevel } from "@/lib/stats";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const TONE_VAR = {
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
} as const;

/** Status badge: colored dot + text label (never color alone). */
export function LevelBadge({
  sys,
  dia,
  level,
  size = "sm",
}: {
  sys?: number;
  dia?: number;
  level?: BpLevel;
  size?: "sm" | "md";
}) {
  const lv = level ?? bpLevel(sys ?? 0, dia ?? 0);
  const meta = BP_LEVELS[lv];
  const color = TONE_VAR[meta.tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-medium text-ink whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
      style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {size === "sm" ? meta.short : meta.label}
    </span>
  );
}

export function Chip({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2">
      {icon}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
  allowEmpty,
}: {
  value: T | null;
  onChange: (v: T | null) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
  label: string;
  allowEmpty?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full rounded-xl bg-surface-2 p-1 sm:w-auto"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on && allowEmpty ? null : o.value)}
            className={cx(
              "flex-1 rounded-lg font-medium transition-all sm:flex-none",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm",
              on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-good" : "bg-surface-3",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-sheet relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-bg shadow-[var(--shadow-lg)] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="pb-safe border-t border-line bg-bg px-5 pt-3 sm:rounded-b-3xl">
            <div className="pb-3">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "soft";
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
        variant === "primary" && "bg-primary text-on-primary hover:opacity-90",
        variant === "soft" && "bg-surface-2 text-ink hover:bg-surface-3",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2",
        variant === "danger" && "bg-critical text-white hover:opacity-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-ink-2">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="yoyo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a7e" />
          <stop offset="1" stopColor="#d9304a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#yoyo-g)" />
      <path
        d="M32 48s-15-8.6-15-20.2C17 22.4 20.9 18 26 18c2.8 0 4.9 1.4 6 3.4 1.1-2 3.2-3.4 6-3.4 5.1 0 9 4.4 9 9.8C47 39.4 32 48 32 48z"
        fill="#fff"
        opacity=".95"
      />
      <path
        d="M17.5 32h8l3-5.5 4.5 10 3-6.5h10.5"
        fill="none"
        stroke="#d9304a"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
