"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Plus, Trash2, X } from "lucide-react";
import {
  LIMITS,
  bpLevel,
  dayKey,
  fmtDateShort,
  fmtTime,
  readingError,
  summarize,
  viewerTz,
  withAverages,
} from "@/lib/stats";
import type { Arm, Position, Reading, Session, SessionInput } from "@/lib/types";
import { Button, LevelBadge, Segmented, Sheet, Switch, cx } from "./ui";
import DateTimePicker from "./DateTimePicker";

type Row = { sys: string; dia: string; hr: string; at: number | null };
type Meta = {
  arm: Arm | null;
  position: Position | null;
  meds: boolean;
  medsNote: string;
  notes: string;
};

const DRAFT_KEY = "yoyo.draft.v1";
const LAST_META_KEY = "yoyo.lastMeta.v1";
const emptyRow = (): Row => ({ sys: "", dia: "", hr: "", at: null });

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

const num = (s: string) => (s === "" ? undefined : Number(s));
const isBlank = (r: Row) => !r.sys && !r.dia && !r.hr;
const isFilled = (r: Row) => !!(r.sys && r.dia && r.hr);

function initialState(initial: Session | null): { rows: Row[]; meta: Meta; restored: boolean } {
  if (initial) {
    return {
      rows: initial.readings.map((r) => ({
        sys: String(r.sys),
        dia: String(r.dia),
        hr: String(r.hr),
        at: r.at,
      })),
      meta: {
        arm: initial.arm,
        position: initial.position,
        meds: initial.meds,
        medsNote: initial.medsNote,
        notes: initial.notes,
      },
      restored: false,
    };
  }
  const draft = load<{ rows: Row[]; meta: Meta; savedAt: number }>(DRAFT_KEY);
  // Drafts older than 3 hours are stale.
  if (draft && Date.now() - draft.savedAt < 3 * 3_600_000 && draft.rows.some((r) => !isBlank(r))) {
    return { rows: draft.rows, meta: draft.meta, restored: true };
  }
  const last = load<Pick<Meta, "arm" | "position">>(LAST_META_KEY);
  return {
    rows: [emptyRow(), emptyRow(), emptyRow()],
    meta: {
      arm: last?.arm ?? "left",
      position: last?.position ?? "sitting",
      meds: false,
      medsNote: "",
      notes: "",
    },
    restored: false,
  };
}

