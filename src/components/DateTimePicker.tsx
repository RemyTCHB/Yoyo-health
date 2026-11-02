"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cx } from "./ui";

/**
 * App-styled date & time picker (replaces the browser's native one).
 * Works in the device's local time, i.e. where the reading was taken.
 */
export default function DateTimePicker({
  value,
  onChange,
  onDone,
  onRemove,
  label,
}: {
  value: number;
  onChange: (ms: number) => void;
  onDone: () => void;
  onRemove?: () => void;
  label: string;
}) {
  const d = new Date(value);
  const [view, setView] = useState({ y: d.getFullYear(), m: d.getMonth() });
  const use12h = useState(() => uses12h())[0];
  const firstDay = useState(() => weekStart())[0];

  const set = (patch: Partial<{ y: number; m: number; day: number; h: number; min: number }>) => {
    const n = new Date(value);
    if (patch.y !== undefined || patch.m !== undefined || patch.day !== undefined) {
      n.setFullYear(patch.y ?? n.getFullYear(), patch.m ?? n.getMonth(), patch.day ?? n.getDate());
    }
    if (patch.h !== undefined) n.setHours(patch.h);
    if (patch.min !== undefined) n.setMinutes(patch.min);
    n.setSeconds(0, 0);
    onChange(n.getTime());
  };

  const today = new Date();
  const isToday = sameDay(d, today);
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const dayLabel = isToday
    ? "Today"
    : sameDay(d, yesterday)
      ? "Yesterday"
      : new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(d);
  const timeLabel = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);

  // ---- calendar grid ----
  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() - (firstDay % 7) + 7) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(
      new Date(2024, 0, 7 + ((firstDay % 7) + i)), // Jan 7 2024 is a Sunday
    ),
  );
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(first);
  const atCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();
  const shiftMonth = (delta: number) =>
    setView((v) => {
      const n = new Date(v.y, v.m + delta, 1);
      return { y: n.getFullYear(), m: n.getMonth() };
    });

  // ---- time ----
  const h24 = d.getHours();
  const min = d.getMinutes();
  const pm = h24 >= 12;
  const hourShown = use12h ? ((h24 + 11) % 12) + 1 : h24;
  const stepHour = (delta: number) => set({ h: (h24 + delta + 24) % 24 });
  const stepMin = (delta: number) => set({ min: (min + delta + 60) % 60 });

  return (
    <div
      className="anim-fade mt-2 rounded-2xl border border-line bg-surface p-3.5 shadow-[var(--shadow)]"
      role="group"
      aria-label={label}
    >
      {/* summary */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {dayLabel} <span className="text-muted">·</span> <span className="tnum">{timeLabel}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            now.setSeconds(0, 0);
            onChange(now.getTime());
            setView({ y: now.getFullYear(), m: now.getMonth() });
          }}
          className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-3"
        >
          Now
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        {/* calendar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={atCurrentMonth}
              aria-label="Next month"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-25"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">
            {weekdayNames.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {cells.map((day, i) => {
              if (!day) return <span key={i} />;
              const cellDate = new Date(view.y, view.m, day);
              const selected = sameDay(cellDate, d);
              const isTodayCell = sameDay(cellDate, today);
              const future = cellDate.getTime() > today.getTime();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={future}
                  onClick={() => set({ y: view.y, m: view.m, day })}
                  aria-pressed={selected}
                  aria-label={cellDate.toDateString()}
                  className={cx(
                    "tnum mx-auto grid h-9 w-9 place-items-center rounded-full text-sm transition",
                    selected
                      ? "bg-primary font-semibold text-on-primary"
                      : isTodayCell
                        ? "font-semibold text-ink ring-1 ring-[var(--axis)] hover:bg-surface-2"
                        : "text-ink-2 hover:bg-surface-2",
                    future && "pointer-events-none opacity-25",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* time */}
        <div className="flex items-center justify-center gap-2 border-t border-line pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <Spinner
            label="Hour"
            value={use12h ? String(hourShown) : String(hourShown).padStart(2, "0")}
            onStep={stepHour}
          />
          <span className="pb-0.5 text-2xl font-semibold text-muted">:</span>
          <Spinner label="Minute" value={String(min).padStart(2, "0")} onStep={stepMin} />
          {use12h && (
            <div className="ml-1 flex flex-col gap-1 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="AM or PM">
              {(["AM", "PM"] as const).map((p) => {
                const on = (p === "PM") === pm;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => !on && stepHour(p === "PM" ? 12 : -12)}
                    className={cx(
                      "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink-2",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-line pt-3">
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-xl px-3 py-2 text-sm font-medium text-critical hover:bg-surface-2"
          >
            Remove reading
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/** Up/down stepper; press and hold to scroll quickly. */
function Spinner({
  label,
  value,
  onStep,
}: {
  label: string;
  value: string;
  onStep: (delta: number) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(onStep);
  useEffect(() => {
    stepRef.current = onStep;
  });
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const start = (delta: number) => {
    stepRef.current(delta);
    let wait = 380;
    const tick = () => {
      stepRef.current(delta);
      wait = Math.max(60, wait * 0.8);
      timer.current = setTimeout(tick, wait);
    };
    timer.current = setTimeout(tick, wait);
  };

  const btn = (delta: number, Icon: typeof ChevronUp, name: string) => (
    <button
      type="button"
      aria-label={name}
      onPointerDown={(e) => {
        e.preventDefault();
        start(delta);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          stepRef.current(delta);
        }
      }}
      className="grid h-9 w-14 touch-none place-items-center rounded-xl text-ink-2 select-none hover:bg-surface-2 active:bg-surface-3"
    >
      <Icon size={20} />
    </button>
  );

  return (
    <div className="flex flex-col items-center" role="group" aria-label={label}>
      {btn(1, ChevronUp, `${label} up`)}
      <span
        className="tnum my-0.5 grid h-12 w-14 place-items-center rounded-xl bg-surface-2 text-2xl font-semibold"
        aria-live="polite"
      >
        {value}
      </span>
      {btn(-1, ChevronDown, `${label} down`)}
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function uses12h() {
  try {
    const hc = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle;
    return hc === "h12" || hc === "h11";
  } catch {
    return true;
  }
}

/** 1 = Monday … 7 = Sunday, from the browser's locale (defaults to Sunday). */
function weekStart(): number {
  try {
    const loc = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    return (loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay ?? 7;
  } catch {
    return 7;
  }
}
