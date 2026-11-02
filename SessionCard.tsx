"use client";

import { useState } from "react";
import { ChevronDown, Moon, Pencil, Pill, StickyNote, Sun, Sunrise, Sunset } from "lucide-react";
import { dayPart, fmtDay, fmtTime, tzBadge } from "@/lib/stats";
import type { Session } from "@/lib/types";
import { Chip, LevelBadge, cx } from "./ui";

const PART_ICON = { morning: Sunrise, afternoon: Sun, evening: Sunset, night: Moon };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function SessionCard({
  s,
  showDay,
  isEditor,
  onEdit,
}: {
  s: Session;
  showDay?: boolean;
  isEditor: boolean;
  onEdit: (s: Session) => void;
}) {
  const [open, setOpen] = useState(false);
  const part = dayPart(s.takenAt, s.tz);
  const PartIcon = PART_ICON[part];
  const badge = tzBadge(s.takenAt, s.tz);

  return (
    <article className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-surface-2/50"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-2">
          <PartIcon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-xl font-semibold tracking-tight">
              {Math.round(s.avgSys)}/{Math.round(s.avgDia)}
            </span>
            <span className="text-xs text-muted">mmHg</span>
            <span className="tnum ml-1 text-base font-semibold">{Math.round(s.avgHr)}</span>
            <span className="text-xs text-muted">bpm</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {showDay && `${fmtDay(s.takenAt, s.tz)} · `}
            {fmtTime(s.takenAt, s.tz)}
            {badge && ` ${badge}`} · {s.readings.length} reading{s.readings.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <LevelBadge sys={s.avgSys} dia={s.avgDia} />
          <ChevronDown
            size={16}
            className={cx("text-muted transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {(s.arm || s.position || s.meds || s.notes) && (
        <div className="-mt-1 flex flex-wrap gap-1.5 px-4 pb-3.5 pl-[74px]">
          {s.position && <Chip>{cap(s.position)}</Chip>}
          {s.arm && <Chip>{cap(s.arm)} arm</Chip>}
          {s.meds && <Chip icon={<Pill size={11} />}>Meds{s.medsNote && `: ${s.medsNote}`}</Chip>}
          {s.notes && !open && (
            <Chip icon={<StickyNote size={11} />}>
              <span className="max-w-[160px] truncate">{s.notes}</span>
            </Chip>
          )}
        </div>
      )}

      {open && (
        <div className="anim-fade border-t border-line bg-surface-2/40 px-4 py-3.5">
          <table className="tnum w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                <th className="pb-1.5 font-medium">#</th>
                <th className="pb-1.5 font-medium">Time</th>
                <th className="pb-1.5 text-right font-medium">SYS</th>
                <th className="pb-1.5 text-right font-medium">DIA</th>
                <th className="pb-1.5 text-right font-medium">HR</th>
              </tr>
            </thead>
            <tbody>
              {s.readings.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-1.5 text-muted">{i + 1}</td>
                  <td className="py-1.5 text-ink-2">{fmtTime(r.at, s.tz)}</td>
                  <td className="py-1.5 text-right">{r.sys}</td>
                  <td className="py-1.5 text-right">{r.dia}</td>
                  <td className="py-1.5 text-right">{r.hr}</td>
                </tr>
              ))}
              <tr className="border-t border-line font-semibold">
                <td className="py-1.5" colSpan={2}>
                  Average
                </td>
                <td className="py-1.5 text-right">{s.avgSys}</td>
                <td className="py-1.5 text-right">{s.avgDia}</td>
                <td className="py-1.5 text-right">{s.avgHr}</td>
              </tr>
            </tbody>
          </table>
          {s.notes && (
            <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm whitespace-pre-wrap text-ink-2">
              {s.notes}
            </p>
          )}
          {isEditor && (
            <button
              type="button"
              onClick={() => onEdit(s)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-3"
            >
              <Pencil size={14} /> Edit session
            </button>
          )}
        </div>
      )}
    </article>
  );
}
