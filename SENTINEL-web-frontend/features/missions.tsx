"use client";
import { useState } from "react";
import { ChevronDown, CircleDot, Sparkles } from "lucide-react";
import {
  missionBrief,
  type Configuration,
  type CountBar,
  type InspectionDataset,
  type MissionBrief,
} from "@sentinel/core";
import { useQueue } from "../lib/queue-data";
import { ConfigurationControl, PageHeading, Panel } from "../components/ui";
import { MissionTable } from "../components/mission-table";
import { useInspectionData } from "../lib/inspection-data";

const ISSUE_LABELS: Record<string, string> = {
  failed_action: "Failed action",
  bad_reading: "Bad reading",
  anomaly_with_evidence: "Anomaly with evidence",
  potential_anomaly: "Potential anomaly",
  anomaly_without_evidence: "Anomaly without evidence",
};

const ISSUE_COLORS: Record<string, string> = {
  failed_action: "var(--chart-red)",
  bad_reading: "var(--chart-orange)",
  anomaly_with_evidence: "var(--chart-yellow)",
  potential_anomaly: "var(--mid)",
  anomaly_without_evidence: "var(--chart-2)",
};

const FAILURE_SHORT: Record<string, string> = {
  READING_UNRELIABLE: "Unreliable reading",
  SENSOR_TIMEOUT: "Sensor timeout",
  TARGET_NOT_DETECTED: "Target not found",
  LOCALIZATION_FAILURE: "Lost position",
  COMMUNICATION_LOSS: "Comms lost",
  SIGNAL_NOISE: "Signal noise",
  OBSTACLE_DETECTION: "Obstacle",
  PATH_BLOCKED: "Path blocked",
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sentenceCase(value: string) {
  const text = value.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function Missions() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const data = useInspectionData();
  const queue = useQueue();
  const missions = data.missions
    .filter((m) => configuration === "ALL" || m.configuration_version === configuration)
    .slice()
    .reverse();
  const brief = missionBrief(data, queue, configuration);
  return (
    <>
      <PageHeading title="Missions" />
      <div className="toolbar">
        <ConfigurationControl
          value={configuration}
          onChange={setConfiguration}
        />
      </div>
      <Readout brief={brief} />
      <VersionCompare data={data} />
      <Panel
        title={missions.length + " missions"}
        action={<span className="small muted">Latest first</span>}
      >
        <MissionTable missions={missions} full />
      </Panel>
    </>
  );
}

function Readout({ brief }: { brief: MissionBrief }) {
  const { lead, steps, notes } = brief.interpretation;
  const total = brief.issues.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="readout" aria-label="Interpretation">
      <div className="readout-main">
        <span className="readout-mark" aria-hidden="true">
          <Sparkles className="icon" />
        </span>
        <div className="readout-text">
          <h2>What the runs say</h2>
          <p className="readout-lead">{lead}</p>
          {total > 0 && <IssueMix rows={brief.issues} total={total} />}
        </div>
      </div>
      {steps.length > 0 && (
        <div className="readout-steps">
          <h3>Check first</h3>
          <ul>
            {steps.map((step) => (
              <li key={step}>
                <CircleDot className="icon" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.length > 0 && (
        <details className="readout-notes">
          <summary>
            <ChevronDown className="icon" />
            {notes.length} more{" "}
            {notes.length === 1 ? "observation" : "observations"}
          </summary>
          <ul>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function IssueMix({ rows, total }: { rows: CountBar[]; total: number }) {
  const visible = rows.filter((row) => row.count > 0);
  return (
    <div className="issue-mix">
      <div
        className="issue-mix-bar"
        role="img"
        aria-label={
          `${total} mission issues: ` +
          visible
            .map(
              (row) =>
                `${ISSUE_LABELS[row.key] ?? titleCase(row.key)} ${row.count}`,
            )
            .join(", ")
        }
      >
        {visible.map((row) => (
          <span
            key={row.key}
            style={{
              flexGrow: row.count,
              background: ISSUE_COLORS[row.key] ?? "var(--chart-2)",
            }}
          />
        ))}
      </div>
      <ul>
        {visible.map((row) => (
          <li key={row.key}>
            <i
              style={{ background: ISSUE_COLORS[row.key] ?? "var(--chart-2)" }}
            />
            {ISSUE_LABELS[row.key] ?? titleCase(row.key)}
            <b>{row.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersionCompare({ data }: { data: InspectionDataset }) {
  const model = compareModel(data);
  if (!model) {
    return (
      <Panel title="V1 against V2" className="compare-panel">
        <p className="panel-body">No paired configurations to compare.</p>
      </Panel>
    );
  }
  const { v1, v2 } = model;
  const metrics: HeadToHeadProps[] = [
    {
      label: "Action success",
      v1: v1.actionSuccess,
      v2: v2.actionSuccess,
      unit: "%",
      deltaUnit: " pts",
      higherIsBetter: true,
      max: 100,
    },
    {
      label: "Mission completion",
      v1: v1.completion,
      v2: v2.completion,
      unit: "%",
      deltaUnit: " pts",
      higherIsBetter: true,
      max: 100,
    },
    {
      label: "Failures per run",
      v1: v1.failuresPerRun,
      v2: v2.failuresPerRun,
      unit: "",
      deltaUnit: "",
      higherIsBetter: false,
      note: `${v1.failed} → ${v2.failed} failed actions`,
    },
    {
      label: "Average duration",
      v1: v1.duration,
      v2: v2.duration,
      unit: " min",
      deltaUnit: " min",
      higherIsBetter: false,
    },
  ];
  return (
    <section className="compare-panel" aria-label="V1 against V2">
      <header className="compare-head">
        <div>
          <h2>V1 against V2</h2>
          <p>
            <Swatch version="V1" /> {v1.missions} runs
            <Swatch version="V2" /> {v2.missions} runs
          </p>
        </div>
        <span>{model.range}</span>
      </header>
      <div className="h2h-row">
        {metrics.map((metric) => (
          <HeadToHead key={metric.label} {...metric} />
        ))}
      </div>
      <div className="compare-body">
        <article className="compare-cell">
          <header>
            <h3>Action success by day</h3>
            <span>Dashed line is each version’s average</span>
          </header>
          <SuccessTimeline
            days={model.days}
            v1={v1.actionSuccess}
            v2={v2.actionSuccess}
          />
        </article>
        <article className="compare-cell">
          <header>
            <h3>Why actions failed</h3>
            <span>Failed actions by cause</span>
          </header>
          <Butterfly rows={model.failures} />
        </article>
      </div>
    </section>
  );
}

function Swatch({ version }: { version: "V1" | "V2" }) {
  return (
    <i className={"swatch " + version.toLowerCase()} aria-label={version} />
  );
}

type HeadToHeadProps = {
  label: string;
  v1: number | null;
  v2: number | null;
  unit: string;
  deltaUnit: string;
  higherIsBetter: boolean;
  max?: number;
  note?: string;
};

function HeadToHead({
  label,
  v1,
  v2,
  unit,
  deltaUnit,
  higherIsBetter,
  max,
  note,
}: HeadToHeadProps) {
  const tone = changeTone(v1, v2, higherIsBetter);
  const scale = max ?? Math.max(v1 ?? 0, v2 ?? 0, 1);
  const width = (value: number | null) =>
    value == null ? 0 : Math.max(2, (value / scale) * 100);
  return (
    <div className="h2h">
      <span className="h2h-label">{label}</span>
      <div className="h2h-value">
        <strong>
          {value(v2)}
          {v2 != null && unit && <small>{unit}</small>}
        </strong>
        <span className={"compare-delta " + tone}>
          {deltaText(v1, v2, deltaUnit)}
        </span>
      </div>
      <div
        className="h2h-bars"
        role="img"
        aria-label={`${label}: V1 ${value(v1)}${unit}, V2 ${value(v2)}${unit}`}
      >
        <div>
          <span>V1</span>
          <div className="h2h-track">
            <i className="v1" style={{ width: width(v1) + "%" }} />
          </div>
          <b>{value(v1)}</b>
        </div>
        <div>
          <span>V2</span>
          <div className="h2h-track">
            <i className="v2" style={{ width: width(v2) + "%" }} />
          </div>
          <b>{value(v2)}</b>
        </div>
      </div>
      {note && <p className="h2h-note">{note}</p>}
    </div>
  );
}

function SuccessTimeline({
  days,
  v1,
  v2,
}: {
  days: DayRow[];
  v1: number | null;
  v2: number | null;
}) {
  const width = 520;
  const height = 200;
  const left = 34;
  const right = 10;
  const top = 12;
  const baseline = 168;
  const span = Math.max(days.length - 1, 1);
  const rates = days
    .flatMap((day) => [day.v1Rate, day.v2Rate])
    .filter((rate): rate is number => rate != null);
  // Start the axis near the data so day-to-day movement stays readable.
  const floor = Math.max(
    0,
    Math.min(50, Math.floor((Math.min(100, ...rates) - 5) / 25) * 25),
  );
  const xAt = (index: number) => left + (index / span) * (width - left - right);
  const yAt = (rate: number) =>
    baseline - ((rate - floor) / (100 - floor)) * (baseline - top);
  const series = (key: "v1Rate" | "v2Rate") =>
    days.flatMap((day, index) =>
      day[key] == null ? [] : [[xAt(index), yAt(day[key]!), index] as const],
    );
  const s1 = series("v1Rate");
  const s2 = series("v2Rate");
  const extent = (points: readonly (readonly [number, number, number])[]) =>
    points.length ? [points[0][0], points[points.length - 1][0]] : null;
  const e1 = extent(s1);
  const e2 = extent(s2);
  const rollout = s2.length ? s2[0][2] : -1;
  const labelStep = days.length > 8 ? 2 : 1;
  return (
    <svg
      className="timeline-plot"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Daily action success. V1 averages ${value(v1)}%, V2 averages ${value(v2)}%.`}
    >
      {[floor, (floor + 100) / 2, 100].map((rate) => (
        <g key={rate}>
          <line
            className="grid"
            x1={left}
            x2={width - right}
            y1={yAt(rate)}
            y2={yAt(rate)}
          />
          <text x={left - 8} y={yAt(rate) + 3} textAnchor="end">
            {rate}%
          </text>
        </g>
      ))}
      {rollout > 0 && s1.length > 0 && (
        <g className="rollout">
          <line
            x1={xAt(rollout) - (xAt(1) - xAt(0)) / 2}
            x2={xAt(rollout) - (xAt(1) - xAt(0)) / 2}
            y1={top}
            y2={baseline}
          />
          <text x={xAt(rollout) - (xAt(1) - xAt(0)) / 2 + 6} y={baseline - 6}>
            V2 starts
          </text>
        </g>
      )}
      {e1 && v1 != null && (
        <line
          className="avg v1"
          x1={e1[0]}
          x2={e1[1]}
          y1={yAt(v1)}
          y2={yAt(v1)}
        />
      )}
      {e2 && v2 != null && (
        <line
          className="avg v2"
          x1={e2[0]}
          x2={e2[1]}
          y1={yAt(v2)}
          y2={yAt(v2)}
        />
      )}
      {s1.length > 1 && (
        <path className="series v1" d={smooth(s1.map(([x, y]) => [x, y]))} />
      )}
      {s2.length > 1 && (
        <path className="series v2" d={smooth(s2.map(([x, y]) => [x, y]))} />
      )}
      {s1.map(([x, y, index]) => (
        <circle key={"a" + index} className="dot v1" cx={x} cy={y} r="3" />
      ))}
      {s2.map(([x, y, index]) => (
        <circle key={"b" + index} className="dot v2" cx={x} cy={y} r="3" />
      ))}
      {days.map((day, index) =>
        index % labelStep === 0 ? (
          <text
            key={day.day}
            x={xAt(index)}
            y={height - 10}
            textAnchor="middle"
          >
            {dayLabel(day.day)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function Butterfly({
  rows,
}: {
  rows: { key: string; label: string; v1: number; v2: number }[];
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.v1, row.v2]));
  if (!rows.length)
    return (
      <p className="panel-body small muted">No failed actions recorded.</p>
    );
  return (
    <div
      className="butterfly"
      role="table"
      aria-label="Failed actions by cause for V1 and V2"
    >
      <div className="butterfly-row butterfly-head" role="row">
        <span role="columnheader">
          <Swatch version="V1" /> V1
        </span>
        <span role="columnheader">Cause</span>
        <span role="columnheader">
          V2 <Swatch version="V2" />
        </span>
      </div>
      {rows.map((row) => (
        <div className="butterfly-row" role="row" key={row.key}>
          <span
            className="butterfly-side left"
            role="cell"
            aria-label={`V1 ${row.v1}`}
          >
            <b>{row.v1 || ""}</b>
            <i className="v1" style={{ width: (row.v1 / max) * 100 + "%" }} />
          </span>
          <span className="butterfly-label" role="rowheader">
            {row.label}
          </span>
          <span
            className="butterfly-side right"
            role="cell"
            aria-label={`V2 ${row.v2}`}
          >
            <i className="v2" style={{ width: (row.v2 / max) * 100 + "%" }} />
            <b>{row.v2 || ""}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

function smooth(points: [number, number][]) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index === 0 ? index : index - 1];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const c1x = current[0] + (next[0] - previous[0]) / 6;
    const c1y = current[1] + (next[1] - previous[1]) / 6;
    const c2x = next[0] - (after[0] - current[0]) / 6;
    const c2y = next[1] - (after[1] - current[1]) / 6;
    path += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${next[0].toFixed(1)},${next[1].toFixed(1)}`;
  }
  return path;
}

type DayRow = {
  day: string;
  v1Rate: number | null;
  v2Rate: number | null;
};

function dayLabel(day: string) {
  const date = new Date(day + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

function compareModel(data: InspectionDataset) {
  const v1 = versionSnapshot(data, "V1");
  const v2 = versionSnapshot(data, "V2");
  if (!v1.missions || !v2.missions) return null;
  const missions = new Map(
    data.missions.map((mission) => [mission.mission_id, mission]),
  );
  const days = new Map<
    string,
    { v1: [number, number]; v2: [number, number] }
  >();
  const failures = new Map<string, { v1: number; v2: number }>();
  for (const action of data.actions) {
    const mission = missions.get(action.mission_id);
    const version = mission?.configuration_version;
    if (version !== "V1" && version !== "V2") continue;
    if (action.status !== "SUCCESS" && action.status !== "FAILED") continue;
    const day = mission?.start_time?.slice(0, 10);
    if (day) {
      const row = days.get(day) ?? { v1: [0, 0], v2: [0, 0] };
      days.set(day, row);
      const side = version === "V1" ? row.v1 : row.v2;
      side[action.status === "SUCCESS" ? 0 : 1] += 1;
    }
    if (action.status === "FAILED") {
      const key = action.failure_type || "UNKNOWN";
      const row = failures.get(key) ?? { v1: 0, v2: 0 };
      row[version === "V1" ? "v1" : "v2"] += 1;
      failures.set(key, row);
    }
  }
  const ordered = [...days.keys()].sort();
  const rate = (pair: [number, number]) =>
    pair[0] + pair[1] ? (pair[0] / (pair[0] + pair[1])) * 100 : null;
  return {
    v1,
    v2,
    range: ordered.length
      ? `${dayLabel(ordered[0])} – ${dayLabel(ordered[ordered.length - 1])}`
      : "All recorded runs",
    days: ordered.map((day) => {
      const row = days.get(day)!;
      return { day, v1Rate: rate(row.v1), v2Rate: rate(row.v2) };
    }),
    failures: [...failures.entries()]
      .sort(
        (a, b) =>
          b[1].v1 + b[1].v2 - (a[1].v1 + a[1].v2) || a[0].localeCompare(b[0]),
      )
      .slice(0, 7)
      .map(([key, counts]) => ({
        key,
        label: FAILURE_SHORT[key] ?? sentenceCase(key),
        ...counts,
      })),
  };
}

function deltaText(from: number | null, to: number | null, unit: string) {
  if (from == null || to == null) return "—";
  const change = to - from;
  return (
    (change > 0 ? "+" : change < 0 ? "−" : "") +
    formatStat(Math.abs(change)) +
    unit
  );
}

function changeTone(
  from: number | null,
  to: number | null,
  higherIsBetter: boolean,
): "better" | "worse" | "flat" {
  if (from == null || to == null || to === from) return "flat";
  const improved = higherIsBetter ? to > from : to < from;
  return improved ? "better" : "worse";
}

function versionSnapshot(data: InspectionDataset, version: string) {
  const missions = data.missions.filter(
    (mission) => mission.configuration_version === version,
  );
  const ids = new Set(missions.map((mission) => mission.mission_id));
  const actions = data.actions.filter((action) => ids.has(action.mission_id));
  const recorded = actions.filter(
    (action) => action.status === "SUCCESS" || action.status === "FAILED",
  );
  const passed = recorded.filter(
    (action) => action.status === "SUCCESS",
  ).length;
  const failed = actions.filter((action) => action.status === "FAILED").length;
  const durations = missions.flatMap((mission) =>
    mission.duration_min == null ? [] : [mission.duration_min],
  );
  return {
    version,
    missions: missions.length,
    actionSuccess: recorded.length ? (passed / recorded.length) * 100 : null,
    completion: missions.length
      ? (missions.filter((mission) => mission.mission_status === "COMPLETED")
          .length /
          missions.length) *
        100
      : null,
    duration: durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : null,
    failed,
    failuresPerRun: missions.length ? failed / missions.length : null,
  };
}

function value(number: number | null) {
  return number == null ? "—" : formatStat(number);
}

function formatStat(number: number) {
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}