export default function SessionForm({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Session | null;
  onClose: () => void;
  onSave: (data: SessionInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [init] = useState(() => initialState(initial));
  const [rows, setRows] = useState<Row[]>(init.rows);
  const [meta, setMeta] = useState<Meta>(init.meta);
  const [restored, setRestored] = useState(init.restored);
  const [editingTime, setEditingTime] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const isNew = !initial;

  // Keep a draft so closing the app between readings loses nothing.
  useEffect(() => {
    if (!isNew) return;
    save(DRAFT_KEY, { rows, meta, savedAt: Date.now() });
  }, [rows, meta, isNew]);

  // Tick for the "time since last reading" helper.
  useEffect(() => {
    if (!isNew) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isNew]);

  const setField = (i: number, field: "sys" | "dia" | "hr", raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, 3);
    setRows((prev) =>
      prev.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, [field]: v };
        if (next.at === null && isFilled(next)) next.at = Date.now();
        return next;
      }),
    );
    setError(null);
    // Auto-advance after a 3-digit systolic.
    if (field === "sys" && v.length === 3) inputs.current[`${i}-dia`]?.focus();
    if (field === "dia" && v.length === 3) inputs.current[`${i}-hr`]?.focus();
  };

  const setTime = (i: number, ms: number) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, at: ms } : r)));

  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const complete: Reading[] = useMemo(
    () =>
      rows
        .filter((r) => isFilled(r) && !readingError({ sys: +r.sys, dia: +r.dia, hr: +r.hr }))
        .map((r) => ({ sys: +r.sys, dia: +r.dia, hr: +r.hr, at: r.at ?? 0 })),
    [rows],
  );
  const preview = complete.length ? summarize(complete) : null;

  const rowErrors = rows.map((r) =>
    isFilled(r) ? readingError({ sys: num(r.sys), dia: num(r.dia), hr: num(r.hr) }) : null,
  );
  const partial = rows.some((r) => !isBlank(r) && !isFilled(r));
  const canSave = complete.length > 0 && !rowErrors.some(Boolean) && !partial && !busy;

  const lastAt = Math.max(0, ...rows.filter(isFilled).map((r) => r.at ?? 0));
  const nextIndex = rows.findIndex(isBlank);
  const sinceLast = lastAt ? Math.max(0, Math.floor((now - lastAt) / 1000)) : 0;

  const submit = async () => {
    if (!canSave) {
      if (partial) setError("Finish or clear the half-filled reading first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = withAverages({
        tz: initial?.tz ?? viewerTz(),
        readings: complete,
        arm: meta.arm,
        position: meta.position,
        meds: meta.meds,
        medsNote: meta.meds ? meta.medsNote.trim() : "",
        notes: meta.notes.trim(),
      });
      await onSave(data, initial?.id);
      if (isNew) {
        save(DRAFT_KEY, null);
        save(LAST_META_KEY, { arm: meta.arm, position: meta.position });
      }
    } catch (e) {
      setError(
        (e as { code?: string })?.code === "permission-denied"
          ? "This PIN can only view. Unlock with the entry PIN to save."
          : `Couldn't save: ${(e as Error).message}`,
      );
      setBusy(false);
    }
  };

  const discardDraft = () => {
    save(DRAFT_KEY, null);
    const fresh = initialState(null);
    setRows(fresh.rows);
    setMeta(fresh.meta);
    setRestored(false);
  };

  const footer = (
    <div className="flex items-center gap-2">
      {!isNew && (
        <Button
          variant={confirmDelete ? "danger" : "ghost"}
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            setBusy(true);
            try {
              await onDelete(initial.id);
            } catch (e) {
              setError(`Couldn't delete: ${(e as Error).message}`);
              setBusy(false);
            }
          }}
          disabled={busy}
          aria-label="Delete session"
        >
          <Trash2 size={16} />
          {confirmDelete && "Tap again to delete"}
        </Button>
      )}
      <Button onClick={submit} disabled={!canSave} className="flex-1 py-3.5 text-[15px]">
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Check size={18} strokeWidth={2.5} />
        )}
        {isNew ? "Save session" : "Save changes"}
        {complete.length > 0 && (
          <span className="font-normal opacity-60">
            · {complete.length} reading{complete.length > 1 ? "s" : ""}
          </span>
        )}
      </Button>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={isNew ? "New session" : "Edit session"} footer={footer}>
      {/* live average */}
      <div className="card mb-4 flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium text-muted">
            {preview ? `Average of ${complete.length}` : "Average"}
          </p>
          <p className="tnum mt-0.5 text-2xl font-semibold tracking-tight">
            {preview ? (
              <>
                {Math.round(preview.avgSys)}/{Math.round(preview.avgDia)}
                <span className="ml-2 text-base font-medium text-ink-2">
                  {Math.round(preview.avgHr)} bpm
                </span>
              </>
            ) : (
              <span className="text-muted">—/—</span>
            )}
          </p>
        </div>
        {preview && <LevelBadge level={bpLevel(preview.avgSys, preview.avgDia)} size="md" />}
      </div>

      {restored && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <span>Picked up where you left off.</span>
          <button type="button" onClick={discardDraft} className="font-semibold text-ink">
            Start over
          </button>
        </div>
      )}

      {/* readings */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-[28px_1fr_1fr_1fr_76px] gap-2 px-1 text-[11px] font-medium tracking-wide text-muted uppercase">
          <span />
          <span>SYS</span>
          <span>DIA</span>
          <span>Pulse</span>
          <span className="text-right">Time</span>
        </div>
        {rows.map((r, i) => {
          const err = rowErrors[i];
          return (
            <div key={i}>
              <div
                className={cx(
                  "grid grid-cols-[28px_1fr_1fr_1fr_76px] items-center gap-2 rounded-2xl p-1.5 transition",
                  isFilled(r) && !err ? "bg-surface" : "bg-surface-2/60",
                )}
              >
                <span
                  className={cx(
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
                    isFilled(r) && !err ? "bg-good text-white" : "bg-surface-3 text-ink-2",
                  )}
                >
                  {isFilled(r) && !err ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                {(["sys", "dia", "hr"] as const).map((f) => (
                  <input
                    key={f}
                    ref={(el) => {
                      inputs.current[`${i}-${f}`] = el;
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="next"
                    autoComplete="off"
                    aria-label={`Reading ${i + 1} ${f === "sys" ? "systolic" : f === "dia" ? "diastolic" : "heart rate"}`}
                    placeholder={f === "sys" ? "120" : f === "dia" ? "80" : "70"}
                    value={r[f]}
                    onChange={(e) => setField(i, f, e.target.value)}
                    className="tnum h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-2 text-center text-lg font-semibold placeholder:font-normal placeholder:text-muted/50 focus:border-[var(--focus)] focus:outline-none"
                  />
                ))}
                <div className="flex items-center justify-end">
                  {r.at ? (
                    <button
                      type="button"
                      onClick={() => setEditingTime(editingTime === i ? null : i)}
                      className={cx(
                        "tnum inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium underline decoration-dotted decoration-[var(--axis)] underline-offset-4 transition",
                        editingTime === i ? "bg-primary text-on-primary no-underline" : "text-ink-2 hover:bg-surface-2",
                      )}
                      title="Change date & time"
                      aria-expanded={editingTime === i}
                    >
                      <span className="flex flex-col items-end leading-tight">
                        {dayKey(r.at, initial?.tz ?? viewerTz()) !==
                          dayKey(now, initial?.tz ?? viewerTz()) && (
                          <span className="text-[10px] font-normal opacity-70">
                            {fmtDateShort(r.at)}
                          </span>
                        )}
                        {fmtTime(r.at, initial?.tz ?? viewerTz())}
                      </span>
                    </button>
                  ) : rows.length > 1 && !isBlank(r) ? (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label={`Clear reading ${i + 1}`}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2"
                    >
                      <X size={15} />
                    </button>
                  ) : (
                    <Clock size={14} className="mr-2 text-muted/60" aria-hidden />
                  )}
                </div>
              </div>
              {editingTime === i && r.at && (
                <DateTimePicker
                  label={`Time of reading ${i + 1}`}
                  value={r.at}
                  onChange={(ms) => setTime(i, ms)}
                  onDone={() => setEditingTime(null)}
                  onRemove={() => {
                    removeRow(i);
                    setEditingTime(null);
                  }}
                />
              )}
              {err && <p className="mt-1 px-2 text-xs text-critical">{err}</p>}
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          {rows.length < LIMITS.maxReadings ? (
            <button
              type="button"
              onClick={() => setRows((p) => [...p, emptyRow()])}
              className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink"
            >
              <Plus size={15} /> Add reading
            </button>
          ) : (
            <span />
          )}
          {isNew && lastAt > 0 && nextIndex >= 0 && (
            <span className="tnum inline-flex items-center gap-1.5 text-xs text-muted">
              <Clock size={13} />
              {Math.floor(sinceLast / 60)}:{String(sinceLast % 60).padStart(2, "0")} since last
              reading
            </span>
          )}
        </div>
        {isNew && complete.length === 0 && (
          <p className="px-1 text-xs leading-relaxed text-muted">
            Tip: sit quietly for 5 minutes, then take 3 readings 1–2 minutes apart. Each reading
            is time-stamped the moment you fill it in.
          </p>
        )}
      </div>

      {/* details */}
      <div className="mt-6 space-y-4">
        <Field label="Position">
          <Segmented<Position>
            label="Position"
            value={meta.position}
            onChange={(v) => setMeta((m) => ({ ...m, position: v }))}
            allowEmpty
            options={[
              { value: "sitting", label: "Sitting" },
              { value: "standing", label: "Standing" },
              { value: "lying", label: "Lying" },
            ]}
          />
        </Field>
        <Field label="Arm">
          <Segmented<Arm>
            label="Arm"
            value={meta.arm}
            onChange={(v) => setMeta((m) => ({ ...m, arm: v }))}
            allowEmpty
            options={[
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
          />
        </Field>
        <div className="card p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Medication taken</p>
              <p className="text-xs text-muted">Before this session</p>
            </div>
            <Switch
              label="Medication taken"
              checked={meta.meds}
              onChange={(v) => setMeta((m) => ({ ...m, meds: v }))}
            />
          </div>
          {meta.meds && (
            <input
              value={meta.medsNote}
              onChange={(e) => setMeta((m) => ({ ...m, medsNote: e.target.value }))}
              maxLength={500}
              placeholder="Which one? e.g. Amlodipine 5mg at 7am (optional)"
              className="mt-3 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm focus:border-[var(--focus)] focus:outline-none"
            />
          )}
        </div>
        <Field label="Notes">
          <textarea
            value={meta.notes}
            onChange={(e) => setMeta((m) => ({ ...m, notes: e.target.value }))}
            maxLength={2000}
            rows={2}
            placeholder="Anything worth remembering — coffee, stress, exercise, feeling unwell…"
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm focus:border-[var(--focus)] focus:outline-none"
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-medium text-muted">{label}</p>
      {children}
    </div>
  );
}
