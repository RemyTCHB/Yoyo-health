"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, HeartPulse, Minus, Plus } from "lucide-react";
import {
  DAY,
  byDayPart,
  fmtTime,
  inWindow,
  periodAverages,
  relativeTime,
  tzBadge,
} from "@/lib/stats";
import type { Session } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { Button, EmptyState, LevelBadge, SectionTitle, cx } from "./ui";
import SessionCard from "./SessionCard";
import type { Tab } from "./HealthApp";

export default function Dashboard({
  sessions,
  isEditor,
  onNew,
  onOpen,
  goTo,
}: {
  sessions: Session[];
  isEditor: boolean;
  onNew: () => void;
  onOpen: (s: Session) => void;
  goTo: (t: Tab) => void;
}) {
  const now = useNow();
  if (!sessions.length) {
    return (
      <EmptyState
        icon={<HeartPulse size={26} />}
        title="No readings yet"
        body={
          isEditor
            ? "Start a session and take three readings a minute or two apart. The app averages them for you."
            : "Readings will appear here the moment they're added."
        }
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

  const latest = sessions[0];
  const week = periodAverages(inWindow(sessions, now - 7 * DAY, now + DAY));
  const prevWeek = periodAverages(inWindow(sessions, now - 14 * DAY, now - 7 * DAY));
  const parts = byDayPart(inWindow(sessions, now - 30 * DAY, now + DAY));
  const first = latest.readings[0]?.at ?? latest.takenAt;
  const last = latest.readings[latest.readings.length - 1]?.at ?? latest.takenAt;
  const badge = tzBadge(latest.takenAt, latest.tz);

  return (
    <div className="grid gap-4 md:grid-cols-3 md:gap-5">
      {/* ---------- latest ---------- */}
      <section className="card relative overflow-hidden p-5 sm:p-6 md:col-span-2" aria-label="Latest session">
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-[0.10] blur-2xl"
          style={{ background: "radial-gradient(circle, #ff5a6a, transparent 70%)" }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted">
            Latest · {relativeTime(latest.takenAt, now)}
          </p>
          <LevelBadge sys={latest.avgSys} dia={latest.avgDia} size="md" />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Blood pressure</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[56px] leading-none font-semibold tracking-tight sm:text-[64px]">
                {Math.round(latest.avgSys)}
                <span className="text-muted">/</span>
                {Math.round(latest.avgDia)}
              </span>
              <span className="text-sm font-medium text-muted">mmHg</span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Heart rate</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[40px] leading-none font-semibold tracking-tight">
                {Math.round(latest.avgHr)}
              </span>
              <span className="text-sm font-medium text-muted">bpm</span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {latest.readings.map((r, i) => (
            <span
              key={i}
              className="tnum rounded-xl bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2"
              title={fmtTime(r.at, latest.tz)}
            >
              <span className="text-muted">#{i + 1}</span>{" "}
              <b className="font-semibold text-ink">
                {r.sys}/{r.dia}
              </b>{" "}
              · {r.hr}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Average of {latest.readings.length} reading{latest.readings.length > 1 ? "s" : ""} ·{" "}
          {fmtTime(first, latest.tz)}
          {fmtTime(last, latest.tz) !== fmtTime(first, latest.tz) && `–${fmtTime(last, latest.tz)}`}
          {badge && ` (${badge})`}
        </p>
      </section>

      {/* ---------- 7-day tiles ---------- */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-1 md:gap-5" aria-label="Last 7 days">
        <StatTile
          label="7-day avg BP"
          value={week ? `${Math.round(week.sys)}/${Math.round(week.dia)}` : "—"}
          unit="mmHg"
          delta={week && prevWeek ? week.sys - prevWeek.sys : null}
          deltaLabel="SYS vs prior week"
        />
        <StatTile
          label="7-day avg heart rate"
          value={week ? `${Math.round(week.hr)}` : "—"}
          unit="bpm"
          delta={week && prevWeek ? week.hr - prevWeek.hr : null}
          deltaLabel="vs prior week"
          neutral
        />
      </section>

      {/* ---------- time of day ---------- */}
      <section className="card p-5 sm:p-6 md:col-span-2" aria-label="By time of day">
        <SectionTitle
          right={<span className="text-xs text-muted">Last 30 days</span>}
        >
          By time of day
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {parts.map((p) => (
            <div key={p.key} className="rounded-2xl bg-surface-2 p-3.5">
              <p className="text-xs font-semibold">{p.label}</p>
              <p className="text-[11px] text-muted">{p.range}</p>
              {p.stats ? (
                <>
                  <p className="tnum mt-3 text-xl font-semibold tracking-tight">
                    {Math.round(p.stats.sys)}/{Math.round(p.stats.dia)}
                  </p>
                  <p className="tnum text-xs text-ink-2">
                    {Math.round(p.stats.hr)} bpm · {p.stats.count} session
                    {p.stats.count > 1 ? "s" : ""}
                  </p>
                  <div className="mt-2">
                    <LevelBadge sys={p.stats.sys} dia={p.stats.dia} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">No readings</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- count ---------- */}
      <section className="card flex flex-col justify-between p-5 sm:p-6">
        <div>
          <p className="text-sm font-medium text-muted">Sessions logged</p>
          <p className="mt-2 text-[44px] leading-none font-semibold tracking-tight">
            {sessions.length}
          </p>
          <p className="mt-2 text-xs text-muted">
            {week?.count ?? 0} in the last 7 days ·{" "}
            {sessions.reduce((n, s) => n + s.readings.length, 0)} readings total
          </p>
        </div>
        <button
          type="button"
          onClick={() => goTo("charts")}
          className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink hover:opacity-70"
        >
          See charts <ArrowRight size={15} />
        </button>
      </section>

      {/* ---------- recent ---------- */}
      <section className="md:col-span-3" aria-label="Recent sessions">
        <SectionTitle
          right={
            <button
              type="button"
              onClick={() => goTo("history")}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink"
            >
              All history <ArrowRight size={14} />
            </button>
          }
        >
          Recent sessions
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {sessions.slice(0, 4).map((s) => (
            <SessionCard key={s.id} s={s} showDay isEditor={isEditor} onEdit={onOpen} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  neutral,
}: {
  label: string;
  value: string;
  unit: string;
  delta: number | null;
  deltaLabel: string;
  neutral?: boolean;
}) {
  const d = delta === null ? null : Math.round(delta * 10) / 10;
  const flat = d !== null && Math.abs(d) < 1;
  // For blood pressure, down is good.
  const good = d !== null && !flat && !neutral && d < 0;
  const bad = d !== null && !flat && !neutral && d > 0;
  const Icon = flat ? Minus : d !== null && d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-semibold tracking-tight sm:text-[32px]">
          {value}
        </span>
        <span className="text-xs text-muted">{unit}</span>
      </p>
      {d !== null ? (
        <p
          className={cx(
            "mt-2 inline-flex items-center gap-0.5 text-xs font-medium",
            good ? "text-[#006300] dark:text-good" : bad ? "text-critical" : "text-ink-2",
          )}
        >
          <Icon size={14} />
          {flat ? "Steady" : `${d > 0 ? "+" : ""}${d}`}
        </p>
      ) : null}
      {d !== null ? (
        <p className="text-[11px] text-muted">{deltaLabel}</p>
      ) : (
        <p className="mt-2 text-xs text-muted">Not enough history yet</p>
      )}
    </div>
  );
}
