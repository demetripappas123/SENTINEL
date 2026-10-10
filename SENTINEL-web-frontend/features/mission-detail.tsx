"use client";
import Link from "next/link";
import { useState } from "react";
import {
  actionFindings,
  humanize,
  locationName,
  missionActions,
  missionLabel,
  pending,
  shortTime,
} from "@sentinel/core";
import { PageHeading, Panel, severityTone, Tag } from "../components/ui";
import { Capture } from "../components/findings";
import { useInspectionData, useInspectionReady } from "../lib/inspection-data";

export function MissionDetail({ missionId }: { missionId: string }) {
  const data = useInspectionData();
  const ready = useInspectionReady();
  const mission = data.missions.find((m) => m.mission_id === missionId),
    actions = missionActions(data, missionId);
  const [selectedId, setSelectedId] = useState(
    (actions.find((a) => a.status === "FAILED") || actions[0])?.action_id,
  );
  const selected =
    actions.find((a) => a.action_id === selectedId) || actions[0];
  if (!ready) return <p>Loading mission.</p>;
  if (!mission) return <p>Mission unavailable.</p>;
  const passed = actions.filter((a) => a.status === "SUCCESS").length;
  const label = missionLabel(mission);
  const readings = selected
    ? data.readings.filter((r) => r.action_id === selected.action_id)
    : [];
  const findings = selected ? actionFindings(data, selected.action_id) : [];
  return (
    <>
      <PageHeading
        title={
          /^M\d+$/.test(missionId)
            ? "Route " + Number(missionId.slice(1))
            : mission.mission_name
        }
        subtitle={
          missionId +
          " · " +
          shortTime(mission.start_time) +
          (mission.configuration_version
            ? " · " + mission.configuration_version
            : "")
        }
      >
        <Link className="btn green" href={"/review?mission=" + missionId}>
          Findings →
        </Link>
      </PageHeading>
      <div className="summary-band">
        <div className="datum">
          <span className="small muted">Status</span>
          <Tag
            tone={
              label === "COMPLETED"
                ? "green"
                : label === "FAILED"
                  ? "red"
                  : label === "IN_PROGRESS"
                    ? "amber"
                    : ""
            }
          >
            {humanize(label)}
          </Tag>
        </div>
        <div className="datum">
          <span className="small muted">Actions</span>
          <strong>
            {passed} / {actions.length} successful
          </strong>
        </div>
        <div className="datum">
          <span className="small muted">Failed</span>
          <strong>{actions.length - passed}</strong>
        </div>
        <div className="datum">
          <span className="small muted">Battery</span>
          <strong>
            {mission.start_battery_pct == null && mission.end_battery_pct == null
              ? "Pending"
              : pending(mission.start_battery_pct) +
                "% → " +
                pending(mission.end_battery_pct) +
                "%"}
          </strong>
        </div>
        <div className="datum">
          <span className="small muted">Duration</span>
          <strong>
            {mission.duration_min == null
              ? "Pending"
              : mission.duration_min + " min"}
          </strong>
        </div>
      </div>
      <div className="investigation">
        <Panel
          title="Actions"
          action={
            <span className="small muted">{actions.length} in sequence</span>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Waypoint</th>
                  <th>Outcome</th>
                  <th>Battery</th>
                </tr>
              </thead>
              <tbody>
                {actions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No actions yet.
                    </td>
                  </tr>
                )}
                {actions.map((a) => (
                  <tr
                    key={a.action_id}
                    className={
                      "action-row " +
                      (selected?.action_id === a.action_id ? "selected" : "")
                    }
                  >
                    <td className="mono muted">
                      {a.sequence == null
                        ? "—"
                        : a.sequence.toString().padStart(2, "0")}
                    </td>
                    <td>
                      <button
                        className="action-select"
                        aria-pressed={a.action_id === selected?.action_id}
                        onClick={() => setSelectedId(a.action_id)}
                        aria-label={humanize(a.action_type) + " " + a.action_id}
                      >
                        {humanize(a.action_type)}
                        <span>
                          {(a.timestamp ? a.timestamp.slice(11, 16) : "Pending") +
                            " · " +
                            a.action_id}
                        </span>
                      </button>
                    </td>
                    <td className="mono">{pending(a.location_id)}</td>
                    <td>
                      <Tag tone={a.status === "SUCCESS" ? "green" : "amber"}>
                        {humanize(a.status)}
                      </Tag>
                    </td>
                    <td className="mono">
                      {a.battery_pct == null ? "Pending" : a.battery_pct + "%"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {selected ? (
        <aside className="panel action-inspector" aria-label="Action evidence">
          <header className="panel-head">
            <h2>Evidence</h2>
            <span className="mono muted">{selected.action_id}</span>
          </header>
          <Capture type={selected.action_type} />
          <dl className="fact-list">
            <div className="fact">
              <dt>Outcome</dt>
              <dd>{humanize(selected.status)}</dd>
            </div>
            <div className="fact">
              <dt>Asset</dt>
              <dd className="mono">{pending(selected.asset_id)}</dd>
            </div>
            <div className="fact">
              <dt>Waypoint</dt>
              <dd>{locationName(data, selected.location_id)}</dd>
            </div>
            <div className="fact">
              <dt>Battery</dt>
              <dd>
                {selected.battery_pct == null
                  ? "Pending"
                  : selected.battery_pct + "%"}
              </dd>
            </div>
            <div className="fact">
              <dt>Recorded</dt>
              <dd>{shortTime(selected.timestamp)}</dd>
            </div>
          </dl>
          {selected.status === "FAILED" && (
            <div className="explanation">
              <span className="small">Recorded failure</span>
              <strong>
                {selected.failure_type
                  ? humanize(selected.failure_type)
                  : "Pending"}
              </strong>
            </div>
          )}
          <div className="inspector-section">Findings</div>
          {findings.length ? (
            findings.map((f) => (
              <div className="reading-row" key={f.anomaly_id}>
                <span>
                  <strong>{humanize(f.anomaly_type)}</strong>
                  <br />
                  <small className="muted">{f.description}</small>
                </span>
                <Tag tone={severityTone(f.severity)}>
                  {humanize(f.severity)}
                </Tag>
              </div>
            ))
          ) : (
            <p className="panel-body small muted">No finding recorded.</p>
          )}
          <div className="inspector-section">Measurements</div>
          {readings.length ? (
            readings.map((r) => (
              <div className="reading-row" key={r.reading_id}>
                <span>
                  {humanize(r.measurement_type)}
                  <br />
                  <small className="muted">
                    Quality: {humanize(r.quality)}
                  </small>
                </span>
                <strong>
                  {r.value} {r.unit}
                </strong>
              </div>
            ))
          ) : (
            <p className="panel-body small muted">No reading recorded.</p>
          )}
        </aside>
        ) : (
          <aside className="panel action-inspector" aria-label="Action evidence">
            <header className="panel-head">
              <h2>Evidence</h2>
            </header>
            <p className="panel-body small muted">No actions yet.</p>
          </aside>
        )}
      </div>
    </>
  );
}
