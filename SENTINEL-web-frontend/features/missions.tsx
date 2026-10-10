"use client";
import { useState } from "react";
import { missionBrief, type Configuration, type CountBar } from "@sentinel/core";
import { useQueue, useQueueReady } from "../lib/queue-data";
import { ConfigurationControl, PageHeading, Panel } from "../components/ui";
import { MissionTable } from "../components/mission-table";
import { pendingCount, useInspectionData, useInspectionReady } from "../lib/inspection-data";

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
  const ready = useInspectionReady();
  const queue = useQueue();
  const queueReady = useQueueReady();
  const missions = data.missions
    .filter((m) => configuration === "ALL" || m.scenario === configuration)
    .slice()
    .reverse();
  const brief = ready && queueReady ? missionBrief(data, queue, configuration) : null;
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
            rows={brief?.failureTypes ?? []}
            label={(row) => titleCase(row.key)}
            ready={brief != null}
          />
        </Panel>
        <Panel title="Mission issues" action={<span className="small muted">By evidence rule</span>}>
          <IssueCircle rows={brief?.issues ?? []} ready={brief != null} />
        </Panel>
      </div>
      <Panel title="Interpretation" className="interpretation-panel">
        {brief == null ? (
          <p className="panel-body">{pendingCount}</p>
        ) : (
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
        )}
      </Panel>
      <Panel
        title={(ready ? missions.length : pendingCount) + " missions"}
        action={<span className="small muted">Latest first</span>}
      >
        {ready ? <MissionTable missions={missions} full /> : <p className="panel-body">{pendingCount}</p>}
      </Panel>
    </>
  );
}

function IssueCircle({ rows, ready }: { rows: CountBar[]; ready: boolean }) {
  if (!ready) return <p className="panel-body">{pendingCount}</p>;
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
  ready,
}: {
  rows: CountBar[];
  label: (row: CountBar) => string;
  ready: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  const visible = ready ? rows : [];
  if (!ready) return <p className="panel-body">{pendingCount}</p>;
  if (!visible.length) return <p className="panel-body">None recorded.</p>;
  return (
    <div className="diagram-list">
      {visible.map((row, index) => {
        const name = label(row);
        const width = row.count === 0 ? 0 : Math.max(4, (row.count / max) * 100);
        return (
          <div className="diagram-row" key={row.key}>
            <span>{name}</span>
            <div className="bar" role="img" aria-label={`${name}: ${row.count}`}>
              <span style={{ width: width + "%", background: yAxisColor(index, visible.length) }} />
            </div>
            <span className="percent">{row.count}</span>
          </div>
        );
      })}
    </div>
  );
}
