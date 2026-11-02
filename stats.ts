import type { Reading, Session, SessionInput } from "./types";

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function mean(values: number[]): number {
  if (!values.length) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarize(readings: Reading[]) {
  return {
    avgSys: round1(mean(readings.map((r) => r.sys))),
    avgDia: round1(mean(readings.map((r) => r.dia))),
    avgHr: round1(mean(readings.map((r) => r.hr))),
  };
}

export function withAverages(
  s: Omit<SessionInput, "avgSys" | "avgDia" | "avgHr" | "takenAt">,
): SessionInput {
  const readings = [...s.readings].sort((a, b) => a.at - b.at);
  return {
    ...s,
    readings,
    takenAt: readings[0]?.at ?? Date.now(),
    ...summarize(readings),
  };
}

/* ------------------------------------------------------------------ */
/* Blood-pressure categories (ACC/AHA adult guideline)                 */
/* ------------------------------------------------------------------ */

export type BpLevel = "normal" | "elevated" | "stage1" | "stage2" | "severe";

export const BP_LEVELS: Record<
  BpLevel,
  { label: string; short: string; tone: "good" | "warning" | "serious" | "critical" }
> = {
  normal: { label: "Normal", short: "Normal", tone: "good" },
  elevated: { label: "Elevated", short: "Elevated", tone: "warning" },
  stage1: { label: "High · Stage 1", short: "Stage 1", tone: "serious" },
  stage2: { label: "High · Stage 2", short: "Stage 2", tone: "critical" },
  severe: { label: "Severe — check again", short: "Severe", tone: "critical" },
};

export function bpLevel(sys: number, dia: number): BpLevel {
  if (sys > 180 || dia > 120) return "severe";
  if (sys >= 140 || dia >= 90) return "stage2";
  if (sys >= 130 || dia >= 80) return "stage1";
  if (sys >= 120) return "elevated";
  return "normal";
}

export type HrLevel = "low" | "normal" | "high";
export function hrLevel(hr: number): HrLevel {
  if (hr < 60) return "low";
  if (hr > 100) return "high";
  return "normal";
}

/* ------------------------------------------------------------------ */
/* Time helpers — always in the time zone the reading was taken in      */
/* ------------------------------------------------------------------ */

export type DayPart = "morning" | "afternoon" | "evening" | "night";
export const DAY_PARTS: { key: DayPart; label: string; range: string }[] = [
  { key: "morning", label: "Morning", range: "5am–12pm" },
  { key: "afternoon", label: "Afternoon", range: "12–5pm" },
  { key: "evening", label: "Evening", range: "5–9pm" },
  { key: "night", label: "Night", range: "9pm–5am" },
];

export function localHour(ms: number, tz: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: tz,
    }).format(ms);
    return Number(h) % 24;
  } catch {
    return new Date(ms).getHours();
  }
}

export function dayPart(ms: number, tz: string): DayPart {
  const h = localHour(ms, tz);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export const viewerTz = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function safeTz(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export function fmtTime(ms: number, tz: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: safeTz(tz),
  }).format(ms);
}

export function fmtDay(ms: number, tz: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: safeTz(tz),
  }).format(ms);
}

export function fmtDateShort(ms: number) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(ms);
}

/** Calendar key yyyy-mm-dd in the given zone (for grouping by day). */
export function dayKey(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: safeTz(tz),
  }).format(ms);
  return parts;
}

/** Short zone name like "GMT+1" or "EST" when it differs from the viewer's. */
export function tzBadge(ms: number, tz: string): string | null {
  if (!tz || tz === viewerTz()) return null;
  try {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(ms);
    return p.find((x) => x.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

export function relativeTime(ms: number, now = Date.now()) {
  const diff = Math.round((ms - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/* ------------------------------------------------------------------ */
/* Aggregates                                                           */
/* ------------------------------------------------------------------ */

export const DAY = 86_400_000;

export function inWindow(sessions: Session[], from: number, to: number) {
  return sessions.filter((s) => s.takenAt >= from && s.takenAt < to);
}

export function periodAverages(sessions: Session[]) {
  if (!sessions.length) return null;
  return {
    sys: round1(mean(sessions.map((s) => s.avgSys))),
    dia: round1(mean(sessions.map((s) => s.avgDia))),
    hr: round1(mean(sessions.map((s) => s.avgHr))),
    count: sessions.length,
  };
}

export function byDayPart(sessions: Session[]) {
  return DAY_PARTS.map((p) => {
    const list = sessions.filter((s) => dayPart(s.takenAt, s.tz) === p.key);
    return { ...p, stats: periodAverages(list) };
  });
}

/* ------------------------------------------------------------------ */
/* Correlation                                                          */
/* ------------------------------------------------------------------ */

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function linearFit(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

export function describeR(r: number | null): string {
  if (r === null) return "Not enough data yet";
  const a = Math.abs(r);
  const strength =
    a < 0.1 ? "No" : a < 0.3 ? "Weak" : a < 0.5 ? "Moderate" : a < 0.7 ? "Strong" : "Very strong";
  if (strength === "No") return "No clear link";
  return `${strength} ${r > 0 ? "positive" : "negative"} link`;
}

/* ------------------------------------------------------------------ */
/* Validation (mirrors firestore.rules)                                 */
/* ------------------------------------------------------------------ */

export const LIMITS = {
  sys: { min: 60, max: 260 },
  dia: { min: 30, max: 160 },
  hr: { min: 25, max: 250 },
  maxReadings: 6,
};

export function readingError(r: Partial<Reading>): string | null {
  const { sys, dia, hr } = r;
  if (sys == null || dia == null || hr == null) return "Fill in all three values";
  if (sys < LIMITS.sys.min || sys > LIMITS.sys.max)
    return `Systolic should be ${LIMITS.sys.min}–${LIMITS.sys.max}`;
  if (dia < LIMITS.dia.min || dia > LIMITS.dia.max)
    return `Diastolic should be ${LIMITS.dia.min}–${LIMITS.dia.max}`;
  if (hr < LIMITS.hr.min || hr > LIMITS.hr.max)
    return `Heart rate should be ${LIMITS.hr.min}–${LIMITS.hr.max}`;
  if (dia >= sys) return "Diastolic must be lower than systolic";
  return null;
}

/* ------------------------------------------------------------------ */
/* CSV export                                                           */
/* ------------------------------------------------------------------ */

export function toCsv(sessions: Session[]): string {
  const esc = (v: string | number | boolean | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = [
    "session_id",
    "reading_no",
    "date",
    "time",
    "time_zone",
    "systolic",
    "diastolic",
    "heart_rate",
    "session_avg_sys",
    "session_avg_dia",
    "session_avg_hr",
    "category",
    "arm",
    "position",
    "medication_taken",
    "medication_note",
    "notes",
  ];
  const rows = [head.join(",")];
  for (const s of [...sessions].sort((a, b) => a.takenAt - b.takenAt)) {
    s.readings.forEach((r, i) => {
      rows.push(
        [
          s.id,
          i + 1,
          dayKey(r.at, s.tz),
          fmtTime(r.at, s.tz),
          s.tz,
          r.sys,
          r.dia,
          r.hr,
          s.avgSys,
          s.avgDia,
          s.avgHr,
          BP_LEVELS[bpLevel(s.avgSys, s.avgDia)].label,
          s.arm,
          s.position,
          s.meds,
          s.medsNote,
          s.notes,
        ]
          .map(esc)
          .join(","),
      );
    });
  }
  return rows.join("\n");
}
