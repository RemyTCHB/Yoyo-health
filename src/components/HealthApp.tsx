"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BarChart3, Eye, History as HistoryIcon, Home, Lock, Plus } from "lucide-react";
import { getBackend, type Backend } from "@/lib/store";
import type { Role, Session, SessionInput } from "@/lib/types";
import { Logo, cx } from "./ui";
import LockScreen from "./LockScreen";
import Dashboard from "./Dashboard";
import ChartsView from "./ChartsView";
import HistoryView from "./HistoryView";
import SessionForm from "./SessionForm";

export type Tab = "home" | "charts" | "history";
const TABS: { key: Tab; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Overview", icon: Home },
  { key: "charts", label: "Charts", icon: BarChart3 },
  { key: "history", label: "History", icon: HistoryIcon },
];

/* ---- hash-based tab so back/forward and bookmarks work ---- */
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
function readHash(): Tab {
  const h = window.location.hash.replace("#", "");
  return h === "charts" || h === "history" ? h : "home";
}
function useTab(): [Tab, (t: Tab) => void] {
  const tab = useSyncExternalStore(subscribeHash, readHash, () => "home" as Tab);
  const set = useCallback((t: Tab) => {
    if (t === "home") history.pushState(null, "", window.location.pathname);
    else window.location.hash = t;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.scrollTo({ top: 0 });
  }, []);
  return [tab, set];
}

type FormState = { mode: "new" } | { mode: "edit"; session: Session } | null;
type Phase = "loading" | "locked" | "ready";

export default function HealthApp() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [role, setRole] = useState<Role | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useTab();

  // Boot: pick backend and restore a saved unlock.
  useEffect(() => {
    let alive = true;
    getBackend().then(async (b) => {
      const r = await b.restore();
      if (!alive) return;
      setBackend(b);
      setRole(r);
      setPhase(r ? "ready" : "locked");
    });
    return () => {
      alive = false;
    };
  }, []);

  // Live data feed while unlocked.
  useEffect(() => {
    if (phase !== "ready" || !backend) return;
    return backend.subscribe(
      (list) => setSessions(list),
      async (err) => {
        if (err.code === "permission-denied") {
          await backend.lock();
          setRole(null);
          setSessions(null);
          setNotice("Your access has changed. Please enter your PIN again.");
          setPhase("locked");
        } else {
          setNotice(`Connection problem: ${err.message}`);
        }
      },
    );
  }, [phase, backend]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const unlock = async (pin: string) => {
    if (!backend) throw new Error("Not ready");
    const r = await backend.unlock(pin);
    setRole(r);
    setNotice(null);
    setPhase("ready");
  };

  const lock = async () => {
    await backend?.lock();
    setRole(null);
    setSessions(null);
    setPhase("locked");
  };

  /** Firestore resolves writes only when the server confirms. Offline, the
   *  write is queued locally and shows up instantly, so don't block on it. */
  const settle = (p: Promise<void>) =>
    Promise.race([p, new Promise<"queued">((r) => setTimeout(() => r("queued"), 3500))]);

  const saveSession = async (data: SessionInput, id?: string) => {
    if (!backend) return;
    const res = await settle(id ? backend.update(id, data) : backend.add(data));
    setForm(null);
    setToast(
      res === "queued"
        ? "Saved on this device — will sync when online"
        : id
          ? "Session updated"
          : "Session saved",
    );
  };

  const deleteSession = async (id: string) => {
    if (!backend) return;
    await settle(backend.remove(id));
    setForm(null);
    setToast("Session deleted");
  };

  if (phase === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="anim-pulse">
          <Logo size={48} />
        </div>
      </div>
    );
  }

  if (phase === "locked" || !role) {
    return <LockScreen onUnlock={unlock} notice={notice} demo={backend?.mode === "demo"} />;
  }

  const isEditor = role === "editor";
  const openNew = () => setForm({ mode: "new" });
  const openEdit = (s: Session) => setForm({ mode: "edit", session: s });

  return (
    <div className="min-h-dvh pb-36 md:pb-12">
      {/* ---------- header ---------- */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setTab("home")}
            className="flex items-center gap-2.5"
          >
            <Logo size={32} />
            <span className="text-[17px] font-semibold tracking-tight">Yoyo Health</span>
          </button>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cx(
                  "rounded-xl px-3.5 py-2 text-sm font-medium transition",
                  tab === t.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LiveDot demo={backend?.mode === "demo"} />
            {!isEditor && (
              <span className="hidden items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2 sm:inline-flex">
                <Eye size={13} /> View only
              </span>
            )}
            {isEditor && (
              <button
                type="button"
                onClick={openNew}
                className="hidden items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary transition hover:opacity-90 md:inline-flex"
              >
                <Plus size={16} strokeWidth={2.5} /> New session
              </button>
            )}
            <button
              type="button"
              onClick={lock}
              aria-label="Lock"
              title="Lock"
              className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <Lock size={17} />
            </button>
          </div>
        </div>
      </header>

      {backend?.mode === "demo" && (
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
            <strong className="font-semibold text-ink">Demo mode</strong> — sample data stored in
            this browser only. Connect Firebase (see README) to share live between devices.
          </p>
        </div>
      )}
      {notice && (
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">{notice}</p>
        </div>
      )}

      {/* ---------- content ---------- */}
      <main className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7">
        {sessions === null ? (
          <Skeleton />
        ) : tab === "home" ? (
          <Dashboard
            sessions={sessions}
            isEditor={isEditor}
            onNew={openNew}
            onOpen={openEdit}
            goTo={setTab}
          />
        ) : tab === "charts" ? (
          <ChartsView sessions={sessions} />
        ) : (
          <HistoryView sessions={sessions} isEditor={isEditor} onEdit={openEdit} onNew={openNew} />
        )}
        <p className="mx-auto mt-10 max-w-md text-center text-[13px] leading-relaxed text-ink-2">
          May You Always Be Healthy &amp; Happy My Love ✨❤️
        </p>
      </main>

      {/* ---------- mobile tab bar ---------- */}
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-3 px-2">
          {TABS.map((t) => (
            <TabButton key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} />
          ))}
        </div>
      </nav>

      {/* ---------- mobile "new session" button ---------- */}
      {isEditor && (
        <button
          type="button"
          onClick={openNew}
          aria-label="New session"
          className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_8px_24px_rgba(217,48,74,0.45)] transition active:scale-95 md:hidden"
          style={{ background: "linear-gradient(135deg,#ff7a7e,#d9304a)" }}
        >
          <Plus size={26} strokeWidth={2.5} />
        </button>
      )}

      {isEditor && form && (
        <SessionForm
          key={form.mode === "edit" ? form.session.id : "new"}
          initial={form.mode === "edit" ? form.session : null}
          onClose={() => setForm(null)}
          onSave={saveSession}
          onDelete={deleteSession}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8">
          <div className="anim-sheet rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-on-primary shadow-[var(--shadow-lg)]">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  t,
  active,
  onClick,
}: {
  t: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = t.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
        active ? "text-ink" : "text-muted",
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.3 : 1.8} />
      {t.label}
    </button>
  );
}

function LiveDot({ demo }: { demo?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-ink-2"
      title={demo ? "Demo data on this device" : "Live — updates appear instantly on every device"}
    >
      <span className="anim-pulse h-2 w-2 rounded-full bg-good" aria-hidden />
      {demo ? "Demo" : "Live"}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-36 animate-pulse bg-surface-2" />
      ))}
      <div className="card h-72 animate-pulse bg-surface-2 md:col-span-3" />
    </div>
  );
}
