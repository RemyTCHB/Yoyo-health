"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import {
  BP_LEVELS,
  DAY,
  bpLevel,
  describeR,
  fmtDateShort,
  fmtDay,
  fmtTime,
  linearFit,
  pearson,
} from "@/lib/stats";
import type { Session } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { EmptyState, LevelBadge, Segmented, cx } from "./ui";

type Range = "7d" | "30d" | "90d" | "all";
const RANGE_DAYS: Record<Exclude<Range, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

interface Point {
  t: number;
  tz: string;
  sys: number;
  dia: number;
  hr: number;
  sysR: [number, number];
  diaR: [number, number];
  hrR: [number, number];
  n: number;
}

const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };
const RING = "var(--surface)";

function toPoints(sessions: Session[]): Point[] {
  return [...sessions]
    .sort((a, b) => a.takenAt - b.takenAt)
    .map((s) => {
      const span = (k: "sys" | "dia" | "hr"): [number, number] => {
        const v = s.readings.map((r) => r[k]);
        return [Math.min(...v), Math.max(...v)];
      };
      return {
        t: s.takenAt,
        tz: s.tz,
        sys: s.avgSys,
        dia: s.avgDia,
        hr: s.avgHr,
        sysR: span("sys"),
        diaR: span("dia"),
        hrR: span("hr"),
        n: s.readings.length,
      };
    });
}


/** Round a [lo, hi] range out to clean steps and list the ticks. */
function niceScale(lo: number, hi: number, maxTicks = 7) {
  const span = hi - lo;
  const step = [5, 10, 20, 25, 50].find((s) => span / s <= maxTicks - 1) ?? 50;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b; v += step) ticks.push(v);
  return { domain: [a, b] as [number, number], ticks };
}

