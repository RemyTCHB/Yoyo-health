"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Delete } from "lucide-react";
import { PinError } from "@/lib/store";
import { Logo, cx } from "./ui";

const MAX = 8;

export default function LockScreen({
  onUnlock,
  notice,
  demo,
}: {
  onUnlock: (pin: string) => Promise<void>;
  notice: string | null;
  demo?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const submit = async (value = pin) => {
    if (busy || value.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await onUnlock(value);
    } catch (e) {
      setError(e instanceof PinError ? e.message : "Couldn't reach the server. Try again.");
      setShake((n) => n + 1);
      setPin("");
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    setError(null);
    setPin((p) => (p.length < MAX ? p + d : p));
  };
  const back = () => !busy && setPin((p) => p.slice(0, -1));

  // physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-[320px] flex-col items-center">
        <Logo size={64} />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Yoyo Health</h1>
        <p className="mt-1.5 text-center text-sm text-muted">
          Enter your PIN to open the shared log
        </p>

        <div
          key={shake}
          className={cx("mt-8 flex h-4 items-center gap-3", shake > 0 && "anim-shake")}
          aria-live="polite"
          aria-label={`${pin.length} digits entered`}
        >
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={cx(
                "h-3.5 w-3.5 rounded-full border-2 transition-all",
                i < pin.length ? "scale-110 border-ink bg-ink" : "border-axis border-[var(--axis)]",
              )}
            />
          ))}
        </div>

        <p
          className={cx(
            "mt-4 h-5 text-center text-sm",
            error ? "text-critical" : notice ? "text-ink-2" : "text-transparent",
          )}
          role="alert"
        >
          {error ?? notice ?? "."}
        </p>

        <div className="mt-4 grid w-full grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onClick={() => press(d)}>
              {d}
            </Key>
          ))}
          <Key onClick={back} label="Delete" subtle>
            <Delete size={22} />
          </Key>
          <Key onClick={() => press("0")}>0</Key>
          <button
            type="button"
            onClick={() => submit()}
            disabled={pin.length < 4 || busy}
            aria-label="Unlock"
            className="grid aspect-[1.35] place-items-center rounded-2xl bg-primary text-on-primary transition active:scale-95 disabled:opacity-25"
          >
            {busy ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ArrowRight size={24} />
            )}
          </button>
        </div>

        {demo && (
          <p className="mt-8 rounded-xl bg-surface-2 px-3 py-2 text-center text-xs text-ink-2">
            Demo mode · PIN <b className="tnum">1234</b> to add entries, <b className="tnum">0000</b>{" "}
            to view only
          </p>
        )}
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  label,
  subtle,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label?: string;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        "grid aspect-[1.35] place-items-center rounded-2xl text-2xl font-medium transition active:scale-95",
        subtle ? "text-ink-2 hover:bg-surface-2" : "card hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
