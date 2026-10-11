"use client";
import Link from "next/link";
import { useState } from "react";
import {
  actionFindings,
  humanize,
  nextStepForFailure,
  missionActions,
  missionLabel,
  pending,
  shortTime,
} from "@sentinel/core";
import { PageHeading, Panel, severityTone, Tag } from "../components/ui";
import {
  equipmentName,
  missionName,
  operatorText,
  placeName,
} from "../lib/operator-copy";
import { Capture } from "../components/findings";
import { useInspectionData, useInspectionReady } from "../lib/inspection-data";
import { forwardRowClick } from "../lib/row-link";

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
        title={missionName(data, missionId)}
        subtitle={
          shortTime(mission.start_time) +
          (mission.configuration_version
            ? " · " +
              operatorText(mission.configuration_version, "Not specified")
            : "")
        }
      >
        <Link
          className="btn green"
          href={"/review?mission=" + encodeURIComponent(missionId)}
        >
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
            {operatorText(humanize(label))}
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
          <strong>{actions.filter((a) => a.status === "FAILED").length}</strong>
        </div>
        <div className="datum">
          <span className="small muted">Battery</span>
          <strong>
            {mission.start_battery_pct == null &&
            mission.end_battery_pct == null
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
                  <th>Location</th>
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
                      "action-row linked-row " +
                      (selected?.action_id === a.action_id ? "selected" : "")
                    }
                    onClick={forwardRowClick}
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
                        aria-label={
                          operatorText(humanize(a.action_type)) +
                          " check " +
                          (a.sequence ?? "") +
                          " at " +
                          placeName(data, a.location_id)
                        }
                      >
                        {operatorText(humanize(a.action_type))}
                        <span>
                          {a.timestamp ? a.timestamp.slice(11, 16) : "Pending"}
                        </span>
                      </button>
                    </td>
                    <td>{placeName(data, a.location_id)}</td>
                    <td>
                      <Tag tone={a.status === "SUCCESS" ? "green" : "amber"}>
                        {operatorText(humanize(a.status))}
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
          <aside
            key={selected.action_id}
            className="panel action-inspector"
            aria-label="Action evidence"
          >
            <header className="panel-head">
              <h2>Evidence</h2>
              <span className="small muted">
                {operatorText(humanize(selected.action_type))}
              </span>
            </header>
            <Capture type={selected.action_type} />
            <dl className="fact-list">
              <div className="fact">
                <dt>Outcome</dt>
                <dd>{operatorText(humanize(selected.status))}</dd>
              </div>
              <div className="fact">
                <dt>Asset</dt>
                <dd>{equipmentName(data, selected.asset_id)}</dd>
              </div>
              <div className="fact">
                <dt>Location</dt>
                <dd>{placeName(data, selected.location_id)}</dd>
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
                    ? operatorText(humanize(selected.failure_type))
                    : "Pending"}
                </strong>
                <p className="small">
                  {nextStepForFailure(selected.failure_type)}
                </p>
              </div>
            )}
            <div className="inspector-section">Findings</div>
            {findings.length ? (
              findings.map((f) => (
                <div className="reading-row" key={f.anomaly_id}>
                  <span>
                    <strong>{operatorText(humanize(f.anomaly_type))}</strong>
                    <br />
                    <small className="muted">
                      {operatorText(
                        f.description,
                        "This finding needs a closer inspection.",
                      )}
                    </small>
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
                    {operatorText(humanize(r.measurement_type))}
                    <br />
                    <small className="muted">
                      Quality: {operatorText(humanize(r.quality))}
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
          <aside
            className="panel action-inspector"
            aria-label="Action evidence"
          >
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
