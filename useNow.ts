"use client";

import { useSyncExternalStore } from "react";

// A shared clock that ticks every 30 seconds, so relative times and
// "last 7 days" windows stay fresh without impure renders.
let now = typeof window === "undefined" ? 0 : Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      subs.forEach((fn) => fn());
    }, 30_000);
  }
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => 0,
  );
}