export default function ChartsView({ sessions }: { sessions: Session[] }) {
  const [range, setRange] = useState<Range>("30d");
  const [showZones, setShowZones] = useState(true);
  const [corrMode, setCorrMode] = useState<"scatter" | "timeline">("scatter");
  const now = useNow();

  const { points, domain } = useMemo(() => {
    const from = range === "all" ? -Infinity : now - RANGE_DAYS[range] * DAY;
    const pts = toPoints(sessions.filter((s) => s.takenAt >= from));
    const d: [number, number] =
      range === "all"
        ? [pts[0]?.t ?? now - DAY, pts[pts.length - 1]?.t ?? now]
        : [now - RANGE_DAYS[range] * DAY, now];
    return { points: pts, domain: d };
  }, [sessions, range, now]);

  if (!sessions.length) {
    return (
      <EmptyState
        icon={<BarChart3 size={26} />}
        title="Charts appear after the first session"
        body="Heart rate, blood pressure and how they relate will be plotted here."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Charts</h1>
          <p className="text-sm text-muted">
            Each point is a session average · {points.length} session
            {points.length === 1 ? "" : "s"} in view
          </p>
        </div>
        <Segmented<Range>
          label="Time range"
          size="sm"
          value={range}
          onChange={(v) => v && setRange(v)}
          options={[
            { value: "7d", label: "7D" },
            { value: "30d", label: "30D" },
            { value: "90d", label: "90D" },
            { value: "all", label: "All" },
          ]}
        />
      </div>

      {points.length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={26} />}
          title="No sessions in this range"
          body="Pick a longer time range to see older readings."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          <HeartRateChart points={points} domain={domain} />
          <BloodPressureChart
            points={points}
            domain={domain}
            showZones={showZones}
            setShowZones={setShowZones}
          />
          <div className="lg:col-span-2">
            <CorrelationCard
              points={points}
              domain={domain}
              mode={corrMode}
              setMode={setCorrMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ChartCard({
  title,
  subtitle,
  right,
  legend,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="card p-4 sm:p-5" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        {right}
      </div>
      {legend && <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">{legend}</div>}
      <div className="-ml-2">{children}</div>
      {footer}
    </section>
  );
}

function Key({ color, label, kind = "line" }: { color: string; label: string; kind?: "line" | "dot" | "band" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      {kind === "line" && <span className="h-[3px] w-4 rounded-full" style={{ background: color }} />}
      {kind === "dot" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {kind === "band" && (
        <span
          className="h-3 w-4 rounded-[3px]"
          style={{ background: `color-mix(in oklab, ${color} 22%, transparent)` }}
        />
      )}
      {label}
    </span>
  );
}

function TipShell({ children, t, tz }: { children: ReactNode; t: number; tz: string }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-[var(--shadow-lg)]">
      <p className="mb-1.5 font-medium text-muted">
        {fmtDay(t, tz)} · {fmtTime(t, tz)}
      </p>
      {children}
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="tnum flex items-center justify-between gap-4 py-0.5">
      <span className="inline-flex items-center gap-1.5 text-ink-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-semibold text-ink">{value}</span>
    </p>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTip = { active?: boolean; payload?: readonly any[] };

function timeAxisProps(domain: [number, number]) {
  const span = domain[1] - domain[0];
  return {
    dataKey: "t",
    type: "number" as const,
    scale: "time" as const,
    domain,
    tick: AXIS_TICK,
    tickLine: false,
    axisLine: { stroke: "var(--axis)" },
    minTickGap: 28,
    tickFormatter: (v: number) =>
      span <= 8 * DAY
        ? new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(v)
        : fmtDateShort(v),
  };
}

const yAxisProps = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: false,
  width: 40,
};

/* ------------------------------------------------------------------ */

function HeartRateChart({ points, domain }: { points: Point[]; domain: [number, number] }) {
  const y = niceScale(
    Math.min(55, ...points.map((p) => p.hrR[0] - 3)),
    Math.max(105, ...points.map((p) => p.hrR[1] + 3)),
  );
  const dots = points.length <= 60;
  const avg = Math.round(points.reduce((a, p) => a + p.hr, 0) / points.length);

  return (
    <ChartCard
      title="Heart rate"
      subtitle={`Session average, bpm · shaded spread = lowest to highest reading`}
      right={
        <div className="text-right">
          <p className="tnum text-xl font-semibold tracking-tight">{avg}</p>
          <p className="text-[11px] text-muted">avg bpm</p>
        </div>
      }
      legend={
        <>
          <Key color="var(--hr)" label="Heart rate" />
          <Key color="var(--good)" label="Typical resting 60–100" kind="band" />
        </>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <ReferenceArea y1={60} y2={100} fill="var(--good)" fillOpacity={0.07} ifOverflow="hidden" />
          <XAxis {...timeAxisProps(domain)} />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} />
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={({ active, payload }: AnyTip) => {
              const p: Point | undefined = payload?.[0]?.payload;
              if (!active || !p) return null;
              return (
                <TipShell t={p.t} tz={p.tz}>
                  <TipRow color="var(--hr)" label="Heart rate" value={`${p.hr} bpm`} />
                  <p className="tnum mt-1 text-[11px] text-muted">
                    Range {p.hrR[0]}–{p.hrR[1]} · {p.n} readings
                  </p>
                </TipShell>
              );
            }}
          />
          <Area
            dataKey="hrR"
            stroke="none"
            fill="var(--hr)"
            fillOpacity={0.12}
            isAnimationActive={false}
            activeDot={false}
          />
          <Line
            dataKey="hr"
            stroke="var(--hr)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={dots ? { r: 3.5, fill: "var(--hr)", stroke: RING, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--hr)", stroke: RING, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */

function BloodPressureChart({
  points,
  domain,
  showZones,
  setShowZones,
}: {
  points: Point[];
  domain: [number, number];
  showZones: boolean;
  setShowZones: (v: boolean) => void;
}) {
  const y = niceScale(
    Math.min(60, ...points.map((p) => p.diaR[0] - 5)),
    Math.max(150, ...points.map((p) => p.sysR[1] + 5)),
  );
  const hi = y.domain[1];
  const dots = points.length <= 60;
  const avgSys = Math.round(points.reduce((a, p) => a + p.sys, 0) / points.length);
  const avgDia = Math.round(points.reduce((a, p) => a + p.dia, 0) / points.length);

  const zoneLabel = (text: string) => ({
    value: text,
    position: "insideTopRight" as const,
    fill: "var(--muted)",
    fontSize: 10,
  });

  return (
    <ChartCard
      title="Blood pressure"
      subtitle="Session average, mmHg · shaded spread = lowest to highest reading"
      right={
        <div className="text-right">
          <p className="tnum text-xl font-semibold tracking-tight">
            {avgSys}/{avgDia}
          </p>
          <p className="text-[11px] text-muted">avg mmHg</p>
        </div>
      }
      legend={
        <>
          <Key color="var(--sys)" label="Systolic" />
          <Key color="var(--dia)" label="Diastolic" />
          <button
            type="button"
            onClick={() => setShowZones(!showZones)}
            className={cx(
              "ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium transition",
              showZones ? "bg-surface-3 text-ink" : "bg-surface-2 text-muted",
            )}
            aria-pressed={showZones}
          >
            Healthy ranges {showZones ? "on" : "off"}
          </button>
        </>
      }
      footer={
        showZones && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
            <Key color="var(--warning)" label="SYS 120–129 Elevated" kind="band" />
            <Key color="var(--serious)" label="SYS 130–139 Stage 1" kind="band" />
            <Key color="var(--critical)" label="SYS ≥140 Stage 2" kind="band" />
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
              <span className="w-4 border-t-2 border-dashed" style={{ borderColor: "var(--dia)" }} />
              DIA 80 / 90 thresholds
            </span>
          </div>
        )
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 8, right: showZones ? 26 : 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          {showZones && (
            <>
              <ReferenceArea y1={120} y2={130} fill="var(--warning)" fillOpacity={0.1} ifOverflow="hidden" />
              <ReferenceArea y1={130} y2={140} fill="var(--serious)" fillOpacity={0.1} ifOverflow="hidden" />
              <ReferenceArea
                y1={140}
                y2={hi}
                fill="var(--critical)"
                fillOpacity={0.07}
                ifOverflow="hidden"
                label={zoneLabel("Stage 2")}
              />
              <ReferenceLine
                y={80}
                stroke="var(--dia)"
                strokeOpacity={0.55}
                strokeDasharray="4 4"
                label={{ value: "80", position: "right", fill: "var(--muted)", fontSize: 10 }}
              />
              <ReferenceLine
                y={90}
                stroke="var(--dia)"
                strokeOpacity={0.55}
                strokeDasharray="4 4"
                label={{ value: "90", position: "right", fill: "var(--muted)", fontSize: 10 }}
              />
            </>
          )}
          <XAxis {...timeAxisProps(domain)} />
          <YAxis {...yAxisProps} domain={y.domain} ticks={y.ticks} />
          <Tooltip
            cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
            content={({ active, payload }: AnyTip) => {
              const p: Point | undefined = payload?.[0]?.payload;
              if (!active || !p) return null;
              return (
                <TipShell t={p.t} tz={p.tz}>
                  <TipRow color="var(--sys)" label="Systolic" value={`${p.sys}`} />
                  <TipRow color="var(--dia)" label="Diastolic" value={`${p.dia}`} />
                  <div className="mt-1.5">
                    <LevelBadge sys={p.sys} dia={p.dia} />
                  </div>
                </TipShell>
              );
            }}
          />
          <Area dataKey="sysR" stroke="none" fill="var(--sys)" fillOpacity={0.12} isAnimationActive={false} activeDot={false} />
          <Area dataKey="diaR" stroke="none" fill="var(--dia)" fillOpacity={0.12} isAnimationActive={false} activeDot={false} />
          <Line
            dataKey="sys"
            stroke="var(--sys)"
            strokeWidth={2}
            dot={dots ? { r: 3.5, fill: "var(--sys)", stroke: RING, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--sys)", stroke: RING, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="dia"
            stroke="var(--dia)"
            strokeWidth={2}
            dot={dots ? { r: 3.5, fill: "var(--dia)", stroke: RING, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--dia)", stroke: RING, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */

function CorrelationCard({
  points,
  domain,
  mode,
  setMode,
}: {
  points: Point[];
  domain: [number, number];
  mode: "scatter" | "timeline";
  setMode: (m: "scatter" | "timeline") => void;
}) {
  const hrs = points.map((p) => p.hr);
  const rSys = pearson(hrs, points.map((p) => p.sys));
  const rDia = pearson(hrs, points.map((p) => p.dia));
  const fitSys = linearFit(hrs, points.map((p) => p.sys));
  const fitDia = linearFit(hrs, points.map((p) => p.dia));

  const xs = niceScale(Math.min(...hrs) - 3, Math.max(...hrs) + 3, 8);
  const ys = niceScale(
    Math.min(...points.map((p) => p.dia)) - 5,
    Math.max(...points.map((p) => p.sys)) + 5,
  );
  const [xLo, xHi] = xs.domain;

  const sysPts = points.map((p) => ({ x: p.hr, y: p.sys, p }));
  const diaPts = points.map((p) => ({ x: p.hr, y: p.dia, p }));

  const seg = (f: { slope: number; intercept: number } | null) =>
    f
      ? ([
          { x: xLo, y: f.intercept + f.slope * xLo },
          { x: xHi, y: f.intercept + f.slope * xHi },
        ] as const)
      : null;
  const sSeg = seg(fitSys);
  const dSeg = seg(fitDia);

  return (
    <ChartCard
      title="Heart rate vs blood pressure"
      subtitle={
        mode === "scatter"
          ? "Each dot is a session · trend line shows how BP moves as pulse rises"
          : "Same sessions over time · hover one chart to line up the other"
      }
      right={
        <Segmented
          label="Correlation view"
          size="sm"
          value={mode}
          onChange={(v) => v && setMode(v)}
          options={[
            { value: "scatter", label: "Scatter" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
      }
      legend={
        mode === "scatter" ? (
          <>
            <Key color="var(--sys)" label="Systolic" kind="dot" />
            <Key color="var(--dia)" label="Diastolic" kind="dot" />
          </>
        ) : (
          <>
            <Key color="var(--hr)" label="Heart rate" />
            <Key color="var(--sys)" label="Systolic" />
            <Key color="var(--dia)" label="Diastolic" />
          </>
        )
      }
      footer={
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <RStat label="Pulse ↔ Systolic" r={rSys} />
          <RStat label="Pulse ↔ Diastolic" r={rDia} />
          <p className="text-xs leading-relaxed text-muted">
            <b className="font-semibold text-ink-2">How to read r:</b> from −1 to +1. Near 0 means
            pulse and pressure move independently; closer to ±1 means they rise or fall together.
            Based on {points.length} session{points.length === 1 ? "" : "s"}.
          </p>
        </div>
      }
    >
      {mode === "scatter" ? (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" />
            <XAxis
              type="number"
              dataKey="x"
              domain={xs.domain}
              ticks={xs.ticks}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--axis)" }}
              label={{ value: "Heart rate (bpm)", position: "insideBottom", offset: -10, fill: "var(--muted)", fontSize: 11 }}
            />
            <YAxis type="number" dataKey="y" {...yAxisProps} domain={ys.domain} ticks={ys.ticks} />
            <ZAxis range={[46, 46]} />
            <Tooltip
              cursor={{ stroke: "var(--axis)", strokeDasharray: "3 3" }}
              content={({ active, payload }: AnyTip) => {
                const d = payload?.[0]?.payload as { p: Point } | undefined;
                if (!active || !d) return null;
                const p = d.p;
                return (
                  <TipShell t={p.t} tz={p.tz}>
                    <TipRow color="var(--hr)" label="Heart rate" value={`${p.hr} bpm`} />
                    <TipRow color="var(--sys)" label="Systolic" value={`${p.sys}`} />
                    <TipRow color="var(--dia)" label="Diastolic" value={`${p.dia}`} />
                  </TipShell>
                );
              }}
            />
            {sSeg && (
              <ReferenceLine segment={sSeg} stroke="var(--sys)" strokeWidth={2} strokeOpacity={0.7} ifOverflow="hidden" />
            )}
            {dSeg && (
              <ReferenceLine segment={dSeg} stroke="var(--dia)" strokeWidth={2} strokeOpacity={0.7} ifOverflow="hidden" />
            )}
            <Scatter name="Systolic" data={sysPts} fill="var(--sys)" stroke={RING} strokeWidth={1.5} fillOpacity={0.85} isAnimationActive={false} />
            <Scatter name="Diastolic" data={diaPts} fill="var(--dia)" stroke={RING} strokeWidth={1.5} fillOpacity={0.85} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      ) : (
        <Timeline points={points} domain={domain} />
      )}
    </ChartCard>
  );
}

function RStat({ label, r }: { label: string; r: number | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="tnum text-2xl font-semibold tracking-tight">
          {r === null ? "—" : `r = ${r.toFixed(2)}`}
        </span>
      </p>
      <p className="text-xs text-ink-2">{describeR(r)}</p>
    </div>
  );
}

/** Two aligned charts sharing a time axis (instead of a dual-axis chart). */
function Timeline({ points, domain }: { points: Point[]; domain: [number, number] }) {
  const dots = points.length <= 60;
  const tip = ({ active, payload }: AnyTip) => {
    const p: Point | undefined = payload?.[0]?.payload;
    if (!active || !p) return null;
    const lv = BP_LEVELS[bpLevel(p.sys, p.dia)];
    return (
      <TipShell t={p.t} tz={p.tz}>
        <TipRow color="var(--hr)" label="Heart rate" value={`${p.hr} bpm`} />
        <TipRow color="var(--sys)" label="Systolic" value={`${p.sys}`} />
        <TipRow color="var(--dia)" label="Diastolic" value={`${p.dia}`} />
        <p className="mt-1 text-[11px] text-muted">{lv.label}</p>
      </TipShell>
    );
  };
  const hrY = niceScale(
    Math.min(...points.map((p) => p.hr)) - 5,
    Math.max(...points.map((p) => p.hr)) + 5,
    5,
  );
  const bpY = niceScale(
    Math.min(...points.map((p) => p.dia)) - 5,
    Math.max(...points.map((p) => p.sys)) + 5,
    5,
  );
  return (
    <div>
      <p className="mb-1 ml-2 text-[11px] font-medium text-muted">Heart rate · bpm</p>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={points} syncId="corr" syncMethod="value" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis {...timeAxisProps(domain)} hide />
          <YAxis {...yAxisProps} domain={hrY.domain} ticks={hrY.ticks} />
          <Tooltip cursor={{ stroke: "var(--axis)" }} content={tip} />
          <Line
            dataKey="hr"
            stroke="var(--hr)"
            strokeWidth={2}
            dot={dots ? { r: 3, fill: "var(--hr)", stroke: RING, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--hr)", stroke: RING, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-3 mb-1 ml-2 text-[11px] font-medium text-muted">Blood pressure · mmHg</p>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={points} syncId="corr" syncMethod="value" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis {...timeAxisProps(domain)} />
          <YAxis {...yAxisProps} domain={bpY.domain} ticks={bpY.ticks} />
          <Tooltip cursor={{ stroke: "var(--axis)" }} content={tip} />
          <Line
            dataKey="sys"
            stroke="var(--sys)"
            strokeWidth={2}
            dot={dots ? { r: 3, fill: "var(--sys)", stroke: RING, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--sys)", stroke: RING, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="dia"
            stroke="var(--dia)"
            strokeWidth={2}
            dot={dots ? { r: 3, fill: "var(--dia)", stroke: RING, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: "var(--dia)", stroke: RING, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
