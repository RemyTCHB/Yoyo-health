/**
 * Demo backend used when Firebase isn't configured yet.
 * Data lives in this browser's localStorage and syncs live between tabs,
 * so you can try the whole app before connecting the real database.
 */
import { PinError, type Backend } from "./store";
import { withAverages, DAY } from "./stats";
import type { Role, Session, SessionInput } from "./types";

export const DEMO_EDITOR_PIN = "1234";
export const DEMO_VIEWER_PIN = "0000";

const DATA_KEY = "yoyo.demo.sessions.v1";
const ROLE_KEY = "yoyo.demo.role";

function seeded(n: number) {
  // Deterministic pseudo-random so the demo looks the same everywhere.
  let x = n;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function makeSeed(): Session[] {
  const rand = seeded(42);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const out: Session[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let d = 44; d >= 0; d--) {
    const base = today.getTime() - d * DAY;
    const slots = [7.5 + rand(), 13 + rand() * 2, 20 + rand() * 1.5].filter(
      () => rand() > 0.22,
    );
    for (const hour of slots) {
      const start = base + hour * 3_600_000;
      if (start > Date.now()) continue;
      const trend = (44 - d) * -0.12; // gently improving
      const morning = hour < 11 ? 6 : 0;
      const hrBase = 66 + rand() * 12 + (hour > 12 && hour < 16 ? 6 : 0);
      const sysBase = 128 + trend + morning + rand() * 10 + (hrBase - 70) * 0.35;
      const diaBase = 82 + trend * 0.6 + morning * 0.5 + rand() * 6;
      const readings = [0, 1, 2].map((i) => ({
        sys: Math.round(sysBase - i * 1.6 + (rand() - 0.5) * 6),
        dia: Math.round(diaBase - i * 0.8 + (rand() - 0.5) * 4),
        hr: Math.round(hrBase - i * 1.2 + (rand() - 0.5) * 4),
        at: start + i * (60_000 + Math.round(rand() * 60_000)),
      }));
      const s = withAverages({
        tz,
        readings,
        arm: rand() > 0.15 ? "left" : "right",
        position: rand() > 0.1 ? "sitting" : "lying",
        meds: hour < 11 && rand() > 0.3,
        medsNote: "",
        notes: rand() > 0.9 ? "After coffee" : rand() > 0.93 ? "Felt a bit stressed" : "",
      });
      out.push({ ...s, id: `demo-${start}` });
    }
  }
  return out;
}

function read(): Session[] {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const seed = makeSeed();
  write(seed);
  return seed;
}

function write(list: Session[]) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(list));
  } catch {}
}

export function createDemoBackend(): Backend {
  const listeners = new Set<(s: Session[]) => void>();
  const sorted = () => read().sort((a, b) => b.takenAt - a.takenAt);
  const emit = () => {
    const data = sorted();
    listeners.forEach((fn) => fn(data));
  };
  const commit = (list: Session[]) => {
    write(list);
    emit();
  };
  let role: Role | null = null;

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === DATA_KEY) emit();
    });
  }

  const requireEditor = () => {
    if (role !== "editor") throw Object.assign(new Error("Read-only"), { code: "permission-denied" });
  };

  return {
    mode: "demo",
    async restore() {
      try {
        const r = localStorage.getItem(ROLE_KEY);
        role = r === "editor" || r === "viewer" ? r : null;
      } catch {}
      return role;
    },
    async unlock(pin) {
      await new Promise((r) => setTimeout(r, 350));
      if (pin === DEMO_EDITOR_PIN) role = "editor";
      else if (pin === DEMO_VIEWER_PIN) role = "viewer";
      else throw new PinError("That PIN didn't match", "wrong_pin");
      try {
        localStorage.setItem(ROLE_KEY, role);
      } catch {}
      return role;
    },
    async lock() {
      role = null;
      try {
        localStorage.removeItem(ROLE_KEY);
      } catch {}
    },
    subscribe(onData) {
      listeners.add(onData);
      queueMicrotask(() => onData(sorted()));
      return () => listeners.delete(onData);
    },
    async add(s: SessionInput) {
      requireEditor();
      commit([...read(), { ...s, id: `local-${Date.now()}` }]);
    },
    async update(id, s) {
      requireEditor();
      commit(read().map((x) => (x.id === id ? { ...s, id } : x)));
    },
    async remove(id) {
      requireEditor();
      commit(read().filter((x) => x.id !== id));
    },
  };
}
