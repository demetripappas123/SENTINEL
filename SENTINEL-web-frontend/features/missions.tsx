"use client";
import { useId, useState } from "react";
import { missionBrief, type Configuration, type CountBar, type InspectionDataset } from "@sentinel/core";
import { useQueue } from "../lib/queue-data";
import { ConfigurationControl, PageHeading, Panel } from "../components/ui";
import { MissionTable } from "../components/mission-table";
import { useInspectionData } from "../lib/inspection-data";

const ISSUE_LABELS: Record<string, string> = {
  failed_action: "Failed Action",
  bad_reading: "Bad Reading",
  anomaly_with_evidence: "Anomaly With Evidence",
  anomaly_without_evidence: "Anomaly Without Evidence",
};


function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function Missions() {
  const [configuration, setConfiguration] = useState<Configuration>("ALL");
  const data = useInspectionData();
  const queue = useQueue();
  const missions = data.missions
    .filter((m) => configuration === "ALL" || m.scenario === configuration)
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
      <div className="mission-brief">
        <Panel title="Action failures" action={<span className="small muted">By failure type</span>}>
          <Bars
            rows={brief.failureTypes}
            label={(row) => titleCase(row.key)}
          />
        </Panel>
        <Panel title="Mission issues" action={<span className="small muted">By evidence rule</span>}>
          <IssueCircle rows={brief.issues} />
        </Panel>
      </div>
      <VersionCompare data={data} />
      <Panel title="Interpretation" className="interpretation-panel">
        <div className="interpretation">
          <p>{brief.interpretation.lead}</p>
          {brief.interpretation.steps.length ? (
            <ul>
              {brief.interpretation.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
          {brief.interpretation.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </Panel>
      <Panel
        title={missions.length + " missions"}
        action={<span className="small muted">Latest first</span>}
      >
        <MissionTable missions={missions} full />
      </Panel>
    </>
  );
}

const FAILURE_SHORT: Record<string, string> = {
  READING_UNRELIABLE: "Reading",
  SENSOR_TIMEOUT: "Timeout",
  TARGET_NOT_DETECTED: "Target",
  LOCALIZATION_FAILURE: "Location",
  COMMUNICATION_LOSS: "Comms",
  SIGNAL_NOISE: "Noise",
  OBSTACLE_DETECTION: "Obstacle",
  PATH_BLOCKED: "Path",
};

function VersionCompare({ data }: { data: InspectionDataset }) {
  const model = compareModel(data);
  if (!model) {
    return (
      <Panel title="V1 against V2" className="interpretation-panel" action={<span className="small muted">All recorded runs</span>}>
        <p className="panel-body">No paired configurations to compare.</p>
      </Panel>
    );
  }
  const { v1, v2 } = model;
  return (
    <section className="compare-board" aria-label="V1 against V2">
      <header className="compare-board-head">
        <h2>V1 against V2</h2>
        <span>{model.range}</span>
      </header>
      <div className="compare-kpis">
        <KpiCard label="V2 action success" value={v2.actionSuccess} unit="%" color="var(--chart-yellow)" points={model.v2Success} />
        <KpiCard label="V2 average duration" value={v2.duration} unit=" min" color="var(--chart-green)" points={model.v2Duration} />
        <KpiCard label="V2 failed actions" value={v2.failed} unit="" color="var(--chart-orange)" points={model.v2Failed} />
      </div>
      <div className="compare-charts">
        <article className="compare-chart">
          <header>
            <h3>Failed actions</h3>
            <span>By type</span>
          </header>
          <Stat value={v2.failed} delta={deltaText(v1.failed, v2.failed, "")} better={changeTone(v1.failed, v2.failed, false)} note="V2 compared with V1" />
          <GroupedBars rows={model.failures} />
          <Legend items={[{ name: "V1", color: "var(--chart-accent)" }, { name: "V2", color: "var(--chart-green)" }]} />
        </article>
        <article className="compare-chart">
          <header>
            <h3>Action success</h3>
            <span>By day</span>
          </header>
          <Stat
            value={v2.actionSuccess}
            unit="%"
            delta={deltaText(v1.actionSuccess, v2.actionSuccess, " pts")}
            better={changeTone(v1.actionSuccess, v2.actionSuccess, true)}
            note="V2 compared with V1"
          />
          <SuccessLines days={model.days} />
          <Legend items={[{ name: "V1", color: "var(--chart-accent)", dashed: true }, { name: "V2", color: "var(--chart-green)" }]} />
        </article>
        <article className="compare-chart">
          <header>
            <h3>Outcomes</h3>
            <span>Recorded actions</span>
          </header>
          <Stat
            value={v2.completion}
            unit="%"
            delta={deltaText(v1.completion, v2.completion, " pts")}
            better={changeTone(v1.completion, v2.completion, true)}
            note="V2 mission completion"
          />
          <OutcomeDonut slices={model.outcomes} />
        </article>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  unit,
  color,
  points,
}: {
  label: string;
  value: number | null;
  unit: string;
  color: string;
  points: number[];
}) {
  return (
    <article className="compare-kpi">
      <div>
        <strong>
          {value == null ? "—" : formatStat(value)}
          {unit === "%" && value != null ? <small>%</small> : null}
          {unit === " min" && value != null ? <small> min</small> : null}
        </strong>
        <span>{label}</span>
      </div>
      <Sparkline values={points} color={color} label={label} />
    </article>
  );
}

function Stat({
  value,
  unit = "",
  delta,
  better,
  note,
}: {
  value: number | null;
  unit?: string;
  delta: string;
  better: "better" | "worse" | "flat";
  note: string;
}) {
  return (
    <div className="compare-stat">
      <strong>
        {value == null ? "—" : formatStat(value)}
        {unit === "%" && value != null ? <small>%</small> : null}
      </strong>
      <span className={"compare-delta " + better}>{delta}</span>
      <p>{note}</p>
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="compare-legend">
      {items.map((item) => (
        <li key={item.name}>
          <i className={item.dashed ? "dashed" : ""} style={{ background: item.dashed ? "transparent" : item.color, borderColor: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const id = useId().replace(/:/g, "");
  const path = areaPath(values, 96, 36);
  return (
    <svg className="compare-spark" viewBox="0 0 96 36" role="img" aria-label={`${label} trend`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {path ? <path d={path.area} fill={`url(#${id})`} /> : null}
      {path ? <path d={path.line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /> : null}
    </svg>
  );
}

function GroupedBars({ rows }: { rows: { key: string; label: string; v1: number; v2: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.v1, row.v2]));
  const width = 320;
  const height = 168;
  const baseline = 132;
  const group = width / Math.max(rows.length, 1);
  const bar = Math.min(16, group * 0.28);
  return (
    <svg className="compare-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Failed actions by type for V1 and V2">
      {rows.map((row, index) => {
        const cx = group * index + group / 2;
        const h1 = (row.v1 / max) * (baseline - 8);
        const h2 = (row.v2 / max) * (baseline - 8);
        return (
          <g key={row.key}>
            <path d={roundedBar(cx - bar - 2, baseline - h1, bar, h1)} fill="var(--chart-accent)" />
            <path d={roundedBar(cx + 2, baseline - h2, bar, h2)} fill="var(--chart-green)" />
            <text x={cx} y={152} textAnchor="middle">
              {row.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SuccessLines({ days }: { days: DayRow[] }) {
  const width = 320;
  const height = 168;
  const left = 8;
  const right = 8;
  const baseline = 132;
  const top = 12;
  const span = Math.max(days.length - 1, 1);
  const xAt = (index: number) => left + (index / span) * (width - left - right);
  const yAt = (rate: number) => baseline - (rate / 100) * (baseline - top);
  const v1 = days.flatMap((day, index) => (day.v1Rate == null ? [] : [[xAt(index), yAt(day.v1Rate)] as [number, number]]));
  const v2 = days.flatMap((day, index) => (day.v2Rate == null ? [] : [[xAt(index), yAt(day.v2Rate)] as [number, number]]));
  const v2Line = smooth(v2);
  const labelStep = days.length > 8 ? 2 : 1;
  return (
    <svg className="compare-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily action success for V1 and V2">
      {[0, 50, 100].map((rate) => (
        <line key={rate} x1={left} x2={width - right} y1={yAt(rate)} y2={yAt(rate)} />
      ))}
      {v2Line ? <path d={`${v2Line} L${v2[v2.length - 1][0]},${baseline} L${v2[0][0]},${baseline} Z`} className="v2-area" /> : null}
      {v1.length > 1 ? <path d={smooth(v1)} className="v1-line" /> : null}
      {v2Line ? <path d={v2Line} className="v2-line" /> : null}
      {days.map((day, index) =>
        index % labelStep === 0 ? (
          <text key={day.day} x={xAt(index)} y={152} textAnchor="middle">
            {dayLabel(day.day)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function OutcomeDonut({ slices }: { slices: { key: string; label: string; count: number; color: string }[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  let cursor = 0;
  const stops = slices
    .filter((slice) => slice.count > 0)
    .map((slice) => {
      const start = cursor;
      cursor += (slice.count / Math.max(total, 1)) * 100;
      return `${slice.color} ${start}% ${cursor}%`;
    });
  return (
    <div className="compare-donut">
      <div
        style={{ background: total ? `conic-gradient(${stops.join(", ")})` : "var(--secondary)" }}
        role="img"
        aria-label={slices.map((slice) => `${slice.label} ${slice.count}`).join(", ")}
      >
        <span>{total}</span>
      </div>
      <ul className="compare-legend">
        {slices.map((slice) => (
          <li key={slice.key}>
            <i style={{ background: slice.color }} />
            {slice.label}
            <b>{slice.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function roundedBar(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const radius = Math.min(4, width / 2, height);
  return `M${x},${y + height} V${y + radius} Q${x},${y} ${x + radius},${y} H${x + width - radius} Q${x + width},${y} ${x + width},${y + radius} V${y + height} Z`;
}

function areaPath(values: number[], width: number, height: number) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / span) * (height - 8);
    return [x, y] as [number, number];
  });
  const line = smooth(points);
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
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
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" });
}

function compareModel(data: InspectionDataset) {
  const v1 = versionSnapshot(data, "V1");
  const v2 = versionSnapshot(data, "V2");
  if (!v1.missions || !v2.missions) return null;
  const missions = new Map(data.missions.map((mission) => [mission.mission_id, mission]));
  const days = new Map<string, { v1: [number, number]; v2: [number, number]; v2Duration: number[]; v2Failed: number }>();
  const ensure = (day: string) => {
    const row = days.get(day) ?? { v1: [0, 0], v2: [0, 0], v2Duration: [], v2Failed: 0 };
    days.set(day, row);
    return row;
  };
  for (const mission of data.missions) {
    const day = mission.start_time?.slice(0, 10);
    if (!day || (mission.configuration_version !== "V1" && mission.configuration_version !== "V2")) continue;
    if (mission.configuration_version === "V2" && mission.duration_min != null) ensure(day).v2Duration.push(mission.duration_min);
  }
  const failures = new Map<string, { v1: number; v2: number }>();
  let v1Passed = 0;
  let v2Passed = 0;
  for (const action of data.actions) {
    const mission = missions.get(action.mission_id);
    const version = mission?.configuration_version;
    if (version !== "V1" && version !== "V2") continue;
    const day = mission?.start_time?.slice(0, 10);
    if (action.status !== "SUCCESS" && action.status !== "FAILED") continue;
    if (day) {
      const row = ensure(day);
      const side = version === "V1" ? row.v1 : row.v2;
      if (action.status === "SUCCESS") side[0] += 1;
      else side[1] += 1;
      if (version === "V2" && action.status === "FAILED") row.v2Failed += 1;
    }
    if (action.status === "SUCCESS") {
      if (version === "V1") v1Passed += 1;
      else v2Passed += 1;
    } else {
      const row = failures.get(action.failure_type || "UNKNOWN") ?? { v1: 0, v2: 0 };
      row[version === "V1" ? "v1" : "v2"] += 1;
      failures.set(action.failure_type || "UNKNOWN", row);
    }
  }
  const ordered = [...days.keys()].sort();
  const rate = (pair: [number, number]) => (pair[0] + pair[1] ? (pair[0] / (pair[0] + pair[1])) * 100 : null);
  const dayRows = ordered.map((day) => {
    const row = days.get(day)!;
    return { day, v1Rate: rate(row.v1), v2Rate: rate(row.v2) };
  });
  const v2Days = ordered.map((day) => days.get(day)!).filter((row) => row.v2[0] + row.v2[1] > 0);
  return {
    v1,
    v2,
    range: ordered.length ? `${dayLabel(ordered[0])} – ${dayLabel(ordered[ordered.length - 1])}` : "All recorded runs",
    v2Success: v2Days.flatMap((row) => {
      const value = rate(row.v2);
      return value == null ? [] : [value];
    }),
    v2Duration: ordered.flatMap((day) => {
      const values = days.get(day)!.v2Duration;
      return values.length ? [values.reduce((sum, value) => sum + value, 0) / values.length] : [];
    }),
    v2Failed: v2Days.map((row) => row.v2Failed),
    days: dayRows,
    failures: [...failures.entries()]
      .sort((a, b) => b[1].v1 + b[1].v2 - (a[1].v1 + a[1].v2) || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([key, counts]) => ({ key, label: FAILURE_SHORT[key] ?? titleCase(key).split(" ")[0], v1: counts.v1, v2: counts.v2 })),
    outcomes: [
      { key: "v1-passed", label: "V1 passed", count: v1Passed, color: "var(--chart-accent)" },
      { key: "v1-failed", label: "V1 failed", count: v1.failed, color: "var(--chart-yellow)" },
      { key: "v2-passed", label: "V2 passed", count: v2Passed, color: "var(--chart-green)" },
      { key: "v2-failed", label: "V2 failed", count: v2.failed, color: "var(--chart-red)" },
    ],
  };
}

function deltaText(from: number | null, to: number | null, unit: string) {
  if (from == null || to == null) return "—";
  const change = to - from;
  return (change > 0 ? "+" : change < 0 ? "−" : "") + formatStat(Math.abs(change)) + unit;
}

function changeTone(from: number | null, to: number | null, higherIsBetter: boolean): "better" | "worse" | "flat" {
  if (from == null || to == null || to === from) return "flat";
  const improved = higherIsBetter ? to > from : to < from;
  return improved ? "better" : "worse";
}

function versionSnapshot(data: InspectionDataset, version: string) {
  const missions = data.missions.filter((mission) => mission.configuration_version === version);
  const ids = new Set(missions.map((mission) => mission.mission_id));
  const actions = data.actions.filter((action) => ids.has(action.mission_id));
  const recorded = actions.filter((action) => action.status === "SUCCESS" || action.status === "FAILED");
  const passed = recorded.filter((action) => action.status === "SUCCESS").length;
  const durations = missions.flatMap((mission) => (mission.duration_min == null ? [] : [mission.duration_min]));
  return {
    version,
    missions: missions.length,
    actionSuccess: recorded.length ? (passed / recorded.length) * 100 : null,
    completion: missions.length
      ? (missions.filter((mission) => mission.mission_status === "COMPLETED").length / missions.length) * 100
      : null,
    duration: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    failed: actions.filter((action) => action.status === "FAILED").length,
  };
}

function formatStat(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function IssueCircle({ rows }: { rows: CountBar[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const colorAt = (index: number) => scaleColor(rows.length <= 1 ? 0 : index / (rows.length - 1));
  const slices = rows
    .map((row, index) => ({ row, color: colorAt(index) }))
    .filter((slice) => slice.row.count > 0);
  let cursor = 0;
  const stops = slices.map((slice) => {
    const start = cursor;
    cursor += (slice.row.count / Math.max(total, 1)) * 100;
    return `${slice.color} ${start}% ${cursor}%`;
  });
  return (
    <div className="issue-chart">
      <div
        className="issue-donut"
        style={{ background: total ? `conic-gradient(${stops.join(", ")})` : "var(--secondary)" }}
        role="img"
        aria-label={`${total} mission issues`}
      >
        <span>{total}</span>
      </div>
      <ul className="issue-legend">
        {rows.map((row, index) => (
          <li key={row.key}>
            <i style={{ background: colorAt(index) }} />
            <span>{ISSUE_LABELS[row.key] ?? titleCase(row.key)}</span>
            <span className="percent">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function scaleColor(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= 0.5) {
    return `color-mix(in srgb, var(--chart-yellow) ${Math.round((clamped / 0.5) * 100)}%, var(--chart-red))`;
  }
  return `color-mix(in srgb, var(--chart-green) ${Math.round(((clamped - 0.5) / 0.5) * 100)}%, var(--chart-yellow))`;
}

function yAxisColor(index: number, count: number) {
  return scaleColor(count <= 1 ? 0 : index / (count - 1));
}

function Bars({
  rows,
  label,
}: {
  rows: CountBar[];
  label: (row: CountBar) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="panel-body">None recorded.</p>;
  return (
    <div className="diagram-list">
      {rows.map((row, index) => {
        const name = label(row);
        const width = row.count === 0 ? 0 : Math.max(4, (row.count / max) * 100);
        return (
          <div className="diagram-row" key={row.key}>
            <span>{name}</span>
            <div className="bar" role="img" aria-label={`${name}: ${row.count}`}>
              <span style={{ width: width + "%", background: yAxisColor(index, rows.length) }} />
            </div>
            <span className="percent">{row.count}</span>
          </div>
        );
      })}
    </div>
  );
}
