"use client";

import { useState } from "react";
import { Download, History as HistoryIcon, Plus } from "lucide-react";
import { dayKey, fmtDay, periodAverages, toCsv } from "@/lib/stats";
import type { Session } from "@/lib/types";
import { Button, EmptyState } from "./ui";
import SessionCard from "./SessionCard";

const PAGE = 30;

export default function HistoryView({
  sessions,
  isEditor,
  onEdit,
  onNew,
}: {
  sessions: Session[];
  isEditor: boolean;
  onEdit: (s: Session) => void;
  onNew: () => void;
}) {
  const [shown, setShown] = useState(PAGE);

  if (!sessions.length) {
    return (
      <EmptyState
        icon={<HistoryIcon size={26} />}
        title="Nothing logged yet"
        body="Every session will be listed here with its individual readings."
        action={
          isEditor && (
            <Button onClick={onNew}>
              <Plus size={16} /> New session
            </Button>
          )
        }
      />
    );
  }

  const groups: { key: string; label: string; items: Session[] }[] = [];
  for (const s of sessions.slice(0, shown)) {
    const key = dayKey(s.takenAt, s.tz);
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.items.push(s);
    else groups.push({ key, label: fmtDay(s.takenAt, s.tz), items: [s] });
  }

  const exportCsv = () => {
    const blob = new Blob([toCsv(sessions)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yoyo-health-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-muted">
            {sessions.length} sessions · tap one to see each reading
          </p>
        </div>
        <Button variant="soft" onClick={exportCsv} className="py-2.5">
          <Download size={16} /> Export CSV
        </Button>
      </div>

      <div className="space-y-6">
        {groups.map((g) => {
          const avg = periodAverages(g.items);
          return (
            <section key={g.key} aria-label={g.label}>
              <div className="mb-2.5 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold">{g.label}</h2>
                {avg && g.items.length > 1 && (
                  <span className="tnum text-xs text-muted">
                    Day avg {Math.round(avg.sys)}/{Math.round(avg.dia)} · {Math.round(avg.hr)} bpm
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {g.items.map((s) => (
                  <SessionCard key={s.id} s={s} isEditor={isEditor} onEdit={onEdit} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {shown < sessions.length && (
        <div className="mt-6 flex justify-center">
          <Button variant="soft" onClick={() => setShown((n) => n + PAGE)}>
            Show older sessions
          </Button>
        </div>
      )}
    </div>
  );
}
